/**
 * Seed script: generates ~1000 realistic users, their posts, follows,
 * likes, and comments. Idempotent-ish — clears existing data first.
 *
 * Run: npm run seed --workspace=server
 */
import { faker } from '@faker-js/faker';
import { pool, query } from './lib/db.js';
import { hashPassword } from './lib/auth.js';
import { extractHashtags } from './lib/text.js';

const USER_COUNT = 1000;
const MAX_POSTS_PER_USER = 8;
const MAX_FOLLOWS_PER_USER = 30;

const HASHTAG_POOL = [
  'tech', 'webdev', 'graphql', 'typescript', 'react', 'nextjs', 'nodejs',
  'design', 'startup', 'ai', 'ml', 'opensource', 'devops', 'coding',
  'photography', 'travel', 'food', 'music', 'fitness', 'books',
];

function randomPostContent(): string {
  const templates = [
    () => `${faker.hacker.phrase()} #${faker.helpers.arrayElement(HASHTAG_POOL)}`,
    () => `Just shipped ${faker.commerce.productName()}! #${faker.helpers.arrayElement(HASHTAG_POOL)} #${faker.helpers.arrayElement(HASHTAG_POOL)}`,
    () => faker.lorem.sentence(),
    () => `Hot take: ${faker.company.catchPhrase().toLowerCase()}. #${faker.helpers.arrayElement(HASHTAG_POOL)}`,
    () => `${faker.word.words({ count: { min: 5, max: 20 } })}`,
  ];
  return faker.helpers.arrayElement(templates)();
}

async function clearData() {
  console.log('🧹 Clearing existing data...');
  await query(`TRUNCATE notifications, post_hashtags, hashtags, comments, likes,
               follows, refresh_tokens, posts, users RESTART IDENTITY CASCADE`);
}

async function seedUsers(): Promise<string[]> {
  console.log(`👤 Creating ${USER_COUNT} users...`);
  const passwordHash = await hashPassword('password123');
  const ids: string[] = [];

  // Batch inserts for speed.
  const BATCH = 100;
  for (let i = 0; i < USER_COUNT; i += BATCH) {
    const values: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    for (let j = 0; j < BATCH && i + j < USER_COUNT; j++) {
      const handle = faker.internet
        .username()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 24) + faker.string.numeric(4);
      const email = `${handle}@${faker.internet.domainName()}`;
      values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
      params.push(
        handle,
        email,
        passwordHash,
        faker.person.fullName(),
        faker.lorem.sentence(),
        faker.image.avatarGitHub(),
      );
    }
    const rows = await query<{ id: string }>(
      `INSERT INTO users (handle, email, password_hash, display_name, bio, avatar_url)
       VALUES ${values.join(',')}
       ON CONFLICT (handle) DO NOTHING
       RETURNING id`,
      params,
    );
    ids.push(...rows.map((r) => r.id));
  }
  console.log(`   → ${ids.length} users created`);
  return ids;
}

async function seedFollows(userIds: string[]) {
  console.log('🔗 Creating follow relationships...');
  let count = 0;
  for (const followerId of userIds) {
    const followCount = faker.number.int({ min: 0, max: MAX_FOLLOWS_PER_USER });
    const followees = faker.helpers.arrayElements(userIds, followCount);
    const values: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    for (const followeeId of followees) {
      if (followeeId === followerId) continue;
      values.push(`($${p++}, $${p++})`);
      params.push(followerId, followeeId);
    }
    if (values.length) {
      await query(
        `INSERT INTO follows (follower_id, followee_id) VALUES ${values.join(',')}
         ON CONFLICT DO NOTHING`,
        params,
      );
      count += values.length;
    }
  }
  console.log(`   → ${count} follows created`);
}

async function seedPosts(userIds: string[]): Promise<string[]> {
  console.log('📝 Creating posts...');
  const postIds: string[] = [];
  const tagCache = new Map<string, string>();

  for (const authorId of userIds) {
    const n = faker.number.int({ min: 0, max: MAX_POSTS_PER_USER });
    for (let i = 0; i < n; i++) {
      const content = randomPostContent();
      const hasMedia = faker.datatype.boolean({ probability: 0.3 });
      const mediaUrls = hasMedia ? [faker.image.urlPicsumPhotos()] : [];
      const createdAt = faker.date.recent({ days: 7 });

      const post = await query<{ id: string }>(
        `INSERT INTO posts (author_id, content, media_urls, created_at)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [authorId, content, mediaUrls, createdAt],
      );
      const postId = post[0].id;
      postIds.push(postId);

      // Link hashtags.
      for (const tag of extractHashtags(content)) {
        let hashtagId = tagCache.get(tag);
        if (!hashtagId) {
          const h = await query<{ id: string }>(
            `INSERT INTO hashtags (tag) VALUES ($1)
             ON CONFLICT (tag) DO UPDATE SET tag = EXCLUDED.tag RETURNING id`,
            [tag],
          );
          hashtagId = h[0].id;
          tagCache.set(tag, hashtagId);
        }
        await query(
          `INSERT INTO post_hashtags (post_id, hashtag_id, created_at)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [postId, hashtagId, createdAt],
        );
      }
    }
  }
  console.log(`   → ${postIds.length} posts created`);
  return postIds;
}

async function seedEngagement(userIds: string[], postIds: string[]) {
  console.log('❤️  Creating likes and comments...');
  let likeCount = 0;
  let commentCount = 0;

  for (const postId of postIds) {
    // Likes
    const likers = faker.helpers.arrayElements(
      userIds,
      faker.number.int({ min: 0, max: 25 }),
    );
    if (likers.length) {
      const values: string[] = [];
      const params: unknown[] = [];
      let p = 1;
      for (const userId of likers) {
        values.push(`($${p++}, $${p++})`);
        params.push(userId, postId);
      }
      await query(
        `INSERT INTO likes (user_id, post_id) VALUES ${values.join(',')}
         ON CONFLICT DO NOTHING`,
        params,
      );
      likeCount += likers.length;
    }

    // Comments
    const commenters = faker.helpers.arrayElements(
      userIds,
      faker.number.int({ min: 0, max: 4 }),
    );
    for (const userId of commenters) {
      await query(
        `INSERT INTO comments (post_id, author_id, content) VALUES ($1, $2, $3)`,
        [postId, userId, faker.lorem.sentence()],
      );
      commentCount++;
    }
  }
  console.log(`   → ${likeCount} likes, ${commentCount} comments created`);
}

async function refreshTrending() {
  console.log('📈 Refreshing trending view...');
  await query('REFRESH MATERIALIZED VIEW trending_hashtags');
}

async function main() {
  const start = Date.now();
  await clearData();
  const userIds = await seedUsers();
  await seedFollows(userIds);
  const postIds = await seedPosts(userIds);
  await seedEngagement(userIds, postIds);
  await refreshTrending();
  console.log(`\n✅ Seed complete in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  console.log('   Login with any user email and password: password123');
  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
