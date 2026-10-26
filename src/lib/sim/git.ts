// A small, read-only Git for the labs. The repository is data — commits and the
// files each one changed — and the commands people use to read history (log,
// show, diff, blame, branch, status, tag, reflog, grep, shortlog) answer from
// it with output shaped like real Git's. checkout / switch / restore move HEAD
// and rewrite the lab's working tree; commands that would write history
// explain what they would do instead.

import type { Shell, Tool, ToolResult } from "./shell";
import { sha256Hex } from "./hash";

export type GitCommit = {
  id: string; // 7 hex characters; the full 40-character hash is derived from it
  parents?: string[]; // default: the commit before it in the list ([] for the first)
  author: string; // "Name <email>"
  date: string; // "2026-10-20T09:14:00+05:30"
  message: string; // the subject line, then an optional body after a blank line
  files?: Record<string, string | null>; // path in the repo → new content (null deletes it)
};

export type GitRepo = {
  root: string; // absolute path of the working tree
  commits: GitCommit[]; // oldest first
  branches: Record<string, string>; // branch → tip commit id
  head: string; // the checked-out branch
  tags?: Record<string, string>;
  remote?: { name: string; url: string; branches: Record<string, string> };
  reflog?: { id: string; action: string }[]; // newest first; default: HEAD's history
};

type Node = GitCommit & { full: string; parents: string[]; idx: number; time: number; tree: Map<string, string> };
type State = { branch: string | null; at: string; branches: Record<string, string>; prev?: string; moves: { id: string; action: string }[] };

const lines = (s: string) => (s === "" ? [] : s.replace(/\n$/, "").split("\n"));
const text = (ls: string[]) => (ls.length ? ls.join("\n") + "\n" : "");
const ok = (out: string): ToolResult => ({ out });
const fail = (err: string, code = 128): ToolResult => ({ out: "", err, code });
const fullId = (id: string) => (id + sha256Hex(id)).slice(0, 40);
const blobId = (data: string) => sha256Hex("blob " + data).slice(0, 7);
const name = (author: string) => author.replace(/\s*<.*>\s*$/, "");
const email = (author: string) => /<(.*)>/.exec(author)?.[1] ?? "";
const subject = (c: GitCommit) => c.message.split("\n")[0];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dateParts(iso: string) {
  const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)([+-]\d\d):?(\d\d)$/.exec(iso);
  if (!m) throw new Error(`git sim: bad date ${iso}`);
  const [, y, mo, d, hh, mi, ss, tzh, tzm] = m;
  return { y, mo, d, time: `${hh}:${mi}:${ss}`, tz: `${tzh}${tzm}`, day: DAYS[new Date(Date.UTC(+y, +mo - 1, +d)).getUTCDay()] };
}
const longDate = (iso: string) => { const p = dateParts(iso); return `${p.day} ${MONTHS[+p.mo - 1]} ${+p.d} ${p.time} ${p.y} ${p.tz}`; };
const isoDate = (iso: string) => { const p = dateParts(iso); return `${p.y}-${p.mo}-${p.d} ${p.time} ${p.tz}`; };
const shortDate = (iso: string) => iso.slice(0, 10);

// ── Line diffs ───────────────────────────────────────────────────────────────
type Op = [" " | "-" | "+", string];
function editScript(a: string[], b: string[]): Op[] {
  const m = a.length, n = b.length;
  const L = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops: Op[] = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) { ops.push([" ", a[i]]); i++; j++; }
    else if (i < m && (j >= n || L[i + 1][j] >= L[i][j + 1])) ops.push(["-", a[i++]]);
    else ops.push(["+", b[j++]]);
  }
  return ops;
}

function hunks(a: string[], b: string[], ctx = 3): string[] {
  const ops = editScript(a, b);
  const changed = ops.map((o, k) => (o[0] !== " " ? k : -1)).filter((k) => k >= 0);
  if (!changed.length) return [];
  const groups: [number, number][] = [];
  for (const k of changed) {
    const lo = Math.max(0, k - ctx), hi = Math.min(ops.length - 1, k + ctx);
    const last = groups[groups.length - 1];
    if (last && lo <= last[1] + 1) last[1] = hi; else groups.push([lo, hi]);
  }
  const out: string[] = [];
  for (const [lo, hi] of groups) {
    let oldAt = 0, newAt = 0;
    for (let k = 0; k < lo; k++) { if (ops[k][0] !== "+") oldAt++; if (ops[k][0] !== "-") newAt++; }
    const part = ops.slice(lo, hi + 1);
    const oldN = part.filter((o) => o[0] !== "+").length, newN = part.filter((o) => o[0] !== "-").length;
    const range = (at: number, n: number) => (n === 1 ? `${at + 1}` : `${n ? at + 1 : at},${n}`);
    out.push(`@@ -${range(oldAt, oldN)} +${range(newAt, newN)} @@`, ...part.map(([t, l]) => t + l));
  }
  return out;
}

type Change = { path: string; status: "A" | "M" | "D"; before?: string; after?: string };
function changes(a: Map<string, string>, b: Map<string, string>, paths: string[] = []): Change[] {
  const keep = (p: string) => !paths.length || paths.some((x) => p === x || p.startsWith(x.replace(/\/$/, "") + "/"));
  const all = [...new Set([...a.keys(), ...b.keys()])].filter(keep).sort();
  const out: Change[] = [];
  for (const p of all) {
    const x = a.get(p), y = b.get(p);
    if (x === y) continue;
    out.push({ path: p, status: x === undefined ? "A" : y === undefined ? "D" : "M", before: x, after: y });
  }
  return out;
}

function patch(cs: Change[]): string[] {
  const out: string[] = [];
  for (const c of cs) {
    out.push(`diff --git a/${c.path} b/${c.path}`);
    if (c.status === "A") out.push("new file mode 100644", `index 0000000..${blobId(c.after!)}`, "--- /dev/null", `+++ b/${c.path}`);
    else if (c.status === "D") out.push("deleted file mode 100644", `index ${blobId(c.before!)}..0000000`, `--- a/${c.path}`, "+++ /dev/null");
    else out.push(`index ${blobId(c.before!)}..${blobId(c.after!)} 100644`, `--- a/${c.path}`, `+++ b/${c.path}`);
    out.push(...hunks(lines(c.before ?? ""), lines(c.after ?? "")));
  }
  return out;
}

