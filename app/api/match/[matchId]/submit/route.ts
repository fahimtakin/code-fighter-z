import { NextResponse } from 'next/server';
import { parseBody, requireSession, route } from '@/lib/http';
import { submitSolution } from '@/lib/match/service';
import { matchIdSchema, submissionSchema } from '@/lib/validation';

type Ctx = { params: Promise<{ matchId: string }> };

/** mode "run" checks the visible examples only; mode "submit" runs every test and can win the match. */
export const POST = route<Ctx>(async (req, { params }) => {
  // Who is submitting comes from the signed session, never from the request body.
  const session = await requireSession(req);
  const matchId = matchIdSchema.parse((await params).matchId);
  const { code, mode } = await parseBody(req, submissionSchema);
  return NextResponse.json(await submitSolution(matchId, session.userId, code, mode));
});
