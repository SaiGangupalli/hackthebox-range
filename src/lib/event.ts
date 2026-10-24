// Event mode for running the CTF as a timed competition. Configure with env vars
// (ISO 8601 with a timezone, e.g. 2026-11-07T09:00:00+05:30):
//   EVENT_START   flags are accepted from this moment
//   EVENT_END     flags are rejected after this moment; the final board is shown
//   EVENT_FREEZE  optional; from here until EVENT_END the scoreboard shows the
//                 standings as they were at the freeze, to keep the finish exciting
// With none set the range is in "practice" mode: always open, never frozen.

export type EventState = "practice" | "before" | "live" | "frozen" | "ended";
export type EventInfo = { state: EventState; start: string | null; end: string | null; freeze: string | null };

const parse = (v?: string) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

export function eventInfo(now = new Date()): EventInfo {
  const start = parse(process.env.EVENT_START);
  const end = parse(process.env.EVENT_END);
  const freeze = parse(process.env.EVENT_FREEZE);
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  let state: EventState = "practice";
  if (start || end) {
    if (start && now < start) state = "before";
    else if (end && now >= end) state = "ended";
    else if (freeze && now >= freeze) state = "frozen";
    else state = "live";
  }
  return { state, start: iso(start), end: iso(end), freeze: iso(freeze) };
}

export const acceptsFlags = (e: EventInfo) => e.state === "practice" || e.state === "live" || e.state === "frozen";

// The moment the public scoreboard stops counting, or null for "count everything".
export const boardCutoff = (e: EventInfo) => (e.state === "frozen" && e.freeze ? new Date(e.freeze) : null);
