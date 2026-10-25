import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { challenges, totalPoints } from "@/data/challenges";
import { tracks } from "@/data/tracks";

const titles = new Set(Object.values(tracks).map((t) => t.title));

test("challenges are well formed", () => {
  assert.equal(new Set(challenges.map((c) => c.id)).size, challenges.length, "ids unique");
  for (const c of challenges) {
    assert.match(c.flagHash, /^[0-9a-f]{64}$/, `${c.id}: flagHash is a SHA-256 hex digest`);
    assert.ok(c.track === "Warm-up" || titles.has(c.track), `${c.id}: unknown track "${c.track}"`);
    assert.ok(c.points > 0 && c.prompt && c.hint && c.writeup, c.id);
    for (const h of c.hints ?? []) assert.ok(h.cost > 0 && h.text, `${c.id}: paid hint`);
    if (c.level) assert.ok(["Intermediate", "Advanced"].includes(c.level), c.id);
  }
  assert.equal(totalPoints, challenges.reduce((s, c) => s + c.points, 0));
});

test("no flag is stored in the source — only its hash", () => {
  // Hash every HHB{…} string in the file: none may match a stored flag hash,
  // except the warm-up, whose flag is deliberately printed in its prompt.
  const src = readFileSync(new URL("../src/data/challenges.ts", import.meta.url), "utf8");
  const hashes = new Map(challenges.filter((c) => c.id !== "intro-01").map((c) => [c.flagHash, c.id]));
  const leaks = [...new Set(src.match(/HHB\{[^}"\n]*\}/g) ?? [])]
    .map((f) => hashes.get(createHash("sha256").update(f).digest("hex")))
    .filter(Boolean);
  assert.deepEqual(leaks, [], `flags written in plain text for: ${leaks.join(", ")}`);
});
