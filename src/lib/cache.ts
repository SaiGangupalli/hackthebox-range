// A few seconds of shared, in-memory caching for what every player loads at
// once during an event: the scoreboard, the activity feed, challenge stats.
// A burst of identical requests triggers one database read (concurrent callers
// share the same promise), and the result is reused until it expires. Failures
// aren't kept. One process only, like the rate limits (see the runbook).

type Entry = { at: number; value: Promise<unknown> };
const g = globalThis as unknown as { __hhbCache?: Map<string, Entry> };
const store = (g.__hhbCache ??= new Map());

export const SHARED_TTL_MS = 5_000;

export function cached<T>(key: string, load: () => Promise<T>, ttlMs = SHARED_TTL_MS): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load();
  store.set(key, { at: Date.now(), value });
  value.catch(() => { if (store.get(key)?.value === value) store.delete(key); });
  return value;
}

/** Drop cached results whose key starts with any of these, e.g. after an organizer bans a player. */
export function invalidate(...prefixes: string[]) {
  for (const k of store.keys()) if (prefixes.some((p) => k.startsWith(p))) store.delete(k);
}
