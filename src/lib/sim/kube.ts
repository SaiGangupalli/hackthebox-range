// A small Kubernetes for the labs. The cluster is data — pods, deployments,
// services, secrets, config maps, ingresses, nodes and RBAC rules — and kubectl
// reads it with output shaped like the real thing: tables, describe, logs,
// events, -o yaml / json / jsonpath, rollout history, top and auth can-i.
// Commands that would change the cluster explain what they would do instead.

import type { Tool, ToolResult } from "./shell";
import { b64encode } from "@/lib/cryptoTools";

type Labels = Record<string, string>;
type Event = [type: string, reason: string, age: string, from: string, message: string];
type ContainerState = { state: "Running" | "Waiting" | "Terminated"; reason?: string; exitCode?: number; message?: string };

export type KubeContainer = {
  name: string;
  image: string;
  ports?: number[];
  env?: Record<string, string>;
  secretEnv?: Record<string, [secret: string, key: string]>; // variable → a key in a Secret
  configEnv?: Record<string, [configMap: string, key: string]>; // variable → a key in a ConfigMap
  requests?: { cpu?: string; memory?: string };
  limits?: { cpu?: string; memory?: string };
  securityContext?: Record<string, string | number | boolean>;
  readiness?: { path: string; port: number };
  liveness?: { path: string; port: number };
};

export type KubePod = {
  name: string;
  namespace?: string;
  labels?: Labels;
  owner?: string; // the Deployment whose ReplicaSet made it (pod name = <rs>-<suffix>)
  node?: string; // unset while Pending (not scheduled)
  ip?: string;
  status: string; // the STATUS column: Running, CrashLoopBackOff, ImagePullBackOff, Pending, OOMKilled, Completed…
  ready?: boolean; // default: Running
  restarts?: number;
  lastRestart?: string; // "40s ago"
  age: string;
  containers: KubeContainer[];
  serviceAccount?: string;
  state?: ContainerState;
  lastState?: ContainerState;
  logs?: string;
  previousLogs?: string; // logs of the crashed container (kubectl logs --previous)
  events?: Event[];
  usage?: { cpu: string; memory: string }; // kubectl top
};

export type KubeDeployment = {
  name: string;
  namespace?: string;
  selector: Labels;
  replicas: number;
  age: string;
  containers: KubeContainer[];
  revisions: { revision: number; hash: string; image: string; cause?: string }[]; // oldest first; the last is live
  serviceAccount?: string;
};

export type KubeService = {
  name: string;
  namespace?: string;
  type?: "ClusterIP" | "NodePort" | "LoadBalancer";
  clusterIP: string;
  externalIP?: string;
  ports: { port: number; targetPort?: number; nodePort?: number }[];
  selector: Labels;
  age: string;
};

export type KubeSecret = { name: string; namespace?: string; type?: string; data: Record<string, string>; age: string };
export type KubeConfigMap = { name: string; namespace?: string; data: Record<string, string>; age: string };
export type KubeIngress = { name: string; namespace?: string; className?: string; host: string; tls?: boolean; address?: string; paths: { path: string; service: string; port: number }[]; age: string };
export type KubeNode = { name: string; status?: string; roles?: string; age: string; version: string; ip: string; cpu: string; memory: string; pressure?: ("MemoryPressure" | "DiskPressure" | "PIDPressure")[]; taints?: string[] };
export type KubeServiceAccount = { name: string; namespace?: string; age: string };
export type KubeNetworkPolicy = { name: string; namespace?: string; podSelector: Labels; policyTypes: string[]; from?: string[]; age: string };
export type KubeRule = { who: string; namespace: string; verbs: string[]; resources: string[]; binding: string }; // namespace "*" = cluster-wide
export type KubeEvent = { namespace?: string; age: string; type: string; reason: string; object: string; message: string };

export type KubeCluster = {
  context: string;
  user: string;
  namespace: string; // the current context's namespace
  namespaces: { name: string; age: string }[];
  nodes: KubeNode[];
  pods: KubePod[];
  deployments?: KubeDeployment[];
  services?: KubeService[];
  secrets?: KubeSecret[];
  configMaps?: KubeConfigMap[];
  ingresses?: KubeIngress[];
  serviceAccounts?: KubeServiceAccount[];
  networkPolicies?: KubeNetworkPolicy[];
  rbac?: KubeRule[];
  events?: KubeEvent[]; // besides the ones each pod carries
};

const text = (ls: string[]) => (ls.length ? ls.join("\n") + "\n" : "");
const ok = (out: string): ToolResult => ({ out });
const fail = (err: string, code = 1): ToolResult => ({ out: "", err, code });
const labelStr = (l?: Labels) => (l && Object.keys(l).length ? Object.entries(l).map(([k, v]) => `${k}=${v}`).join(",") : "<none>");
const matches = (labels: Labels | undefined, sel: Labels) => Object.entries(sel).every(([k, v]) => labels?.[k] === v);
const seconds = (age: string) => { let s = 0; for (const [, n, u] of age.matchAll(/(\d+)([smhd])/g)) s += +n * { s: 1, m: 60, h: 3600, d: 86400 }[u as "s"]; return s; };

/** Columns padded the way kubectl's tabwriter does (three spaces between). */
function table(head: string[], rows: string[][]): string[] {
  const all = [head, ...rows];
  const w = head.map((_, i) => Math.max(...all.map((r) => (r[i] ?? "").length)));
  return all.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(w[i] + 3))).join("").trimEnd());
}

