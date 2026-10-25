import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// review.ts reads localStorage and dispatches a window event; give it simple stand-ins.
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  window: { dispatchEvent: () => true },
  CustomEvent: class { type: string; constructor(type: string) { this.type = type; } },
});
const { grade, loadReview, countDue, preview, today, GAP_DAYS, NEW_PER_DAY } = await import("@/lib/review");
const { cards } = await import("@/data/cards");

beforeEach(() => store.clear());

test("a remembered card moves up a box and comes back later", () => {
  const a = grade("c1", "good");
  assert.equal(a.box, 2);
  assert.equal(a.due, today() + GAP_DAYS[2]);
  const b = grade("c1", "good");
  assert.equal(b.box, 3);
  assert.equal(b.due, today() + GAP_DAYS[3]);
  assert.equal(b.reviews, 2);
  assert.equal(b.first, today());
});

test("a missed card goes back to box 1 and is due today", () => {
  grade("c2", "easy");
  const again = grade("c2", "again");
  assert.equal(again.box, 1);
  assert.equal(again.due, today());
});

test("boxes cap at 5 and 'hard' keeps the box", () => {
  for (let i = 0; i < 8; i++) grade("c3", "easy");
  assert.equal(loadReview().c3.box, 5);
  assert.equal(grade("c3", "hard").box, 5);
});

test("preview matches what grading does", () => {
  const p = preview(undefined);
  assert.equal(grade("c4", "good").due - today(), p.good);
  const p2 = preview(loadReview().c4);
  assert.equal(grade("c4", "easy").due - today(), p2.easy);
});

test("new cards per day are capped", () => {
  const ids = cards.map((c) => c.id);
  assert.equal(countDue(ids, {}).fresh, NEW_PER_DAY);
  for (let i = 0; i < NEW_PER_DAY; i++) grade(ids[i], "good");
  assert.equal(countDue(ids, loadReview()).fresh, 0);
});

test("card ids are unique", () => {
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
});
