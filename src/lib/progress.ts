"use client";
import { useSyncExternalStore } from "react";
import { trackOrder } from "@/data/tracks";

// Tiny external store for "studied" track state, persisted to localStorage.
// Server snapshot is always empty so SSR and first client render agree; the
// real values load in a mount-time hydrate() call.
const KEY = "hhb_done";
const EMPTY: Record<string, boolean> = Object.freeze({});

let state: Record<string, boolean> = EMPTY;
let hydrated = false;
const subs = new Set<() => void>();

function emit() { subs.forEach((f) => f()); }

export function hydrateProgress() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { state = JSON.parse(raw); emit(); }
  } catch { /* storage blocked — stay empty */ }
}

export function toggleDone(id: string) {
  state = { ...state, [id]: !state[id] };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  emit();
}

function subscribe(cb: () => void) { subs.add(cb); return () => subs.delete(cb); }
function getSnapshot() { return state; }
function getServerSnapshot() { return EMPTY; }

export function useProgress() {
  const map = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const count = trackOrder.filter((id) => map[id]).length;
  return { map, count, total: trackOrder.length };
}
