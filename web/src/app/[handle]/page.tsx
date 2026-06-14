'use client';

import { useQuery, useMutation } from '@apollo/client';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { format } from 'date-fns';
import { PostCard } from '@/components/PostCard';
import { UserCard } from '@/components/UserCard';
import {
  USER_PROFILE,
  USER_FOLLOWERS,
  FOLLOW_USER,
  UNFOLLOW_USER,
} from '@/lib/queries';
import { useAuth } from '@/hooks/useAuth';
import type { Connection, Post, User } from '@/lib/types';

type Tab = 'posts' | 'followers' | 'following';

export default function ProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const { user: viewer } = useAuth();
  const [tab, setTab] = useState<Tab>('posts');

  const { data, loading, error } = useQuery<{
    user: (User & { posts: Connection<Post> }) | null;
  }>(USER_PROFILE, { variables: { handle } });

  const user = data?.user;
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followUser] = useMutation(FOLLOW_USER);
  const [unfollowUser] = useMutation(UNFOLLOW_USER);

  const isFollowing = following ?? user?.isFollowedByViewer ?? false;
  const isSelf = viewer?.id === user?.id;

  const toggleFollow = async () => {
    if (!user) return;
    const next = !isFollowing;
    setFollowing(next);
    try {
      if (next) await followUser({ variables: { userId: user.id } });
      else await unfollowUser({ variables: { userId: user.id } });
    } catch {
      setFollowing(!next);
    }
  };

  if (loading) return <p className="flex-1 p-10 text-center text-gray-500">Loading…</p>;
  if (error || !user)
    return <p className="flex-1 p-10 text-center text-red-500">User not found.</p>;

  return (
    <section className="min-h-screen flex-1 border-x border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-start justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={user.avatarUrl ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${user.handle}`}
            alt={user.displayName}
            className="h-20 w-20 rounded-full bg-gray-200 object-cover"
          />
          {!isSelf && viewer && (
            <button
              onClick={toggleFollow}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                isFollowing
                  ? 'border border-gray-300 hover:text-red-500 dark:border-gray-700'
                  : 'bg-brand text-white hover:bg-brand-dark'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
        <h1 className="mt-3 text-xl font-bold">{user.displayName}</h1>
        <p className="text-gray-500">@{user.handle}</p>
        {user.bio && <p className="mt-2 whitespace-pre-wrap">{user.bio}</p>}
        <p className="mt-2 text-sm text-gray-500">
          Joined {format(new Date(user.createdAt), 'MMMM yyyy')}
        </p>
        <div className="mt-2 flex gap-4 text-sm">
          <span>
            <strong>{user.followingCount}</strong>{' '}
            <span className="text-gray-500">Following</span>
          </span>
          <span>
            <strong>{user.followersCount}</strong>{' '}
            <span className="text-gray-500">Followers</span>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {(['posts', 'followers', 'following'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-semibold capitalize transition ${
              tab === t
                ? 'border-b-2 border-brand text-brand'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'posts' && (
        <div>
          {user.posts.edges.length === 0 ? (
            <p className="p-10 text-center text-gray-500">No posts yet.</p>
          ) : (
            user.posts.edges.map(({ node }) => <PostCard key={node.id} post={node} />)
          )}
        </div>
      )}

      {(tab === 'followers' || tab === 'following') && (
        <FollowList handle={handle} tab={tab} />
      )}
    </section>
  );
}

function FollowList({ handle, tab }: { handle: string; tab: 'followers' | 'following' }) {
  const { data, loading } = useQuery<{
    user: {
      followers: { edges: { node: User }[] };
      following: { edges: { node: User }[] };
    } | null;
  }>(USER_FOLLOWERS, { variables: { handle } });

  if (loading) return <p className="p-6 text-center text-gray-500">Loading…</p>;
  const list = tab === 'followers' ? data?.user?.followers.edges : data?.user?.following.edges;

  if (!list?.length)
    return <p className="p-10 text-center text-gray-500">No {tab} yet.</p>;

  return (
    <div className="px-4">
      {list.map(({ node }) => (
        <UserCard key={node.id} user={node} />
      ))}
    </div>
  );
}
