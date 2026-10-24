// A tiny, deterministic Unix-like shell over an in-memory filesystem, used by the
// in-page practice terminals. Pure TypeScript: nothing touches a real machine.
// Binary files are latin1 strings (one char = one byte), so xxd/file/binwalk see
// real magic bytes.

import { sha256Hex } from "./hash";

export type FileMeta = {
  mode?: string; // ls-style, e.g. "-rwsr-xr-x" or "drwx------"
  owner?: string;
  group?: string;
  mtime?: string; // "Oct 23 09:14"
  noread?: boolean; // the lab user cannot read it (Permission denied)
};

export type ShellSpec = {
  user: string;
  host: string;
  home: string;
  cwd?: string;
  groups?: string[]; // used for permission checks (find -writable)
  id?: string; // `id` output
  uname?: string; // `uname -a` output
  files: Record<string, string>; // absolute path -> content
  dirs?: string[]; // extra empty directories
  meta?: Record<string, FileMeta>;
  // Canned output for lab-specific tools: command -> key -> output. The key is
  // tried as the full argument string, then each operand (resolved path, then
  // literal), then "*".
  programs?: Record<string, Record<string, string>>;
  procs?: { user: string; pid: number; cmd: string; start?: string; cpu?: string }[]; // shown by ps aux
  ports?: { port: number; addr?: string; proc: string; pid: number }[]; // listening TCP ports, shown by ss -tln
  date?: string; // `date` output
  motd?: string;
  suggest?: string[]; // clickable starter commands
};

export type RunResult = { out: string; clear?: boolean };

type Res = { out: string; err: string; code: number };
type Cmd = { argv: string[]; quiet: boolean; merge: boolean; redirect?: { path: string; append: boolean }; input?: string };
type Step = { pipeline: Cmd[]; sep: string };
type Tok = { t: "w"; v: string; glob: boolean } | { t: "op"; v: string };
type Builtin = (sh: Shell, args: string[], stdin: string, tty: boolean) => Res;

// Beginner-facing descriptions for `help` / `help <cmd>`.
export const HELP: Record<string, [string, string]> = {
  ls: ["list files in a folder (-l details, -a show hidden files)", "ls -la"],
  cd: ["change folder (cd .. goes up one level)", "cd /var/log"],
  pwd: ["print the folder you are in", "pwd"],
  mkdir: ["make a new folder (-p also makes any missing parent folders)", "mkdir evidence"],
  touch: ["create an empty file (or update an existing file's time)", "touch case-notes.txt"],
  cp: ["copy a file — to a new name, or into a folder", "cp auth.log evidence/"],
  mv: ["move or rename a file or folder", "mv draft.txt final.txt"],
  rm: ["delete files (-r for folders) — there is no recycle bin", "rm scratch.tmp"],
  chmod: ["change who may read, write or run a file (600, 644, 755, +x…)", "chmod 600 secret.txt"],
  cat: ["print a file's contents", "cat notes.txt"],
  head: ["show the first lines of a file (-n N)", "head -n 5 access.log"],
  tail: ["show the last lines of a file (-n N)", "tail -n 5 access.log"],
  grep: ["show lines matching a pattern (-i ignore case, -v invert, -c count, -r search folders)", 'grep -i "failed" auth.log'],
  wc: ["count lines / words / bytes (-l = lines only)", "wc -l auth.log"],
  sort: ["sort lines (-n numbers, -r reverse)", "sort -nr counts.txt"],
  uniq: ["merge repeated neighbouring lines (-c counts them) — sort first!", "sort ips.txt | uniq -c"],
  cut: ["pick columns (-d delimiter, -f field numbers)", "cut -d: -f1 /etc/passwd"],
  awk: ["print columns, e.g. '{print $1}' = first word of each line", "awk '{print $1}' access.log"],
  tr: ["swap or delete characters — reads from a pipe or < file (-d deletes)", "tr a-z A-Z < notes.txt"],
  sed: ["edit text as it flows past: s/old/new/ replaces, -n '3,5p' prints lines 3–5", "sed 's/ERROR/ALERT/' app.log"],
  rev: ["reverse each line, character by character", "rev backwards.txt"],
  tee: ["show output on screen AND save it to a file (-a adds to the end)", "grep Failed auth.log | tee failed.txt"],
  diff: ["show the lines that differ between two files (< first file, > second)", "diff old.conf new.conf"],
  sha256sum: ["print a file's SHA-256 fingerprint (-c checks a list of them)", "sha256sum tool.sh"],
  find: ["search for files (-name, -type f|d, -perm -4000, -user, -writable)", "find / -perm -4000 2>/dev/null"],
  file: ["identify a file's real type from its first bytes", "file photo.jpg"],
  strings: ["print readable text buried inside a binary file", "strings image.png"],
  xxd: ["hex dump: see the raw bytes (-l N limits output)", "xxd -l 32 image.png"],
  binwalk: ["scan a file for other files hidden inside (-e extracts them)", "binwalk image.png"],
  unzip: ["extract a zip archive (-l only lists it)", "unzip -l archive.zip"],
  base64: ["encode text as Base64, or decode with -d", "echo aGVsbG8= | base64 -d"],
  echo: ["print text", "echo hello"],
  ps: ["list running programs (aux = every user's, with details)", "ps aux"],
  ss: ["list network ports (-tln = listening TCP ports as numbers, -p adds the program)", "ss -tlnp"],
  id: ["show your user, group and extra groups", "id"],
  whoami: ["show your username", "whoami"],
  uname: ["show the OS / kernel (-a = everything)", "uname -a"],
  hostname: ["show the machine's name", "hostname"],
  date: ["show the current date and time", "date"],
  which: ["show where a command's program lives", "which grep"],
  history: ["list the commands you've typed", "history"],
  clear: ["clear the screen", "clear"],
};

const ok = (out: string): Res => ({ out, err: "", code: 0 });
const fail = (err: string, code = 1): Res => ({ out: "", err: err.endsWith("\n") ? err : err + "\n", code });
const lines = (s: string) => (s === "" ? [] : s.replace(/\n$/, "").split("\n"));
const text = (ls: string[]) => (ls.length ? ls.join("\n") + "\n" : "");
const parentOf = (p: string) => { const i = p.lastIndexOf("/"); return i <= 0 ? "/" : p.slice(0, i); };
const baseOf = (p: string) => p.slice(p.lastIndexOf("/") + 1) || "/";
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function globRe(glob: string, flags = ""): RegExp {
  return new RegExp("^" + escapeRe(glob).replace(/\\\*/g, ".*").replace(/\\\?/g, ".") + "$", flags);
}

// Short-flag parser: "-la" -> {l, a}; letters in `withValue` take an argument
// ("-n 5", "-n5", "-d:").
function parseArgs(args: string[], withValue = ""): { flags: Record<string, string | true>; rest: string[] } {
  const flags: Record<string, string | true> = {};
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") { rest.push(...args.slice(i + 1)); break; }
    if (a.startsWith("--")) { const [k, v] = a.slice(2).split("="); flags[k] = v ?? true; continue; }
    if (a.startsWith("-") && a.length > 1 && !/^-\d+$/.test(a)) {
      for (let j = 1; j < a.length; j++) {
        const f = a[j];
        if (withValue.includes(f)) { flags[f] = a.slice(j + 1) || args[++i] || ""; break; }
        flags[f] = true;
      }
      continue;
    }
    rest.push(a);
  }
  return { flags, rest };
}

// Basic regex (grep without -E): \| \( \) \+ \? are operators, bare ones are literal.
function breToJs(p: string): string {
  let s = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "\\" && i + 1 < p.length) { const n = p[++i]; s += "|(){}+?".includes(n) ? n : "\\" + n; continue; }
    s += "|(){}+?".includes(c) ? "\\" + c : c;
  }
  return s;
}

const u16le = (d: string, o: number) => d.charCodeAt(o) | (d.charCodeAt(o + 1) << 8);
const u32le = (d: string, o: number) => (u16le(d, o) | (u16le(d, o + 2) << 16)) >>> 0;
const u32be = (d: string, o: number) =>
  ((d.charCodeAt(o) << 24) | (d.charCodeAt(o + 1) << 16) | (d.charCodeAt(o + 2) << 8) | d.charCodeAt(o + 3)) >>> 0;

export function magic(d: string): string {
  if (!d.length) return "empty";
  if (d.startsWith("\x89PNG\r\n\x1a\n")) return `PNG image data, ${u32be(d, 16)} x ${u32be(d, 20)}, 8-bit/color RGBA, non-interlaced`;
  if (d.startsWith("\xff\xd8\xff")) return "JPEG image data, JFIF standard 1.01";
  if (d.startsWith("%PDF-")) return `PDF document, version ${d.slice(5, 8)}`;
  if (d.startsWith("PK\x03\x04")) return "Zip archive data, at least v2.0 to extract, compression method=store";
  if (d.startsWith("\x7fELF")) return "ELF 64-bit LSB pie executable, x86-64, dynamically linked, stripped";
  if (d.startsWith("GIF8")) return "GIF image data, version 89a";
  if (d.startsWith("\x1f\x8b")) return "gzip compressed data";
  if (d.startsWith("#!")) {
    const interp = d.slice(2, d.indexOf("\n") >>> 0);
    return `${/bash/.test(interp) ? "Bourne-Again shell script" : /python/.test(interp) ? "Python script" : "POSIX shell script"}, ASCII text executable`;
  }
  if (/^[\t\n\r\x20-\x7e]*$/.test(d)) return "ASCII text";
  if (!/[\x00-\x08\x0e-\x1f]/.test(d)) return "UTF-8 Unicode text";
  return "data";
}

