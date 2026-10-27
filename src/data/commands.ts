// The command handbook (/commands): every command learners can type in the
// Range, grouped by what you're trying to do. Descriptions and examples come
// from the lab terminal's own help (src/lib/sim/shell.ts HELP), or LAB_TOOLS
// for tools only the track labs have, so the handbook and the terminal always
// agree; `tip` adds one practical extra. practiceUses and practiceChains are
// built from the dojo drills and the labs' suggested commands, so every form
// practised there shows up here too.

import { HELP } from "@/lib/sim/shell";
import { drills, drillOrder } from "./drills";
import { shellLabs, type ShellLab } from "./labs/shellLabs";
import { advancedLabs } from "./labs/advancedLabs";
import { platformLabsByTrack } from "./labs/platformLabs";
import { forensicsLabsByTrack } from "./labs/forensicsLabs";
import { webLabsByTrack } from "./labs/webLabs";
import { tracks } from "./tracks";

export type CommandGroup = {
  title: string;
  intro: string;
  commands: { name: string; tip?: string }[];
};

export const commandGroups: CommandGroup[] = [
  {
    title: "Find your way around",
    intro: "Where am I, what's here, and how do I move?",
    commands: [
      { name: "pwd", tip: "Lost? Run pwd first — it prints the folder you're standing in." },
      { name: "ls", tip: "Add -l for details (permissions, owner, size) and -a to show hidden files that start with a dot." },
      { name: "cd", tip: "cd .. goes up one folder; cd on its own takes you home." },
      { name: "history", tip: "Press ↑ to bring back your last command instead of retyping it." },
      { name: "clear" },
    ],
  },
  {
    title: "Read files",
    intro: "Look inside a file without opening an editor.",
    commands: [
      { name: "cat", tip: "Best for short files. For long ones, use head or tail to see just the start or end." },
      { name: "head", tip: "Great for a first look at a big log: what do the lines look like?" },
      { name: "tail", tip: "Logs add new lines at the bottom, so tail shows the most recent events." },
    ],
  },
  {
    title: "Create and organise files",
    intro: "Make folders, copy and rename files, tidy up, and control who can use them.",
    commands: [
      { name: "mkdir", tip: "mkdir -p cases/2026/web01 creates every missing folder in the path at once." },
      { name: "touch", tip: "Quick way to create an empty file you'll add notes to later." },
      { name: "cp", tip: "Investigate a copy, never the original — that keeps the evidence untouched." },
      { name: "mv", tip: "Renaming is just moving to a new name: mv old.txt new.txt." },
      { name: "rm", tip: "No undo! Run ls with the same name first to see exactly what will be deleted." },
      { name: "chmod", tip: "Read the numbers as owner/group/everyone: 7 = rwx, 6 = rw-, 4 = r--, 0 = nothing." },
    ],
  },
  {
    title: "Search and filter",
    intro: "Find the lines or files that matter.",
    commands: [
      { name: "grep", tip: "Combine options: grep -ic counts matching lines, ignoring upper/lower case." },
      { name: "find", tip: "Add 2>/dev/null to hide the \"Permission denied\" noise and keep only results." },
    ],
  },
  {
    title: "Count, sort and pick columns",
    intro: "Turn hundreds of lines into a short answer.",
    commands: [
      { name: "wc", tip: "Pipe into it: grep Failed auth.log | wc -l counts the failed logins." },
      { name: "sort", tip: "sort -nr puts the biggest numbers first — perfect after uniq -c." },
      { name: "uniq", tip: "It only merges neighbouring duplicates, so always sort first." },
      { name: "cut", tip: "-d says what separates the columns, -f says which column(s) you want." },
      { name: "awk", tip: "$NF means the last word on the line — handy when lines have different lengths." },
    ],
  },
  {
    title: "Change text",
    intro: "Reshape output as it flows through a pipe — the original file stays untouched.",
    commands: [
      { name: "tr", tip: "tr 'A-Za-z' 'N-ZA-Mn-za-m' is a complete ROT13 decoder." },
      { name: "sed", tip: "Add g to replace every match on a line: s/old/new/g. Use -n '5p' to print just line 5." },
      { name: "rev", tip: "Reversed text turns up in puzzles — rev puts it back the right way round." },
      { name: "tee", tip: "Watch results and keep a copy at once. tee -a adds to the file instead of replacing it." },
    ],
  },
  {
    title: "Check and compare",
    intro: "Prove a file hasn't changed, and see exactly what has.",
    commands: [
      { name: "sha256sum", tip: "If even one character changes, the fingerprint changes completely." },
      { name: "md5sum", tip: "32 hex characters. Fast but broken — fine for a checksum or a CTF, never for security." },
      { name: "sha1sum", tip: "40 hex characters. Weak (collisions exist) — recognise it, but don't rely on it." },
      { name: "diff", tip: "Compare a config before and after a change to spot anything unexpected." },
    ],
  },
  {
    title: "Inspect files",
    intro: "Find out what a file really is and what's hidden inside it.",
    commands: [
      { name: "file", tip: "Trust file over the extension — a .pdf can really be a zip." },
      { name: "strings", tip: "Pipe through grep to search the readable text: strings image.png | grep -i flag" },
      { name: "xxd", tip: "The first few bytes (the \"magic bytes\") identify the file type." },
      { name: "binwalk", tip: "binwalk -e extracts what it finds into a new _filename.extracted folder." },
      { name: "unzip", tip: "unzip -l lists what's inside without extracting anything." },
    ],
  },
  {
    title: "Encode and decode",
    intro: "Reverse the encodings that show up in every CTF.",
    commands: [
      { name: "base64", tip: "Base64 often ends in = or ==. Decoding needs no key — it isn't encryption." },
      { name: "base32", tip: "Base32 uses only A–Z and 2–7 (no lowercase, no 0/1/8/9) and often ends in =. A good tell when you see that alphabet." },
      { name: "echo", tip: "Use echo to feed text into another command: echo aGk= | base64 -d" },
    ],
  },
  {
    title: "Who and where am I?",
    intro: "The first questions on any system you're allowed to examine.",
    commands: [
      { name: "whoami" },
      { name: "id", tip: "The groups list matters — some groups grant extra powers (e.g. reading logs)." },
      { name: "uname", tip: "uname -a shows the kernel version, useful when checking patch levels." },
      { name: "hostname" },
      { name: "date", tip: "Note the time when you start an investigation — log times are compared against it." },
      { name: "which", tip: "Shows which program actually runs when you type a command name." },
    ],
  },
  {
    title: "What's running?",
    intro: "Triage: which programs are running and which network ports are open.",
    commands: [
      { name: "ps", tip: "Look for programs running from odd places like /tmp, or using lots of CPU." },
      { name: "ss", tip: "0.0.0.0 means open to every network; 127.0.0.1 means only this machine." },
    ],
  },
  {
    title: "Tools in the track labs",
    intro: "These run in the track labs' terminals with simulated output, so you can learn to read them before using the real tools on systems you're authorized to test.",
    commands: [
      { name: "exiftool", tip: "Photos often carry GPS and the author's name — strip metadata before you publish." },
      { name: "whois", tip: "Registrant emails and name servers are pivots: search for them elsewhere." },
      { name: "dig", tip: "TXT records sometimes hold notes nobody meant to publish." },
      { name: "crtsh", tip: "Every public certificate is logged, so new or forgotten hosts often show up here first." },
      { name: "git", tip: "A secret removed in a later commit is still in the history — git show the commit that added it; use git log -S <text> to find it." },
      { name: "gitleaks", tip: "Rotate any real secret it finds; deleting the line isn't enough." },
      { name: "trivy", tip: "Start with what's fixable: findings that list a fixed version." },
      { name: "grype", tip: "A second SCA scanner — comparing two catches more than trusting one." },
      { name: "snyk", tip: "It prints the dependency path, so you can see which direct package pulls in the vulnerable one." },
      { name: "semgrep", tip: "SAST reads the code without running it — it points at the exact risky line." },
      { name: "sonar-scanner", tip: "A failing quality gate should block the merge, not just warn." },
      { name: "checkov", tip: "Each failed check names the resource and file to fix." },
      { name: "cvss", tip: "Network-reachable + no privileges + full impact is how a flaw reaches 9.8 Critical." },
      { name: "kubectl", tip: "Pod stuck in CrashLoopBackOff? Read its logs (--previous for the crashed one), then describe it for the events." },
      { name: "docker", tip: "docker history shows every build step — secrets added with ENV or COPY stay in the layers." },
      { name: "terraform", tip: "Read every -/+ line in a plan: it means destroy and recreate." },
    ],
  },
  {
    title: "Reconnaissance (authorized testing only)",
    intro: "Used in the pentest lab with simulated output. On real systems these are only ever run against targets you have written permission to test — see Rules of engagement.",
    commands: [
      { name: "nmap", tip: "Open ports tell you the attack surface; note the service and version behind each." },
      { name: "nikto", tip: "Flags missing security headers and exposed files like /.git/ and backups." },
      { name: "ffuf", tip: "A 301 on a dot-folder or a 200 on backup.zip is a lead worth chasing — and worth locking down." },
      { name: "curl", tip: "curl -i shows response headers too; pipe to grep to hunt for a flag in the body or a header." },
    ],
  },
];

