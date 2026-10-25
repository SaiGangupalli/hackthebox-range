import { test } from "node:test";
import assert from "node:assert/strict";
import { Shell } from "@/lib/sim/shell";
import { shellLabs } from "@/data/labs/shellLabs";
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
