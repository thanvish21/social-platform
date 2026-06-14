import { describe, it, expect } from 'vitest';
import { extractHashtags } from '../lib/text.js';

describe('extractHashtags', () => {
  it('pulls hashtags and lowercases them', () => {
    expect(extractHashtags('Loving #GraphQL and #TypeScript')).toEqual([
      'graphql',
      'typescript',
    ]);
  });

  it('dedupes repeated tags', () => {
    expect(extractHashtags('#dev #Dev #DEV')).toEqual(['dev']);
  });

  it('returns an empty array when there are no tags', () => {
    expect(extractHashtags('just a plain post')).toEqual([]);
  });

  it('handles underscores and digits', () => {
    expect(extractHashtags('#web3 #node_js')).toEqual(['web3', 'node_js']);
  });
});
