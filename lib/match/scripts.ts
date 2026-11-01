import type Redis from 'ioredis';
import { redis } from '../redis';

/**
 * Lua scripts run atomically inside Redis: no other command can interleave,
 * which is what makes "pick an opponent and remove them from the queue" safe
 * when many players hit the queue at the same time.
 */

// KEYS[1] = queue ZSET
// ARGV = me, rating, window, newMatchId, alivePrefix, userMatchPrefix, userMatchTtl, sincePrefix
// Returns {'matched', existingMatchId} | {'paired', opponentId} | {'waiting'}
const MATCHMAKE = `
local queue = KEYS[1]
local me, rating, window, matchId = ARGV[1], tonumber(ARGV[2]), tonumber(ARGV[3]), ARGV[4]
local alivePrefix, matchPrefix, ttl, sincePrefix = ARGV[5], ARGV[6], tonumber(ARGV[7]), ARGV[8]

local existing = redis.call('GET', matchPrefix .. me)
if existing then return {'matched', existing} end

redis.call('ZREM', queue, me)
local candidates = redis.call('ZRANGEBYSCORE', queue, rating - window, rating + window, 'WITHSCORES')
local best, bestDiff
for i = 1, #candidates, 2 do
  local id = candidates[i]
  if redis.call('EXISTS', alivePrefix .. id) == 1 then
    local diff = math.abs(tonumber(candidates[i + 1]) - rating)
    if not best or diff < bestDiff then best, bestDiff = id, diff end
  else
    -- Their heartbeat expired (tab closed): clean them out of the queue.
    redis.call('ZREM', queue, id)
  end
end

if best then
  redis.call('ZREM', queue, best)
  redis.call('SET', matchPrefix .. me, matchId, 'EX', ttl)
  redis.call('SET', matchPrefix .. best, matchId, 'EX', ttl)
  redis.call('DEL', sincePrefix .. me, sincePrefix .. best, alivePrefix .. me, alivePrefix .. best)
  return {'paired', best}
end

redis.call('ZADD', queue, rating, me)
return {'waiting'}
`;

// Deletes KEYS[1] only if it still holds ARGV[1], so a late cleanup for an old
// match can't wipe the pointer to a player's new match.
const DEL_IF_EQUALS = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;

export type MatchmakeReply = ['matched', string] | ['paired', string] | ['waiting'];

export interface ScriptedRedis extends Redis {
  matchmake(queueKey: string, ...args: Array<string | number>): Promise<MatchmakeReply>;
  delIfEquals(key: string, value: string): Promise<number>;
}

export function scriptedRedis(): ScriptedRedis {
  const client = redis() as ScriptedRedis;
  // defineCommand uses EVALSHA under the hood, so the script body is only sent once.
  if (typeof client.matchmake !== 'function') {
    client.defineCommand('matchmake', { numberOfKeys: 1, lua: MATCHMAKE });
    client.defineCommand('delIfEquals', { numberOfKeys: 1, lua: DEL_IF_EQUALS });
  }
  return client;
}
