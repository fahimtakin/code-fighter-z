import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../env';
import { logger } from '../logger';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

// Same reasoning as lib/redis.ts: one pool per process, shared by every module copy.
const globalForDb = globalThis as unknown as { __cfzPool?: Pool; __cfzDb?: Database };

export function pool(): Pool {
  if (!globalForDb.__cfzPool) {
    globalForDb.__cfzPool = new Pool({ connectionString: env().DATABASE_URL, max: 10 });
    globalForDb.__cfzPool.on('error', (err) => logger.error({ err }, 'postgres pool error'));
  }
  return globalForDb.__cfzPool;
}

export function db(): Database {
  globalForDb.__cfzDb ??= drizzle(pool(), { schema });
  return globalForDb.__cfzDb;
}

export { schema };
