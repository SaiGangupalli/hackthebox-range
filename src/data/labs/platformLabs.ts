// Extra DevOps & DevSecOps labs built on the full tool simulators in
// src/lib/sim (git, kubectl, docker, cvss) rather than canned output: the
// repository, cluster and image are real data you explore with real commands.
// All defensive — trace a leaked key, audit a cluster, read what's inside an
// image, and triage SAST / SCA / DAST findings and score them with CVSS.

import type { ShellSpec } from "@/lib/sim/shell";
import { gitTool, worktree, type GitRepo } from "@/lib/sim/git";
import { kubectlTool, type KubeCluster } from "@/lib/sim/kube";
import { dockerTool, type DockerHost } from "@/lib/sim/docker";
import { cvssTool } from "@/lib/sim/cvss";
import type { ShellLab } from "./shellLabs";

const eq = (want: string) => (a: string) => a.trim().toLowerCase() === want.toLowerCase();
const has = (want: string) => (a: string) => a.trim().toLowerCase().includes(want.toLowerCase());
const re = (r: RegExp) => (a: string) => r.test(a.trim());
const num = (want: number) => (a: string) => parseInt(a.trim().replace(/[^\d-]/g, ""), 10) === want;
const yes = re(/^y(es)?$|^true$/i);
const no = re(/^n(o)?$|^false$|^none$/i);
const text = (lines: string[]) => lines.join("\n") + "\n";

// ── Git: trace a leaked key through history ─────────────────────────────────
// The official AWS documentation example key (not a real credential).
const KEY = "AKIAIOSFODNN7EXAMPLE";
const SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
const REPO = "/home/dev/shop-api";

const shopRepo: GitRepo = {
  root: REPO,
  head: "main",
  commits: [
    {
      id: "e4410bd", author: "Sam Lee <sam@shop.example>", date: "2026-09-28T10:12:00+05:30",
      message: "Initialise shop-api",
      files: {
        "README.md": text(["# shop-api", "Node service for the shop.", "Config lives in config/prod.env (do not commit secrets here)."]),
        ".gitignore": text(["node_modules/", "*.log"]),
        "config/prod.env": text(["PORT=8080", "LOG_LEVEL=info"]),
        "app.js": text(["const cfg = require('./config');", "console.log('shop-api on', cfg.port);"]),
      },
    },
    {
      id: "1a2b3c4", author: "Sam Lee <sam@shop.example>", date: "2026-10-01T14:02:00+05:30",
      message: "Add S3 upload for invoices\n\nUploads go to the invoices bucket.",
      files: {
        "s3.js": text(["const AWS_ACCESS_KEY_ID = \"" + KEY + "\";", "const AWS_SECRET_ACCESS_KEY = \"" + SECRET + "\";", "module.exports = { upload() { /* ... */ } };"]),
        "config/prod.env": text(["PORT=8080", "LOG_LEVEL=info", "AWS_ACCESS_KEY_ID=" + KEY, "AWS_SECRET_ACCESS_KEY=" + SECRET]),
      },
    },
    {
      id: "5d6e7f8", author: "Priya Shah <priya@shop.example>", date: "2026-10-03T11:20:00+05:30",
      message: "Add order export endpoint",
      files: { "export.js": text(["module.exports = function exportOrders() { /* ... */ };"]) },
    },
    {
      id: "9a0b1c2", author: "Sam Lee <sam@shop.example>", date: "2026-10-06T09:40:00+05:30",
      message: "Move AWS credentials out of the repo",
      files: {
        "s3.js": text(["// credentials now come from the environment", "module.exports = { upload() { /* ... */ } };"]),
        "config/prod.env": text(["PORT=8080", "LOG_LEVEL=info", "# AWS credentials are injected at deploy time"]),
      },
    },
    {
      id: "c3d4e5f", author: "Ravi Kumar <ravi@shop.example>", date: "2026-10-08T16:05:00+05:30",
      message: "Bump express to 4.21.2",
      files: { "package.json": text(["{ \"name\": \"shop-api\", \"dependencies\": { \"express\": \"4.21.2\" } }"]) },
    },
    {
      id: "b7c8d9e", parents: ["9a0b1c2"], author: "Priya Shah <priya@shop.example>", date: "2026-10-07T12:00:00+05:30",
      message: "WIP: webhooks",
      files: { "webhooks.js": text(["// work in progress"]) },
    },
  ],
  branches: { main: "c3d4e5f", "feature/webhooks": "b7c8d9e" },
  tags: { "v1.0.0": "e4410bd", "v1.2.0": "5d6e7f8" },
  remote: { name: "origin", url: "git@github.com:shop/shop-api.git", branches: { main: "9a0b1c2" } },
};

const gitSpec: ShellSpec = {
  user: "dev", host: "workstation", home: "/home/dev", cwd: REPO, groups: ["dev"],
  suggest: ["git log --oneline", "git log -S " + KEY + " --oneline", "git show 1a2b3c4", "git show 1a2b3c4:config/prod.env", "git tag --contains 1a2b3c4", "git blame s3.js"],
  motd: "A clone of shop-api. A security scanner says an AWS key was committed once. Use git history to find where it came in, whether it's still reachable, and what shipped with it. git is real here — try git help.",
  files: worktree(shopRepo),
  tools: { git: gitTool(shopRepo) },
};

