import type { Loaders } from './loaders.js';
import { createLoaders } from './loaders.js';
import { verifyAccessToken } from './auth.js';

export interface Context {
  userId: string | null;
  handle: string | null;
  loaders: Loaders;
}

/** Build a GraphQL context from an Authorization header value. */
export function buildContext(authHeader?: string): Context {
  let userId: string | null = null;
  let handle: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    const payload = verifyAccessToken(authHeader.slice(7));
    if (payload) {
      userId = payload.sub;
      handle = payload.handle;
    }
  }

  return { userId, handle, loaders: createLoaders(userId) };
}

/** Build context for a WebSocket subscription connection. */
export function buildWsContext(connectionParams?: Record<string, unknown>): Context {
  const auth =
    (connectionParams?.authorization as string) ??
    (connectionParams?.Authorization as string);
  return buildContext(auth);
}
