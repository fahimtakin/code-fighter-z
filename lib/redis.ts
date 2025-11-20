// src/lib/redis.ts — SERVER ONLY
import Redis from 'ioredis';

let redis: Redis;

if (!global.redis) {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  global.redis = redis;
} else {
  redis = global.redis;
}

export function getRedis() {
  return redis;
}