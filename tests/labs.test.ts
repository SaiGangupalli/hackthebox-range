import { test } from "node:test";
import assert from "node:assert/strict";
import { Shell } from "@/lib/sim/shell";
import { shellLabs } from "@/data/labs/shellLabs";
import { platformLabsByTrack } from "@/data/labs/platformLabs";
import { forensicsLabsByTrack } from "@/data/labs/forensicsLabs";
import { webLabsByTrack } from "@/data/labs/webLabs";
import { labMeta, labById } from "@/data/labs";
import { path } from "@/data/path";

test("every lab has a unique id, objectives with hints and solutions", () => {
  assert.equal(new Set(labMeta.map((l) => l.id)).size, labMeta.length);
  for (const lab of Object.values(shellLabs)) {
    assert.ok(lab.tasks.length >= 3, lab.id);
    for (const t of lab.tasks) assert.ok(t.ask && t.hint && t.solution, `${lab.id}: ${t.ask}`);
  }
  for (const p of path) assert.ok(labById[p.labId], `path step ${p.slug} points at lab ${p.labId}`);
});

// For each objective of the newer labs: commands a learner would run (from the
// hint), the answer that output supports, and a wrong answer that must fail.
const plan: Record<string, [string[], string, string][]> = {
  devops: [
    [["cat .github/workflows/ci.yml"], "test", "deploy"],
    [["grep 'docker build' .github/workflows/ci.yml"], "latest", "1.4.2"],
    [["kubectl get pods"], "CrashLoopBackOff", "Running"],
    [["kubectl logs shop-7d9c5b-qx2lp"], "PAYMENT_API_URL", "DATABASE_URL"],
    [["terraform plan"], "aws_instance.web", "aws_s3_bucket_versioning.assets"],
    [["terraform plan | grep port"], "22", "443"],
  ],
  devsecops: [
    [["gitleaks detect --source ."], "config/aws.js", "package.json"],
    [["git log --oneline", "git show 3b7e9f1"], "3b7e9f1", "a39c0d2"],
    [[], "rotate it", "nothing"],
    [["trivy fs ."], "minimist", "lodash"],
    [["trivy fs . | grep CRITICAL"], "1.2.6", "1.2.5"],
    [["trivy config ."], "root", "app"],
    [["checkov -d ."], "invoices", "logs"],
  ],
  secops: [
    [["cut -d, -f4,5 process.csv | sort | uniq -c | sort -n"], "winword.exe", "outlook.exe"],
    [["grep powershell process.csv | cut -d, -f2"], "FIN-LT-07", "HR-LT-02"],
    [["awk '{print $3}' proxy.log | sort | uniq -c | sort -nr"], "198.51.100.23", "203.0.113.80"],
    [["grep 198.51.100.23 proxy.log | head -n 3"], "60", "30"],
    [["grep -E '[a-f0-9]{30}' dns.log"], "cdn-sync.example.net", "cdn.example.com"],
    [["cat rules/office_spawns_shell.yml"], "T1059.001", "T1566"],
  ],
  aisecops: [
    [["grep -c '\"action\":\"block\"' logs/prompts.jsonl"], "6", "5"],
    [["grep -ril 'ignore previous' rag"], "vendor-faq.md", "shipping.md"],
    [["grep send_email logs/tools.jsonl"], "audit@collect.example.net", "customer-4471@example.org"],
    [["grep -A3 send_email config/guardrails.yaml"], "require_approval", "pii_redaction"],
    [["grep -A2 rag: config/guardrails.yaml"], "strip_html_comments", "max_chunks"],
    [["cd models && sha256sum -c models.sha256"], "classifier-adapter.safetensors", "tokenizer.json"],
  ],
};

