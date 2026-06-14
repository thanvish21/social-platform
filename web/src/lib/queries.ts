import { gql } from '@apollo/client';

// ─── Fragments ───────────────────────────────────────────────
export const USER_FIELDS = gql`
  fragment UserFields on User {
    id
    handle
    displayName
    bio
    avatarUrl
    followersCount
    followingCount
    postsCount
    createdAt
    isFollowedByViewer
  }
`;

export const POST_FIELDS = gql`
  fragment PostFields on Post {
    id
    content
    mediaUrls
    likesCount
    commentsCount
    repostsCount
    createdAt
    isLikedByViewer
    author {
      ...UserFields
    }
    hashtags {
      id
      tag
    }
    repostOf {
      id
      content
      createdAt
      author {
        id
        handle
        displayName
        avatarUrl
      }
    }
  }
  ${USER_FIELDS}
`;

// ─── Auth ────────────────────────────────────────────────────
export const REGISTER = gql`
  mutation Register($handle: String!, $email: String!, $password: String!, $displayName: String!) {
    register(handle: $handle, email: $email, password: $password, displayName: $displayName) {
      accessToken
      refreshToken
      user { ...UserFields }
    }
  }
  ${USER_FIELDS}
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      refreshToken
      user { ...UserFields }
    }
  }
  ${USER_FIELDS}
`;

export const LOGOUT = gql`
  mutation Logout {
    logout
  }
`;

export const ME = gql`
  query Me {
    me { ...UserFields }
  }
  ${USER_FIELDS}
`;

// ─── Feed / posts ────────────────────────────────────────────
export const FEED = gql`
  query Feed($first: Int, $after: String) {
    feed(first: $first, after: $after) {
      edges { cursor node { ...PostFields } }
      pageInfo { hasNextPage endCursor }
    }
  }
  ${POST_FIELDS}
`;

export const EXPLORE = gql`
  query Explore($first: Int, $after: String) {
    explore(first: $first, after: $after) {
      edges { cursor node { ...PostFields } }
      pageInfo { hasNextPage endCursor }
    }
  }
  ${POST_FIELDS}
`;

export const POSTS_BY_HASHTAG = gql`
  query PostsByHashtag($tag: String!, $first: Int, $after: String) {
    postsByHashtag(tag: $tag, first: $first, after: $after) {
      edges { cursor node { ...PostFields } }
      pageInfo { hasNextPage endCursor }
    }
  }
  ${POST_FIELDS}
`;

export const POST_DETAIL = gql`
  query Post($id: ID!) {
    post(id: $id) {
      ...PostFields
      comments(first: 50) {
        edges {
          node {
            id
            content
            createdAt
            author { ...UserFields }
          }
        }
      }
    }
  }
  ${POST_FIELDS}
`;

export const CREATE_POST = gql`
  mutation CreatePost($content: String!, $mediaUrls: [String!]) {
    createPost(content: $content, mediaUrls: $mediaUrls) {
      ...PostFields
    }
  }
  ${POST_FIELDS}
`;

export const DELETE_POST = gql`
  mutation DeletePost($id: ID!) {
    deletePost(id: $id)
  }
`;

export const REPOST = gql`
  mutation Repost($postId: ID!, $content: String) {
    repost(postId: $postId, content: $content) { ...PostFields }
  }
  ${POST_FIELDS}
`;

export const LIKE_POST = gql`
  mutation LikePost($postId: ID!) {
    likePost(postId: $postId) { id likesCount isLikedByViewer }
  }
`;

export const UNLIKE_POST = gql`
  mutation UnlikePost($postId: ID!) {
    unlikePost(postId: $postId) { id likesCount isLikedByViewer }
  }
`;

export const CREATE_COMMENT = gql`
  mutation CreateComment($postId: ID!, $content: String!) {
    createComment(postId: $postId, content: $content) {
      id
      content
      createdAt
      author { ...UserFields }
    }
  }
  ${USER_FIELDS}
`;

// ─── Users / follows ─────────────────────────────────────────
export const USER_PROFILE = gql`
  query UserProfile($handle: String!) {
    user(handle: $handle) {
      ...UserFields
      posts(first: 20) {
        edges { cursor node { ...PostFields } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
  ${POST_FIELDS}
`;

export const USER_FOLLOWERS = gql`
  query UserFollowers($handle: String!) {
    user(handle: $handle) {
      id
      followers(first: 50) { edges { node { ...UserFields } } }
      following(first: 50) { edges { node { ...UserFields } } }
    }
  }
  ${USER_FIELDS}
`;

export const FOLLOW_USER = gql`
  mutation FollowUser($userId: ID!) {
    followUser(userId: $userId) { ...UserFields }
  }
  ${USER_FIELDS}
`;

export const UNFOLLOW_USER = gql`
  mutation UnfollowUser($userId: ID!) {
    unfollowUser(userId: $userId) { ...UserFields }
  }
  ${USER_FIELDS}
`;

// ─── Explore ─────────────────────────────────────────────────
export const TRENDING_HASHTAGS = gql`
  query TrendingHashtags($limit: Int) {
    trendingHashtags(limit: $limit) { id tag postCount }
  }
`;

export const SUGGESTED_USERS = gql`
  query SuggestedUsers($limit: Int) {
    suggestedUsers(limit: $limit) { ...UserFields }
  }
  ${USER_FIELDS}
`;

export const SEARCH = gql`
  query Search($q: String!) {
    search(q: $q) {
      posts { ...PostFields }
      users { ...UserFields }
    }
  }
  ${POST_FIELDS}
`;

// ─── Notifications ───────────────────────────────────────────
export const NOTIFICATIONS = gql`
  query Notifications($first: Int, $after: String) {
    notifications(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          type
          read
          createdAt
          actor { id handle displayName avatarUrl }
          post { id content }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const UNREAD_COUNT = gql`
  query UnreadNotificationCount {
    unreadNotificationCount
  }
`;

export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id)
  }
`;

export const MARK_ALL_READ = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;

// ─── Media ───────────────────────────────────────────────────
export const REQUEST_MEDIA_UPLOAD = gql`
  mutation RequestMediaUpload($contentType: String!) {
    requestMediaUpload(contentType: $contentType) {
      url
      key
      publicUrl
      fields { key value }
    }
  }
`;

// ─── Subscriptions ───────────────────────────────────────────
export const FEED_UPDATED = gql`
  subscription FeedUpdated {
    feedUpdated { ...PostFields }
  }
  ${POST_FIELDS}
`;

export const NOTIFICATION_RECEIVED = gql`
  subscription NotificationReceived {
    notificationReceived {
      id
      type
      read
      createdAt
      actor { id handle displayName avatarUrl }
      post { id content }
    }
  }
`;
