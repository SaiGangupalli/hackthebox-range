import { prisma } from "./db";
import { challenges, totalPoints } from "@/data/challenges";
import { quiz } from "@/data/quiz";
import { pathOrder } from "@/data/path";
import { labMeta, labById } from "@/data/labs";
import { xpFrom, rankFor, type RankInfo } from "./xp";
import { badgesFor } from "./badges";
import { tracks } from "@/data/tracks";
import { rangeCertById } from "@/data/certify";
import { siteOrDefault } from "./settings";
import { cached } from "./cache";

// Server-side player statistics: learning progress, CTF score, XP and rank.
// Learning progress is reported by the browser, so every value is clamped to
// what the content actually allows; challenge points only ever come from
// server-verified solves.

export const MAX = {
  objectives: labMeta.reduce((s, l) => s + l.objectives, 0),
  quizCorrect: Object.values(quiz).reduce((s, q) => s + q.length, 0),
  tracks: pathOrder.length,
  points: totalPoints,
};
export const MAX_XP = xpFrom({ objectives: MAX.objectives, quizCorrect: MAX.quizCorrect, tracks: MAX.tracks, challengePoints: MAX.points });

const challengeById = Object.fromEntries(challenges.map((c) => [c.id, c]));

type ProgressRow = { kind: string; key: string; data: unknown };

export type LearnSummary = {
  labs: Record<string, number>; // lab id → objectives done
  quizzes: Record<string, number>; // track slug → best score
  tracks: Set<string>; // completed track slugs
  objectives: number;
  quizCorrect: number;
};

export function summarize(rows: ProgressRow[]): LearnSummary {
  const labs: Record<string, number> = {};
  const quizzes: Record<string, number> = {};
  const tracks = new Set<string>();
  for (const r of rows) {
    const d = r.data as Record<string, unknown> | unknown[] | null;
    if (r.kind === "lab" && labById[r.key] && Array.isArray(d)) {
      labs[r.key] = Math.min(labById[r.key].objectives, d.filter(Boolean).length);
    } else if (r.kind === "quiz" && quiz[r.key] && d && !Array.isArray(d) && typeof d.best === "number") {
      quizzes[r.key] = Math.max(0, Math.min(quiz[r.key].length, Math.floor(d.best)));
    } else if (r.kind === "track" && pathOrder.includes(r.key) && d && !Array.isArray(d) && d.done === true) {
      tracks.add(r.key);
    }
  }
  const objectives = Object.values(labs).reduce((s, n) => s + n, 0);
  const quizCorrect = Object.values(quizzes).reduce((s, n) => s + n, 0);
  return { labs, quizzes, tracks, objectives, quizCorrect };
}

export type SolveRow = { userId: string; challengeId: string; points: number; createdAt: Date };
export type HintRow = { userId: string; challengeId: string; cost: number; createdAt: Date };

// CTF score: solved points minus paid hints. `until` (scoreboard freeze)
// ignores anything recorded after that moment.
export function score(solves: SolveRow[], hints: HintRow[], until?: Date | null) {
  const s = until ? solves.filter((x) => x.createdAt <= until) : solves;
  const h = until ? hints.filter((x) => x.createdAt <= until) : hints;
  const solved = s.filter((x) => challengeById[x.challengeId]);
  const gross = solved.reduce((sum, x) => sum + x.points, 0);
  const hintCost = h.reduce((sum, x) => sum + x.cost, 0);
  const last = solved.reduce<Date | null>((m, x) => (!m || x.createdAt > m ? x.createdAt : m), null);
  return { points: gross - hintCost, gross, hintCost, solved: solved.length, last };
}

export function xpAndRank(learn: LearnSummary, grossPoints: number): RankInfo {
  const xp = xpFrom({ objectives: learn.objectives, quizCorrect: learn.quizCorrect, tracks: learn.tracks.size, challengePoints: grossPoints });
  return rankFor(xp, MAX_XP);
}

const cutoffKey = (cutoff?: Date | null) => cutoff?.toISOString() ?? "live";

// Who solved each challenge first (respecting a freeze cutoff).
// Banned players never hold first blood. Shared for a few seconds (src/lib/cache.ts);
// `fresh` skips that, for exports.
export function firstSolvers(cutoff?: Date | null, fresh = false): Promise<Map<string, string>> {
  return fresh ? loadFirstSolvers(cutoff) : cached(`first:${cutoffKey(cutoff)}`, () => loadFirstSolvers(cutoff));
}

async function loadFirstSolvers(cutoff?: Date | null): Promise<Map<string, string>> {
  const { banned } = await siteOrDefault();
  const rows = await prisma.solve.findMany({
    where: { ...(cutoff ? { createdAt: { lte: cutoff } } : {}), userId: { notIn: banned } },
    select: { challengeId: true, user: { select: { handle: true } } },
    orderBy: { createdAt: "asc" },
  });
  const first = new Map<string, string>();
  for (const r of rows) if (!first.has(r.challengeId)) first.set(r.challengeId, r.user.handle);
  return first;
}

