import { NextResponse } from 'next/server';
import { HttpError, requireSession, route } from '@/lib/http';
import { getMatchView } from '@/lib/match/service';
import { matchIdSchema } from '@/lib/validation';

type Ctx = { params: Promise<{ matchId: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const session = await requireSession(req);
  const matchId = matchIdSchema.parse((await params).matchId);
  const view = await getMatchView(matchId, session.userId);
  if (!view) throw new HttpError(404, 'Match not found');
  return NextResponse.json(view);
});
