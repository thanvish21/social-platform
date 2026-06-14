'use client';

import Link from 'next/link';
import { useMutation } from '@apollo/client';
import { useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { LIKE_POST, UNLIKE_POST } from '@/lib/queries';
import type { Post } from '@/lib/types';

function renderContent(content: string) {
  // Linkify #hashtags inline.
  return content.split(/(#[\p{L}0-9_]+)/gu).map((part, i) => {
    if (part.startsWith('#')) {
      const tag = part.slice(1);
      return (
        <Link key={i} href={`/explore?tag=${tag}`} className="text-brand hover:underline">
          {part}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(post.isLikedByViewer);
  const [likes, setLikes] = useState(post.likesCount);
  const [likePost] = useMutation(LIKE_POST);
  const [unlikePost] = useMutation(UNLIKE_POST);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    try {
      if (next) await likePost({ variables: { postId: post.id } });
      else await unlikePost({ variables: { postId: post.id } });
    } catch {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    }
  };

  const author = post.author;

  return (
    <article className="border-b border-gray-200 dark:border-gray-800 p-4 hover:bg-gray-100/40 dark:hover:bg-gray-900/40 transition">
      {post.repostOf && (
        <p className="text-xs text-gray-500 mb-1">🔁 reposted by @{author.handle}</p>
      )}
      <div className="flex gap-3">
        <Link href={`/${author.handle}`} className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={author.avatarUrl ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${author.handle}`}
            alt={author.displayName}
            className="h-11 w-11 rounded-full object-cover bg-gray-200"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm">
            <Link href={`/${author.handle}`} className="font-semibold hover:underline truncate">
              {author.displayName}
            </Link>
            <span className="text-gray-500 truncate">@{author.handle}</span>
            <span className="text-gray-500">·</span>
            <span className="text-gray-500 whitespace-nowrap">
              {formatDistanceToNowStrict(new Date(post.createdAt))}
            </span>
          </div>

          <Link href={`/post/${post.id}`}>
            <p className="mt-1 whitespace-pre-wrap break-words">{renderContent(post.content)}</p>
          </Link>

          {post.repostOf && (
            <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-800 p-3 text-sm">
              <span className="font-semibold">{post.repostOf.author.displayName}</span>{' '}
              <span className="text-gray-500">@{post.repostOf.author.handle}</span>
              <p className="mt-1 whitespace-pre-wrap break-words">{post.repostOf.content}</p>
            </div>
          )}

          {post.mediaUrls.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {post.mediaUrls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt="post media"
                  className="rounded-xl object-cover w-full max-h-80 bg-gray-200"
                />
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-6 text-sm text-gray-500">
            <Link href={`/post/${post.id}`} className="flex items-center gap-1 hover:text-brand">
              💬 {post.commentsCount}
            </Link>
            <span className="flex items-center gap-1">🔁 {post.repostsCount}</span>
            <button
              onClick={toggleLike}
              className={`flex items-center gap-1 transition ${liked ? 'text-red-500' : 'hover:text-red-500'}`}
            >
              {liked ? '❤️' : '🤍'} {likes}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
