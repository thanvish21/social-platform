'use client';

import { useQuery } from '@apollo/client';
import { useParams } from 'next/navigation';
import { PostCard } from '@/components/PostCard';
import { CommentList } from '@/components/CommentList';
import { POST_DETAIL } from '@/lib/queries';
import { useAuth } from '@/hooks/useAuth';
import type { Comment, Post } from '@/lib/types';

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();

  const { data, loading, error } = useQuery<{
    post: (Post & { comments: { edges: { node: Comment }[] } }) | null;
  }>(POST_DETAIL, { variables: { id } });

  if (loading) return <p className="flex-1 p-10 text-center text-gray-500">Loading…</p>;
  if (error || !data?.post)
    return <p className="flex-1 p-10 text-center text-red-500">Post not found.</p>;

  const post = data.post;
  const comments = post.comments.edges.map((e) => e.node);

  return (
    <section className="min-h-screen flex-1 border-x border-gray-200 dark:border-gray-800">
      <div className="border-b border-gray-200 p-4 text-xl font-bold dark:border-gray-800">
        Post
      </div>
      <PostCard post={post} />
      <CommentList postId={post.id} comments={comments} canComment={isAuthenticated} />
    </section>
  );
}
