import { test } from "node:test";
import assert from "node:assert/strict";
import { Shell, HELP } from "@/lib/sim/shell";
import { commandGroups, describe, LAB_TOOLS, practiceUses, practiceChains, recipes, splitCommands } from "@/data/commands";
import { drills, dojoSpec } from "@/data/drills";
import { shellLabs } from "@/data/labs/shellLabs";
import { advancedLabs } from "@/data/labs/advancedLabs";
import { platformLabsByTrack } from "@/data/labs/platformLabs";
import { forensicsLabsByTrack } from "@/data/labs/forensicsLabs";
import { webLabsByTrack } from "@/data/labs/webLabs";

const inBook = new Set(commandGroups.flatMap((g) => g.commands.map((c) => c.name)));
// Every lab's terminal, as [label, spec] — primary labs plus the extra ones.
const labs: Record<string, { spec: typeof shellLabs[string]["spec"] }> = { ...shellLabs, ...advancedLabs };
for (const src of [platformLabsByTrack, forensicsLabsByTrack, webLabsByTrack]) for (const [slug, arr] of Object.entries(src)) arr.forEach((l) => (labs[`${slug}:${l.id}`] = l));
const first = (seg: string) => seg.split(/\s+/)[0];

test("the handbook describes every command it lists, once", () => {
  const names = commandGroups.flatMap((g) => g.commands.map((c) => c.name));
  assert.equal(names.length, inBook.size, "no command listed twice");
  for (const n of names) assert.ok(describe(n), `${n} has no description in HELP or LAB_TOOLS`);
  for (const n of Object.keys(HELP)) assert.ok(inBook.has(n), `terminal command ${n} is missing from the handbook`);
  for (const n of Object.keys(LAB_TOOLS)) assert.ok(inBook.has(n), `lab tool ${n} is missing from the handbook`);
});

test("every command the drills and labs use is in the handbook", () => {
  for (const d of drills) for (const seg of splitCommands(d.example)) assert.ok(inBook.has(first(seg)), `drill ${d.id} uses ${first(seg)}`);
  for (const [slug, l] of Object.entries(labs)) {
    for (const line of l.spec.suggest ?? []) for (const seg of splitCommands(line)) assert.ok(inBook.has(first(seg)), `${slug} lab suggests ${first(seg)}`);
    for (const p of Object.keys(l.spec.programs ?? {})) assert.ok(inBook.has(p), `${slug} lab tool ${p}`);
    for (const p of Object.keys(l.spec.tools ?? {})) assert.ok(inBook.has(p), `${slug} lab tool ${p}`);
  }
});

test("every option and chain the drills and labs use shows up in the handbook", () => {
  const opts = (seg: string) => (seg.match(/'[^']*'|"[^"]*"|\S+/g) ?? []).slice(1).filter((a) => a.startsWith("-") || /^(2>|>|<)/.test(a));
  const shown = (name: string) => [describe(name)![1], ...(practiceUses[name] ?? []).map((u) => u.form)].flatMap(splitCommands).filter((s) => first(s) === name);
  const chains = new Set([...recipes.map((r) => r.cmd), ...practiceChains.map((c) => c.cmd)]);
  const lines = [...drills.map((d) => ({ where: `drill ${d.id}`, line: d.example })), ...Object.entries(labs).flatMap(([slug, l]) => (l.spec.suggest ?? []).map((line) => ({ where: `${slug} lab`, line })))];
  for (const { where, line } of lines) {
    for (const seg of splitCommands(line)) {
      for (const o of opts(seg)) assert.ok(shown(first(seg)).some((s) => opts(s).includes(o)), `${where}: ${first(seg)} ${o} isn't shown on its card`);
    }
  }
  for (const d of drills) if (splitCommands(d.example).length > 1) assert.ok(chains.has(d.example), `${d.id}: ${d.example} isn't in Put them together`);
});

test("splitCommands keeps quoted pipes and splits at | and &&", () => {
  assert.deepEqual(splitCommands("cd downloads && sha256sum -c CHECKSUMS.txt"), ["cd downloads", "sha256sum -c CHECKSUMS.txt"]);
  assert.deepEqual(splitCommands("grep 'a|b' x | wc -l"), ["grep 'a|b' x", "wc -l"]);
});

test("every handbook example runs in the practice terminal", () => {
  for (const n of Object.keys(HELP)) {
    const sh = new Shell(dojoSpec);
    const { out } = sh.run(HELP[n][1]);
    assert.ok(!/command not found/i.test(out), `${n}: ${HELP[n][1]} → ${out}`);
  }
});
