import { tracks } from "@/data/tracks";
import { learn, lessonId } from "@/data/learn";
import { glossary, termId } from "@/data/glossary";
import { owasp } from "@/data/owasp";
import { llm } from "@/data/llm";
import { labBriefs } from "@/data/labs";
import { pathIndex } from "@/data/path";
import type { StudyRef } from "@/data/certify";

// Turns a certification study-guide reference (src/data/certify.ts) into a
// link. Returns null when it points at nothing — a lesson question that was
// reworded, a glossary term that was renamed — and the tests fail on that.

export type StudyLink = { kind: "Lesson" | "Lab" | "Glossary" | "OWASP" | "Page"; label: string; where?: string; href: string };

export function studyLink(r: StudyRef): StudyLink | null {
  if ("lesson" in r) {
    if (!learn[r.track]?.cards.some((c) => c.q === r.lesson)) return null;
    return { kind: "Lesson", label: r.lesson, where: tracks[r.track].title, href: `/tracks/${r.track}#${lessonId(r.lesson)}` };
  }
  if ("lab" in r) {
    const brief = pathIndex[r.lab] && labBriefs[pathIndex[r.lab].labId];
    if (!brief) return null;
    return { kind: "Lab", label: brief.title.replace(/^Lab · /, ""), where: tracks[r.lab].title, href: `/tracks/${r.lab}#practice` };
  }
  if ("term" in r) {
    return glossary.some((t) => t.term === r.term) ? { kind: "Glossary", label: r.term, href: `/glossary#${termId(r.term)}` } : null;
  }
  if ("risk" in r) {
    const isLlm = r.risk.startsWith("LLM");
    const x = (isLlm ? llm : owasp).find((o) => o.c === r.risk);
    return x ? { kind: "OWASP", label: `${x.c} ${x.n}`, href: `/${isLlm ? "llm" : "owasp"}#${x.c}` } : null;
  }
  return { kind: "Page", label: r.label, href: r.page };
}
