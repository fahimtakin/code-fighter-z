import Redis from 'ioredis';

// Extend the global type definition to cache the connection string during local development hot reloads
declare global {
  var redisInstance: Redis | undefined;
}

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

export function getRedis(): Redis {
  // Production Strategy: Spawn fresh instances with explicit, bounded recovery parameters
  if (process.env.NODE_ENV === 'production') {
    return new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3, // Prevent hanging requests if the connection is temporarily dropped
      connectTimeout: 5000,    // Force timeout if the connection takes longer than 5 seconds
      retryStrategy(times) {
        // Linear backoff strategy up to a strict 2-second delay cap
        const delay = Math.min(times * 50, 2000);
        console.warn(`[Redis] Connection fallen. Reattempting in ${delay}ms... (Attempt ${times})`);
        return delay;
      }
    });
  }

  // Development Strategy: Cache the instance globally to prevent the "max listeners" socket leak error
  if (!global.redisInstance) {
    global.redisInstance = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null, // Keep flexible for dev debugging
    });
    
    global.redisInstance.on('connect', () => {
      console.log('[Redis] Pool channel connected and ready.');
    });

    global.redisInstance.on('error', (err) => {
      console.error('[Redis] Fatal infrastructure connection error:', err);
    });
  }

  return global.redisInstance;
}

export default getRedis();
