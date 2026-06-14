import type { Context } from '../lib/context.js';
import type { PostRow, UserRow } from '../lib/loaders.js';
import { query } from '../lib/db.js';
import {
  buildConnection,
  clampLimit,
  decodeCursor,
  encodeCursor,
  type PageArgs,
} from '../lib/pagination.js';

// ─── User field resolvers ────────────────────────────────────
export const User = {
  displayName: (u: UserRow) => u.display_name,
  avatarUrl: (u: UserRow) => u.avatar_url,
  followersCount: (u: UserRow) => u.followers_count,
  followingCount: (u: UserRow) => u.following_count,
  postsCount: (u: UserRow) => u.posts_count,
  createdAt: (u: UserRow) => u.created_at,

  isFollowedByViewer: (u: UserRow, _: unknown, ctx: Context) =>
    ctx.loaders.isFollowing.load(u.id),

  posts: async (u: UserRow, args: PageArgs) => {
    const limit = clampLimit(args.first);
    const cursor = args.after ? decodeCursor(args.after) : null;
    const rows = await query<PostRow>(
      `SELECT * FROM posts
       WHERE author_id = $1
         AND ($2::timestamptz IS NULL OR created_at < $2)
       ORDER BY created_at DESC
       LIMIT $3`,
      [u.id, cursor ? cursor[0] : null, limit + 1],
    );
    return buildConnection(rows, limit, (p) => encodeCursor([p.created_at.toISOString()]));
  },

  followers: async (u: UserRow, args: PageArgs) => {
    const limit = clampLimit(args.first);
    const cursor = args.after ? decodeCursor(args.after) : null;
    const rows = await query<UserRow & { followed_at: Date }>(
      `SELECT u.*, f.created_at AS followed_at
       FROM follows f JOIN users u ON u.id = f.follower_id
       WHERE f.followee_id = $1
         AND ($2::timestamptz IS NULL OR f.created_at < $2)
       ORDER BY f.created_at DESC
       LIMIT $3`,
      [u.id, cursor ? cursor[0] : null, limit + 1],
    );
    return buildConnection(rows, limit, (r) => encodeCursor([r.followed_at.toISOString()]));
  },

  following: async (u: UserRow, args: PageArgs) => {
    const limit = clampLimit(args.first);
    const cursor = args.after ? decodeCursor(args.after) : null;
    const rows = await query<UserRow & { followed_at: Date }>(
      `SELECT u.*, f.created_at AS followed_at
       FROM follows f JOIN users u ON u.id = f.followee_id
       WHERE f.follower_id = $1
         AND ($2::timestamptz IS NULL OR f.created_at < $2)
       ORDER BY f.created_at DESC
       LIMIT $3`,
      [u.id, cursor ? cursor[0] : null, limit + 1],
    );
    return buildConnection(rows, limit, (r) => encodeCursor([r.followed_at.toISOString()]));
  },
};

// ─── Post field resolvers ────────────────────────────────────
export const Post = {
  mediaUrls: (p: PostRow) => p.media_urls ?? [],
  likesCount: (p: PostRow) => p.likes_count,
  commentsCount: (p: PostRow) => p.comments_count,
  repostsCount: (p: PostRow) => p.reposts_count,
  createdAt: (p: PostRow) => p.created_at,

  author: (p: PostRow, _: unknown, ctx: Context) => ctx.loaders.userById.load(p.author_id),

  isLikedByViewer: (p: PostRow, _: unknown, ctx: Context) => ctx.loaders.isLiked.load(p.id),

  hashtags: async (p: PostRow, _: unknown, ctx: Context) => {
    const tags = await ctx.loaders.hashtagsByPost.load(p.id);
    return tags.map((t) => ({ id: t.id, tag: t.tag }));
  },

  repostOf: (p: PostRow, _: unknown, ctx: Context) =>
    p.repost_of_id ? ctx.loaders.postById.load(p.repost_of_id) : null,

  comments: async (p: PostRow, args: PageArgs) => {
    const limit = clampLimit(args.first);
    const cursor = args.after ? decodeCursor(args.after) : null;
    const rows = await query(
      `SELECT * FROM comments
       WHERE post_id = $1
         AND ($2::timestamptz IS NULL OR created_at < $2)
       ORDER BY created_at DESC
       LIMIT $3`,
      [p.id, cursor ? cursor[0] : null, limit + 1],
    );
    return buildConnection(rows, limit, (c: any) =>
      encodeCursor([c.created_at.toISOString()]),
    );
  },
};

// ─── Comment field resolvers ─────────────────────────────────
export const Comment = {
  createdAt: (c: any) => c.created_at,
  author: (c: any, _: unknown, ctx: Context) => ctx.loaders.userById.load(c.author_id),
  post: (c: any, _: unknown, ctx: Context) => ctx.loaders.postById.load(c.post_id),
};

// ─── Hashtag field resolvers ─────────────────────────────────
export const Hashtag = {
  postCount: async (h: any) => {
    if (typeof h.post_count === 'number') return h.post_count;
    if (typeof h.postCount === 'number') return h.postCount;
    const rows = await query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM post_hashtags WHERE hashtag_id = $1`,
      [h.id],
    );
    return rows[0]?.count ?? 0;
  },
};

// ─── Notification field resolvers ────────────────────────────
export const Notification = {
  createdAt: (n: any) => n.created_at,
  actor: (n: any, _: unknown, ctx: Context) => ctx.loaders.userById.load(n.actor_id),
  post: (n: any, _: unknown, ctx: Context) =>
    n.post_id ? ctx.loaders.postById.load(n.post_id) : null,
};

// ─── KeyValue helper for presigned upload fields ─────────────
export const KeyValue = {
  key: (kv: { key: string }) => kv.key,
  value: (kv: { value: string }) => kv.value,
};
