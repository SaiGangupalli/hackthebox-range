import { test } from "node:test";
import assert from "node:assert/strict";
import { cached, invalidate } from "@/lib/cache";

test("a burst shares one load, reused until it expires", async () => {
  let loads = 0;
  const load = async () => { loads++; await new Promise((r) => setTimeout(r, 20)); return { n: loads }; };
  const burst = await Promise.all(Array.from({ length: 50 }, () => cached("t:burst", load, 60)));
  assert.equal(loads, 1, "50 concurrent callers, one load");
  assert.ok(burst.every((b) => b === burst[0]));
  await cached("t:burst", load, 60);
  assert.equal(loads, 1, "still fresh");
  await new Promise((r) => setTimeout(r, 70));
  await cached("t:burst", load, 60);
  assert.equal(loads, 2, "reloaded after expiry");
  invalidate("t:");
  await cached("t:burst", load, 60);
  assert.equal(loads, 3, "reloaded after invalidate");
});

test("a failed load isn't kept", async () => {
  let calls = 0;
  await assert.rejects(cached("t:fail", async () => { calls++; throw new Error("db down"); }));
  assert.equal(await cached("t:fail", async () => { calls++; return "ok"; }), "ok");
  assert.equal(calls, 2);
});
