// app/api/queue/route.ts  ← REPLACE YOUR FILE WITH THIS EXACT CODE
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getRedis } from '@/lib/redis';

const SECRET = process.env.JWT_SECRET!;
const QUEUE_KEY = 'cfz_queue';  // ← MUST BE SAME IN POST AND DELETE

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });

    let username: string;
    try {
      const decoded = jwt.verify(token, SECRET) as { username: string };
      username = decoded.username;
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const redis = getRedis();

    // 1. Check if already matched
    const existing = await redis.get(`player:${username}:room`);
    if (existing) {
      return NextResponse.json({ status: 'matched', roomId: existing });
    }

    // 2. Try to match with someone in queue
    const opponent = await redis.lpop(QUEUE_KEY);  // ← THIS MUST WORK

    if (opponent && opponent !== username) {
      const roomId = `battle_${Date.now()}_${[username, opponent].sort().join('_')}`;

      // Set room for both players
      await redis.set(`player:${username}:room`, roomId);
      await redis.set(`player:${opponent}:room`, roomId);

      console.log(`MATCHED: ${username} vs ${opponent} → ${roomId}`);

      return NextResponse.json({ status: 'matched', roomId });
    }

    // 3. No match → add to queue (RPUSH = right push = FIFO)
    await redis.rpush(QUEUE_KEY, username);
    await redis.expire(QUEUE_KEY, 300);

    console.log(`Added to queue: ${username} | Queue length: ${await redis.llen(QUEUE_KEY)}`);

    return NextResponse.json({ status: 'waiting' });
  } catch (err: any) {
    console.error('Queue POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ success: false });

    let username: string;
    try {
      const decoded = jwt.verify(token, SECRET) as { username: string };
      username = decoded.username;
    } catch {
      return NextResponse.json({ success: false });
    }

    const redis = getRedis();

    // Remove from queue — MUST use same key!
    await redis.lrem(QUEUE_KEY, 0, username);

    // Clean up room
    const room = await redis.get(`player:${username}:room`);
    if (room) {
      await redis.srem(room, username);
      await redis.del(`player:${username}:room`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Queue DELETE error:', err);
    return NextResponse.json({ success: false });
  }
}