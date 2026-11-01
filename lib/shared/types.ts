/**
 * Types shared by the server and the browser. This file must stay free of
 * runtime imports so client bundles never pull in server code.
 */
import type { PublicProblem } from '../problems/types';

export type Verdict = 'accepted' | 'wrong_answer' | 'runtime_error' | 'time_limit' | 'compile_error';

export interface CaseResult {
  index: number;
  hidden: boolean;
  passed: boolean;
  /** Visible cases only: hidden test data never leaves the server. */
  input?: string;
  expected?: string;
  actual?: string;
  error?: string;
}

export interface JudgeResult {
  verdict: Verdict;
  passed: number;
  total: number;
  cases: CaseResult[];
  /** Compile errors and the first runtime error, shown above the case list. */
  message?: string;
  durationMs: number;
}

export type MatchOutcome = 'solved' | 'timeout' | 'forfeit' | 'draw';

export interface PlayerView {
  id: string;
  username: string;
  rating: number;
}

export interface Progress {
  passed: number;
  total: number;
}

export interface MatchResult {
  winnerId: string | null;
  outcome: MatchOutcome;
  ratingDeltas: Record<string, number>;
}

export interface MatchView {
  id: string;
  status: 'active' | 'finished';
  problem: PublicProblem;
  you: PlayerView;
  opponent: PlayerView;
  startedAt: number;
  endsAt: number;
  /** Lets the client correct for its own clock being off. */
  serverNow: number;
  progress: { you: Progress | null; opponent: Progress | null };
  result: MatchResult | null;
}

export interface SubmitResponse {
  mode: 'run' | 'submit';
  result: JudgeResult;
  matchOver: boolean;
  won?: boolean;
}

export type QueueStatus =
  | { status: 'matched'; matchId: string }
  | { status: 'waiting'; waitedSeconds: number; ratingWindow: number };

export interface MatchHistoryEntry {
  id: string;
  problemTitle: string;
  opponent: string;
  result: 'win' | 'loss' | 'draw';
  outcome: MatchOutcome;
  ratingDelta: number;
  endedAt: string;
}

export interface LeaderboardEntry {
  username: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface ServerToClientEvents {
  'match:found': (payload: { matchId: string }) => void;
  'match:progress': (payload: { userId: string; passed: number; total: number }) => void;
  'match:presence': (payload: { userId: string; online: boolean; forfeitAt?: number }) => void;
  'match:over': (payload: MatchResult & { matchId: string }) => void;
}

export interface ClientToServerEvents {
  'match:join': (matchId: string, ack: (response: { ok: boolean; error?: string }) => void) => void;
}
