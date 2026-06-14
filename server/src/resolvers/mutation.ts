import { GraphQLError } from 'graphql';
import type { Context } from '../lib/context.js';
import type { PostRow, UserRow } from '../lib/loaders.js';
import { query, queryOne, transaction } from '../lib/db.js';
import { cacheDel, cacheDelPattern } from '../lib/redis.js';
import { pubsub, TOPICS } from '../lib/pubsub.js';
import { env } from '../lib/env.js';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeAllTokens,
} from '../lib/auth.js';
import { enforceRateLimit } from '../middleware/rateLimit.js';
import { presignUpload } from '../services/storage.js';
import {
  createNotification,
  linkHashtags,
} from '../services/notifications.js';

const MAX_POST_LENGTH = 500;

function requireAuth(ctx: Context): string {
  if (!ctx.userId) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return ctx.userId;
}

async function authPayload(user: UserRow) {
  const accessToken = signAccessToken({ sub: user.id, handle: user.handle });
  const refreshToken = await issueRefreshToken(user.id);
  return { accessToken, refreshToken, user };
}

/** Publish a newly created post to followers' feed subscriptions. */
async function fanOutToFeeds(authorId: string, post: PostRow): Promise<void> {
  const followers = await query<{ follower_id: string }>(
    `SELECT follower_id FROM follows WHERE followee_id = $1`,
    [authorId],
  );
  // Bust cached feeds + publish realtime events.
  await Promise.all(
    followers.map(async ({ follower_id }) => {
      await cacheDel(`feed:${follower_id}`);
      await pubsub.publish(TOPICS.feedUpdate(follower_id), { feedUpdated: post });
    }),
  );
  await cacheDel(`feed:${authorId}`);
}

