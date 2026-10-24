// Per-player hourly limits for the AI features, so one person can't run up the
// API bill. In memory (per server process); tune with env vars:
//   AI_TUTOR_PER_HOUR      tutor messages per player per hour (default 30)
//   AI_QUESTIONS_PER_HOUR  generated quiz rounds per player per hour (default 6)

const HOUR = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

export const LIMITS = {
  tutor: Math.max(1, parseInt(process.env.AI_TUTOR_PER_HOUR ?? "30", 10) || 30),
  questions: Math.max(1, parseInt(process.env.AI_QUESTIONS_PER_HOUR ?? "6", 10) || 6),
};

// Records a use and reports whether it was allowed, plus minutes until the
// oldest use in the window expires (for a friendly "try again in N min").
export function takeToken(bucket: keyof typeof LIMITS, userId: string): { ok: boolean; retryMin: number; left: number } {
  const key = `${bucket}:${userId}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < HOUR);
  if (recent.length >= LIMITS[bucket]) {
    hits.set(key, recent);
    return { ok: false, retryMin: Math.max(1, Math.ceil((HOUR - (now - recent[0])) / 60000)), left: 0 };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryMin: 0, left: LIMITS[bucket] - recent.length };
}
