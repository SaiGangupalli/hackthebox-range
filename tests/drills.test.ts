import { test } from "node:test";
import assert from "node:assert/strict";
import { Shell } from "@/lib/sim/shell";
import { drills, drillOrder, dojoSpec, LEVELS } from "@/data/drills";
import { passesDrill } from "@/lib/drillCheck";

test("drill ids are unique and every level has drills", () => {
  assert.equal(new Set(drills.map((d) => d.id)).size, drills.length);
  for (let lv = 1; lv <= LEVELS.length; lv++) assert.ok(drills.some((d) => d.level === lv), `level ${lv}`);
  assert.deepEqual([...drillOrder].sort((a, b) => a - b), drills.map((_, i) => i), "drillOrder is a permutation");
});

test("every drill's example completes it, in the order learners see them", () => {
  const sh = new Shell(dojoSpec);
  for (const k of drillOrder) {
    const d = drills[k];
    if (d.id !== "cd-home") sh.cwd = dojoSpec.home;
    const out = sh.run(d.example).out;
    assert.ok(passesDrill(d.check, d.example, out, sh), `${d.id}: ${d.example}\n${out.slice(0, 300)}`);
  }
});

// Other ways to solve a drill should pass; near-misses should not.
const cases: [string, string, boolean, string[]?][] = [
  ["grep-c", "grep Failed logs/auth.log | wc -l", true], ["grep-c", "grep Failed logs/auth.log", false],
  ["sort", "sort -n data/scores.txt", false], ["sort", "sort -rn data/scores.txt", true],
  ["grep-i", "grep password projects/website/config.bak", false],
  ["middle", "sed -n '3,5p' logs/access.log", true], ["middle", "head -n 5 logs/access.log", false],
  ["append", "echo reviewed auth.log > todo.txt", false], ["append", "echo 'reviewed auth.log' >> todo.txt", true],
  ["b64-encode", "echo hello | base64", true], ["b64-encode", "echo aGVsbG8= | base64 -d", false],
  ["touch", "touch evidence/case-notes.txt", false], ["touch", "touch evidence/case-notes.txt", true, ["mkdir evidence"]],
  ["mv", "cp evidence/auth.log evidence/auth-web01.log", false, ["mkdir evidence", "cp logs/auth.log evidence/"]],
  ["chmod-x", "chmod 755 scripts/backup.sh", true], ["chmod-x", "chmod 644 scripts/backup.sh", false],
  ["chmod-600", "chmod 700 data/api-token.txt", false], ["chmod-600", "chmod go-r data/api-token.txt", true],
  ["tr-upper", "tr a-z A-Z notes.txt", false], ["tr-upper", "cat notes.txt | tr '[:lower:]' '[:upper:]'", true],
  ["sha256-check", "sha256sum -c downloads/CHECKSUMS.txt", false],
  ["ss", "ss -tl", false], ["ss", "ss -tlnp", true],
  ["inv-evidence", "grep 198.51.100.4 logs/*.log > attacker.txt", true], ["inv-evidence", "grep 198.51.100.4 logs/auth.log > attacker.txt", false],
];
test("alternative answers pass and near-misses fail", () => {
  const byId = Object.fromEntries(drills.map((d) => [d.id, d]));
  for (const [id, cmd, want, setup = []] of cases) {
    const sh = new Shell(dojoSpec);
    for (const c of setup) sh.run(c);
    const out = sh.run(cmd).out;
    assert.equal(passesDrill(byId[id].check, cmd, out, sh), want, `${id}: ${cmd}`);
  }
});
