import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { HttpError } from '../errors';
import { logger } from '../logger';
import { redis } from '../redis';
import type { QueueStatus } from '../shared/types';
import { keys } from './keys';
import { MATCH_DURATION_MS, ratingWindow } from './rules';
import { scriptedRedis } from './scripts';
import { createMatch } from './service';

/** The client calls joinQueue every few seconds while searching; each call is a heartbeat. */
export const HEARTBEAT_TTL_SECONDS = 10;
const SEARCH_EXPIRY_SECONDS = 10 * 60;

export async function joinQueue(userId: string): Promise<QueueStatus> {
  const [user] = await db().select({ rating: users.rating }).from(users).where(eq(users.id, userId));
  if (!user) throw new HttpError(401, 'Account not found, please sign in again');

  const now = Date.now();
  await redis()
    .multi()
    .set(keys.queueAlive(userId), '1', 'EX', HEARTBEAT_TTL_SECONDS)
    .set(keys.queueSince(userId), String(now), 'EX', SEARCH_EXPIRY_SECONDS, 'NX')
    .exec();
  const since = Number(await redis().get(keys.queueSince(userId))) || now;
  const window = ratingWindow(now - since);

  const matchId = randomUUID();
  const reply = await scriptedRedis().matchmake(
    keys.queue,
    userId,
    user.rating,
    window,
    matchId,
    keys.queueAlivePrefix,
    keys.userMatchPrefix,
    Math.ceil(MATCH_DURATION_MS / 1000) + 120,
    keys.queueSincePrefix,
  );

  if (reply[0] === 'matched') return { status: 'matched', matchId: reply[1] };
  if (reply[0] === 'waiting') {
    return { status: 'waiting', waitedSeconds: Math.floor((now - since) / 1000), ratingWindow: window };
  }

  const opponentId = reply[1];
  try {
    await createMatch(matchId, [userId, opponentId]);
  } catch (err) {
    // Undo the pairing so neither player is stuck pointing at a match that doesn't exist.
    await redis().del(keys.userMatch(userId), keys.userMatch(opponentId));
    logger.error({ err, matchId, userId, opponentId }, 'failed to create match');
    throw err;
  }
  return { status: 'matched', matchId };
}

/** The match the player is currently in, if any (lets the dashboard offer "rejoin"). */
export async function getActiveMatchId(userId: string): Promise<string | null> {
  return redis().get(keys.userMatch(userId));
}

export async function leaveQueue(userId: string): Promise<void> {
  await redis()
    .multi()
    .zrem(keys.queue, userId)
    .del(keys.queueAlive(userId), keys.queueSince(userId))
    .exec();
}
