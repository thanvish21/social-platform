# Sociable — Production-Grade Social Platform

A full-stack social media platform: GraphQL API with real-time subscriptions, a
Next.js 14 frontend, PostgreSQL with full-text search, Redis caching, and
S3-compatible media storage.

## Stack

| Layer      | Tech                                                              |
|------------|------------------------------------------------------------------|
| Backend    | Node.js, Apollo Server v4, GraphQL, graphql-ws (subscriptions)   |
| Database   | PostgreSQL 16 (tsvector search, materialized views), Flyway      |
| Cache/PubSub | Redis 7 (feed cache, trending, rate limits, cross-node pubsub) |
| Storage    | S3-compatible (MinIO in dev) with presigned uploads              |
| Frontend   | Next.js 14 (App Router), TypeScript, Apollo Client, Tailwind     |
| Infra      | Docker Compose, GitHub Actions CI, Railway deploy                |

## Features

**Backend**
- GraphQL schema: User, Post, Comment, Like, Follow, Notification, Hashtag
- Mutations: createPost, likePost, followUser, repost, createComment, requestMediaUpload, …
- Subscriptions over WebSocket: real-time feed updates + notification stream
- Cursor-based pagination for infinite-scroll feeds (Relay-style connections)
- Full-text search on posts and users via PostgreSQL `tsvector`
- Presigned S3/MinIO media uploads (no proxying bytes through the API)
- Redis caching: user feeds, trending hashtags; sliding-window rate limits
- Rate limiting: 100 posts/hour, 1000 likes/hour per user
- JWT auth with **refresh-token rotation + reuse detection** (family revocation)
- DataLoader batching to eliminate N+1 queries

**Database**
- Indexes on `user_id`, `created_at`, `hashtag_id`, plus trigram + GIN search indexes
- Triggers maintain denormalized counters (likes, comments, followers, …)
- Materialized view `trending_hashtags` (recency-weighted), refreshed on an interval

**Frontend**
- Infinite-scroll home feed with real-time prepend via subscription
- Profile pages with follower/following lists and follow/unfollow
- Post composer: image upload, hashtag autocomplete, live character counter (500)
- Notification bell with real-time unread badge
- Explore page: trending hashtags + suggested users
- Dark/light mode (persisted, respects system preference)

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up -d          # postgres, redis, minio, migrate, app
npm install
npm run seed --workspace=server   # 1000 users + posts (login pwd: password123)
npm run dev:web                   # Next.js on :3000
```

- GraphQL API: http://localhost:4000/graphql
- Subscriptions: ws://localhost:4000/graphql
- Web app: http://localhost:3000
- MinIO console: http://localhost:9001 (minioadmin / minioadmin)

## Local development (without Docker for the apps)

```bash
# Infra only
docker compose up -d postgres redis minio minio-init

# Migrations
npm run migrate            # requires Flyway, or use the compose `migrate` service

# Run both apps
npm run dev                # server (:4000) + web (:3000) concurrently
```

## Scripts

| Command                              | Description                          |
|--------------------------------------|--------------------------------------|
| `npm run dev`                        | Run server + web concurrently        |
| `npm run build`                      | Build both workspaces                |
| `npm run test`                       | Server unit tests (Vitest)           |
| `npm run seed --workspace=server`    | Seed 1000 fake users + posts         |
| `npm run migrate`                    | Apply Flyway migrations              |

## Project structure

```
social-platform/
├── server/            # GraphQL API (Apollo + ws)
│   └── src/
│       ├── schema/        # typeDefs
│       ├── resolvers/     # Query, Mutation, Subscription, type resolvers
│       ├── services/      # storage, notifications/hashtags
│       ├── middleware/    # rate limiting
│       └── lib/           # db, redis, auth, pubsub, loaders, pagination, env
├── web/               # Next.js 14 frontend
│   └── src/{app,components,hooks,lib}
├── db/migrations/     # Flyway SQL (V1 schema, V2 triggers, V3 trending view)
├── .github/workflows/ # CI: test, lint, build, deploy to Railway
└── docker-compose.yml
```

## Deployment (Railway)

CI builds and tests on every push; `main` deploys the server via the Railway CLI.
Set a `RAILWAY_TOKEN` repository secret to enable deploys. `railway.json` (root) and
`web/railway.json` define the Docker-based services. Provision Railway PostgreSQL and
Redis plugins and wire `DATABASE_URL` / `REDIS_URL` into the service variables.

## Auth model

- Access tokens: short-lived (15 min), stateless JWT.
- Refresh tokens: 7 days, stored **hashed**, rotated on every use. A replayed
  (already-rotated) token revokes the entire token family — mitigating theft.