for (const [slug, steps] of Object.entries(plan)) {
  test(`${slug} lab: every objective is solvable from its hint`, () => {
    const lab = shellLabs[slug];
    assert.equal(steps.length, lab.tasks.length, "plan covers every objective");
    const sh = new Shell(lab.spec);
    steps.forEach(([cmds, right, wrong], i) => {
      sh.cwd = lab.spec.cwd ?? lab.spec.home;
      const seen = cmds.map((c) => sh.run(c).out).join("");
      if (cmds.length && !/^\d+$/.test(right)) assert.ok(seen.toLowerCase().includes(right.toLowerCase()), `#${i + 1}: "${right}" not visible in output`);
      assert.equal(lab.tasks[i].check(right), true, `#${i + 1} should accept ${right}`);
      assert.equal(lab.tasks[i].check(wrong), false, `#${i + 1} should reject ${wrong}`);
    });
  });
}

// Extra labs on the full tool simulators (git, kubectl, docker, cvss). Each
// step: the commands a learner would run, the accepted answer, a rejected one,
// and whether the answer is one the output literally contains (most are) or a
// judgement the learner makes from it (a yes/no or a derived word).
type Step = { run: string[]; ok: string; no: string; derived?: boolean };
const platform: Record<string, Step[]> = {
  "webmobile-webflags": [
    { run: ["curl -i http://shop.local/"], ok: "HHB{r3sp0ns3_h34d3rs}", no: "HHB{nope}" },
    { run: ["curl http://shop.local/api/products"], ok: "HHB{h1dd3n_ap1_f13ld}", no: "HHB{nope}" },
    { run: ["curl \"http://shop.local/item?id=1'\""], ok: "syntax", no: "fine" },
    { run: ["curl \"http://shop.local/item?id=-1 UNION SELECT flag,2 FROM flags-- -\""], ok: "HHB{un10n_b4s3d_sql1}", no: "HHB{nope}" },
    { run: ["curl \"http://shop.local/search?q=<script>document.cookie</script>\""], ok: "HHB{st0l3n_c00k13_xss}", no: "HHB{nope}" },
    { run: ["cat app/AndroidManifest.xml"], ok: "READ_SMS", no: "CAMERA" },
    { run: ["grep -ri HHB app"], ok: "HHB{h4rdc0d3d_1n_str1ngs}", no: "HHB{nope}" },
  ],
  "forensics-hiding": [
    { run: ["cat invoice/docProps/core.xml"], ok: "HHB{m3t4d4t4_n3v3r_li3s}", no: "HHB{nope}" },
    { run: ["cat 'recovery/$Recycle.Bin/$RF8A21.txt'"], ok: "HHB{d3l3t3d_n0t_g0n3}", no: "HHB{nope}" },
    { run: ["echo SEhCe2ozbmsxbnNfY3IzZDV9 | base64 -d"], ok: "HHB{j3nk1ns_cr3d5}", no: "HHB{nope}" },
    { run: ["cat firefox/passwords.csv"], ok: "Wtr_M3l0n!2025", no: "password123" },
    { run: ["strings bin/widget | grep HHB"], ok: "HHB{str1ngs_sp1ll_s3cr3ts}", no: "HHB{nope}" },
    { run: ["tr 'A-Za-z' 'N-ZA-Mn-za-m' < notes/reminder.txt"], ok: "HHB{r0t13_1n_a_f1l3}", no: "HHB{nope}" },
  ],
  "webmobile-pentest": [
    { run: ["nmap app.acme-staging.example"], ok: "22", no: "25" },
    { run: ["cat ffuf.txt"], ok: ".git", no: ".svn" },
    { run: ["cvss CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"], ok: "Critical", no: "Low" },
    { run: ["cvss CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N"], ok: "Medium", no: "Critical" },
    { run: [], ok: "1", no: "3", derived: true },
    { run: ["cat scope.txt"], ok: "rules of engagement", no: "runbook" },
  ],
  "devops-git": [
    { run: ["git log --oneline"], ok: "5", no: "6" },
    { run: ["git log -S AKIAIOSFODNN7EXAMPLE --oneline"], ok: "1a2b3c4", no: "9a0b1c2" },
    { run: ["git show 1a2b3c4"], ok: "Sam", no: "Priya" },
    { run: ["git show 1a2b3c4:config/prod.env"], ok: "yes", no: "no", derived: true },
    { run: ["git tag --contains 1a2b3c4"], ok: "v1.2.0", no: "v1.0.0" },
    { run: [], ok: "rotate", no: "nothing", derived: true },
  ],
  "devops-kube": [
    { run: ["kubectl get pods"], ok: "CrashLoopBackOff", no: "Running" },
    { run: ["kubectl logs shop-cache-5f7b-qx2lp --previous"], ok: "REDIS_URL", no: "DB_PASSWORD" },
    { run: ["kubectl get pod shop-api-7d9c5b-4kq8n -o yaml"], ok: "privileged", no: "readOnly" },
    { run: ["kubectl describe pod shop-api-7d9c5b-4kq8n"], ok: "DB_PASSWORD", no: "REDIS_URL" },
    { run: ["kubectl auth can-i get secrets --as=system:serviceaccount:shop:shop-api -A"], ok: "yes", no: "no", derived: true },
    { run: ["kubectl get netpol"], ok: "no", no: "yes", derived: true },
  ],
  "devsecops-docker": [
    { run: ["docker ps"], ok: "latest", no: "1.5.0" },
    { run: ["docker history --no-trunc registry.example.com/shop-api:latest"], ok: "NPM_TOKEN", no: "DB_PASSWORD" },
    { run: ["docker inspect --format '{{.Config.User}}' registry.example.com/shop-api:latest"], ok: "root", no: "app", derived: true },
    { run: ["docker inspect --format '{{json .Mounts}}' shop-api"], ok: "/var/run/docker.sock", no: "/tmp" },
    { run: ["docker history registry.example.com/shop-api:latest"], ok: "8080", no: "443" },
    { run: [], ok: "rotate", no: "nothing", derived: true },
  ],
  "devsecops-scan": [
    { run: ["trivy fs ."], ok: "minimist", no: "lodash" },
    { run: ["trivy fs ."], ok: "1.2.6", no: "1.2.5" },
    { run: ["semgrep --config auto src/"], ok: "orders.js", no: "auth.js" },
    { run: ["cat dast-report.txt"], ok: "/api/orders", no: "/api/login" },
    { run: ["cvss CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"], ok: "Critical", no: "Low" },
    { run: [], ok: "internet", no: "internal", derived: true },
  ],
};

