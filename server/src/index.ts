import { createServer } from 'node:http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import express from 'express';
import cors from 'cors';

import { typeDefs } from './schema/typeDefs.js';
import { resolvers } from './resolvers/index.js';
import { buildContext, buildWsContext, type Context } from './lib/context.js';
import { env } from './lib/env.js';
import { query } from './lib/db.js';

const schema = makeExecutableSchema({ typeDefs, resolvers });

async function main() {
  const app = express();
  const httpServer = createServer(app);

  // ─── WebSocket server for subscriptions ────────────────────
  const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
  const serverCleanup = useServer(
    {
      schema,
      context: (ctx): Context => buildWsContext(ctx.connectionParams as any),
    },
    wsServer,
  );

  // ─── Apollo (HTTP) ─────────────────────────────────────────
  const apollo = new ApolloServer<Context>({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });
  await apollo.start();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  app.use(
    '/graphql',
    cors<cors.CorsRequest>(),
    express.json({ limit: '1mb' }),
    expressMiddleware(apollo, {
      context: async ({ req }) => buildContext(req.headers.authorization),
    }),
  );

  // ─── Periodic trending materialized-view refresh ───────────
  const REFRESH_INTERVAL_MS = 60_000;
  setInterval(() => {
    query('REFRESH MATERIALIZED VIEW CONCURRENTLY trending_hashtags').catch((err) => {
      // Falls back to non-concurrent on first run (no data yet) — log and move on.
      console.warn('[trending] refresh failed:', err.message);
    });
  }, REFRESH_INTERVAL_MS).unref();

  httpServer.listen(env.port, () => {
    console.log(`🚀 GraphQL ready at http://localhost:${env.port}/graphql`);
    console.log(`🔌 Subscriptions ready at ws://localhost:${env.port}/graphql`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
