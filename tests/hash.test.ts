import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sha256Hex, sha1Hex, md5Hex } from "@/lib/sim/hash";

const CASES = ["", "abc", "a".repeat(55), "a".repeat(56), "a".repeat(64), "a".repeat(1000), "\x89PNG\r\n\x1a\n\x00\xff", "café — ü"];
const bytesOf = (c: string) => (/[^\x00-\xff]/.test(c) ? Buffer.from(c, "utf8") : Buffer.from(c, "latin1"));

for (const [name, fn] of [["sha256", sha256Hex], ["sha1", sha1Hex], ["md5", md5Hex]] as const) {
  test(`${name}Hex matches node:crypto for text, binary and multi-block input`, () => {
    for (const c of CASES) assert.equal(fn(c), createHash(name).update(bytesOf(c)).digest("hex"), JSON.stringify(c.slice(0, 12)));
  });
}
