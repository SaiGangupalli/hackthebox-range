// Sliding-window rate limits for sign-in, registration, flag submission and
// other write endpoints. Counters live in memory (per server process), like the
// AI limits — fine for a single-instance deployment; a multi-instance one would
// need a shared store (e.g. Redis) instead.
//
// Per-IP limits are deliberately generous: at an on-site event many players
// share one public IP (the load test in scripts/loadtest.mjs simulates that).
// Per-handle and per-player limits do the real work.

type Rule = { limit: number; windowMs: number };

const MIN = 60_000;
const num = (v: string | undefined, d: number) => Math.max(1, parseInt(v ?? "", 10) || d);

export const RULES = {
  loginFailPerHandle: { limit: num(process.env.RATE_LOGIN_FAILS_PER_HANDLE, 10), windowMs: 15 * MIN },
  loginFailPerIp: { limit: num(process.env.RATE_LOGIN_FAILS_PER_IP, 300), windowMs: 15 * MIN },
  registerPerIp: { limit: num(process.env.RATE_REGISTER_PER_IP, 300), windowMs: 60 * MIN },
  submitPerUser: { limit: 30, windowMs: 5 * MIN },
  submitPerChallenge: { limit: 10, windowMs: 5 * MIN },
  teamJoin: { limit: 10, windowMs: 10 * MIN },
  write: { limit: 60, windowMs: MIN }, // hints, votes, progress sync, exams, password changes
} satisfies Record<string, Rule>;

const hits = new Map<string, number[]>();
let lastSweep = Date.now();

function recent(key: string, windowMs: number, now: number): number[] {
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length) hits.set(key, list); else hits.delete(key);
  return list;
}

function sweep(now: number) {
  if (now - lastSweep < 5 * MIN) return;
  lastSweep = now;
  for (const [k, list] of hits) if (!list.length || now - list[list.length - 1] > 60 * MIN) hits.delete(k);
}

export type Verdict = { ok: boolean; retryAfter: number }; // retryAfter in seconds

// Is `key` currently over its limit? (Doesn't count as a use.)
export function check(key: string, rule: Rule): Verdict {
  const now = Date.now();
  const list = recent(key, rule.windowMs, now);
  if (list.length < rule.limit) return { ok: true, retryAfter: 0 };
  return { ok: false, retryAfter: Math.max(1, Math.ceil((rule.windowMs - (now - list[0])) / 1000)) };
}

// Record one use of `key`; refused (and not recorded) if already over the limit.
export function take(key: string, rule: Rule): Verdict {
  const now = Date.now();
  sweep(now);
  const v = check(key, rule);
  if (!v.ok) return v;
  hits.set(key, [...recent(key, rule.windowMs, now), now]);
  return v;
}

export function reset(key: string) {
  hits.delete(key);
}

// Best-effort client IP from X-Forwarded-For. Each proxy in front of the app
// appends the address it received the request from, so the trustworthy entry
// is the one TRUSTED_PROXY_HOPS from the right (default 1: one proxy or
// hosting platform). Entries further left were sent by the client and can be
// anything. Without any proxy, Next.js passes the client's own header through,
// so per-IP limits are a backstop, not the main defence.
const HOPS = Math.max(1, parseInt(process.env.TRUSTED_PROXY_HOPS ?? "", 10) || 1);

export function clientIp(source: Request | Headers | undefined | null, hops = HOPS): string {
  const h = source instanceof Headers ? source : source?.headers;
  const list = (h?.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const xff = list.length ? list[Math.max(0, list.length - hops)] : "";
  return xff || h?.get("x-real-ip")?.trim() || "local";
}

export const wait = (s: number) => (s < 90 ? `${s} seconds` : `${Math.ceil(s / 60)} minutes`);

export function tooMany(retryAfter: number, what = "requests") {
  return Response.json(
    { error: `Too many ${what} — please wait ${wait(retryAfter)} and try again.`, retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
