import { GraphQLError } from 'graphql';
import type { Context } from '../lib/context.js';
import type { PostRow, UserRow } from '../lib/loaders.js';
import { query, queryOne } from '../lib/db.js';
import { cacheGet, cacheSet } from '../lib/redis.js';
import {
  buildConnection,
  clampLimit,
  decodeCursor,
  encodeCursor,
  type PageArgs,
} from '../lib/pagination.js';

function requireAuth(ctx: Context): string {
  if (!ctx.userId) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return ctx.userId;
}

const FEED_CACHE_TTL = 30; // seconds
const TRENDING_CACHE_TTL = 60;

export const Query = {
  me: (_: unknown, __: unknown, ctx: Context) =>
    ctx.userId ? ctx.loaders.userById.load(ctx.userId) : null,

  user: (_: unknown, args: { handle: string }) =>
    queryOne<UserRow>(`SELECT * FROM users WHERE handle = $1`, [args.handle]),

  post: (_: unknown, args: { id: string }, ctx: Context) =>
    ctx.loaders.postById.load(args.id),

  // ─── Personalized home feed ──────────────────────────────
  feed: async (_: unknown, args: PageArgs, ctx: Context) => {
    const userId = requireAuth(ctx);
    const limit = clampLimit(args.first);
    const cursor = args.after ? decodeCursor(args.after) : null;

    // Cache only the first page (hot path for infinite scroll start).
    const cacheKey = `feed:${userId}`;
    if (!cursor) {
      const cached = await cacheGet<PostRow[]>(cacheKey);
      if (cached) {
        return buildConnection(cached, limit, (p) =>
          encodeCursor([new Date(p.created_at).toISOString()]),
        );
      }
    }

    const rows = await query<PostRow>(
      `SELECT p.* FROM posts p
       WHERE (
         p.author_id = $1
         OR p.author_id IN (SELECT followee_id FROM follows WHERE follower_id = $1)
       )
       AND ($2::timestamptz IS NULL OR p.created_at < $2)
       ORDER BY p.created_at DESC
       LIMIT $3`,
      [userId, cursor ? cursor[0] : null, limit + 1],
    );

    if (!cursor) await cacheSet(cacheKey, rows, FEED_CACHE_TTL);

    return buildConnection(rows, limit, (p) =>
      encodeCursor([new Date(p.created_at).toISOString()]),
    );
  },

  // ─── Global explore timeline ─────────────────────────────
  explore: async (_: unknown, args: PageArgs) => {
    const limit = clampLimit(args.first);
    const cursor = args.after ? decodeCursor(args.after) : null;
    const rows = await query<PostRow>(
      `SELECT * FROM posts
       WHERE repost_of_id IS NULL
         AND ($1::timestamptz IS NULL OR created_at < $1)
       ORDER BY created_at DESC
       LIMIT $2`,
      [cursor ? cursor[0] : null, limit + 1],
    );
    return buildConnection(rows, limit, (p) =>
      encodeCursor([new Date(p.created_at).toISOString()]),
    );
  },

  postsByHashtag: async (_: unknown, args: { tag: string } & PageArgs) => {
    const limit = clampLimit(args.first);
    const cursor = args.after ? decodeCursor(args.after) : null;
    const rows = await query<PostRow>(
      `SELECT p.* FROM posts p
       JOIN post_hashtags ph ON ph.post_id = p.id
       JOIN hashtags h ON h.id = ph.hashtag_id
       WHERE h.tag = $1
         AND ($2::timestamptz IS NULL OR p.created_at < $2)
       ORDER BY p.created_at DESC
       LIMIT $3`,
      [args.tag.toLowerCase(), cursor ? cursor[0] : null, limit + 1],
    );
    return buildConnection(rows, limit, (p) =>
      encodeCursor([new Date(p.created_at).toISOString()]),
    );
  },

  trendingHashtags: async (_: unknown, args: { limit?: number }) => {
    const limit = Math.min(args.limit ?? 10, 50);
    const cacheKey = `trending:${limit}`;
    const cached = await cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const rows = await query(
      `SELECT hashtag_id AS id, tag, post_count AS "postCount"
       FROM trending_hashtags
       ORDER BY score DESC
       LIMIT $1`,
      [limit],
    );
    await cacheSet(cacheKey, rows, TRENDING_CACHE_TTL);
    return rows;
  },

  // Suggested users: most-followed users the viewer doesn't yet follow.
  suggestedUsers: async (_: unknown, args: { limit?: number }, ctx: Context) => {
    const limit = Math.min(args.limit ?? 5, 20);
    return query<UserRow>(
      `SELECT * FROM users u
       WHERE ($1::uuid IS NULL OR (
         u.id <> $1
         AND u.id NOT IN (SELECT followee_id FROM follows WHERE follower_id = $1)
       ))
       ORDER BY followers_count DESC, created_at DESC
       LIMIT $2`,
      [ctx.userId, limit],
    );
  },

  // ─── Full-text search (tsvector) ─────────────────────────
  search: async (_: unknown, args: { q: string }) => {
    const q = args.q.trim();
    if (!q) return { posts: [], users: [] };

    const [posts, users] = await Promise.all([
      query<PostRow>(
        `SELECT *, ts_rank(search_vector, websearch_to_tsquery('english', $1)) AS rank
         FROM posts
         WHERE search_vector @@ websearch_to_tsquery('english', $1)
         ORDER BY rank DESC, created_at DESC
         LIMIT 20`,
        [q],
      ),
      query<UserRow>(
        `SELECT *, ts_rank(search_vector, websearch_to_tsquery('english', $1)) AS rank
         FROM users
         WHERE search_vector @@ websearch_to_tsquery('english', $1)
            OR handle ILIKE '%' || $2 || '%'
         ORDER BY rank DESC NULLS LAST, followers_count DESC
         LIMIT 20`,
        [q, q],
      ),
    ]);
    return { posts, users };
  },

  // ─── Notifications ───────────────────────────────────────
  notifications: async (_: unknown, args: PageArgs, ctx: Context) => {
    const userId = requireAuth(ctx);
    const limit = clampLimit(args.first);
    const cursor = args.after ? decodeCursor(args.after) : null;
    const rows = await query(
      `SELECT * FROM notifications
       WHERE user_id = $1
         AND ($2::timestamptz IS NULL OR created_at < $2)
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, cursor ? cursor[0] : null, limit + 1],
    );
    return buildConnection(rows, limit, (n: any) =>
      encodeCursor([new Date(n.created_at).toISOString()]),
    );
  },

  unreadNotificationCount: async (_: unknown, __: unknown, ctx: Context) => {
    const userId = requireAuth(ctx);
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read = FALSE`,
      [userId],
    );
    return row?.count ?? 0;
  },
};