// ── Kubernetes: audit a cluster's security posture ──────────────────────────
const shopCluster: KubeCluster = {
  context: "shop-prod", user: "kubernetes-admin", namespace: "shop",
  namespaces: [{ name: "shop", age: "40d" }, { name: "kube-system", age: "60d" }, { name: "default", age: "60d" }],
  nodes: [
    { name: "node-1", age: "60d", version: "v1.31.1", ip: "10.0.1.11", cpu: "2", memory: "4Gi" },
    { name: "node-2", age: "60d", version: "v1.31.1", ip: "10.0.1.12", cpu: "2", memory: "4Gi" },
  ],
  pods: [
    { name: "shop-api-7d9c5b-4kq8n", labels: { app: "shop-api" }, owner: "shop-api", node: "node-1", ip: "10.1.1.21", status: "Running", age: "2d",
      serviceAccount: "shop-api",
      containers: [{ name: "shop-api", image: "registry.example.com/shop-api:1.5.0", ports: [8080], secretEnv: { DB_PASSWORD: ["shop-db", "password"] }, securityContext: { privileged: true, runAsUser: 0, allowPrivilegeEscalation: true }, requests: { cpu: "100m", memory: "128Mi" }, limits: { cpu: "500m", memory: "256Mi" } }],
      usage: { cpu: "12m", memory: "140Mi" } },
    { name: "shop-api-7d9c5b-9wz2m", labels: { app: "shop-api" }, owner: "shop-api", node: "node-2", ip: "10.1.2.22", status: "Running", age: "2d",
      serviceAccount: "shop-api",
      containers: [{ name: "shop-api", image: "registry.example.com/shop-api:1.5.0", ports: [8080], secretEnv: { DB_PASSWORD: ["shop-db", "password"] }, securityContext: { privileged: true, runAsUser: 0, allowPrivilegeEscalation: true }, requests: { cpu: "100m", memory: "128Mi" }, limits: { cpu: "500m", memory: "256Mi" } }],
      usage: { cpu: "9m", memory: "138Mi" } },
    { name: "shop-cache-5f7b-qx2lp", labels: { app: "shop-cache" }, owner: "shop-cache", node: "node-1", status: "CrashLoopBackOff", ready: false, restarts: 7, lastRestart: "41s ago", age: "11m",
      serviceAccount: "default",
      containers: [{ name: "cache", image: "registry.example.com/shop-cache:2.1.0", ports: [6379], requests: { cpu: "50m", memory: "64Mi" } }],
      state: { state: "Waiting", reason: "CrashLoopBackOff" },
      lastState: { state: "Terminated", reason: "Error", exitCode: 1, message: "config error" },
      previousLogs: text(["> shop-cache@2.1.0 start", "> node cache.js", "", "Error: required setting REDIS_URL is not set", "    at loadConfig (/app/config.js:12:11)", "Process exited with code 1"]),
      events: [["Normal", "Pulled", "11m", "kubelet", "Successfully pulled image \"registry.example.com/shop-cache:2.1.0\""], ["Warning", "BackOff", "41s (x25 over 11m)", "kubelet", "Back-off restarting failed container cache"]],
      usage: { cpu: "0m", memory: "0Mi" } },
    { name: "payments-6c8d-mn3rt", namespace: "shop", labels: { app: "payments" }, owner: "payments", node: "node-2", ip: "10.1.2.30", status: "Running", age: "5d",
      serviceAccount: "payments",
      containers: [{ name: "payments", image: "registry.example.com/payments:3.2.0", ports: [9090], securityContext: { runAsNonRoot: true, runAsUser: 10001, readOnlyRootFilesystem: true, allowPrivilegeEscalation: false }, requests: { cpu: "100m", memory: "128Mi" }, limits: { cpu: "500m", memory: "256Mi" } }],
      usage: { cpu: "7m", memory: "120Mi" } },
  ],
  deployments: [
    { name: "shop-api", selector: { app: "shop-api" }, replicas: 2, age: "40d", serviceAccount: "shop-api",
      containers: [{ name: "shop-api", image: "registry.example.com/shop-api:1.5.0", ports: [8080], securityContext: { privileged: true, runAsUser: 0 } }],
      revisions: [{ revision: 1, hash: "d6f9c4", image: "registry.example.com/shop-api:1.4.2", cause: "initial" }, { revision: 2, hash: "7d9c5b", image: "registry.example.com/shop-api:1.5.0", cause: "kubectl set image deployment/shop-api shop-api=shop-api:1.5.0" }] },
    { name: "shop-cache", selector: { app: "shop-cache" }, replicas: 1, age: "20d",
      containers: [{ name: "cache", image: "registry.example.com/shop-cache:2.1.0", ports: [6379] }],
      revisions: [{ revision: 1, hash: "5f7b2a", image: "registry.example.com/shop-cache:2.1.0", cause: "initial" }] },
    { name: "payments", selector: { app: "payments" }, replicas: 1, age: "30d", serviceAccount: "payments",
      containers: [{ name: "payments", image: "registry.example.com/payments:3.2.0", ports: [9090] }],
      revisions: [{ revision: 1, hash: "6c8d1e", image: "registry.example.com/payments:3.2.0", cause: "initial" }] },
  ],
  services: [
    { name: "shop-api", clusterIP: "10.96.10.10", type: "LoadBalancer", externalIP: "203.0.113.50", ports: [{ port: 80, targetPort: 8080 }], selector: { app: "shop-api" }, age: "40d" },
    { name: "shop-db", clusterIP: "10.96.10.20", ports: [{ port: 5432, targetPort: 5432 }], selector: { app: "shop-db" }, age: "40d" },
  ],
  secrets: [
    { name: "shop-db", type: "Opaque", data: { password: "pr0d-db-pa55!" }, age: "40d" },
    { name: "shop-api-tls", type: "kubernetes.io/tls", data: { "tls.crt": "-----BEGIN CERTIFICATE-----", "tls.key": "-----BEGIN PRIVATE KEY-----" }, age: "40d" },
  ],
  serviceAccounts: [{ name: "shop-api", age: "40d" }, { name: "payments", age: "40d" }, { name: "default", age: "40d" }],
  networkPolicies: [{ name: "payments-isolation", podSelector: { app: "payments" }, policyTypes: ["Ingress"], from: ["app=shop-api"], age: "30d" }],
  rbac: [
    { who: "system:serviceaccount:shop:shop-api", namespace: "*", verbs: ["get", "list"], resources: ["secrets"], binding: "ClusterRoleBinding/shop-api-secrets-reader" },
    { who: "system:serviceaccount:shop:payments", namespace: "shop", verbs: ["get"], resources: ["configmaps"], binding: "RoleBinding/payments-config" },
  ],
};

