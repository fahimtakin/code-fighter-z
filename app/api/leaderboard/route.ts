import { NextResponse } from 'next/server';
import { createClient } from 'redis';
import { LeaderboardEntry } from '@/types/match';

const redis = createClient({ url: 'redis://localhost:6379' });
redis.connect();

export async function GET(): Promise<NextResponse<LeaderboardEntry[]>> {
  const leaders = await redis.zRevRangeWithScores('leaderboard', 0, 9) as Array<{ value: string; score: number }>;
  const formatted: LeaderboardEntry[] = Array.isArray(leaders)
    ? leaders.map((entry) => ({
        user: entry.value,
        wins: Number(entry.score),
      }))
    : [];
  return NextResponse.json(formatted);
}