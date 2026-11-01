import { z } from 'zod';

/**
 * Every environment variable the app reads, validated in one place.
 * A missing or weak JWT_SECRET is a startup error, never a silent fallback.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  REDIS_URL: z.string().default('redis://localhost:6380'),
  DATABASE_URL: z.string().default('postgres://codefighter:codefighter@localhost:5433/codefighter'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  // Only behind a reverse proxy you control: trust its X-Forwarded-For for client IPs.
  TRUST_PROXY: z.stringbool().default(false),
  // Comma-separated extra origins allowed to open a WebSocket (same-origin is always allowed).
  ALLOWED_ORIGINS: z
    .string()
    .default('')
    .transform((value) => value.split(',').map((s) => s.trim()).filter(Boolean)),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Parsed lazily so `next build` and unit tests don't need a full environment. */
export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  cached = parsed.data;
  return cached;
}
