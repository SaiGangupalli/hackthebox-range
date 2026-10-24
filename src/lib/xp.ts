// XP and rank rules, shared by the profile page, scoreboard and header.
// XP rewards learning (labs, quizzes, finished tracks) as well as solved
// challenges. Rank thresholds are fractions of the maximum XP the site offers,
// so ranks keep working as content is added; "Omniscient" means everything done.

export const XP_RULES = {
  objective: 10, // per lab objective completed
  quizCorrect: 5, // per question in your best quiz score
  track: 25, // per track marked complete
  // challenges give their point value as XP
};

export const RANKS: { name: string; at: number }[] = [
  { name: "Noob", at: 0 },
  { name: "Script Kiddie", at: 0.06 },
  { name: "Hacker", at: 0.18 },
  { name: "Pro Hacker", at: 0.36 },
  { name: "Elite Hacker", at: 0.6 },
  { name: "Guru", at: 0.85 },
  { name: "Omniscient", at: 1 },
];

export type XpParts = { objectives: number; quizCorrect: number; tracks: number; challengePoints: number };

export function xpFrom(p: XpParts): number {
  return p.objectives * XP_RULES.objective + p.quizCorrect * XP_RULES.quizCorrect + p.tracks * XP_RULES.track + p.challengePoints;
}

export type RankInfo = {
  name: string;
  level: number; // 1-based position in RANKS
  xp: number;
  max: number;
  next: { name: string; xp: number } | null; // XP needed for the next rank
  pct: number; // progress from this rank to the next, 0–100
};

export function rankFor(xp: number, max: number): RankInfo {
  const need = (i: number) => Math.ceil(RANKS[i].at * max);
  let i = 0;
  while (i + 1 < RANKS.length && xp >= need(i + 1)) i++;
  const next = i + 1 < RANKS.length ? { name: RANKS[i + 1].name, xp: need(i + 1) } : null;
  const pct = next ? Math.max(0, Math.min(100, ((xp - need(i)) / (next.xp - need(i))) * 100)) : 100;
  return { name: RANKS[i].name, level: i + 1, xp, max, next, pct };
}
