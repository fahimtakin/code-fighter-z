import pino from 'pino';

/** Structured JSON logs: one line per event, easy to ship to any log platform. */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'code-fighter-z' },
});
