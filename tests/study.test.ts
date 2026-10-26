import { test } from "node:test";
import assert from "node:assert/strict";
import { rangeCerts, studyId } from "@/data/certify";
import { bank } from "@/lib/certify/bank";
import { studyLink } from "@/lib/certify/study";
import { learn, lessonId } from "@/data/learn";
import { glossary, termId } from "@/data/glossary";

test("every exam topic is in exactly one study-guide topic", () => {
  for (const c of rangeCerts) {
    const examTopics = new Set(bank[c.id].map((q) => q.topic));
    const listed = c.study.flatMap((t) => t.exam);
    for (const e of examTopics) assert.equal(listed.filter((x) => x === e).length, 1, `${c.code}: exam topic "${e}" must be in one study topic`);
    for (const e of listed) assert.ok(examTopics.has(e), `${c.code}: study guide lists "${e}", which the exam doesn't use`);
    assert.deepEqual(c.covers, c.study.map((t) => t.topic), `${c.code}: covers come from the study guide`);
    assert.equal(new Set(c.study.map((t) => studyId(t.topic))).size, c.study.length, `${c.code}: study anchors unique`);
  }
});

test("every study-guide link points at real content, and every topic has a lesson", () => {
  for (const c of rangeCerts) for (const t of c.study) {
    const links = t.refs.map((r) => ({ r, l: studyLink(r) }));
    for (const { r, l } of links) assert.ok(l, `${c.code} / ${t.topic}: nothing at ${JSON.stringify(r)}`);
    assert.ok(links.some(({ l }) => l?.kind === "Lesson" || l?.kind === "Page"), `${c.code} / ${t.topic}: needs a lesson to study from`);
  }
});

test("lesson and glossary anchors are unique", () => {
  for (const [slug, l] of Object.entries(learn)) assert.equal(new Set(l.cards.map((c) => lessonId(c.q))).size, l.cards.length, `${slug}: two lessons share an anchor`);
  assert.equal(new Set(glossary.map((t) => termId(t.term))).size, glossary.length, "two glossary terms share an anchor");
});
