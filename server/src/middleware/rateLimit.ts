import { redis } from '../lib/redis.js';
import { GraphQLError } from 'graphql';

/**
 * Sliding-window-ish rate limiter using a fixed hourly bucket in Redis.
 * Cheap and good enough for per-user action throttling.
 *
 * Throws a GraphQLError with code RATE_LIMITED when the cap is exceeded.
 */
export async function enforceRateLimit(
  userId: string,
  action: string,
  maxPerHour: number,
): Promise<void> {
  const hourBucket = Math.floor(Date.now() / 3_600_000);
  const key = `ratelimit:${action}:${userId}:${hourBucket}`;

  const count = await redis.incr(key);
  if (count === 1) {
    // First hit in this bucket — expire slightly over an hour.
    await redis.expire(key, 3700);
  }

  if (count > maxPerHour) {
    throw new GraphQLError(
      `Rate limit exceeded: max ${maxPerHour} ${action} per hour.`,
      { extensions: { code: 'RATE_LIMITED', action, maxPerHour } },
    );
  }
}
