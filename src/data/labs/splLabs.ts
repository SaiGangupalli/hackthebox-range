// Scenario for the SPL practice lab (src/components/labs/SplLab.tsx): hunt a
// brute-force and a web scan through real-looking logs using a Splunk search
// subset. Defensive blue-team work — counting, grouping, ranking events.

import type { Source } from "@/lib/sim/spl";
import type { Task } from "./types";

export type SplLab = {
  id: string;
  title: string;
  intro: string;
  sources: Source[];
  starters: string[];
  tasks: Task[];
};

const pad = (n: number) => String(n).padStart(2, "0");
const authAt = (s: number, action: "Failed" | "Accepted", user: string, ip: string) =>
  `2026-10-23T02:${pad(14 + Math.floor(s / 60))}:${pad(s % 60)} web01 sshd[2211]: ${action} password for ${user} from ${ip} port ${51000 + s} ssh2`;

// A brute force against root/admin from one IP, then a success on 'deploy'.
const authLines: string[] = [];
for (let i = 0; i < 40; i++) authLines.push(authAt(i, "Failed", "root", "203.0.113.66"));
for (let i = 0; i < 12; i++) authLines.push(authAt(40 + i, "Failed", "admin", "203.0.113.66"));
authLines.push(authAt(55, "Failed", "deploy", "203.0.113.66"));
authLines.push(authAt(58, "Accepted", "deploy", "203.0.113.66"));
authLines.push(authAt(30, "Failed", "root", "198.51.100.23")); // a little noise from elsewhere
authLines.push(authAt(33, "Accepted", "alice", "10.0.0.8"));

// Web access log: a scanner probing admin/git paths (404s) from one IP, plus
// ordinary traffic.
const clf = (ip: string, sec: number, method: string, path: string, status: number, bytes: number) =>
  `${ip} - - [23/Oct/2026:02:${pad(14 + Math.floor(sec / 60))}:${pad(sec % 60)} +0000] "${method} ${path} HTTP/1.1" ${status} ${bytes} "-" "curl/8.4"`;
const scanPaths = ["/.git/config", "/admin", "/wp-login.php", "/.env", "/backup.zip", "/phpmyadmin", "/server-status"];
const webLines: string[] = [];
scanPaths.forEach((p, i) => { for (let r = 0; r < (i === 0 ? 20 : 8); r++) webLines.push(clf("203.0.113.66", i * 2 + r, "GET", p, 404, 512)); });
for (let i = 0; i < 30; i++) webLines.push(clf("10.0.0.8", i, "GET", i % 3 === 0 ? "/" : "/products", 200, 8000 + i));

export const splLabs: Record<string, SplLab> = {
  splunk: {
    id: "spl-hunt",
    title: "Lab · Hunt the intrusion in logs",
    intro:
      "Overnight, web01 was hammered. Two sources of logs are indexed: SSH auth (index=auth) and web access (index=web). Use SPL to find the brute force and the scanner. Reads left to right: a search, then pipe | into stats / top / sort. Press Enter to run.",
    starters: [
      "index=auth action=Failed | stats count by user | sort -count",
      "index=auth action=Accepted | table _time user src_ip",
      "index=web status=404 | top limit=5 uri_path",
      "index=web status=404 | stats count by src_ip | sort -count",
    ],
    sources: [
      {
        index: "auth", sourcetype: "linux_secure", host: "web01",
        pattern: "^(?<ts>\\S+) \\S+ sshd\\[\\d+\\]: (?<action>Failed|Accepted) password for (?<user>\\S+) from (?<src_ip>\\S+) port (?<port>\\d+)",
        lines: authLines,
      },
      {
        index: "web", sourcetype: "access_combined", host: "web01",
        pattern: '^(?<src_ip>\\S+) \\S+ \\S+ \\[(?<ts>[^\\]]+)\\] "(?<method>\\w+) (?<uri_path>\\S+) [^"]+" (?<status>\\d+) (?<bytes>\\d+)',
        lines: webLines,
      },
    ],
    tasks: [
      {
        ask: "Which username took the most failed SSH logins?",
        placeholder: "username",
        hint: "index=auth action=Failed | stats count by user | sort -count — the top row is the most-targeted account.",
        solution: "root — 40 failed attempts, far more than any other account.",
        check: (a) => a.trim().toLowerCase() === "root",
      },
      {
        ask: "After all those failures, which account did the attacker successfully log in as (from 203.0.113.66)?",
        placeholder: "username",
        hint: "index=auth action=Accepted | table _time user src_ip — find the success from the brute-force IP.",
        solution: "deploy — the one Accepted login from 203.0.113.66 after the failures.",
        check: (a) => a.trim().toLowerCase() === "deploy",
      },
      {
        ask: "On the web server, which single source IP is behind the burst of 404s (the scan)?",
        placeholder: "an IP",
        hint: "index=web status=404 | stats count by src_ip | sort -count — one IP dominates the not-founds.",
        solution: "203.0.113.66 — the same host that brute-forced SSH was also probing web paths.",
        check: (a) => a.includes("203.0.113.66"),
      },
      {
        ask: "Which path did the scanner hit most (the top 404 URI)?",
        placeholder: "a URL path",
        hint: "index=web status=404 | top limit=5 uri_path — the #1 row by count.",
        solution: "/.git/config — an exposed Git config is a classic first probe; the fix is to block /.git/ and never deploy it.",
        check: (a) => a.trim().toLowerCase().replace(/^\//, "").startsWith(".git"),
      },
    ],
  },
};
