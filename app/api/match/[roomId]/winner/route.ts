// src/app/api/match/[roomId]/winner/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }  // ← Promise!
) {
  const { roomId } = await params; // ← MUST AWAIT!

  const redis = getRedis();
  const winner = await redis.get(`winner:${roomId}`);

  return NextResponse.json({ winner: winner || null });
}