// Range certification exams, server-side. Requirements are checked from the
// player's synced progress and verified solves; questions are drawn at random
// from the bank, graded here, and a pass issues a certificate code anyone can
// verify at /cert/<code>. Attempts and certificates are stored as server-only
// rows in hhb_progress (kinds "exam" and "cert"); /api/progress never accepts
// those kinds from the browser.

import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { rangeCerts, rangeCertById, type RangeCert } from "@/data/certify";
import { tracks } from "@/data/tracks";
import { labById } from "@/data/labs";
import { summarize, type LearnSummary } from "@/lib/stats";
import { bank, type ExamQ } from "./bank";

export const RETRY_MINUTES = Math.max(0, Number(process.env.CERT_RETRY_MINUTES ?? 30) || 0);
const GRACE_MS = 60_000; // network slack after the timer ends

export type ReqItem = { label: string; met: boolean; href?: string };
export type CertRecord = { code: string; score: number; total: number; pct: number; issuedAt: string };
export type CertStatus = {
  id: string;
  reqs: ReqItem[];
  ready: boolean;
  earned: CertRecord | null;
  inProgress: { deadline: number } | null;
  retryAt: number | null;
  attempts: number;
  best: number | null;
};
export type PublicQ = { id: string; q: string; options: string[] };

type ExamState = { qids?: string[]; startedAt?: number; deadline?: number; attempts?: number; best?: number; lastPct?: number; lastFailAt?: number };
type Fail = { ok: false; status: number; error: string; retryAt?: number };

const byId: Record<string, ExamQ> = Object.fromEntries(Object.values(bank).flat().map((q) => [q.id, q]));
const clean = <T,>(o: T) => JSON.parse(JSON.stringify(o)) as T; // drop undefined fields before storing JSON

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = randomInt(i + 1); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I
const chunk = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
export const CODE_RE = /^HHB-[A-Z]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

function requirementItems(c: RangeCert, learn: LearnSummary, solves: number, earned: Map<string, CertRecord>): ReqItem[] {
  const r = c.requires;
  const items: ReqItem[] = [];
  for (const id of r.certs ?? []) items.push({ label: `Earn ${rangeCertById[id].code} — ${rangeCertById[id].name}`, met: earned.has(id), href: `/certify/${id}` });
  for (const s of r.tracks ?? []) items.push({ label: `Finish the ${tracks[s].title} track (mark it complete)`, met: learn.tracks.has(s), href: `/tracks/${s}` });
  if (r.anyTracks) {
    const done = r.anyTracks.of.filter((s) => learn.tracks.has(s)).length;
    items.push({ label: `Finish any ${r.anyTracks.n} of the ${r.anyTracks.of.length} beginner & intermediate CTF tracks (${Math.min(done, r.anyTracks.n)}/${r.anyTracks.n})`, met: done >= r.anyTracks.n, href: "/" });
  }
  for (const id of r.labs ?? []) {
    const lab = labById[id];
    const got = learn.labs[id] ?? 0;
    items.push({ label: `Complete every objective in “${lab.title.replace(/^Lab · /, "")}” (${got}/${lab.objectives})`, met: got >= lab.objectives, href: `/tracks/${lab.slug}#practice` });
  }
  if (r.solves) items.push({ label: `Solve ${r.solves} CTF challenges (${Math.min(solves, r.solves)}/${r.solves})`, met: solves >= r.solves, href: "/challenges" });
  return items;
}

// Requirements as a signed-out visitor sees them (nothing met yet).
export function guestRequirements(c: RangeCert): ReqItem[] {
  const empty: LearnSummary = { labs: {}, quizzes: {}, tracks: new Set(), objectives: 0, quizCorrect: 0 };
  return requirementItems(c, empty, 0, new Map());
}

// Every certification's requirements and exam state for one player.
export async function certStatus(uid: string): Promise<Record<string, CertStatus>> {
  const [rows, solves] = await Promise.all([
    prisma.progress.findMany({ where: { userId: uid }, select: { kind: true, key: true, data: true } }),
    prisma.solve.count({ where: { userId: uid } }),
  ]);
  const learn = summarize(rows);
  const exams = new Map(rows.filter((r) => r.kind === "exam").map((r) => [r.key, (r.data ?? {}) as ExamState]));
  const earned = new Map(rows.filter((r) => r.kind === "cert").map((r) => [r.key, r.data as CertRecord]));
  const now = Date.now();
  const out: Record<string, CertStatus> = {};
  for (const c of rangeCerts) {
    const reqs = requirementItems(c, learn, solves, earned);
    const st = exams.get(c.id) ?? {};
    const live = st.qids && st.deadline && now <= st.deadline + GRACE_MS;
    const expired = st.qids && st.deadline && now > st.deadline + GRACE_MS; // abandoned attempt counts as a fail
    const failAt = expired ? st.deadline! : st.lastFailAt;
    const retryAt = failAt && now < failAt + RETRY_MINUTES * 60_000 ? failAt + RETRY_MINUTES * 60_000 : null;
    out[c.id] = {
      id: c.id,
      reqs,
      ready: reqs.every((x) => x.met),
      earned: earned.get(c.id) ?? null,
      inProgress: live ? { deadline: st.deadline! } : null,
      retryAt,
      attempts: (st.attempts ?? 0) + (expired ? 1 : 0),
      best: st.best ?? null,
    };
  }
  return out;
}

const publicQs = (qids: string[]): PublicQ[] =>
  qids.map((id) => byId[id]).filter(Boolean).map((q) => ({ id: q.id, q: q.q, options: shuffle([q.right, ...q.wrong]) }));

