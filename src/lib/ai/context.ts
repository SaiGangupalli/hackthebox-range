import { tracks } from "@/data/tracks";
import { learn } from "@/data/learn";
import { path, pathIndex, pathOrder } from "@/data/path";
import { owasp } from "@/data/owasp";
import { llm } from "@/data/llm";
import { labBriefs } from "@/data/labs";

// What the AI tutor knows. TUTOR_RULES never changes, so it can be prompt-cached;
// pageContext() adds the content of the page the learner is on. Lab solutions,
// challenge flags and writeups are never included.

export const TUTOR_RULES = `You are the tutor inside H@ck1h3B0x Range, a defensive-security training site for a capture-the-flag (CTF) event at the VICS Security Conclave.

Who you're helping: learners who may have no security background. Explain in plain English first, then add detail. Define jargon the first time you use it. Use short paragraphs, small concrete examples and everyday analogies. Keep answers focused — usually under 200 words — unless the learner asks for more depth.

How to teach:
- Aim for understanding, not just answers. When you explain how an attack works, also explain how defenders detect and prevent it.
- For lab objectives and CTF challenges, give hints and guide the learner's thinking one step at a time. Never state a final answer or a flag outright, even if asked — encourage them to try the next step themselves.
- Everything here is for authorized practice: this site's in-browser simulators, CTF platforms, or systems the learner owns or has written permission to test. If someone asks for help against a system they don't control, decline briefly and point them to legal practice platforms.
- Don't write malware, working exploits for real software, phishing material or anything designed to cause harm. Conceptual explanations and defensive guidance are fine.
- If you're not sure about something, say so rather than guessing.

Formatting: Markdown is supported. Use \`inline code\` for commands, file names and values, short bullet lists, and fenced code blocks for multi-line commands. Don't use headings larger than ###.`;

function trackContext(slug: string): string {
  const t = tracks[slug];
  const p = pathIndex[slug];
  const l = learn[slug];
  const lab = p ? labBriefs[p.labId] : undefined;
  const lines: string[] = [
    `The learner is on the "${t.title}" track (${t.tag}; ${p?.level ?? ""}, about ${p?.minutes ?? "?"} minutes; step ${pathOrder.indexOf(slug) + 1} of ${pathOrder.length} in the learning path).`,
    `Overview: ${t.blurb}`,
  ];
  if (p) lines.push(`After this track a learner should be able to: ${p.outcomes.join("; ")}.`);
  if (l) {
    lines.push("", "Beginner concepts shown on the page:");
    for (const c of l.cards) {
      lines.push(`- ${c.q} ${c.a}`);
      if (c.worked) lines.push(`  Example: ${c.worked.input} → ${c.worked.output.replace(/\n/g, " / ")} — ${c.worked.read}`);
    }
  }
  lines.push("", "Quick-reference commands on the page:");
  for (const sh of t.sheets) for (const r of sh.rows) lines.push(`- [${sh.title}] \`${r.code}\` — ${r.note}`);
  lines.push("", `Tools professionals use: ${t.tools.join(", ")}.`, `Defenses: ${t.defend.join("; ")}.`);
  if (lab) {
    lines.push("", `The track's practice lab, "${lab.title}": ${lab.intro}`, "Its objectives (the site checks answers; you guide, never answer):");
    lab.objectives.forEach((o, i) => lines.push(`${i + 1}. ${o.ask} (approach hint: ${o.hint})`));
  }
  return lines.join("\n");
}

function riskContext(title: string, list: typeof owasp): string {
  return [`The learner is reading the ${title} page. The risks:`, ...list.map((r) => `- ${r.c} ${r.n}: ${r.how} Defense: ${r.fix}`)].join("\n");
}

function siteContext(): string {
  return [
    "The learner is browsing the site (not a specific track). The learning path, in order:",
    ...path.map((p, i) => `${i + 1}. ${tracks[p.slug].title} (${p.level}) — ${p.why}`),
    "Other pages: OWASP Web Top 10, OWASP LLM Top 10, Quizzes, Challenges (CTF flags), Certifications (Range certificates earned by finishing tracks and passing a timed exam, plus a guide to industry certifications such as Security+, CySA+, CKA/CKS, cloud security and AI security), Scoreboard, Teams, Lab tools (in-browser encoders, hashing, JWT decoder, steganography demo), Command handbook and command practice, Glossary, Cheatsheet (PDF).",
    "Never reveal or hint at answers to certification exam questions; help with the underlying topics instead.",
  ].join("\n");
}

// `page` is the pathname the learner is on; only known pages get specific context.
export function pageContext(page: string | undefined): { key: string; text: string; track: string | null } {
  const m = /^\/tracks\/([a-z]+)/.exec(page ?? "");
  if (m && tracks[m[1]]) return { key: `track:${m[1]}`, text: trackContext(m[1]), track: m[1] };
  if (page === "/owasp") return { key: "owasp", text: riskContext("OWASP Web Top 10", owasp), track: null };
  if (page === "/llm") return { key: "llm", text: riskContext("OWASP LLM Top 10", llm), track: null };
  return { key: "site", text: siteContext(), track: null };
}

// A short summary of a track, for prompts that cover many tracks at once.
export function trackBrief(slug: string): string {
  const t = tracks[slug];
  const p = pathIndex[slug];
  const l = learn[slug];
  return [
    `${t.title} (${t.tag}; ${p?.level ?? "Beginner"}): ${t.blurb}`,
    p ? `Outcomes: ${p.outcomes.join("; ")}.` : "",
    l ? `Concepts: ${l.cards.map((c) => c.q).join(" ")}` : "",
    `Tools: ${t.tools.join(", ")}. Defenses: ${t.defend.join("; ")}.`,
  ].filter(Boolean).join("\n");
}

export function trackSlugContext(slug: string): string {
  return tracks[slug] ? trackContext(slug) : siteContext();
}
