// One place that knows every practice lab: its id, track and number of
// objectives. Used to compute max XP and to show lab progress on profiles.
import { shellLabs } from "./shellLabs";
import { splLabs } from "./splLabs";
import { packetLabs } from "./packetLabs";
import { sqlLabs } from "./sqlLabs";
import { promptLabs } from "./promptLabs";
import { cryptoLabs } from "./cryptoLabs";
import { drills, DOJO_ID } from "../drills";

export type LabMeta = { id: string; slug: string; title: string; objectives: number };

const sets: Record<string, { id: string; title: string; tasks: unknown[] }>[] = [shellLabs, splLabs, packetLabs, sqlLabs, promptLabs, cryptoLabs];

export const labMeta: LabMeta[] = [
  ...sets.flatMap((set) => Object.entries(set).map(([slug, lab]) => ({ id: lab.id, slug, title: lab.title, objectives: lab.tasks.length }))),
  // The command dojo counts like a lab: each drill is one objective.
  { id: DOJO_ID, slug: "commands", title: "Command practice", objectives: drills.length },
];

export const labById: Record<string, LabMeta> = Object.fromEntries(labMeta.map((l) => [l.id, l]));

// What the AI tutor may know about a lab: its intro and each objective's
// question and approach hint. Solutions are deliberately left out so the
// tutor can guide without being able to hand over the answer.
export type LabBrief = { id: string; slug: string; title: string; intro: string; objectives: { ask: string; hint: string }[] };

export const labBriefs: Record<string, LabBrief> = Object.fromEntries(
  sets.flatMap((set) =>
    Object.entries(set).map(([slug, lab]) => {
      const l = lab as unknown as { id: string; title: string; intro: string; tasks: { ask: string; hint: string }[] };
      return [l.id, { id: l.id, slug, title: l.title, intro: l.intro, objectives: l.tasks.map((t) => ({ ask: t.ask, hint: t.hint })) }];
    }),
  ),
);
