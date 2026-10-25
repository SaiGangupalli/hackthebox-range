// The Range's own certifications: earn one by finishing the right tracks and
// labs, then passing a timed exam. Public data only — the question bank (with
// answers) lives server-side in src/lib/certify/bank.ts. These are practice
// credentials issued by this training range, not industry certifications;
// /certifications maps real-world ones to the tracks here.

import type { Level } from "./path";

export type CertRequirement = {
  certs?: string[]; // other Range certifications first
  tracks?: string[]; // finish every one of these tracks
  anyTracks?: { of: string[]; n: number }; // finish at least n of these
  labs?: string[]; // complete every objective of these labs
  solves?: number; // solve at least this many CTF challenges
};

export type RangeCert = {
  id: string;
  code: string; // short name, also used in certificate codes
  name: string;
  level: Level;
  icon: string;
  blurb: string;
  covers: string[];
  requires: CertRequirement;
  exam: { questions: number; minutes: number; pass: number }; // pass = percent needed
};

export const CORE_TRACKS = ["os", "crypto", "osint", "stego", "network", "splunk", "forensics", "webmobile", "genai"];

export const rangeCerts: RangeCert[] = [
  {
    id: "rcsf", code: "RCSF", name: "Range Certified Security Foundations", level: "Beginner", icon: "shield",
    blurb: "Proves you can use the command line, recognise encodings and hashes, read network traffic and logs, and explain the common web and LLM attacks — and how to stop them.",
    covers: ["Linux command line & permissions", "Encoding, hashing & encryption", "Networking & packet basics", "Logs & SIEM searches", "Web risks (SQLi, XSS, IDOR, JWT)", "OSINT, stego & forensics basics", "Prompt injection basics", "Ethics & authorization"],
    requires: { anyTracks: { of: CORE_TRACKS, n: 5 }, solves: 3 },
    exam: { questions: 12, minutes: 20, pass: 80 },
  },
  {
    id: "rcdp", code: "RCDP", name: "Range Certified DevSecOps Practitioner", level: "Intermediate", icon: "devsecops",
    blurb: "Proves you can read pipelines, containers, Kubernetes and Terraform, and triage secret, dependency, image and infrastructure findings before they ship.",
    covers: ["CI/CD pipelines & branch protection", "Containers & Kubernetes security", "Infrastructure as code & cloud responsibility", "Secret scanning & rotation", "Dependency scanning & SBOMs", "SAST / DAST", "Software supply chain & signing"],
    requires: { certs: ["rcsf"], tracks: ["devops", "devsecops"], labs: ["devops-pipeline", "devsecops-review"] },
    exam: { questions: 12, minutes: 20, pass: 80 },
  },
  {
    id: "rcse", code: "RCSE", name: "Range Certified SecOps Expert", level: "Advanced", icon: "secops",
    blurb: "Proves you can hunt for attackers no alert caught, read and reason about detections, map them to MITRE ATT&CK, and run an incident from first signal to lessons learned.",
    covers: ["Threat hunting & hypotheses", "Process, network & DNS indicators", "Sigma & detection engineering", "MITRE ATT&CK", "Windows & Sysmon events", "Incident response & containment", "Evidence handling"],
    requires: { certs: ["rcsf"], tracks: ["splunk", "forensics", "secops"], labs: ["secops-hunt"] },
    exam: { questions: 15, minutes: 25, pass: 80 },
  },
  {
    id: "rcae", code: "RCAE", name: "Range Certified AISecOps Expert", level: "Advanced", icon: "aisecops",
    blurb: "Proves you can threat-model an AI application, defend it against prompt injection and excessive agency, keep models and data trustworthy, and monitor and govern it in production.",
    covers: ["LLM threat modelling (OWASP LLM Top 10, MITRE ATLAS)", "Direct & indirect prompt injection", "Agent permissions & guardrails", "Model & data supply chain", "Evaluations & red teaming", "AI logging, monitoring & cost", "AI governance (NIST AI RMF, ISO/IEC 42001)"],
    requires: { certs: ["rcsf"], tracks: ["genai", "aisecops"], labs: ["aisecops-ops"] },
    exam: { questions: 15, minutes: 25, pass: 80 },
  },
];

export const rangeCertById: Record<string, RangeCert> = Object.fromEntries(rangeCerts.map((c) => [c.id, c]));