type Sig = { off: number; kind: string; desc: string };
function scanSignatures(d: string): Sig[] {
  const sigs: [string, string, (o: number) => string][] = [
    ["\x89PNG\r\n\x1a\n", "png", (o) => `PNG image, ${u32be(d, o + 16)} x ${u32be(d, o + 20)}, 8-bit/color RGBA, non-interlaced`],
    ["\xff\xd8\xff", "jpeg", () => "JPEG image data, JFIF standard 1.01"],
    ["%PDF-", "pdf", (o) => `PDF document, version: "${d.slice(o + 5, o + 8)}"`],
    ["PK\x03\x04", "zip", (o) => `Zip archive data, at least v2.0 to extract, compressed size: ${u32le(d, o + 18)}, uncompressed size: ${u32le(d, o + 22)}, name: ${d.substr(o + 30, u16le(d, o + 26))}`],
    ["PK\x05\x06", "zipend", () => "End of Zip archive, footer length: 22"],
    ["\x1f\x8b\x08", "gzip", () => "gzip compressed data"],
  ];
  const hits: Sig[] = [];
  for (const [sig, kind, desc] of sigs) {
    for (let i = d.indexOf(sig); i >= 0; i = d.indexOf(sig, i + 1)) hits.push({ off: i, kind, desc: desc(i) });
  }
  return hits.sort((a, b) => a.off - b.off);
}

// Stored (uncompressed) zip entries, wherever their local headers sit in the data.
export function zipEntries(d: string): { name: string; data: string }[] {
  const out: { name: string; data: string }[] = [];
  for (let o = d.indexOf("PK\x03\x04"); o >= 0; o = d.indexOf("PK\x03\x04", o + 4)) {
    const method = u16le(d, o + 8), size = u32le(d, o + 18), nl = u16le(d, o + 26), el = u16le(d, o + 28);
    if (method !== 0) continue;
    const start = o + 30 + nl + el;
    out.push({ name: d.substr(o + 30, nl), data: d.substr(start, size) });
  }
  return out;
}

function permTest(v: string | undefined): ((mode: string) => boolean) | null {
  switch (v) {
    case "-4000": case "/4000": case "-u=s": case "/u=s": case "-u+s":
      return (m) => /[sS]/.test(m[3]);
    case "-2000": case "/2000": case "-g=s": case "/g=s": case "-g+s":
      return (m) => /[sS]/.test(m[6]);
    case "-002": case "-0002": case "/002": case "/0002": case "-o+w": case "-o=w": case "/o+w": case "/o=w":
      return (m) => m[8] === "w";
  }
  return null;
}

function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (const c of s) {
    if (c === '"') q = !q;
    if (c === sep && !q) { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out;
}

// `{print $1, $NF, "x"}` — commas join with a space, juxtaposition concatenates.
function awkPrint(expr: string, get: (n: number) => string, nf: number): string {
  return splitTop(expr, ",").map((part) => {
    let s = "";
    const re = /\s+|\$\(NF-(\d+)\)|\$NF|\$(\d+)|"((?:[^"\\]|\\.)*)"/y;
    let i = 0;
    while (i < part.length) {
      re.lastIndex = i;
      const m = re.exec(part);
      if (!m) throw new Error("awk: this lab supports print with $N, $NF and \"text\"");
      if (m[0] === "$NF") s += get(nf);
      else if (m[1]) s += get(nf - +m[1]);
      else if (m[2]) s += get(+m[2]);
      else if (m[3] !== undefined) s += m[3].replace(/\\t/g, "\t").replace(/\\(.)/g, "$1");
      i = re.lastIndex;
    }
    return s;
  }).join(" ");
}

// chmod: apply "600" / "4755" / "u+x,go-w" / "+x" to an ls-style mode string.
// Returns null for a mode this lab doesn't understand.
export function applyMode(mode: string, spec: string): string | null {
  const b = [1, 4, 7].map((i) => ({ r: mode[i] === "r", w: mode[i + 1] === "w", x: /[xst]/.test(mode[i + 2]) }));
  const sp = [/[sS]/.test(mode[3]), /[sS]/.test(mode[6]), /[tT]/.test(mode[9])]; // setuid, setgid, sticky
  if (/^[0-7]{3,4}$/.test(spec)) {
    const d = spec.padStart(4, "0").split("").map(Number);
    for (let i = 0; i < 3; i++) b[i] = { r: !!(d[i + 1] & 4), w: !!(d[i + 1] & 2), x: !!(d[i + 1] & 1) };
    sp[0] = !!(d[0] & 4); sp[1] = !!(d[0] & 2); sp[2] = !!(d[0] & 1);
  } else {
    for (const clause of spec.split(",")) {
      const m = /^([ugoa]*)([+\-=])([rwxst]*)$/.exec(clause);
      if (!m) return null;
      const who = (m[1] || "a").replace("a", "ugo");
      for (const [i, c] of ["u", "g", "o"].entries()) {
        if (!who.includes(c)) continue;
        const set = (on: boolean) => {
          for (const p of ["r", "w", "x"] as const) if (m[3].includes(p)) b[i][p] = on;
          if (m[3].includes("s") && i < 2) sp[i] = on;
          if (m[3].includes("t") && i === 2) sp[2] = on;
        };
        if (m[2] === "=") { b[i] = { r: false, w: false, x: false }; if (i < 2) sp[i] = false; }
        set(m[2] !== "-");
      }
    }
  }
  return mode[0] + b.map((p, i) => {
    const s = i === 2 ? "t" : "s";
    return (p.r ? "r" : "-") + (p.w ? "w" : "-") + (sp[i] ? (p.x ? s : s.toUpperCase()) : p.x ? "x" : "-");
  }).join("");
}

// tr character sets: ranges (a-z), classes ([:upper:]) and \n \t escapes.
function trSet(s: string): string[] {
  const classes: Record<string, string> = { lower: "a-z", upper: "A-Z", digit: "0-9", alpha: "a-zA-Z", alnum: "a-zA-Z0-9", space: " \t\n" };
  s = s.replace(/\[:(\w+):\]/g, (m, c: string) => classes[c] ?? m);
  const toks: { c: string; esc: boolean }[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && i + 1 < s.length) { const n = s[++i]; toks.push({ c: n === "n" ? "\n" : n === "t" ? "\t" : n, esc: true }); }
    else toks.push({ c: s[i], esc: false });
  }
  const out: string[] = [];
  for (let i = 0; i < toks.length; i++) {
    const dash = toks[i + 1], end = toks[i + 2];
    if (dash && end && dash.c === "-" && !dash.esc) {
      for (let x = toks[i].c.charCodeAt(0); x <= end.c.charCodeAt(0); x++) out.push(String.fromCharCode(x));
      i += 2;
    } else out.push(toks[i].c);
  }
  return out;
}

// sed: a small, faithful subset — s/old/new/[gip], p and d, with an optional
// address (N, $, /regex/) or range (N,M · /a/,/b/).
type SedAddr = { line: number } | { last: true } | { re: RegExp };
type SedCmd = { a1: SedAddr | null; a2: SedAddr | null; op: "s" | "p" | "d"; re?: RegExp; repl?: string; print?: boolean };

function sedRepl(r: string): string {
  let s = "";
  for (let i = 0; i < r.length; i++) {
    const c = r[i];
    if (c === "\\" && i + 1 < r.length) { const n = r[++i]; s += /\d/.test(n) ? "$" + n : n === "n" ? "\n" : n === "$" ? "$$" : n; continue; }
    s += c === "&" ? "$&" : c === "$" ? "$$" : c;
  }
  return s;
}

function parseSed(script: string, ere: boolean): SedCmd[] {
  const cmds: SedCmd[] = [];
  let i = 0;
  const reOf = (src: string, fl = "") => new RegExp(ere ? src : breToJs(src), fl);
  const until = (d: string) => {
    let s = "";
    while (i < script.length && script[i] !== d) {
      if (script[i] === "\\" && i + 1 < script.length) { s += script[i + 1] === d ? d : script[i] + script[i + 1]; i += 2; continue; }
      s += script[i++];
    }
    if (script[i] !== d) throw new Error("sed: unterminated command — did you close it with a final / ?");
    i++;
    return s;
  };
  const addr = (): SedAddr | null => {
    if (/\d/.test(script[i] ?? "")) { let n = ""; while (/\d/.test(script[i] ?? "")) n += script[i++]; return { line: +n }; }
    if (script[i] === "$") { i++; return { last: true }; }
    if (script[i] === "/") { i++; return { re: reOf(until("/")) }; }
    return null;
  };
  while (i < script.length) {
    while (/[\s;]/.test(script[i] ?? "")) i++;
    if (i >= script.length) break;
    const a1 = addr();
    let a2: SedAddr | null = null;
    if (a1 && script[i] === ",") { i++; a2 = addr(); if (!a2) throw new Error("sed: a range needs an end, e.g. 3,5p"); }
    while (script[i] === " ") i++;
    const op = script[i++];
    if (op === "s") {
      const d = script[i++];
      if (!d) throw new Error("sed: s needs a pattern, e.g. s/old/new/");
      const pat = until(d), repl = until(d);
      let fl = "";
      while (/[gipI]/.test(script[i] ?? "")) fl += script[i++];
      cmds.push({ a1, a2, op: "s", re: reOf(pat, (fl.includes("g") ? "g" : "") + (/[iI]/.test(fl) ? "i" : "")), repl: sedRepl(repl), print: fl.includes("p") });
    } else if (op === "p" || op === "d") cmds.push({ a1, a2, op });
    else throw new Error(`sed: this lab supports s/old/new/, p and d (e.g. sed -n '3,5p' file)${op ? ` — not '${op}'` : ""}`);
  }
  return cmds;
}

