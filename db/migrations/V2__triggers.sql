-- ─────────────────────────────────────────────────────────────
-- V2: Triggers — full-text search vectors + denormalized counters.
-- Keeps search_vector and *_count columns consistent without
-- application-side bookkeeping.
-- ─────────────────────────────────────────────────────────────

-- ─── Search vectors ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION posts_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_posts_search
    BEFORE INSERT OR UPDATE OF content ON posts
    FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update();

CREATE OR REPLACE FUNCTION users_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.handle::text, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.display_name, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.bio, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_search
    BEFORE INSERT OR UPDATE OF handle, display_name, bio ON users
    FOR EACH ROW EXECUTE FUNCTION users_search_vector_update();

-- ─── Likes counter ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION likes_count_update() RETURNS trigger AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_likes_count
    AFTER INSERT OR DELETE ON likes
    FOR EACH ROW EXECUTE FUNCTION likes_count_update();

-- ─── Comments counter ────────────────────────────────────────
CREATE OR REPLACE FUNCTION comments_count_update() RETURNS trigger AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comments_count
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION comments_count_update();

-- ─── Reposts counter (a post that is a repost_of another) ─────
CREATE OR REPLACE FUNCTION reposts_count_update() RETURNS trigger AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.repost_of_id IS NOT NULL) THEN
        UPDATE posts SET reposts_count = reposts_count + 1 WHERE id = NEW.repost_of_id;
    ELSIF (TG_OP = 'DELETE' AND OLD.repost_of_id IS NOT NULL) THEN
        UPDATE posts SET reposts_count = GREATEST(reposts_count - 1, 0) WHERE id = OLD.repost_of_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reposts_count
    AFTER INSERT OR DELETE ON posts
    FOR EACH ROW EXECUTE FUNCTION reposts_count_update();

-- ─── Follow counters ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION follows_count_update() RETURNS trigger AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
        UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.followee_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
        UPDATE users SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.followee_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_follows_count
    AFTER INSERT OR DELETE ON follows
    FOR EACH ROW EXECUTE FUNCTION follows_count_update();

-- ─── Posts-per-user counter ──────────────────────────────────
CREATE OR REPLACE FUNCTION posts_count_update() RETURNS trigger AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE users SET posts_count = posts_count + 1 WHERE id = NEW.author_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE users SET posts_count = GREATEST(posts_count - 1, 0) WHERE id = OLD.author_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_posts_count
    AFTER INSERT OR DELETE ON posts
    FOR EACH ROW EXECUTE FUNCTION posts_count_update();
