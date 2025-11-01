import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import { CodeSubmission, SubmissionResponse, SubmissionResult } from '@/types/submission';
import { MatchUpdate } from '@/types/socket';

const docker = new Docker();
const redis = createClient({ url: 'redis://localhost:6379' });
redis.connect();
const SECRET = 'your-secret-key'; // Use env vars in production

export async function POST(req: NextRequest): Promise<NextResponse<SubmissionResponse>> {
  const token = req.headers.get('authorization')?.split(' ')[1];
  if (!token) return NextResponse.json({ status: 'submitted', error: 'Unauthorized' } as SubmissionResponse & { error: string }, { status: 401 });

  const { username } = jwt.verify(token, SECRET) as { username: string };
  const { matchId, code } = (await req.json()) as CodeSubmission;

  await redis.set(`${matchId}:${username}:code`, code);
  const keys = await redis.keys(`${matchId}:*:code`);

  if (keys.length === 2) {
    const results = await runInSandbox(matchId);
    const winner = determineWinner(results);
    await redis.hSet(matchId, { status: 'completed', winner });
    await redis.publish('matches', JSON.stringify({ matchId, winner } as MatchUpdate));
    await redis.zIncrBy('leaderboard', 1, winner);
    return NextResponse.json({ status: 'completed', winner });
  }
  return NextResponse.json({ status: 'submitted' });
}

async function runInSandbox(matchId: string): Promise<Record<string, SubmissionResult>> {
  const match = await redis.hGetAll(matchId);
  const players = [match.player1, match.player2].filter(Boolean) as string[];
  const results: Record<string, SubmissionResult> = {};

  for (const player of players) {
    const code = await redis.get(`${matchId}:${player}:code`);
    if (!code) continue;

    // Hardcoded binary search problem for simplicity
    const testCode = `
def binary_search(arr, target):
    ${code}  # User provides function body

# Test cases (hidden from players)
tests = [
    ([1, 3, 5, 7], 5, 2),  # arr, target, expected
    ([1, 2, 3], 4, -1),
    ([], 1, -1),
]
results = []
for arr, target, expected in tests:
    result = binary_search(arr, target)
    results.append(result == expected)
passed = all(results)
print("PASSED" if passed else "FAILED")
    `;

    const startTime = performance.now();
    const container = await docker.createContainer({
      Image: 'python:3.9-slim',
      Cmd: ['python', '-c', testCode],
      AttachStdout: true,
      AttachStderr: true,
      HostConfig: {
        Memory: 128 * 1024 * 1024, // 128MB memory limit
        NanoCpus: 1_000_000_000, // 1 CPU
      },
    });

    try {
      await container.start();
      const stream = await container.attach({ stream: true, stdout: true, stderr: true });
      let output = '';
      stream.on('data', (chunk) => (output += chunk.toString('utf8')));
      await new Promise((resolve) => stream.on('end', resolve));

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Execution timed out')), 5000)
      );
      await Promise.race([container.wait(), timeout]);

      const endTime = performance.now();
      await container.remove();

      results[player] = {
        passed: output.includes('PASSED'),
        time: endTime - startTime,
        output,
      };
    } catch (error) {
      await container.remove();
      results[player] = {
        passed: false,
        time: Infinity,
        output: (error as Error).message,
      };
    }
  }
  return results;
}

function determineWinner(results: Record<string, SubmissionResult>): string {
  const players = Object.keys(results);
  if (players.length < 2) return 'tie'; // Edge case

  const [p1, p2] = players;
  const r1 = results[p1];
  const r2 = results[p2];

  if (r1.passed && !r2.passed) return p1;
  if (!r1.passed && r2.passed) return p2;
  if (!r1.passed && !r2.passed) return 'tie';
  return r1.time < r2.time ? p1 : p2;
}