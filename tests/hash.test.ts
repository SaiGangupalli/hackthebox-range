import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sha256Hex } from "@/lib/sim/hash";

test("sha256Hex matches node:crypto for text, binary and multi-block input", () => {
  const cases = ["", "abc", "a".repeat(55), "a".repeat(56), "a".repeat(64), "a".repeat(1000), "\x89PNG\r\n\x1a\n\x00\xff", "café — ü"];
  for (const c of cases) {
    const bytes = /[^\x00-\xff]/.test(c) ? Buffer.from(c, "utf8") : Buffer.from(c, "latin1");
    assert.equal(sha256Hex(c), createHash("sha256").update(bytes).digest("hex"), JSON.stringify(c.slice(0, 12)));
  }
});
