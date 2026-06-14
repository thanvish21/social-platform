'use client';

import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  split,
  from,
  type NormalizedCacheObject,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { getAccessToken } from './auth';

const HTTP_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_HTTP ?? 'http://localhost:4000/graphql';
const WS_URL = process.env.NEXT_PUBLIC_GRAPHQL_WS ?? 'ws://localhost:4000/graphql';

function makeClient(): ApolloClient<NormalizedCacheObject> {
  const httpLink = new HttpLink({ uri: HTTP_URL });

  // Inject the bearer token on every HTTP request.
  const authLink = setContext((_, { headers }) => {
    const token = getAccessToken();
    return {
      headers: {
        ...headers,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    };
  });

  // WebSocket link only exists in the browser.
  const wsLink =
    typeof window !== 'undefined'
      ? new GraphQLWsLink(
          createClient({
            url: WS_URL,
            connectionParams: () => {
              const token = getAccessToken();
              return token ? { authorization: `Bearer ${token}` } : {};
            },
            retryAttempts: 5,
          }),
        )
      : null;

  const httpWithAuth = from([authLink, httpLink]);

  // Route subscriptions over WS, everything else over HTTP.
  const link =
    wsLink != null
      ? split(
          ({ query }) => {
            const def = getMainDefinition(query);
            return (
              def.kind === 'OperationDefinition' &&
              def.operation === 'subscription'
            );
          },
          wsLink,
          httpWithAuth,
        )
      : httpWithAuth;

  return new ApolloClient({
    link,
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            // Cursor-based connections: merge pages instead of replacing.
            feed: relayMerge(),
            explore: relayMerge(),
            notifications: relayMerge(),
          },
        },
      },
    }),
  });
}

/** Minimal Relay-style merge for our { edges, pageInfo } connections. */
function relayMerge() {
  return {
    keyArgs: false as const,
    merge(existing: any, incoming: any, { args }: any) {
      if (!existing || !args?.after) return incoming;
      return {
        ...incoming,
        edges: [...(existing.edges ?? []), ...(incoming.edges ?? [])],
      };
    },
  };
}

let browserClient: ApolloClient<NormalizedCacheObject> | null = null;

export function getApolloClient(): ApolloClient<NormalizedCacheObject> {
  if (typeof window === 'undefined') return makeClient();
  if (!browserClient) browserClient = makeClient();
  return browserClient;
}
