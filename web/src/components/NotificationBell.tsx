'use client';

import Link from 'next/link';
import { useMutation, useQuery, useSubscription } from '@apollo/client';
import { useEffect, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  NOTIFICATIONS,
  UNREAD_COUNT,
  NOTIFICATION_RECEIVED,
  MARK_ALL_READ,
} from '@/lib/queries';
import type { AppNotification, Connection } from '@/lib/types';

const VERB: Record<string, string> = {
  LIKE: 'liked your post',
  COMMENT: 'commented on your post',
  FOLLOW: 'followed you',
  REPOST: 'reposted your post',
  MENTION: 'mentioned you',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const { data: countData } = useQuery<{ unreadNotificationCount: number }>(UNREAD_COUNT, {
    fetchPolicy: 'cache-and-network',
  });
  const { data: listData, refetch } = useQuery<{
    notifications: Connection<AppNotification>;
  }>(NOTIFICATIONS, { variables: { first: 20 } });

  const [markAllRead] = useMutation(MARK_ALL_READ);

  useEffect(() => {
    if (typeof countData?.unreadNotificationCount === 'number') {
      setUnread(countData.unreadNotificationCount);
    }
  }, [countData]);

  // Realtime: bump the badge on each incoming notification.
  useSubscription<{ notificationReceived: AppNotification }>(NOTIFICATION_RECEIVED, {
    onData: () => {
      setUnread((n) => n + 1);
      void refetch();
    },
  });

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await markAllRead();
      setUnread(0);
    }
  };

  const items = listData?.notifications.edges ?? [];

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-800"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="scroll-thin absolute right-0 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 p-3 font-semibold dark:border-gray-800">
            Notifications
          </div>
          {items.length === 0 ? (
            <p className="p-6 text-center text-gray-500">No notifications yet.</p>
          ) : (
            items.map(({ node }) => (
              <Link
                key={node.id}
                href={node.post ? `/post/${node.post.id}` : `/${node.actor.handle}`}
                onClick={() => setOpen(false)}
                className={`flex items-start gap-2 border-b border-gray-100 p-3 text-sm hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-800 ${
                  node.read ? '' : 'bg-brand/5'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={node.actor.avatarUrl ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${node.actor.handle}`}
                  alt={node.actor.displayName}
                  className="h-8 w-8 rounded-full bg-gray-200 object-cover"
                />
                <div>
                  <span className="font-semibold">{node.actor.displayName}</span>{' '}
                  {VERB[node.type] ?? 'interacted'}
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNowStrict(new Date(node.createdAt))} ago
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
