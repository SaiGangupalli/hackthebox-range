"use client";
import { useEffect, useState } from "react";
import { pushProgress } from "./progressSync";

// Best quiz score per track, stored as { best, total } under `hhb_quiz_<slug>`.
// Written by the Quiz component, read by the home path and track headers.
const EVENT = "hhb-quiz-progress";
const key = (slug: string) => `hhb_quiz_${slug}`;
export type QuizScore = { best: number; total: number };

export function readQuiz(slug: string): QuizScore | null {
  try {
    const v = JSON.parse(localStorage.getItem(key(slug)) ?? "null") as QuizScore | null;
    if (v && typeof v.best === "number" && typeof v.total === "number") return v;
  } catch { /* storage blocked */ }
  return null;
}

// Keeps the best score only; a weaker retry never lowers it.
export function saveQuiz(slug: string, score: number, total: number) {
  const prev = readQuiz(slug);
  if (prev && prev.best >= score && prev.total === total) return;
  try { localStorage.setItem(key(slug), JSON.stringify({ best: score, total })); } catch { /* ignore */ }
  pushProgress("quiz", slug, { best: score, total });
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: slug })); } catch { /* no window */ }
}

export function useQuizProgress(slugs: string[]): Record<string, QuizScore | null> {
  const [state, setState] = useState<Record<string, QuizScore | null>>({});
  const ids = slugs.join("|");
  useEffect(() => {
    const read = () => setState(Object.fromEntries(ids.split("|").filter(Boolean).map((s) => [s, readQuiz(s)])));
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener(EVENT, read); window.removeEventListener("storage", read); };
  }, [ids]);
  return state;
}
