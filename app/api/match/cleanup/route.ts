import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getRedis } from '@/lib/redis';

const SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized profile state' }, { status: 401 });
    }

    let username: string;
    try {
      const decoded = jwt.verify(token, SECRET) as { username: string };
      username = decoded.username;
    } catch {
      return NextResponse.json({ error: 'Invalid token signature' }, { status: 401 });
    }

    const redis = getRedis();

    // Clear the player's active room mapping to allow entering new matches
    await redis.del(`player:${username}:room`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Cleanup API] Failed to purge player room allocation:', error);
    return NextResponse.json({ error: 'Internal system error' }, { status: 500 });
  }
}
