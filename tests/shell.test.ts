import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Shell, applyMode, type ShellSpec } from "@/lib/sim/shell";

const spec: ShellSpec = {
  user: "u", host: "h", home: "/home/u", groups: ["u"],
  files: {
    "/home/u/f.txt": "a\nb\nERR one\nc\nd\ne\nf\nERR two\ng\n",
    "/home/u/nums.txt": "10\n9\n100\n9\n",
    "/home/u/old.conf": "x\ny\nz\n",
    "/home/u/new.conf": "x\nY\nz\nw\n",
    "/etc/passwd": "root:x:0:0::/root:/bin/bash\nu:x:1000:1000::/home/u:/bin/bash\n",
    "/root/secret": "no\n",
  },
  meta: { "/root": { mode: "drwx------", owner: "root", noread: true } },
};
const fresh = () => new Shell(spec);
const run = (sh: Shell, cmd: string) => sh.run(cmd).out;

test("navigation and reading", () => {
  const sh = fresh();
  assert.equal(run(sh, "pwd"), "/home/u\n");
  run(sh, "cd /etc");
  assert.equal(run(sh, "cat passwd | cut -d: -f1"), "root\nu\n");
  run(sh, "cd");
  assert.equal(sh.cwd, "/home/u");
  assert.match(run(sh, "cat /root/secret"), /Permission denied/);
});

test("grep options, including context lines", () => {
  const sh = fresh();
  assert.equal(run(sh, "grep -c ERR f.txt"), "2\n");
  assert.equal(run(sh, "grep -v -c ERR f.txt"), "7\n");
  assert.equal(run(sh, "grep -A1 ERR f.txt"), "ERR one\nc\n--\nERR two\ng\n");
  assert.equal(run(sh, "grep -B1 -n ERR f.txt"), "2-b\n3:ERR one\n--\n7-f\n8:ERR two\n");
});

test("pipes, sort, uniq and redirects", () => {
  const sh = fresh();
  assert.equal(run(sh, "sort -n nums.txt | uniq -c | sort -nr | head -n 1"), "      2 9\n");
  run(sh, "grep ERR f.txt > errs.txt");
  run(sh, "echo extra >> errs.txt");
  assert.equal(run(sh, "wc -l < errs.txt"), "3\n");
  assert.match(run(sh, "cat < missing.txt"), /No such file/);
});

test("text tools: tr, sed, rev, tee", () => {
  const sh = fresh();
  assert.equal(run(sh, "echo Hello | tr a-z A-Z"), "HELLO\n");
  assert.equal(run(sh, "echo URYYB | tr 'A-Za-z' 'N-ZA-Mn-za-m'"), "HELLO\n");
  assert.match(run(sh, "tr a-z A-Z f.txt"), /extra operand/);
  assert.equal(run(sh, "sed -n '3,4p' f.txt"), "ERR one\nc\n");
  assert.equal(run(sh, "sed 's/ERR/OK/g' f.txt | grep -c OK"), "2\n");
  assert.equal(run(sh, "sed '/ERR/d' f.txt | wc -l"), "7\n");
  assert.equal(run(sh, "echo abc | rev"), "cba\n");
  assert.equal(run(sh, "echo saved | tee t.txt"), "saved\n");
  assert.equal(run(sh, "cat t.txt"), "saved\n");
});

test("sha256sum and diff", () => {
  const sh = fresh();
  const want = createHash("sha256").update("x\ny\nz\n").digest("hex");
  assert.equal(run(sh, "sha256sum old.conf"), `${want}  old.conf\n`);
  run(sh, `echo "${want}  old.conf" > sums.txt`);
  run(sh, `echo "${"0".repeat(64)}  new.conf" >> sums.txt`);
  const out = run(sh, "sha256sum -c sums.txt");
  assert.match(out, /old\.conf: OK/);
  assert.match(out, /new\.conf: FAILED/);
  assert.equal(run(sh, "diff old.conf new.conf"), "2c2\n< y\n---\n> Y\n3a4\n> w\n");
});

test("files: mkdir, cp, mv, rm stay inside home and /tmp", () => {
  const sh = fresh();
  assert.match(run(sh, "mkdir a/b"), /add -p/);
  run(sh, "mkdir -p a/b && cp f.txt a/b/ && mv a/b/f.txt a/b/g.txt");
  assert.ok(sh.files.has("/home/u/a/b/g.txt") && !sh.files.has("/home/u/a/b/f.txt"));
  assert.match(run(sh, "rm a"), /Is a directory/);
  run(sh, "rm -r a");
  assert.ok(!sh.dirs.has("/home/u/a"));
  assert.match(run(sh, "rm /etc/passwd"), /Permission denied/);
  assert.match(run(sh, "touch /etc/new"), /Permission denied/);
  assert.match(run(sh, "rm -rf ~"), /Permission denied/);
});

test("chmod: numeric and symbolic modes", () => {
  assert.equal(applyMode("-rw-r--r--", "600"), "-rw-------");
  assert.equal(applyMode("-rw-r--r--", "+x"), "-rwxr-xr-x");
  assert.equal(applyMode("-rw-r--r--", "u+x,go-r"), "-rwx------");
  assert.equal(applyMode("-rwxr-xr-x", "4755"), "-rwsr-xr-x");
  assert.equal(applyMode("-rw-r--r--", "banana"), null);
  const sh = fresh();
  run(sh, "chmod 600 f.txt");
  assert.match(run(sh, "ls -l f.txt"), /^-rw------- /);
  assert.match(run(sh, "chmod +x /etc/passwd"), /Operation not permitted/);
  run(sh, "chmod 400 f.txt");
  assert.match(run(sh, "echo x >> f.txt"), /Permission denied/);
});

test("canned lab tools: subcommand + name pairs pick the right output", () => {
  const sh = new Shell({ ...spec, programs: { kubectl: { "logs pod-a": "A logs", "describe pod-a": "A described", logs: "name a pod", "*": "help" } } });
  assert.equal(run(sh, "kubectl logs pod-a"), "A logs\n");
  assert.equal(run(sh, "kubectl describe pod pod-a"), "A described\n");
  assert.equal(run(sh, "kubectl logs nope"), "name a pod\n");
  assert.equal(run(sh, "kubectl version"), "help\n");
});
