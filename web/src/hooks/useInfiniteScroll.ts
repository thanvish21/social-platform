'use client';

import { useEffect, useRef } from 'react';

/**
 * Calls `onLoadMore` when the returned sentinel ref scrolls into view.
 * Attach the ref to an element at the bottom of the list.
 */
export function useInfiniteScroll(
  onLoadMore: () => void,
  options: { hasMore: boolean; loading: boolean },
) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { hasMore, loading } = options;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) onLoadMore();
      },
      { rootMargin: '400px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, loading]);

  return sentinelRef;
}
