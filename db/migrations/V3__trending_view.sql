-- ─────────────────────────────────────────────────────────────
-- V3: Trending hashtags materialized view.
-- Weighted recency score over the last 7 days. Refresh on a
-- schedule (cron / app interval) with REFRESH MATERIALIZED VIEW
-- CONCURRENTLY trending_hashtags.
-- ─────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW trending_hashtags AS
SELECT
    h.id              AS hashtag_id,
    h.tag             AS tag,
    COUNT(ph.post_id) AS post_count,
    -- recency-weighted score: newer posts contribute more
    COALESCE(SUM(
        EXP(-EXTRACT(EPOCH FROM (now() - ph.created_at)) / 86400.0)
    ), 0)             AS score,
    MAX(ph.created_at) AS last_used_at
FROM hashtags h
JOIN post_hashtags ph ON ph.hashtag_id = h.id
WHERE ph.created_at > now() - INTERVAL '7 days'
GROUP BY h.id, h.tag
ORDER BY score DESC;

-- Unique index required for REFRESH ... CONCURRENTLY
CREATE UNIQUE INDEX idx_trending_hashtags_id ON trending_hashtags (hashtag_id);
CREATE INDEX idx_trending_hashtags_score ON trending_hashtags (score DESC);
