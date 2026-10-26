// CVSS v3.1 base scores for the pentest lab's `cvss` tool, computed with the
// formula and weights in FIRST's specification
// (https://www.first.org/cvss/v3.1/specification-document, section 7).

import type { Tool } from "./shell";

const METRICS: [key: string, name: string, values: Record<string, [label: string, weight: number]>][] = [
  ["AV", "Attack Vector", { N: ["Network", 0.85], A: ["Adjacent", 0.62], L: ["Local", 0.55], P: ["Physical", 0.2] }],
  ["AC", "Attack Complexity", { L: ["Low", 0.77], H: ["High", 0.44] }],
  ["PR", "Privileges Required", { N: ["None", 0.85], L: ["Low", 0.62], H: ["High", 0.27] }],
  ["UI", "User Interaction", { N: ["None", 0.85], R: ["Required", 0.62] }],
  ["S", "Scope", { U: ["Unchanged", 0], C: ["Changed", 0] }],
  ["C", "Confidentiality", { H: ["High", 0.56], L: ["Low", 0.22], N: ["None", 0] }],
  ["I", "Integrity", { H: ["High", 0.56], L: ["Low", 0.22], N: ["None", 0] }],
  ["A", "Availability", { H: ["High", 0.56], L: ["Low", 0.22], N: ["None", 0] }],
];

// Round up to one decimal the way the specification does (Appendix A), avoiding float error.
function roundup(x: number) {
  const i = Math.round(x * 100000);
  return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10;
}

export const severity = (s: number) => (s === 0 ? "None" : s < 4 ? "Low" : s < 7 ? "Medium" : s < 9 ? "High" : "Critical");

export type Cvss = { score: number; severity: string; impact: number; exploitability: number; values: Record<string, string> };

export function cvss31(vector: string): Cvss | { error: string } {
  const parts = vector.trim().replace(/^CVSS:3\.[01]\//, "").split("/");
  const v: Record<string, string> = {};
  for (const p of parts) { const [k, x] = p.split(":"); if (k && x) v[k] = x; }
  for (const [k, name, vals] of METRICS) if (!vals[v[k]]) return { error: `${name} (${k}) is missing or not one of ${Object.keys(vals).join("/")}` };
  const w = (k: string) => METRICS.find((m) => m[0] === k)![2][v[k]][1];
  const changed = v.S === "C";
  const pr = v.PR === "L" ? (changed ? 0.68 : 0.62) : v.PR === "H" ? (changed ? 0.5 : 0.27) : 0.85;
  const iss = 1 - (1 - w("C")) * (1 - w("I")) * (1 - w("A"));
  const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss;
  const exploitability = 8.22 * w("AV") * w("AC") * pr * w("UI");
  const score = impact <= 0 ? 0 : roundup(Math.min((changed ? 1.08 : 1) * (impact + exploitability), 10));
  return { score, severity: severity(score), impact: Math.max(0, impact), exploitability, values: v };
}

export const cvssTool: Tool = {
  about: "work out a CVSS v3.1 base score from a vector like CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
  run(args) {
    const vec = args.find((a) => !a.startsWith("-"));
    if (!vec || vec === "help") {
      return { out: [
        "usage: cvss CVSS:3.1/AV:_/AC:_/PR:_/UI:_/S:_/C:_/I:_/A:_",
        "",
        ...METRICS.map(([k, name, vals]) => `  ${k.padEnd(3)}${name.padEnd(21)}${Object.entries(vals).map(([x, [l]]) => `${x}=${l}`).join("  ")}`),
        "",
        "Example: cvss CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
      ].join("\n") + "\n" };
    }
    const r = cvss31(vec);
    if ("error" in r) return { out: "", err: `cvss: ${r.error}`, code: 1 };
    return { out: [
      `CVSS:3.1/${METRICS.map(([k]) => `${k}:${r.values[k]}`).join("/")}`,
      `Base score: ${r.score} (${r.severity})`,
      "",
      ...METRICS.map(([k, name, vals]) => `  ${name.padEnd(21)}${vals[r.values[k]][0]}`),
      "",
      `  Exploitability ${r.exploitability.toFixed(1)} · Impact ${r.impact.toFixed(1)}`,
    ].join("\n") + "\n" };
  },
};