function runSed(cmds: SedCmd[], data: string, quiet: boolean): string {
  const ls = lines(data);
  const out: string[] = [];
  const inRange = cmds.map(() => false);
  ls.forEach((line, idx) => {
    const n = idx + 1, last = idx === ls.length - 1;
    let cur = line, deleted = false;
    const hit = (a: SedAddr) => ("line" in a ? a.line === n : "last" in a ? last : ((a.re.lastIndex = 0), a.re.test(cur)));
    for (let k = 0; k < cmds.length && !deleted; k++) {
      const c = cmds[k];
      let sel = true;
      if (c.a1 && c.a2) {
        if (inRange[k]) { if ("line" in c.a2 ? n >= c.a2.line : hit(c.a2)) inRange[k] = false; }
        else if (hit(c.a1)) inRange[k] = !("line" in c.a2 && c.a2.line <= n);
        else sel = false;
      } else if (c.a1) sel = hit(c.a1);
      if (!sel) continue;
      if (c.op === "d") deleted = true;
      else if (c.op === "p") out.push(cur);
      else {
        c.re!.lastIndex = 0;
        if (c.re!.test(cur)) { c.re!.lastIndex = 0; cur = cur.replace(c.re!, c.repl!); if (c.print) out.push(cur); }
      }
    }
    if (!deleted && !quiet) out.push(cur);
  });
  return text(out);
}

// Normal-format diff of two line lists (the classic "3c3 / < old / --- / > new").
function diffLines(A: string[], B: string[]): string[] {
  const m = A.length, n = B.length;
  const L = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const r = (s: number, e: number) => (e - s === 1 ? `${s + 1}` : `${s + 1},${e}`);
  const out: string[] = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && A[i] === B[j]) { i++; j++; continue; }
    const i1 = i, j1 = j;
    while ((i < m || j < n) && !(i < m && j < n && A[i] === B[j])) {
      if (i < m && (j >= n || L[i + 1][j] >= L[i][j + 1])) i++; else j++;
    }
    const del = A.slice(i1, i), add = B.slice(j1, j);
    if (del.length && add.length) out.push(`${r(i1, i)}c${r(j1, j)}`, ...del.map((l) => "< " + l), "---", ...add.map((l) => "> " + l));
    else if (del.length) out.push(`${r(i1, i)}d${j1}`, ...del.map((l) => "< " + l));
    else out.push(`${i1}a${r(j1, j)}`, ...add.map((l) => "> " + l));
  }
  return out;
}

const SERVICE: Record<number, string> = { 22: "ssh", 25: "smtp", 53: "domain", 80: "http", 443: "https", 3306: "mysql", 5432: "postgresql", 8080: "http-alt" };

export class Shell {
  spec: ShellSpec;
  cwd: string;
  history: string[] = [];
  files: Map<string, string>;
  dirs: Set<string>;
  modes = new Map<string, string>(); // permissions changed with chmod

  constructor(spec: ShellSpec) {
    this.spec = spec;
    this.files = new Map(Object.entries(spec.files));
    this.dirs = new Set(["/"]);
    for (const p of [...this.files.keys(), ...(spec.dirs ?? []), spec.home]) {
      if (!this.files.has(p)) this.dirs.add(p);
      for (let d = parentOf(p); d !== "/"; d = parentOf(d)) this.dirs.add(d);
    }
    this.cwd = spec.cwd ?? spec.home;
  }

  prompt(): string {
    const { home, user, host } = this.spec;
    const c = this.cwd === home ? "~" : this.cwd.startsWith(home + "/") ? "~" + this.cwd.slice(home.length) : this.cwd;
    return `${user}@${host}:${c}$`;
  }

  resolve(p: string): string {
    if (p === "~" || p.startsWith("~/")) p = this.spec.home + p.slice(1);
    const st: string[] = [];
    for (const x of (p.startsWith("/") ? p : `${this.cwd}/${p}`).split("/")) {
      if (!x || x === ".") continue;
      if (x === "..") st.pop(); else st.push(x);
    }
    return "/" + st.join("/");
  }

  meta(p: string) {
    const m = this.spec.meta?.[p] ?? {};
    const home = this.spec.home;
    const mine = p === home || p.startsWith(home + "/") || p.startsWith("/tmp/");
    const owner = m.owner ?? (mine ? this.spec.user : "root");
    return {
      mode: this.modes.get(p) ?? m.mode ?? (this.dirs.has(p) ? "drwxr-xr-x" : "-rw-r--r--"),
      owner,
      group: m.group ?? owner,
      mtime: m.mtime ?? "Oct 23 09:14",
    };
  }

  canReach(p: string): boolean {
    for (let d = p; d !== "/"; ) { d = parentOf(d); if (this.spec.meta?.[d]?.noread) return false; }
    return true;
  }
  canRead(p: string): boolean { return this.canReach(p) && !this.spec.meta?.[p]?.noread; }

  writable(p: string): boolean {
    const m = this.meta(p);
    if (m.owner === this.spec.user) return m.mode[2] === "w";
    if ((this.spec.groups ?? []).includes(m.group)) return m.mode[5] === "w";
    return m.mode[8] === "w";
  }

  children(dir: string): string[] {
    const pre = dir === "/" ? "/" : dir + "/";
    const names = new Set<string>();
    for (const p of [...this.files.keys(), ...this.dirs]) {
      if (p === dir || !p.startsWith(pre)) continue;
      const rest = p.slice(pre.length);
      if (rest && !rest.includes("/")) names.add(rest);
    }
    const key = (n: string) => n.replace(/^\./, "").toLowerCase();
    return [...names].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  }

  walk(p: string, shown: string, maxDepth = Infinity, depth = 0,
    acc: { path: string; shown: string; depth: number }[] = [], denied: string[] = []) {
    acc.push({ path: p, shown, depth });
    if (this.dirs.has(p) && depth < maxDepth) {
      if (!this.canRead(p)) denied.push(shown);
      else for (const n of this.children(p)) {
        this.walk(p === "/" ? "/" + n : `${p}/${n}`, shown.endsWith("/") ? shown + n : `${shown}/${n}`, maxDepth, depth + 1, acc, denied);
      }
    }
    return { entries: acc, denied };
  }

  readFile(arg: string, cmd: string): { data: string } | { err: string } {
    const p = this.resolve(arg);
    if (!this.canReach(p)) return { err: `${cmd}: ${arg}: Permission denied\n` };
    if (this.dirs.has(p)) return { err: `${cmd}: ${arg}: Is a directory\n` };
    if (!this.files.has(p)) return { err: `${cmd}: ${arg}: No such file or directory\n` };
    if (!this.canRead(p)) return { err: `${cmd}: ${arg}: Permission denied\n` };
    return { data: this.files.get(p)! };
  }

  // Files may only be created, changed or removed under $HOME and /tmp, like an
  // unprivileged user.
  ownArea(p: string): boolean {
    return p.startsWith(this.spec.home + "/") || p.startsWith("/tmp/");
  }

  // Why a file can't be written at absolute path p ("" if it can).
  cantWrite(p: string): string {
    if (this.dirs.has(p)) return "Is a directory";
    if (!this.ownArea(p)) return "Permission denied";
    if (!this.dirs.has(parentOf(p))) return this.files.has(parentOf(p)) ? "Not a directory" : "No such file or directory";
    if (this.files.has(p) && !this.writable(p)) return "Permission denied";
    return "";
  }

  write(path: string, data: string, append: boolean): string {
    if (path === "/dev/null") return "";
    const p = this.resolve(path);
    const why = this.cantWrite(p);
    if (why) return `bash: ${path}: ${why}\n`;
    this.files.set(p, append ? (this.files.get(p) ?? "") + data : data);
    return "";
  }

  removeTree(p: string) {
    const under = (k: string) => k === p || k.startsWith(p + "/");
    for (const k of [...this.files.keys()]) if (under(k)) this.files.delete(k);
    for (const d of [...this.dirs]) if (under(d)) this.dirs.delete(d);
    for (const k of [...this.modes.keys()]) if (under(k)) this.modes.delete(k);
  }

  // Move a file or folder (and everything inside it) from one path to another.
  moveTree(from: string, to: string) {
    const re = (k: string) => (k === from ? to : k.startsWith(from + "/") ? to + k.slice(from.length) : null);
    for (const [k, v] of [...this.files]) { const n = re(k); if (n) { this.files.delete(k); this.files.set(n, v); } }
    for (const d of [...this.dirs]) { const n = re(d); if (n) { this.dirs.delete(d); this.dirs.add(n); } }
    for (const [k, v] of [...this.modes]) { const n = re(k); if (n) { this.modes.delete(k); this.modes.set(n, v); } }
    const c = re(this.cwd);
    if (c) this.cwd = c;
  }

