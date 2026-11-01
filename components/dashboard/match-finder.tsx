'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { getSocket } from '@/lib/client/socket';
import type { QueueStatus } from '@/lib/shared/types';

const HEARTBEAT_MS = 3_000;

export function MatchFinder({ activeMatchId, autoStart }: { activeMatchId: string | null; autoStart: boolean }) {
  const router = useRouter();
  // "Play again" links here with ?queue=1, so we can start searching on first render.
  const [searching, setSearching] = useState(autoStart && !activeMatchId);
  const [foundMatch, setFoundMatch] = useState<string | null>(null);
  const [status, setStatus] = useState<Extract<QueueStatus, { status: 'waiting' }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchingRef = useRef(searching);

  const goToMatch = useCallback(
    (matchId: string) => {
      searchingRef.current = false;
      setSearching(false);
      setFoundMatch(matchId);
      router.push(`/match/${matchId}`);
    },
    [router],
  );

  // Each POST is both "find me someone" and a heartbeat that keeps our queue
  // spot alive. Close the tab and the heartbeat stops, so we drop out on our own.
  const heartbeat = useCallback(async () => {
    try {
      const res = await api<QueueStatus>('/api/queue', { method: 'POST' });
      if (!searchingRef.current) return;
      if (res.status === 'matched') goToMatch(res.matchId);
      else setStatus(res);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return router.replace('/auth');
      // 429s and network blips: keep searching, the next heartbeat retries.
      if (!(err instanceof ApiError && err.status === 429)) setError('Connection problem, retrying…');
    }
  }, [goToMatch, router]);

  // While `searching` is true, this effect owns the heartbeat timer; flipping it
  // to false (cancel, match found, unmount) tears the timer down.
  useEffect(() => {
    searchingRef.current = searching;
    if (!searching) return;
    const first = setTimeout(heartbeat, 0);
    const id = setInterval(heartbeat, HEARTBEAT_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [searching, heartbeat]);

  function start() {
    setError(null);
    setSearching(true);
  }

  async function cancel() {
    searchingRef.current = false;
    setSearching(false);
    setStatus(null);
    await api('/api/queue', { method: 'DELETE' }).catch(() => {});
  }

  // The opponent's request is usually what creates the match; the server pushes
  // it to us over the socket so we don't wait for our next heartbeat.
  useEffect(() => {
    const socket = getSocket();
    const onFound = ({ matchId }: { matchId: string }) => goToMatch(matchId);
    socket.on('match:found', onFound);
    return () => {
      socket.off('match:found', onFound);
    };
  }, [goToMatch]);

  // Leaving the page mid-search: tell the server right away instead of waiting for the heartbeat to expire.
  useEffect(
    () => () => {
      if (searchingRef.current) void fetch('/api/queue', { method: 'DELETE', keepalive: true });
    },
    [],
  );

  if (foundMatch) {
    return (
      <section className="rounded-2xl border border-emerald-800/60 bg-emerald-950/20 p-8">
        <h1 className="text-2xl font-black tracking-tight text-emerald-400">Opponent found!</h1>
        <p className="mt-1 text-sm text-zinc-400">Loading the arena…</p>
      </section>
    );
  }

  if (activeMatchId) {
    return (
      <section className="rounded-2xl border border-yellow-700/50 bg-yellow-950/20 p-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-yellow-400">Match in progress</p>
        <p className="mt-1 text-zinc-300">You&apos;re still in a live match. Get back in before the clock runs out.</p>
        <Link
          href={`/match/${activeMatchId}`}
          className="mt-4 inline-block rounded-xl bg-yellow-500 px-6 py-3 font-bold text-black hover:bg-yellow-400"
        >
          Rejoin match
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-8">
      {!searching ? (
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Ready to fight?</h1>
            <p className="mt-1 text-sm text-zinc-400">You&apos;ll be paired with someone close to your rating.</p>
          </div>
          <button
            onClick={start}
            className="rounded-xl bg-red-600 px-10 py-4 text-lg font-black tracking-tight text-white shadow-lg shadow-red-950/40 transition hover:bg-red-500"
          >
            FIND MATCH
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
              </span>
              <h1 className="text-2xl font-black tracking-tight">Searching for an opponent…</h1>
            </div>
            <p className="mt-2 font-mono text-sm text-zinc-400">
              {status ? `${status.waitedSeconds}s · looking within ±${status.ratingWindow} rating` : 'joining queue'}
            </p>
            {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
          </div>
          <button
            onClick={cancel}
            className="rounded-xl border border-zinc-700 px-6 py-3 font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}
