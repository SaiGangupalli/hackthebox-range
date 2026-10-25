// Event mode for running the CTF as a timed competition. Times are set in the
// organizer console (/admin), or as env vars (ISO 8601 with a timezone, e.g.
// 2026-11-07T09:00:00+05:30); times set in the console win:
//   EVENT_START   flags are accepted from this moment
//   EVENT_END     flags are rejected after this moment; the final board is shown
//   EVENT_FREEZE  optional; from here until EVENT_END the scoreboard shows the
//                 standings as they were at the freeze, to keep the finish exciting
// With none set the range is in "practice" mode: always open, never frozen.
// Server code gets the current state from getEvent() in settings.ts.

export type EventState = "practice" | "before" | "live" | "frozen" | "ended";
export type EventInfo = { state: EventState; start: string | null; end: string | null; freeze: string | null };
export type EventTimes = { start: string | null; end: string | null; freeze: string | null };

export const envTimes = (): EventTimes => ({
  start: process.env.EVENT_START || null,
  end: process.env.EVENT_END || null,
  freeze: process.env.EVENT_FREEZE || null,
});

const parse = (v?: string | null) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

export function eventInfo(now = new Date(), times: EventTimes = envTimes()): EventInfo {
  const start = parse(times.start);
  const end = parse(times.end);
  const freeze = parse(times.freeze);
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

// Checks times an organizer entered; returns a message for the first problem.
export function timesProblem(t: EventTimes): string | null {
  const [start, end, freeze] = [t.start, t.end, t.freeze].map(parse);
  if ((t.start && !start) || (t.end && !end) || (t.freeze && !freeze)) return "One of the times isn't a valid date.";
  if (start && end && end <= start) return "The end must be after the start.";
  if (freeze && !end) return "Set an end time to use a scoreboard freeze.";
  if (freeze && end && freeze >= end) return "The freeze must be before the end.";
  if (freeze && start && freeze <= start) return "The freeze must be after the start.";
  return null;
}

export const acceptsFlags = (e: EventInfo) => e.state === "practice" || e.state === "live" || e.state === "frozen";

// The moment the public scoreboard stops counting, or null for "count everything".
export const boardCutoff = (e: EventInfo) => (e.state === "frozen" && e.freeze ? new Date(e.freeze) : null);
