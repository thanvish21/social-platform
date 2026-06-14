'use client';

import { PostComposer } from '@/components/PostComposer';
import { Feed } from '@/components/Feed';
import { TrendingSidebar } from '@/components/TrendingSidebar';
import { useAuth } from '@/hooks/useAuth';
import { FEED, EXPLORE } from '@/lib/queries';
import Link from 'next/link';

export default function HomePage() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <>
      <section className="min-h-screen flex-1 border-x border-gray-200 dark:border-gray-800">
        <div className="border-b border-gray-200 p-4 text-xl font-bold dark:border-gray-800">
          {isAuthenticated ? 'Home' : 'Explore'}
        </div>

        {isAuthenticated && <PostComposer />}

        {loading ? (
          <p className="p-6 text-center text-gray-500">Loading…</p>
        ) : isAuthenticated ? (
          <Feed query={FEED} field="feed" realtime />
        ) : (
          <>
            <div className="border-b border-gray-200 p-4 text-center text-sm dark:border-gray-800">
              <Link href="/login" className="font-semibold text-brand hover:underline">
                Log in
              </Link>{' '}
              to post and personalize your feed.
            </div>
            <Feed query={EXPLORE} field="explore" />
          </>
        )}
      </section>

      <TrendingSidebar />
    </>
  );
}
