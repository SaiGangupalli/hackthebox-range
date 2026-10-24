#!/usr/bin/env node
// Hash a challenge flag for src/data/challenges.ts, so flags never sit in code.
//   npm run flag-hash                      prompts for the flag (keeps it out of shell history)
//   npm run flag-hash -- "HHB{my_flag}"    or pass it directly
// The flag is trimmed exactly like /api/submit trims submissions, then SHA-256'd.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readFlag() {
  if (process.argv[2] !== undefined) return process.argv.slice(2).join(" ");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const v = await rl.question("Flag: ");
  rl.close();
  return v;
}

const flag = (await readFlag()).trim();
if (!flag) {
  console.error("No flag given.");
  process.exit(1);
}

const hash = createHash("sha256").update(flag).digest("hex");
console.log(`\n    flagHash: "${hash}",\n`);

if (!/^HHB\{[^{}\s]+\}$/.test(flag)) console.warn(`⚠ "${flag}" doesn't look like HHB{...} — players are told to expect that format.`);

try {
  const src = readFileSync(path.join(root, "src/data/challenges.ts"), "utf8");
  const at = src.indexOf(hash);
  if (at >= 0) {
    const id = src.slice(0, at).match(/id: "([^"]+)"/g)?.pop()?.slice(5, -1);
    console.warn(`⚠ This flag is already used${id ? ` by challenge "${id}"` : ""} — pick a different one.`);
  }
} catch { /* challenges.ts not found — skip the duplicate check */ }
