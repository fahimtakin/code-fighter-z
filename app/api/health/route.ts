import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { redis } from '@/lib/redis';

/** For load balancers and uptime monitors: 200 only if both datastores answer. */
export async function GET() {
  const check = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      return 'ok' as const;
    } catch {
      return 'down' as const;
    }
  };
  const [postgres, redisStatus] = await Promise.all([check(() => pool().query('select 1')), check(() => redis().ping())]);
  const healthy = postgres === 'ok' && redisStatus === 'ok';
  return NextResponse.json({ status: healthy ? 'ok' : 'degraded', postgres, redis: redisStatus }, { status: healthy ? 200 : 503 });
}
