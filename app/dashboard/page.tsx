import { redirect } from 'next/navigation';
import { Logo } from '@/components/logo';
import { MatchFinder } from '@/components/dashboard/match-finder';
import { SignOutButton } from '@/components/dashboard/sign-out-button';
import { getServerSession } from '@/lib/auth/server-session';
import { getActiveMatchId } from '@/lib/match/matchmaking';
import type { LeaderboardEntry, MatchHistoryEntry } from '@/lib/shared/types';
import { getLeaderboard, getMatchHistory, getProfile } from '@/lib/users';

export const metadata = { title: 'Dashboard' };

/**
 * A Server Component: the data is loaded on the server straight from the
 * database, so the page arrives complete with no loading spinners. Only the
 * interactive part (MatchFinder) ships JavaScript to the browser.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ queue?: string }> }) {
  const session = await getServerSession();
  if (!session) redirect('/auth');

  const [profile, leaderboard, history, activeMatchId, params] = await Promise.all([
    getProfile(session.userId),
    getLeaderboard(),
    getMatchHistory(session.userId),
    getActiveMatchId(session.userId),
    searchParams,
  ]);
  // A valid token for an account that no longer exists (e.g. the DB was reset).
  if (!profile) redirect('/auth');

  const played = profile.wins + profile.losses + profile.draws;
  const winRate = played ? Math.round((profile.wins / played) * 100) : 0;

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">
              <span className="font-semibold text-yellow-400">{profile.username}</span>
              <span className="ml-2 font-mono text-zinc-500">{profile.rating}</span>
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <MatchFinder activeMatchId={activeMatchId} autoStart={params.queue === '1'} />

          <div className="grid grid-cols-3 gap-4">
            <Stat label="Rating" value={profile.rating} accent />
            <Stat label="W / L / D" value={`${profile.wins} / ${profile.losses} / ${profile.draws}`} />
            <Stat label="Win rate" value={played ? `${winRate}%` : '—'} />
          </div>

          <History entries={history} />
        </div>

        <Leaderboard entries={leaderboard} me={profile.username} />
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold ${accent ? 'text-yellow-400' : ''}`}>{value}</p>
    </div>
  );
}

const outcomeLabel: Record<MatchHistoryEntry['outcome'], string> = {
  solved: 'solved',
  timeout: 'on time',
  forfeit: 'forfeit',
  draw: 'draw',
};

function History({ entries }: { entries: MatchHistoryEntry[] }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
      <h2 className="border-b border-zinc-800 px-5 py-3 text-sm font-bold uppercase tracking-wider text-zinc-400">
        Recent matches
      </h2>
      {entries.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-zinc-500">No matches yet. Your history shows up here.</p>
      ) : (
        <ul className="divide-y divide-zinc-800/70">
          {entries.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  vs {m.opponent} <span className="font-normal text-zinc-500">· {m.problemTitle}</span>
                </p>
                <p className="text-xs text-zinc-500">
                  {new Date(m.endedAt).toLocaleString()} · {outcomeLabel[m.outcome]}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${
                    m.result === 'win'
                      ? 'bg-emerald-950 text-emerald-400'
                      : m.result === 'loss'
                        ? 'bg-red-950 text-red-400'
                        : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {m.result}
                </span>
                <span className={`w-12 text-right font-mono ${m.ratingDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {m.ratingDelta >= 0 ? '+' : ''}
                  {m.ratingDelta}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Leaderboard({ entries, me }: { entries: LeaderboardEntry[]; me: string }) {
  return (
    <section className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900/40">
      <h2 className="border-b border-zinc-800 px-5 py-3 text-sm font-bold uppercase tracking-wider text-zinc-400">
        Leaderboard
      </h2>
      <ol className="divide-y divide-zinc-800/70">
        {entries.map((e, i) => (
          <li key={e.username} className="flex items-center justify-between px-5 py-2.5 text-sm">
            <span className="flex items-center gap-3">
              <span
                className={`w-6 font-mono ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-600'}`}
              >
                {i + 1}
              </span>
              <span className={e.username === me ? 'font-bold text-yellow-400' : 'text-zinc-200'}>{e.username}</span>
            </span>
            <span className="font-mono text-zinc-400">{e.rating}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