// ── YAML and JSONPath for -o yaml / -o jsonpath ─────────────────────────────
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
function scalar(v: unknown): string {
  if (typeof v !== "string") return String(v);
  return v === "" || /^[\d.+-]+$|^(true|false|null|yes|no|on|off|~)$|: |^[\s{[*&!|>'"%@`#-]|\s$|\n/i.test(v) ? JSON.stringify(v) : v;
}
function yaml(v: unknown, indent = 0): string[] {
  const pad = " ".repeat(indent);
  if (Array.isArray(v)) {
    return v.flatMap((item) => {
      if (isObj(item) || Array.isArray(item)) { const ls = yaml(item, indent + 2); ls[0] = pad + "- " + ls[0].trimStart(); return ls; }
      return [pad + "- " + scalar(item)];
    });
  }
  if (isObj(v)) {
    return Object.keys(v).sort().flatMap((k) => {
      const x = v[k];
      if (Array.isArray(x)) return x.length ? [pad + k + ":", ...yaml(x, indent)] : [pad + k + ": []"];
      if (isObj(x)) return Object.keys(x).length ? [pad + k + ":", ...yaml(x, indent + 2)] : [pad + k + ": {}"];
      return [pad + k + ": " + scalar(x)];
    });
  }
  return [pad + scalar(v)];
}

function walk(expr: string, ctx: unknown[]): unknown[] {
  let cur = ctx;
  let i = expr.startsWith("$") ? 1 : 0;
  while (i < expr.length) {
    if (expr[i] === ".") {
      i++;
      let key = "";
      while (i < expr.length && expr[i] !== "." && expr[i] !== "[") { if (expr[i] === "\\" && i + 1 < expr.length) i++; key += expr[i++]; }
      if (key) cur = cur.flatMap((x) => (isObj(x) && key in x ? [x[key]] : []));
    } else if (expr[i] === "[") {
      const end = expr.indexOf("]", i);
      const inner = expr.slice(i + 1, end).trim();
      i = end + 1;
      if (inner === "*") cur = cur.flatMap((x) => (Array.isArray(x) ? x : isObj(x) ? Object.values(x) : []));
      else if (/^-?\d+$/.test(inner)) cur = cur.flatMap((x) => (Array.isArray(x) ? [x[+inner < 0 ? x.length + +inner : +inner]].filter((y) => y !== undefined) : []));
      else { const k = inner.replace(/^['"]|['"]$/g, ""); cur = cur.flatMap((x) => (isObj(x) && k in x ? [x[k]] : [])); }
    } else i++;
  }
  return cur;
}
const show = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

export function jsonpath(tpl: string, root: unknown): string {
  const toks = tpl.match(/\{[^}]*\}|[^{]+/g) ?? [];
  const run = (from: number, ctx: unknown): [string, number] => {
    let out = "";
    let k = from;
    while (k < toks.length) {
      const t = toks[k];
      if (!t.startsWith("{")) { out += t; k++; continue; }
      const inner = t.slice(1, -1).trim();
      if (inner === "end") return [out, k];
      const lit = /^"(.*)"$/.exec(inner) ?? /^'(.*)'$/.exec(inner);
      if (lit) { out += lit[1].replace(/\\n/g, "\n").replace(/\\t/g, "\t"); k++; continue; }
      const range = /^range\s+(.*)$/.exec(inner);
      if (range) {
        const items = walk(range[1], [ctx]);
        let endAt = k + 1;
        for (const item of items.length ? items : [undefined]) {
          const [s, e] = run(k + 1, item);
          if (items.length) out += s;
          endAt = e;
        }
        k = endAt + 1;
        continue;
      }
      out += walk(inner, [ctx]).map(show).join(" ");
      k++;
    }
    return [out, k];
  };
  return run(0, root)[0];
}

// ── Resource kinds ──────────────────────────────────────────────────────────
const KINDS: Record<string, string> = {
  po: "pods", pod: "pods", pods: "pods",
  deploy: "deployments", deployment: "deployments", deployments: "deployments", "deployments.apps": "deployments",
  rs: "replicasets", replicaset: "replicasets", replicasets: "replicasets",
  svc: "services", service: "services", services: "services",
  ep: "endpoints", endpoints: "endpoints",
  secret: "secrets", secrets: "secrets",
  cm: "configmaps", configmap: "configmaps", configmaps: "configmaps",
  ing: "ingresses", ingress: "ingresses", ingresses: "ingresses",
  no: "nodes", node: "nodes", nodes: "nodes",
  ns: "namespaces", namespace: "namespaces", namespaces: "namespaces",
  ev: "events", event: "events", events: "events",
  sa: "serviceaccounts", serviceaccount: "serviceaccounts", serviceaccounts: "serviceaccounts",
  netpol: "networkpolicies", networkpolicy: "networkpolicies", networkpolicies: "networkpolicies",
};
const SINGULAR: Record<string, string> = { pods: "pod", deployments: "deployment.apps", replicasets: "replicaset.apps", services: "service", endpoints: "endpoints", secrets: "secret", configmaps: "configmap", ingresses: "ingress.networking.k8s.io", nodes: "node", namespaces: "namespace", events: "event", serviceaccounts: "serviceaccount", networkpolicies: "networkpolicy.networking.k8s.io" };
const CLUSTER_SCOPED = new Set(["nodes", "namespaces"]);
const CAN_I: Record<string, string> = { ...KINDS, "pods/exec": "pods/exec", "pods/log": "pods/log", roles: "roles", rolebindings: "rolebindings", clusterroles: "clusterroles", clusterrolebindings: "clusterrolebindings", role: "roles", rolebinding: "rolebindings" };

const WRITES: Record<string, string> = {
  apply: "creates or updates resources from a file to match what it describes",
  create: "creates a new resource",
  delete: "deletes resources (a Deployment's pods come back unless you delete the Deployment)",
  edit: "opens a live resource in an editor and saves your changes to the cluster",
  patch: "changes some fields of a live resource",
  scale: "changes how many replicas a Deployment runs",
  set: "changes part of a resource, e.g. kubectl set image deployment/shop shop=shop:1.4.2",
  label: "adds or changes labels on a resource",
  annotate: "adds or changes annotations",
  expose: "creates a Service in front of pods",
  run: "starts a new pod",
  exec: "runs a command inside a running container — anyone allowed pods/exec can read its secrets",
  cp: "copies files to or from a container",
  "port-forward": "forwards a local port to a pod",
  attach: "attaches to a running container",
  cordon: "marks a node so no new pods are scheduled on it",
  uncordon: "allows pods to be scheduled on a node again",
  drain: "evicts the pods from a node before maintenance",
  taint: "marks a node so only pods that tolerate the taint run there",
  replace: "replaces a resource with the one in a file",
  debug: "starts a debugging container next to a pod",
};

const USAGE = text([
  "kubectl (practice cluster, read-only)",
  "",
  "  get <kind> [name]     pods, deploy, svc, endpoints, secrets, cm, ing, nodes, ns, events, sa, netpol, all",
  "     -n <ns> · -A (all namespaces) · -o wide | yaml | json | name | jsonpath='{...}' · -l app=shop · --show-labels",
  "  describe <kind> <name>  details and recent events — the first stop when something won't start",
  "  logs <pod>              the app's own output (--previous for the crashed container, --tail=20)",
  "  top pods | nodes        CPU and memory use",
  "  rollout status | history | undo deployment/<name>",
  "  auth can-i <verb> <resource> [--as=<user or system:serviceaccount:ns:name>]",
  "  config current-context | get-contexts · version · cluster-info",
]);

type Flags = { ns?: string; all: boolean; out?: string; sel?: Labels; field?: Labels; labels: boolean; prev: boolean; tail?: number; as?: string; revision?: number; rest: string[] };
function flags(args: string[]): Flags {
  const f: Flags = { all: false, labels: false, prev: false, rest: [] };
  const sel = (s: string) => Object.fromEntries(s.split(",").map((kv) => kv.split("=") as [string, string]));
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    let m: RegExpExecArray | null;
    if (a === "-n" || a === "--namespace") f.ns = args[++i];
    else if ((m = /^--namespace=(.+)$/.exec(a)) || (m = /^-n(.+)$/.exec(a))) f.ns = m[1];
    else if (a === "-A" || a === "--all-namespaces") f.all = true;
    else if (a === "-o" || a === "--output") f.out = args[++i];
    else if ((m = /^--output=(.+)$/.exec(a)) || (m = /^-o(.+)$/.exec(a))) f.out = m[1].replace(/^=/, "");
    else if (a === "-l" || a === "--selector") f.sel = sel(args[++i] ?? "");
    else if ((m = /^--selector=(.+)$/.exec(a)) || (m = /^-l(.+)$/.exec(a))) f.sel = sel(m[1]);
    else if (a === "--field-selector") f.field = sel(args[++i] ?? "");
    else if ((m = /^--field-selector=(.+)$/.exec(a))) f.field = sel(m[1]);
    else if (a === "--show-labels") f.labels = true;
    else if (a === "-p" || a === "--previous" || a === "--previous=true") f.prev = true;
    else if ((m = /^--tail=(-?\d+)$/.exec(a))) f.tail = +m[1];
    else if (a === "--tail") f.tail = +args[++i];
    else if ((m = /^--as=(.+)$/.exec(a))) f.as = m[1];
    else if (a === "--as") f.as = args[++i];
    else if ((m = /^--(?:to-)?revision=(\d+)$/.exec(a))) f.revision = +m[1];
    else if (a === "-c" || a === "--container") i++;
    else if (a.startsWith("-")) { /* -w, -f, --sort-by=…: accepted, no effect here */ }
    else f.rest.push(a);
  }
  return f;
}

// ── The tool ─────────────────────────────────────────────────────────────────
export function kubectlTool(cluster: KubeCluster): Tool {
  return {
    about: "inspect a Kubernetes cluster: get, describe, logs, events, rollout, auth can-i",
    run(argv) {
      const [cmd, ...args] = argv;
      if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") return ok(USAGE);
      const k = new Kube(cluster);
      const f = flags(args);
      switch (cmd) {
        case "get": return k.get(f);
        case "describe": return k.describe(f);
        case "logs": case "log": return k.logs(f);
        case "top": return k.top(f);
        case "rollout": return k.rollout(f);
        case "auth": return k.auth(f);
        case "config": return k.config(f);
        case "version": return ok("Client Version: v1.31.2\nKustomize Version: v5.4.2\nServer Version: v1.31.1\n");
        case "cluster-info": return ok("Kubernetes control plane is running at https://10.0.0.1:6443\nCoreDNS is running at https://10.0.0.1:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy\n");
        case "explain": return ok(`Run kubectl explain ${f.rest[0] ?? "pod"} on a real cluster for the field reference — or see https://kubernetes.io/docs/reference/kubernetes-api/\n`);
      }
      if (WRITES[cmd]) return fail(`kubectl ${argv.slice(0, 3).join(" ")}${argv.length > 3 ? " …" : ""}: this practice cluster is read-only.\nIn a real cluster, kubectl ${cmd} ${WRITES[cmd]}.`);
      return fail(`error: unknown command "${cmd}" for "kubectl"\nRun 'kubectl help' for what this lab supports.`);
    },
  };
}

class Kube {
  private c: KubeCluster;
  constructor(c: KubeCluster) { this.c = c; }

  private nsOf(x: { namespace?: string }) { return x.namespace ?? this.c.namespace; }
  private ready(p: KubePod) { return p.ready ?? p.status === "Running"; }
  private podsOf(d: KubeDeployment) { return this.c.pods.filter((p) => p.owner === d.name && this.nsOf(p) === this.nsOf(d)); }
  private endpoints(s: KubeService) {
    return this.c.pods.filter((p) => this.nsOf(p) === this.nsOf(s) && this.ready(p) && p.ip && matches(p.labels, s.selector))
      .flatMap((p) => s.ports.map((pt) => `${p.ip}:${pt.targetPort ?? pt.port}`));
  }
  private events(): (KubeEvent & { namespace: string })[] {
    const own = this.c.pods.flatMap((p) => (p.events ?? []).map(([type, reason, age, , message]) => ({ namespace: this.nsOf(p), age: age.replace(/ \(x\d+ over .*\)$/, ""), type, reason, object: `pod/${p.name}`, message })));
    return [...(this.c.events ?? []).map((e) => ({ ...e, namespace: this.nsOf(e) })), ...own].sort((a, b) => seconds(b.age) - seconds(a.age));
  }

  /** Every object of a kind, as { name, namespace, raw } so get/describe/-o can share them. */
  private list(kind: string): { name: string; namespace?: string; raw: unknown; labels?: Labels }[] {
    const c = this.c;
    const withNs = <T extends { name: string; namespace?: string }>(xs: T[] = []) => xs.map((x) => ({ name: x.name, namespace: this.nsOf(x), raw: x as unknown }));
    switch (kind) {
      case "pods": return c.pods.map((p) => ({ name: p.name, namespace: this.nsOf(p), raw: p, labels: p.labels }));
      case "deployments": return withNs(c.deployments);
      case "replicasets": return (c.deployments ?? []).flatMap((d) => d.revisions.map((r) => ({ name: `${d.name}-${r.hash}`, namespace: this.nsOf(d), raw: { d, r } })));
      case "services": return withNs(c.services);
      case "endpoints": return withNs(c.services);
      case "secrets": return withNs(c.secrets);
      case "configmaps": return withNs(c.configMaps);
      case "ingresses": return withNs(c.ingresses);
      case "serviceaccounts": return withNs(c.serviceAccounts);
      case "networkpolicies": return withNs(c.networkPolicies);
      case "nodes": return c.nodes.map((n) => ({ name: n.name, raw: n }));
      case "namespaces": return c.namespaces.map((n) => ({ name: n.name, raw: n }));
      case "events": return this.events().map((e, i) => ({ name: `${e.object.split("/")[1]}.${(17900000 + i * 7919).toString(16)}`, namespace: e.namespace, raw: e }));
    }
    return [];
  }

  private target(f: Flags, verb: string): { kind: string; names: string[] } | ToolResult {
    const [first, ...more] = f.rest;
    if (!first) return fail(`error: you must specify the type of resource to ${verb}. Try: kubectl ${verb} pods`);
    if (first.includes("/")) {
      const [k, n] = first.split("/");
      const kind = KINDS[k.toLowerCase()];
      if (!kind) return fail(`error: the server doesn't have a resource type "${k}"`);
      return { kind, names: [n, ...more.map((m) => m.split("/").pop()!)] };
    }
    const kind = KINDS[first.toLowerCase()];
    if (!kind && first !== "all") return fail(`error: the server doesn't have a resource type "${first}"`);
    return { kind: kind ?? "all", names: more };
  }

  private scoped(kind: string, f: Flags, names: string[]) {
    const ns = f.ns ?? this.c.namespace;
    let xs = this.list(kind).filter((x) => CLUSTER_SCOPED.has(kind) || f.all || x.namespace === ns);
    if (f.sel) xs = xs.filter((x) => matches(x.labels, f.sel!));
    if (f.field) {
      xs = xs.filter((x) => Object.entries(f.field!).every(([k, v]) => {
        const r = x.raw as Record<string, unknown>;
        const val = k === "status.phase" ? this.phase(r as KubePod) : k === "spec.nodeName" ? (r as KubePod).node : k === "metadata.name" ? x.name : k === "type" || k === "reason" ? r[k] : k === "involvedObject.name" ? String(r.object).split("/")[1] : undefined;
        return val === v;
      }));
    }
    if (!names.length) return { xs, missing: [] as string[] };
    const missing = names.filter((n) => !xs.some((x) => x.name === n));
    return { xs: names.flatMap((n) => xs.filter((x) => x.name === n)), missing };
  }

  private notFound(kind: string, names: string[]) {
    return names.map((n) => `Error from server (NotFound): ${kind} "${n}" not found`).join("\n");
  }

  private phase(p: KubePod) {
    return p.status === "Completed" ? "Succeeded" : p.status === "Error" ? "Failed" : p.node && !/^(ContainerCreating|Pending|Init|ImagePullBackOff|ErrImagePull|InvalidImageName)/.test(p.status) ? "Running" : "Pending";
  }

  get(f: Flags): ToolResult {
    const t = this.target(f, "get");
    if ("out" in t) return t;
    if (t.kind === "all") {
      const blocks: string[] = [];
      for (const kind of ["pods", "services", "deployments", "replicasets"]) {
        const { xs } = this.scoped(kind, f, []);
        if (!xs.length) continue;
        const prefix = { pods: "pod/", services: "service/", deployments: "deployment.apps/", replicasets: "replicaset.apps/" }[kind]!;
        const rows = this.rows(kind, xs, f);
        if (blocks.length) blocks.push("");
        blocks.push(...table(rows.head, rows.body.map((r) => { const at = f.all ? 1 : 0; const c = [...r]; c[at] = prefix + c[at]; return c; })));
      }
      return blocks.length ? ok(text(blocks)) : fail(`No resources found in ${f.ns ?? this.c.namespace} namespace.`, 0);
    }
    const { xs, missing } = this.scoped(t.kind, f, t.names);
    const err = missing.length ? this.notFound(SINGULAR[t.kind].split(".")[0] === "deployment" ? "deployments.apps" : t.kind, missing) : "";
    if (!xs.length && !missing.length) return { out: "", err: CLUSTER_SCOPED.has(t.kind) ? "No resources found" : f.all ? "No resources found" : `No resources found in ${f.ns ?? this.c.namespace} namespace.`, code: 0 };
    if (!xs.length) return fail(err);
    const out = f.out;
    if (out === "name") return { out: text(xs.map((x) => `${SINGULAR[t.kind]}/${x.name}`)), err };
    if (out === "yaml" || out === "json" || out?.startsWith("jsonpath") || out?.startsWith("go-template")) {
      const objs = xs.map((x) => this.obj(t.kind, x.raw));
      const single = t.names.length === 1 && objs.length === 1;
      const doc = single ? objs[0] : { apiVersion: "v1", kind: "List", items: objs, metadata: { resourceVersion: "" } };
      if (out === "yaml") return { out: text(yaml(doc)), err };
      if (out === "json") return { out: JSON.stringify(doc, null, 4) + "\n", err };
      const tpl = out.replace(/^(jsonpath|go-template)=?/, "");
      if (!tpl) return fail("error: template format specified but no template given");
      return { out: jsonpath(tpl, doc), err };
    }
    if (out && out !== "wide") return fail(`error: unable to match a printer suitable for the output format "${out}", allowed formats are: json,jsonpath,name,wide,yaml`);
    const rows = this.rows(t.kind, xs, f);
    return { out: text(table(rows.head, rows.body)), err };
  }

  private rows(kind: string, xs: { name: string; namespace?: string; raw: unknown }[], f: Flags): { head: string[]; body: string[][] } {
    const wide = f.out === "wide";
    let head: string[] = [], body: string[][] = [];
    const lbl = (l?: Labels) => labelStr(l);
    switch (kind) {
      case "pods": {
        head = ["NAME", "READY", "STATUS", "RESTARTS", "AGE", ...(wide ? ["IP", "NODE", "NOMINATED NODE", "READINESS GATES"] : [])];
        body = xs.map(({ raw }) => {
          const p = raw as KubePod;
          const n = p.containers.length;
          const r = p.restarts ?? 0;
          return [p.name, `${this.ready(p) ? n : 0}/${n}`, p.status, r && p.lastRestart ? `${r} (${p.lastRestart})` : String(r), p.age, ...(wide ? [p.ip ?? "<none>", p.node ?? "<none>", "<none>", "<none>"] : [])];
        });
        if (f.labels) { head.push("LABELS"); body = body.map((b, i) => [...b, lbl((xs[i].raw as KubePod).labels)]); }
        break;
      }
      case "deployments": {
        head = ["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE", ...(wide ? ["CONTAINERS", "IMAGES", "SELECTOR"] : [])];
        body = xs.map(({ raw }) => {
          const d = raw as KubeDeployment;
          const pods = this.podsOf(d);
          const live = d.revisions[d.revisions.length - 1];
          const ready = pods.filter((p) => this.ready(p)).length;
          const upToDate = pods.filter((p) => p.name.startsWith(`${d.name}-${live.hash}-`)).length;
          return [d.name, `${ready}/${d.replicas}`, String(upToDate), String(ready), d.age, ...(wide ? [d.containers.map((c) => c.name).join(","), d.containers.map((c) => c.image).join(","), labelStr(d.selector)] : [])];
        });
        break;
      }
      case "replicasets": {
        head = ["NAME", "DESIRED", "CURRENT", "READY", "AGE"];
        body = xs.map(({ name, raw }) => {
          const { d, r } = raw as { d: KubeDeployment; r: { hash: string } };
          const pods = this.podsOf(d).filter((p) => p.name.startsWith(name + "-"));
          const live = d.revisions[d.revisions.length - 1].hash === r.hash;
          return [name, String(live ? d.replicas : pods.length), String(pods.length), String(pods.filter((p) => this.ready(p)).length), d.age];
        });
        break;
      }
      case "services": {
        head = ["NAME", "TYPE", "CLUSTER-IP", "EXTERNAL-IP", "PORT(S)", "AGE", ...(wide ? ["SELECTOR"] : [])];
        body = xs.map(({ raw }) => {
          const s = raw as KubeService;
          const type = s.type ?? "ClusterIP";
          return [s.name, type, s.clusterIP, s.externalIP ?? (type === "LoadBalancer" ? "<pending>" : "<none>"), s.ports.map((p) => `${p.port}${p.nodePort ? ":" + p.nodePort : ""}/TCP`).join(","), s.age, ...(wide ? [labelStr(s.selector)] : [])];
        });
        break;
      }
      case "endpoints": {
        head = ["NAME", "ENDPOINTS", "AGE"];
        body = xs.map(({ raw }) => { const s = raw as KubeService; const e = this.endpoints(s); return [s.name, e.length ? e.slice(0, 3).join(",") + (e.length > 3 ? ` + ${e.length - 3} more...` : "") : "<none>", s.age]; });
        break;
      }
      case "secrets": head = ["NAME", "TYPE", "DATA", "AGE"]; body = xs.map(({ raw }) => { const s = raw as KubeSecret; return [s.name, s.type ?? "Opaque", String(Object.keys(s.data).length), s.age]; }); break;
      case "configmaps": head = ["NAME", "DATA", "AGE"]; body = xs.map(({ raw }) => { const s = raw as KubeConfigMap; return [s.name, String(Object.keys(s.data).length), s.age]; }); break;
      case "ingresses": head = ["NAME", "CLASS", "HOSTS", "ADDRESS", "PORTS", "AGE"]; body = xs.map(({ raw }) => { const g = raw as KubeIngress; return [g.name, g.className ?? "<none>", g.host, g.address ?? "", g.tls ? "80, 443" : "80", g.age]; }); break;
      case "serviceaccounts": head = ["NAME", "SECRETS", "AGE"]; body = xs.map(({ raw }) => { const s = raw as KubeServiceAccount; return [s.name, "0", s.age]; }); break;
      case "networkpolicies": head = ["NAME", "POD-SELECTOR", "AGE"]; body = xs.map(({ raw }) => { const n = raw as KubeNetworkPolicy; return [n.name, Object.keys(n.podSelector).length ? labelStr(n.podSelector) : "<none>", n.age]; }); break;
      case "nodes": head = ["NAME", "STATUS", "ROLES", "AGE", "VERSION", ...(wide ? ["INTERNAL-IP"] : [])]; body = xs.map(({ raw }) => { const n = raw as KubeNode; return [n.name, n.status ?? "Ready", n.roles ?? "<none>", n.age, n.version, ...(wide ? [n.ip] : [])]; }); break;
      case "namespaces": head = ["NAME", "STATUS", "AGE"]; body = xs.map(({ raw }) => { const n = raw as { name: string; age: string }; return [n.name, "Active", n.age]; }); break;
      case "events": head = ["LAST SEEN", "TYPE", "REASON", "OBJECT", "MESSAGE"]; body = xs.map(({ raw }) => { const e = raw as KubeEvent; return [e.age, e.type, e.reason, e.object, e.message]; }); break;
    }
    if (f.all && !CLUSTER_SCOPED.has(kind)) { head = ["NAMESPACE", ...head]; body = body.map((b, i) => [xs[i].namespace ?? "", ...b]); }
    return { head, body };
  }

  /** The object as the API server would return it, for -o yaml / json / jsonpath. */
  private obj(kind: string, raw: unknown): Record<string, unknown> {
    const meta = (name: string, ns?: string, labels?: Labels) => ({ name, ...(ns ? { namespace: ns } : {}), ...(labels && Object.keys(labels).length ? { labels } : {}) });
    const container = (c: KubeContainer) => ({
      name: c.name, image: c.image, imagePullPolicy: c.image.endsWith(":latest") || !c.image.includes(":") ? "Always" : "IfNotPresent",
      ...(c.ports?.length ? { ports: c.ports.map((p) => ({ containerPort: p, protocol: "TCP" })) } : {}),
      ...(c.env || c.secretEnv || c.configEnv ? { env: [
        ...Object.entries(c.env ?? {}).map(([name, value]) => ({ name, value })),
        ...Object.entries(c.secretEnv ?? {}).map(([name, [s, k]]) => ({ name, valueFrom: { secretKeyRef: { name: s, key: k } } })),
        ...Object.entries(c.configEnv ?? {}).map(([name, [m, k]]) => ({ name, valueFrom: { configMapKeyRef: { name: m, key: k } } })),
      ] } : {}),
      resources: { ...(c.limits ? { limits: c.limits } : {}), ...(c.requests ? { requests: c.requests } : {}) },
      ...(c.securityContext ? { securityContext: c.securityContext } : {}),
      ...(c.readiness ? { readinessProbe: { httpGet: { path: c.readiness.path, port: c.readiness.port } } } : {}),
      ...(c.liveness ? { livenessProbe: { httpGet: { path: c.liveness.path, port: c.liveness.port } } } : {}),
    });
    switch (kind) {
      case "pods": {
        const p = raw as KubePod;
        const st = this.state(p);
        const stateObj = (s: ContainerState) => ({ [s.state.toLowerCase()]: s.state === "Running" ? { startedAt: "2026-10-24T08:00:00Z" } : { ...(s.reason ? { reason: s.reason } : {}), ...(s.exitCode !== undefined ? { exitCode: s.exitCode } : {}), ...(s.message ? { message: s.message } : {}) } });
        return {
          apiVersion: "v1", kind: "Pod",
          metadata: { ...meta(p.name, this.nsOf(p), p.labels), ...(p.owner ? { ownerReferences: [{ apiVersion: "apps/v1", kind: "ReplicaSet", name: p.name.split("-").slice(0, -1).join("-"), controller: true }] } : {}) },
          spec: { containers: p.containers.map(container), serviceAccountName: p.serviceAccount ?? "default", ...(p.node ? { nodeName: p.node } : {}), restartPolicy: "Always" },
          status: {
            phase: this.phase(p), ...(p.ip ? { podIP: p.ip } : {}),
            containerStatuses: p.containers.map((c) => ({ name: c.name, image: c.image, ready: this.ready(p), restartCount: p.restarts ?? 0, state: stateObj(st), ...(p.lastState ? { lastState: stateObj(p.lastState) } : {}) })),
          },
        };
      }
      case "deployments": {
        const d = raw as KubeDeployment;
        const live = d.revisions[d.revisions.length - 1];
        const pods = this.podsOf(d);
        return {
          apiVersion: "apps/v1", kind: "Deployment",
          metadata: { ...meta(d.name, this.nsOf(d), d.selector), annotations: { "deployment.kubernetes.io/revision": String(live.revision) } },
          spec: { replicas: d.replicas, selector: { matchLabels: d.selector }, strategy: { type: "RollingUpdate", rollingUpdate: { maxSurge: "25%", maxUnavailable: "25%" } }, template: { metadata: { labels: d.selector }, spec: { containers: d.containers.map(container), serviceAccountName: d.serviceAccount ?? "default" } } },
          status: { replicas: pods.length, readyReplicas: pods.filter((p) => this.ready(p)).length, updatedReplicas: pods.filter((p) => p.name.startsWith(`${d.name}-${live.hash}-`)).length },
        };
      }
      case "services": case "endpoints": {
        const s = raw as KubeService;
        if (kind === "endpoints") {
          const ips = this.endpoints(s).map((e) => e.split(":")[0]);
          return { apiVersion: "v1", kind: "Endpoints", metadata: meta(s.name, this.nsOf(s)), subsets: ips.length ? [{ addresses: [...new Set(ips)].map((ip) => ({ ip })), ports: s.ports.map((p) => ({ port: p.targetPort ?? p.port, protocol: "TCP" })) }] : [] };
        }
        return { apiVersion: "v1", kind: "Service", metadata: meta(s.name, this.nsOf(s)), spec: { type: s.type ?? "ClusterIP", clusterIP: s.clusterIP, selector: s.selector, ports: s.ports.map((p) => ({ port: p.port, targetPort: p.targetPort ?? p.port, protocol: "TCP", ...(p.nodePort ? { nodePort: p.nodePort } : {}) })) } };
      }
      case "secrets": { const s = raw as KubeSecret; return { apiVersion: "v1", kind: "Secret", metadata: meta(s.name, this.nsOf(s)), type: s.type ?? "Opaque", data: Object.fromEntries(Object.entries(s.data).map(([k, v]) => [k, b64encode(v)])) }; }
      case "configmaps": { const m = raw as KubeConfigMap; return { apiVersion: "v1", kind: "ConfigMap", metadata: meta(m.name, this.nsOf(m)), data: m.data }; }
      case "ingresses": { const g = raw as KubeIngress; return { apiVersion: "networking.k8s.io/v1", kind: "Ingress", metadata: meta(g.name, this.nsOf(g)), spec: { ...(g.className ? { ingressClassName: g.className } : {}), rules: [{ host: g.host, http: { paths: g.paths.map((p) => ({ path: p.path, pathType: "Prefix", backend: { service: { name: p.service, port: { number: p.port } } } })) } }], ...(g.tls ? { tls: [{ hosts: [g.host], secretName: `${g.name}-tls` }] } : {}) } }; }
      case "serviceaccounts": { const s = raw as KubeServiceAccount; return { apiVersion: "v1", kind: "ServiceAccount", metadata: meta(s.name, this.nsOf(s)) }; }
      case "networkpolicies": { const n = raw as KubeNetworkPolicy; return { apiVersion: "networking.k8s.io/v1", kind: "NetworkPolicy", metadata: meta(n.name, this.nsOf(n)), spec: { podSelector: Object.keys(n.podSelector).length ? { matchLabels: n.podSelector } : {}, policyTypes: n.policyTypes, ...(n.from ? { ingress: [{ from: n.from.map((x) => ({ podSelector: { matchLabels: Object.fromEntries([x.split("=")]) } })) }] } : {}) } }; }
      case "nodes": { const n = raw as KubeNode; return { apiVersion: "v1", kind: "Node", metadata: meta(n.name), spec: n.taints ? { taints: n.taints.map((t) => { const [kv, effect] = t.split(":"); const [key, value] = kv.split("="); return { key, ...(value ? { value } : {}), effect }; }) } : {}, status: { allocatable: { cpu: n.cpu, memory: n.memory }, nodeInfo: { kubeletVersion: n.version }, addresses: [{ type: "InternalIP", address: n.ip }] } }; }
      case "namespaces": { const n = raw as { name: string }; return { apiVersion: "v1", kind: "Namespace", metadata: meta(n.name), status: { phase: "Active" } }; }
      case "replicasets": { const { d, r } = raw as { d: KubeDeployment; r: { hash: string; image: string } }; return { apiVersion: "apps/v1", kind: "ReplicaSet", metadata: meta(`${d.name}-${r.hash}`, this.nsOf(d)), spec: { template: { spec: { containers: [{ name: d.containers[0].name, image: r.image }] } } } }; }
      case "events": { const e = raw as KubeEvent; return { apiVersion: "v1", kind: "Event", type: e.type, reason: e.reason, message: e.message, involvedObject: { kind: e.object.split("/")[0], name: e.object.split("/")[1] } }; }
    }
    return {};
  }

  private state(p: KubePod): ContainerState {
    if (p.state) return p.state;
    if (p.status === "Running") return { state: "Running" };
    if (p.status === "Completed") return { state: "Terminated", reason: "Completed", exitCode: 0 };
    if (p.status === "Pending") return { state: "Waiting" };
    return { state: "Waiting", reason: p.status };
  }

  describe(f: Flags): ToolResult {
    const t = this.target(f, "describe");
    if ("out" in t) return t;
    const { xs, missing } = this.scoped(t.kind, f, t.names);
    if (!xs.length) return fail(missing.length ? this.notFound(t.kind, missing) : `No resources found in ${f.ns ?? this.c.namespace} namespace.`, missing.length ? 1 : 0);
    const kv = (k: string, v: string, w = 18) => `${(k + ":").padEnd(w)}${v}`;
    const labels = (k: string, l?: Labels, w = 18) => { const e = Object.entries(l ?? {}); return e.length ? e.map(([a, b], i) => (i ? " ".repeat(w) : (k + ":").padEnd(w)) + `${a}=${b}`) : [kv(k, "<none>", w)]; };
    const evts = (es: Event[]) => es.length ? ["Events:", ...table(["Type", "Reason", "Age", "From", "Message"], [["----", "------", "----", "----", "-------"], ...es.map((e) => [...e])]).map((l) => "  " + l)] : ["Events:            <none>"];
    const blocks = xs.map(({ raw }) => {
      switch (t.kind) {
        case "pods": {
          const p = raw as KubePod;
          const st = this.state(p);
          const node = p.node ? this.c.nodes.find((n) => n.name === p.node) : undefined;
          const stLines = (label: string, s: ContainerState) => [`    ${(label + ":").padEnd(16)}${s.state}${s.state === "Running" ? "" : ""}`, ...(s.reason ? [`      Reason:       ${s.reason}`] : []), ...(s.message ? [`      Message:      ${s.message}`] : []), ...(s.exitCode !== undefined ? [`      Exit Code:    ${s.exitCode}`] : [])];
          const cs = p.containers.flatMap((c) => [
            `  ${c.name}:`,
            `    Image:          ${c.image}`,
            ...(c.ports?.length ? [`    Port:           ${c.ports.map((x) => x + "/TCP").join(", ")}`] : []),
            ...stLines("State", st),
            ...(p.lastState ? stLines("Last State", p.lastState) : []),
            `    Ready:          ${this.ready(p) ? "True" : "False"}`,
            `    Restart Count:  ${p.restarts ?? 0}`,
            ...(c.limits ? ["    Limits:", ...Object.entries(c.limits).map(([k, v]) => `      ${(k + ":").padEnd(8)} ${v}`)] : []),
            ...(c.requests ? ["    Requests:", ...Object.entries(c.requests).map(([k, v]) => `      ${(k + ":").padEnd(8)} ${v}`)] : []),
            ...(c.liveness ? [`    Liveness:       http-get http://:${c.liveness.port}${c.liveness.path} delay=0s timeout=1s period=10s #success=1 #failure=3`] : []),
            ...(c.readiness ? [`    Readiness:      http-get http://:${c.readiness.port}${c.readiness.path} delay=0s timeout=1s period=10s #success=1 #failure=3`] : []),
            ...(c.env || c.secretEnv || c.configEnv ? ["    Environment:", ...Object.entries(c.env ?? {}).map(([k, v]) => `      ${k}:  ${v}`), ...Object.entries(c.secretEnv ?? {}).map(([k, [s, key]]) => `      ${k}:  <set to the key '${key}' in secret '${s}'>  Optional: false`), ...Object.entries(c.configEnv ?? {}).map(([k, [m, key]]) => `      ${k}:  <set to the key '${key}' of config map '${m}'>  Optional: false`)] : ["    Environment:    <none>"]),
            ...(c.securityContext ? ["    Security Context:", ...Object.entries(c.securityContext).map(([k, v]) => `      ${k}: ${v}`)] : []),
          ]);
          const scheduled = !!p.node;
          const reqs = p.containers.some((c) => c.requests), lims = p.containers.some((c) => c.limits);
          return [
            kv("Name", p.name), kv("Namespace", this.nsOf(p)), kv("Priority", "0"), kv("Service Account", p.serviceAccount ?? "default"),
            kv("Node", node ? `${node.name}/${node.ip}` : "<none>"), ...labels("Labels", p.labels), kv("Annotations", "<none>"),
            kv("Status", this.phase(p)), kv("IP", p.ip ?? ""),
            ...(p.owner ? [kv("Controlled By", `ReplicaSet/${p.name.split("-").slice(0, -1).join("-")}`)] : []),
            "Containers:", ...cs,
            "Conditions:", "  Type              Status",
            `  Initialized       ${scheduled ? "True" : "False"}`, `  Ready             ${this.ready(p) ? "True" : "False"}`,
            `  ContainersReady   ${this.ready(p) ? "True" : "False"}`, `  PodScheduled      ${scheduled ? "True" : "False"}`,
            kv("QoS Class", lims && reqs ? "Burstable" : reqs ? "Burstable" : "BestEffort"),
            ...evts(p.events ?? []),
          ];
        }
        case "deployments": {
          const d = raw as KubeDeployment;
          const pods = this.podsOf(d);
          const live = d.revisions[d.revisions.length - 1];
          const ready = pods.filter((p) => this.ready(p)).length;
          const updated = pods.filter((p) => p.name.startsWith(`${d.name}-${live.hash}-`)).length;
          return [
            kv("Name", d.name, 24), kv("Namespace", this.nsOf(d), 24), ...labels("Selector", d.selector, 24),
            kv("Replicas", `${d.replicas} desired | ${updated} updated | ${pods.length} total | ${ready} available | ${Math.max(0, pods.length - ready)} unavailable`, 24),
            kv("StrategyType", "RollingUpdate", 24), kv("RollingUpdateStrategy", "25% max unavailable, 25% max surge", 24),
            "Pod Template:", ...labels("  Labels", d.selector, 16).map((l) => l), `  Service Account:  ${d.serviceAccount ?? "default"}`, "  Containers:",
            ...d.containers.flatMap((c) => [`   ${c.name}:`, `    Image:      ${c.image}`, ...(c.ports?.length ? [`    Port:       ${c.ports[0]}/TCP`] : []), ...(c.limits ? [`    Limits:     ${Object.entries(c.limits).map(([k, v]) => `${k}=${v}`).join(", ")}`] : [])]),
            kv("OldReplicaSets", d.revisions.length > 1 ? `${d.name}-${d.revisions[d.revisions.length - 2].hash}` : "<none>", 24),
            kv("NewReplicaSet", `${d.name}-${live.hash} (${updated}/${d.replicas} replicas created)`, 24),
            "Events:          <none>",
          ];
        }
        case "services": case "endpoints": {
          const s = raw as KubeService;
          const e = this.endpoints(s);
          return [
            kv("Name", s.name), kv("Namespace", this.nsOf(s)), ...labels("Selector", s.selector), kv("Type", s.type ?? "ClusterIP"), kv("IP", s.clusterIP),
            ...s.ports.flatMap((p) => [kv("Port", `<unset>  ${p.port}/TCP`), kv("TargetPort", `${p.targetPort ?? p.port}/TCP`), ...(p.nodePort ? [kv("NodePort", `<unset>  ${p.nodePort}/TCP`)] : [])]),
            kv("Endpoints", e.length ? e.join(",") : "<none>"), kv("Session Affinity", "None"), "Events:            <none>",
          ];
        }
        case "secrets": {
          const s = raw as KubeSecret;
          return [kv("Name", s.name, 14), kv("Namespace", this.nsOf(s), 14), kv("Labels", "<none>", 14), "", `Type:  ${s.type ?? "Opaque"}`, "", "Data", "====", ...Object.entries(s.data).map(([k, v]) => `${k}:  ${new TextEncoder().encode(v).length} bytes`)];
        }
        case "configmaps": {
          const m = raw as KubeConfigMap;
          return [kv("Name", m.name, 14), kv("Namespace", this.nsOf(m), 14), "", "Data", "====", ...Object.entries(m.data).flatMap(([k, v]) => [`${k}:`, "----", ...v.replace(/\n$/, "").split("\n"), ""]), "Events:  <none>"];
        }
        case "ingresses": {
          const g = raw as KubeIngress;
          return [kv("Name", g.name), kv("Namespace", this.nsOf(g)), kv("Address", g.address ?? ""), kv("Ingress Class", g.className ?? "<none>"), ...(g.tls ? ["TLS:", `  ${g.name}-tls terminates ${g.host}`] : []), "Rules:", "  Host                Path  Backends", "  ----                ----  --------", ...g.paths.map((p, i) => `  ${(i ? "" : g.host).padEnd(20)}${p.path.padEnd(6)}${p.service}:${p.port} (${(() => { const s = this.c.services?.find((x) => x.name === p.service && this.nsOf(x) === this.nsOf(g)); const e = s ? this.endpoints(s) : []; return e.length ? e.join(",") : "<error: endpoints \"" + p.service + "\" not found>"; })()})`), "Events:             <none>"];
        }
        case "nodes": {
          const n = raw as KubeNode;
          const pods = this.c.pods.filter((p) => p.node === n.name);
          const sum = (key: "cpu" | "memory", which: "requests" | "limits") => pods.flatMap((p) => p.containers.map((c) => c[which]?.[key] ?? "0")).reduce((s, v) => s + qty(v), 0);
          const pct = (used: number, total: string) => `${Math.round((used / qty(total)) * 100)}%`;
          const fmt = (key: "cpu" | "memory", v: number) => (key === "cpu" ? `${Math.round(v * 1000)}m` : `${Math.round(v / 2 ** 20)}Mi`);
          return [
            kv("Name", n.name), kv("Roles", n.roles ?? "<none>"), kv("Taints", n.taints?.join(", ") ?? "<none>"),
            "Conditions:", "  Type             Status", ...(["MemoryPressure", "DiskPressure", "PIDPressure"] as const).map((c) => `  ${c.padEnd(17)}${n.pressure?.includes(c) ? "True" : "False"}`), `  Ready            ${(n.status ?? "Ready").startsWith("Ready") ? "True" : "False"}`,
            "Addresses:", `  InternalIP:  ${n.ip}`, "Allocatable:", `  cpu:     ${n.cpu}`, `  memory:  ${n.memory}`,
            "Non-terminated Pods:", ...pods.map((p) => `  ${this.nsOf(p)}/${p.name}`),
            "Allocated resources:", "  Resource  Requests      Limits", "  --------  --------      ------",
            ...(["cpu", "memory"] as const).map((k) => `  ${k.padEnd(10)}${`${fmt(k, sum(k, "requests"))} (${pct(sum(k, "requests"), n[k])})`.padEnd(14)}${fmt(k, sum(k, "limits"))} (${pct(sum(k, "limits"), n[k])})`),
            "Events:              <none>",
          ];
        }
        case "serviceaccounts": {
          const s = raw as KubeServiceAccount;
          const rules = (this.c.rbac ?? []).filter((r) => r.who === `system:serviceaccount:${this.nsOf(s)}:${s.name}`);
          return [kv("Name", s.name, 20), kv("Namespace", this.nsOf(s), 20), kv("Mountable secrets", "<none>", 20), kv("Tokens", "<none>", 20), ...(rules.length ? ["Bound by:", ...rules.map((r) => `  ${r.binding}  (${r.verbs.join(",")} ${r.resources.join(",")}${r.namespace === "*" ? ", cluster-wide" : ""})`)] : []), "Events:             <none>"];
        }
        case "networkpolicies": {
          const n = raw as KubeNetworkPolicy;
          return [kv("Name", n.name), kv("Namespace", this.nsOf(n)), "Spec:", `  PodSelector:     ${Object.keys(n.podSelector).length ? labelStr(n.podSelector) : "<none> (Allowing the specific traffic to all pods in this namespace)"}`, "  Allowing ingress traffic:", ...(n.from?.length ? n.from.map((x) => `    From PodSelector: ${x}`) : ["    <none> (Selected pods are isolated for ingress connectivity)"]), `  Policy Types: ${n.policyTypes.join(", ")}`];
        }
        case "namespaces": { const n = raw as { name: string }; return [kv("Name", n.name), kv("Status", "Active"), "No resource quota.", "No LimitRange resource."]; }
      }
      return [`describe for ${t.kind} isn't available in this lab — try kubectl get ${t.kind} ${xs[0].name} -o yaml`];
    });
    const out = blocks.flatMap((b, i) => (i ? ["", "", ...b] : b));
    return { out: text(out), err: missing.length ? this.notFound(t.kind, missing) : "" };
  }

  logs(f: Flags): ToolResult {
    const [first] = f.rest;
    if (!first) return fail("error: expected 'logs (POD | TYPE/NAME) [CONTAINER_NAME]'.\nPOD or TYPE/NAME is a required argument for the logs command");
    const ns = f.ns ?? this.c.namespace;
    let pod: KubePod | undefined;
    if (first.includes("/")) {
      const [k, n] = first.split("/");
      const kind = KINDS[k];
      if (kind === "deployments") { const d = this.c.deployments?.find((x) => x.name === n && this.nsOf(x) === ns); pod = d && this.podsOf(d)[0]; if (!d) return fail(`error: deployments.apps "${n}" not found`); }
      else if (kind === "pods") pod = this.c.pods.find((p) => p.name === n && this.nsOf(p) === ns);
    } else pod = this.c.pods.find((p) => p.name === first && this.nsOf(p) === ns);
    if (!pod) return fail(`error: pods "${first.split("/").pop()}" not found${!f.ns && this.c.pods.some((p) => p.name === first) ? `\n(that pod is in namespace ${this.c.pods.find((p) => p.name === first)!.namespace} — add -n ${this.c.pods.find((p) => p.name === first)!.namespace})` : ""}`);
    const c = pod.containers[0].name;
    let data = f.prev ? pod.previousLogs : pod.logs;
    if (data === undefined) {
      if (f.prev) return fail(`Error from server (BadRequest): previous terminated container "${c}" in pod "${pod.name}" not found`);
      if (/ImagePull|ErrImage/.test(pod.status)) return fail(`Error from server (BadRequest): container "${c}" in pod "${pod.name}" is waiting to start: trying and failing to pull image`);
      if (!pod.node || /Pending|ContainerCreating/.test(pod.status)) return fail(`Error from server (BadRequest): container "${c}" in pod "${pod.name}" is waiting to start: ContainerCreating`);
      data = "";
    }
    if (f.tail !== undefined && f.tail >= 0) { const ls = data.replace(/\n$/, "").split("\n"); data = text(ls.slice(Math.max(0, ls.length - f.tail))); }
    return ok(data && !data.endsWith("\n") ? data + "\n" : data);
  }

  top(f: Flags): ToolResult {
    const what = KINDS[f.rest[0] ?? ""];
    if (what === "nodes") {
      if (!this.c.nodes.some((n) => this.c.pods.some((p) => p.node === n.name && p.usage))) return fail("error: Metrics API not available");
      const rows = this.c.nodes.map((n) => {
        const pods = this.c.pods.filter((p) => p.node === n.name && p.usage);
        const cpu = pods.reduce((s, p) => s + qty(p.usage!.cpu), 0), mem = pods.reduce((s, p) => s + qty(p.usage!.memory), 0);
        return [n.name, `${Math.round(cpu * 1000)}m`, `${Math.round((cpu / qty(n.cpu)) * 100)}%`, `${Math.round(mem / 2 ** 20)}Mi`, `${Math.round((mem / qty(n.memory)) * 100)}%`];
      });
      return ok(text(table(["NAME", "CPU(cores)", "CPU(%)", "MEMORY(bytes)", "MEMORY(%)"], rows)));
    }
    if (what === "pods") {
      const ns = f.ns ?? this.c.namespace;
      const pods = this.c.pods.filter((p) => (f.all || this.nsOf(p) === ns) && p.usage);
      if (!pods.length) return fail(this.c.pods.some((p) => p.usage) ? `No resources found in ${ns} namespace.` : "error: Metrics API not available", this.c.pods.some((p) => p.usage) ? 0 : 1);
      const head = ["NAME", "CPU(cores)", "MEMORY(bytes)"];
      const rows = pods.map((p) => [p.name, p.usage!.cpu, p.usage!.memory]);
      return ok(text(table(f.all ? ["NAMESPACE", ...head] : head, f.all ? rows.map((r, i) => [this.nsOf(pods[i]), ...r]) : rows)));
    }
    return fail("error: specify pods or nodes, e.g. kubectl top pods");
  }

  rollout(f: Flags): ToolResult {
    const [sub, ref, more] = f.rest;
    const name = ref?.includes("/") ? ref.split("/")[1] : more;
    const kindOk = ref?.includes("/") ? KINDS[ref.split("/")[0]] === "deployments" : KINDS[ref ?? ""] === "deployments";
    if (!sub || !name || !kindOk) return fail("usage: kubectl rollout status|history|undo|restart deployment/<name>");
    const ns = f.ns ?? this.c.namespace;
    const d = this.c.deployments?.find((x) => x.name === name && this.nsOf(x) === ns);
    if (!d) return fail(`Error from server (NotFound): deployments.apps "${name}" not found`);
    const live = d.revisions[d.revisions.length - 1];
    if (sub === "history") {
      if (f.revision) {
        const r = d.revisions.find((x) => x.revision === f.revision);
        if (!r) return fail(`error: unable to find the specified revision`);
        return ok(text([`deployment.apps/${d.name} with revision #${r.revision}`, "Pod Template:", `  Labels:\t${labelStr(d.selector)}`, `\tpod-template-hash=${r.hash}`, ...(r.cause ? [`  Annotations:\tkubernetes.io/change-cause: ${r.cause}`] : []), "  Containers:", `   ${d.containers[0].name}:`, `    Image:\t${r.image}`, ...(d.containers[0].ports?.length ? [`    Port:\t${d.containers[0].ports[0]}/TCP`] : [])]));
      }
      return ok(text([`deployment.apps/${d.name} `, ...table(["REVISION", "CHANGE-CAUSE"], d.revisions.map((r) => [String(r.revision), r.cause ?? "<none>"]))]));
    }
    if (sub === "status") {
      const pods = this.podsOf(d);
      const updated = pods.filter((p) => p.name.startsWith(`${d.name}-${live.hash}-`));
      const ready = updated.filter((p) => this.ready(p)).length;
      if (ready >= d.replicas && updated.length === pods.length) return ok(`deployment "${d.name}" successfully rolled out\n`);
      return { out: `Waiting for deployment "${d.name}" rollout to finish: ${ready} of ${d.replicas} updated replicas are available...\n`, err: "(the rollout is stuck: the new pods aren't becoming ready — check kubectl get pods and kubectl describe pod)\n", code: 1 };
    }
    if (sub === "undo") {
      const to = f.revision ? d.revisions.find((r) => r.revision === f.revision) : d.revisions[d.revisions.length - 2];
      if (!to) return fail("error: no rollout history found to roll back to");
      return fail(`kubectl rollout undo: this practice cluster is read-only.\nIn a real cluster this would roll deployment/${d.name} back to revision ${to.revision} (image ${to.image}), replacing the pods one at a time.`);
    }
    if (sub === "restart" || sub === "pause" || sub === "resume") return fail(`kubectl rollout ${sub}: this practice cluster is read-only.`);
    return fail(`error: unknown rollout command "${sub}"`);
  }

  auth(f: Flags): ToolResult {
    const [sub, verb, res] = f.rest;
    if (sub !== "can-i") return fail("usage: kubectl auth can-i <verb> <resource> [-n <namespace>] [--as=<user>]");
    const who = f.as ?? this.c.user;
    const ns = f.all ? "*" : f.ns ?? this.c.namespace;
    const rules = (this.c.rbac ?? []).filter((r) => r.who === who && (r.namespace === "*" || r.namespace === ns));
    if (verb === "--list" || f.rest.includes("--list") || !verb) {
      return ok(text(table(["Resources", "Non-Resource URLs", "Resource Names", "Verbs"], rules.map((r) => [r.resources.join(", "), "[]", "[]", `[${r.verbs.join(" ")}]`]))));
    }
    const resource = CAN_I[(res ?? "").split("/")[0].toLowerCase()] + (res?.includes("/") ? "/" + res.split("/")[1] : "");
    if (!res || resource.startsWith("undefined")) return fail(`Warning: the server doesn't have a resource type '${res ?? ""}'\nusage: kubectl auth can-i <verb> <resource>`);
    const yes = rules.some((r) => (r.verbs.includes("*") || r.verbs.includes(verb)) && (r.resources.includes("*") || r.resources.includes(resource)));
    return { out: yes ? "yes\n" : "no\n", code: yes ? 0 : 1 };
  }

  config(f: Flags): ToolResult {
    const [sub] = f.rest;
    if (sub === "current-context") return ok(this.c.context + "\n");
    if (sub === "get-contexts") return ok(text(table(["CURRENT", "NAME", "CLUSTER", "AUTHINFO", "NAMESPACE"], [["*", this.c.context, this.c.context, this.c.user, this.c.namespace]])));
    if (sub === "view") return ok(text(["apiVersion: v1", "kind: Config", `current-context: ${this.c.context}`, "contexts:", `- context:`, `    cluster: ${this.c.context}`, `    namespace: ${this.c.namespace}`, `    user: ${this.c.user}`, `  name: ${this.c.context}`, "users:", `- name: ${this.c.user}`, "  user:", "    token: REDACTED"]));
    if (sub === "set-context" || sub === "use-context") return fail(`kubectl config ${sub}: this practice cluster's config is read-only — use -n <namespace> on each command instead.`);
    return fail("usage: kubectl config current-context | get-contexts | view");
  }
}

/** A Kubernetes quantity (500m, 2, 512Mi, 4Gi) as cores or bytes. */
function qty(v: string): number {
  const m = /^([\d.]+)(m|Ki|Mi|Gi|Ti|k|M|G)?$/.exec(v.trim());
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return { m: n / 1000, Ki: n * 2 ** 10, Mi: n * 2 ** 20, Gi: n * 2 ** 30, Ti: n * 2 ** 40, k: n * 1e3, M: n * 1e6, G: n * 1e9 }[m[2] ?? ""] ?? n;
}