// Tools that exist only in a track lab's terminal, with simulated output. The
// terminal's help doesn't describe them, so the handbook does.
export const LAB_TOOLS: Record<string, [string, string]> = {
  exiftool: ["read a file's metadata: camera, author, time, GPS position, comments", "exiftool briefing.jpg"],
  whois: ["look up who registered a domain and how to contact them", "whois acme-corp.example"],
  dig: ["ask DNS for a domain's records (A, MX, TXT…)", "dig acme-corp.example TXT"],
  crtsh: ["list the hostnames in a domain's public TLS certificates (a cached crt.sh search)", "crtsh acme-corp.example"],
  git: ["read a repository's history: log --oneline lists the commits, show <commit> shows one", "git log --oneline"],
  gitleaks: ["scan a repository, history included, for leaked secrets", "gitleaks detect --source ."],
  trivy: ["scan dependencies for known vulnerabilities (fs) and config files for mistakes (config)", "trivy fs ."],
  grype: ["scan a project or image for known-vulnerable packages, with the version that fixes each", "grype dir:."],
  snyk: ["find vulnerable dependencies and show the dependency path and the upgrade that fixes them", "snyk test"],
  semgrep: ["static analysis (SAST): search source code for risky patterns like SQL injection", "semgrep --config auto src/"],
  "sonar-scanner": ["run a SonarQube analysis and report its quality-gate result", "sonar-scanner"],
  checkov: ["check infrastructure code (Terraform, Kubernetes…) against security rules", "checkov -d ."],
  cvss: ["work out a CVSS v3.1 base score and severity from a vector string", "cvss CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"],
  nmap: ["map a host's open ports and the service behind each (authorized targets only)", "nmap app.example"],
  nikto: ["check a web server for known issues, missing headers and exposed files (authorized targets only)", "nikto -h app.example"],
  ffuf: ["discover hidden paths and parameters by trying a wordlist (authorized targets only)", "ffuf -w words.txt -u https://app.example/FUZZ"],
  curl: ["make an HTTP request and print the response — add -i to include the headers, where flags often hide", "curl -i http://shop.local/"],
  kubectl: ["inspect a Kubernetes cluster: get, describe, logs, -o yaml/jsonpath, auth can-i", "kubectl get pods"],
  docker: ["inspect images and containers: images, ps, history, inspect, logs", "docker image ls"],
  terraform: ["preview what an infrastructure change will create, change or destroy", "terraform plan"],
};

