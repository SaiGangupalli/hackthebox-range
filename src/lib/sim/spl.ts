// A small Splunk SPL subset over in-memory events, for the Splunk practice lab.
// Search: field=value (wildcards *), !=, > < >= <=, bare words, "phrases",
// NOT / OR / AND, parentheses. Commands: search, where, stats, top, rare, sort,
// head, tail, table, fields, dedup, rename.

export type LogEvent = { _time: string; _raw: string; [field: string]: string | number };
export type Row = Record<string, string | number>;
export type SplResult =
  | { kind: "events"; events: LogEvent[] }
  | { kind: "table"; columns: string[]; rows: Row[] };

export type Source = { index: string; sourcetype: string; host: string; pattern: string; lines: string[] };

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

function toIso(ts: string): string {
  const iso = /^(\d{4}-\d\d-\d\d)[T ](\d\d:\d\d:\d\d)/.exec(ts);
  if (iso) return `${iso[1]} ${iso[2]}`;
  const clf = /^(\d\d)\/(\w{3})\/(\d{4}):(\d\d:\d\d:\d\d)/.exec(ts);
  if (clf) return `${clf[3]}-${String(MONTHS.indexOf(clf[2]) + 1).padStart(2, "0")}-${clf[1]} ${clf[4]}`;
  return ts;
}

// Search-time field extraction, like Splunk props/transforms: a regex with
// named groups per sourcetype. A group named `ts` becomes _time.
export function extractEvents(sources: Source[]): LogEvent[] {
  const out: LogEvent[] = [];
  for (const s of sources) {
    const re = new RegExp(s.pattern);
    for (const raw of s.lines) {
      const g = re.exec(raw)?.groups ?? {};
      const ev: LogEvent = { _time: toIso(g.ts ?? ""), _raw: raw, index: s.index, sourcetype: s.sourcetype, host: s.host };
      for (const [k, v] of Object.entries(g)) if (k !== "ts" && v !== undefined) ev[k] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
      out.push(ev);
    }
  }
  return out.sort((a, b) => (a._time < b._time ? 1 : a._time > b._time ? -1 : 0));
}

const isNum = (v: unknown) => typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)));
const wild = (pat: string) => new RegExp("^" + pat.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", "i");

type Tok = { v: string; quoted: boolean };

function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    if (/\s/.test(s[i])) { i++; continue; }
    if (s[i] === "(" || s[i] === ")") { out.push({ v: s[i], quoted: false }); i++; continue; }
    let v = "", quoted = false;
    while (i < s.length && !/\s/.test(s[i]) && s[i] !== "(" && s[i] !== ")") {
      if (s[i] === '"') {
        const j = s.indexOf('"', i + 1);
        if (j < 0) throw new Error("Unbalanced quotes.");
        v += s.slice(i + 1, j); i = j + 1; quoted = true; continue;
      }
      v += s[i++];
    }
    out.push({ v, quoted });
  }
  return out;
}

type Pred = (e: Row) => boolean;

function termPred(t: Tok): Pred {
  const m = t.quoted && !/^[\w.]+(!=|>=|<=|=|>|<)/.test(t.v) ? null : /^([A-Za-z_][\w.]*)(!=|>=|<=|=|>|<)(.*)$/.exec(t.v);
  if (!m) {
    const re = wild(`*${t.v}*`);
    return (e) => re.test(String(e._raw ?? Object.values(e).join(" ")));
  }
  const [, field, op, value] = m;
  if (op === "=" || op === "!=") {
    const re = wild(value);
    const hit = (e: Row) => e[field] !== undefined && re.test(String(e[field]));
    return op === "=" ? hit : (e) => e[field] !== undefined && !hit(e);
  }
  if (!isNum(value)) throw new Error(`The value after ${field}${op} must be a number.`);
  const n = Number(value);
  return (e) => {
    const v = e[field];
    if (!isNum(v)) return false;
    const x = Number(v);
    return op === ">" ? x > n : op === "<" ? x < n : op === ">=" ? x >= n : x <= n;
  };
}

function parseSearch(src: string): Pred {
  const toks = tokenize(src);
  let i = 0;
  const kw = (w: string) => i < toks.length && !toks[i].quoted && toks[i].v.toUpperCase() === w;
  const orExpr = (): Pred => {
    let a = andExpr();
    while (kw("OR")) { i++; const b = andExpr(), x = a; a = (e) => x(e) || b(e); }
    return a;
  };
  const andExpr = (): Pred => {
    const parts: Pred[] = [unary()];
    while (i < toks.length && toks[i].v !== ")" && !kw("OR")) {
      if (kw("AND")) { i++; continue; }
      parts.push(unary());
    }
    return (e) => parts.every((p) => p(e));
  };
  const unary = (): Pred => {
    if (i >= toks.length) throw new Error("Search ends too early.");
    if (kw("NOT")) { i++; const p = unary(); return (e) => !p(e); }
    if (toks[i].v === "(" && !toks[i].quoted) {
      i++;
      const p = orExpr();
      if (toks[i]?.v !== ")") throw new Error('Missing ")".');
      i++;
      return p;
    }
    return termPred(toks[i++]);
  };
  if (!toks.length) return () => true;
  const p = orExpr();
  if (i < toks.length) throw new Error(`Unexpected "${toks[i].v}".`);
  return p;
}

