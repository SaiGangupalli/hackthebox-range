import { test } from "node:test";
import assert from "node:assert/strict";
import { take, check, reset, clientIp } from "@/lib/rateLimit";

test("take allows up to the limit, then refuses with a retry time", () => {
  const rule = { limit: 3, windowMs: 60_000 };
  const key = `t:${Math.random()}`;
  for (let i = 0; i < 3; i++) assert.equal(take(key, rule).ok, true);
  const v = take(key, rule);
  assert.equal(v.ok, false);
  assert.ok(v.retryAfter > 0 && v.retryAfter <= 60);
  assert.equal(check(key, rule).ok, false, "check reports the block without counting");
  reset(key);
  assert.equal(take(key, rule).ok, true, "reset clears the key");
});

test("check never records a use", () => {
  const rule = { limit: 1, windowMs: 60_000 };
  const key = `t:${Math.random()}`;
  for (let i = 0; i < 5; i++) assert.equal(check(key, rule).ok, true);
  assert.equal(take(key, rule).ok, true);
  assert.equal(take(key, rule).ok, false);
});

test("clientIp prefers the first X-Forwarded-For hop", () => {
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" })), "203.0.113.5");
  assert.equal(clientIp(new Headers({ "x-real-ip": "198.51.100.7" })), "198.51.100.7");
  assert.equal(clientIp(new Headers()), "local");
  assert.equal(clientIp(undefined), "local");
});