/** What a command does, and an example of it: from the terminal's help or LAB_TOOLS. */
export const describe = (name: string): [string, string] | undefined => HELP[name] ?? LAB_TOOLS[name];

// Every lab's terminal, as [track slug, lab] pairs (primary labs plus extras).
const labEntries: [string, ShellLab][] = [
  ...(Object.entries(shellLabs) as [string, ShellLab][]),
  ...[platformLabsByTrack, forensicsLabsByTrack, webLabsByTrack].flatMap((src) => Object.entries(src).flatMap(([slug, arr]) => arr.map((l) => [slug, l] as [string, ShellLab]))),
];

/** The track labs whose terminal has this command (a simulated tool). */
export const labsWith = (name: string) => {
  const seen = new Set<string>();
  const out: { href: string; title: string }[] = [];
  for (const [slug, l] of labEntries) {
    if (!(l.spec.programs?.[name] || l.spec.tools?.[name]) || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ href: `/tracks/${slug}#practice`, title: tracks[slug].title });
  }
  return out;
};

// Ready-made combinations that show how commands work together.
export const recipes: { cmd: string; does: string }[] = [
  { cmd: "grep Failed auth.log | wc -l", does: "How many failed logins are in the log?" },
  { cmd: "grep Failed auth.log | awk '{print $8}' | sort | uniq -c | sort -nr", does: "Which usernames were tried most, biggest first?" },
  { cmd: "find / -perm -4000 2>/dev/null", does: "List programs with the SUID bit, hiding permission errors." },
  { cmd: "strings image.png | grep -i flag", does: "Search the readable text inside a binary file." },
  { cmd: "echo SEhCe2hpfQ== | base64 -d", does: "Decode a Base64 string on the spot." },
  { cmd: "cat notes.txt > copy.txt", does: "Send a command's output into a file instead of the screen (>> appends)." },
  { cmd: "awk '{print $1}' access.log | sort | uniq -c | sort -nr | head -n 3", does: "Which three IP addresses made the most requests?" },
  { cmd: "ps aux | grep sync", does: "Is a particular program running, and as which user?" },
  { cmd: "ss -tlnp | grep 4444", does: "Which program is listening on a given port?" },
  { cmd: "tr 'A-Za-z' 'N-ZA-Mn-za-m' < secret.txt", does: "Decode (or encode) ROT13 with no website needed." },
  { cmd: "sed 's/changeme123/REDACTED/' config.bak", does: "Hide a secret before you paste output into a report." },
  { cmd: "cd downloads && sha256sum -c CHECKSUMS.txt", does: "Check downloads against the publisher's fingerprints." },
  { cmd: "grep -r 198.51.100.4 logs > attacker.txt", does: "Collect every log line about one IP address into a file." },
];

