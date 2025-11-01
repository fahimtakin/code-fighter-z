import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
// If you don't have a custom redis client, use ioredis or redis npm package:
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const SECRET = process.env.JWT_SECRET!;

export async function POST(req: NextRequest) {
  const { action, username, password } = await req.json();

  // === SIGNUP: PUBLIC, NO TOKEN REQUIRED ===
  if (action === 'signup') {
    const exists = await redis.exists(`user:${username}`);
    if (exists) {
      return NextResponse.json({ error: 'User exists' }, { status: 400 });
    }

    await redis.hset(`user:${username}`, { password, wins: 0, losses: 0 });
    const token = jwt.sign({ username }, SECRET, { expiresIn: '7d' });

    const res = NextResponse.json({ token });
    res.cookies.set('auth-token', token, { httpOnly: true, path: '/' });
    return res;
  }

  // === LOGIN: REQUIRES NO TOKEN, JUST CREDENTIALS ===
  if (action === 'login') {
    const user = await redis.hgetall(`user:${username}`);
    if (!user.password || user.password !== password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = jwt.sign({ username }, SECRET, { expiresIn: '7d' });
    const res = NextResponse.json({ token });
    res.cookies.set('auth-token', token, { httpOnly: true, path: '/' });
    return res;
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}