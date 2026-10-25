#!/usr/bin/env node
// Event-day load test. Simulates a room of players arriving at once, all from
// one network address (as at a venue behind one Wi-Fi router): each one
// registers, signs in, opens the challenges and scoreboard, submits a few wrong
// flags and the warm-up flag.
//
//   npm run loadtest -- --url http://localhost:3004 --players 150 --ramp 30
//   npm run loadtest -- --cleanup        delete test accounts left by earlier runs
//
// Test accounts are named zz_load_<run>_<n>. They only solve the warm-up
// challenge and are deleted when the run ends (unless --keep). Run it before
// the event, not during: the server's rate-limit counters for this machine's
// address stay filled for up to an hour (restart the server to clear them).

import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";

const { values: opt } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3003" },
    players: { type: "string", default: "100" },
    ramp: { type: "string", default: "20" }, // seconds over which players arrive
    keep: { type: "boolean", default: false },
    cleanup: { type: "boolean", default: false },
  },
});

const HANDLE_RE = /^zz_load_[a-z0-9]{4}_\d+$/;
const WARMUP = { id: "intro-01", flag: "HHB{r3ady_s3t_h4ck}" }; // printed in the challenge itself

async function cleanup() {
  try { process.loadEnvFile(".env.local"); } catch { /* DATABASE_URL may already be set */ }
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({ where: { handle: { startsWith: "zz_load_" } }, select: { id: true, handle: true } });
    const ids = users.filter((u) => HANDLE_RE.test(u.handle)).map((u) => u.id);
    const { count } = await prisma.user.deleteMany({ where: { id: { in: ids } } });
    console.log(`Deleted ${count} test account${count === 1 ? "" : "s"}.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (opt.cleanup) {
  await cleanup();
  process.exit(0);
}

const base = opt.url.replace(/\/$/, "");
const players = Math.max(1, parseInt(opt.players, 10) || 100);
const ramp = Math.max(0, parseFloat(opt.ramp) || 0);
const run = randomBytes(2).toString("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// step → list of { ms, outcome } where outcome is ok | limited | failed
const results = new Map();
const record = (step, ms, outcome) => {
  if (!results.has(step)) results.set(step, []);
  results.get(step).push({ ms, outcome });
};

async function call(step, jar, path, { method = "GET", json, form } = {}) {
  const headers = { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") };
  let body;
  if (json) { headers["content-type"] = "application/json"; body = JSON.stringify(json); }
  if (form) { headers["content-type"] = "application/x-www-form-urlencoded"; body = new URLSearchParams(form).toString(); }
  const t0 = performance.now();
  try {
    const res = await fetch(base + path, { method, headers, body, redirect: "manual" });
    const text = await res.text();
    const ms = performance.now() - t0;
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    const location = res.headers.get("location") ?? "";
    const limited = res.status === 429 || location.includes("code=rate_limited");
    const failed = res.status >= 500 || (res.status >= 400 && !limited) || location.includes("error=");
    record(step, ms, limited ? "limited" : failed ? "failed" : "ok");
    return { status: res.status, text, location, ok: !limited && !failed };
  } catch (e) {
    record(step, performance.now() - t0, "failed");
    return { status: 0, text: String(e), location: "", ok: false };
  }
}

let finished = 0;

async function player(i) {
  await sleep((ramp * 1000 * i) / players);
  const jar = new Map();
  const handle = `zz_load_${run}_${i}`;
  const password = `load-${run}-pw-${i}`;

  if (!(await call("register", jar, "/api/register", { method: "POST", json: { handle, password } })).ok) return;

  const csrf = await call("sign-in: csrf token", jar, "/api/auth/csrf");
  if (!csrf.ok) return;
  const { csrfToken } = JSON.parse(csrf.text);
  const signIn = await call("sign-in", jar, "/api/auth/callback/credentials", {
    method: "POST",
    form: { handle, password, csrfToken, callbackUrl: `${base}/challenges` },
  });
  if (!signIn.ok || !jar.has("hhb.session-token")) return;

  await call("page: /challenges", jar, "/challenges");
  await call("api: /api/me", jar, "/api/me");
  for (let k = 0; k < 3; k++) {
    await call("submit: wrong flag", jar, "/api/submit", { method: "POST", json: { challengeId: WARMUP.id, flag: `HHB{guess_${k}}` } });
  }
  const right = await call("submit: warm-up flag", jar, "/api/submit", { method: "POST", json: { challengeId: WARMUP.id, flag: WARMUP.flag } });
  if (right.ok && !JSON.parse(right.text).correct) record("submit: warm-up flag (marked wrong!)", 0, "failed");
  await call("page: /scoreboard", jar, "/scoreboard");
  await call("api: /api/feed", jar, "/api/feed");
  finished++;
}

const pct = (list, p) => {
  if (!list.length) return 0;
  const s = [...list].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

console.log(`Load test: ${players} players arriving over ${ramp}s against ${base} (run ${run})`);
const t0 = performance.now();
await Promise.all(Array.from({ length: players }, (_, i) => player(i)));
const secs = (performance.now() - t0) / 1000;

const rows = [...results].map(([step, list]) => {
  const ms = list.map((r) => r.ms);
  const n = (o) => list.filter((r) => r.outcome === o).length;
  return { step, requests: list.length, ok: n("ok"), limited: n("limited"), failed: n("failed"), "p50 ms": Math.round(pct(ms, 50)), "p95 ms": Math.round(pct(ms, 95)), "max ms": Math.round(Math.max(...ms)) };
});
console.table(rows);
const total = rows.reduce((s, r) => s + r.requests, 0);
console.log(`${finished}/${players} players got all the way through. ${total} requests in ${secs.toFixed(1)}s (${(total / secs).toFixed(1)} req/s).`);

if (!opt.keep) await cleanup();
