import { HttpError } from './errors';
import { redis } from './redis';

export const RATE_LIMIT_PREFIX = 'rl:';

function describeWait(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/**
 * Fixed-window rate limiter backed by Redis, so the limit holds across every
 * server instance. Throws a 429 with Retry-After when the budget is spent.
 *
 * @param what shown to the user, e.g. "sign-up attempts" -> "Too many sign-up attempts. Try again in 12 minutes."
 */
export async function rateLimit(name: string, limit: number, windowSeconds: number, what = 'requests'): Promise<void> {
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `${RATE_LIMIT_PREFIX}${name}:${window}`;
  const results = await redis().multi().incr(key).expire(key, windowSeconds).exec();
  const count = Number(results?.[0]?.[1] ?? 0);
  if (count > limit) {
    const retryAfter = Math.max(1, (window + 1) * windowSeconds - Math.floor(Date.now() / 1000));
    throw new HttpError(429, `Too many ${what}. Try again in ${describeWait(retryAfter)}.`, {
      'Retry-After': String(retryAfter),
    });
  }
}
