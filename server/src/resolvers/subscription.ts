import { GraphQLError } from 'graphql';
import { withFilter } from 'graphql-subscriptions';
import type { Context } from '../lib/context.js';
import { pubsub, TOPICS } from '../lib/pubsub.js';

function requireAuth(ctx: Context): string {
  if (!ctx.userId) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return ctx.userId;
}

export const Subscription = {
  // Realtime feed: emits posts arriving for the authenticated viewer.
  feedUpdated: {
    subscribe: (_: unknown, __: unknown, ctx: Context) => {
      const userId = requireAuth(ctx);
      return pubsub.asyncIterator(TOPICS.feedUpdate(userId));
    },
  },

  // Realtime notifications for the authenticated viewer.
  notificationReceived: {
    subscribe: (_: unknown, __: unknown, ctx: Context) => {
      const userId = requireAuth(ctx);
      return pubsub.asyncIterator(TOPICS.notification(userId));
    },
  },
};

// `withFilter` retained for future fan-in topics; exported to avoid unused import churn.
export { withFilter };
