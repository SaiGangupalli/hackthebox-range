// The command dojo (/commands/practice): a practice machine plus drills you
// solve by typing real commands into the simulated terminal. Expected results
// (counts, sorted output, the busiest IP…) are computed from the same data the
// files are built from, so checks can't drift out of sync with the files.

import type { ShellSpec } from "@/lib/sim/shell";
import { makePng, makeZip } from "@/lib/sim/bytes";
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
  ["Accepted", "alice", "10.0.0.5"], ["Failed", "root", "203.0.113.7"], ["Failed", "guest", "203.0.113.7"],
  ["Failed", "admin", "203.0.113.7"], ["Failed", "root", "203.0.113.7"], ["Accepted", "deploy", "198.51.100.4"],
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

export const dojoSpec: ShellSpec = {
  user: "learner", host: "dojo", home: HOME, groups: ["learner"],
  id: "uid=1000(learner) gid=1000(learner) groups=1000(learner)",
  uname: "Linux dojo 6.8.0-45-generic #45-Ubuntu SMP x86_64 GNU/Linux",
  motd: "Welcome to the command dojo — a safe practice machine. Follow the drill above; type help any time.",
  files: {
    [`${HOME}/notes.txt`]: text(["Welcome to the command dojo!", "Every drill here can be solved with the commands in the handbook.", "Tip: press the up arrow to reuse your last command."]),
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
    "/etc/hostname": "dojo\n",
    "/etc/passwd": text(["root:x:0:0:root:/root:/bin/bash", "learner:x:1000:1000::/home/learner:/bin/bash"]),
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
];

export const drillById: Record<string, Drill> = Object.fromEntries(drills.map((d) => [d.id, d]));
export const DOJO_ID = "cmd-dojo";
