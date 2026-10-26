// A small Docker for the labs. Images (their build history and settings) and
// containers (how they were started) are data, read with docker images, ps,
// history, inspect and logs — output shaped like the real CLI's, including
// --format '{{…}}' templates. Anything that would build, run or change
// something explains what it would do instead.

import type { Tool, ToolResult } from "./shell";
import { sha256Hex } from "./hash";

export type DockerLayer = { by: string; size: string; age: string; comment?: string };

export type DockerImage = {
  repo: string;
  tag: string;
  id: string; // 12 hex characters
  age: string; // "9 minutes ago"
  created: string; // ISO time, for inspect
  size: string; // "1.12GB"
  layers: DockerLayer[]; // oldest first, as written in the Dockerfile
  user?: string; // "" or unset = root
  env?: string[];
  ports?: string[]; // "8080/tcp"
  cmd?: string[];
  entrypoint?: string[];
  workdir?: string;
  labels?: Record<string, string>;
};

export type DockerContainer = {
  id: string; // 12 hex characters
  name: string;
  image: string; // repo:tag
  command: string;
  age: string; // "2 hours ago"
  status: string; // "Up 2 hours" or "Exited (1) 3 minutes ago"
  ports?: string[]; // "0.0.0.0:5432->5432/tcp"
  logs?: string;
  privileged?: boolean;
  binds?: string[]; // "/var/run/docker.sock:/var/run/docker.sock"
  network?: string; // "bridge" (default) or "host"
  pid?: string; // "host" shares the host's process list
  capAdd?: string[];
  readOnly?: boolean;
  user?: string;
  env?: string[];
  restart?: string;
};

export type DockerHost = { images: DockerImage[]; containers: DockerContainer[] };

const text = (ls: string[]) => (ls.length ? ls.join("\n") + "\n" : "");
const ok = (out: string): ToolResult => ({ out });
const fail = (err: string, code = 1): ToolResult => ({ out: "", err, code });
const long = (id: string) => (id + sha256Hex(id)).slice(0, 64);
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function table(head: string[], rows: string[][]): string[] {
  const all = [head, ...rows];
  const w = head.map((_, i) => Math.max(...all.map((r) => (r[i] ?? "").length)));
  return all.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(w[i] + 3))).join("").trimEnd());
}

// ── Go templates for --format ───────────────────────────────────────────────
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
function goValue(v: unknown): string {
  if (v === undefined) return "<no value>";
  if (v === null) return "<nil>";
  if (Array.isArray(v)) return `[${v.map(goValue).join(" ")}]`;
  if (isObj(v)) return `map[${Object.keys(v).sort().map((k) => `${k}:${goValue(v[k])}`).join(" ")}]`;
  return String(v);
}
function field(path: string, ctx: unknown): unknown {
  if (path === ".") return ctx;
  let cur = ctx;
  for (const k of path.replace(/^\./, "").split(".")) cur = isObj(cur) ? cur[k] : undefined;
  return cur;
}