const kubeSpec: ShellSpec = {
  user: "ops", host: "bastion", home: "/home/ops", groups: ["ops"],
  suggest: ["kubectl get pods", "kubectl logs shop-cache-5f7b-qx2lp --previous", "kubectl get pod shop-api-7d9c5b-4kq8n -o yaml", "kubectl describe pod shop-api-7d9c5b-4kq8n", "kubectl auth can-i get secrets --as=system:serviceaccount:shop:shop-api -A", "kubectl get netpol"],
  motd: "Read-only audit of the shop-prod cluster (namespace shop). Find the unhealthy pod and why, the pod running with too much power, how the database password reaches a pod, and whether access is properly limited. kubectl is real here — try kubectl help.",
  files: { "/home/ops/README": text(["Security audit of namespace 'shop'.", "", "Start with: kubectl get pods", "Dig in with: kubectl describe pod <name>, kubectl logs <name> [--previous], kubectl get <kind> <name> -o yaml", "Check access with: kubectl auth can-i <verb> <resource> --as=<user> [-A]"]) },
  tools: { kubectl: kubectlTool(shopCluster) },
};

// ── Docker: what's inside the image ─────────────────────────────────────────
const dockerHost: DockerHost = {
  images: [
    { repo: "registry.example.com/shop-api", tag: "latest", id: "3f2a91c0d4e1", age: "2 hours ago", created: "2026-10-24T07:10:00Z", size: "1.14GB", user: "", ports: ["8080/tcp"], env: ["PATH=/usr/local/bin:/usr/bin", "NODE_ENV=production", "NPM_TOKEN=npm_FAKEEXAMPLETOKEN00000000000000000000"], cmd: ["node", "server.js"], workdir: "/app",
      layers: [
        { by: "/bin/sh -c #(nop) FROM node:20", size: "1.09GB", age: "3 weeks ago" },
        { by: "/bin/sh -c #(nop) WORKDIR /app", size: "0B", age: "2 hours ago" },
        { by: "/bin/sh -c #(nop) ENV NPM_TOKEN=npm_FAKEEXAMPLETOKEN00000000000000000000", size: "0B", age: "2 hours ago" },
        { by: "/bin/sh -c #(nop) COPY . /app", size: "41MB", age: "2 hours ago" },
        { by: "/bin/sh -c npm ci --omit=dev", size: "9MB", age: "2 hours ago" },
        { by: "/bin/sh -c #(nop) EXPOSE 8080", size: "0B", age: "2 hours ago" },
        { by: "/bin/sh -c #(nop) CMD [\"node\" \"server.js\"]", size: "0B", age: "2 hours ago" },
      ] },
    { repo: "registry.example.com/shop-api", tag: "<none>", id: "8be1d77a02f3", age: "2 days ago", created: "2026-10-22T09:00:00Z", size: "1.13GB", user: "", cmd: ["node", "server.js"], layers: [{ by: "/bin/sh -c #(nop) FROM node:20", size: "1.09GB", age: "3 weeks ago" }, { by: "/bin/sh -c #(nop) CMD [\"node\" \"server.js\"]", size: "0B", age: "2 days ago" }] },
    { repo: "registry.example.com/payments", tag: "3.2.0", id: "b2c3d4e5f607", age: "5 days ago", created: "2026-10-19T09:00:00Z", size: "128MB", user: "10001", ports: ["9090/tcp"], cmd: ["/payments"], layers: [{ by: "/bin/sh -c #(nop) FROM gcr.io/distroless/base", size: "20MB", age: "5 days ago" }, { by: "/bin/sh -c #(nop) USER 10001", size: "0B", age: "5 days ago" }, { by: "/bin/sh -c #(nop) COPY payments /payments", size: "108MB", age: "5 days ago" }] },
    { repo: "node", tag: "20", id: "b4f0e0bdeb57", age: "3 weeks ago", created: "2026-10-01T00:00:00Z", size: "1.09GB", user: "", layers: [{ by: "/bin/sh -c #(nop) ADD file:... in /", size: "1.09GB", age: "3 weeks ago" }] },
  ],
  containers: [
    { id: "a1b2c3d4e5f6", name: "shop-api", image: "registry.example.com/shop-api:latest", command: "node server.js", age: "2 hours ago", status: "Up 2 hours", ports: ["0.0.0.0:8080->8080/tcp"], binds: ["/var/run/docker.sock:/var/run/docker.sock"], logs: text(["shop-api listening on :8080", "GET /health 200 2ms"]) },
    { id: "f6e5d4c3b2a1", name: "payments", image: "registry.example.com/payments:3.2.0", command: "/payments", age: "5 days ago", status: "Up 5 days", ports: ["9090/tcp"], readOnly: true, user: "10001" },
    { id: "0099aabbccdd", name: "old-shop-api", image: "registry.example.com/shop-api", command: "node server.js", age: "2 days ago", status: "Exited (137) 2 days ago" },
  ],
};

