import { query, queryOne } from '../lib/db.js';
import { pubsub, TOPICS } from '../lib/pubsub.js';
import { extractHashtags } from '../lib/text.js';

export { extractHashtags };

export type NotificationType = 'LIKE' | 'COMMENT' | 'FOLLOW' | 'REPOST' | 'MENTION';

interface NotificationRow {
  id: string;
  user_id: string;
  actor_id: string;
  type: NotificationType;
  post_id: string | null;
  read: boolean;
  created_at: Date;
}

/**
 * Create a notification and publish it to the recipient's stream.
 * No-op when the actor is the recipient (don't notify yourself).
 */
export async function createNotification(params: {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string | null;
}): Promise<void> {
  const { recipientId, actorId, type, postId = null } = params;
  if (recipientId === actorId) return;

  const row = await queryOne<NotificationRow>(
    `INSERT INTO notifications (user_id, actor_id, type, post_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [recipientId, actorId, type, postId],
  );

  if (row) {
    await pubsub.publish(TOPICS.notification(recipientId), {
      notificationReceived: row,
    });
  }
}

/** Extract #hashtags from text — re-exported from lib/text for backwards compat. */

/** Upsert hashtags and link them to a post. */
export async function linkHashtags(postId: string, content: string): Promise<void> {
  const tags = extractHashtags(content);
  if (!tags.length) return;

  for (const tag of tags) {
    const hashtag = await queryOne<{ id: string }>(
      `INSERT INTO hashtags (tag) VALUES ($1)
       ON CONFLICT (tag) DO UPDATE SET tag = EXCLUDED.tag
       RETURNING id`,
      [tag],
    );
    if (hashtag) {
      await query(
        `INSERT INTO post_hashtags (post_id, hashtag_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [postId, hashtag.id],
      );
    }
  }
}
