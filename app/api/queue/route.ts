import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';

const SECRET = process.env.JWT_SECRET!;
const redis = createClient({ url: process.env.REDIS_URL });
redis.connect();

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'No token' }, { status: 401 });
  }

  let username: string;
  try {
    const decoded = jwt.verify(token, SECRET) as { username: string };
    username = decoded.username;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Check if user already has a match
  const existingMatch = await redis.get(`match:${username}`);
  if (existingMatch) {
    return NextResponse.json({ status: 'matched', matchId: existingMatch });
  }

  const inQueue = await redis.sIsMember('queue', username);
  if (inQueue) {
    // Already in queue — check if match formed
    const queue = await redis.sMembers('queue');
    if (queue.length >= 2) {
      const [player1, player2] = queue;
      const matchId = `match:${Date.now()}`;
      await redis.hSet(matchId, { player1, player2, status: 'waiting' });
      await redis.del('queue');

      // SAVE MATCH ID FOR BOTH
      await redis.set(`match:${player1}`, matchId);
      await redis.set(`match:${player2}`, matchId);

      return NextResponse.json({ status: 'matched', matchId });
    }
    return NextResponse.json({ status: 'waiting' });
  }

  // Add to queue
  await redis.sAdd('queue', username);
  const queue = await redis.sMembers('queue');

  if (queue.length >= 2) {
    const [player1, player2] = queue;
    const matchId = `match:${Date.now()}`;
    await redis.hSet(matchId, { player1, player2, status: 'waiting' });
    await redis.del('queue');

    // SAVE MATCH ID FOR BOTH
    await redis.set(`match:${player1}`, matchId);
    await redis.set(`match:${player2}`, matchId);

    return NextResponse.json({ status: 'matched', matchId });
  }

  return NextResponse.json({ status: 'waiting' });
}