function counts(c: Change) {
  const ops = editScript(lines(c.before ?? ""), lines(c.after ?? ""));
  return { add: ops.filter((o) => o[0] === "+").length, del: ops.filter((o) => o[0] === "-").length };
}

function stat(cs: Change[]): string[] {
  if (!cs.length) return [];
  const rows = cs.map((c) => ({ path: c.path, ...counts(c) }));
  const w = Math.max(...rows.map((r) => r.path.length));
  const most = Math.max(...rows.map((r) => r.add + r.del));
  const scale = most > 40 ? 40 / most : 1;
  const nw = String(most).length;
  const out = rows.map((r) => ` ${r.path.padEnd(w)} | ${String(r.add + r.del).padStart(nw)} ${"+".repeat(Math.ceil(r.add * scale))}${"-".repeat(Math.ceil(r.del * scale))}`);
  const add = rows.reduce((s, r) => s + r.add, 0), del = rows.reduce((s, r) => s + r.del, 0);
  const parts = [`${rows.length} file${rows.length === 1 ? "" : "s"} changed`];
  if (add) parts.push(`${add} insertion${add === 1 ? "" : "s"}(+)`);
  if (del) parts.push(`${del} deletion${del === 1 ? "" : "s"}(-)`);
  out.push(" " + parts.join(", "));
  return out;
}

// ── The repository ──────────────────────────────────────────────────────────
class Repo {
  nodes = new Map<string, Node>();
  list: Node[] = [];
  constructor(spec: GitRepo) {
    spec.commits.forEach((c, idx) => {
      const parents = c.parents ?? (idx ? [spec.commits[idx - 1].id] : []);
      const n: Node = { ...c, full: fullId(c.id), parents, idx, time: Date.parse(c.date), tree: new Map() };
      const first = parents[0] ? this.nodes.get(parents[0]) : undefined;
      if (parents[0] && !first) throw new Error(`git sim: ${c.id} has unknown parent ${parents[0]}`);
      n.tree = new Map(first?.tree ?? []);
      // A merge brings in what the other side changed since the two split.
      for (const other of parents.slice(1)) {
        const o = this.nodes.get(other);
        if (!o) throw new Error(`git sim: ${c.id} has unknown parent ${other}`);
        const base = this.mergeBase(first!, o);
        for (const ch of changes(base?.tree ?? new Map(), o.tree)) {
          if (ch.after === undefined) n.tree.delete(ch.path); else n.tree.set(ch.path, ch.after);
        }
      }
      for (const [p, data] of Object.entries(c.files ?? {})) { if (data === null) n.tree.delete(p); else n.tree.set(p, data); }
      this.nodes.set(c.id, n);
      this.list.push(n);
    });
  }

  ancestors(from: Node[], firstParent = false): Set<string> {
    const seen = new Set<string>();
    const stack = [...from];
    while (stack.length) {
      const n = stack.pop()!;
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      for (const p of firstParent ? n.parents.slice(0, 1) : n.parents) stack.push(this.nodes.get(p)!);
    }
    return seen;
  }

  mergeBase(a: Node, b: Node): Node | undefined {
    const mine = this.ancestors([a]);
    return [...this.ancestors([b])].map((id) => this.nodes.get(id)!).filter((n) => mine.has(n.id)).sort((x, y) => y.time - x.time || y.idx - x.idx)[0];
  }
}

// Each terminal gets its own HEAD, so labs and tests don't share checkouts.
const states = new WeakMap<Shell, Map<GitRepo, State>>();
function stateOf(sh: Shell, spec: GitRepo): State {
  let m = states.get(sh);
  if (!m) states.set(sh, (m = new Map()));
  let s = m.get(spec);
  if (!s) m.set(spec, (s = { branch: spec.head, at: spec.branches[spec.head], branches: { ...spec.branches }, moves: [] }));
  return s;
}

const repos = new WeakMap<GitRepo, Repo>();
const repoOf = (spec: GitRepo) => { let r = repos.get(spec); if (!r) repos.set(spec, (r = new Repo(spec))); return r; };

/** The files a lab's file system needs for this repository: the checked-out tree plus a minimal .git folder. */
export function worktree(spec: GitRepo): Record<string, string> {
  const r = repoOf(spec);
  const tip = r.nodes.get(spec.branches[spec.head]);
  if (!tip) throw new Error(`git sim: branch ${spec.head} points at an unknown commit`);
  const files: Record<string, string> = {};
  for (const [p, d] of tip.tree) files[`${spec.root}/${p}`] = d;
  files[`${spec.root}/.git/HEAD`] = `ref: refs/heads/${spec.head}\n`;
  files[`${spec.root}/.git/config`] = text([
    "[core]", "\trepositoryformatversion = 0", "\tbare = false",
    ...(spec.remote ? [`[remote "${spec.remote.name}"]`, `\turl = ${spec.remote.url}`, `\tfetch = +refs/heads/*:refs/remotes/${spec.remote.name}/*`] : []),
  ]);
  return files;
}

/** The full 40-character hash Git shows for a lab commit id. */
export const gitFullId = fullId;

const READ_ONLY: Record<string, string> = {
  add: "stages changes for the next commit",
  commit: "records the staged changes as a new commit",
  push: "uploads your commits to the remote (git push --force overwrites the remote's history — protected branches block it)",
  pull: "fetches the remote's new commits and merges them into your branch",
  fetch: "downloads the remote's new commits without changing your branch",
  merge: "joins another branch's history into this one with a merge commit",
  rebase: "replays this branch's commits on top of another, giving them new hashes — never rebase commits others already have",
  reset: "moves the branch to another commit; --hard also throws away uncommitted work (the old commits stay in git reflog for a while)",
  revert: "adds a new commit that undoes an earlier one — the safe way to undo a change on a shared branch",
  "cherry-pick": "copies one commit onto this branch as a new commit",
  stash: "shelves uncommitted changes so you can switch branches",
  rm: "deletes files and stages the deletion",
  mv: "renames a file and stages the rename",
  init: "creates a new, empty repository",
  clone: "copies a repository and its whole history",
  "filter-repo": "rewrites history to remove files or text from every commit — then everyone must re-clone, and the secret must still be rotated",
};

