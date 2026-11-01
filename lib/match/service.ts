import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { matches, submissions, users } from '../db/schema';
import { ratingDeltas } from '../elo';
import { HttpError } from '../errors';
import { judge, type JudgeCase } from '../judge';
import { logger } from '../logger';
import { getProblem, randomProblem, toPublicProblem } from '../problems';
import { rateLimit } from '../rate-limit';
import { redis } from '../redis';
import type { MatchOutcome, MatchResult, MatchView, PlayerView, Progress, SubmitResponse } from '../shared/types';
import { emitter } from './events';
import { keys, rooms } from './keys';
import { decideByProgress, MATCH_DURATION_MS } from './rules';
import { scriptedRedis } from './scripts';

/**
 * The match lifecycle. Two stores, two jobs:
 *  - Postgres is the source of truth: who won and the rating changes are
 *    decided there, inside a transaction.
 *  - Redis holds the fast, disposable live view (progress, status) and can be
 *    rebuilt from Postgres if it is ever lost.
 */

interface MatchState {
  id: string;
  problemId: string;
  players: [PlayerView, PlayerView];
  startedAt: number;
  endsAt: number;
  status: 'active' | 'finished';
  progress: Record<string, Progress>;
  result: MatchResult | null;
}

const LIVE_KEY_RETENTION_MS = 60 * 60 * 1000;
// Submissions that arrived just before the buzzer get this long to finish judging.
const SWEEP_GRACE_MS = 3_000;

const isPlayer = (state: MatchState, userId: string) => state.players.some((p) => p.id === userId);

// ---------------------------------------------------------------------------
// Loading and storing match state
// ---------------------------------------------------------------------------

async function loadLive(matchId: string): Promise<MatchState | null> {
  const hash = await redis().hgetall(keys.match(matchId));
  if (!hash.state) return null;
  const progress: Record<string, Progress> = {};
  for (const [field, value] of Object.entries(hash)) {
    if (field.startsWith('progress:')) progress[field.slice('progress:'.length)] = JSON.parse(value);
  }
  return {
    ...JSON.parse(hash.state),
    status: hash.status === 'finished' ? 'finished' : 'active',
    progress,
    result: hash.result ? JSON.parse(hash.result) : null,
  };
}

async function loadFromDb(matchId: string): Promise<MatchState | null> {
  const [m] = await db().select().from(matches).where(eq(matches.id, matchId));
  if (!m) return null;

  const people = await db()
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(inArray(users.id, [m.player1Id, m.player2Id]));
  const nameOf = (id: string) => people.find((p) => p.id === id)?.username ?? 'unknown';

  const attempts = await db()
    .select({ userId: submissions.userId, passed: submissions.passed, total: submissions.total })
    .from(submissions)
    .where(eq(submissions.matchId, matchId));
  const progress: Record<string, Progress> = {};
  for (const a of attempts) {
    if (!progress[a.userId] || a.passed > progress[a.userId].passed) progress[a.userId] = { passed: a.passed, total: a.total };
  }

  return {
    id: m.id,
    problemId: m.problemId,
    players: [
      { id: m.player1Id, username: nameOf(m.player1Id), rating: m.player1RatingBefore },
      { id: m.player2Id, username: nameOf(m.player2Id), rating: m.player2RatingBefore },
    ],
    startedAt: m.startedAt.getTime(),
    endsAt: m.endsAt.getTime(),
    status: m.status,
    progress,
    result:
      m.status === 'finished'
        ? {
            winnerId: m.winnerId,
            outcome: m.outcome ?? 'draw',
            ratingDeltas: { [m.player1Id]: m.player1RatingDelta ?? 0, [m.player2Id]: m.player2RatingDelta ?? 0 },
          }
        : null,
  };
}

async function writeLive(state: MatchState): Promise<void> {
  const key = keys.match(state.id);
  const { id, problemId, players, startedAt, endsAt } = state;
  const fields: Record<string, string> = {
    state: JSON.stringify({ id, problemId, players, startedAt, endsAt }),
    status: state.status,
  };
  for (const [userId, p] of Object.entries(state.progress)) fields[`progress:${userId}`] = JSON.stringify(p);
  if (state.result) fields.result = JSON.stringify(state.result);

  const tx = redis().multi().hset(key, fields).pexpireat(key, endsAt + LIVE_KEY_RETENTION_MS);
  if (state.status === 'active') tx.zadd(keys.activeMatches, endsAt, id);
  await tx.exec();
}

/** Live state from Redis, falling back to Postgres (and re-warming Redis) if it's gone. */
async function loadMatch(matchId: string): Promise<MatchState | null> {
  const live = await loadLive(matchId);
  if (live) return live;
  const stored = await loadFromDb(matchId);
  if (stored?.status === 'active') await writeLive(stored);
  return stored;
}

