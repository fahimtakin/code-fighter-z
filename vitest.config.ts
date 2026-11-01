import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: process.env.RUN_INTEGRATION ? [] : ['tests/integration/**'],
    env: { JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long' },
    testTimeout: 30_000,
  },
});
