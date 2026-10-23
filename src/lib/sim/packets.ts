// A Wireshark display-filter subset over a small, hand-written capture, for the
// Network practice lab. Supports fields, ==/!=/>/</>=/<=, contains, matches,
// && || ! (and the word forms), parentheses and CIDR on IP fields.

export type Packet = {
  t: number; // seconds since capture start
  src: string;
  dst: string;
  proto: "TCP" | "UDP" | "DNS" | "HTTP" | "TLS" | "ICMP" | "FTP";
  sport?: number;
  dport?: number;
  len: number;
  info: string;
  flags?: string; // "SYN", "SYN,ACK", "ACK", "PSH,ACK", "RST", "FIN,ACK"
  http?: { method?: string; uri?: string; host?: string; code?: number; ua?: string };
  dns?: { qry: string; type?: string; answer?: string; response?: boolean };
  tls?: { sni?: string };
  payload?: string; // application data as text
};

type Val = string | number;

const TCP = new Set(["TCP", "HTTP", "TLS", "FTP"]);
const UDP = new Set(["UDP", "DNS"]);

// Field name -> [type, getter]. Getter returns all values (multi-valued fields
// like ip.addr return both ends) or undefined when the field is absent.
const FIELDS: Record<string, ["num" | "str" | "ip" | "proto", (p: Packet, n: number) => Val[] | undefined]> = {
  frame: ["proto", () => [1]],
  "frame.number": ["num", (_p, n) => [n]],
  "frame.len": ["num", (p) => [p.len]],
  "frame.time_relative": ["num", (p) => [p.t]],
  ip: ["proto", () => [1]],
  "ip.src": ["ip", (p) => [p.src]],
  "ip.dst": ["ip", (p) => [p.dst]],
  "ip.addr": ["ip", (p) => [p.src, p.dst]],
  tcp: ["proto", (p) => (TCP.has(p.proto) ? [1] : undefined)],
  udp: ["proto", (p) => (UDP.has(p.proto) ? [1] : undefined)],
  "tcp.port": ["num", (p) => (TCP.has(p.proto) ? [p.sport ?? 0, p.dport ?? 0] : undefined)],
  "tcp.srcport": ["num", (p) => (TCP.has(p.proto) ? [p.sport ?? 0] : undefined)],
  "tcp.dstport": ["num", (p) => (TCP.has(p.proto) ? [p.dport ?? 0] : undefined)],
  "udp.port": ["num", (p) => (UDP.has(p.proto) ? [p.sport ?? 0, p.dport ?? 0] : undefined)],
  "udp.srcport": ["num", (p) => (UDP.has(p.proto) ? [p.sport ?? 0] : undefined)],
  "udp.dstport": ["num", (p) => (UDP.has(p.proto) ? [p.dport ?? 0] : undefined)],
  "tcp.flags.syn": ["num", (p) => flag(p, "SYN")],
  "tcp.flags.ack": ["num", (p) => flag(p, "ACK")],
  "tcp.flags.fin": ["num", (p) => flag(p, "FIN")],
  "tcp.flags.reset": ["num", (p) => flag(p, "RST")],
  "tcp.flags.push": ["num", (p) => flag(p, "PSH")],
  http: ["proto", (p) => (p.http ? [1] : undefined)],
  "http.request": ["proto", (p) => (p.http?.method ? [1] : undefined)],
  "http.response": ["proto", (p) => (p.http?.code ? [1] : undefined)],
  "http.request.method": ["str", (p) => (p.http?.method ? [p.http.method] : undefined)],
  "http.request.uri": ["str", (p) => (p.http?.uri ? [p.http.uri] : undefined)],
  "http.host": ["str", (p) => (p.http?.host ? [p.http.host] : undefined)],
  "http.user_agent": ["str", (p) => (p.http?.ua ? [p.http.ua] : undefined)],
  "http.response.code": ["num", (p) => (p.http?.code ? [p.http.code] : undefined)],
  dns: ["proto", (p) => (p.dns ? [1] : undefined)],
  "dns.qry.name": ["str", (p) => (p.dns ? [p.dns.qry] : undefined)],
  "dns.qry.type": ["str", (p) => (p.dns?.type ? [p.dns.type] : undefined)],
  "dns.flags.response": ["num", (p) => (p.dns ? [p.dns.response ? 1 : 0] : undefined)],
  "dns.a": ["ip", (p) => (p.dns?.answer ? [p.dns.answer] : undefined)],
  tls: ["proto", (p) => (p.proto === "TLS" ? [1] : undefined)],
  "tls.handshake.extensions_server_name": ["str", (p) => (p.tls?.sni ? [p.tls.sni] : undefined)],
  icmp: ["proto", (p) => (p.proto === "ICMP" ? [1] : undefined)],
  ftp: ["proto", (p) => (p.proto === "FTP" ? [1] : undefined)],
};