function toView(state: MatchState, viewerId: string): MatchView {
  const you = state.players.find((p) => p.id === viewerId)!;
  const opponent = state.players.find((p) => p.id !== viewerId)!;
  return {
    id: state.id,
    status: state.status,
    problem: toPublicProblem(getProblem(state.problemId)),
    you,
    opponent,
    startedAt: state.startedAt,
    endsAt: state.endsAt,
    serverNow: Date.now(),
    progress: { you: state.progress[you.id] ?? null, opponent: state.progress[opponent.id] ?? null },
    result: state.result,
  };
}

// ---------------------------------------------------------------------------
// Public operations
// ---------------------------------------------------------------------------

export async function createMatch(matchId: string, playerIds: [string, string]): Promise<void> {
  const rows = await db()
    .select({ id: users.id, username: users.username, rating: users.rating })
    .from(users)
    .where(inArray(users.id, playerIds));
  if (rows.length !== 2) throw new Error(`createMatch: players not found (${playerIds.join(', ')})`);
  const players = playerIds.map((id) => rows.find((r) => r.id === id)!) as [PlayerView, PlayerView];

  const problem = randomProblem();
  const startedAt = Date.now();
  const endsAt = startedAt + MATCH_DURATION_MS;

  await db()
    .insert(matches)
    .values({
      id: matchId,
      problemId: problem.id,
      player1Id: players[0].id,
      player2Id: players[1].id,
      player1RatingBefore: players[0].rating,
      player2RatingBefore: players[1].rating,
      startedAt: new Date(startedAt),
      endsAt: new Date(endsAt),
    });

  await writeLive({ id: matchId, problemId: problem.id, players, startedAt, endsAt, status: 'active', progress: {}, result: null });

  emitter().to(rooms.user(players[0].id)).to(rooms.user(players[1].id)).emit('match:found', { matchId });
  logger.info({ matchId, problemId: problem.id, players: playerIds }, 'match created');
}

/** Returns null if the match doesn't exist; throws 403 if the viewer isn't in it. */
export async function getMatchView(matchId: string, viewerId: string): Promise<MatchView | null> {
  const state = await loadMatch(matchId);
  if (!state) return null;
  if (!isPlayer(state, viewerId)) throw new HttpError(403, 'You are not a player in this match');
  return toView(state, viewerId);
}

/** Used by the socket server to authorize joining a match room. */
export async function isPlayerInMatch(matchId: string, userId: string): Promise<boolean> {
  const state = await loadMatch(matchId);
  return !!state && isPlayer(state, userId);
}

export async function submitSolution(
  matchId: string,
  userId: string,
  code: string,
  mode: 'run' | 'submit',
): Promise<SubmitResponse> {
  const state = await loadMatch(matchId);
  if (!state) throw new HttpError(404, 'Match not found');
  if (!isPlayer(state, userId)) throw new HttpError(403, 'You are not a player in this match');
  if (state.status !== 'active') throw new HttpError(409, 'This match is already over');
  if (Date.now() > state.endsAt) throw new HttpError(409, "Time's up");

  await rateLimit(`judge:${userId}`, 12, 60);

  const problem = getProblem(state.problemId);
  const cases: JudgeCase[] = problem.examples.map((t) => ({ ...t, hidden: false }));
  if (mode === 'submit') cases.push(...problem.hiddenTests.map((t) => ({ ...t, hidden: true })));

  const result = await judge(code, problem, cases);
  if (mode === 'run') return { mode, result, matchOver: false };

  const accepted = result.verdict === 'accepted';
  await db().insert(submissions).values({
    matchId,
    userId,
    code,
    passed: result.passed,
    total: result.total,
    accepted,
    durationMs: result.durationMs,
  });
  await recordProgress(matchId, userId, { passed: result.passed, total: result.total });

  if (!accepted) return { mode, result, matchOver: false };

  // Both players can be accepted at nearly the same moment; finalizeMatch lets
  // Postgres decide who was first, so `won` reflects the real outcome.
  const final = await finalizeMatch(matchId, 'solved', userId);
  return { mode, result, matchOver: true, won: final?.winnerId === userId };
}

async function recordProgress(matchId: string, userId: string, progress: Progress): Promise<void> {
  const key = keys.match(matchId);
  const field = `progress:${userId}`;
  const previous = await redis().hget(key, field);
  if (!previous || progress.passed > (JSON.parse(previous) as Progress).passed) {
    await redis().hset(key, field, JSON.stringify(progress));
  }
  emitter().to(rooms.match(matchId)).emit('match:progress', { userId, ...progress });
}

/**
 * Ends a match exactly once, however many callers race to do it (a winning
 * submission, the timeout sweeper and a forfeit timer can all fire together).
 *
 * The `UPDATE ... WHERE status = 'active'` is the referee: Postgres row locks
 * let exactly one transaction flip the status, and only that one applies the
 * rating changes. Everyone else gets the already-decided result back.
 */
