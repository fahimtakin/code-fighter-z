'use client';

import Editor, { type OnMount } from '@monaco-editor/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Logo } from '@/components/logo';
import { api, ApiError } from '@/lib/client/api';
import { getSocket } from '@/lib/client/socket';
import type { MatchView, PlayerView, Progress, SubmitResponse } from '@/lib/shared/types';
import { ProblemPanel } from './problem-panel';
import { ResultOverlay } from './result-overlay';
import { ResultsPanel } from './results-panel';

type Presence = { online: boolean; forfeitAt?: number };

const draftKey = (matchId: string) => `cfz:draft:${matchId}`;

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const formatClock = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const better = (a: Progress | null, b: Progress) => (!a || b.passed > a.passed ? b : a);

export function MatchArena({ initial }: { initial: MatchView }) {
  const matchId = initial.id;
  const [view, setView] = useState(initial);
  const [code, setCode] = useState(initial.problem.starterCode);
  const [progress, setProgress] = useState(initial.progress);
  const [presence, setPresence] = useState<Presence>({ online: true });
  const [pending, setPending] = useState<'run' | 'submit' | null>(null);
  const [response, setResponse] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The server's clock is the authority. Remember how far ours is off so the
  // countdown matches what the server will enforce.
  const clockOffset = useRef(initial.serverNow - Date.now());
  const now = useNow(250);
  const remaining = view.endsAt - (now + clockOffset.current);
  const active = view.status === 'active';

  const refresh = useCallback(async () => {
    try {
      const next = await api<MatchView>(`/api/match/${matchId}`);
      clockOffset.current = next.serverNow - Date.now();
      setView(next);
      setProgress(next.progress);
    } catch {
      // Transient: the next poll or socket event retries.
    }
  }, [matchId]);

  // Restore an unsaved draft after a refresh.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey(matchId));
      if (saved) setCode(saved);
    } catch {}
  }, [matchId]);

  const updateCode = (value: string | undefined) => {
    setCode(value ?? '');
    try {
      localStorage.setItem(draftKey(matchId), value ?? '');
    } catch {}
  };

  // Real-time channel: join the room and listen for opponent progress, presence and the result.
  useEffect(() => {
    const socket = getSocket();
    const join = () =>
      socket.emit('match:join', matchId, (res) => {
        if (!res.ok) setError(res.error ?? 'Could not join the match room');
      });
    const onProgress = (p: { userId: string; passed: number; total: number }) =>
      setProgress((prev) =>
        p.userId === initial.you.id ? { ...prev, you: better(prev.you, p) } : { ...prev, opponent: better(prev.opponent, p) },
      );
    const onPresence = (p: { userId: string; online: boolean; forfeitAt?: number }) => {
      if (p.userId === initial.opponent.id) setPresence({ online: p.online, forfeitAt: p.forfeitAt });
    };
    const onOver = (p: { matchId: string }) => {
      if (p.matchId === matchId) void refresh();
    };

    socket.on('connect', join);
    socket.on('match:progress', onProgress);
    socket.on('match:presence', onPresence);
    socket.on('match:over', onOver);
    if (socket.connected) join();
    return () => {
      socket.off('connect', join);
      socket.off('match:progress', onProgress);
      socket.off('match:presence', onPresence);
      socket.off('match:over', onOver);
    };
  }, [matchId, initial.you.id, initial.opponent.id, refresh]);

  // Safety net if the socket is down: poll slowly, and quickly once the clock hits zero
  // (the server sweeper finalizes expired matches within a few seconds).
  useEffect(() => {
    if (!active) return;
    const id = setInterval(refresh, remaining <= 0 ? 2_000 : 15_000);
    return () => clearInterval(id);
  }, [active, remaining <= 0, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active) {
      try {
        localStorage.removeItem(draftKey(matchId));
      } catch {}
    }
  }, [active, matchId]);

  const send = useCallback(
    async (mode: 'run' | 'submit') => {
      if (pending || !active) return;
      setPending(mode);
      setError(null);
      try {
        const res = await api<SubmitResponse>(`/api/match/${matchId}/submit`, { method: 'POST', json: { code, mode } });
        setResponse(res);
        if (res.matchOver) await refresh();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Network error, try again');
        if (err instanceof ApiError && err.status === 409) await refresh();
      } finally {
        setPending(null);
      }
    },
    [pending, active, matchId, code, refresh],
  );

  // Monaco keybindings are registered once, so they call through a ref to the latest `send`.
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);
  const onMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => sendRef.current('run'));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => sendRef.current('submit'));
  };

  const total = view.problem.examples.length + view.problem.hiddenTestCount;
  const lowTime = active && remaining < 60_000;

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-900 px-4 py-3">
        <Logo href="/dashboard" />
        <div className="flex flex-1 items-center justify-center gap-6">
          <PlayerChip player={view.you} progress={progress.you} total={total} you />
          <span className="font-black text-zinc-600">VS</span>
          <PlayerChip player={view.opponent} progress={progress.opponent} total={total} online={presence.online} />
        </div>
        <div
          className={`rounded-lg px-4 py-1.5 font-mono text-2xl font-bold tabular-nums ${lowTime ? 'animate-pulse bg-red-950 text-red-400' : 'bg-zinc-900 text-zinc-100'}`}
          aria-label="Time remaining"
        >
          {active ? formatClock(remaining) : 'ENDED'}
        </div>
      </header>

      {active && !presence.online && (
        <div className="border-b border-amber-900/50 bg-amber-950/30 px-4 py-2 text-center text-sm text-amber-300">
          {view.opponent.username} disconnected.
          {presence.forfeitAt && ` They forfeit in ${formatClock(presence.forfeitAt - (now + clockOffset.current))} unless they return.`}
        </div>
      )}

      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <aside className="border-zinc-900 lg:w-[40%] lg:overflow-y-auto lg:border-r">
          <ProblemPanel problem={view.problem} />
        </aside>

        <section className="flex flex-1 flex-col lg:min-h-0">
          <div className="h-[55vh] lg:h-auto lg:flex-1">
            <Editor
              height="100%"
              defaultLanguage="javascript"
              theme="vs-dark"
              value={code}
              onChange={updateCode}
              onMount={onMount}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                padding: { top: 16 },
                scrollBeyondLastLine: false,
                readOnly: !active,
                tabSize: 2,
              }}
            />
          </div>

          <div className="flex flex-col border-t border-zinc-900 lg:h-[38%]">
            <div className="flex items-center justify-between border-b border-zinc-900 px-4 py-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Results</span>
              <div className="flex gap-2">
                <button
                  onClick={() => send('run')}
                  disabled={!!pending || !active}
                  className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 disabled:opacity-40"
                >
                  {pending === 'run' ? 'Running…' : 'Run'}
                </button>
                <button
                  onClick={() => send('submit')}
                  disabled={!!pending || !active}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-40"
                >
                  {pending === 'submit' ? 'Judging…' : 'Submit'}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ResultsPanel response={response} error={error} />
            </div>
          </div>
        </section>
      </div>

      {view.result && <ResultOverlay view={view} />}
    </div>
  );
}

function PlayerChip(props: { player: PlayerView; progress: Progress | null; total: number; you?: boolean; online?: boolean }) {
  const passed = props.progress?.passed ?? 0;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-sm">
        {!props.you && (
          <span className={`h-2 w-2 rounded-full ${props.online ? 'bg-emerald-500' : 'bg-zinc-600'}`} aria-hidden />
        )}
        <span className={`truncate font-bold ${props.you ? 'text-yellow-400' : 'text-red-400'}`}>
          {props.you ? 'You' : props.player.username}
        </span>
        <span className="font-mono text-xs text-zinc-500">{props.player.rating}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full transition-all ${props.you ? 'bg-yellow-400' : 'bg-red-500'}`}
            style={{ width: `${(passed / props.total) * 100}%` }}
          />
        </div>
        <span className="font-mono text-xs text-zinc-500">
          {passed}/{props.total}
        </span>
      </div>
    </div>
  );
}