const dockerSpec: ShellSpec = {
  user: "dev", host: "build01", home: "/home/dev", groups: ["dev"],
  suggest: ["docker images", "docker history --no-trunc registry.example.com/shop-api:latest", "docker inspect --format '{{.Config.User}}' registry.example.com/shop-api:latest", "docker inspect --format '{{json .Mounts}}' shop-api", "docker ps -a", "docker inspect shop-api"],
  motd: "Review the shop-api image before it ships. Images on this host are real: read how each was built (docker history) and how the running container was started (docker inspect). docker is read-only here — try docker help.",
  files: { "/home/dev/README": text(["Pre-release review of registry.example.com/shop-api:latest.", "", "docker images                list images and sizes", "docker history <image>       the build steps, each a layer (--no-trunc for the full command)", "docker inspect <image|name>  full settings; --format '{{.Config.User}}' or '{{json .Mounts}}' picks a field"]) },
  tools: { docker: dockerTool(dockerHost) },
};

// ── DevSecOps: triage SAST, SCA and DAST findings and score them ────────────
const SCAN = "/home/dev/orders-api";
const semgrepOut = text([
  "┌──── Code Findings ────┐", "",
  "    src/orders.js",
  "       rules.sql-injection",
  "          Detected user input flowing into a raw SQL query. Use a parameterised query.",
  "          42┆ db.query(\"SELECT * FROM orders WHERE id = \" + req.query.id)",
  "",
  "    src/auth.js",
  "       rules.jwt-none-alg",
  "          JWT verified without checking the algorithm; attackers can forge tokens.",
  "          18┆ jwt.verify(token, key, { algorithms: undefined })",
  "",
  "Ran heaps of rules. 2 findings (0 blocking).",
]);
const trivyScan = text([
  "orders-api/package-lock.json (npm)", "",
  "Total: 3 (LOW: 0, MEDIUM: 1, HIGH: 1, CRITICAL: 1)", "",
  "┌──────────┬────────────────┬──────────┬────────┬───────────────────┬───────────────┬──────────────────────────────────┐",
  "│ Library  │ Vulnerability  │ Severity │ Status │ Installed Version │ Fixed Version │ Title                              │",
  "├──────────┼────────────────┼──────────┼────────┼───────────────────┼───────────────┼──────────────────────────────────┤",
  "│ minimist │ CVE-2021-44906 │ CRITICAL │ fixed  │ 1.2.5             │ 1.2.6         │ prototype pollution                │",
  "│ lodash   │ CVE-2021-23337 │ HIGH     │ fixed  │ 4.17.20           │ 4.17.21       │ command injection via template    │",
  "│ debug    │ CVE-2017-16137 │ MEDIUM   │ fixed  │ 2.6.8             │ 2.6.9         │ regular-expression DoS             │",
  "└──────────┴────────────────┴──────────┴────────┴───────────────────┴───────────────┴──────────────────────────────────┘",
  "",
  "minimist is pulled in by mkdirp (a transitive dependency).",
]);
const grypeOut = text([
  "NAME      INSTALLED  FIXED-IN  TYPE  VULNERABILITY   SEVERITY",
  "minimist  1.2.5      1.2.6     npm   CVE-2021-44906  Critical",
  "lodash    4.17.20    4.17.21   npm   CVE-2021-23337  High",
  "debug     2.6.8      2.6.9     npm   CVE-2017-16137  Medium",
]);
const zapOut = text([
  "ZAP baseline scan of http://orders-api.internal:8080", "",
  "WARN-NEW: X-Content-Type-Options header missing [10021]",
  "FAIL-NEW: SQL Injection [40018]",
  "          GET http://orders-api.internal:8080/api/orders?id=1",
  "          The parameter 'id' appears vulnerable: 1' OR '1'='1 returned extra rows.",
  "",
  "FAIL-NEW: 1   WARN-NEW: 1   PASS: 48",
]);
const snykOut = text([
  "Testing orders-api...", "",
  "✗ High severity vulnerability found in lodash",
  "  Introduced through: orders-api@1.0.0 > lodash@4.17.20",
  "  Fix: Upgrade lodash to 4.17.21",
  "✗ Critical severity vulnerability found in minimist",
  "  Introduced through: orders-api@1.0.0 > mkdirp@0.5.5 > minimist@1.2.5",
  "  Fix: Upgrade mkdirp so it pulls minimist@1.2.6",
  "",
  "Tested 214 dependencies for known issues, found 3 issues.",
]);
const sonarOut = text([
  "INFO: Analysis total time: 14.201 s",
  "INFO: QUALITY GATE STATUS: FAILED - View details on https://sonarqube.internal/dashboard?id=orders-api",
  "INFO: Quality gate failed:",
  "INFO:   - Security Rating worse than A (found E)",
  "INFO:   - 2 new vulnerabilities (0 allowed)",
  "INFO:   - 61.2% coverage on new code (80% required)",
]);

