/**
 * Centralized, validated environment configuration.
 * Fails fast at startup if required secrets are missing.
 */

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function intEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: intEnv('PORT', 4000),
  isProd: process.env.NODE_ENV === 'production',

  databaseUrl: required('DATABASE_URL'),
  redisUrl: optional('REDIS_URL', 'redis://localhost:6379'),

  jwt: {
    accessSecret: optional('JWT_ACCESS_SECRET', 'dev_access_secret_change_me'),
    refreshSecret: optional('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_me'),
    accessTtl: intEnv('JWT_ACCESS_TTL', 900), // 15 min
    refreshTtl: intEnv('JWT_REFRESH_TTL', 604800), // 7 days
  },

  s3: {
    endpoint: optional('S3_ENDPOINT', 'http://localhost:9000'),
    region: optional('S3_REGION', 'us-east-1'),
    accessKey: optional('S3_ACCESS_KEY', 'minioadmin'),
    secretKey: optional('S3_SECRET_KEY', 'minioadmin'),
    bucket: optional('S3_BUCKET', 'media'),
    publicUrl: optional('S3_PUBLIC_URL', 'http://localhost:9000/media'),
    forcePathStyle: optional('S3_FORCE_PATH_STYLE', 'true') === 'true',
  },

  rateLimit: {
    postsPerHour: intEnv('RATE_LIMIT_POSTS_PER_HOUR', 100),
    likesPerHour: intEnv('RATE_LIMIT_LIKES_PER_HOUR', 1000),
  },
} as const;
