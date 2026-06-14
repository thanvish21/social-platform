'use client';

import Link from 'next/link';
import { useMutation } from '@apollo/client';
import { useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { CREATE_COMMENT, POST_DETAIL } from '@/lib/queries';
import type { Comment } from '@/lib/types';

interface CommentListProps {
  postId: string;
  comments: Comment[];
  canComment: boolean;
}

export function CommentList({ postId, comments, canComment }: CommentListProps) {
  const [text, setText] = useState('');
  const [createComment, { loading }] = useMutation(CREATE_COMMENT, {
    refetchQueries: [{ query: POST_DETAIL, variables: { id: postId } }],
  });

  const submit = async () => {
    if (!text.trim()) return;
    await createComment({ variables: { postId, content: text.trim() } });
    setText('');
  };

  return (
    <div>
      {canComment && (
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800 p-4">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Post your reply"
            className="flex-1 bg-transparent outline-none"
          />
          <button
            onClick={submit}
            disabled={loading || !text.trim()}
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Reply
          </button>
        </div>
      )}

      {comments.length === 0 ? (
        <p className="p-6 text-center text-gray-500">No replies yet.</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className="flex gap-3 border-b border-gray-200 dark:border-gray-800 p-4">
            <Link href={`/${c.author.handle}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.author.avatarUrl ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${c.author.handle}`}
                alt={c.author.displayName}
                className="h-9 w-9 rounded-full bg-gray-200 object-cover"
              />
            </Link>
            <div>
              <div className="flex items-center gap-1.5 text-sm">
                <span className="font-semibold">{c.author.displayName}</span>
                <span className="text-gray-500">@{c.author.handle}</span>
                <span className="text-gray-500">·</span>
                <span className="text-gray-500">
                  {formatDistanceToNowStrict(new Date(c.createdAt))}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words">{c.content}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
