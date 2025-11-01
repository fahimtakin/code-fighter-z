import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' });
await redis.connect();

const SECRET = process.env.JWT_SECRET!;

export async function POST(req: NextRequest) {
  const { action, username, password } = await req.json();

  if (action === 'signup') {
    const exists = await redis.exists(`user:${username}`);
    if (exists) return NextResponse.json({ error: 'User exists' }, { status: 400 });
    await redis.hSet(`user:${username}`, { password, wins: 0, losses: 0 });

    const token = jwt.sign({ username }, SECRET, { expiresIn: '7d' });
    const res = NextResponse.json({ token });
    res.cookies.set('auth-token', token, { httpOnly: true, path: '/' });
    return res;
  }

  if (action === 'login') {
    const user = await redis.hGetAll(`user:${username}`);
    if (user.password !== password) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    const token = jwt.sign({ username }, SECRET, { expiresIn: '7d' });
    const res = NextResponse.json({ token });
    res.cookies.set('auth-token', token, { httpOnly: true, path: '/' });
    return res;
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}