async function examRow(uid: string, certId: string): Promise<ExamState> {
  const row = await prisma.progress.findUnique({ where: { userId_kind_key: { userId: uid, kind: "exam", key: certId } }, select: { data: true } });
  return ((row?.data ?? {}) as ExamState) || {};
}

async function saveExam(uid: string, certId: string, state: ExamState) {
  const data = clean(state) as object;
  await prisma.progress.upsert({
    where: { userId_kind_key: { userId: uid, kind: "exam", key: certId } },
    create: { userId: uid, kind: "exam", key: certId, data },
    update: { data },
  });
}

// Start an attempt, or resume the one already running (same questions, same deadline).
export async function startExam(uid: string, certId: string): Promise<{ ok: true; questions: PublicQ[]; deadline: number; now: number } | Fail> {
  const cert = rangeCertById[certId];
  if (!cert || !bank[certId]) return { ok: false, status: 404, error: "Unknown certification." };
  const status = (await certStatus(uid))[certId];
  if (status.earned) return { ok: false, status: 409, error: "You already hold this certification." };
  if (!status.ready) return { ok: false, status: 403, error: "Finish the requirements first — they're listed on this page." };

  let state = await examRow(uid, certId);
  const now = Date.now();
  if (state.qids && state.deadline && now <= state.deadline + GRACE_MS) {
    return { ok: true, questions: publicQs(state.qids), deadline: state.deadline, now };
  }
  if (state.qids && state.deadline) {
    // The last attempt ran out without being submitted: record it as a fail.
    state = { attempts: (state.attempts ?? 0) + 1, best: state.best, lastPct: 0, lastFailAt: state.deadline };
  }
  if (state.lastFailAt && now < state.lastFailAt + RETRY_MINUTES * 60_000) {
    const retryAt = state.lastFailAt + RETRY_MINUTES * 60_000;
    await saveExam(uid, certId, state);
    return { ok: false, status: 429, error: "Take a short break and review before retrying.", retryAt };
  }
  const qids = shuffle(bank[certId].map((q) => q.id)).slice(0, cert.exam.questions);
  const deadline = now + cert.exam.minutes * 60_000;
  await saveExam(uid, certId, { ...state, qids, startedAt: now, deadline });
  return { ok: true, questions: publicQs(qids), deadline, now };
}

export type ExamResult = {
  ok: true;
  score: number;
  total: number;
  pct: number;
  pass: number;
  passed: boolean;
  late: boolean;
  topics: { topic: string; correct: number; total: number }[];
  review: { q: string; right: string; yours: string | null; why: string }[] | null; // full review only after passing
  code: string | null;
  retryAt: number | null;
};

export async function submitExam(uid: string, certId: string, answers: Record<string, unknown>): Promise<ExamResult | Fail> {
  const cert = rangeCertById[certId];
  if (!cert || !bank[certId]) return { ok: false, status: 404, error: "Unknown certification." };
  const state = await examRow(uid, certId);
  if (!state.qids || !state.deadline) return { ok: false, status: 409, error: "No exam in progress — start it again from this page." };

  const now = Date.now();
  const late = now > state.deadline + GRACE_MS;
  const qs = state.qids.map((id) => byId[id]).filter(Boolean);
  const topics = new Map<string, { correct: number; total: number }>();
  let score = 0;
  for (const q of qs) {
    const t = topics.get(q.topic) ?? { correct: 0, total: 0 };
    t.total++;
    if (!late && answers[q.id] === q.right) { score++; t.correct++; }
    topics.set(q.topic, t);
  }
  const total = qs.length;
  const pct = Math.round((score / Math.max(1, total)) * 100);
  const passed = !late && pct >= cert.exam.pass;
  const best = Math.max(state.best ?? 0, pct);

  let code: string | null = null;
  if (passed) {
    const record: CertRecord = { code: `HHB-${cert.code}-${chunk()}-${chunk()}`, score, total, pct, issuedAt: new Date(now).toISOString() };
    // update: {} keeps the first certificate if two submits race.
    const row = await prisma.progress.upsert({
      where: { userId_kind_key: { userId: uid, kind: "cert", key: certId } },
      create: { userId: uid, kind: "cert", key: certId, data: record as object },
      update: {},
      select: { data: true },
    });
    code = (row.data as CertRecord).code;
  }
  await saveExam(uid, certId, { attempts: (state.attempts ?? 0) + 1, best, lastPct: pct, lastFailAt: passed ? undefined : now });

  return {
    ok: true,
    score, total, pct, pass: cert.exam.pass, passed, late,
    topics: [...topics].map(([topic, t]) => ({ topic, ...t })).sort((a, b) => a.correct / a.total - b.correct / b.total),
    review: passed ? qs.map((q) => ({ q: q.q, right: q.right, yours: typeof answers[q.id] === "string" ? (answers[q.id] as string) : null, why: q.why })) : null,
    code,
    retryAt: passed ? null : now + RETRY_MINUTES * 60_000,
  };
}

// Public verification by certificate code.
export async function findCertificate(code: string) {
  if (!CODE_RE.test(code)) return null;
  const row = await prisma.progress.findFirst({
    where: { kind: "cert", data: { path: ["code"], equals: code } },
    select: { key: true, data: true, user: { select: { handle: true } } },
  });
  if (!row || !rangeCertById[row.key]) return null;
  return { cert: rangeCertById[row.key], record: row.data as CertRecord, handle: row.user.handle };
}
