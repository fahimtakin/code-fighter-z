import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { validateBinarySearch } from '@/lib/sandbox';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { username, opponent, code } = await req.json();

    if (!username || !code) {
      return NextResponse.json({ error: 'Incomplete parameters passed.' }, { status: 400 });
    }

    const redis = getRedis();

    // 1. Verify match dynamic target allocation state limits
    const existingWinner = await redis.get(`winner:${roomId}`);
    if (existingWinner) {
      return NextResponse.json({ success: false, message: 'Match execution cycle already finalized.' }, { status: 400 });
    }

    // 2. Validate code via our secure V8 isolated sandbox instance
    const evaluation = await validateBinarySearch(code);
    if (!evaluation.success) {
      return NextResponse.json({ 
        success: false, 
        message: evaluation.message, 
        details: evaluation.details 
      });
    }

    // 3. Atomically check and claim victory via positional ioredis lock allocation
    const claimLock = await redis.set(`winner:${roomId}`, username, 'EX', 3600, 'NX');
    if (!claimLock) {
      return NextResponse.json({ success: false, message: 'Opponent submitted a split-second faster!' });
    }

    // 4. Batch performance metrics updates via case-correct ioredis pipeline commands
    const pipeline = redis.pipeline();
    
    pipeline.hincrby(`user:${username}`, 'wins', 1);
    pipeline.zincrby('leaderboard', 1, username);

    if (opponent) {
      pipeline.hincrby(`user:${opponent}`, 'losses', 1);
    }
    
    await pipeline.exec();

    return NextResponse.json({ success: true, message: 'Victory claimed!' });

  } catch (error: any) {
    console.error('[Submit API] Code execution pipeline crash error:', error);
    return NextResponse.json({ error: 'Internal grading system evaluation failure.' }, { status: 500 });
  }
}