function splitPipes(q: string): string[] {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (const c of q) {
    if (c === '"') quoted = !quoted;
    if (c === "|" && !quoted) { out.push(cur.trim()); cur = ""; } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const fieldList = (s: string) => s.split(/[\s,]+/).filter(Boolean);
const cmpVals = (a: unknown, b: unknown) =>
  isNum(a) && isNum(b) ? Number(a) - Number(b) : String(a ?? "").localeCompare(String(b ?? ""));

type Agg = { fn: string; field?: string; as: string };

function stats(rows: Row[], args: string): { columns: string[]; rows: Row[] } {
  const [aggPart, byPart] = args.split(/\s+by\s+/i);
  const aggs: Agg[] = [];
  const re = /(\w+)(?:\(\s*([\w.]*)\s*\))?(?:\s+as\s+(\w+))?/gi;
  for (const m of aggPart.replace(/,/g, " ").matchAll(re)) {
    const fn = m[1].toLowerCase();
    if (!["count", "dc", "distinct_count", "sum", "avg", "min", "max", "values"].includes(fn))
      throw new Error(`stats: unknown function "${m[1]}". Try count, dc(), sum(), avg(), min(), max(), values().`);
    if (fn !== "count" && !m[2]) throw new Error(`stats: ${fn}() needs a field, e.g. ${fn}(bytes).`);
    aggs.push({ fn, field: m[2] || undefined, as: m[3] ?? (m[2] ? `${m[1]}(${m[2]})` : "count") });
  }
  if (!aggs.length) throw new Error("stats needs a function, e.g. stats count by src_ip");
  const by = byPart ? fieldList(byPart) : [];
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    if (by.some((f) => r[f] === undefined)) continue;
    const k = JSON.stringify(by.map((f) => r[f]));
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  if (!by.length && !groups.size) groups.set("[]", []);
  const out: Row[] = [];
  for (const [k, g] of groups) {
    const row: Row = {};
    (JSON.parse(k) as (string | number)[]).forEach((v, i) => (row[by[i]] = v));
    for (const a of aggs) {
      const vals = a.field ? g.map((r) => r[a.field!]).filter((v) => v !== undefined) : g;
      const nums = (vals as unknown[]).filter(isNum).map(Number);
      switch (a.fn) {
        case "count": row[a.as] = vals.length; break;
        case "dc": case "distinct_count": row[a.as] = new Set(vals.map(String)).size; break;
        case "sum": row[a.as] = nums.reduce((s, n) => s + n, 0); break;
        case "avg": row[a.as] = nums.length ? Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 100) / 100 : 0; break;
        case "min": row[a.as] = nums.length ? Math.min(...nums) : ""; break;
        case "max": row[a.as] = nums.length ? Math.max(...nums) : ""; break;
        case "values": row[a.as] = [...new Set(vals.map(String))].sort().join(", "); break;
      }
    }
    out.push(row);
  }
  out.sort((a, b) => { for (const f of by) { const c = cmpVals(a[f], b[f]); if (c) return c; } return 0; });
  return { columns: [...by, ...aggs.map((a) => a.as)], rows: out };
}

function topRare(rows: Row[], args: string, rare: boolean): { columns: string[]; rows: Row[] } {
  let limit = 10;
  const rest = args.replace(/limit=(\d+)/i, (_, n) => { limit = +n; return ""; });
  const [fieldsPart, byPart] = rest.split(/\s+by\s+/i);
  const fields = fieldList(fieldsPart);
  if (!fields.length) throw new Error(`${rare ? "rare" : "top"} needs a field, e.g. ${rare ? "rare" : "top"} uri_path`);
  if (byPart) throw new Error(`"by" isn't supported for ${rare ? "rare" : "top"} in this lab — use stats count by ... instead.`);
  const counts = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    if (fields.some((f) => r[f] === undefined)) continue;
    const k = JSON.stringify(fields.map((f) => r[f]));
    counts.set(k, (counts.get(k) ?? 0) + 1);
    total++;
  }
  const out: Row[] = [...counts].map(([k, c]) => {
    const row: Row = {};
    (JSON.parse(k) as (string | number)[]).forEach((v, i) => (row[fields[i]] = v));
    row.count = c;
    row.percent = Math.round((c / total) * 10000) / 100;
    return row;
  });
  out.sort((a, b) => (rare ? Number(a.count) - Number(b.count) : Number(b.count) - Number(a.count)));
  return { columns: [...fields, "count", "percent"], rows: out.slice(0, limit) };
}

