import Redis, { type RedisOptions } from 'ioredis';
import { env } from './env';
import { logger } from './logger';

/**
 * One shared connection per process. It lives on globalThis because the custom
 * server (server.ts) and Next's bundled route handlers load separate copies of
 * this module but run in the same process, and dev hot reloads re-run modules.
 */
const globalForRedis = globalThis as unknown as { __cfzRedis?: Redis };

export function createRedis(options: RedisOptions = {}): Redis {
  const client = new Redis(env().REDIS_URL, { maxRetriesPerRequest: 3, ...options });
  client.on('error', (err) => logger.error({ err }, 'redis connection error'));
  return client;
}

export function redis(): Redis {
  globalForRedis.__cfzRedis ??= createRedis();
  return globalForRedis.__cfzRedis;
}
