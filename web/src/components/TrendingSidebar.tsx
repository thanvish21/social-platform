'use client';

import Link from 'next/link';
import { useQuery } from '@apollo/client';
import { TRENDING_HASHTAGS, SUGGESTED_USERS } from '@/lib/queries';
import type { Hashtag, User } from '@/lib/types';
import { UserCard } from './UserCard';

export function TrendingSidebar() {
  const { data: tags } = useQuery<{ trendingHashtags: Hashtag[] }>(TRENDING_HASHTAGS, {
    variables: { limit: 8 },
  });
  const { data: users } = useQuery<{ suggestedUsers: User[] }>(SUGGESTED_USERS, {
    variables: { limit: 5 },
  });

  return (
    <aside className="hidden w-80 shrink-0 space-y-4 p-4 lg:block">
      <section className="rounded-2xl bg-gray-100 p-4 dark:bg-gray-900">
        <h2 className="mb-3 text-lg font-bold">Trending</h2>
        {(tags?.trendingHashtags ?? []).map((h) => (
          <Link
            key={h.id}
            href={`/explore?tag=${h.tag}`}
            className="block rounded-lg px-2 py-2 hover:bg-gray-200 dark:hover:bg-gray-800"
          >
            <p className="font-semibold">#{h.tag}</p>
            <p className="text-sm text-gray-500">{h.postCount} posts</p>
          </Link>
        ))}
        {!tags?.trendingHashtags?.length && (
          <p className="text-sm text-gray-500">No trends yet.</p>
        )}
      </section>

      <section className="rounded-2xl bg-gray-100 p-4 dark:bg-gray-900">
        <h2 className="mb-2 text-lg font-bold">Who to follow</h2>
        {(users?.suggestedUsers ?? []).map((u) => (
          <UserCard key={u.id} user={u} />
        ))}
      </section>
    </aside>
  );
}