export const SUPPORTED = ["search", "where", "stats", "top", "rare", "sort", "head", "tail", "table", "fields", "dedup", "rename"];

export function runSpl(all: LogEvent[], query: string): { ok: true; result: SplResult } | { ok: false; error: string } {
  try {
    const segs = splitPipes(query);
    let first = segs[0];
    if (/^search\s/i.test(first)) first = first.slice(7);
    let rows: Row[] = all.filter(parseSearch(first));
    let columns: string[] | null = null;
    for (const seg of segs.slice(1)) {
      const m = /^(\w+)\s*([\s\S]*)$/.exec(seg);
      if (!m) throw new Error("Empty command after |.");
      const [, name, args] = m;
      switch (name.toLowerCase()) {
        case "search": rows = rows.filter(parseSearch(args)); break;
        case "where": {
          const w = /^([\w.()]+)\s*(==|=|!=|>=|<=|>|<)\s*(.+)$/.exec(args.trim());
          if (!w) throw new Error('where needs a comparison, e.g. where count > 5 or where user="root"');
          const [, f, op, raw] = w;
          const v = raw.trim().replace(/^"(.*)"$/, "$1");
          rows = rows.filter((r) => {
            if (r[f] === undefined) return false;
            const c = cmpVals(r[f], v);
            return op === "=" || op === "==" ? String(r[f]).toLowerCase() === v.toLowerCase() || (isNum(r[f]) && isNum(v) && c === 0)
              : op === "!=" ? c !== 0 : op === ">" ? c > 0 : op === "<" ? c < 0 : op === ">=" ? c >= 0 : c <= 0;
          });
          break;
        }
        case "stats": ({ columns, rows } = stats(rows, args)); break;
        case "top": ({ columns, rows } = topRare(rows, args, false)); break;
        case "rare": ({ columns, rows } = topRare(rows, args, true)); break;
        case "sort": {
          let limit = Infinity;
          const spec = args.replace(/^\s*(\d+)\s+/, (_, n) => { limit = +n; return ""; });
          const keys = spec.replace(/([-+])\s+/g, "$1").split(/[\s,]+/).filter(Boolean).map((k) => ({ desc: k.startsWith("-"), f: k.replace(/^[-+]/, "") }));
          if (!keys.length) throw new Error("sort needs a field, e.g. sort -count");
          rows = [...rows].sort((a, b) => { for (const k of keys) { const c = cmpVals(a[k.f], b[k.f]); if (c) return k.desc ? -c : c; } return 0; }).slice(0, limit);
          break;
        }
        case "head": rows = rows.slice(0, parseInt(args, 10) || 10); break;
        case "tail": rows = rows.slice(-(parseInt(args, 10) || 10)); break;
        case "table": case "fields": {
          const neg = args.trim().startsWith("-");
          const fs = fieldList(args.replace(/^\s*-\s*/, ""));
          if (!fs.length) throw new Error(`${name} needs field names, e.g. ${name} _time src_ip user`);
          if (name.toLowerCase() === "fields" && neg) {
            // fields - a b  → drop those fields, keep the rest
            rows = rows.map((r) => { const o = { ...r }; for (const f of fs) delete o[f]; return o; });
            columns = null;
          } else {
            rows = rows.map((r) => { const o: Row = {}; for (const f of fs) o[f] = r[f] ?? ""; return o; });
            columns = fs;
          }
          break;
        }
        case "dedup": {
          const fs = fieldList(args);
          const seen = new Set<string>();
          rows = rows.filter((r) => { const k = JSON.stringify(fs.map((f) => r[f])); if (seen.has(k)) return false; seen.add(k); return true; });
          break;
        }
        case "rename": {
          const pairs = [...args.matchAll(/([\w.()]+)\s+as\s+(\w+)/gi)];
          if (!pairs.length) throw new Error("rename needs: rename old as new");
          rows = rows.map((r) => { const o = { ...r }; for (const [, a, b] of pairs) if (a in o) { o[b] = o[a]; delete o[a]; } return o; });
          if (columns) columns = columns.map((c) => pairs.find((p) => p[1] === c)?.[2] ?? c);
          break;
        }
        default:
          throw new Error(`Unknown search command "${name}". This lab supports: ${SUPPORTED.join(", ")}.`);
      }
    }
    if (columns) return { ok: true, result: { kind: "table", columns, rows } };
    return { ok: true, result: { kind: "events", events: rows as LogEvent[] } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Field names present in the events (for the field sidebar), most common first.
export function fieldSummary(events: LogEvent[]): string[] {
  const c = new Map<string, number>();
  for (const e of events) for (const k of Object.keys(e)) if (!k.startsWith("_")) c.set(k, (c.get(k) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
}