const USAGE = text([
  "usage: git <command> [options]   (a read-only practice repository)",
  "",
  "  log        list commits: --oneline, -n 5, --stat, -p, --author=NAME, --grep=TEXT, -S TEXT, --all, -- PATH",
  "  show       one commit and its changes: git show <commit>, --stat, or a file at a commit: git show <commit>:<path>",
  "  diff       compare: git diff (your changes), git diff A B, git diff main..feature, --stat, --name-only",
  "  blame      which commit last changed each line: git blame <file>",
  "  status     what's changed in the working tree",
  "  branch     list branches: -a (with remote ones), -v, --merged, --no-merged",
  "  tag        list release tags",
  "  reflog     where HEAD has been — including commits no branch points at any more",
  "  grep       search tracked files: git grep -n TEXT [commit]",
  "  shortlog   commits per author: git shortlog -sn",
  "  checkout / switch / restore   move to another branch or commit, or restore a file",
  "  remote -v · rev-parse · merge-base · ls-files",
]);

// ── The tool ─────────────────────────────────────────────────────────────────
export function gitTool(spec: GitRepo): Tool {
  return {
    about: "read a repository's history: log, show, diff, blame, branch, status, reflog",
    run(argv, sh) {
      const repo = repoOf(spec);
      const st = stateOf(sh, spec);
      const inRepo = sh.cwd === spec.root || sh.cwd.startsWith(spec.root + "/");
      const [cmd, ...args] = argv;
      if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") return ok(USAGE);
      if (cmd === "--version" || cmd === "version") return ok("git version 2.47.1\n");
      if (!inRepo) return fail(`fatal: not a git repository (or any of the parent directories): .git\n(cd ${spec.root} first)`);
      const g = new Git(repo, st, sh, spec);
      const fn = g.commands[cmd];
      if (fn) return fn(args);
      if (cmd === "tag" && args.length && !args[0].startsWith("-")) return readOnly("tag", "tag", "creates a release tag pointing at a commit");
      if (cmd === "branch" && args.some((a) => /^-[dDmM]$/.test(a))) return readOnly("branch", args.join(" "), "deletes or renames a branch");
      if (READ_ONLY[cmd]) return readOnly(cmd, args.join(" "), READ_ONLY[cmd]);
      return fail(`git: '${cmd}' is not a git command in this lab. See 'git help'.`, 1);
    },
  };
}

function readOnly(cmd: string, args: string, what: string): ToolResult {
  return { out: "", err: `git ${cmd}${args && args !== cmd ? " " + args : ""}: this practice repository is read-only.\nIn a real repository, git ${cmd} ${what}.\n`, code: 1 };
}

class Git {
  private r: Repo;
  private st: State;
  private sh: Shell;
  private spec: GitRepo;
  constructor(r: Repo, st: State, sh: Shell, spec: GitRepo) { this.r = r; this.st = st; this.sh = sh; this.spec = spec; }

  private get head(): Node { return this.r.nodes.get(this.st.at)!; }

  private refsAt(): Map<string, string[]> {
    const m = new Map<string, string[]>();
    const add = (id: string, label: string) => { const k = m.get(id) ?? []; k.push(label); m.set(id, k); };
    if (this.st.branch) add(this.st.at, `HEAD -> ${this.st.branch}`); else add(this.st.at, "HEAD");
    for (const [t, id] of Object.entries(this.spec.tags ?? {})) add(id, `tag: ${t}`);
    const rem = this.spec.remote;
    if (rem) for (const [b, id] of Object.entries(rem.branches)) add(id, `${rem.name}/${b}`);
    for (const [b, id] of Object.entries(this.st.branches)) if (b !== this.st.branch) add(id, b);
    return m;
  }
  private decor(n: Node) { const d = this.refsAt().get(n.id); return d ? ` (${d.join(", ")})` : ""; }

  /** Resolve a revision: HEAD, a branch, tag, remote branch, hash prefix or HEAD@{n}, with ~N and ^N steps. */
  rev(s: string): Node | null {
    const m = /^(.*?)((?:[~^]\d*)*)$/.exec(s)!;
    let base = m[1];
    const steps = m[2];
    let n: Node | undefined;
    const reflogAt = /^HEAD@\{(\d+)\}$/.exec(base);
    if (reflogAt) { const e = this.reflog()[+reflogAt[1]]; n = e && this.r.nodes.get(e.id); }
    else {
      if (base === "" || base === "@") base = "HEAD";
      const rem = this.spec.remote;
      const id = base === "HEAD" ? this.st.at
        : this.st.branches[base] ?? this.spec.tags?.[base]
        ?? (rem && base.startsWith(rem.name + "/") ? rem.branches[base.slice(rem.name.length + 1)] : undefined)
        ?? (rem && base.startsWith(`remotes/${rem.name}/`) ? rem.branches[base.slice(rem.name.length + 9)] : undefined);
      if (id) n = this.r.nodes.get(id);
      else if (/^[0-9a-f]{4,40}$/.test(base)) {
        const hits = this.r.list.filter((x) => x.full.startsWith(base));
        if (hits.length === 1) n = hits[0];
      }
    }
    if (!n) return null;
    for (const [, op, num] of steps.matchAll(/([~^])(\d*)/g)) {
      const k = num === "" ? 1 : +num;
      if (op === "~") { for (let i = 0; i < k && n; i++) n = n.parents[0] ? this.r.nodes.get(n.parents[0]) : undefined; }
      else if (k > 0) n = n.parents[k - 1] ? this.r.nodes.get(n.parents[k - 1]) : undefined;
      if (!n) return null;
    }
    return n;
  }

  private bad(s: string) { return fail(`fatal: ambiguous argument '${s}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'`); }

  private reflog(): { id: string; action: string }[] {
    return [...this.st.moves, ...this.history()];
  }

  private history(): { id: string; action: string }[] {
    if (this.spec.reflog) return this.spec.reflog;
    const out: { id: string; action: string }[] = [];
    for (let n: Node | undefined = this.r.nodes.get(this.spec.branches[this.spec.head]); n; n = n.parents[0] ? this.r.nodes.get(n.parents[0]) : undefined) {
      out.push({ id: n.id, action: `${n.parents.length > 1 ? "merge" : n.parents.length ? "commit" : "commit (initial)"}: ${subject(n)}` });
    }
    return out;
  }

