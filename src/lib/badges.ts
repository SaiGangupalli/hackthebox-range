import { challenges } from "@/data/challenges";
import { labMeta } from "@/data/labs";
import { quiz } from "@/data/quiz";
import { pathOrder } from "@/data/path";
import type { LearnSummary } from "./stats";

// Achievements, worked out from data we already store (solves, first bloods,
// hints, learning progress, team membership) — nothing extra to keep in sync.

export type BadgeInput = {
  solved: string[]; // challenge ids
  firstBloods: number;
  hinted: Set<string>; // challenge ids where a paid hint was opened
  learn: LearnSummary;
  inTeam: boolean;
};

export type Badge = { id: string; name: string; desc: string; icon: string; earned: boolean };

const cryptoIds = challenges.filter((c) => c.track === "Cryptography").map((c) => c.id);

const DEFS: { id: string; name: string; desc: string; icon: string; test: (i: BadgeInput) => boolean }[] = [
  { id: "on-path", name: "On the path", desc: "Complete your first track", icon: "shield", test: (i) => i.learn.tracks.size >= 1 },
  { id: "lab-rat", name: "Lab rat", desc: "Finish every objective in one lab", icon: "os", test: (i) => labMeta.some((l) => (i.learn.labs[l.id] ?? 0) >= l.objectives) },
  { id: "sharp-mind", name: "Sharp mind", desc: "Score full marks on any quiz", icon: "book", test: (i) => Object.entries(i.learn.quizzes).some(([s, b]) => b >= (quiz[s]?.length ?? Infinity)) },
  { id: "first-flag", name: "First flag", desc: "Solve any challenge", icon: "flag", test: (i) => i.solved.length >= 1 },
  { id: "team-player", name: "Team player", desc: "Join a team", icon: "network", test: (i) => i.inTeam },
  { id: "no-hints", name: "No hints needed", desc: "Solve 3 challenges without opening a paid hint for them", icon: "zap", test: (i) => i.solved.filter((c) => !i.hinted.has(c)).length >= 3 },
  { id: "first-blood", name: "First blood", desc: "Be the first player to solve a challenge", icon: "trophy", test: (i) => i.firstBloods >= 1 },
  { id: "decoder", name: "Decoder", desc: "Solve every Cryptography challenge", icon: "crypto", test: (i) => cryptoIds.length > 0 && cryptoIds.every((id) => i.solved.includes(id)) },
  { id: "lab-master", name: "Lab master", desc: "Finish every lab", icon: "tools", test: (i) => labMeta.every((l) => (i.learn.labs[l.id] ?? 0) >= l.objectives) },
  { id: "quiz-master", name: "Quiz master", desc: "Full marks on every quiz", icon: "llm", test: (i) => Object.keys(quiz).every((s) => (i.learn.quizzes[s] ?? -1) >= quiz[s].length) },
  { id: "pathfinder", name: "Pathfinder", desc: "Complete all nine tracks", icon: "ethics", test: (i) => pathOrder.every((s) => i.learn.tracks.has(s)) },
];

export function badgesFor(input: BadgeInput): Badge[] {
  return DEFS.map(({ test, ...d }) => ({ ...d, earned: test(input) }));
}
