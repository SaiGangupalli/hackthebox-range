// A tiny, deterministic Unix-like shell over an in-memory filesystem, used by the
// in-page practice terminals. Pure TypeScript: nothing touches a real machine.
// Binary files are latin1 strings (one char = one byte), so xxd/file/binwalk see
// real magic bytes.

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
  motd?: string;
  suggest?: string[]; // clickable starter commands
};

export type RunResult = { out: string; clear?: boolean };

type Res = { out: string; err: string; code: number };
type Cmd = { argv: string[]; quiet: boolean; merge: boolean; redirect?: { path: string; append: boolean } };
type Step = { pipeline: Cmd[]; sep: string };
type Tok = { t: "w"; v: string; glob: boolean } | { t: "op"; v: string };
type Builtin = (sh: Shell, args: string[], stdin: string, tty: boolean) => Res;

// Beginner-facing descriptions for `help` / `help <cmd>`.
export const HELP: Record<string, [string, string]> = {
  ls: ["list files in a folder (-l details, -a show hidden files)", "ls -la"],
  cd: ["change folder (cd .. goes up one level)", "cd /var/log"],
  pwd: ["print the folder you are in", "pwd"],
  cat: ["print a file's contents", "cat notes.txt"],
  head: ["show the first lines of a file (-n N)", "head -n 5 access.log"],
  tail: ["show the last lines of a file (-n N)", "tail -n 5 access.log"],
  grep: ["show lines matching a pattern (-i ignore case, -v invert, -c count, -r search folders)", 'grep -i "failed" auth.log'],
  wc: ["count lines / words / bytes (-l = lines only)", "wc -l auth.log"],
  sort: ["sort lines (-n numbers, -r reverse)", "sort -nr counts.txt"],
  uniq: ["merge repeated neighbouring lines (-c counts them) — sort first!", "sort ips.txt | uniq -c"],
  cut: ["pick columns (-d delimiter, -f field numbers)", "cut -d: -f1 /etc/passwd"],
  awk: ["print columns, e.g. '{print $1}' = first word of each line", "awk '{print $1}' access.log"],
  find: ["search for files (-name, -type f|d, -perm -4000, -user, -writable)", "find / -perm -4000 2>/dev/null"],
  file: ["identify a file's real type from its first bytes", "file photo.jpg"],
  strings: ["print readable text buried inside a binary file", "strings image.png"],
  xxd: ["hex dump: see the raw bytes (-l N limits output)", "xxd -l 32 image.png"],
  binwalk: ["scan a file for other files hidden inside (-e extracts them)", "binwalk image.png"],
  unzip: ["extract a zip archive (-l only lists it)", "unzip -l archive.zip"],
  base64: ["encode text as Base64, or decode with -d", "echo aGVsbG8= | base64 -d"],
  echo: ["print text", "echo hello"],
  id: ["show your user, group and extra groups", "id"],
  whoami: ["show your username", "whoami"],
  uname: ["show the OS / kernel (-a = everything)", "uname -a"],
  hostname: ["show the machine's name", "hostname"],
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

export class Shell {
  spec: ShellSpec;
  cwd: string;
  history: string[] = [];
  files: Map<string, string>;
  dirs: Set<string>;

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
      mode: m.mode ?? (this.dirs.has(p) ? "drwxr-xr-x" : "-rw-r--r--"),
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

  // Files may only be created under $HOME and /tmp, like an unprivileged user.
  write(path: string, data: string, append: boolean): string {
    if (path === "/dev/null") return "";
    const p = this.resolve(path);
    if (this.dirs.has(p)) return `bash: ${path}: Is a directory\n`;
    const home = this.spec.home;
    if (!(p.startsWith(home + "/") || p.startsWith("/tmp/"))) return `bash: ${path}: Permission denied\n`;
    if (!this.dirs.has(parentOf(p))) return `bash: ${path}: No such file or directory\n`;
    this.files.set(p, append ? (this.files.get(p) ?? "") + data : data);
    return "";
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
      if (c === "|" || c === ";" || c === ">") { toks.push({ t: "op", v: c }); i++; continue; }
      let v = "", glob = false;
      if (c === "~" && (i + 1 === line.length || line[i + 1] === "/" || /\s/.test(line[i + 1]))) { v = this.spec.home; i++; }
      while (i < line.length) {
        const ch = line[i];
        if (ch === " " || ch === "\t" || ch === "|" || ch === ";" || ch === ">" || (ch === "&" && line[i + 1] === "&")) break;
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
};