const platformById = Object.fromEntries([...Object.values(platformLabsByTrack).flat(), ...Object.values(forensicsLabsByTrack).flat(), ...Object.values(webLabsByTrack).flat()].map((l) => [l.id, l]));

for (const [id, steps] of Object.entries(platform)) {
  test(`${id} lab: every objective is solvable from its hint`, () => {
    const lab = platformById[id];
    assert.ok(lab, `lab ${id} is registered in platformLabsByTrack`);
    assert.equal(steps.length, lab.tasks.length, "plan covers every objective");
    const sh = new Shell(lab.spec);
    steps.forEach((step, i) => {
      sh.cwd = lab.spec.cwd ?? lab.spec.home;
      const seen = step.run.map((c) => { const r = sh.run(c); assert.ok(!/command not found/i.test(r.out), `#${i + 1}: "${c}" is not a known command`); return r.out; }).join("");
      // A non-derived answer must appear verbatim in what the commands printed.
      if (step.run.length && !step.derived) assert.ok(seen.toLowerCase().includes(step.ok.toLowerCase()), `#${i + 1}: "${step.ok}" not visible in output:\n${seen.slice(0, 300)}`);
      assert.equal(lab.tasks[i].check(step.ok), true, `#${i + 1} should accept ${step.ok}`);
      assert.equal(lab.tasks[i].check(step.no), false, `#${i + 1} should reject ${step.no}`);
    });
  });
}
