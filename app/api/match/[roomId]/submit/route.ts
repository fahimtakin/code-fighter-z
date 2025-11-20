// src/app/api/match/[roomId]/submit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }  // ← Promise!
) {
  const { roomId } = await params; // ← MUST AWAIT!
  const { username } = await req.json();

  const redis = getRedis();

  // Prevent double win
  const existing = await redis.get(`winner:${roomId}`);
  if (existing) {
    return NextResponse.json({ success: false, message: 'Already has winner' });
  }

  await redis.set(`winner:${roomId}`, username, 'EX', 3600);
  return NextResponse.json({ success: true });
}