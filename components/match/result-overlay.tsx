import Link from 'next/link';
import type { MatchView } from '@/lib/shared/types';

export function ResultOverlay({ view }: { view: MatchView }) {
  const result = view.result!;
  const won = result.winnerId === view.you.id;
  const draw = result.winnerId === null;
  const delta = result.ratingDeltas[view.you.id] ?? 0;
  const winnerName = won ? 'You' : view.opponent.username;

  const reason = {
    solved: `${winnerName} solved it first.`,
    timeout: `Time ran out. ${winnerName} passed more tests.`,
    forfeit: won ? `${view.opponent.username} left the match.` : 'You left the match and forfeited.',
    draw: 'Time ran out with no tests passed on either side.',
  }[result.outcome];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center shadow-2xl">
        <p
          className={`text-6xl font-black tracking-tighter ${draw ? 'text-zinc-300' : won ? 'text-yellow-400' : 'text-red-600'}`}
        >
          {draw ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT'}
        </p>
        <p className="mt-4 text-zinc-400">{reason}</p>
        <p className={`mt-6 font-mono text-3xl font-bold ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {delta >= 0 ? '+' : ''}
          {delta}
          <span className="ml-2 text-base text-zinc-500">rating → {view.you.rating + delta}</span>
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/dashboard"
            className="flex-1 rounded-xl border border-zinc-700 py-3 font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white"
          >
            Dashboard
          </Link>
          <Link href="/dashboard?queue=1" className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-500">
            Play again
          </Link>
        </div>
      </div>
    </div>
  );
}
