// A toy SQL engine for the Web practice lab's login form. It parses a real
// (MySQL-flavoured) subset: SELECT list FROM users [WHERE expr] [ORDER BY n]
// [LIMIT n], UNION [ALL] SELECT ..., AND/OR/NOT, comparisons, LIKE, comments
// (-- # /* */). That's enough to show why string-built queries are injectable
// and why parameterized queries are not.

export type SqlUser = { id: number; username: string; password: string; role: string };
type V = string | number | null;
export type SqlRow = Record<string, V>;
export type SqlOutcome = { kind: "error"; message: string } | { kind: "rows"; columns: string[]; rows: SqlRow[] };

const COLS = ["id", "username", "password", "role"];
export const SELECT_PREFIX = "SELECT id, username, role FROM users WHERE ";

export function buildQuery(u: string, p: string): string {
  return `${SELECT_PREFIX}username = '${u}' AND password = '${p}'`;
}

type Tok = { k: "str" | "num" | "id" | "op" | "eof"; v: string; pos: number };
const KW = new Set(["SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "UNION", "ALL", "LIKE", "IS", "NULL", "TRUE", "FALSE", "ORDER", "BY", "LIMIT", "ASC", "DESC"]);

class SqlError extends Error {}

function lex(sql: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const near = (at: number) => new SqlError(`You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near '${sql.slice(at, at + 40)}' at line 1`);
  while (i < sql.length) {
    const c = sql[i];
    if (/\s/.test(c)) { i++; continue; }
    if (sql.startsWith("--", i) || c === "#") { const nl = sql.indexOf("\n", i); i = nl < 0 ? sql.length : nl; continue; }
    if (sql.startsWith("/*", i)) { const e = sql.indexOf("*/", i + 2); if (e < 0) throw near(i); i = e + 2; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1, v = "";
      for (;;) {
        if (j >= sql.length) throw near(i);
        if (sql[j] === c && sql[j + 1] === c) { v += c; j += 2; continue; }
        if (sql[j] === "\\" && j + 1 < sql.length) { v += sql[j + 1]; j += 2; continue; }
        if (sql[j] === c) break;
        v += sql[j++];
      }
      toks.push({ k: "str", v, pos: i });
      i = j + 1;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(sql.slice(i));
    if (num) { toks.push({ k: "num", v: num[0], pos: i }); i += num[0].length; continue; }
    const id = /^[A-Za-z_]\w*/.exec(sql.slice(i));
    if (id) { toks.push({ k: "id", v: id[0], pos: i }); i += id[0].length; continue; }
    const op = ["<=", ">=", "<>", "!=", "||", "&&"].find((o) => sql.startsWith(o, i)) ?? ("=<>(),;*".includes(c) ? c : null);
    if (!op) throw near(i);
    toks.push({ k: "op", v: op, pos: i });
    i += op.length;
  }
  toks.push({ k: "eof", v: "", pos: sql.length });
  return toks;
}

type Expr =
  | { t: "lit"; v: V }
  | { t: "col"; name: string }
  | { t: "bin"; op: string; a: Expr; b: Expr }
  | { t: "not"; a: Expr }
  | { t: "isnull"; a: Expr; neg: boolean };

type Select = { items: (Expr | "*")[]; from: boolean; where?: Expr };

const toNum = (v: V) => (v === null ? null : typeof v === "number" ? v : parseFloat(/^\s*-?\d*\.?\d*/.exec(v)?.[0] || "0") || 0);
const truthy = (v: V) => v !== null && toNum(v) !== 0;

function cmp(op: string, a: V, b: V): V {
  if (a === null || b === null) return null;
  if (op === "LIKE") {
    const re = new RegExp("^" + String(b).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", "i");
    return re.test(String(a)) ? 1 : 0;
  }
  const c = typeof a === "string" && typeof b === "string"
    ? a.toLowerCase().localeCompare(b.toLowerCase())
    : (toNum(a)! - toNum(b)!);
  const r = op === "=" ? c === 0 : op === "!=" || op === "<>" ? c !== 0 : op === "<" ? c < 0 : op === ">" ? c > 0 : op === "<=" ? c <= 0 : c >= 0;
  return r ? 1 : 0;
}

function evalExpr(e: Expr, row: SqlRow | null, clause: string): V {
  switch (e.t) {
    case "lit": return e.v;
    case "col":
      if (!row || !(e.name.toLowerCase() in row)) throw new SqlError(`Unknown column '${e.name}' in '${clause}'`);
      return row[e.name.toLowerCase()];
    case "not": { const v = evalExpr(e.a, row, clause); return v === null ? null : truthy(v) ? 0 : 1; }
    case "isnull": { const isN = evalExpr(e.a, row, clause) === null; return (e.neg ? !isN : isN) ? 1 : 0; }
    case "bin": {
      if (e.op === "AND") { const a = evalExpr(e.a, row, clause); if (a !== null && !truthy(a)) return 0; const b = evalExpr(e.b, row, clause); return b !== null && !truthy(b) ? 0 : a === null || b === null ? null : 1; }
      if (e.op === "OR") { const a = evalExpr(e.a, row, clause); if (truthy(a)) return 1; const b = evalExpr(e.b, row, clause); return truthy(b) ? 1 : a === null || b === null ? null : 0; }
      return cmp(e.op, evalExpr(e.a, row, clause), evalExpr(e.b, row, clause));
    }
  }
}

function parse(sql: string) {
  const toks = lex(sql);
  let i = 0;
  const peek = () => toks[i];
  const near = () => new SqlError(`You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near '${sql.slice(peek().pos, peek().pos + 40)}' at line 1`);
  const isKw = (w: string) => peek().k === "id" && peek().v.toUpperCase() === w;
  const expectKw = (w: string) => { if (!isKw(w)) throw near(); i++; };

  const orE = (): Expr => { let a = andE(); while (isKw("OR") || peek().v === "||") { i++; a = { t: "bin", op: "OR", a, b: andE() }; } return a; };
  const andE = (): Expr => { let a = notE(); while (isKw("AND") || peek().v === "&&") { i++; a = { t: "bin", op: "AND", a, b: notE() }; } return a; };
  const notE = (): Expr => { if (isKw("NOT")) { i++; return { t: "not", a: notE() }; } return cmpE(); };
  const cmpE = (): Expr => {
    const a = prim();
    if (isKw("IS")) { i++; const neg = isKw("NOT"); if (neg) i++; expectKw("NULL"); return { t: "isnull", a, neg }; }
    if (isKw("LIKE")) { i++; return { t: "bin", op: "LIKE", a, b: prim() }; }
    if (peek().k === "op" && ["=", "!=", "<>", "<", ">", "<=", ">="].includes(peek().v)) { const op = peek().v; i++; return { t: "bin", op, a, b: prim() }; }
    return a;
  };
  const prim = (): Expr => {
    const t = peek();
    if (t.k === "str") { i++; return { t: "lit", v: t.v }; }
    if (t.k === "num") { i++; return { t: "lit", v: Number(t.v) }; }
    if (t.v === "(") { i++; const e = orE(); if (peek().v !== ")") throw near(); i++; return e; }
    if (t.k === "id") {
      const u = t.v.toUpperCase();
      if (u === "NULL") { i++; return { t: "lit", v: null }; }
      if (u === "TRUE" || u === "FALSE") { i++; return { t: "lit", v: u === "TRUE" ? 1 : 0 }; }
      if (KW.has(u)) throw near();
      i++;
      return { t: "col", name: t.v };
    }
    throw near();
  };
  const select = (): Select => {
    expectKw("SELECT");
    const items: (Expr | "*")[] = [];
    do { if (peek().v === "*") { i++; items.push("*"); } else items.push(orE()); } while (peek().v === "," && ++i);
    let from = false, where: Expr | undefined;
    if (isKw("FROM")) { i++; if (!(peek().k === "id" && peek().v.toLowerCase() === "users")) throw new SqlError(`Table 'shop.${peek().v}' doesn't exist`); i++; from = true; }
    if (isKw("WHERE")) { i++; where = orE(); }
    return { items, from, where };
  };

  const parts: { sel: Select; all: boolean }[] = [{ sel: select(), all: true }];
  while (isKw("UNION")) { i++; const all = isKw("ALL"); if (all) i++; parts.push({ sel: select(), all }); }
  let order: { col: string | number; desc: boolean } | undefined;
  if (isKw("ORDER")) {
    i++; expectKw("BY");
    const t = peek();
    if (t.k !== "num" && t.k !== "id") throw near();
    i++;
    order = { col: t.k === "num" ? Number(t.v) : t.v.toLowerCase(), desc: false };
    if (isKw("DESC")) { i++; order.desc = true; } else if (isKw("ASC")) i++;
  }
  let limit: number | undefined;
  if (isKw("LIMIT")) { i++; if (peek().k !== "num") throw near(); limit = Number(peek().v); i++; }
  if (peek().v === ";") {
    i++;
    if (peek().k !== "eof") throw new SqlError("Stacked queries are disabled on this connection (and that's a good thing).");
  }
  if (peek().k !== "eof") throw near();
  return { parts, order, limit };
}

export function runQuery(users: SqlUser[], sql: string): SqlOutcome {
  try {
    const { parts, order, limit } = parse(sql);
    const table: SqlRow[] = users.map((u) => ({ ...u }));
    let columns: string[] = [];
    let rows: SqlRow[] = [];
    parts.forEach(({ sel, all }, idx) => {
      const src = sel.from ? table : [null];
      const names = sel.items.flatMap((it, k) => (it === "*" ? COLS : [it.t === "col" ? it.name.toLowerCase() : `col${k + 1}`]));
      if (idx === 0) columns = names;
      else if (names.length !== columns.length) throw new SqlError("The used SELECT statements have a different number of columns");
      const got: SqlRow[] = [];
      for (const r of src) {
        if (sel.where && !truthy(evalExpr(sel.where, r, "where clause"))) continue;
        const vals = sel.items.flatMap((it) => (it === "*" ? COLS.map((c) => (r ? r[c] : null)) : [evalExpr(it, r, "field list")]));
        const row: SqlRow = {};
        columns.forEach((c, k) => (row[c] = vals[k]));
        got.push(row);
      }
      rows = rows.concat(got);
      if (idx > 0 && !all) {
        const seen = new Set<string>();
        rows = rows.filter((r) => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; });
      }
    });
    if (order) {
      const col = typeof order.col === "number" ? columns[order.col - 1] : order.col;
      if (col === undefined || !columns.includes(col)) throw new SqlError(`Unknown column '${order.col}' in 'order clause'`);
      rows.sort((a, b) => { const c = Number(cmp("<", a[col], b[col])) ? -1 : Number(cmp(">", a[col], b[col])) ? 1 : 0; return order!.desc ? -c : c; });
    }
    if (limit !== undefined) rows = rows.slice(0, limit);
    return { kind: "rows", columns, rows };
  } catch (e) {
    if (e instanceof SqlError) return { kind: "error", message: e.message };
    throw e;
  }
}

export type LoginOutcome = {
  sql: string;
  params?: [string, string];
  outcome: SqlOutcome;
  user?: SqlRow; // the row the app logs you in as
  events: string[];
};

// What the vulnerable (string-built) and fixed (parameterized) login handlers do.
export function login(users: SqlUser[], u: string, p: string, parameterized: boolean): LoginOutcome {
  const events: string[] = [];
  if (parameterized) {
    const rows = users.filter((x) => x.username === u && x.password === p).map(({ id, username, role }) => ({ id, username, role }));
    if (!rows.length && /['"#;]|--/.test(u + p)) events.push("sqli:param-safe");
    return { sql: `${SELECT_PREFIX}username = ? AND password = ?`, params: [u, p], outcome: { kind: "rows", columns: ["id", "username", "role"], rows }, user: rows[0], events };
  }
  const sql = buildQuery(u, p);
  const outcome = runQuery(users, sql);
  if (outcome.kind === "error") { events.push("sqli:error"); return { sql, outcome, events }; }
  const user = outcome.rows[0];
  if (user) {
    const real = users.find((x) => x.id === user.id && x.username === user.username && x.role === user.role);
    const legit = users.some((x) => x.username === u && x.password === p);
    if (!legit) events.push("sqli:bypass");
    if (!legit && real?.role === "admin") events.push("sqli:admin");
    if (!real) events.push("sqli:union");
  }
  return { sql, outcome, user, events };
}