const scanSpec: ShellSpec = {
  user: "dev", host: "ci-runner", home: "/home/dev", cwd: SCAN, groups: ["dev"],
  suggest: ["cat README", "trivy fs .", "semgrep --config auto src/", "cat dast-report.txt", "cvss CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", "grype dir:."],
  motd: "Security gate for orders-api before release. SAST (semgrep), SCA (trivy / grype / snyk), the SonarQube quality gate and a DAST (ZAP) report have all run. Read them, decide what blocks the release, and score the worst issue with CVSS.",
  files: {
    [`${SCAN}/README`]: text([
      "orders-api — release security gate.",
      "",
      "Scanners that ran (simulated output):",
      "  trivy fs .           dependency & config scan (SCA) — shows fixed versions",
      "  grype dir:.          another SCA scanner, for comparison",
      "  snyk test            SCA with the dependency path to each issue",
      "  semgrep --config auto src/   static analysis (SAST) of the source",
      "  sonar-scanner        the SonarQube quality gate result",
      "  dast-report.txt      an OWASP ZAP (DAST) scan of the running app",
      "",
      "Tool: cvss <vector>   work out a CVSS v3.1 base score.",
      "",
      "Commercial equivalents you'll meet at work: Black Duck and Snyk (SCA),",
      "Fortify, Checkmarx and SonarQube (SAST), 42Crunch (API security).",
    ]),
    [`${SCAN}/dast-report.txt`]: zapOut,
    [`${SCAN}/package.json`]: text(["{", "  \"name\": \"orders-api\", \"version\": \"1.0.0\",", "  \"dependencies\": { \"express\": \"4.21.2\", \"lodash\": \"4.17.20\", \"mkdirp\": \"0.5.5\", \"debug\": \"2.6.8\" }", "}"]),
  },
  programs: {
    trivy: { fs: trivyScan, ".": trivyScan, image: trivyScan, "*": "trivy (simulated): try trivy fs ." },
    grype: { "dir:.": grypeOut, ".": grypeOut, "*": grypeOut },
    snyk: { test: snykOut, "*": snykOut },
    semgrep: { "*": semgrepOut },
    "sonar-scanner": { "*": sonarOut },
  },
  tools: { cvss: cvssTool },
};

// ── The labs ────────────────────────────────────────────────────────────────
export const gitLab: ShellLab = {
  id: "devops-git",
  title: "Lab · Trace a leaked key through Git history",
  intro:
    "A secret scanner flagged the shop-api repository: an AWS access key was committed once, and a later commit \"removed\" it. Use Git to find which commit introduced it, whether it can still be read from history, and what shipped with it — then decide what has to happen to the key itself. git is real here (log, show, diff, blame, branch, tag, grep).",
  spec: gitSpec,
  tasks: [
    { ask: "How many commits are in this branch's history? (git log --oneline)", placeholder: "a number", hint: "git log --oneline prints one line per commit. Count them (the webhooks commit is on another branch, so it isn't here).", solution: "5 — the main branch has five commits; feature/webhooks isn't merged, so git log doesn't show it.", check: num(5) },
    { ask: "Which commit first added the AWS key? Give the short hash.", placeholder: "a short commit hash", hint: `Let Git find the change for you: git log -S ${KEY} --oneline shows commits where that text was added or removed. The earliest is the one that added it.`, solution: `1a2b3c4 — \"Add S3 upload for invoices\". git show 1a2b3c4 shows the key being added.`, check: has("1a2b3c4") },
    { ask: "Who authored that commit? (first name is enough)", placeholder: "a name", hint: "git show 1a2b3c4 — read the Author line.", solution: "Sam (Sam Lee). git blame s3.js points at the same person.", check: has("sam") },
    { ask: "A later commit deleted the key from the file. Can you still read the key at the old commit? (yes / no)", placeholder: "yes or no", hint: "Ask Git for the file as it was then: git show 1a2b3c4:config/prod.env. Did the value come back?", solution: "Yes — every old commit keeps its files, so the key is still reachable in history. Deleting it later doesn't erase it.", check: yes },
    { ask: "Which release tag shipped with the key still in it? (git tag --contains 1a2b3c4)", placeholder: "a tag", hint: "git tag lists the releases; git tag --contains 1a2b3c4 shows which ones include that commit. v1.0.0 came before it.", solution: "v1.2.0 — it points at a commit after the key was added, so that release contains the key.", check: has("v1.2.0") },
    { ask: "Deleting the line didn't make the key safe. What must be done with the key itself? (one word)", placeholder: "one word", hint: "Anyone who cloned the repo already has it. Treat it as public.", solution: "Rotate (revoke) it — issue a new key, then keep it in a secret manager. Rewriting history with git filter-repo is a cleanup, not a fix.", check: re(/rotat|revok|disabl|deactivat|replace|invalidat/i) },
  ],
};

