import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getRedis } from '@/lib/redis';

const SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';
const QUEUE_KEY = 'cfz_queue';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });

    let username: string;
    try {
      const decoded = jwt.verify(token, SECRET) as { username: string };
      username = decoded.username;
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const redis = getRedis();

    // 1. Check for historical active room allocations
    const existingRoom = await redis.get(`player:${username}:room`);
    if (existingRoom) {
      // Check if this historical room has already been finalized by a winner
      const matchWinner = await redis.get(`winner:${existingRoom}`);
      if (matchWinner) {
        // Self-heal: Clean up the dead room mapping since the match is over
        await redis.del(`player:${username}:room`);
      } else {
        // The match is truly active and still running, return the room link
        return NextResponse.json({ status: 'matched', roomId: existingRoom });
      }
    }

    // 2. Clear out any duplicate listings of this user sitting inside the queue array
    await redis.lrem(QUEUE_KEY, 0, username);

    // 3. Attempt to match with an available waiting candidate
    const opponent = await redis.lpop(QUEUE_KEY);

    if (opponent) {
      // Prevent pairing loops with yourself due to race conditions or multi-clicks
      if (opponent === username) {
        await redis.rpush(QUEUE_KEY, username);
        return NextResponse.json({ status: 'waiting' });
      }

const roomId = `battle_${Date.now()}_${[username, opponent].sort().join('_')}`;
const matchStartTime = Math.floor(Date.now() / 1000).toString();

const pipeline = redis.pipeline();

// Store the room mapping for both players
pipeline.mset({
  [`player:${username}:room`]: roomId,
  [`player:${opponent}:room`]: roomId
});

// Record the definitive server-side match initialization timestamp
pipeline.set(`match:${roomId}:start_time`, matchStartTime, 'EX', 3600);

await pipeline.exec();

const matchPayload = { player1: username, player2: opponent, roomId };
await redis.publish('matches', JSON.stringify(matchPayload));

return NextResponse.json({ status: 'matched', roomId });
    }

    // 4. No candidate found -> append username to the queue list structure
    await redis.rpush(QUEUE_KEY, username);
    await redis.expire(QUEUE_KEY, 300);

    return NextResponse.json({ status: 'waiting' });
  } catch (err) {
    console.error('Queue POST engine loop error:', err);
    return NextResponse.json({ error: 'Internal system communication failure' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ success: false });

    let username: string;
    try {
      const decoded = jwt.verify(token, SECRET) as { username: string };
      username = decoded.username;
    } catch {
      return NextResponse.json({ success: false });
    }

    const redis = getRedis();

    // Pull user out of matching pool arrays
    await redis.lrem(QUEUE_KEY, 0, username);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Queue DELETE processing error:', err);
    return NextResponse.json({ success: false });
  }
}
