/**
 * Cursor-based pagination helpers (Relay-style connections).
 * Cursors are opaque base64 of a JSON tuple so the client never
 * depends on the underlying ordering keys.
 */

export interface PageArgs {
  first?: number | null;
  after?: string | null;
}

export interface Connection<T> {
  edges: { node: T; cursor: string }[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function clampLimit(first?: number | null): number {
  if (!first || first < 1) return DEFAULT_LIMIT;
  return Math.min(first, MAX_LIMIT);
}

/** Encode arbitrary ordering keys into an opaque cursor. */
export function encodeCursor(parts: (string | number)[]): string {
  return Buffer.from(JSON.stringify(parts)).toString('base64url');
}

export function decodeCursor(cursor: string): (string | number)[] | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Build a connection from a row set that was fetched with limit+1.
 * `makeCursor` derives the opaque cursor from each node.
 */
export function buildConnection<T>(
  rows: T[],
  limit: number,
  makeCursor: (node: T) => string,
): Connection<T> {
  const hasNextPage = rows.length > limit;
  const nodes = hasNextPage ? rows.slice(0, limit) : rows;
  const edges = nodes.map((node) => ({ node, cursor: makeCursor(node) }));
  return {
    edges,
    pageInfo: {
      hasNextPage,
      endCursor: edges.length ? edges[edges.length - 1].cursor : null,
    },
  };
}