export const kubeLab: ShellLab = {
  id: "devops-kube",
  title: "Lab · Audit a Kubernetes cluster",
  intro:
    "You've been given read-only access to the shop-prod cluster. Find the pod that won't stay up and why, the workload running with far too much power, how the database password reaches a pod, and whether access is actually restricted. kubectl is real here — get, describe, logs, -o yaml / jsonpath, auth can-i and more.",
  spec: kubeSpec,
  tasks: [
    { ask: "One pod isn't healthy. What is its STATUS? (kubectl get pods)", placeholder: "the status", hint: "kubectl get pods — read the STATUS column.", solution: "CrashLoopBackOff — shop-cache starts, crashes and is restarted over and over.", check: re(/crash\s*loop/i) },
    { ask: "Read that pod's previous logs. Which required setting is missing?", placeholder: "a setting name", hint: "The running container has no logs yet, so read the crashed one: kubectl logs shop-cache-5f7b-qx2lp --previous.", solution: "REDIS_URL — the cache can't start without it. Add it (from a ConfigMap or Secret) and the pod recovers.", check: has("REDIS_URL") },
    { ask: "One workload runs with control of its node. Which securityContext field, set to true, is the danger? (kubectl get pod shop-api-7d9c5b-4kq8n -o yaml)", placeholder: "a field name", hint: "kubectl get pod <name> -o yaml, then look under securityContext — or pipe it to grep -A4 securityContext.", solution: "privileged: true — a privileged container can escape to the node. It also runs as root (runAsUser 0). Set privileged false, runAsNonRoot true.", check: has("privileged") },
    { ask: "The database password reaches shop-api through an environment variable. Which variable? (kubectl describe pod shop-api-7d9c5b-4kq8n)", placeholder: "a variable name", hint: "kubectl describe pod <name> — look under Environment for a value \"set to the key ... in secret\".", solution: "DB_PASSWORD — set from the key 'password' in Secret 'shop-db'. Anyone who can exec into the pod can read it, so limit pods/exec.", check: has("DB_PASSWORD") },
    { ask: "Can the shop-api service account read Secrets in other namespaces? (kubectl auth can-i get secrets --as=system:serviceaccount:shop:shop-api -A)", placeholder: "yes or no", hint: "auth can-i answers yes/no. --as impersonates the service account; -A asks about all namespaces.", solution: "Yes — a ClusterRoleBinding lets it read every Secret in the cluster. That's far more than it needs; scope it to its own namespace.", check: yes },
    { ask: "Is any NetworkPolicy restricting traffic to the database pods (app=shop-db)? (kubectl get netpol)", placeholder: "yes or no", hint: "kubectl get netpol lists NetworkPolicies and the pods each selects. Is shop-db covered?", solution: "No — the only policy isolates payments. Without a policy, any pod can reach shop-db. Add a NetworkPolicy allowing only shop-api.", check: no },
  ],
};

export const dockerLab: ShellLab = {
  id: "devsecops-docker",
  title: "Lab · What's inside the image",
  intro:
    "Before shop-api:latest ships, look inside it. An image is just layers, and anyone who can pull it can read every one. Find the secret baked into a layer, the user it runs as, the port it opens, and a dangerous mount on the running container. docker is read-only here — images, history, inspect, ps, logs.",
  spec: dockerSpec,
  tasks: [
    { ask: "Which tag of shop-api is actually running? (docker ps)", placeholder: "a tag", hint: "docker ps shows running containers and the image:tag each uses.", solution: "latest — a moving tag, so you can't tell which build is live or roll back cleanly. Deploy a pinned version instead.", check: has("latest") },
    { ask: "docker history shows a secret baked into a layer. Which environment variable holds it? (docker history --no-trunc registry.example.com/shop-api:latest)", placeholder: "a variable name", hint: "docker history lists every build step. --no-trunc shows the full command, including an ENV line.", solution: "NPM_TOKEN — set with ENV, so it's in the image for anyone who pulls it. Use a build secret or multi-stage build instead, and never ENV a credential.", check: has("NPM_TOKEN") },
    { ask: "Which user does the image run as? (docker inspect --format '{{.Config.User}}' registry.example.com/shop-api:latest — a blank value means which user?)", placeholder: "a username", hint: "An empty User means Docker's default. Add a USER line to change it.", solution: "root — the image has no USER line. If the app is compromised, the attacker is root in the container. Add a non-root USER.", check: eq("root") },
    { ask: "The shop-api container mounts a sensitive host path. Which path? (docker inspect --format '{{json .Mounts}}' shop-api)", placeholder: "a path", hint: "Read the Source of the mount — or docker inspect shop-api and look under Mounts / HostConfig.Binds.", solution: "/var/run/docker.sock — mounting the Docker socket gives the container full control of the host's Docker, which is effectively root on the host. Remove it.", check: has("docker.sock") },
    { ask: "Which port does the image expose? (docker history or docker inspect)", placeholder: "a number", hint: "Look for the EXPOSE line in docker history, or ExposedPorts in docker inspect.", solution: "8080 — the app's HTTP port, published to 0.0.0.0:8080 on the host.", check: num(8080) },
    { ask: "A secret in an image layer is visible to anyone who can pull the image. What must you do with NPM_TOKEN now? (one word)", placeholder: "one word", hint: "Rebuilding without it isn't enough — the old image still has it, and it may already be copied.", solution: "Rotate (revoke) it, then rebuild the image without ever putting a secret in a layer.", check: re(/rotat|revok|disabl|replace|invalidat/i) },
  ],
};

