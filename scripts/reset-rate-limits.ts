/**
 * Local development helper: clears every rate-limit counter. While testing,
 * all your browsers and test runs share one IP (127.0.0.1), so you can hit the
 * per-IP limits (like 10 sign-ups an hour) much faster than real users do.
 *   npm run ratelimit:reset
 */
import nextEnv from '@next/env';
import { env } from '../lib/env';
import { RATE_LIMIT_PREFIX } from '../lib/rate-limit';
import { redis } from '../lib/redis';

nextEnv.loadEnvConfig(process.cwd());

if (env().NODE_ENV === 'production') {
  console.error('Refusing to reset rate limits with NODE_ENV=production.');
  process.exit(1);
}

let removed = 0;
// SCAN walks the keyspace in small batches; KEYS would block Redis on a big dataset.
for await (const batch of redis().scanStream({ match: `${RATE_LIMIT_PREFIX}*`, count: 500 })) {
  if ((batch as string[]).length) removed += await redis().del(...(batch as string[]));
}
console.log(`Cleared ${removed} rate-limit counter${removed === 1 ? '' : 's'}.`);
await redis().quit();
