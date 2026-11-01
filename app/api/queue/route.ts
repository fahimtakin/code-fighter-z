import { NextResponse } from 'next/server';
import { requireSession, route } from '@/lib/http';
import { joinQueue, leaveQueue } from '@/lib/match/matchmaking';
import { rateLimit } from '@/lib/rate-limit';

/** Join the queue, or refresh your place in it (the client calls this every few seconds). */
export const POST = route(async (req) => {
  const session = await requireSession(req);
  await rateLimit(`queue:${session.userId}`, 60, 60);
  return NextResponse.json(await joinQueue(session.userId));
});

export const DELETE = route(async (req) => {
  const session = await requireSession(req);
  await leaveQueue(session.userId);
  return NextResponse.json({ ok: true });
});