export const scanLab: ShellLab = {
  id: "devsecops-scan",
  title: "Lab · Triage SAST, SCA and DAST findings",
  intro:
    "The orders-api release gate ran four kinds of scanner: SAST (semgrep) reads the source, SCA (trivy / grype / snyk) checks dependencies, the SonarQube quality gate grades the code, and DAST (ZAP) attacks the running app. Read each one, find the vulnerable dependency and the version that fixes it, locate the code flaw, and score the worst issue with CVSS.",
  spec: scanSpec,
  tasks: [
    { ask: "SCA: which dependency has a CRITICAL vulnerability? (trivy fs .)", placeholder: "a package name", hint: "trivy fs . lists dependencies with a Severity column. grype dir:. and snyk test agree.", solution: "minimist (CVE-2021-44906, prototype pollution). It arrives indirectly, pulled in by mkdirp.", check: eq("minimist") },
    { ask: "Which version fixes it? (the Fixed Version column)", placeholder: "a version number", hint: "Same trivy row — read Fixed Version. grype's FIXED-IN column says the same.", solution: "1.2.6 (or later). Upgrade mkdirp, or add an override, so it resolves minimist 1.2.6.", check: has("1.2.6") },
    { ask: "SAST: semgrep flags a SQL injection. In which source file? (semgrep --config auto src/)", placeholder: "a file name", hint: "semgrep --config auto src/ — read the file path above the sql-injection finding.", solution: "orders.js (src/orders.js:42) — it builds SQL by concatenating req.query.id. Use a parameterised query.", check: has("orders.js") },
    { ask: "DAST: the running-app scan confirms an exploitable issue. On which URL path? (cat dast-report.txt)", placeholder: "a URL path", hint: "cat dast-report.txt — the ZAP FAIL line shows the request it exploited.", solution: "/api/orders — ZAP got extra rows with id=1' OR '1'='1, confirming the SQL injection SAST found is reachable.", check: has("/api/orders") },
    { ask: "Score the SQL injection: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H — what severity? (use the cvss tool)", placeholder: "a severity word", hint: "Run: cvss CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H — read the base score and severity.", solution: "Critical (9.8). Network-reachable, no privileges or interaction, and it compromises confidentiality, integrity and availability.", check: re(/critical|9\.8/i) },
    { ask: "Two issues are both fixable now. Which do you block the release on first — the internet-reachable flaw or an internal-only one?", placeholder: "internet or internal", hint: "Severity and exposure together. The SQL injection is reachable from outside and scored Critical.", solution: "The internet-reachable one — the SQL injection. Fix exposure plus severity first; the dependency CVEs follow close behind.", check: re(/internet|external|facing|orders|sql|critical/i) },
  ],
};

// ── Pentest: read the recon, score it, prioritise the report ────────────────
// Authorized, scoped engagement against a staging target. No exploitation here
// — you read the output of recon tools, score findings with CVSS, and decide
// what goes at the top of the client report.
const PT = "/home/tester/engagement";
const nmapOut = text([
  "Starting Nmap 7.95 ( https://nmap.org )",
  "Nmap scan report for app.acme-staging.example (198.51.100.25)",
  "Host is up (0.011s latency).",
  "",
  "PORT     STATE    SERVICE  VERSION",
  "22/tcp   open     ssh      OpenSSH 8.9p1",
  "80/tcp   open     http     nginx 1.24.0",
  "443/tcp  open     ssl/http nginx 1.24.0",
  "8080/tcp open     http     nginx 1.24.0 (staging admin)",
  "3306/tcp filtered mysql",
  "",
  "Nmap done: 1 IP address (1 host up) scanned in 2.14 seconds",
]);
const ffufOut = text([
  "        /'___\\  /'___\\           /'___\\",
  "       /\\ \\__/ /\\ \\__/  __  __  /\\ \\__/",
  "        \\ \\ \\  \\ \\ \\  /\\ \\/\\ \\ \\ \\ \\",
  "________________________________________________",
  " :: Method           : GET",
  " :: URL              : https://app.acme-staging.example/FUZZ",
  "________________________________________________",
  "admin                   [Status: 200, Size: 4102, Words: 812]",
  "login                   [Status: 200, Size: 1877, Words: 410]",
  "backup.zip              [Status: 200, Size: 904522, Words: 1]",
  ".git                    [Status: 301, Size: 169, Words: 7]",
  "robots.txt              [Status: 200, Size: 61, Words: 3]",
  ":: Progress: [4746/4746] :: Job [1/1] :: 980 req/sec :: Duration: [0:00:05]",
]);
const niktoOut = text([
  "- Nikto v2.5.0",
  "+ Target: https://app.acme-staging.example/",
  "+ Server: nginx/1.24.0",
  "+ /: The X-Frame-Options header is not set, which could allow clickjacking.",
  "+ /: The X-Content-Type-Options header is not set.",
  "+ /.git/: A Git directory was found; source code and history may be downloadable.",
  "+ /backup.zip: Potentially interesting archive found.",
  "+ 7 item(s) reported.",
]);

