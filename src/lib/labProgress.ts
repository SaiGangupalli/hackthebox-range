"use client";
import { useEffect, useState } from "react";
import { pushProgress } from "./progressSync";

// Lab objective progress, shared by the labs (which write it) and the home page
// and track headers (which read it). Each lab stores a boolean[] under
// `hhb_lab_<labId>`; its length is the number of objectives.
const EVENT = "hhb-lab-progress";
const key = (labId: string) => `hhb_lab_${labId}`;

export function readLab(labId: string): { done: number; total: number } {
  try {
    const raw = localStorage.getItem(key(labId));
    const arr = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(arr)) return { done: arr.filter(Boolean).length, total: arr.length };
  } catch { /* storage blocked */ }
  return { done: 0, total: 0 };
}

export function loadLab(labId: string, count: number): boolean[] {
  try {
    const arr = JSON.parse(localStorage.getItem(key(labId)) ?? "null") as unknown;
    if (Array.isArray(arr) && arr.length === count) return arr.map(Boolean);
  } catch { /* ignore */ }
  return Array.from({ length: count }, () => false);
}

export function saveLab(labId: string, done: boolean[]) {
  try { localStorage.setItem(key(labId), JSON.stringify(done)); } catch { /* ignore */ }
  pushProgress("lab", labId, done);
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: labId })); } catch { /* no window */ }
}

// Call `cb` whenever this lab's saved progress changes (e.g. after a sync).
export function onLabChange(labId: string, cb: () => void): () => void {
  const h = (e: Event) => { if ((e as CustomEvent).detail === labId) cb(); };
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}

// Live { done, total } for a set of labs; re-reads whenever any lab saves.
export function useLabProgress(labIds: string[]): Record<string, { done: number; total: number }> {
  const [state, setState] = useState<Record<string, { done: number; total: number }>>({});
  const ids = labIds.join("|");
  useEffect(() => {
    const read = () => setState(Object.fromEntries(ids.split("|").filter(Boolean).map((id) => [id, readLab(id)])));
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener(EVENT, read); window.removeEventListener("storage", read); };
  }, [ids]);
  return state;
}
