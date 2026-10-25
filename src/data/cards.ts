// Flashcards for spaced repetition (/review), built from content that already
// exists: every glossary term (term → definition) and every quiz question
// (question → answer and why). Ids are stable so saved review state survives
// content edits elsewhere in the file.
import { glossary } from "./glossary";
import { quiz } from "./quiz";
import { tracks } from "./tracks";
import { path } from "./path";

export type Card = { id: string; deck: string; kind: "term" | "question"; front: string; back: string; extra?: string; track?: string };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const cards: Card[] = [
  ...glossary.map((t): Card => ({ id: `g:${slug(t.term)}`, deck: t.cat, kind: "term", front: t.term, back: t.def, extra: t.eg, track: t.track })),
  ...path.flatMap((p) => (quiz[p.slug] ?? []).map((q, i): Card => ({ id: `q:${p.slug}:${i}`, deck: tracks[p.slug].title, kind: "question", front: q.q, back: q.right, extra: q.why, track: p.slug }))),
];

// A glossary category and a track can share a name (e.g. Cryptography); their
// cards then form one mixed deck.
export const decks: { name: string; kind: "term" | "question" | "mixed"; count: number }[] = [...new Set(cards.map((c) => c.deck))].map((name) => {
  const inDeck = cards.filter((c) => c.deck === name);
  const kinds = new Set(inDeck.map((c) => c.kind));
  return { name, kind: kinds.size > 1 ? "mixed" : inDeck[0].kind, count: inDeck.length };
});
