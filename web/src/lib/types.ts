export interface User {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt: string;
  isFollowedByViewer: boolean;
}

export interface Hashtag {
  id: string;
  tag: string;
  postCount: number;
}

export interface Post {
  id: string;
  author: User;
  content: string;
  mediaUrls: string[];
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  createdAt: string;
  hashtags: Hashtag[];
  repostOf: Post | null;
  isLikedByViewer: boolean;
}

export interface Comment {
  id: string;
  author: User;
  content: string;
  createdAt: string;
}

export type NotificationType = 'LIKE' | 'COMMENT' | 'FOLLOW' | 'REPOST' | 'MENTION';

export interface AppNotification {
  id: string;
  type: NotificationType;
  actor: User;
  post: Post | null;
  read: boolean;
  createdAt: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface Connection<T> {
  edges: { node: T; cursor: string }[];
  pageInfo: PageInfo;
}

export interface AuthPayload {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface PresignedUpload {
  url: string;
  fields: { key: string; value: string }[];
  key: string;
  publicUrl: string;
}
