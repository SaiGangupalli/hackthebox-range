#!/usr/bin/env node
// Snapshot of this app's data to backups/hhb-<UTC time>.json. Read-only, and it
// reads only the hhb schema, never the other apps on the shared database.
//   npm run db:backup
// The file holds password hashes and every player's progress: keep it private.
// backups/ is git-ignored and the file is readable by your user only.
// To roll the live database back instead, see "Recovering" in docs/EVENT-RUNBOOK.md.

import { mkdirSync, writeFileSync } from "node:fs";

try { process.loadEnvFile(".env.local"); } catch { /* DATABASE_URL may already be set */ }
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

// Parents before children, so the rows can be re-inserted in this order.
const TABLES = ["user", "team", "teamMember", "solve", "hintUnlock", "vote", "progress", "setting"];

try {
  const data = {};
  for (const t of TABLES) data[t] = await prisma[t].findMany();
  const at = new Date().toISOString();
  mkdirSync("backups", { recursive: true });
  const file = `backups/hhb-${at.slice(0, 19).replace(/[-:]/g, "").replace("T", "-")}.json`;
  writeFileSync(file, JSON.stringify({ app: "hackthebox-range", schema: "hhb", at, tables: data }, null, 1), { mode: 0o600 });
  console.log(`Saved ${file}`);
  console.log(TABLES.map((t) => `${t}: ${data[t].length}`).join(", "));
} finally {
  await prisma.$disconnect();
}
