import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Postgres holds everything that must survive restarts: accounts, ratings,
 * match results and every submission. Redis only holds short-lived state.
 */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: varchar('username', { length: 20 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    rating: integer('rating').notNull().default(1200),
    wins: integer('wins').notNull().default(0),
    losses: integer('losses').notNull().default(0),
    draws: integer('draws').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // "Alice" and "alice" are the same account.
    uniqueIndex('users_username_lower_idx').on(sql`lower(${t.username})`),
    index('users_rating_idx').on(t.rating),
  ],
);

export const matchStatus = pgEnum('match_status', ['active', 'finished']);
export const matchOutcome = pgEnum('match_outcome', ['solved', 'timeout', 'forfeit', 'draw']);

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey(),
    problemId: varchar('problem_id', { length: 64 }).notNull(),
    player1Id: uuid('player1_id').notNull().references(() => users.id),
    player2Id: uuid('player2_id').notNull().references(() => users.id),
    status: matchStatus('status').notNull().default('active'),
    outcome: matchOutcome('outcome'),
    winnerId: uuid('winner_id').references(() => users.id),
    player1RatingBefore: integer('player1_rating_before').notNull(),
    player2RatingBefore: integer('player2_rating_before').notNull(),
    player1RatingDelta: integer('player1_rating_delta'),
    player2RatingDelta: integer('player2_rating_delta'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [index('matches_player1_idx').on(t.player1Id), index('matches_player2_idx').on(t.player2Id)],
);

export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: uuid('match_id').notNull().references(() => matches.id),
    userId: uuid('user_id').notNull().references(() => users.id),
    code: text('code').notNull(),
    passed: integer('passed').notNull(),
    total: integer('total').notNull(),
    accepted: boolean('accepted').notNull(),
    durationMs: integer('duration_ms').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('submissions_match_idx').on(t.matchId)],
);

export type User = typeof users.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
