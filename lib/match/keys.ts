/** Every Redis key the match system uses, in one place. */
export const keys = {
  /** ZSET userId -> rating: players waiting for an opponent. */
  queue: 'mm:queue',
  /** Short-TTL heartbeat: a waiting player whose tab closed simply expires. */
  queueAlivePrefix: 'mm:alive:',
  queueAlive: (userId: string) => `mm:alive:${userId}`,
  /** When the player started searching; widens their rating window over time. */
  queueSincePrefix: 'mm:since:',
  queueSince: (userId: string) => `mm:since:${userId}`,
  /** The player's current match id; also stops them queueing twice. */
  userMatchPrefix: 'user-match:',
  userMatch: (userId: string) => `user-match:${userId}`,
  /** HASH with the live state of a match. */
  match: (matchId: string) => `match:${matchId}`,
  /** ZSET matchId -> endsAt (ms): what the timeout sweeper scans. */
  activeMatches: 'matches:active',
};

export const rooms = {
  user: (userId: string) => `user:${userId}`,
  match: (matchId: string) => `match:${matchId}`,
};
