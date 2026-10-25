import { test } from "node:test";
import assert from "node:assert/strict";
import { tracks, trackOrder } from "@/data/tracks";
import { path, LEVELS } from "@/data/path";
import { learn } from "@/data/learn";
import { quiz } from "@/data/quiz";
import { glossary, GLOSSARY_CATS } from "@/data/glossary";
import { navGroups } from "@/data/nav";
import { rangeCerts, rangeCertById } from "@/data/certify";
import { industryCerts, industryCertById, roadmaps, CERT_AREAS, CERT_TIERS } from "@/data/industryCerts";
import { labById } from "@/data/labs";
import { bank } from "@/lib/certify/bank";

test("every track is on the path with lessons, a quiz and a level", () => {
  assert.deepEqual([...trackOrder].sort(), Object.keys(tracks).sort());
  assert.deepEqual(path.map((p) => p.slug).sort(), [...trackOrder].sort());
  for (const p of path) {
    assert.ok(LEVELS.includes(p.level), p.slug);
    assert.ok(learn[p.slug]?.cards.length >= 3, `${p.slug} lessons`);
    assert.equal(quiz[p.slug]?.length, 4, `${p.slug} quiz`);
    for (const pre of p.prereq) assert.ok(tracks[pre], `${p.slug} prereq ${pre}`);
  }
});

test("quiz questions have one right answer and three distinct wrong ones", () => {
  for (const [slug, qs] of Object.entries(quiz)) for (const q of qs) {
    assert.equal(q.wrong.length, 3, `${slug}: ${q.q}`);
    assert.equal(new Set([q.right, ...q.wrong]).size, 4, `${slug}: ${q.q}`);
    assert.ok(q.why, `${slug}: ${q.q}`);
  }
});

test("glossary terms are unique, categorised and link to real tracks", () => {
  assert.equal(new Set(glossary.map((t) => t.term.toLowerCase())).size, glossary.length);
  for (const t of glossary) {
    assert.ok(GLOSSARY_CATS.includes(t.cat), `${t.term}: ${t.cat}`);
    if (t.track) assert.ok(tracks[t.track], `${t.term} → ${t.track}`);
  }
  for (const c of GLOSSARY_CATS) assert.ok(glossary.some((t) => t.cat === c), `empty category ${c}`);
});

test("the sidebar lists every track once", () => {
  const hrefs = navGroups.flatMap((g) => g.items.map((i) => i.href));
  for (const slug of trackOrder) assert.equal(hrefs.filter((h) => h === `/tracks/${slug}`).length, 1, slug);
});

test("Range certifications point at real tracks, labs and certificates", () => {
  for (const c of rangeCerts) {
    const r = c.requires;
    for (const s of [...(r.tracks ?? []), ...(r.anyTracks?.of ?? [])]) assert.ok(tracks[s], `${c.id}: track ${s}`);
    for (const l of r.labs ?? []) assert.ok(labById[l], `${c.id}: lab ${l}`);
    for (const x of r.certs ?? []) assert.ok(rangeCertById[x] && x !== c.id, `${c.id}: cert ${x}`);
    if (r.anyTracks) assert.ok(r.anyTracks.n <= r.anyTracks.of.length);
  }
});

test("exam banks are big enough and well formed", () => {
  const ids = Object.values(bank).flat().map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length, "question ids unique across banks");
  for (const c of rangeCerts) {
    const qs = bank[c.id];
    assert.ok(qs && qs.length >= c.exam.questions + 3, `${c.id}: bank of ${qs?.length} for ${c.exam.questions}-question exam`);
    for (const q of qs) {
      assert.equal(new Set([q.right, ...q.wrong]).size, 4, `${q.id}`);
      assert.ok(q.topic && q.why, q.id);
    }
  }
});

test("industry certifications and roadmaps resolve", () => {
  assert.equal(new Set(industryCerts.map((c) => c.id)).size, industryCerts.length);
  for (const c of industryCerts) {
    assert.ok(CERT_AREAS.includes(c.area) && CERT_TIERS.includes(c.tier), c.id);
    assert.match(c.url, /^https:\/\//, c.id);
    for (const s of c.prep) assert.ok(tracks[s], `${c.id}: prep ${s}`);
  }
  for (const r of roadmaps) for (const s of r.steps) {
    const ok = s.kind === "track" ? tracks[s.id] : s.kind === "range" ? rangeCertById[s.id] : industryCertById[s.id];
    assert.ok(ok, `${r.role}: ${s.kind} ${s.id}`);
  }
});
