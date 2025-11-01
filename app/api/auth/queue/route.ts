import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' });
await redis.connect();

const SECRET = process.env.JWT_SECRET!;

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let username: string;
  try {
    const decoded = jwt.verify(token, SECRET) as { username: string };
    username = decoded.username;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Simple queue: add to waiting list
  const inQueue = await redis.sIsMember('queue', username);
  if (inQueue) return NextResponse.json({ status: 'waiting' });

  await redis.sAdd('queue', username);
  const queue = await redis.sMembers('queue');

  if (queue.length >= 2) {
    const [player1, player2] = queue;
    const matchId = `match:${Date.now()}`;
    await redis.hSet(matchId, { player1, player2, status: 'waiting' });
    await redis.del('queue');
    return NextResponse.json({ status: 'matched', matchId });
  }

  return NextResponse.json({ status: 'waiting' });
}