const SOLVE = { userId: true, challengeId: true, points: true, createdAt: true } as const;
const HINT = { userId: true, challengeId: true, cost: true, createdAt: true } as const;
const LEARN_KINDS = { in: ["lab", "quiz", "track"] }; // the progress rows summarize() reads

// Everything the profile page needs for one player. `cutoff` hides solves and
// hints after a scoreboard freeze (used when someone else views the profile).
// The player's rows are read side by side, by handle, rather than one
// relation after another: one database round trip instead of several.
export async function getProfile(handle: string, cutoff: Date | null = null) {
  const mine = { user: { handle } };
  const [found, solves, hints, progress, first] = await Promise.all([
    prisma.user.findUnique({ where: { handle }, select: { id: true, handle: true, createdAt: true, membership: { select: { team: { select: { name: true } } } } } }),
    prisma.solve.findMany({ where: { ...mine, ...(cutoff ? { createdAt: { lte: cutoff } } : {}) }, select: SOLVE, orderBy: { createdAt: "desc" } }),
    prisma.hintUnlock.findMany({ where: { ...mine, ...(cutoff ? { createdAt: { lte: cutoff } } : {}) }, select: HINT }),
    prisma.progress.findMany({ where: mine, select: { kind: true, key: true, data: true } }),
    firstSolvers(cutoff),
  ]);
  if (!found) return null;
  const user = { ...found, solves, hints, progress };
  const learn = summarize(user.progress);
  const sc = score(user.solves, user.hints);
  const solvedIds = user.solves.filter((s) => challengeById[s.challengeId]).map((s) => s.challengeId);
  const firstBloods = solvedIds.filter((id) => first.get(id) === user.handle);
  return {
    handle: user.handle,
    joined: user.createdAt,
    team: user.membership?.team.name ?? null,
    learn,
    score: sc,
    rank: xpAndRank(learn, sc.gross),
    solves: user.solves.filter((s) => challengeById[s.challengeId]).map((s) => ({ ...s, title: challengeById[s.challengeId].title, track: challengeById[s.challengeId].track })),
    hintsUsed: user.hints.length,
    firstBloods,
    badges: badgesFor({ solved: solvedIds, firstBloods: firstBloods.length, hinted: new Set(user.hints.map((h) => h.challengeId)), learn, inTeam: !!user.membership }),
    // Range certificates (server-issued rows, never synced from the browser).
    certs: user.progress
      .filter((r) => r.kind === "cert" && rangeCertById[r.key])
      .map((r) => {
        const d = r.data as { code: string; pct: number; issuedAt: string };
        const c = rangeCertById[r.key];
        return { id: c.id, code: d.code, name: c.name, short: c.code, level: c.level, icon: c.icon, pct: d.pct, issuedAt: d.issuedAt };
      })
      .sort((a, b) => (a.issuedAt < b.issuedAt ? -1 : 1)),
  };
}

// The header's rank chip: score and XP only (no badges, first bloods or
// certificates), in one round trip. Fetched on every page change.
export async function getRankSummary(handle: string) {
  const mine = { user: { handle } };
  const [user, solves, hints, progress] = await Promise.all([
    prisma.user.findUnique({ where: { handle }, select: { handle: true } }),
    prisma.solve.findMany({ where: mine, select: SOLVE }),
    prisma.hintUnlock.findMany({ where: mine, select: HINT }),
    prisma.progress.findMany({ where: { ...mine, kind: LEARN_KINDS }, select: { kind: true, key: true, data: true } }),
  ]);
  if (!user) return null;
  const sc = score(solves, hints);
  return { handle: user.handle, score: sc, rank: xpAndRank(summarize(progress), sc.gross) };
}

export type FeedItem =
  | { type: "solve"; handle: string; title: string; points: number; firstBlood: boolean; at: string }
  | { type: "track"; handle: string; title: string; at: string }
  | { type: "team"; handle: string; team: string; at: string };

// Recent community activity: solves (with first bloods), finished tracks and
// team joins. Solves after a freeze stay hidden until the event ends. The same
// for everyone, so it's shared for a few seconds (src/lib/cache.ts).
export function getFeed(cutoff: Date | null, limit = 20): Promise<FeedItem[]> {
  return cached(`feed:${limit}:${cutoffKey(cutoff)}`, () => loadFeed(cutoff, limit));
}

