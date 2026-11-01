import { notFound, redirect } from 'next/navigation';
import { MatchArena } from '@/components/match/match-arena';
import { getServerSession } from '@/lib/auth/server-session';
import { HttpError } from '@/lib/errors';
import { getMatchView } from '@/lib/match/service';
import type { MatchView } from '@/lib/shared/types';
import { matchIdSchema } from '@/lib/validation';

export const metadata = { title: 'Match' };

export default async function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const session = await getServerSession();
  if (!session) redirect('/auth');

  const parsed = matchIdSchema.safeParse((await params).matchId);
  if (!parsed.success) notFound();

  let view: MatchView | null;
  try {
    view = await getMatchView(parsed.data, session.userId);
  } catch (err) {
    // Someone else's match: send them home instead of showing it.
    if (err instanceof HttpError && err.status === 403) redirect('/dashboard');
    throw err;
  }
  if (!view) notFound();

  return <MatchArena initial={view} />;
}
