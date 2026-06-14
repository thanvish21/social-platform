-- ─────────────────────────────────────────────────────────────
-- V1: Core schema — users, posts, comments, likes, follows,
--     notifications, hashtags, refresh tokens.
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- trigram search on handles/names
CREATE EXTENSION IF NOT EXISTS "citext";      -- case-insensitive handles/emails/tags

-- ─── Users ───────────────────────────────────────────────────
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle          CITEXT UNIQUE NOT NULL,
    email           CITEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    bio             TEXT NOT NULL DEFAULT '',
    avatar_url      TEXT,
    followers_count INTEGER NOT NULL DEFAULT 0,
    following_count INTEGER NOT NULL DEFAULT 0,
    posts_count     INTEGER NOT NULL DEFAULT 0,
    search_vector   TSVECTOR,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_created_at ON users (created_at DESC);
CREATE INDEX idx_users_handle_trgm ON users USING GIN (handle gin_trgm_ops);
CREATE INDEX idx_users_search ON users USING GIN (search_vector);

-- ─── Posts ───────────────────────────────────────────────────
CREATE TABLE posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         TEXT NOT NULL DEFAULT '',
    media_urls      TEXT[] NOT NULL DEFAULT '{}',
    -- repost support: when set, this row is a repost of `repost_of_id`
    repost_of_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
    likes_count     INTEGER NOT NULL DEFAULT 0,
    comments_count  INTEGER NOT NULL DEFAULT 0,
    reposts_count   INTEGER NOT NULL DEFAULT 0,
    search_vector   TSVECTOR,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_author_id ON posts (author_id);
CREATE INDEX idx_posts_created_at ON posts (created_at DESC);
CREATE INDEX idx_posts_author_created ON posts (author_id, created_at DESC);
CREATE INDEX idx_posts_repost_of ON posts (repost_of_id) WHERE repost_of_id IS NOT NULL;
CREATE INDEX idx_posts_search ON posts USING GIN (search_vector);

-- ─── Comments ────────────────────────────────────────────────
CREATE TABLE comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_post_id ON comments (post_id, created_at DESC);
CREATE INDEX idx_comments_author_id ON comments (author_id);

-- ─── Likes ───────────────────────────────────────────────────
CREATE TABLE likes (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, post_id)
);

CREATE INDEX idx_likes_post_id ON likes (post_id);
CREATE INDEX idx_likes_user_id ON likes (user_id, created_at DESC);

-- ─── Follows ─────────────────────────────────────────────────
CREATE TABLE follows (
    follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id),
    CHECK (follower_id <> followee_id)
);

CREATE INDEX idx_follows_followee ON follows (followee_id, created_at DESC);
CREATE INDEX idx_follows_follower ON follows (follower_id, created_at DESC);

-- ─── Hashtags ────────────────────────────────────────────────
CREATE TABLE hashtags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag         CITEXT UNIQUE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hashtags_tag_trgm ON hashtags USING GIN (tag gin_trgm_ops);

CREATE TABLE post_hashtags (
    post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    hashtag_id  UUID NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, hashtag_id)
);

CREATE INDEX idx_post_hashtags_hashtag_id ON post_hashtags (hashtag_id, created_at DESC);
CREATE INDEX idx_post_hashtags_post_id ON post_hashtags (post_id);

-- ─── Notifications ───────────────────────────────────────────
CREATE TYPE notification_type AS ENUM ('LIKE', 'COMMENT', 'FOLLOW', 'REPOST', 'MENTION');

CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- recipient
    actor_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- who triggered it
    type        notification_type NOT NULL,
    post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
    read        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications (user_id) WHERE read = FALSE;

-- ─── Refresh tokens (rotation + reuse detection) ─────────────
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    family_id   UUID NOT NULL,        -- rotation lineage; revoke whole family on reuse
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);