  run(line: string): RunResult {
    const trimmed = line.trim();
    if (!trimmed) return { out: "" };
    this.history.push(trimmed);
    let steps: Step[];
    try { steps = this.parse(trimmed); } catch (e) { return { out: `bash: ${(e as Error).message}\n` }; }
    let out = "";
    let last = 0;
    for (const st of steps) {
      if ((st.sep === "&&" && last !== 0) || (st.sep === "||" && last === 0)) continue;
      if (st.pipeline.length === 1 && st.pipeline[0].argv[0] === "clear") return { out: "", clear: true };
      const r = this.pipeline(st.pipeline);
      out += r.out;
      last = r.code;
    }
    return { out };
  }

  private pipeline(cmds: Cmd[]): Res {
    let stdin = "", errs = "", code = 0;
    cmds.forEach((c, i) => {
      const tty = i === cmds.length - 1 && !c.redirect;
      if (c.input !== undefined) {
        const f = this.readFile(c.input, "bash");
        if ("err" in f) { errs += f.err; stdin = ""; code = 1; return; }
        stdin = f.data;
      }
      let r: Res;
      try { r = this.exec(c.argv, stdin, tty); } catch (e) { r = fail((e as Error).message); }
      let out = r.out;
      if (c.merge) out += r.err;
      else if (!c.quiet) errs += r.err;
      if (c.redirect) { errs += this.write(c.redirect.path, out, c.redirect.append); out = ""; }
      stdin = out;
      code = r.code;
    });
    return { out: errs + stdin, err: "", code };
  }

  exec(argv: string[], stdin: string, tty = true): Res {
    const [cmd, ...args] = argv;
    if (!cmd) return ok("");
    const table = this.spec.programs?.[cmd];
    if (table) {
      const operands = args.filter((a) => !/^[-+]/.test(a));
      const keys = [args.join(" "), ...operands.flatMap((a) => [this.resolve(a), a]), "*"];
      for (const k of keys) if (k in table) { const t = table[k]; return ok(t.endsWith("\n") || !t ? t : t + "\n"); }
    }
    const fn = BUILTINS[cmd];
    if (fn) return fn(this, args, stdin, tty);
    if (table) return fail(`${cmd}: nothing to show for '${args.join(" ")}' in this lab — try one of the suggested commands`);
    return fail(`${cmd}: command not found (type 'help' to see what this lab supports)`, 127);
  }

  private parse(line: string): Step[] {
    const toks = this.lex(line);
    const steps: Step[] = [];
    const fresh = (): Cmd => ({ argv: [], quiet: false, merge: false });
    let pipeline: Cmd[] = [], cur = fresh(), sep = ";", lastOp = "";
    const endCmd = (op: string) => {
      if (!cur.argv.length) throw new Error(`syntax error near unexpected token \`${op}'`);
      pipeline.push(cur);
      cur = fresh();
    };
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.t === "w") { cur.argv.push(...this.expand(t)); lastOp = ""; continue; }
      lastOp = t.v;
      if (t.v === "|") endCmd("|");
      else if (t.v === ";" || t.v === "&&" || t.v === "||") { endCmd(t.v); steps.push({ pipeline, sep }); pipeline = []; sep = t.v; }
      else if (t.v === "2>&1") cur.merge = true;
      else {
        const n = toks[++i];
        if (!n || n.t !== "w") throw new Error("syntax error near unexpected token `newline'");
        if (t.v === "2>") cur.quiet = true;
        else if (t.v === "<") cur.input = n.v;
        else cur.redirect = { path: n.v, append: t.v === ">>" };
        lastOp = "";
      }
    }
    if (lastOp === "|" || lastOp === "&&" || lastOp === "||") throw new Error(`syntax error: nothing after \`${lastOp}'`);
    if (cur.argv.length) pipeline.push(cur);
    if (pipeline.length) steps.push({ pipeline, sep });
    return steps;
  }

  private lex(line: string): Tok[] {
    const env: Record<string, string> = { HOME: this.spec.home, USER: this.spec.user, PWD: this.cwd };
    const toks: Tok[] = [];
    let i = 0;
    while (i < line.length) {
      const c = line[i];
      if (c === " " || c === "\t") { i++; continue; }
      const two = line.slice(i, i + 2);
      if (line.startsWith("2>&1", i)) { toks.push({ t: "op", v: "2>&1" }); i += 4; continue; }
      if (two === "2>" && (i === 0 || /\s/.test(line[i - 1]))) { toks.push({ t: "op", v: "2>" }); i += 2; continue; }
      if (two === "&&" || two === "||" || two === ">>") { toks.push({ t: "op", v: two }); i += 2; continue; }
      if (c === "|" || c === ";" || c === ">" || c === "<") { toks.push({ t: "op", v: c }); i++; continue; }
      let v = "", glob = false;
      if (c === "~" && (i + 1 === line.length || line[i + 1] === "/" || /\s/.test(line[i + 1]))) { v = this.spec.home; i++; }
      while (i < line.length) {
        const ch = line[i];
        if (ch === " " || ch === "\t" || ch === "|" || ch === ";" || ch === ">" || ch === "<" || (ch === "&" && line[i + 1] === "&")) break;
        if (ch === "'") {
          const j = line.indexOf("'", i + 1);
          if (j < 0) throw new Error("unexpected EOF while looking for matching `''");
          v += line.slice(i + 1, j); i = j + 1; continue;
        }
        if (ch === '"') {
          let j = i + 1;
          for (; j < line.length && line[j] !== '"'; j++) {
            if (line[j] === "\\" && '"\\$'.includes(line[j + 1] ?? "")) { v += line[++j]; continue; }
            const m = line[j] === "$" ? /^\$(\w+)/.exec(line.slice(j)) : null;
            if (m) { v += env[m[1]] ?? ""; j += m[0].length - 1; continue; }
            v += line[j];
          }
          if (j >= line.length) throw new Error('unexpected EOF while looking for matching `"\'');
          i = j + 1; continue;
        }
        if (ch === "\\") { v += line[i + 1] ?? ""; i += 2; continue; }
        const m = ch === "$" ? /^\$(\w+)/.exec(line.slice(i)) : null;
        if (m) { v += env[m[1]] ?? ""; i += m[0].length; continue; }
        if (ch === "*" || ch === "?") glob = true;
        v += ch; i++;
      }
      toks.push({ t: "w", v, glob });
    }
    return toks;
  }

  private expand(t: { v: string; glob: boolean }): string[] {
    if (!t.glob) return [t.v];
    const slash = t.v.lastIndexOf("/");
    const dirPart = slash >= 0 ? t.v.slice(0, slash + 1) : "";
    const pat = t.v.slice(slash + 1);
    const dir = this.resolve(dirPart || ".");
    if (/[*?]/.test(dirPart) || !this.dirs.has(dir) || !this.canRead(dir)) return [t.v];
    const re = globRe(pat);
    const hits = this.children(dir).filter((n) => re.test(n) && (pat.startsWith(".") || !n.startsWith(".")));
    return hits.length ? hits.map((n) => dirPart + n) : [t.v];
  }

  complete(partial: string): string[] {
    const words = partial.split(/\s+/);
    const last = words[words.length - 1];
    if (words.length === 1) {
      const cmds = new Set([...Object.keys(BUILTINS), ...Object.keys(this.spec.programs ?? {}), "help"]);
      return [...cmds].filter((c) => c.startsWith(last)).sort();
    }
    const slash = last.lastIndexOf("/");
    const dirPart = slash >= 0 ? last.slice(0, slash + 1) : "";
    const dir = this.resolve(dirPart || ".");
    if (!this.dirs.has(dir) || !this.canRead(dir)) return [];
    const pre = last.slice(slash + 1);
    return this.children(dir)
      .filter((n) => n.startsWith(pre) && (pre.startsWith(".") || !n.startsWith(".")))
      .map((n) => dirPart + n + (this.dirs.has(dir === "/" ? "/" + n : `${dir}/${n}`) ? "/" : ""));
  }
}

function gather(sh: Shell, cmd: string, operands: string[], stdin: string) {
  if (!operands.length) return { inputs: [{ name: "(standard input)", data: stdin }], err: "" };
  const inputs: { name: string; data: string }[] = [];
  let err = "";
  for (const a of operands) {
    if (a === "-") { inputs.push({ name: "(standard input)", data: stdin }); continue; }
    const r = sh.readFile(a, cmd);
    if ("err" in r) err += r.err; else inputs.push({ name: a, data: r.data });
  }
  return { inputs, err };
}

function headTail(which: "head" | "tail"): Builtin {
  return (sh, args, stdin) => {
    let n = 10, fromStart = false;
    const rest0: string[] = [];
    for (const a of args) { const m = /^-(\d+)$/.exec(a); if (m) n = +m[1]; else rest0.push(a); }
    const { flags, rest } = parseArgs(rest0, "n");
    if (typeof flags.n === "string") { fromStart = flags.n.startsWith("+"); n = parseInt(flags.n.replace(/^\+/, ""), 10) || 0; }
    const { inputs, err } = gather(sh, which, rest, stdin);
    const out: string[] = [];
    inputs.forEach((inp, i) => {
      if (inputs.length > 1) { if (i) out.push(""); out.push(`==> ${inp.name} <==`); }
      const ls = lines(inp.data);
      out.push(...(which === "head" ? ls.slice(0, n) : fromStart ? ls.slice(Math.max(0, n - 1)) : ls.slice(Math.max(0, ls.length - n))));
    });
    return { out: text(out), err, code: err ? 1 : 0 };
  };
}