export async function finalizeMatch(
  matchId: string,
  outcome: MatchOutcome,
  winnerId: string | null,
): Promise<MatchResult | null> {
  const committed = await db().transaction(async (tx) => {
    const [m] = await tx
      .update(matches)
      .set({ status: 'finished', outcome, winnerId, endedAt: new Date() })
      .where(and(eq(matches.id, matchId), eq(matches.status, 'active')))
      .returning();
    if (!m) return null;

    const score = winnerId === m.player1Id ? 1 : winnerId === m.player2Id ? 0 : 0.5;
    const [delta1, delta2] = ratingDeltas(m.player1RatingBefore, m.player2RatingBefore, score);
    await tx.update(matches).set({ player1RatingDelta: delta1, player2RatingDelta: delta2 }).where(eq(matches.id, matchId));

    const applyResult = (userId: string, delta: number, playerScore: number) =>
      tx
        .update(users)
        .set({
          rating: sql`${users.rating} + ${delta}`,
          wins: sql`${users.wins} + ${playerScore === 1 ? 1 : 0}`,
          losses: sql`${users.losses} + ${playerScore === 0 ? 1 : 0}`,
          draws: sql`${users.draws} + ${playerScore === 0.5 ? 1 : 0}`,
        })
        .where(eq(users.id, userId));
    await applyResult(m.player1Id, delta1, score);
    await applyResult(m.player2Id, delta2, 1 - score);

    const result: MatchResult = {
      winnerId,
      outcome,
      ratingDeltas: { [m.player1Id]: delta1, [m.player2Id]: delta2 },
    };
    return { result, playerIds: [m.player1Id, m.player2Id] as const };
  });

  if (committed) {
    logger.info({ matchId, outcome, winnerId }, 'match finished');
    await publishResult(matchId, committed.playerIds, committed.result);
    return committed.result;
  }

  // Someone else finished it first. Make sure Redis agrees with Postgres (this
  // also repairs things if a previous publish crashed halfway).
  const stored = await loadFromDb(matchId);
  if (stored?.result) {
    await publishResult(matchId, [stored.players[0].id, stored.players[1].id], stored.result);
    return stored.result;
  }
  await redis().zrem(keys.activeMatches, matchId);
  return null;
}

async function publishResult(matchId: string, playerIds: readonly [string, string], result: MatchResult) {
  const key = keys.match(matchId);
  await redis()
    .multi()
    .hset(key, 'status', 'finished', 'result', JSON.stringify(result))
    .expire(key, LIVE_KEY_RETENTION_MS / 1000)
    .zrem(keys.activeMatches, matchId)
    .exec();
  // Free both players to queue again (only if they're still pointed at this match).
  const scripted = scriptedRedis();
  await Promise.all(playerIds.map((id) => scripted.delIfEquals(keys.userMatch(id), matchId)));

  emitter()
    .to(rooms.match(matchId))
    .to(rooms.user(playerIds[0]))
    .to(rooms.user(playerIds[1]))
    .emit('match:over', { matchId, ...result });
}

export async function finalizeOnTimeout(matchId: string): Promise<MatchResult | null> {
  const [m] = await db()
    .select({ player1Id: matches.player1Id, player2Id: matches.player2Id })
    .from(matches)
    .where(eq(matches.id, matchId));
  if (!m) {
    await redis().zrem(keys.activeMatches, matchId);
    return null;
  }
  const attempts = await db()
    .select({ userId: submissions.userId, passed: submissions.passed, createdAt: submissions.createdAt })
    .from(submissions)
    .where(eq(submissions.matchId, matchId));
  const winnerId = decideByProgress(attempts, [m.player1Id, m.player2Id]);
  return finalizeMatch(matchId, winnerId ? 'timeout' : 'draw', winnerId);
}

export async function forfeitMatch(matchId: string, leaverId: string): Promise<MatchResult | null> {
  const state = await loadMatch(matchId);
  if (!state || state.status !== 'active' || !isPlayer(state, leaverId)) return null;
  const winner = state.players.find((p) => p.id !== leaverId)!;
  return finalizeMatch(matchId, 'forfeit', winner.id);
}

/** Ends every match whose clock has run out. Safe to run on many servers at once. */
export async function sweepExpiredMatches(now = Date.now()): Promise<number> {
  const due = await redis().zrangebyscore(keys.activeMatches, 0, now - SWEEP_GRACE_MS, 'LIMIT', 0, 50);
  for (const matchId of due) {
    try {
      await finalizeOnTimeout(matchId);
    } catch (err) {
      logger.error({ err, matchId }, 'failed to finalize expired match');
    }
  }
  return due.length;
}
