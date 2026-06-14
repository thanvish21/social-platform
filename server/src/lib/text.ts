/** Pure text utilities — no I/O, safe to unit test in isolation. */

/** Extract #hashtags from text, normalized lowercase, deduped. */
export function extractHashtags(content: string): string[] {
  const matches = content.match(/#([\p{L}0-9_]+)/gu) ?? [];
  const tags = matches.map((m) => m.slice(1).toLowerCase());
  return [...new Set(tags)];
}