const pentestSpec: ShellSpec = {
  user: "tester", host: "kali", home: "/home/tester", cwd: PT, groups: ["tester"],
  suggest: ["cat scope.txt", "nmap app.acme-staging.example", "cat ffuf.txt", "nikto -h app.acme-staging.example", "cat findings.md", "cvss CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"],
  motd: "Authorized web pentest of app.acme-staging.example. Everything here is in scope and in writing (scope.txt). Read the recon, score the findings with CVSS, and decide what tops the report. No exploitation — this is reading and prioritising.",
  files: {
    [`${PT}/scope.txt`]: text([
      "RULES OF ENGAGEMENT — Acme staging web app",
      "",
      "In scope:   app.acme-staging.example (198.51.100.25) only",
      "Out of scope: production, any other host, denial-of-service testing",
      "Window:     02:00–06:00 IST, weeknights",
      "Contact:    soc@acme.example (stop testing if asked)",
      "Handling:   findings stay confidential; deliver a written report with CVSS and fixes.",
    ]),
    [`${PT}/ffuf.txt`]: ffufOut,
    [`${PT}/findings.md`]: text([
      "# Findings (to score and rank for the report)",
      "",
      "1. SQL injection in /api/orders?id=  — attacker reads the whole orders table unauthenticated.",
      "   Vector: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      "",
      "2. Reflected XSS in /search?q=  — needs the victim to click a crafted link.",
      "   Vector: CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N  (base 6.1)",
      "",
      "3. Missing X-Frame-Options header  — clickjacking, low impact.",
      "   Vector: CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N  (base 4.3)",
    ]),
  },
  programs: {
    nmap: { "*": nmapOut },
    nikto: { "*": niktoOut },
    ffuf: { "*": ffufOut },
  },
  tools: { cvss: cvssTool },
};

export const pentestLab: ShellLab = {
  id: "webmobile-pentest",
  title: "Lab · Authorized pentest: recon to report",
  intro:
    "You're on an authorized, scoped web pentest of a staging site. The engagement's rules are in scope.txt — stay inside them. Read the reconnaissance (nmap, ffuf, nikto), confirm what's exposed, then score the findings in findings.md with CVSS and decide what goes at the top of the report. Nothing is exploited here; the skill is reading, scoring and prioritising.",
  spec: pentestSpec,
  tasks: [
    { ask: "Recon: besides web ports, nmap shows a remote-admin service open. Which port? (nmap app.acme-staging.example)", placeholder: "a number", hint: "nmap lists open ports and services. Which one is for remote shell access?", solution: "22 (SSH). It's in scope, but note it — weak SSH auth would be a finding of its own.", check: num(22) },
    { ask: "Content discovery exposed the source-control folder. Which path? (cat ffuf.txt)", placeholder: "a path", hint: "Read ffuf.txt (or run ffuf). A 301 on a dot-folder is the giveaway; nikto flags it too.", solution: "/.git — a downloadable .git directory leaks source code and history. Block it at the web server and remove it from the deploy.", check: has(".git") },
    { ask: "Score finding 1 (the SQL injection). What CVSS severity? (cvss with its vector from findings.md)", placeholder: "a severity word", hint: "cat findings.md for the vector, then run cvss on it and read the severity.", solution: "Critical (9.8) — unauthenticated, network-reachable, full impact. This is the headline finding.", check: re(/critical|9\.8/i) },
    { ask: "Finding 2 (reflected XSS) scores 6.1. Which severity band is that? (bands: Low <4, Medium 4–6.9, High 7–8.9, Critical 9+)", placeholder: "a severity word", hint: "6.1 falls between 4.0 and 6.9. You can confirm with cvss on its vector.", solution: "Medium — 6.1 is in the 4.0–6.9 band. Real but lower than the injection, and it needs the victim to click.", check: re(/medium/i) },
    { ask: "Your report lists findings worst-first. Which finding number goes at the top?", placeholder: "a number", hint: "Rank by CVSS: 9.8 vs 6.1 vs 4.3.", solution: "1 — the SQL injection at 9.8 Critical leads the report, then the XSS (6.1), then the missing header (4.3).", check: num(1) },
    { ask: "What is the document that defines what you may test, when, and what's off-limits? (cat scope.txt — three words)", placeholder: "three words", hint: "It's the agreement that makes the test legal rather than an attack.", solution: "Rules of engagement — scope, window, out-of-scope systems and who to contact. Staying inside it is what separates a pentest from a crime.", check: re(/rules of engagement/i) },
  ],
};

// Extra labs by track, rendered after each track's primary lab.
export const platformLabsByTrack: Record<string, ShellLab[]> = {
  webmobile: [pentestLab],
  devops: [gitLab, kubeLab],
  devsecops: [dockerLab, scanLab],
};
