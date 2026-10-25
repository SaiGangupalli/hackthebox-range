// The recommended learning path: what order to take the tracks in, how hard
// and how long each is, what you need first, and what you'll be able to do
// afterwards. Rendered on the home page and in each track's header.

export type Level = "Beginner" | "Intermediate" | "Advanced";
export const LEVELS: Level[] = ["Beginner", "Intermediate", "Advanced"];

export type PathStep = {
  slug: string;
  level: Level;
  minutes: number;
  why: string; // one line: why this step comes here
  prereq: string[]; // track slugs worth doing first
  outcomes: string[]; // "After this track you can…"
  labId: string; // the track's practice lab (localStorage progress key)
};

export const path: PathStep[] = [
  {
    slug: "os", level: "Beginner", minutes: 25,
    why: "Every other track uses the command line — learn to move around and read files first.",
    prereq: [],
    outcomes: ["Move around a Linux system and read files from the terminal", "Read a permission string like -rwxr-xr--", "Spot risky settings: unexpected SUID files, world-writable scripts, leftover secrets"],
    labId: "os-audit",
  },
  {
    slug: "crypto", level: "Beginner", minutes: 20,
    why: "Quick wins: learn to recognise common encodings and reverse them — they show up in every CTF.",
    prereq: [],
    outcomes: ["Tell encoding (no key) apart from encryption (needs a key)", "Recognise Base64, hex, binary and ROT13 at a glance", "Peel several layers of encoding until a flag appears"],
    labId: "crypto-decode",
  },
  {
    slug: "osint", level: "Beginner", minutes: 20,
    why: "Learn how much a target gives away in public, before anything is touched.",
    prereq: [],
    outcomes: ["Read photo metadata and explain why it leaks", "Look up who owns a domain and its DNS records", "Find forgotten hostnames through certificate transparency"],
    labId: "osint-footprint",
  },
  {
    slug: "stego", level: "Beginner", minutes: 20,
    why: "Uses your new terminal skills to find files hiding inside other files.",
    prereq: ["os", "crypto"],
    outcomes: ["Identify a file's real type from its first bytes", "Find and extract a file appended to an image", "Pull hidden text out of metadata and decode it"],
    labId: "stego-carve",
  },
  {
    slug: "network", level: "Intermediate", minutes: 30,
    why: "See what computers actually say to each other, and how to filter a capture down to what matters.",
    prereq: [],
    outcomes: ["Explain packets, ports and protocols in plain words", "Write Wireshark display filters with == && || !", "Spot a cleartext login, a port scan and suspicious DNS"],
    labId: "net-capture",
  },
  {
    slug: "splunk", level: "Intermediate", minutes: 30,
    why: "Turn thousands of log lines into a short answer — the core skill of a security analyst.",
    prereq: [],
    outcomes: ["Read an SPL search left to right through its pipes", "Count, group and rank events with stats, top and sort", "Find a brute-force attack and a web scan in logs"],
    labId: "spl-hunt",
  },
  {
    slug: "forensics", level: "Intermediate", minutes: 30,
    why: "Combines the terminal and log skills to rebuild what happened during an incident.",
    prereq: ["os", "splunk"],
    outcomes: ["Explain why evidence is hashed before analysis", "Build a timeline from timestamped log lines", "Answer who got in, from where, and what they did first"],
    labId: "forensics-timeline",
  },
  {
    slug: "webmobile", level: "Intermediate", minutes: 35,
    why: "The biggest real-world attack surface. Builds on encodings (tokens) and on reading requests.",
    prereq: ["crypto"],
    outcomes: ["Explain how SQL injection works and why parameterized queries stop it", "Read a JWT and say why its signature matters", "Recognise IDOR and the ownership check that fixes it"],
    labId: "web-sqli",
  },
  {
    slug: "genai", level: "Intermediate", minutes: 30,
    why: "The newest attack surface. Same idea as injection, but the 'parser' is a language model.",
    prereq: ["webmobile"],
    outcomes: ["Explain direct vs. indirect prompt injection", "See why secrets in a system prompt are not secret", "Choose layered defenses and say what each one misses"],
    labId: "llm-inject",
  },
  {
    slug: "devops", level: "Intermediate", minutes: 35,
    why: "See how code travels from a laptop to production — the pipeline you'll secure in the next track.",
    prereq: ["os"],
    outcomes: ["Read a CI/CD pipeline file and say what runs, in what order", "Explain images, containers and pods, and read kubectl output", "Read a terraform plan before anything changes"],
    labId: "devops-pipeline",
  },
  {
    slug: "devsecops", level: "Intermediate", minutes: 35,
    why: "Add security checks to that pipeline: secrets, dependencies, images and infrastructure code.",
    prereq: ["devops"],
    outcomes: ["Read secret, dependency and IaC scanner output and rank what to fix first", "Explain what an SBOM is and why it speeds up incident response", "Harden a Dockerfile and spot risky infrastructure code"],
    labId: "devsecops-review",
  },
  {
    slug: "secops", level: "Advanced", minutes: 45,
    why: "Put it all together: hunt for what alerts missed, read detections, and work an incident end to end.",
    prereq: ["splunk", "forensics"],
    outcomes: ["Spot a suspicious parent → child process chain", "Recognise beaconing from connection timing", "Read a Sigma rule and say what it would catch and which ATT&CK technique it maps to"],
    labId: "secops-hunt",
  },
  {
    slug: "aisecops", level: "Advanced", minutes: 45,
    why: "Operate AI features safely: guardrails, agent permissions, model integrity and monitoring.",
    prereq: ["genai", "devsecops"],
    outcomes: ["Find injected instructions hiding in retrieved documents", "Audit an agent's tool calls for data leaving the company", "Verify model files and read guardrail settings and metrics"],
    labId: "aisecops-ops",
  },
];

export const pathIndex: Record<string, PathStep> = Object.fromEntries(path.map((p) => [p.slug, p]));
export const pathOrder = path.map((p) => p.slug);
