'use client';

import { useQuery, useSubscription, type DocumentNode } from '@apollo/client';
import { useCallback } from 'react';
import { PostCard } from './PostCard';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { FEED_UPDATED } from '@/lib/queries';
import type { Connection, Post } from '@/lib/types';

interface FeedProps {
  query: DocumentNode;
  // The root field name in the query result (e.g. "feed", "explore").
  field: string;
  // Extra variables beyond first/after (e.g. { tag }).
  variables?: Record<string, unknown>;
  // Subscribe to realtime feedUpdated and prepend (home feed only).
  realtime?: boolean;
}

const PAGE_SIZE = 20;

export function Feed({ query, field, variables = {}, realtime = false }: FeedProps) {
  const { data, loading, error, fetchMore, client } = useQuery<
    Record<string, Connection<Post>>
  >(query, {
    variables: { first: PAGE_SIZE, ...variables },
    notifyOnNetworkStatusChange: true,
  });

  const connection = data?.[field];
  const edges = connection?.edges ?? [];
  const pageInfo = connection?.pageInfo;

  const loadMore = useCallback(() => {
    if (!pageInfo?.hasNextPage) return;
    void fetchMore({
      variables: { first: PAGE_SIZE, after: pageInfo.endCursor, ...variables },
    });
  }, [fetchMore, pageInfo, variables]);

  const sentinelRef = useInfiniteScroll(loadMore, {
    hasMore: Boolean(pageInfo?.hasNextPage),
    loading,
  });

  // Realtime: prepend newly arriving posts into the Apollo cache.
  useSubscription<{ feedUpdated: Post }>(FEED_UPDATED, {
    skip: !realtime,
    onData: ({ data: sub }) => {
      const post = sub.data?.feedUpdated;
      if (!post) return;
      client.cache.updateQuery<Record<string, Connection<Post>>>(
        { query, variables: { first: PAGE_SIZE, ...variables } },
        (existing) => {
          if (!existing?.[field]) return existing ?? undefined;
          const exists = existing[field].edges.some((e) => e.node.id === post.id);
          if (exists) return existing;
          return {
            ...existing,
            [field]: {
              ...existing[field],
              edges: [{ node: post, cursor: post.id }, ...existing[field].edges],
            },
          };
        },
      );
    },
  });

  if (error) {
    return (
      <p className="p-6 text-center text-red-500">Failed to load feed: {error.message}</p>
    );
  }

  if (!loading && edges.length === 0) {
    return (
      <p className="p-10 text-center text-gray-500">
        Nothing here yet. Follow some people or create a post!
      </p>
    );
  }

  return (
    <div>
      {edges.map(({ node }) => (
        <PostCard key={node.id} post={node} />
      ))}
      <div ref={sentinelRef} />
      {loading && <p className="p-4 text-center text-gray-500">Loading…</p>}
      {!pageInfo?.hasNextPage && edges.length > 0 && (
        <p className="p-4 text-center text-gray-400 text-sm">You&apos;re all caught up.</p>
      )}
    </div>
  );
}
