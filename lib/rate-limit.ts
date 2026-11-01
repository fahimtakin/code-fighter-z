import { HttpError } from './errors';
import { redis } from './redis';

/**
 * Fixed-window rate limiter backed by Redis, so the limit holds across every
 * server instance. Throws a 429 with Retry-After when the budget is spent.
 */
export async function rateLimit(name: string, limit: number, windowSeconds: number): Promise<void> {
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `rl:${name}:${window}`;
  const results = await redis().multi().incr(key).expire(key, windowSeconds).exec();
  const count = Number(results?.[0]?.[1] ?? 0);
  if (count > limit) {
    const retryAfter = (window + 1) * windowSeconds - Math.floor(Date.now() / 1000);
    throw new HttpError(429, 'Too many requests, slow down a little', { 'Retry-After': String(retryAfter) });
  }
}