export const Mutation = {
  // ─── Auth ─────────────────────────────────────────────────
  register: async (
    _: unknown,
    args: { handle: string; email: string; password: string; displayName: string },
  ) => {
    const handle = args.handle.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(handle)) {
      throw new GraphQLError('Handle must be 3-30 chars: a-z, 0-9, underscore.', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
    if (args.password.length < 8) {
      throw new GraphQLError('Password must be at least 8 characters.', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE handle = $1 OR email = $2`,
      [handle, args.email.toLowerCase()],
    );
    if (existing) {
      throw new GraphQLError('Handle or email already in use.', {
        extensions: { code: 'CONFLICT' },
      });
    }

    const passwordHash = await hashPassword(args.password);
    const user = await queryOne<UserRow>(
      `INSERT INTO users (handle, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [handle, args.email.toLowerCase(), passwordHash, args.displayName.trim()],
    );
    return authPayload(user!);
  },

  login: async (_: unknown, args: { email: string; password: string }) => {
    const user = await queryOne<UserRow & { password_hash: string }>(
      `SELECT * FROM users WHERE email = $1`,
      [args.email.toLowerCase()],
    );
    if (!user || !(await verifyPassword(args.password, user.password_hash))) {
      throw new GraphQLError('Invalid email or password.', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }
    return authPayload(user);
  },

  refresh: async (_: unknown, args: { refreshToken: string }) => {
    const result = await rotateRefreshToken(args.refreshToken);
    if (!result) {
      throw new GraphQLError('Invalid or expired refresh token.', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }
    const user = await queryOne<UserRow>(`SELECT * FROM users WHERE id = $1`, [
      result.userId,
    ]);
    const accessToken = signAccessToken({ sub: user!.id, handle: user!.handle });
    return { accessToken, refreshToken: result.refreshToken, user };
  },

  logout: async (_: unknown, __: unknown, ctx: Context) => {
    const userId = requireAuth(ctx);
    await revokeAllTokens(userId);
    return true;
  },

  // ─── Posts ────────────────────────────────────────────────
  createPost: async (
    _: unknown,
    args: { content: string; mediaUrls?: string[] },
    ctx: Context,
  ) => {
    const userId = requireAuth(ctx);
    const content = args.content.trim();
    if (!content && !(args.mediaUrls?.length)) {
      throw new GraphQLError('Post must have content or media.', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
    if (content.length > MAX_POST_LENGTH) {
      throw new GraphQLError(`Post exceeds ${MAX_POST_LENGTH} characters.`, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    await enforceRateLimit(userId, 'posts', env.rateLimit.postsPerHour);

    const post = await queryOne<PostRow>(
      `INSERT INTO posts (author_id, content, media_urls)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, content, args.mediaUrls ?? []],
    );
    await linkHashtags(post!.id, content);
    await fanOutToFeeds(userId, post!);
    return post;
  },

  deletePost: async (_: unknown, args: { id: string }, ctx: Context) => {
    const userId = requireAuth(ctx);
    const result = await query(
      `DELETE FROM posts WHERE id = $1 AND author_id = $2 RETURNING id`,
      [args.id, userId],
    );
    if (!result.length) {
      throw new GraphQLError('Post not found or not owned by you.', {
        extensions: { code: 'FORBIDDEN' },
      });
    }
    await cacheDelPattern('feed:*');
    return true;
  },

  repost: async (
    _: unknown,
    args: { postId: string; content?: string },
    ctx: Context,
  ) => {
    const userId = requireAuth(ctx);
    await enforceRateLimit(userId, 'posts', env.rateLimit.postsPerHour);

    const original = await queryOne<PostRow>(`SELECT * FROM posts WHERE id = $1`, [
      args.postId,
    ]);
    if (!original) {
      throw new GraphQLError('Original post not found.', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    const post = await queryOne<PostRow>(
      `INSERT INTO posts (author_id, content, repost_of_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, (args.content ?? '').trim(), args.postId],
    );

    await createNotification({
      recipientId: original.author_id,
      actorId: userId,
      type: 'REPOST',
      postId: args.postId,
    });
    await fanOutToFeeds(userId, post!);
    return post;
  },

  // ─── Likes ────────────────────────────────────────────────
  likePost: async (_: unknown, args: { postId: string }, ctx: Context) => {
    const userId = requireAuth(ctx);
    await enforceRateLimit(userId, 'likes', env.rateLimit.likesPerHour);

    const inserted = await query(
      `INSERT INTO likes (user_id, post_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING post_id`,
      [userId, args.postId],
    );

    const post = await queryOne<PostRow>(`SELECT * FROM posts WHERE id = $1`, [
      args.postId,
    ]);
    if (!post) {
      throw new GraphQLError('Post not found.', { extensions: { code: 'NOT_FOUND' } });
    }

    // Only notify on a genuinely new like.
    if (inserted.length) {
      await createNotification({
        recipientId: post.author_id,
        actorId: userId,
        type: 'LIKE',
        postId: post.id,
      });
    }
    ctx.loaders.isLiked.clear(args.postId);
    return post;
  },

  unlikePost: async (_: unknown, args: { postId: string }, ctx: Context) => {
    const userId = requireAuth(ctx);
    await query(`DELETE FROM likes WHERE user_id = $1 AND post_id = $2`, [
      userId,
      args.postId,
    ]);
    ctx.loaders.isLiked.clear(args.postId);
    return queryOne<PostRow>(`SELECT * FROM posts WHERE id = $1`, [args.postId]);
  },

  // ─── Comments ─────────────────────────────────────────────
  createComment: async (
    _: unknown,
    args: { postId: string; content: string },
    ctx: Context,
  ) => {
    const userId = requireAuth(ctx);
    const content = args.content.trim();
    if (!content) {
      throw new GraphQLError('Comment cannot be empty.', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const post = await queryOne<PostRow>(`SELECT * FROM posts WHERE id = $1`, [
      args.postId,
    ]);
    if (!post) {
      throw new GraphQLError('Post not found.', { extensions: { code: 'NOT_FOUND' } });
    }

    const comment = await queryOne(
      `INSERT INTO comments (post_id, author_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [args.postId, userId, content],
    );

    await createNotification({
      recipientId: post.author_id,
      actorId: userId,
      type: 'COMMENT',
      postId: post.id,
    });
    return comment;
  },

  deleteComment: async (_: unknown, args: { id: string }, ctx: Context) => {
    const userId = requireAuth(ctx);
    const result = await query(
      `DELETE FROM comments WHERE id = $1 AND author_id = $2 RETURNING id`,
      [args.id, userId],
    );
    return result.length > 0;
  },

  // ─── Follows ──────────────────────────────────────────────
  followUser: async (_: unknown, args: { userId: string }, ctx: Context) => {
    const followerId = requireAuth(ctx);
    if (followerId === args.userId) {
      throw new GraphQLError('You cannot follow yourself.', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const target = await queryOne<UserRow>(`SELECT * FROM users WHERE id = $1`, [
      args.userId,
    ]);
    if (!target) {
      throw new GraphQLError('User not found.', { extensions: { code: 'NOT_FOUND' } });
    }

    const inserted = await query(
      `INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING followee_id`,
      [followerId, args.userId],
    );
    if (inserted.length) {
      await createNotification({
        recipientId: args.userId,
        actorId: followerId,
        type: 'FOLLOW',
      });
      await cacheDel(`feed:${followerId}`); // their feed now includes this user
    }
    ctx.loaders.isFollowing.clear(args.userId);
    // Re-fetch for updated counts.
    return queryOne<UserRow>(`SELECT * FROM users WHERE id = $1`, [args.userId]);
  },

  unfollowUser: async (_: unknown, args: { userId: string }, ctx: Context) => {
    const followerId = requireAuth(ctx);
    await query(`DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2`, [
      followerId,
      args.userId,
    ]);
    ctx.loaders.isFollowing.clear(args.userId);
    await cacheDel(`feed:${followerId}`);
    return queryOne<UserRow>(`SELECT * FROM users WHERE id = $1`, [args.userId]);
  },

  // ─── Media ────────────────────────────────────────────────
  requestMediaUpload: async (
    _: unknown,
    args: { contentType: string },
    ctx: Context,
  ) => {
    const userId = requireAuth(ctx);
    const upload = await presignUpload(userId, args.contentType);
    return {
      url: upload.url,
      key: upload.key,
      publicUrl: upload.publicUrl,
      fields: Object.entries(upload.fields).map(([key, value]) => ({ key, value })),
    };
  },

  // ─── Notifications ────────────────────────────────────────
  markNotificationRead: async (_: unknown, args: { id: string }, ctx: Context) => {
    const userId = requireAuth(ctx);
    await query(`UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2`, [
      args.id,
      userId,
    ]);
    return true;
  },

  markAllNotificationsRead: async (_: unknown, __: unknown, ctx: Context) => {
    const userId = requireAuth(ctx);
    await query(`UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE`, [
      userId,
    ]);
    return true;
  },

  // ─── Profile ──────────────────────────────────────────────
  updateProfile: async (
    _: unknown,
    args: { displayName?: string; bio?: string; avatarUrl?: string },
    ctx: Context,
  ) => {
    const userId = requireAuth(ctx);
    const user = await queryOne<UserRow>(
      `UPDATE users SET
         display_name = COALESCE($2, display_name),
         bio = COALESCE($3, bio),
         avatar_url = COALESCE($4, avatar_url),
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [userId, args.displayName ?? null, args.bio ?? null, args.avatarUrl ?? null],
    );
    ctx.loaders.userById.clear(userId);
    return user;
  },
};
