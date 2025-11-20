// src/lib/redis.ts
import Redis from 'ioredis';

// Prevent multiple instances in dev (hot reload)
declare global {
  var redis: Redis | undefined;
}

let redis: Redis;

if (process.env.NODE_ENV === 'production') {
  // In production: create new instance
  redis = new Redis(process.env.REDIS_URL!);
} else {
  // In development: reuse instance to avoid "max listeners" warnings
  if (!global.redis) {
    global.redis = new Redis(process.env.REDIS_URL!);
  }
  redis = global.redis;
}

// Optional: Log connection status
redis.on('connect', () => {
  console.log('Redis CONNECTED & READY');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

export function getRedis(): Redis {
  return redis;
}

// Graceful shutdown (optional but clean)
process.on('SIGTERM', async () => {
  await redis.quit();
  process.exit(0);
});

export default redis;