'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Feed } from '@/components/Feed';
import { TrendingSidebar } from '@/components/TrendingSidebar';
import { POSTS_BY_HASHTAG, EXPLORE } from '@/lib/queries';

function ExploreContent() {
  const params = useSearchParams();
  const tag = params.get('tag');

  return (
    <>
      <section className="min-h-screen flex-1 border-x border-gray-200 dark:border-gray-800">
        <div className="border-b border-gray-200 p-4 text-xl font-bold dark:border-gray-800">
          {tag ? `#${tag}` : 'Explore'}
        </div>
        {tag ? (
          <Feed
            key={tag}
            query={POSTS_BY_HASHTAG}
            field="postsByHashtag"
            variables={{ tag }}
          />
        ) : (
          <Feed query={EXPLORE} field="explore" />
        )}
      </section>
      <TrendingSidebar />
    </>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<p className="p-6 text-gray-500">Loading…</p>}>
      <ExploreContent />
    </Suspense>
  );
}
