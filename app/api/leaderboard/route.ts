import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

interface LeaderboardEntry {
  user: string;
  wins: number;
}

export async function GET() {
  try {
    const redis = getRedis();

    // Query ioredis using the correct zrevrange method with WITHSCORES argument
    const rawLeaders = await redis.zrevrange('leaderboard', 0, 9, 'WITHSCORES');

    const formatted: LeaderboardEntry[] = [];

    // Parse alternating flat array array into structured objects
    for (let i = 0; i < rawLeaders.length; i += 2) {
      const user = rawLeaders[i];
      const score = rawLeaders[i + 1];
      
      if (user && score !== undefined) {
        formatted.push({
          user,
          wins: Number(score),
        });
      }
    }

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('[Leaderboard API] Query execution failure:', error);
    return NextResponse.json({ error: 'Failed to retrieve standings logs' }, { status: 500 });
  }
}
