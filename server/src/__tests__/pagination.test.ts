import { describe, it, expect } from 'vitest';
import {
  encodeCursor,
  decodeCursor,
  clampLimit,
  buildConnection,
} from '../lib/pagination.js';

describe('pagination', () => {
  it('round-trips a cursor', () => {
    const cursor = encodeCursor(['2024-01-01T00:00:00.000Z', 42]);
    expect(decodeCursor(cursor)).toEqual(['2024-01-01T00:00:00.000Z', 42]);
  });

  it('returns null for a malformed cursor', () => {
    expect(decodeCursor('not-base64-json!!')).toBeNull();
  });

  it('clamps limits into [1, 100] with a default of 20', () => {
    expect(clampLimit(undefined)).toBe(20);
    expect(clampLimit(0)).toBe(20);
    expect(clampLimit(5)).toBe(5);
    expect(clampLimit(9999)).toBe(100);
  });

  it('builds a connection and detects the next page', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const conn = buildConnection(rows, 2, (n) => `cursor-${n.id}`);
    expect(conn.edges).toHaveLength(2);
    expect(conn.pageInfo.hasNextPage).toBe(true);
    expect(conn.pageInfo.endCursor).toBe('cursor-b');
  });

  it('reports no next page when rows fit the limit', () => {
    const rows = [{ id: 'a' }];
    const conn = buildConnection(rows, 2, (n) => `cursor-${n.id}`);
    expect(conn.pageInfo.hasNextPage).toBe(false);
  });
});
