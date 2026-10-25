import { test } from "node:test";
import assert from "node:assert/strict";
import { eventInfo, timesProblem, acceptsFlags, boardCutoff } from "@/lib/event";
import { csvCell, toCsv } from "@/lib/csv";
import { hashPassword, verifyPassword } from "@/lib/password";

const T = { start: "2026-11-07T09:00:00+05:30", freeze: "2026-11-07T16:00:00+05:30", end: "2026-11-07T17:00:00+05:30" };
const at = (iso: string) => new Date(iso);

test("event state follows the times it is given", () => {
  assert.equal(eventInfo(at("2026-11-07T08:00:00+05:30"), T).state, "before");
  assert.equal(eventInfo(at("2026-11-07T10:00:00+05:30"), T).state, "live");
  assert.equal(eventInfo(at("2026-11-07T16:30:00+05:30"), T).state, "frozen");
  assert.equal(eventInfo(at("2026-11-07T17:00:00+05:30"), T).state, "ended");
  assert.equal(eventInfo(new Date(), { start: null, end: null, freeze: null }).state, "practice");
});

test("flags are accepted while live or frozen, and the freeze hides later solves", () => {
  const frozen = eventInfo(at("2026-11-07T16:30:00+05:30"), T);
  assert.equal(acceptsFlags(frozen), true);
  assert.equal(boardCutoff(frozen)?.toISOString(), at(T.freeze).toISOString());
  assert.equal(acceptsFlags(eventInfo(at("2026-11-07T18:00:00+05:30"), T)), false);
  assert.equal(boardCutoff(eventInfo(at("2026-11-07T10:00:00+05:30"), T)), null);
});

test("organizer times are checked before they are saved", () => {
  assert.equal(timesProblem(T), null);
  assert.equal(timesProblem({ start: null, end: null, freeze: null }), null, "practice mode");
  assert.equal(timesProblem({ start: T.start, end: null, freeze: null }), null, "open-ended event");
  assert.match(timesProblem({ ...T, end: T.start }) ?? "", /end must be after/);
  assert.match(timesProblem({ start: T.start, end: null, freeze: T.freeze }) ?? "", /end time/);
  assert.match(timesProblem({ ...T, freeze: T.end }) ?? "", /before the end/);
  assert.match(timesProblem({ ...T, freeze: "2026-11-07T08:00:00+05:30" }) ?? "", /after the start/);
  assert.match(timesProblem({ ...T, start: "invalid" }) ?? "", /valid date/);
});

test("CSV cells are quoted and can't run as spreadsheet formulas", () => {
  assert.equal(csvCell('say "hi", ok'), '"say ""hi"", ok"');
  assert.equal(csvCell("=HYPERLINK(\"http://x\")"), `"'=HYPERLINK(""http://x"")"`);
  assert.equal(csvCell("-2+3"), "'-2+3");
  assert.equal(csvCell("@cmd"), "'@cmd");
  assert.equal(csvCell(-5), "-5", "numbers stay numbers");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(new Date("2026-11-07T10:00:00Z")), "2026-11-07T10:00:00.000Z");
  assert.equal(toCsv(["a", "b"], [[1, "x"]]), "﻿a,b\r\n1,x\r\n");
});

test("passwords hash and verify without blocking", async () => {
  const h = await hashPassword("correct horse");
  assert.match(h, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(await verifyPassword("correct horse", h), true);
  assert.equal(await verifyPassword("wrong horse", h), false);
  assert.equal(await verifyPassword("x", "not-a-hash"), false);
});
