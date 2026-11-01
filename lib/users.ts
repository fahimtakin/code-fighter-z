import bcrypt from 'bcrypt';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from './db';
import { matches, users } from './db/schema';
import { HttpError } from './errors';
import { getProblem } from './problems';
import type { LeaderboardEntry, MatchHistoryEntry } from './shared/types';

const BCRYPT_ROUNDS = 12;
// Compared against when the username doesn't exist, so a failed login takes the
// same time either way and response timing can't reveal which usernames exist.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hash('timing-equalizer', BCRYPT_ROUNDS));

const usernameMatches = (username: string) => sql`lower(${users.username}) = lower(${username})`;

export async function createUser(username: string, password: string) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const [user] = await db()
      .insert(users)
      .values({ username, passwordHash })
      .returning({ id: users.id, username: users.username });
    return user;
  } catch (err) {
    // 23505 = unique_violation. Relying on the constraint (not a "check first"
    // query) means two simultaneous signups can't both claim the same name.
    const code = (err as { code?: string; cause?: { code?: string } }).cause?.code ?? (err as { code?: string }).code;
    if (code === '23505') throw new HttpError(409, 'That username is taken');
    throw err;
  }
}

export async function verifyCredentials(username: string, password: string) {
  const [user] = await db()
    .select({ id: users.id, username: users.username, passwordHash: users.passwordHash })
    .from(users)
    .where(usernameMatches(username));
  const valid = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));
  return user && valid ? { id: user.id, username: user.username } : null;
}

export async function getProfile(userId: string) {
  const [user] = await db()
    .select({
      id: users.id,
      username: users.username,
      rating: users.rating,
      wins: users.wins,
      losses: users.losses,
      draws: users.draws,
    })
    .from(users)
    .where(eq(users.id, userId));
  return user ?? null;
}

export async function getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  return db()
    .select({ username: users.username, rating: users.rating, wins: users.wins, losses: users.losses, draws: users.draws })
    .from(users)
    .orderBy(desc(users.rating), desc(users.wins))
    .limit(limit);
}

export async function getMatchHistory(userId: string, limit = 10): Promise<MatchHistoryEntry[]> {
  const p1 = alias(users, 'p1');
  const p2 = alias(users, 'p2');
  const rows = await db()
    .select({ match: matches, p1Name: p1.username, p2Name: p2.username })
    .from(matches)
    .innerJoin(p1, eq(p1.id, matches.player1Id))
    .innerJoin(p2, eq(p2.id, matches.player2Id))
    .where(and(or(eq(matches.player1Id, userId), eq(matches.player2Id, userId)), eq(matches.status, 'finished')))
    .orderBy(desc(matches.endedAt))
    .limit(limit);

  return rows.map(({ match, p1Name, p2Name }) => {
    const isP1 = match.player1Id === userId;
    return {
      id: match.id,
      problemTitle: getProblem(match.problemId).title,
      opponent: isP1 ? p2Name : p1Name,
      result: match.winnerId === null ? 'draw' : match.winnerId === userId ? 'win' : 'loss',
      outcome: match.outcome ?? 'draw',
      ratingDelta: (isP1 ? match.player1RatingDelta : match.player2RatingDelta) ?? 0,
      endedAt: (match.endedAt ?? match.startedAt).toISOString(),
    };
  });
}