const BUILTINS: Record<string, Builtin> = {
  help(sh, args) {
    const name = args[0];
    if (name) {
      const h = HELP[name];
      if (h) return ok(`${name} — ${h[0]}\n  example: ${h[1]}\n`);
      if (sh.spec.programs?.[name]) return ok(`${name} — a lab tool with simulated output. Try one of the suggested commands.\n`);
      return fail(`help: no help for '${name}'`);
    }
    const width = Math.max(...Object.keys(HELP).map((k) => k.length));
    const out = ["Commands in this lab (help <command> for an example):", ""];
    for (const [k, [d]] of Object.entries(HELP)) out.push(`  ${k.padEnd(width)}  ${d}`);
    const progs = Object.keys(sh.spec.programs ?? {}).filter((p) => !HELP[p]);
    if (progs.length) out.push("", `Lab tools with simulated output: ${progs.join(", ")}`);
    out.push("", "Tips: ↑/↓ recall commands · Tab completes names · | sends output to the next command · 2>/dev/null hides errors");
    return ok(text(out));
  },
  pwd: (sh) => ok(sh.cwd + "\n"),
  whoami: (sh) => ok(sh.spec.user + "\n"),
  hostname: (sh) => ok(sh.spec.host + "\n"),
  id: (sh) => ok((sh.spec.id ?? `uid=1000(${sh.spec.user}) gid=1000(${sh.spec.user}) groups=1000(${sh.spec.user})`) + "\n"),
  uname: (sh, args) => ok((args.some((a) => a.includes("a")) ? sh.spec.uname ?? "Linux " + sh.spec.host + " 6.8.0-45-generic x86_64 GNU/Linux" : "Linux") + "\n"),
  history: (sh) => ok(text(sh.history.map((h, i) => `${String(i + 1).padStart(5)}  ${h}`))),
  echo(_sh, args) {
    const noNl = args[0] === "-n";
    return ok((noNl ? args.slice(1) : args).join(" ") + (noNl ? "" : "\n"));
  },
  exit: () => ok("logout — (this is a lab terminal, so it stays open)\n"),
  man: (_sh, args) => fail(`No manual entry for ${args[0] ?? "that"} — try: help ${args[0] ?? ""}`.trim()),
  sudo: (_sh, args) => fail(args.length ? `sudo: a password is required (simulated) — try: sudo -l` : "usage: sudo -l | sudo <command>"),

  cd(sh, args) {
    const t = args[0] ?? "~";
    const p = sh.resolve(t);
    if (!sh.canReach(p)) return fail(`cd: ${t}: Permission denied`);
    if (!sh.dirs.has(p)) return fail(sh.files.has(p) ? `cd: ${t}: Not a directory` : `cd: ${t}: No such file or directory`);
    if (!sh.canRead(p)) return fail(`cd: ${t}: Permission denied`);
    sh.cwd = p;
    return ok("");
  },

  ls(sh, args, _stdin, tty) {
    const { flags, rest } = parseArgs(args);
    const long = !!flags.l, all = !!flags.a || !!flags.A;
    const targets = rest.length ? rest : ["."];
    const out: string[] = [];
    let err = "";
    const fmt = (p: string, name: string) => {
      const m = sh.meta(p);
      const size = sh.dirs.has(p) ? 4096 : (sh.files.get(p) ?? "").length;
      return `${m.mode} ${sh.dirs.has(p) ? 2 : 1} ${m.owner.padEnd(7)} ${m.group.padEnd(7)} ${String(size).padStart(6)} ${m.mtime} ${name}`;
    };
    const isDir = (t: string) => sh.dirs.has(sh.resolve(t)) && sh.canReach(sh.resolve(t));
    for (const t of targets.filter((x) => !isDir(x))) {
      const p = sh.resolve(t);
      if (!sh.canReach(p)) { err += `ls: cannot access '${t}': Permission denied\n`; continue; }
      if (!sh.files.has(p)) { err += `ls: cannot access '${t}': No such file or directory\n`; continue; }
      out.push(long ? fmt(p, t) : t);
    }
    for (const t of targets.filter(isDir)) {
      const p = sh.resolve(t);
      if (targets.length > 1) { if (out.length) out.push(""); out.push(`${t}:`); }
      if (!sh.canRead(p)) { err += `ls: cannot open directory '${t}': Permission denied\n`; continue; }
      let names = sh.children(p);
      if (!all) names = names.filter((n) => !n.startsWith("."));
      else if (!flags.A) names = [".", "..", ...names];
      if (long) {
        out.push(`total ${names.length * 4}`);
        for (const n of names) out.push(fmt(n === "." ? p : n === ".." ? parentOf(p) : p === "/" ? "/" + n : `${p}/${n}`, n));
      } else if (names.length) {
        if (tty) out.push(names.join("  ")); else out.push(...names);
      }
    }
    return { out: text(out), err, code: err ? 2 : 0 };
  },

  cat(sh, args, stdin) {
    const { flags, rest } = parseArgs(args);
    if (!rest.length) return ok(stdin);
    let out = "", err = "";
    for (const a of rest) {
      if (a === "-") { out += stdin; continue; }
      const r = sh.readFile(a, "cat");
      if ("err" in r) err += r.err;
      else out += !r.data || r.data.endsWith("\n") ? r.data : r.data + "\n";
    }
    if (flags.n) out = text(lines(out).map((l, i) => `${String(i + 1).padStart(6)}\t${l}`));
    return { out, err, code: err ? 1 : 0 };
  },

  head: headTail("head"),
  tail: headTail("tail"),

  grep(sh, args, stdin) {
    const { flags, rest } = parseArgs(args, "em");
    let pattern: string;
    if (typeof flags.e === "string") pattern = flags.e;
    else if (rest.length) pattern = rest.shift()!;
    else return fail("usage: grep [-ivcnrlowE] PATTERN [FILE...]", 2);
    let src = flags.F ? escapeRe(pattern) : flags.E || flags.P ? pattern : breToJs(pattern);
    if (flags.w) src = `\\b(?:${src})\\b`;
    if (flags.x) src = `^(?:${src})$`;
    let re: RegExp;
    try { re = new RegExp(src, flags.i ? "gi" : "g"); } catch { return fail(`grep: invalid regular expression: ${pattern}`, 2); }

    let targets: { name: string; data: string }[] = [];
    let err = "";
    const recursive = !!flags.r || !!flags.R;
    if (recursive) {
      for (const r0 of rest.length ? rest : ["."]) {
        const p = sh.resolve(r0);
        if (!sh.dirs.has(p)) { const r = sh.readFile(r0, "grep"); if ("err" in r) err += r.err; else targets.push({ name: r0, data: r.data }); continue; }
        const { entries, denied } = sh.walk(p, r0 === "." ? "" : r0);
        for (const e of entries) {
          if (!sh.files.has(e.path)) continue;
          const name = e.shown.replace(/^\//, r0 === "." ? "" : "/");
          if (sh.canRead(e.path)) targets.push({ name, data: sh.files.get(e.path)! });
          else err += `grep: ${name}: Permission denied\n`;
        }
        for (const d of denied) err += `grep: ${d || "."}: Permission denied\n`;
      }
    } else {
      for (const a of rest) if (sh.dirs.has(sh.resolve(a))) err += `grep: ${a}: Is a directory\n`;
      const g = gather(sh, "grep", rest.filter((a) => !sh.dirs.has(sh.resolve(a))), stdin);
      if (rest.length && !g.inputs.length && !g.err && err) return { out: "", err, code: 2 };
      targets = g.inputs;
      err += g.err;
    }

    const showName = !flags.h && (recursive || targets.length > 1);
    const out: string[] = [];
    let matched = false;
    for (const t of targets) {
      let count = 0;
      const binary = /[\x00-\x08]/.test(t.data) && !flags.a;
      const hits: string[] = [];
      lines(t.data).forEach((line, i) => {
        re.lastIndex = 0;
        if (re.test(line) === !!flags.v) return;
        count++;
        const prefix = (showName ? `${t.name}:` : "") + (flags.n ? `${i + 1}:` : "");
        if (flags.o && !flags.v) { re.lastIndex = 0; for (const m of line.matchAll(re)) hits.push(prefix + m[0]); }
        else hits.push(prefix + line);
      });
      if (count) matched = true;
      if (flags.c) out.push((showName ? `${t.name}:` : "") + count);
      else if (flags.l) { if (count) out.push(t.name); }
      else if (binary) { if (count) out.push(`Binary file ${t.name} matches`); }
      else out.push(...hits);
    }
    return { out: text(out), err, code: matched ? 0 : err ? 2 : 1 };
  },

  wc(sh, args, stdin) {
    const { flags, rest } = parseArgs(args);
    const picked = (["l", "w", "c"] as const).filter((k) => flags[k]);
    const sel = picked.length ? picked : (["l", "w", "c"] as const);
    const { inputs, err } = gather(sh, "wc", rest, stdin);
    const out = inputs.map((inp) => {
      const c = { l: (inp.data.match(/\n/g) ?? []).length + (inp.data && !inp.data.endsWith("\n") ? 1 : 0), w: inp.data.split(/\s+/).filter(Boolean).length, c: inp.data.length };
      const nums = sel.map((k) => c[k]);
      return (nums.length === 1 ? `${nums[0]}` : nums.map((n) => String(n).padStart(7)).join(" ")) + (rest.length ? ` ${inp.name}` : "");
    });
    return { out: text(out), err, code: err ? 1 : 0 };
  },

  sort(sh, args, stdin) {
    const { flags, rest } = parseArgs(args, "kt");
    const { inputs, err } = gather(sh, "sort", rest, stdin);
    const ls = inputs.flatMap((i) => lines(i.data));
    const sep = typeof flags.t === "string" ? flags.t : null;
    const k = typeof flags.k === "string" ? parseInt(flags.k, 10) : 0;
    const key = (l: string) => (!k ? l : (sep ? l.split(sep) : l.trim().split(/\s+/)).slice(k - 1).join(sep ?? " "));
    const num = (s: string) => { const m = /^\s*(-?\d+(\.\d+)?)/.exec(s); return m ? parseFloat(m[1]) : 0; };
    ls.sort((a, b) => {
      if (flags.n) return num(key(a)) - num(key(b));
      const x = key(a), y = key(b);
      return x < y ? -1 : x > y ? 1 : 0;
    });
    if (flags.r) ls.reverse();
    const res = flags.u ? ls.filter((l, i) => i === 0 || l !== ls[i - 1]) : ls;
    return { out: text(res), err, code: err ? 2 : 0 };
  },

  uniq(sh, args, stdin) {
    const { flags, rest } = parseArgs(args);
    const { inputs, err } = gather(sh, "uniq", rest.slice(0, 1), stdin);
    const groups: [string, number][] = [];
    for (const l of lines(inputs[0]?.data ?? "")) {
      const last = groups[groups.length - 1];
      if (last && (flags.i ? last[0].toLowerCase() === l.toLowerCase() : last[0] === l)) last[1]++;
      else groups.push([l, 1]);
    }
    const sel = groups.filter(([, n]) => (flags.d ? n > 1 : flags.u ? n === 1 : true));
    return { out: text(sel.map(([l, n]) => (flags.c ? `${String(n).padStart(7)} ${l}` : l))), err, code: err ? 1 : 0 };
  },

  cut(sh, args, stdin) {
    const { flags, rest } = parseArgs(args, "dfc");
    if (typeof flags.f !== "string") return fail("cut: you must say which fields to keep, e.g. cut -d: -f1");
    const d = typeof flags.d === "string" ? flags.d : "\t";
    const want = flags.f.split(",").map((r) => { const [a, b] = r.split("-"); return [a ? +a : 1, b === undefined ? (a ? +a : 1) : b ? +b : Infinity] as const; });
    const keep = (n: number) => want.some(([a, b]) => n >= a && n <= b);
    const { inputs, err } = gather(sh, "cut", rest, stdin);
    const out = inputs.flatMap((i) => lines(i.data)).map((l) => {
      const parts = l.split(d);
      return parts.length === 1 ? l : parts.filter((_, i) => keep(i + 1)).join(d);
    });
    return { out: text(out), err, code: err ? 1 : 0 };
  },

  awk(sh, args, stdin) {
    const { flags, rest } = parseArgs(args, "F");
    const prog = rest.shift();
    const m = prog !== undefined ? /^\s*(?:\/((?:[^/\\]|\\.)*)\/)?\s*(?:\{\s*print\s*(.*?)\s*;?\s*\})?\s*$/.exec(prog) : null;
    if (!m || (m[1] === undefined && m[2] === undefined)) return fail("awk: this lab supports '{print $1}' and '/regex/ {print $1}' — e.g. awk '{print $1}' file");
    let re: RegExp | null = null;
    try { re = m[1] !== undefined ? new RegExp(m[1]) : null; } catch { return fail("awk: bad regular expression"); }
    const sep = typeof flags.F === "string" ? flags.F : null;
    const { inputs, err } = gather(sh, "awk", rest, stdin);
    const out: string[] = [];
    try {
      for (const l of inputs.flatMap((i) => lines(i.data))) {
        if (re && !re.test(l)) continue;
        if (!m[2]) { out.push(l); continue; }
        const f = sep ? l.split(sep.length === 1 ? sep : new RegExp(sep)) : l.trim().split(/\s+/);
        out.push(awkPrint(m[2], (n) => (n === 0 ? l : f[n - 1] ?? ""), f.length));
      }
    } catch (e) { return fail((e as Error).message); }
    return { out: text(out), err, code: err ? 2 : 0 };
  },

  base64(sh, args, stdin) {
    const { flags, rest } = parseArgs(args);
    const { inputs, err } = gather(sh, "base64", rest.slice(0, 1), stdin);
    if (err) return { out: "", err, code: 1 };
    const data = inputs.map((i) => i.data).join("");
    try {
      if (flags.d || flags.decode) return ok(atob(data.replace(/\s+/g, "")));
      return ok(btoa(data).replace(/.{76}/g, "$&\n") + "\n");
    } catch {
      return fail("base64: invalid input");
    }
  },

  xxd(sh, args, stdin) {
    const { flags, rest } = parseArgs(args, "ls");
    const { inputs, err } = gather(sh, "xxd", rest.slice(0, 1), stdin);
    if (err) return { out: "", err, code: 1 };
    const d = inputs[0].data;
    const start = typeof flags.s === "string" ? parseInt(flags.s) || 0 : 0;
    const end = Math.min(d.length, typeof flags.l === "string" ? start + (parseInt(flags.l) || 0) : d.length);
    const out: string[] = [];
    for (let off = start; off < end; off += 16) {
      const chunk = d.slice(off, Math.min(off + 16, end));
      const hex = [...chunk].map((c) => (c.charCodeAt(0) & 255).toString(16).padStart(2, "0"));
      const groups: string[] = [];
      for (let i = 0; i < 16; i += 2) groups.push((hex[i] ?? "  ") + (hex[i + 1] ?? "  "));
      const ascii = [...chunk].map((c) => { const n = c.charCodeAt(0); return n >= 32 && n < 127 ? c : "."; }).join("");
      out.push(`${off.toString(16).padStart(8, "0")}: ${groups.join(" ")}  ${ascii}`);
    }
    return ok(text(out));
  },

  file(sh, args) {
    const ops = args.filter((a) => !a.startsWith("-"));
    if (!ops.length) return fail("usage: file FILE...");
    const out = ops.map((a) => {
      const p = sh.resolve(a);
      if (sh.dirs.has(p) && sh.canReach(p)) return `${a}: directory`;
      const r = sh.readFile(a, "file");
      if ("err" in r) return `${a}: cannot open \`${a}' (${r.err.includes("Permission") ? "Permission denied" : "No such file or directory"})`;
      return `${a}: ${magic(r.data)}`;
    });
    return ok(text(out));
  },

  strings(sh, args, stdin) {
    const { flags, rest } = parseArgs(args, "n");
    const n = typeof flags.n === "string" ? parseInt(flags.n, 10) || 4 : 4;
    const { inputs, err } = gather(sh, "strings", rest.slice(0, 1), stdin);
    const re = new RegExp(`[\\x20-\\x7e\\t]{${n},}`, "g");
    return { out: text(inputs.flatMap((i) => i.data.match(re) ?? [])), err, code: err ? 1 : 0 };
  },

  binwalk(sh, args) {
    const { flags, rest } = parseArgs(args);
    if (!rest.length) return fail("usage: binwalk [-e] FILE");
    const r = sh.readFile(rest[0], "binwalk");
    if ("err" in r) return fail(r.err);
    const hits = scanSignatures(r.data);
    const out = ["", "DECIMAL       HEXADECIMAL     DESCRIPTION", "-".repeat(80)];
    for (const h of hits) out.push(`${String(h.off).padEnd(14)}${("0x" + h.off.toString(16).toUpperCase()).padEnd(16)}${h.desc}`);
    out.push("");
    if (flags.e) {
      const entries = zipEntries(r.data);
      const zip = hits.find((h) => h.kind === "zip");
      if (!zip || !entries.length) out.push("Nothing extractable was found.");
      else {
        const name = `_${baseOf(rest[0])}.extracted`;
        const dir = sh.resolve(name);
        if (!(dir.startsWith(sh.spec.home + "/") || dir.startsWith("/tmp/"))) return fail(`binwalk: cannot create ${name}: Permission denied (cd to your home folder first)`);
        sh.dirs.add(dir);
        sh.files.set(`${dir}/${zip.off.toString(16).toUpperCase()}.zip`, r.data.slice(zip.off));
        for (const e of entries) sh.files.set(`${dir}/${e.name}`, e.data);
        out.push(`Extracted ${entries.length + 1} file(s) into ${name}/  →  try: ls ${name}`);
      }
    }
    return ok(text(out));
  },

  unzip(sh, args) {
    const { flags, rest } = parseArgs(args);
    if (!rest.length) return fail("usage: unzip [-l] FILE");
    const r = sh.readFile(rest[0], "unzip");
    if ("err" in r) return fail(`unzip: cannot find or open ${rest[0]}`);
    const entries = zipEntries(r.data);
    if (!entries.length) return fail(`unzip: End-of-central-directory signature not found — ${rest[0]} is not a zip file`, 9);
    if (flags.l) {
      const out = [`Archive:  ${rest[0]}`, "  Length      Date    Time    Name", "---------  ---------- -----   ----"];
      for (const e of entries) out.push(`${String(e.data.length).padStart(9)}  2026-10-23 09:14   ${e.name}`);
      out.push("---------                     -------", `${String(entries.reduce((s, e) => s + e.data.length, 0)).padStart(9)}                     ${entries.length} file(s)`);
      return ok(text(out));
    }
    const out = [`Archive:  ${rest[0]}`];
    for (const e of entries) {
      const w = sh.write(e.name, e.data, false);
      if (w) return { out: text(out), err: w, code: 1 };
      out.push(` extracting: ${e.name}`);
    }
    return ok(text(out));
  },

  find(sh, args) {
    const roots: string[] = [];
    let i = 0;
    while (i < args.length && !args[i].startsWith("-")) roots.push(args[i++]);
    if (!roots.length) roots.push(".");
    const tests: ((p: string) => boolean)[] = [];
    let maxDepth = Infinity, minDepth = 0;
    for (; i < args.length; i++) {
      const a = args[i], v = args[i + 1];
      const need = () => { if (v === undefined) throw new Error(`find: missing argument to \`${a}'`); i++; return v; };
      switch (a) {
        case "-name": case "-iname": { const re = globRe(need(), a === "-iname" ? "i" : ""); tests.push((p) => re.test(baseOf(p))); break; }
        case "-type": { const t = need(); if (t !== "f" && t !== "d") return fail(`find: Unknown argument to -type: ${t}`); tests.push((p) => (t === "d") === sh.dirs.has(p)); break; }
        case "-user": { const u = need(); tests.push((p) => sh.meta(p).owner === u); break; }
        case "-group": { const g = need(); tests.push((p) => sh.meta(p).group === g); break; }
        case "-perm": { const t = permTest(need()); if (!t) return fail("find: this lab supports -perm -4000 (SUID), -2000 (SGID) and -o+w (world-writable)"); tests.push((p) => t(sh.meta(p).mode)); break; }
        case "-writable": tests.push((p) => sh.writable(p)); break;
        case "-readable": tests.push((p) => sh.canRead(p)); break;
        case "-maxdepth": maxDepth = parseInt(need(), 10); break;
        case "-mindepth": minDepth = parseInt(need(), 10); break;
        case "-print": break;
        case "-exec": case "-execdir": case "-delete": case "-ok":
          return fail(`find: ${a} is disabled in this lab — pipe the results into another command instead`);
        default:
          return fail(`find: unknown or unsupported option '${a}' (help find)`);
      }
    }
    const out: string[] = [];
    let err = "";
    for (const r of roots) {
      const p = sh.resolve(r);
      if (!sh.canReach(p)) { err += `find: '${r}': Permission denied\n`; continue; }
      if (!sh.dirs.has(p) && !sh.files.has(p)) { err += `find: '${r}': No such file or directory\n`; continue; }
      const { entries, denied } = sh.walk(p, r, maxDepth);
      for (const e of entries) if (e.depth >= minDepth && tests.every((t) => t(e.path))) out.push(e.shown);
      for (const d of denied) err += `find: '${d}': Permission denied\n`;
    }
    return { out: text(out), err, code: err ? 1 : 0 };
  },

  // ── Create and organise files ──────────────────────────────────────────────
  mkdir(sh, args) {
    const { flags, rest } = parseArgs(args);
    if (!rest.length) return fail("mkdir: missing operand — e.g. mkdir evidence");
    let err = "";
    for (const a of rest) {
      const p = sh.resolve(a);
      if (sh.files.has(p) || (sh.dirs.has(p) && !flags.p)) { err += `mkdir: cannot create directory '${a}': File exists\n`; continue; }
      if (sh.dirs.has(p)) continue;
      if (!sh.ownArea(p)) { err += `mkdir: cannot create directory '${a}': Permission denied\n`; continue; }
      const chain: string[] = [];
      let d = p;
      for (; !sh.dirs.has(d); d = parentOf(d)) chain.push(d);
      if (chain.length > 1 && !flags.p) { err += `mkdir: cannot create directory '${a}': No such file or directory (add -p to make the parent folders too)\n`; continue; }
      if (chain.some((c) => sh.files.has(c))) { err += `mkdir: cannot create directory '${a}': Not a directory\n`; continue; }
      chain.forEach((c) => sh.dirs.add(c));
    }
    return { out: "", err, code: err ? 1 : 0 };
  },

  touch(sh, args) {
    const { rest } = parseArgs(args);
    if (!rest.length) return fail("touch: missing file operand — e.g. touch notes.txt");
    let err = "";
    for (const a of rest) {
      const p = sh.resolve(a);
      if (sh.files.has(p) || sh.dirs.has(p)) continue;
      const why = sh.cantWrite(p);
      if (why) err += `touch: cannot touch '${a}': ${why}\n`;
      else sh.files.set(p, "");
    }
    return { out: "", err, code: err ? 1 : 0 };
  },

  cp(sh, args) {
    const { flags, rest } = parseArgs(args);
    if (rest.length < 2) return fail("cp: missing destination — e.g. cp auth.log evidence/");
    const dest = rest.pop()!;
    const dp = sh.resolve(dest);
    const intoDir = sh.dirs.has(dp);
    if (rest.length > 1 && !intoDir) return fail(`cp: target '${dest}' is not a directory`);
    let err = "";
    for (const s of rest) {
      const sp = sh.resolve(s);
      if (sh.dirs.has(sp)) { err += flags.r || flags.R ? `cp: copying whole folders isn't supported in this lab — copy the files inside instead\n` : `cp: -r not specified; omitting directory '${s}'\n`; continue; }
      if (!sh.files.has(sp)) { err += `cp: cannot stat '${s}': No such file or directory\n`; continue; }
      const r = sh.readFile(s, "cp");
      if ("err" in r) { err += `cp: cannot open '${s}' for reading: Permission denied\n`; continue; }
      const target = intoDir ? `${dp === "/" ? "" : dp}/${baseOf(sp)}` : dp;
      if (target === sp) { err += `cp: '${s}' and '${dest}' are the same file\n`; continue; }
      const why = sh.cantWrite(target);
      if (why) { err += `cp: cannot create regular file '${dest}': ${why}\n`; continue; }
      sh.files.set(target, r.data);
    }
    return { out: "", err, code: err ? 1 : 0 };
  },

  mv(sh, args) {
    const { rest } = parseArgs(args);
    if (rest.length < 2) return fail("mv: missing destination — e.g. mv draft.txt final.txt");
    const dest = rest.pop()!;
    const dp = sh.resolve(dest);
    const intoDir = sh.dirs.has(dp);
    if (rest.length > 1 && !intoDir) return fail(`mv: target '${dest}' is not a directory`);
    let err = "";
    for (const s of rest) {
      const sp = sh.resolve(s);
      if (!sh.files.has(sp) && !sh.dirs.has(sp)) { err += `mv: cannot stat '${s}': No such file or directory\n`; continue; }
      if (!sh.ownArea(sp)) { err += `mv: cannot move '${s}': Permission denied\n`; continue; }
      const target = intoDir ? `${dp === "/" ? "" : dp}/${baseOf(sp)}` : dp;
      if (target === sp) { err += `mv: '${s}' and '${dest}' are the same file\n`; continue; }
      if (sh.dirs.has(sp)) {
        if (target.startsWith(sp + "/")) { err += `mv: cannot move '${s}' to a subdirectory of itself\n`; continue; }
        if (sh.files.has(target) || sh.dirs.has(target)) { err += `mv: cannot move '${s}' to '${dest}': File exists\n`; continue; }
        if (!sh.ownArea(target) || !sh.dirs.has(parentOf(target))) { err += `mv: cannot move '${s}' to '${dest}': ${sh.ownArea(target) ? "No such file or directory" : "Permission denied"}\n`; continue; }
      } else {
        const why = sh.cantWrite(target);
        if (why) { err += `mv: cannot move '${s}' to '${dest}': ${why}\n`; continue; }
        sh.files.delete(target);
        sh.modes.delete(target);
      }
      sh.moveTree(sp, target);
    }
    return { out: "", err, code: err ? 1 : 0 };
  },

  rm(sh, args) {
    const { flags, rest } = parseArgs(args);
    if (!rest.length) return fail("rm: missing operand — e.g. rm scratch.tmp");
    let err = "";
    for (const a of rest) {
      const p = sh.resolve(a);
      if (!sh.files.has(p) && !sh.dirs.has(p)) { if (!flags.f) err += `rm: cannot remove '${a}': No such file or directory\n`; continue; }
      if (sh.dirs.has(p) && !(flags.r || flags.R)) { err += `rm: cannot remove '${a}': Is a directory (use rm -r for folders)\n`; continue; }
      if (!sh.ownArea(p)) { err += `rm: cannot remove '${a}': Permission denied\n`; continue; }
      sh.removeTree(p);
    }
    return { out: "", err, code: err ? 1 : 0 };
  },

  chmod(sh, args) {
    // Not parseArgs: a mode like -x would look like a flag.
    const ops = args.filter((a) => a !== "-R");
    if (ops.length < 2) return fail("chmod: missing operand — e.g. chmod 600 secret.txt or chmod +x script.sh");
    const [mode, ...targets] = ops;
    let err = "";
    for (const a of targets) {
      const p = sh.resolve(a);
      if (!sh.canReach(p) || (!sh.files.has(p) && !sh.dirs.has(p))) { err += `chmod: cannot access '${a}': No such file or directory\n`; continue; }
      const m = sh.meta(p);
      if (m.owner !== sh.spec.user) { err += `chmod: changing permissions of '${a}': Operation not permitted\n`; continue; }
      const next = applyMode(m.mode, mode);
      if (!next) return fail(`chmod: invalid mode: '${mode}' — try 644, 600, 755 or +x`);
      sh.modes.set(p, next);
    }
    return { out: "", err, code: err ? 1 : 0 };
  },

  // ── Change text ────────────────────────────────────────────────────────────
  tr(_sh, args, stdin) {
    const flags = new Set<string>();
    let i = 0;
    for (; i < args.length && /^-[ds]+$/.test(args[i]); i++) for (const f of args[i].slice(1)) flags.add(f);
    const sets = args.slice(i);
    const max = flags.has("d") && !flags.has("s") ? 1 : 2;
    if (sets.length > max) return fail(`tr: extra operand '${sets[max]}'\ntr only reads from a pipe or <, e.g. tr a-z A-Z < notes.txt  or  cat notes.txt | tr a-z A-Z`);
    if (!sets.length || (!flags.size && sets.length < 2)) return fail("tr: missing operand — e.g. tr a-z A-Z < notes.txt");
    let data = stdin;
    if (flags.has("d")) {
      const del = new Set(trSet(sets[0]));
      data = [...data].filter((c) => !del.has(c)).join("");
    } else if (sets.length === 2) {
      const from = trSet(sets[0]), to = trSet(sets[1]);
      const map = new Map(from.map((c, k) => [c, to[Math.min(k, to.length - 1)] ?? ""]));
      data = [...data].map((c) => map.get(c) ?? c).join("");
    }
    if (flags.has("s")) {
      const sq = new Set(trSet(sets[sets.length - 1]));
      data = [...data].filter((c, k, all) => !(k > 0 && c === all[k - 1] && sq.has(c))).join("");
    }
    return ok(data);
  },

  sed(sh, args, stdin) {
    const { flags, rest } = parseArgs(args, "e");
    let script: string;
    if (typeof flags.e === "string") script = flags.e;
    else if (rest.length) script = rest.shift()!;
    else return fail("usage: sed [-n] [-E] 'SCRIPT' [FILE] — e.g. sed 's/old/new/' file");
    let cmds: SedCmd[];
    try { cmds = parseSed(script, !!(flags.E || flags.r)); } catch (e) { return fail((e as Error).message); }
    const quiet = !!flags.n;
    if (flags.i) {
      if (!rest.length) return fail("sed: -i edits a file in place, so it needs a file name");
      let err = "";
      for (const a of rest) {
        const r = sh.readFile(a, "sed");
        if ("err" in r) { err += r.err; continue; }
        const w = sh.write(a, runSed(cmds, r.data, quiet), false);
        if (w) err += w.replace(/^bash: /, "sed: couldn't edit ");
      }
      return { out: "", err, code: err ? 4 : 0 };
    }
    const { inputs, err } = gather(sh, "sed", rest, stdin);
    return { out: runSed(cmds, text(inputs.flatMap((x) => lines(x.data))), quiet), err, code: err ? 2 : 0 };
  },

  rev(sh, args, stdin) {
    const { inputs, err } = gather(sh, "rev", args.filter((a) => a === "-" || !a.startsWith("-")), stdin);
    return { out: text(inputs.flatMap((x) => lines(x.data)).map((l) => [...l].reverse().join(""))), err, code: err ? 1 : 0 };
  },

  tee(sh, args, stdin) {
    const { flags, rest } = parseArgs(args);
    let err = "";
    for (const a of rest) { const w = sh.write(a, stdin, !!flags.a); if (w) err += w.replace(/^bash: /, "tee: "); }
    return { out: stdin, err, code: err ? 1 : 0 };
  },

  // ── Check and compare ──────────────────────────────────────────────────────
  diff(sh, args) {
    const { rest } = parseArgs(args);
    if (rest.length !== 2) return fail("usage: diff FILE1 FILE2", 2);
    const a = sh.readFile(rest[0], "diff"), b = sh.readFile(rest[1], "diff");
    if ("err" in a) return fail(a.err, 2);
    if ("err" in b) return fail(b.err, 2);
    const out = diffLines(lines(a.data), lines(b.data));
    return { out: text(out), err: "", code: out.length ? 1 : 0 };
  },

  sha256sum(sh, args, stdin) {
    const { flags, rest } = parseArgs(args);
    if (flags.c) {
      if (!rest.length) return fail("sha256sum: -c needs a checksum list, e.g. sha256sum -c CHECKSUMS.txt");
      const list = sh.readFile(rest[0], "sha256sum");
      if ("err" in list) return fail(list.err);
      const out: string[] = [];
      let bad = 0, unread = 0;
      for (const l of lines(list.data)) {
        const m = /^([0-9a-fA-F]{64}) [ *](.+)$/.exec(l.trim());
        if (!m) continue;
        const r = sh.readFile(m[2], "sha256sum");
        if ("err" in r) { out.push(`${m[2]}: FAILED open or read`); unread++; continue; }
        const same = sha256Hex(r.data) === m[1].toLowerCase();
        if (!same) bad++;
        out.push(`${m[2]}: ${same ? "OK" : "FAILED"}`);
      }
      let err = "";
      if (unread) err += `sha256sum: WARNING: ${unread} listed file${unread > 1 ? "s" : ""} could not be read (run it from the folder the list describes)\n`;
      if (bad) err += `sha256sum: WARNING: ${bad} computed checksum${bad > 1 ? "s" : ""} did NOT match\n`;
      return { out: text(out), err, code: bad || unread ? 1 : 0 };
    }
    if (!rest.length) return ok(`${sha256Hex(stdin)}  -\n`);
    const out: string[] = [];
    let err = "";
    for (const a of rest) {
      if (sh.dirs.has(sh.resolve(a))) { err += `sha256sum: ${a}: Is a directory\n`; continue; }
      const r = sh.readFile(a, "sha256sum");
      if ("err" in r) err += r.err; else out.push(`${sha256Hex(r.data)}  ${a}`);
    }
    return { out: text(out), err, code: err ? 1 : 0 };
  },

  // ── Triage a machine ───────────────────────────────────────────────────────
  ps(sh, args) {
    const me = sh.spec.user;
    const cmdline = ["ps", ...args].join(" ");
    const mine = [{ user: me, pid: 2001, cmd: "-bash", tty: "pts/0", stat: "Ss" }, { user: me, pid: 2042, cmd: cmdline, tty: "pts/0", stat: "R+" }];
    if (!args.length) {
      const out = ["    PID TTY          TIME CMD", ...mine.map((p) => `${String(p.pid).padStart(7)} pts/0    00:00:00 ${p.cmd.replace(/^-/, "").split(" ")[0]}`)];
      return ok(text(out));
    }
    const all = [
      ...(sh.spec.procs ?? []).map((p) => ({ ...p, tty: "?", stat: "S" })),
      ...mine.map((p) => ({ ...p, start: "09:30", cpu: "0.0" })),
    ];
    const out = ["USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND"];
    for (const p of all) {
      const vsz = 6000 + ((p.pid * 7919) % 200000), rss = 2000 + ((p.pid * 104729) % 50000);
      out.push(`${p.user.padEnd(8)} ${String(p.pid).padStart(6)} ${(p.cpu ?? "0.0").padStart(4)}  0.1 ${String(vsz).padStart(6)} ${String(rss).padStart(5)} ${p.tty.padEnd(8)} ${p.stat.padEnd(4)} ${p.start ?? "09:00"}   0:00 ${p.cmd}`);
    }
    return ok(text(out));
  },

  ss(sh, args) {
    const { flags } = parseArgs(args);
    const out = [`State   Recv-Q  Send-Q   ${"Local Address:Port".padStart(22)}   ${"Peer Address:Port".padEnd(18)}${flags.p ? " Process" : ""}`];
    if (flags.l) {
      for (const p of sh.spec.ports ?? []) {
        const port = flags.n ? String(p.port) : SERVICE[p.port] ?? String(p.port);
        const local = `${p.addr ?? "0.0.0.0"}:${port}`;
        out.push(`LISTEN  0       128      ${local.padStart(22)}   ${"0.0.0.0:*".padEnd(18)}${flags.p ? ` users:(("${p.proc}",pid=${p.pid},fd=3))` : ""}`);
      }
    }
    return ok(text(out));
  },

  date: (sh) => ok((sh.spec.date ?? "Fri Oct 23 09:30:00 UTC 2026") + "\n"),

  which(sh, args) {
    const out: string[] = [];
    let code = 0;
    for (const a of args) { if (BUILTINS[a] || sh.spec.programs?.[a]) out.push(`/usr/bin/${a}`); else code = 1; }
    return { out: text(out), err: "", code };
  },
};
