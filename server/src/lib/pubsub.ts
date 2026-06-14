import { RedisPubSub } from 'graphql-redis-subscriptions';
import { redisPub, redisSub } from './redis.js';

/**
 * Redis-backed PubSub so subscriptions work across horizontally
 * scaled server instances (not just in-process).
 */
export const pubsub = new RedisPubSub({
  publisher: redisPub as any,
  subscriber: redisSub as any,
});

export const TOPICS = {
  // Per-user feed updates: a new post from someone they follow.
  feedUpdate: (userId: string) => `FEED_UPDATE:${userId}`,
  // Per-user notification stream.
  notification: (userId: string) => `NOTIFICATION:${userId}`,
} as const;