// Command-anatomy walkthrough for the top of the handbook.
export const anatomy = {
  example: 'grep -i "failed" auth.log',
  parts: [
    { part: "grep", label: "program", says: "what to run — here, the search tool" },
    { part: "-i", label: "option (flag)", says: "changes how it behaves — here, ignore upper/lower case" },
    { part: '"failed"', label: "argument", says: "what to look for — quotes keep it as one piece" },
    { part: "auth.log", label: "argument", says: "where to look — the file to search" },
  ],
  extras: [
    { sym: "|", means: "pipe: send this command's output into the next command" },
    { sym: ">", means: "save the output to a file (>> adds to the end)" },
    { sym: "2>/dev/null", means: "throw away error messages, keep the results" },
    { sym: "*", means: "wildcard: *.log means every file ending in .log" },
    { sym: "<", means: "feed a file into a command that only reads input, like tr" },
    { sym: "&&", means: "run the next command only if this one worked" },
    { sym: "~", means: "your home folder (.. is the folder above, . is this one)" },
    { sym: "'…'", means: "quotes keep spaces and symbols like $ and * as part of one argument" },
  ],
};

// Split a command line into its separate commands at | and && (outside quotes).
export function splitCommands(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) { if (ch === quote) quote = null; cur += ch; continue; }
    if (ch === "'" || ch === '"') { quote = ch; cur += ch; continue; }
    if (ch === "|" || (ch === "&" && line[i + 1] === "&")) { if (ch === "&") i++; out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
}

const words = (s: string) => s.match(/'[^']*'|"[^"]*"|\S+/g) ?? [];

// A command's options, redirections and the arguments that change what it does
// (awk and sed programs, tr's sets, chmod +x vs a number, cd ~ and ..), without
// the file names: two uses with the same shape teach the same thing.
function shape(segment: string): string {
  const [cmd = "", ...args] = words(segment);
  const parts = [cmd];
  let program = cmd === "tr" ? 2 : ["awk", "sed", "chmod", "cd"].includes(cmd) ? 1 : 0;
  for (const a of args) {
    if (a.startsWith("-") || /^(2>|>|<)/.test(a)) parts.push(a);
    else if (program > 0) { parts.push(cmd === "cd" && a !== "~" && a !== ".." ? "DIR" : a.replace(/\d+/g, "N")); program--; }
  }
  return parts.join(" ");
}

export type PracticeUse = { form: string; href: string; label: string };

// Every way a command is used in the dojo drills and the track labs that its
// handbook example doesn't already show — one example of each.
export const practiceUses: Record<string, PracticeUse[]> = {};
export const practiceChains: { cmd: string; does: string; href: string }[] = [];
{
  const seen = new Set<string>();
  for (const name of [...Object.keys(HELP), ...Object.keys(LAB_TOOLS)]) {
    for (const seg of splitCommands(describe(name)![1])) if (words(seg)[0] === name) seen.add(shape(seg));
  }
  const sources = [
    ...drillOrder.map((i) => drills[i]).map((d) => ({ line: d.example, href: `/commands/practice#${d.id}`, label: `Practice drill: ${d.title}`, does: d.title })),
    ...labEntries.flatMap(([slug, l]) => (l.spec.suggest ?? []).map((line) => ({ line, href: `/tracks/${slug}#practice`, label: `${tracks[slug].title} lab`, does: "" }))),
  ];
  for (const s of sources) {
    const segs = splitCommands(s.line);
    if (s.does && segs.length > 1 && !recipes.some((r) => r.cmd === s.line)) practiceChains.push({ cmd: s.line, does: s.does, href: s.href });
    for (const seg of segs) {
      const sh = shape(seg);
      if (seen.has(sh)) continue;
      seen.add(sh);
      (practiceUses[sh.split(" ")[0]] ??= []).push({ form: seg, href: s.href, label: s.label });
    }
  }
}

/** The dojo drill whose example is exactly this command line, if any. */
export const drillFor = (cmd: string) => {
  const d = drills.find((x) => x.example === cmd);
  return d ? `/commands/practice#${d.id}` : null;
};
