import nextEnv from '@next/env';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from '../lib/db';
import { logger } from '../lib/logger';

nextEnv.loadEnvConfig(process.cwd());

await migrate(db(), { migrationsFolder: './drizzle' });
logger.info('database migrations applied');
await pool().end();
