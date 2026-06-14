import Redis from 'ioredis';
import { env } from './env.js';

/** Primary Redis client (caching, rate limiting, session store). */
export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: false,
});

redis.on('error', (err) => console.error('[redis] error', err));

// Separate connections for pub/sub (a subscribed connection cannot issue
// normal commands, so the GraphQL PubSub needs its own pair).
export const redisPub = new Redis(env.redisUrl, { maxRetriesPerRequest: null });
export const redisSub = new Redis(env.redisUrl, { maxRetriesPerRequest: null });

// ─── Cache helpers ───────────────────────────────────────────
export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length) await redis.del(...keys);
}

/** Invalidate every key matching a glob pattern (used for feed busting). */
export async function cacheDelPattern(pattern: string): Promise<void> {
  const stream = redis.scanStream({ match: pattern, count: 100 });
  const pipeline = redis.pipeline();
  for await (const keys of stream) {
    for (const key of keys as string[]) pipeline.del(key);
  }
  await pipeline.exec();
}