async function loadFeed(cutoff: Date | null, limit: number): Promise<FeedItem[]> {
  const { banned } = await siteOrDefault();
  const notBanned = { userId: { notIn: banned } };
  const [solves, done, joins, first] = await Promise.all([
    prisma.solve.findMany({ where: { ...(cutoff ? { createdAt: { lte: cutoff } } : {}), ...notBanned }, select: { challengeId: true, points: true, createdAt: true, user: { select: { handle: true } } }, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.progress.findMany({ where: { kind: "track", ...notBanned }, select: { key: true, data: true, updatedAt: true, user: { select: { handle: true } } }, orderBy: { updatedAt: "desc" }, take: limit }),
    prisma.teamMember.findMany({ where: notBanned, select: { joinedAt: true, user: { select: { handle: true } }, team: { select: { name: true } } }, orderBy: { joinedAt: "desc" }, take: limit }),
    firstSolvers(cutoff),
  ]);
  const items: FeedItem[] = [
    ...solves.filter((s) => challengeById[s.challengeId]).map((s) => ({
      type: "solve" as const, handle: s.user.handle, title: challengeById[s.challengeId].title, points: s.points,
      firstBlood: first.get(s.challengeId) === s.user.handle, at: s.createdAt.toISOString(),
    })),
    ...done.filter((d) => (d.data as { done?: boolean })?.done === true && tracks[d.key]).map((d) => ({
      type: "track" as const, handle: d.user.handle, title: tracks[d.key].title, at: d.updatedAt.toISOString(),
    })),
    ...joins.map((j) => ({ type: "team" as const, handle: j.user.handle, team: j.team.name, at: j.joinedAt.toISOString() })),
  ];
  return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
}

export type PlayerRow = {
  handle: string;
  team: string | null;
  points: number;
  solved: number;
  hintCost: number;
  last: Date | null;
  rank: RankInfo;
};
export type TeamRow = { name: string; members: string[]; points: number; solved: number; hintCost: number; last: Date | null };

// Scoreboard data. `cutoff` (the freeze moment) ignores solves and hints
// recorded later — including for ranks, so a rank change can't leak a late
// solve. Teams count each challenge once, at its first solve by any member.
// Everyone sees the same board, so it's shared for a few seconds
// (src/lib/cache.ts); `fresh` skips that, for exports.
export type Board = Awaited<ReturnType<typeof loadBoard>>;
export function getBoard(cutoff: Date | null, fresh = false): Promise<Board> {
  return fresh ? loadBoard(cutoff) : cached(`board:${cutoffKey(cutoff)}`, () => loadBoard(cutoff));
}

async function loadBoard(cutoff: Date | null) {
  const { banned } = await siteOrDefault();
  // Banned players drop off the board (and out of team totals). Each table is
  // read once, side by side, then grouped per player here.
  const notBanned = { userId: { notIn: banned } };
  const [rows, solves, hints, progress] = await Promise.all([
    prisma.user.findMany({ where: { id: { notIn: banned } }, select: { id: true, handle: true, membership: { select: { team: { select: { id: true, name: true } } } } } }),
    prisma.solve.findMany({ where: notBanned, select: SOLVE }),
    prisma.hintUnlock.findMany({ where: notBanned, select: HINT }),
    prisma.progress.findMany({ where: { ...notBanned, kind: LEARN_KINDS }, select: { userId: true, kind: true, key: true, data: true } }),
  ]);
  const byUser = <T extends { userId: string }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of list) { const a = m.get(r.userId); if (a) a.push(r); else m.set(r.userId, [r]); }
    return m;
  };
  const [solvesOf, hintsOf, progressOf] = [byUser(solves), byUser(hints), byUser(progress)];
  const users = rows.map((u) => ({ ...u, solves: solvesOf.get(u.id) ?? [], hints: hintsOf.get(u.id) ?? [], progress: progressOf.get(u.id) ?? [] }));

  const byPoints = <T extends { points: number; last: Date | null }>(a: T, b: T) =>
    b.points - a.points || (a.last?.getTime() ?? Infinity) - (b.last?.getTime() ?? Infinity);

  const players: PlayerRow[] = users
    .map((u) => {
      const sc = score(u.solves, u.hints, cutoff);
      return { handle: u.handle, team: u.membership?.team.name ?? null, points: sc.points, solved: sc.solved, hintCost: sc.hintCost, last: sc.last, rank: xpAndRank(summarize(u.progress), sc.gross) };
    })
    .filter((p) => p.solved > 0)
    .sort(byPoints);

  const teams = new Map<string, { name: string; members: string[]; first: Map<string, Date>; hintCost: number }>();
  for (const u of users) {
    const t = u.membership?.team;
    if (!t) continue;
    const row = teams.get(t.id) ?? { name: t.name, members: [] as string[], first: new Map<string, Date>(), hintCost: 0 };
    row.members.push(u.handle);
    for (const s of u.solves) {
      if (!challengeById[s.challengeId] || (cutoff && s.createdAt > cutoff)) continue;
      const prev = row.first.get(s.challengeId);
      if (!prev || s.createdAt < prev) row.first.set(s.challengeId, s.createdAt);
    }
    row.hintCost += u.hints.filter((h) => !cutoff || h.createdAt <= cutoff).reduce((sum, h) => sum + h.cost, 0);
    teams.set(t.id, row);
  }
  const teamRows: TeamRow[] = [...teams.values()]
    .map((t) => {
      const gross = [...t.first.keys()].reduce((sum, id) => sum + challengeById[id].points, 0);
      const last = [...t.first.values()].reduce<Date | null>((m, d) => (!m || d > m ? d : m), null);
      return { name: t.name, members: t.members.sort(), points: gross - t.hintCost, solved: t.first.size, hintCost: t.hintCost, last };
    })
    .sort(byPoints);

  return { players, teams: teamRows };
}
