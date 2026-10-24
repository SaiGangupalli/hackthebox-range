"use client";
import { loadLab, saveLab } from "./labProgress";
import { saveQuiz, readQuiz } from "./quizProgress";
import { mergeTracks, resetTracks, doneTracks } from "./progress";

// Keeps learning progress (labs, quizzes, finished tracks) in sync with the
// signed-in player's account. Guests keep using localStorage only. On sign-in
// the server copy and the browser copy are merged; afterwards every change is
// pushed (batched). If a *different* player signs in on this browser, their
// server progress replaces what's stored locally instead of mixing the two.

type Item = { kind: "lab" | "quiz" | "track"; key: string; data: unknown };
const OWNER = "hhb_progress_owner";

let syncUser: string | null = null;
let starting: string | null = null;
const pending = new Map<string, Item>();
let timer: ReturnType<typeof setTimeout> | undefined;

export function pushProgress(kind: Item["kind"], key: string, data: unknown) {
  if (!syncUser) return;
  pending.set(`${kind}:${key}`, { kind, key, data });
  clearTimeout(timer);
  timer = setTimeout(flush, 600);
}

async function flush() {
  const items = [...pending.values()];
  pending.clear();
  if (!items.length || !syncUser) return;
  try {
    await fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
  } catch { /* offline — the next change retries with fresh data */ }
}

function localKeys(prefix: string): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) out.push(k.slice(prefix.length));
    }
  } catch { /* storage blocked */ }
  return out;
}

function clearLocal() {
  try { for (const k of [...localKeys("hhb_lab_").map((x) => "hhb_lab_" + x), ...localKeys("hhb_quiz_").map((x) => "hhb_quiz_" + x)]) localStorage.removeItem(k); } catch { /* ignore */ }
  resetTracks();
}

export async function startSync(userId: string) {
  if (syncUser === userId || starting === userId) return;
  starting = userId;
  try {
    const res = await fetch("/api/progress");
    if (!res.ok) return;
    const { items } = (await res.json()) as { items: Item[] };
    let owner: string | null = null;
    try { owner = localStorage.getItem(OWNER); } catch { /* ignore */ }
    if (owner && owner !== userId) clearLocal();

    // Merge the server copy into the browser (syncUser is still null, so these
    // saves don't echo back to the server yet).
    const tracks: string[] = [];
    for (const it of items) {
      if (it.kind === "lab" && Array.isArray(it.data)) {
        const local = loadLab(it.key, it.data.length);
        saveLab(it.key, local.map((d, i) => d || Boolean((it.data as unknown[])[i])));
      } else if (it.kind === "quiz") {
        const d = it.data as { best?: number; total?: number };
        if (typeof d?.best === "number" && typeof d?.total === "number") saveQuiz(it.key, d.best, d.total);
      } else if (it.kind === "track" && (it.data as { done?: boolean })?.done) {
        tracks.push(it.key);
      }
    }
    mergeTracks(tracks);
    try { localStorage.setItem(OWNER, userId); } catch { /* ignore */ }
    syncUser = userId;

    // Upload anything that only existed in this browser.
    for (const id of localKeys("hhb_lab_")) {
      try {
        const arr = JSON.parse(localStorage.getItem("hhb_lab_" + id) ?? "null");
        if (Array.isArray(arr)) pushProgress("lab", id, arr);
      } catch { /* skip bad entry */ }
    }
    for (const slug of localKeys("hhb_quiz_")) {
      const q = readQuiz(slug);
      if (q) pushProgress("quiz", slug, q);
    }
    for (const slug of doneTracks()) pushProgress("track", slug, { done: true });
  } catch { /* network error — stay local-only for now */ } finally {
    starting = null;
  }
}

export function stopSync() {
  syncUser = null;
  pending.clear();
}
