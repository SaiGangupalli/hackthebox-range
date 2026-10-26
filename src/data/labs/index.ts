// One place that knows every practice lab: its id, track and number of
// objectives. Used to compute max XP and to show lab progress on profiles.
import { shellLabs, type ShellLab } from "./shellLabs";
import { splLabs } from "./splLabs";
import { packetLabs } from "./packetLabs";
import { sqlLabs } from "./sqlLabs";
import { promptLabs } from "./promptLabs";
import { cryptoLabs } from "./cryptoLabs";
import { platformLabsByTrack } from "./platformLabs";
import { forensicsLabsByTrack } from "./forensicsLabs";
import { webLabsByTrack } from "./webLabs";
import { drills, DOJO_ID } from "../drills";

export type LabMeta = { id: string; slug: string; title: string; objectives: number };

type AnyLab = { id: string; title: string; intro?: string; tasks: { ask: string; hint: string }[] };

const sets: Record<string, AnyLab>[] = [shellLabs, splLabs, packetLabs, sqlLabs, promptLabs, cryptoLabs];

// Every track's extra shell labs (beyond its primary one), merged per track.
export const extraLabsByTrack: Record<string, ShellLab[]> = {};
for (const src of [platformLabsByTrack, forensicsLabsByTrack, webLabsByTrack]) {
  for (const [slug, labs] of Object.entries(src)) extraLabsByTrack[slug] = [...(extraLabsByTrack[slug] ?? []), ...labs];
}

// Primary labs are keyed by track slug; some tracks also have extra labs.
const entries: [slug: string, lab: AnyLab][] = [
  ...sets.flatMap((set) => Object.entries(set) as [string, AnyLab][]),
  ...Object.entries(extraLabsByTrack).flatMap(([slug, labs]) => labs.map((lab) => [slug, lab] as [string, AnyLab])),
];

export const labMeta: LabMeta[] = [
  ...entries.map(([slug, lab]) => ({ id: lab.id, slug, title: lab.title, objectives: lab.tasks.length })),
  // The command dojo counts like a lab: each drill is one objective.
  { id: DOJO_ID, slug: "commands", title: "Command practice", objectives: drills.length },
];

export const labById: Record<string, LabMeta> = Object.fromEntries(labMeta.map((l) => [l.id, l]));

// What the AI tutor may know about a lab: its intro and each objective's
// question and approach hint. Solutions are deliberately left out so the
// tutor can guide without being able to hand over the answer.
export type LabBrief = { id: string; slug: string; title: string; intro: string; objectives: { ask: string; hint: string }[] };

export const labBriefs: Record<string, LabBrief> = Object.fromEntries(
  entries.map(([slug, l]) => [l.id, { id: l.id, slug, title: l.title, intro: l.intro ?? "", objectives: l.tasks.map((t) => ({ ask: t.ask, hint: t.hint })) }]),
);
