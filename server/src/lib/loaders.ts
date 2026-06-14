import DataLoader from 'dataloader';
import { query } from '../lib/db.js';

export interface UserRow {
  id: string;
  handle: string;
  email: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  created_at: Date;
}

export interface PostRow {
  id: string;
  author_id: string;
  content: string;
  media_urls: string[];
  repost_of_id: string | null;
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  created_at: Date;
}

/**
 * Per-request DataLoaders. Batch and cache lookups so resolving a feed
 * of N posts doesn't fire N author queries.
 */
export function createLoaders(viewerId: string | null) {
  const userById = new DataLoader<string, UserRow | null>(async (ids) => {
    const rows = await query<UserRow>(
      `SELECT * FROM users WHERE id = ANY($1::uuid[])`,
      [ids as string[]],
    );
    const map = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => map.get(id) ?? null);
  });

  const postById = new DataLoader<string, PostRow | null>(async (ids) => {
    const rows = await query<PostRow>(
      `SELECT * FROM posts WHERE id = ANY($1::uuid[])`,
      [ids as string[]],
    );
    const map = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => map.get(id) ?? null);
  });

  // Whether the viewer follows each given user id.
  const isFollowing = new DataLoader<string, boolean>(async (targetIds) => {
    if (!viewerId) return targetIds.map(() => false);
    const rows = await query<{ followee_id: string }>(
      `SELECT followee_id FROM follows
       WHERE follower_id = $1 AND followee_id = ANY($2::uuid[])`,
      [viewerId, targetIds as string[]],
    );
    const set = new Set(rows.map((r) => r.followee_id));
    return targetIds.map((id) => set.has(id));
  });

  // Whether the viewer liked each given post id.
  const isLiked = new DataLoader<string, boolean>(async (postIds) => {
    if (!viewerId) return postIds.map(() => false);
    const rows = await query<{ post_id: string }>(
      `SELECT post_id FROM likes
       WHERE user_id = $1 AND post_id = ANY($2::uuid[])`,
      [viewerId, postIds as string[]],
    );
    const set = new Set(rows.map((r) => r.post_id));
    return postIds.map((id) => set.has(id));
  });

  // Hashtags for each post id.
  const hashtagsByPost = new DataLoader<string, { id: string; tag: string }[]>(
    async (postIds) => {
      const rows = await query<{ post_id: string; id: string; tag: string }>(
        `SELECT ph.post_id, h.id, h.tag
         FROM post_hashtags ph
         JOIN hashtags h ON h.id = ph.hashtag_id
         WHERE ph.post_id = ANY($1::uuid[])`,
        [postIds as string[]],
      );
      const map = new Map<string, { id: string; tag: string }[]>();
      for (const r of rows) {
        const list = map.get(r.post_id) ?? [];
        list.push({ id: r.id, tag: r.tag });
        map.set(r.post_id, list);
      }
      return postIds.map((id) => map.get(id) ?? []);
    },
  );

  return { userById, postById, isFollowing, isLiked, hashtagsByPost };
}

export type Loaders = ReturnType<typeof createLoaders>;
