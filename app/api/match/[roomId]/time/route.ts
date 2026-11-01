import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const redis = getRedis();

    const startTimeRaw = await redis.get(`match:${roomId}:start_time`);
    if (!startTimeRaw) {
      return NextResponse.json({ timeLeft: 0 });
    }

    const startTime = parseInt(startTimeRaw, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const totalMatchDuration = 300; // 5 minutes in seconds

    const elapsedTime = currentTime - startTime;
    const remainingTime = Math.max(0, totalMatchDuration - elapsedTime);

    return NextResponse.json({ timeLeft: remainingTime });
  } catch (error) {
    console.error('[Time API] Failed calculating countdown boundary:', error);
    return NextResponse.json({ timeLeft: 0 }, { status: 500 });
  }
}