export function goTemplate(tpl: string, root: unknown): string {
  const toks = tpl.match(/\{\{.*?\}\}|[^{]+|\{/g) ?? [];
  const run = (from: number, ctx: unknown): [string, number] => {
    let out = "";
    let k = from;
    while (k < toks.length) {
      const t = toks[k];
      if (!t.startsWith("{{")) { out += t.replace(/\\n/g, "\n").replace(/\\t/g, "\t"); k++; continue; }
      const inner = t.slice(2, -2).trim();
      if (inner === "end") return [out, k];
      let m: RegExpExecArray | null;
      if ((m = /^range\s+(\S+)$/.exec(inner))) {
        const v = field(m[1], ctx);
        const items = Array.isArray(v) ? v : isObj(v) ? Object.values(v) : [];
        let endAt = k + 1;
        for (const item of items.length ? items : [undefined]) { const [s, e] = run(k + 1, item); if (items.length) out += s; endAt = e; }
        k = endAt + 1;
        continue;
      }
      if ((m = /^json\s+(\S+)$/.exec(inner))) out += JSON.stringify(field(m[1], ctx) ?? null);
      else if ((m = /^index\s+(\S+)\s+"([^"]*)"$/.exec(inner))) { const v = field(m[1], ctx); out += goValue(isObj(v) ? v[m[2]] : undefined); }
      else if ((m = /^(?:println\s+)?(\.\S*)$/.exec(inner))) out += goValue(field(m[1], ctx)) + (inner.startsWith("println") ? "\n" : "");
      else if ((m = /^"(.*)"$/.exec(inner))) out += m[1].replace(/\\n/g, "\n");
      else return [`template: :1: function "${inner.split(/\s/)[0]}" not defined`, toks.length];
      k++;
    }
    return [out, k];
  };
  return run(0, root)[0];
}

const WRITES: Record<string, string> = {
  build: "builds an image from a Dockerfile — every instruction becomes a layer anyone with the image can read",
  run: "starts a new container from an image",
  exec: "runs a command inside a running container",
  push: "uploads an image to a registry",
  pull: "downloads an image from a registry",
  rm: "deletes a container",
  rmi: "deletes an image",
  stop: "stops a running container",
  start: "starts a stopped container",
  restart: "restarts a container",
  kill: "stops a container immediately",
  tag: "gives an image another name or version tag",
  commit: "saves a container's changes as a new image",
  login: "signs in to a registry",
  compose: "starts or stops the services described in a compose file",
  cp: "copies files between a container and the host",
  save: "exports an image as a tar file",
  load: "imports an image from a tar file",
  prune: "deletes unused objects",
  system: "manages Docker itself (system prune deletes unused data)",
};

const USAGE = text([
  "docker (practice host, read-only)",
  "",
  "  images | image ls             images on this machine, with tags and sizes",
  "  ps [-a]                       running containers (-a includes stopped ones)",
  "  history [--no-trunc] <image>  the layers an image was built from — and the commands that made them",
  "  inspect <image|container>     full settings as JSON; --format '{{.Config.User}}' picks one field",
  "  logs [--tail N] <container>   a container's output",
]);

export function dockerTool(host: DockerHost): Tool {
  const image = (ref: string) => {
    const r = ref.replace(/^sha256:/, "");
    const [repo, tag] = r.includes(":") && !/^[0-9a-f]+$/.test(r) ? [r.slice(0, r.lastIndexOf(":")), r.slice(r.lastIndexOf(":") + 1)] : [r, "latest"];
    return host.images.find((i) => (i.repo === repo && i.tag === tag) || (r.length >= 4 && /^[0-9a-f]+$/.test(r) && long(i.id).startsWith(r)));
  };
  const container = (ref: string) => host.containers.find((c) => c.name === ref || (ref.length >= 4 && long(c.id).startsWith(ref)));
  const up = (c: DockerContainer) => c.status.startsWith("Up");

  const imageJson = (i: DockerImage) => ({
    Id: "sha256:" + long(i.id),
    RepoTags: i.tag === "<none>" ? [] : [`${i.repo}:${i.tag}`],
    Created: i.created,
    Config: {
      User: i.user ?? "",
      ExposedPorts: i.ports?.length ? Object.fromEntries(i.ports.map((p) => [p, {}])) : null,
      Env: i.env ?? ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"],
      Cmd: i.cmd ?? null,
      Entrypoint: i.entrypoint ?? null,
      WorkingDir: i.workdir ?? "",
      Labels: i.labels ?? null,
    },
    Architecture: "amd64",
    Os: "linux",
    RootFS: { Type: "layers", Layers: i.layers.filter((l) => l.size !== "0B").map((l, k) => "sha256:" + long(i.id + k)) },
  });
  const containerJson = (c: DockerContainer) => {
    const img = image(c.image);
    const exit = /Exited \((\d+)\)/.exec(c.status);
    const portBindings = Object.fromEntries((c.ports ?? []).map((p) => { const m = /^(?:([\d.]+):)?(\d+)->(\d+\/\w+)$/.exec(p)!; return [m[3], [{ HostIp: m[1] ?? "", HostPort: m[2] }]]; }));
    return {
      Id: long(c.id),
      Name: "/" + c.name,
      Created: img?.created ?? "2026-10-24T06:00:00Z",
      Path: c.command.split(" ")[0],
      Args: c.command.split(" ").slice(1),
      State: { Status: up(c) ? "running" : "exited", Running: up(c), ExitCode: exit ? +exit[1] : 0, OOMKilled: exit?.[1] === "137" },
      Image: img ? "sha256:" + long(img.id) : "",
      HostConfig: {
        Binds: c.binds ?? null,
        NetworkMode: c.network ?? "bridge",
        PortBindings: portBindings,
        RestartPolicy: { Name: c.restart ?? "no" },
        Privileged: !!c.privileged,
        PidMode: c.pid ?? "",
        CapAdd: c.capAdd ?? null,
        ReadonlyRootfs: !!c.readOnly,
      },
      Mounts: (c.binds ?? []).map((b) => { const [src, dst, mode] = b.split(":"); return { Type: "bind", Source: src, Destination: dst, RW: mode !== "ro" }; }),
      Config: { User: c.user ?? img?.user ?? "", Env: c.env ?? img?.env ?? [], Image: c.image, Cmd: c.command.split(" ") },
      NetworkSettings: { Ports: portBindings },
    };
  };

  const commands: Record<string, (args: string[]) => ToolResult> = {
    images(args) {
      const quiet = args.includes("-q");
      const ref = args.find((a) => !a.startsWith("-"));
      let imgs = host.images;
      if (ref) imgs = imgs.filter((i) => i.repo === ref.split(":")[0] && (!ref.includes(":") || i.tag === ref.split(":")[1]));
      if (quiet) return ok(text(imgs.map((i) => i.id)));
      return ok(text(table(["REPOSITORY", "TAG", "IMAGE ID", "CREATED", "SIZE"], imgs.map((i) => [i.repo, i.tag, i.id, i.age, i.size]))));
    },
    ps(args) {
      const all = args.includes("-a") || args.includes("--all");
      const cs = host.containers.filter((c) => all || up(c));
      if (args.includes("-q")) return ok(text(cs.map((c) => c.id)));
      const full = args.includes("--no-trunc");
      const fmt = args.find((a) => a.startsWith("--format="))?.slice(9) ?? (args.includes("--format") ? args[args.indexOf("--format") + 1] : undefined);
      if (fmt) return ok(text(cs.map((c) => goTemplate(fmt, { ID: c.id, Names: c.name, Image: c.image, Command: `"${c.command}"`, Status: c.status, Ports: (c.ports ?? []).join(", "), RunningFor: c.age.replace(/ ago$/, "") }))));
      return ok(text(table(["CONTAINER ID", "IMAGE", "COMMAND", "CREATED", "STATUS", "PORTS", "NAMES"], cs.map((c) => [full ? long(c.id) : c.id, c.image, `"${full ? c.command : trunc(c.command, 20)}"`, c.age, c.status, (c.ports ?? []).join(", "), c.name]))));
    },
    history(args) {
      const ref = args.find((a) => !a.startsWith("-"));
      if (!ref) return fail('"docker history" requires exactly 1 argument.\nUsage:  docker history [OPTIONS] IMAGE');
      const i = image(ref);
      if (!i) return fail(`Error response from daemon: No such image: ${ref}`);
      const full = args.includes("--no-trunc");
      const rows = [...i.layers].reverse().map((l, k) => [k === 0 ? i.id : "<missing>", l.age, full ? l.by : trunc(l.by, 45), l.size, l.comment ?? ""]);
      return ok(text(table(["IMAGE", "CREATED", "CREATED BY", "SIZE", "COMMENT"], rows)));
    },
    inspect(args) {
      const fi = args.findIndex((a) => a === "-f" || a === "--format");
      const fmt = fi >= 0 ? args[fi + 1] : args.find((a) => a.startsWith("--format="))?.slice(9);
      const type = args.find((a) => a.startsWith("--type="))?.slice(7);
      const refs = args.filter((a, k) => k !== (fi >= 0 ? fi + 1 : -1) && !a.startsWith("-"));
      if (!refs.length) return fail('"docker inspect" requires at least 1 argument.\nUsage:  docker inspect [OPTIONS] NAME|ID [NAME|ID...]');
      const objs: unknown[] = [];
      for (const r of refs) {
        const c = type === "image" ? undefined : container(r);
        const i = type === "container" ? undefined : image(r);
        if (c) objs.push(containerJson(c)); else if (i) objs.push(imageJson(i));
        else return { out: objs.length && !fmt ? JSON.stringify(objs, null, 4) + "\n" : "", err: `Error: No such object: ${r}\n`, code: 1 };
      }
      if (fmt) return ok(text(objs.map((o) => goTemplate(fmt, o))));
      return ok(JSON.stringify(objs, null, 4) + "\n");
    },
    logs(args) {
      const ti = args.findIndex((a) => a === "--tail" || a === "-n");
      const tail = ti >= 0 ? +args[ti + 1] : +(args.find((a) => a.startsWith("--tail="))?.slice(7) ?? NaN);
      const ref = args.find((a, k) => k !== (ti >= 0 ? ti + 1 : -1) && !a.startsWith("-"));
      const c = ref ? container(ref) : undefined;
      if (!c) return fail(`Error response from daemon: No such container: ${ref ?? ""}`);
      let ls = (c.logs ?? "").replace(/\n$/, "").split("\n").filter((l, k, a) => l || k < a.length - 1);
      if (!Number.isNaN(tail)) ls = ls.slice(Math.max(0, ls.length - tail));
      return ok(text(ls));
    },
    version: () => ok("Client:\n Version:           27.3.1\n API version:       1.47\n\nServer: Docker Engine - Community\n Engine:\n  Version:          27.3.1\n"),
  };

  return {
    about: "list images and containers, read how an image was built (history) and how a container was started (inspect)",
    run(argv) {
      const [cmd, ...args] = argv;
      if (!cmd || cmd === "help" || cmd === "--help") return ok(USAGE);
      // docker image ls / image inspect / image history / container ls / container inspect
      if (cmd === "image" || cmd === "container") {
        const [sub, ...rest] = args;
        const map: Record<string, string> = cmd === "image" ? { ls: "images", list: "images", inspect: "inspect", history: "history" } : { ls: "ps", list: "ps", inspect: "inspect", logs: "logs" };
        if (sub && map[sub]) return commands[map[sub]](sub === "inspect" ? [`--type=${cmd}`, ...rest] : rest);
        if (sub && WRITES[sub]) return fail(`docker ${cmd} ${sub}: this practice host is read-only.\nIn real Docker, it ${WRITES[sub]}.`);
        return fail(`docker ${cmd}: try docker ${cmd} ls or docker ${cmd} inspect <name>`);
      }
      if (commands[cmd]) return commands[cmd](args);
      if (WRITES[cmd]) return fail(`docker ${cmd}: this practice host is read-only.\nIn real Docker, docker ${cmd} ${WRITES[cmd]}.`);
      return fail(`docker: '${cmd}' is not a docker command in this lab.\nSee 'docker help'.`);
    },
  };
}