export const FIELD_NAMES = Object.keys(FIELDS);

function flag(p: Packet, f: string): Val[] | undefined {
  if (!TCP.has(p.proto)) return undefined;
  return [(p.flags ?? "").toUpperCase().split(",").map((s) => s.trim()).includes(f) ? 1 : 0];
}

// Everything "in the frame" for `contains`: summary, payload and app fields.
export function frameText(p: Packet): string {
  return [p.info, p.payload ?? "", p.dns?.qry ?? "", p.http?.uri ?? "", p.http?.host ?? "", p.tls?.sni ?? ""].join("\n");
}

type Tok = { k: "word" | "str" | "op" | "eof"; v: string; pos: number };

function lex(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const two = src.slice(i, i + 2);
    if (["==", "!=", ">=", "<=", "&&", "||"].includes(two)) { toks.push({ k: "op", v: two, pos: i }); i += 2; continue; }
    if ("<>!()~".includes(c)) { toks.push({ k: "op", v: c, pos: i }); i++; continue; }
    if (c === "=") throw new Error(`"=" is not valid here — did you mean "=="?`);
    if (c === '"') {
      let j = i + 1, v = "";
      for (; j < src.length && src[j] !== '"'; j++) { if (src[j] === "\\" && j + 1 < src.length) j++; v += src[j]; }
      if (j >= src.length) throw new Error("Missing closing quote");
      toks.push({ k: "str", v, pos: i });
      i = j + 1;
      continue;
    }
    const m = /^[A-Za-z0-9_.:\/\-]+/.exec(src.slice(i));
    if (!m) throw new Error(`Unexpected character "${c}"`);
    toks.push({ k: "word", v: m[0], pos: i });
    i += m[0].length;
  }
  toks.push({ k: "eof", v: "", pos: src.length });
  return toks;
}

const WORD_OPS: Record<string, string> = { eq: "==", ne: "!=", gt: ">", lt: "<", ge: ">=", le: "<=", contains: "contains", matches: "matches", "~": "matches" };
const CMP = new Set(["==", "!=", ">", "<", ">=", "<=", "contains", "matches"]);

type Node =
  | { t: "and" | "or"; a: Node; b: Node }
  | { t: "not"; a: Node }
  | { t: "has"; f: string }
  | { t: "cmp"; f: string; op: string; v: string; quoted: boolean };

function ipToInt(ip: string): number | null {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  if (!m) return null;
  return m.slice(1).reduce((n, x) => n * 256 + +x, 0);
}

