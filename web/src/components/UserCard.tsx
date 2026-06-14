'use client';

import Link from 'next/link';
import { useMutation } from '@apollo/client';
import { useState } from 'react';
import { FOLLOW_USER, UNFOLLOW_USER } from '@/lib/queries';
import type { User } from '@/lib/types';

export function UserCard({ user }: { user: User }) {
  const [following, setFollowing] = useState(user.isFollowedByViewer);
  const [followUser] = useMutation(FOLLOW_USER);
  const [unfollowUser] = useMutation(UNFOLLOW_USER);

  const toggle = async () => {
    const next = !following;
    setFollowing(next); // optimistic
    try {
      if (next) await followUser({ variables: { userId: user.id } });
      else await unfollowUser({ variables: { userId: user.id } });
    } catch {
      setFollowing(!next); // revert on failure
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <Link href={`/${user.handle}`} className="flex items-center gap-3 min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.avatarUrl ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${user.handle}`}
          alt={user.displayName}
          className="h-10 w-10 rounded-full object-cover bg-gray-200"
        />
        <div className="min-w-0">
          <p className="font-semibold truncate">{user.displayName}</p>
          <p className="text-sm text-gray-500 truncate">@{user.handle}</p>
        </div>
      </Link>
      <button
        onClick={toggle}
        className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
          following
            ? 'border border-gray-300 dark:border-gray-700 hover:border-red-400 hover:text-red-500'
            : 'bg-brand text-white hover:bg-brand-dark'
        }`}
      >
        {following ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}
