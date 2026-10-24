"use client";
import { useSyncExternalStore } from "react";
import { trackOrder } from "@/data/tracks";
import { pushProgress } from "./progressSync";

// Tiny external store for "completed" track state, persisted to localStorage
// (and to the player's account when signed in — see progressSync). Server
// snapshot is always empty so SSR and first client render agree; the real
// values load in a mount-time hydrate() call.
const KEY = "hhb_done";
const EMPTY: Record<string, boolean> = Object.freeze({});

let state: Record<string, boolean> = EMPTY;
let hydrated = false;
const subs = new Set<() => void>();

function emit() { subs.forEach((f) => f()); }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }

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
  persist();
  emit();
  pushProgress("track", id, { done: state[id] });
}

// Sync helpers: add tracks completed elsewhere, clear for a different player,
// and list what's done here.
export function mergeTracks(slugs: string[]) {
  hydrateProgress();
  if (!slugs.some((s) => !state[s])) return;
  state = { ...state, ...Object.fromEntries(slugs.map((s) => [s, true])) };
  persist();
  emit();
}

export function resetTracks() {
  hydrateProgress();
  state = EMPTY;
  persist();
  emit();
}

export function doneTracks(): string[] {
  hydrateProgress();
  return Object.keys(state).filter((k) => state[k]);
}

function subscribe(cb: () => void) { subs.add(cb); return () => subs.delete(cb); }
function getSnapshot() { return state; }
function getServerSnapshot() { return EMPTY; }

export function useProgress() {
  const map = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const count = trackOrder.filter((id) => map[id]).length;
  return { map, count, total: trackOrder.length };
}