function parse(src: string): Node {
  const toks = lex(src);
  let i = 0;
  const peek = () => toks[i];
  const isWord = (w: string) => peek().k === "word" && peek().v.toLowerCase() === w;
  const orExpr = (): Node => {
    let a = andExpr();
    while (peek().v === "||" || isWord("or")) { i++; a = { t: "or", a, b: andExpr() }; }
    return a;
  };
  const andExpr = (): Node => {
    let a = unary();
    while (peek().v === "&&" || isWord("and")) { i++; a = { t: "and", a, b: unary() }; }
    return a;
  };
  const unary = (): Node => {
    if (peek().v === "!" || isWord("not")) { i++; return { t: "not", a: unary() }; }
    if (peek().v === "(") {
      i++;
      const e = orExpr();
      if (peek().v !== ")") throw new Error('Missing ")"');
      i++;
      return e;
    }
    return test();
  };
  const test = (): Node => {
    const t = peek();
    if (t.k !== "word") throw new Error(t.k === "eof" ? "Filter ends too early" : `Unexpected "${t.v}"`);
    const f = t.v.toLowerCase();
    if (!FIELDS[f]) throw new Error(`"${t.v}" is neither a field nor a protocol name.`);
    i++;
    let op = peek().v;
    if (peek().k === "word") op = WORD_OPS[op.toLowerCase()] ?? op;
    if (op === "~") op = "matches";
    if (!CMP.has(op)) return { t: "has", f };
    i++;
    const v = peek();
    if (v.k !== "word" && v.k !== "str") throw new Error(`Expected a value after "${op}"`);
    i++;
    const [type] = FIELDS[f];
    if (type === "num" && (op !== "contains" && op !== "matches") && isNaN(Number(v.v))) throw new Error(`"${v.v}" is not a valid number for ${f}.`);
    if (type === "ip" && (op === "==" || op === "!=") && !v.v.includes("/") && ipToInt(v.v) === null && v.k !== "str") throw new Error(`"${v.v}" is not a valid IP address.`);
    if (op === "matches") { try { new RegExp(v.v); } catch { throw new Error(`Invalid regular expression "${v.v}"`); } }
    return { t: "cmp", f, op, v: v.v, quoted: v.k === "str" };
  };
  const e = orExpr();
  if (peek().k !== "eof") throw new Error(`Unexpected "${peek().v}"`);
  return e;
}

function compare(field: string, vals: Val[], op: string, rhs: string, p: Packet): boolean {
  const [type] = FIELDS[field];
  if (op === "contains") {
    const hay = type === "proto" ? [frameText(p)] : vals.map(String);
    return hay.some((h) => h.includes(rhs));
  }
  if (op === "matches") {
    const re = new RegExp(rhs, "i");
    const hay = type === "proto" ? [frameText(p)] : vals.map(String);
    return hay.some((h) => re.test(h));
  }
  const eq = (v: Val) => {
    if (type === "ip" && rhs.includes("/")) {
      const [net, bits] = rhs.split("/");
      const a = ipToInt(String(v)), b = ipToInt(net), n = +bits;
      if (a === null || b === null || isNaN(n)) return false;
      const mask = n === 0 ? 0 : (~0 << (32 - n)) >>> 0;
      return ((a & mask) >>> 0) === ((b & mask) >>> 0);
    }
    return typeof v === "number" ? v === Number(rhs) : v === rhs;
  };
  const num = (v: Val) => (typeof v === "number" ? v : Number(v));
  switch (op) {
    case "==": return vals.some(eq);
    case "!=": return !vals.some(eq);
    case ">": return vals.some((v) => num(v) > Number(rhs));
    case "<": return vals.some((v) => num(v) < Number(rhs));
    case ">=": return vals.some((v) => num(v) >= Number(rhs));
    case "<=": return vals.some((v) => num(v) <= Number(rhs));
  }
  return false;
}

function evalNode(n: Node, p: Packet, num: number): boolean {
  switch (n.t) {
    case "and": return evalNode(n.a, p, num) && evalNode(n.b, p, num);
    case "or": return evalNode(n.a, p, num) || evalNode(n.b, p, num);
    case "not": return !evalNode(n.a, p, num);
    case "has": return FIELDS[n.f][1](p, num) !== undefined;
    case "cmp": {
      const vals = FIELDS[n.f][1](p, num);
      return vals !== undefined && compare(n.f, vals, n.op, n.v, p);
    }
  }
}

export type FilterResult = { ok: true; match: (p: Packet, frameNumber: number) => boolean } | { ok: false; error: string };

export function compileFilter(src: string): FilterResult {
  if (!src.trim()) return { ok: true, match: () => true };
  try {
    const tree = parse(src);
    return { ok: true, match: (p, n) => evalNode(tree, p, n) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function transport(p: Packet): "TCP" | "UDP" | "ICMP" {
  return TCP.has(p.proto) ? "TCP" : UDP.has(p.proto) ? "UDP" : "ICMP";
}