  /** The working tree's tracked files and the untracked ones (not ignored). */
  private work() {
    const root = this.spec.root + "/";
    const tracked = new Map<string, string>(), untracked: string[] = [];
    const ignore = lines(this.head.tree.get(".gitignore") ?? "").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    const ignored = (p: string) => ignore.some((pat) => {
      const re = new RegExp("^" + pat.replace(/\/$/, "").replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, ".") + "(/|$)");
      return re.test(p) || (!pat.includes("/") && p.split("/").some((seg) => re.test(seg)));
    });
    for (const [abs, data] of this.sh.files) {
      if (!abs.startsWith(root)) continue;
      const p = abs.slice(root.length);
      if (p === ".git" || p.startsWith(".git/")) continue;
      if (this.head.tree.has(p)) tracked.set(p, data);
      else if (!ignored(p)) untracked.push(p);
    }
    return { tracked, untracked: untracked.sort() };
  }

  /** Split args into options, revisions and paths (after --, or anything that is a tracked path). */
  private split(args: string[], valued: string[] = []) {
    const opts: string[] = [], revs: string[] = [], paths: string[] = [];
    let i = 0;
    for (; i < args.length; i++) {
      const a = args[i];
      if (a === "--") { paths.push(...args.slice(i + 1)); break; }
      if (a.startsWith("-")) { opts.push(a); if (valued.includes(a) && i + 1 < args.length) opts.push(args[++i]); continue; }
      revs.push(a);
    }
    // Bare paths: anything that isn't a revision but names a tracked file or folder.
    const known = (p: string) => [...this.head.tree.keys()].some((k) => k === p || k.startsWith(p.replace(/\/$/, "") + "/"));
    const realRevs: string[] = [];
    for (const r of revs) {
      if (this.isRev(r)) realRevs.push(r);
      else if (known(this.repoPath(r))) paths.push(r);
      else return { opts, revs: realRevs, paths, bad: r };
    }
    return { opts, revs: realRevs, paths: paths.map((p) => this.repoPath(p)), bad: null as string | null };
  }

  private isRev(r: string) {
    const parts = r.includes("...") ? r.split("...") : r.includes("..") ? r.split("..") : [r.replace(/^\^/, "")];
    return parts.every((p) => p === "" || !!this.rev(p));
  }

  /** A path as the repo sees it, from wherever the shell is standing. */
  private repoPath(p: string) {
    const abs = this.sh.resolve(p);
    return abs === this.spec.root ? "" : abs.startsWith(this.spec.root + "/") ? abs.slice(this.spec.root.length + 1) : p;
  }

  private header(n: Node, opts: { oneline?: boolean; full?: boolean; format?: string; dateShort?: boolean }) {
    if (opts.format !== undefined) return [this.format(n, opts.format, opts.dateShort)];
    if (opts.oneline) return [`${opts.full ? n.full : n.id}${this.decor(n)} ${subject(n)}`];
    return [
      `commit ${n.full}${this.decor(n)}`,
      ...(n.parents.length > 1 ? [`Merge: ${n.parents.join(" ")}`] : []),
      `Author: ${n.author}`,
      `Date:   ${opts.dateShort ? shortDate(n.date) : longDate(n.date)}`,
      "",
      ...n.message.split("\n").map((l) => (l ? "    " + l : "")),
    ];
  }

  private format(n: Node, f: string, dateShort?: boolean) {
    const map: Record<string, string> = {
      H: n.full, h: n.id, an: name(n.author), ae: email(n.author), ad: dateShort ? shortDate(n.date) : longDate(n.date), as: shortDate(n.date),
      ai: isoDate(n.date), s: subject(n), b: n.message.split("\n").slice(2).join("\n"), d: this.decor(n), D: this.decor(n).replace(/^ \(|\)$/g, ""),
      cn: name(n.author), ce: email(n.author), cd: dateShort ? shortDate(n.date) : longDate(n.date), P: n.parents.map(fullId).join(" "), p: n.parents.join(" "), n: "\n", "%": "%",
    };
    return f.replace(/%(an|ae|ad|as|ai|cn|ce|cd|H|h|s|b|d|D|P|p|n|%)/g, (_, k: string) => map[k]);
  }

  private formatOpt(opts: string[]) {
    let format: string | undefined, oneline = false, full = false;
    for (const o of opts) {
      if (o === "--oneline") oneline = true;
      const m = /^--(?:pretty|format)=(.*)$/.exec(o);
      if (m) {
        const v = m[1];
        if (v === "oneline") { oneline = true; full = true; }
        else if (v === "short" || v === "medium" || v === "full") { /* default look */ }
        else format = v.replace(/^(format|tformat):/, "");
      }
    }
    return { oneline, full, format, dateShort: opts.includes("--date=short") };
  }

  private changesOf(n: Node, paths: string[] = []) {
    const p = n.parents[0] ? this.r.nodes.get(n.parents[0])!.tree : new Map<string, string>();
    return changes(p, n.tree, paths);
  }

  private body(cs: Change[], opts: string[], defaultPatch: boolean) {
    if (opts.includes("--stat")) return stat(cs);
    if (opts.includes("--name-only")) return cs.map((c) => c.path);
    if (opts.includes("--name-status")) return cs.map((c) => `${c.status}\t${c.path}`);
    if (opts.includes("-s") || opts.includes("--no-patch")) return [];
    if (defaultPatch || opts.some((o) => o === "-p" || o === "-u" || o === "--patch")) return patch(cs);
    return [];
  }

  commands: Record<string, (args: string[]) => ToolResult> = {
    log: (args) => {
      const valued = ["-n", "-S", "-G", "--author", "--grep"];
      const { opts, revs, paths, bad } = this.split(args, valued);
      if (bad) return this.bad(bad);
      let max = Infinity, author = "", grep = "", pick = "", pickRe: RegExp | null = null, since = "", until = "";
      for (let i = 0; i < opts.length; i++) {
        const o = opts[i];
        let m: RegExpExecArray | null;
        if (o === "-n") max = +opts[++i];
        else if ((m = /^-(\d+)$/.exec(o)) || (m = /^-n(\d+)$/.exec(o)) || (m = /^--max-count=(\d+)$/.exec(o))) max = +m[1];
        else if (o === "--author") author = opts[++i];
        else if ((m = /^--author=(.*)$/.exec(o))) author = m[1];
        else if (o === "--grep") grep = opts[++i];
        else if ((m = /^--grep=(.*)$/.exec(o))) grep = m[1];
        else if (o === "-S") pick = opts[++i];
        else if ((m = /^-S(.+)$/.exec(o))) pick = m[1];
        else if (o === "-G") pickRe = new RegExp(opts[++i]);
        else if ((m = /^-G(.+)$/.exec(o))) pickRe = new RegExp(m[1]);
        else if ((m = /^--(?:since|after)=(.*)$/.exec(o))) since = m[1];
        else if ((m = /^--(?:until|before)=(.*)$/.exec(o))) until = m[1];
      }
      const all = opts.includes("--all");
      const firstParent = opts.includes("--first-parent");
      const include: Node[] = [], exclude: Node[] = [];
      for (const r of revs) {
        if (r.includes("...")) {
          const [a, b] = r.split("...").map((x) => this.rev(x || "HEAD")!);
          const base = this.r.mergeBase(a, b);
          include.push(a, b);
          if (base) exclude.push(base);
        } else if (r.includes("..")) {
          const [a, b] = r.split("..");
          exclude.push(this.rev(a || "HEAD")!);
          include.push(this.rev(b || "HEAD")!);
        } else if (r.startsWith("^")) exclude.push(this.rev(r.slice(1))!);
        else include.push(this.rev(r)!);
      }
      if (all) {
        for (const id of [...Object.values(this.st.branches), ...Object.values(this.spec.tags ?? {}), ...Object.values(this.spec.remote?.branches ?? {}), this.st.at]) include.push(this.r.nodes.get(id)!);
      }
      if (!include.length) include.push(this.head);
      const ex = exclude.length ? this.r.ancestors(exclude, firstParent) : new Set<string>();
      const ids = this.r.ancestors(include, firstParent);
      let picked = this.r.list.filter((n) => ids.has(n.id) && !ex.has(n.id)).sort((a, b) => b.time - a.time || b.idx - a.idx);
      const lower = (s: string) => s.toLowerCase();
      if (author) picked = picked.filter((n) => lower(n.author).includes(lower(author)));
      if (grep) picked = picked.filter((n) => lower(n.message).includes(lower(grep)));
      if (since) picked = picked.filter((n) => n.date.slice(0, 10) >= since.slice(0, 10));
      if (until) picked = picked.filter((n) => n.date.slice(0, 10) <= until.slice(0, 10));
      if (opts.includes("--no-merges")) picked = picked.filter((n) => n.parents.length < 2);
      if (opts.includes("--merges")) picked = picked.filter((n) => n.parents.length > 1);
      if (paths.length) picked = picked.filter((n) => n.parents.length < 2 && this.changesOf(n, paths).length);
      const occurrences = (data: string | undefined) => (data ? data.split(pick).length - 1 : 0);
      if (pick) picked = picked.filter((n) => this.changesOf(n).some((c) => occurrences(c.before) !== occurrences(c.after)));
      if (pickRe) picked = picked.filter((n) => this.changesOf(n).some((c) => editScript(lines(c.before ?? ""), lines(c.after ?? "")).some(([t, l]) => t !== " " && pickRe!.test(l))));
      if (opts.includes("--reverse")) picked.reverse();
      picked = picked.slice(0, max);

      const f = this.formatOpt(opts);
      const graph = opts.includes("--graph");
      const compact = f.oneline || f.format !== undefined;
      const out: string[] = [];
      picked.forEach((n, i) => {
        const head = this.header(n, f);
        const body = this.body(this.changesOf(n, paths.length && opts.includes("--stat") ? paths : []), opts, false);
        if (!compact && i) out.push("");
        const block = [...head, ...(body.length ? (compact ? body : ["", ...body]) : [])];
        if (graph) out.push(...block.map((l, k) => (k === 0 ? (n.parents.length > 1 ? "*   " : "* ") + l : "| " + l)));
        else out.push(...block);
      });
      return ok(text(out));
    },

    show: (args) => {
      const { opts, revs: raw, bad } = this.split(args.filter((a) => !a.includes(":") || a.startsWith("-")));
      const fileRefs = args.filter((a) => a.includes(":") && !a.startsWith("-"));
      const out: string[] = [];
      for (const ref of fileRefs) {
        const i = ref.indexOf(":");
        const n = this.rev(ref.slice(0, i) || "HEAD");
        if (!n) return this.bad(ref);
        const p = ref.slice(i + 1).replace(/^\.\//, "");
        const data = n.tree.get(p);
        if (data === undefined) {
          const dir = [...n.tree.keys()].filter((k) => k.startsWith(p.replace(/\/$/, "") + "/") || p === "");
          if (!dir.length) return fail(`fatal: path '${p}' does not exist in '${ref.slice(0, i) || "HEAD"}'`);
          out.push(`tree ${ref}`, "", ...[...new Set(dir.map((k) => k.slice(p ? p.replace(/\/$/, "").length + 1 : 0).split("/")[0] + (k.slice(p ? p.replace(/\/$/, "").length + 1 : 0).includes("/") ? "/" : "")))].sort());
        } else out.push(...lines(data));
      }
      if (bad) return this.bad(bad);
      const revs = raw.length || fileRefs.length ? raw : ["HEAD"];
      const f = this.formatOpt(opts);
      revs.forEach((r, i) => {
        const n = this.rev(r)!;
        if (i || fileRefs.length) out.push("");
        out.push(...this.header(n, f));
        const body = n.parents.length > 1 ? [] : this.body(this.changesOf(n), opts, true);
        if (body.length) out.push(...(f.oneline || f.format !== undefined ? body : ["", ...body]));
      });
      return ok(text(out));
    },

    diff: (args) => {
      const { opts, revs, paths, bad } = this.split(args);
      if (bad) return this.bad(bad);
      if (opts.includes("--staged") || opts.includes("--cached")) return ok("");
      let a: Map<string, string>, b: Map<string, string>;
      const work = () => { const w = this.work().tracked; const t = new Map(this.head.tree); for (const k of t.keys()) { if (w.has(k)) t.set(k, w.get(k)!); else t.delete(k); } return t; };
      if (revs.length === 1 && (revs[0].includes(".."))) {
        const three = revs[0].includes("...");
        const [x, y] = revs[0].split(three ? "..." : "..").map((s) => this.rev(s || "HEAD")!);
        a = three ? (this.r.mergeBase(x, y)?.tree ?? new Map()) : x.tree;
        b = y.tree;
      } else if (revs.length >= 2) { a = this.rev(revs[0])!.tree; b = this.rev(revs[1])!.tree; }
      else if (revs.length === 1) { a = this.rev(revs[0])!.tree; b = work(); }
      else { a = this.head.tree; b = work(); }
      const cs = changes(a, b, paths);
      return ok(text(this.body(cs, opts, true)));
    },

    blame: (args) => {
      const { opts, revs, paths, bad } = this.split(args, ["-L"]);
      if (bad) return this.bad(bad);
      if (!paths.length) return fail("usage: git blame [-L <start>,<end>] <file> [<commit>]");
      const p = paths[0];
      const start = this.rev(revs[0] ?? "HEAD")!;
      const final = start.tree.get(p);
      if (final === undefined) return fail(`fatal: no such path '${p}' in ${revs[0] ?? "HEAD"}`);
      const fl = lines(final);
      const who: Node[] = new Array(fl.length);
      // Follow each line back through the parents until the commit that added it.
      type Track = { at: number; line: number }[];
      const queue: { n: Node; ls: string[]; track: Track }[] = [{ n: start, ls: fl, track: fl.map((_, i) => ({ at: i, line: i })) }];
      while (queue.length) {
        const { n, ls, track } = queue.shift()!;
        let rest = track;
        for (const pid of n.parents) {
          if (!rest.length) break;
          const pn = this.r.nodes.get(pid)!;
          const before = pn.tree.get(p);
          if (before === undefined) continue;
          const pl = lines(before);
          const map = new Array<number>(ls.length).fill(-1);
          let i = 0, j = 0;
          for (const [t] of editScript(pl, ls)) { if (t === " ") map[j++] = i++; else if (t === "-") i++; else j++; }
          const moved: Track = [], stay: Track = [];
          for (const t of rest) { if (map[t.at] >= 0) moved.push({ at: map[t.at], line: t.line }); else stay.push(t); }
          if (moved.length) queue.push({ n: pn, ls: pl, track: moved });
          rest = stay;
        }
        for (const t of rest) who[t.line] = n;
      }
      let from = 1, to = fl.length;
      const li = opts.indexOf("-L");
      const L = li >= 0 ? opts[li + 1] : opts.find((o) => o.startsWith("-L") && o.length > 2)?.slice(2);
      if (L) { const [s, e] = L.split(","); from = Math.max(1, +s || 1); to = Math.min(fl.length, e ? (e.startsWith("+") ? from + +e.slice(1) - 1 : +e) : from); }
      const w = Math.max(...who.map((n) => name(n.author).length));
      const nw = String(fl.length).length;
      const out: string[] = [];
      for (let k = from - 1; k < to; k++) {
        const n = who[k];
        const id = n.parents.length ? n.id + " " : "^" + n.id;
        out.push(`${id} (${name(n.author).padEnd(w)} ${isoDate(n.date)} ${String(k + 1).padStart(nw)}) ${fl[k]}`);
      }
      return ok(text(out));
    },

    status: (args) => {
      const short = args.includes("-s") || args.includes("--short");
      const { tracked, untracked } = this.work();
      const mod: string[] = [], del: string[] = [];
      for (const [p, d] of this.head.tree) { if (!tracked.has(p)) del.push(p); else if (tracked.get(p) !== d) mod.push(p); }
      if (short) return ok(text([...mod.map((p) => ` M ${p}`), ...del.map((p) => ` D ${p}`), ...untracked.map((p) => `?? ${p}`)]));
      const out = [this.st.branch ? `On branch ${this.st.branch}` : `HEAD detached at ${this.st.at}`];
      const rem = this.spec.remote;
      const up = this.st.branch && rem?.branches[this.st.branch];
      if (up) {
        const local = this.r.nodes.get(this.st.branches[this.st.branch!])!, remote = this.r.nodes.get(up)!;
        const ahead = [...this.r.ancestors([local])].filter((id) => !this.r.ancestors([remote]).has(id)).length;
        const behind = [...this.r.ancestors([remote])].filter((id) => !this.r.ancestors([local]).has(id)).length;
        const tr = `'${rem!.name}/${this.st.branch}'`;
        out.push(ahead && behind ? `Your branch and ${tr} have diverged,\nand have ${ahead} and ${behind} different commits each, respectively.`
          : ahead ? `Your branch is ahead of ${tr} by ${ahead} commit${ahead > 1 ? "s" : ""}.\n  (use "git push" to publish your local commits)`
          : behind ? `Your branch is behind ${tr} by ${behind} commit${behind > 1 ? "s" : ""}, and can be fast-forwarded.`
          : `Your branch is up to date with ${tr}.`);
      }
      if (mod.length || del.length) out.push("", "Changes not staged for commit:", "  (use \"git add <file>...\" to update what will be committed)", "  (use \"git restore <file>...\" to discard changes in working directory)", ...mod.map((p) => `\tmodified:   ${p}`), ...del.map((p) => `\tdeleted:    ${p}`));
      if (untracked.length) out.push("", "Untracked files:", "  (use \"git add <file>...\" to include in what will be committed)", ...untracked.map((p) => `\t${p}`));
      out.push("", mod.length || del.length ? "no changes added to commit (use \"git add\" and/or \"git commit -a\")" : untracked.length ? "nothing added to commit but untracked files present (use \"git add\" to track)" : "nothing to commit, working tree clean");
      return ok(text(out));
    },

    branch: (args) => {
      const opts = args.filter((a) => a.startsWith("-"));
      const words = args.filter((a) => !a.startsWith("-"));
      const create = !opts.length && words.length === 1 ? words[0] : "";
      if (create && !this.st.branches[create]) {
        if (!/^[\w./-]+$/.test(create)) return fail(`fatal: '${create}' is not a valid branch name`);
        this.st.branches[create] = this.st.at;
        return ok("");
      }
      const verbose = opts.includes("-v") || opts.includes("-vv");
      const target = (flag: string) => { const i = args.indexOf(flag); const v = i >= 0 ? args[i + 1] : undefined; return v && !v.startsWith("-") && this.rev(v) ? this.rev(v)! : this.head; };
      let names = Object.keys(this.st.branches).sort().map((b) => ({ label: b, ref: b, id: this.st.branches[b] }));
      const rem = this.spec.remote;
      const remotes = rem ? Object.keys(rem.branches).sort().map((b) => ({ label: `remotes/${rem.name}/${b}`, ref: `${rem.name}/${b}`, id: rem.branches[b] })) : [];
      if (opts.includes("-r")) names = remotes.map((x) => ({ ...x, label: x.ref }));
      else if (opts.includes("-a") || opts.includes("--all")) names = [...names, ...remotes];
      const merged = opts.includes("--merged"), notMerged = opts.includes("--no-merged");
      if (merged || notMerged) {
        const into = this.r.ancestors([target(merged ? "--merged" : "--no-merged")]);
        names = names.filter((x) => into.has(x.id) === merged);
      }
      if (opts.includes("--contains")) {
        const c = target("--contains");
        names = names.filter((x) => this.r.ancestors([this.r.nodes.get(x.id)!]).has(c.id));
      }
      const w = Math.max(0, ...names.map((x) => x.label.length));
      const out = names.map((x) => {
        const mark = x.ref === this.st.branch ? "* " : "  ";
        const n = this.r.nodes.get(x.id)!;
        return verbose ? `${mark}${x.label.padEnd(w)} ${n.id} ${subject(n)}` : mark + x.label;
      });
      if (!this.st.branch && !opts.includes("-r") && !merged && !notMerged) out.unshift(`* (HEAD detached at ${this.st.at})`);
      return ok(text(out));
    },

    tag: (args) => {
      const tags = Object.keys(this.spec.tags ?? {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (args.includes("--contains")) {
        const c = this.rev(args[args.indexOf("--contains") + 1] ?? "HEAD");
        if (!c) return this.bad(args[args.indexOf("--contains") + 1]);
        return ok(text(tags.filter((t) => this.r.ancestors([this.r.nodes.get(this.spec.tags![t])!]).has(c.id))));
      }
      return ok(text(tags));
    },

    reflog: () => {
      const d = this.decor(this.head);
      return ok(text(this.reflog().map((e, i) => `${e.id}${i === 0 ? d : ""} HEAD@{${i}}: ${e.action}`)));
    },

    grep: (args) => {
      const flags = args.filter((a) => a.startsWith("-") && a !== "--" && a !== "-e");
      const rest = args.filter((a) => !a.startsWith("-") || a === "--");
      const ei = args.indexOf("-e");
      const pattern = ei >= 0 ? args[ei + 1] : rest.shift();
      if (ei >= 0 && rest.includes(pattern!)) rest.splice(rest.indexOf(pattern!), 1);
      if (!pattern) return fail("usage: git grep [-n] [-i] [-c] [-l] <pattern> [<commit>...] [-- <path>...]");
      const dd = rest.indexOf("--");
      const revs = (dd >= 0 ? rest.slice(0, dd) : rest).filter((r) => this.rev(r));
      const paths = [...(dd >= 0 ? rest.slice(dd + 1) : rest.filter((r) => !this.rev(r)))].map((p) => this.repoPath(p));
      let re: RegExp;
      const ci = flags.includes("-i");
      try { re = new RegExp(pattern, ci ? "i" : ""); } catch { re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), ci ? "i" : ""); }
      const sources: [string, Map<string, string>][] = revs.length ? revs.map((r) => [r + ":", this.rev(r)!.tree]) : [["", this.work().tracked]];
      const out: string[] = [];
      for (const [prefix, tree] of sources) {
        for (const p of [...tree.keys()].sort()) {
          if (paths.length && !paths.some((x) => p === x || p.startsWith(x.replace(/\/$/, "") + "/"))) continue;
          const hits = lines(tree.get(p)!).map((l, i) => [i + 1, l] as const).filter(([, l]) => re.test(l));
          if (!hits.length) continue;
          if (flags.includes("-l")) out.push(prefix + p);
          else if (flags.includes("-c")) out.push(`${prefix}${p}:${hits.length}`);
          else for (const [k, l] of hits) out.push(`${prefix}${p}:${flags.includes("-n") ? k + ":" : ""}${l}`);
        }
      }
      return { out: text(out), code: out.length ? 0 : 1 };
    },

    shortlog: (args) => {
      const { revs } = this.split(args.filter((a) => !a.startsWith("-")));
      const tips = args.includes("--all") ? Object.values(this.st.branches).map((id) => this.r.nodes.get(id)!) : revs.length ? revs.map((r) => this.rev(r)!) : [this.head];
      const ids = this.r.ancestors(tips);
      const by = new Map<string, Node[]>();
      for (const n of this.r.list) if (ids.has(n.id)) { const k = args.includes("-e") ? n.author : name(n.author); by.set(k, [...(by.get(k) ?? []), n]); }
      const rows = [...by.entries()].sort((a, b) => (args.some((x) => /^-\w*n/.test(x)) ? b[1].length - a[1].length : 0) || a[0].localeCompare(b[0]));
      if (args.some((x) => /^-\w*s/.test(x))) return ok(text(rows.map(([k, ns]) => `${String(ns.length).padStart(6)}\t${k}`)));
      return ok(text(rows.flatMap(([k, ns], i) => [...(i ? [""] : []), `${k} (${ns.length}):`, ...ns.slice().reverse().map((n) => `      ${subject(n)}`)])));
    },

    checkout: (args) => this.move(args, "checkout"),
    switch: (args) => this.move(args, "switch"),
    restore: (args) => {
      const src = args.find((a) => a.startsWith("--source="))?.slice(9) ?? (args.includes("-s") ? args[args.indexOf("-s") + 1] : "HEAD");
      const from = this.rev(src);
      if (!from) return this.bad(src);
      const files = args.filter((a, i) => !a.startsWith("-") && args[i - 1] !== "-s");
      if (!files.length) return fail("fatal: you must specify path(s) to restore");
      return this.restoreFiles(from, files.map((f) => this.repoPath(f)));
    },

    "ls-files": () => ok(text([...this.head.tree.keys()].sort())),
    "rev-parse": (args) => {
      const short = args.includes("--short"), abbrev = args.includes("--abbrev-ref");
      const out: string[] = [];
      for (const a of args.filter((x) => !x.startsWith("-"))) {
        if (abbrev && a === "HEAD") { out.push(this.st.branch ?? "HEAD"); continue; }
        const n = this.rev(a);
        if (!n) return this.bad(a);
        out.push(short ? n.id : n.full);
      }
      if (args.includes("--show-toplevel")) out.push(this.spec.root);
      return ok(text(out));
    },
    "merge-base": (args) => {
      const [a, b] = args.filter((x) => !x.startsWith("-")).map((x) => this.rev(x));
      if (!a || !b) return fail("usage: git merge-base <commit> <commit>");
      const m = this.r.mergeBase(a, b);
      return m ? ok(m.full + "\n") : { out: "", code: 1 };
    },
    remote: (args) => {
      const rem = this.spec.remote;
      if (!rem) return ok("");
      return ok(args.includes("-v") ? `${rem.name}\t${rem.url} (fetch)\n${rem.name}\t${rem.url} (push)\n` : rem.name + "\n");
    },
    config: (args) => {
      const key = args.filter((a) => !a.startsWith("-"))[0];
      if (key === "remote.origin.url" && this.spec.remote) return ok(this.spec.remote.url + "\n");
      if (args.includes("--list") || args.includes("-l")) return ok(text(["core.bare=false", ...(this.spec.remote ? [`remote.${this.spec.remote.name}.url=${this.spec.remote.url}`] : [])]));
      return key ? { out: "", code: 1 } : fail("usage: git config --list | git config <key>", 1);
    },
  };

  private move(args: string[], how: "checkout" | "switch"): ToolResult {
    const dd = args.indexOf("--");
    if (dd >= 0) {
      const from = dd > 0 && !args[0].startsWith("-") ? this.rev(args[0]) : this.head;
      if (!from) return this.bad(args[0]);
      return this.restoreFiles(from, args.slice(dd + 1).map((f) => this.repoPath(f)));
    }
    const create = args.find((a, i) => (args[i - 1] === "-b" || args[i - 1] === "-c"));
    const detach = args.includes("--detach") || args.includes("-d");
    const target = args.filter((a, i) => !a.startsWith("-") && args[i - 1] !== "-b" && args[i - 1] !== "-c")[0];
    if (create) {
      if (this.st.branches[create]) return fail(`fatal: a branch named '${create}' already exists`);
      const at = target ? this.rev(target) : this.head;
      if (!at) return this.bad(target!);
      const r = this.switchTo(at, create);
      if (r) return r;
      this.st.branches[create] = at.id;
      return { out: "", err: `Switched to a new branch '${create}'\n`, code: 0 };
    }
    if (!target && args.includes("-")) return this.st.prev ? this.move([this.st.prev], how) : fail("error: no previous branch to switch back to", 1);
    if (!target) return fail(how === "switch" ? "fatal: missing branch or commit argument" : "usage: git checkout <branch> | git checkout <commit> -- <file>");
    const rem = this.spec.remote;
    let branch = this.st.branches[target] ? target : null;
    if (!branch && !detach && rem?.branches[target]) { this.st.branches[target] = rem.branches[target]; branch = target; }
    const n = branch ? this.r.nodes.get(this.st.branches[branch])! : this.rev(target);
    if (!n) {
      if (how === "checkout" && this.head.tree.has(this.repoPath(target))) return this.restoreFiles(this.head, [this.repoPath(target)]);
      return fail(how === "switch" ? `fatal: invalid reference: ${target}` : `error: pathspec '${target}' did not match any file(s) known to git`, 1);
    }
    if (!branch && how === "switch" && !detach) return fail(`fatal: a branch is expected, got commit '${target}'\nhint: If you want to detach HEAD at the commit, try again with the --detach option.`);
    if (branch && branch === this.st.branch) return { out: "", err: `Already on '${branch}'\n`, code: 0 };
    const r = this.switchTo(n, branch);
    if (r) return r;
    if (branch) return { out: "", err: `Switched to branch '${branch}'\n`, code: 0 };
    return { out: "", err: `Note: switching to '${target}'.\n\nYou are in 'detached HEAD' state. You can look around and read files, but\nnothing you do here belongs to a branch. Switch back with: git switch ${this.spec.head}\n\nHEAD is now at ${n.id} ${subject(n)}\n`, code: 0 };
  }

  /** Point HEAD at a commit and make the working tree match it, refusing to overwrite local edits. */
  private switchTo(n: Node, branch: string | null): ToolResult | null {
    const { tracked } = this.work();
    const dirty = [...this.head.tree].filter(([p, d]) => tracked.get(p) !== d && n.tree.get(p) !== d).map(([p]) => p);
    if (dirty.length) return fail(`error: Your local changes to the following files would be overwritten by checkout:\n${dirty.map((p) => "\t" + p).join("\n")}\nPlease commit your changes or stash them before you switch branches.\nAborting`, 1);
    const root = this.spec.root;
    for (const p of this.head.tree.keys()) if (!n.tree.has(p)) this.sh.files.delete(`${root}/${p}`);
    for (const [p, d] of n.tree) this.writeFile(`${root}/${p}`, d);
    const was = this.st.branch ?? this.st.at;
    this.st.moves.unshift({ id: n.id, action: `checkout: moving from ${was} to ${branch ?? n.id}` });
    this.st.prev = was;
    this.st.at = n.id;
    this.st.branch = branch;
    this.sh.files.set(`${root}/.git/HEAD`, branch ? `ref: refs/heads/${branch}\n` : n.full + "\n");
    return null;
  }

  private restoreFiles(from: Node, paths: string[]): ToolResult {
    let n = 0;
    for (const p of paths) {
      const hits = [...from.tree.keys()].filter((k) => k === p || k.startsWith(p.replace(/\/$/, "") + "/"));
      if (!hits.length) return fail(`error: pathspec '${p}' did not match any file(s) known to git`, 1);
      for (const k of hits) { this.writeFile(`${this.spec.root}/${k}`, from.tree.get(k)!); n++; }
    }
    return { out: "", err: from === this.head ? "" : `Updated ${n} path${n === 1 ? "" : "s"} from ${from.id}\n`, code: 0 };
  }

  private writeFile(abs: string, data: string) {
    this.sh.files.set(abs, data);
    for (let d = abs.slice(0, abs.lastIndexOf("/")); d && d !== "/"; d = d.slice(0, d.lastIndexOf("/"))) this.sh.dirs.add(d);
  }
}
