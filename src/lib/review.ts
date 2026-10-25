"use client";
import { useEffect, useState } from "react";

// Spaced repetition (a Leitner system): each card sits in a box 1–5. Getting it
// right moves it up a box and it comes back after a longer gap; getting it
// wrong sends it back to box 1. New cards are capped per day so reviews don't
// pile up. Saved in this browser.

export type CardState = { box: number; due: number; reviews: number; first: number }; // due/first = local day numbers
export type Grade = "again" | "hard" | "good" | "easy";

const KEY = "hhb_review";
const EVENT = "hhb-review";
export const GAP_DAYS = [0, 1, 3, 7, 16, 35]; // index = box
export const NEW_PER_DAY = 15;

export const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);

export function loadReview(): Record<string, CardState> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, CardState>; } catch { return {}; }
}

// When a card would come back for each answer, in days from today.
export function preview(prev: CardState | undefined): Record<Grade, number> {
  const up = (n: number) => GAP_DAYS[Math.min(5, (prev?.box ?? 1) + n)];
  if (!prev) return { again: 0, hard: 1, good: GAP_DAYS[2], easy: GAP_DAYS[3] };
  return { again: 0, hard: 1, good: up(1), easy: up(2) };
}

export function grade(id: string, g: Grade): CardState {
  const all = loadReview();
  const prev = all[id];
  const box = !prev ? (g === "easy" ? 3 : g === "again" ? 1 : 2) : g === "again" ? 1 : g === "hard" ? Math.max(1, prev.box) : Math.min(5, prev.box + (g === "easy" ? 2 : 1));
  const next: CardState = { box, due: today() + (g === "again" ? 0 : g === "hard" ? 1 : GAP_DAYS[box]), reviews: (prev?.reviews ?? 0) + 1, first: prev?.first ?? today() };
  all[id] = next;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage blocked */ }
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch { /* no window */ }
  return next;
}

// How many cards are waiting today: due reviews plus up to NEW_PER_DAY new ones.
export const newSeenToday = (state: Record<string, CardState>) => Object.values(state).filter((c) => c.first === today()).length;

export function countDue(ids: string[], state: Record<string, CardState>) {
  const t = today();
  const seen = newSeenToday(state);
  const due = ids.filter((id) => state[id] && state[id].due <= t).length;
  const fresh = ids.filter((id) => !state[id]).length;
  return { due, fresh: Math.min(fresh, Math.max(0, NEW_PER_DAY - seen)), learned: ids.filter((id) => (state[id]?.box ?? 0) >= 4).length };
}

export function useReviewState(): Record<string, CardState> {
  const [s, setS] = useState<Record<string, CardState>>({});
  useEffect(() => {
    const read = () => setS(loadReview());
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener(EVENT, read); window.removeEventListener("storage", read); };
  }, []);
  return s;
}
