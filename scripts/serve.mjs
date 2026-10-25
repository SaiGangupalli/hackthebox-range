#!/usr/bin/env node
// Start Next.js on the first free port, beginning at 3003.
//   npm run dev                     next dev (Turbopack) on 3003, or the next free port
//   npm start                       next start, same rule
//   PORT=4000 npm run dev           start looking from 4000 instead
//   npm run dev -- --print-port     only print the port that would be used
// 3002 belongs to another local app and is never used. If this project's
// server is already running, say where instead of starting a second copy —
// two servers in one folder fight over .next/.
import net from "node:net";
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = realpathSync(path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
const RESERVED = new Set([3002]);
const DEFAULT_PORT = 3003;

const mode = process.argv[2] === "start" ? "start" : "dev";
const printOnly = process.argv.includes("--print-port");
const extra = process.argv.slice(3).filter((a) => a !== "--print-port");
const first = Number(process.env.PORT) || DEFAULT_PORT;

// Is something already accepting connections on this port?
function answers(port, host) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host });
    s.setTimeout(400, () => { s.destroy(); resolve(false); });
    s.once("connect", () => { s.destroy(); resolve(true); });
    s.once("error", () => resolve(false));
  });
}

// Can we bind it on all interfaces, the way Next will? (IPv4-only machines fall back to 0.0.0.0.)
function bindable(port, host = "::") {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", (e) => resolve(host === "::" && e.code === "EAFNOSUPPORT" ? bindable(port, "0.0.0.0") : false));
    srv.listen({ port, host }, () => srv.close(() => resolve(true)));
  });
}

async function isFree(port) {
  if (RESERVED.has(port)) return false;
  if ((await answers(port, "127.0.0.1")) || (await answers(port, "::1"))) return false;
  return bindable(port);
}

async function findPort(from) {
  for (let p = from; p < from + 100; p++) if (await isFree(p)) return p;
  throw new Error(`No free port between ${from} and ${from + 99}.`);
}

// Next.js servers started from this folder that are already listening.
function runningHere() {
  const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  try {
    const ports = new Map();
    let pid;
    for (const line of sh("lsof", ["-nP", "-a", "-iTCP", "-sTCP:LISTEN", "-c", "node", "-Fpn"]).split("\n")) {
      if (line[0] === "p") pid = line.slice(1);
      else if (line[0] === "n" && pid && !ports.has(pid)) { const m = /:(\d+)$/.exec(line); if (m) ports.set(pid, m[1]); }
    }
    const hits = [];
    for (const [p, port] of ports) {
      const cwd = sh("lsof", ["-a", "-p", p, "-d", "cwd", "-Fn"]).split("\n").find((l) => l[0] === "n")?.slice(1);
      if (cwd === root && /next/i.test(sh("ps", ["-o", "command=", "-p", p]))) hits.push({ pid: p, port });
    }
    return hits;
  } catch {
    return []; // no lsof, or nothing listening: skip the check
  }
}

if (printOnly) {
  console.log(await findPort(first));
  process.exit(0);
}

const [already] = runningHere();
if (already) {
  console.error(`This app is already running at http://localhost:${already.port} (pid ${already.pid}).`);
  console.error(`Open that, or stop it first with: kill ${already.pid}`);
  process.exit(1);
}

const port = await findPort(first);
if (port !== first) console.log(`Port ${first} is busy — using ${port} instead.`);

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const args = mode === "dev" ? ["dev", "--turbopack", "-p", String(port), ...extra] : ["start", "-p", String(port), ...extra];
const child = spawn(process.execPath, [nextBin, ...args], { stdio: "inherit", cwd: root });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
