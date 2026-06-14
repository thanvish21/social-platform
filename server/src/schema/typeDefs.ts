export const typeDefs = /* GraphQL */ `
  scalar DateTime

  # ─── Types ─────────────────────────────────────────────────
  type User {
    id: ID!
    handle: String!
    displayName: String!
    bio: String!
    avatarUrl: String
    followersCount: Int!
    followingCount: Int!
    postsCount: Int!
    createdAt: DateTime!
    # Viewer-relative: does the current user follow this user?
    isFollowedByViewer: Boolean!
    posts(first: Int, after: String): PostConnection!
    followers(first: Int, after: String): UserConnection!
    following(first: Int, after: String): UserConnection!
  }

  type Post {
    id: ID!
    author: User!
    content: String!
    mediaUrls: [String!]!
    likesCount: Int!
    commentsCount: Int!
    repostsCount: Int!
    createdAt: DateTime!
    hashtags: [Hashtag!]!
    repostOf: Post
    # Viewer-relative
    isLikedByViewer: Boolean!
    comments(first: Int, after: String): CommentConnection!
  }

  type Comment {
    id: ID!
    post: Post!
    author: User!
    content: String!
    createdAt: DateTime!
  }

  type Hashtag {
    id: ID!
    tag: String!
    postCount: Int!
  }

  enum NotificationType {
    LIKE
    COMMENT
    FOLLOW
    REPOST
    MENTION
  }

  type Notification {
    id: ID!
    type: NotificationType!
    actor: User!
    post: Post
    read: Boolean!
    createdAt: DateTime!
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  type PresignedUpload {
    url: String!
    fields: [KeyValue!]!
    key: String!
    publicUrl: String!
  }

  type KeyValue {
    key: String!
    value: String!
  }

  # ─── Connections (cursor pagination) ───────────────────────
  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  type PostEdge {
    node: Post!
    cursor: String!
  }
  type PostConnection {
    edges: [PostEdge!]!
    pageInfo: PageInfo!
  }

  type UserEdge {
    node: User!
    cursor: String!
  }
  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
  }

  type CommentEdge {
    node: Comment!
    cursor: String!
  }
  type CommentConnection {
    edges: [CommentEdge!]!
    pageInfo: PageInfo!
  }

  type SearchResult {
    posts: [Post!]!
    users: [User!]!
  }

  # ─── Queries ───────────────────────────────────────────────
  type Query {
    me: User
    user(handle: String!): User
    post(id: ID!): Post
    # Personalized home feed (posts from followed users + self).
    feed(first: Int, after: String): PostConnection!
    # Global/explore timeline.
    explore(first: Int, after: String): PostConnection!
    postsByHashtag(tag: String!, first: Int, after: String): PostConnection!
    trendingHashtags(limit: Int): [Hashtag!]!
    suggestedUsers(limit: Int): [User!]!
    search(q: String!): SearchResult!
    notifications(first: Int, after: String): NotificationConnection!
    unreadNotificationCount: Int!
  }

  type NotificationEdge {
    node: Notification!
    cursor: String!
  }
  type NotificationConnection {
    edges: [NotificationEdge!]!
    pageInfo: PageInfo!
  }

  # ─── Mutations ─────────────────────────────────────────────
  type Mutation {
    register(handle: String!, email: String!, password: String!, displayName: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    refresh(refreshToken: String!): AuthPayload!
    logout: Boolean!

    createPost(content: String!, mediaUrls: [String!]): Post!
    deletePost(id: ID!): Boolean!
    repost(postId: ID!, content: String): Post!

    likePost(postId: ID!): Post!
    unlikePost(postId: ID!): Post!

    createComment(postId: ID!, content: String!): Comment!
    deleteComment(id: ID!): Boolean!

    followUser(userId: ID!): User!
    unfollowUser(userId: ID!): User!

    requestMediaUpload(contentType: String!): PresignedUpload!

    markNotificationRead(id: ID!): Boolean!
    markAllNotificationsRead: Boolean!

    updateProfile(displayName: String, bio: String, avatarUrl: String): User!
  }

  # ─── Subscriptions ─────────────────────────────────────────
  type Subscription {
    # New posts arriving in the authenticated user's feed.
    feedUpdated: Post!
    # New notifications for the authenticated user.
    notificationReceived: Notification!
  }
`;
