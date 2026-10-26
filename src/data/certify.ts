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

// Where to study a topic; the certification page turns each into a link.
export type StudyRef =
  | { track: string; lesson: string } // a lesson on a track page, by its question
  | { lab: string } // a track's practice lab, by track slug
  | { term: string } // a glossary term
  | { risk: string } // an OWASP risk: A01–A10 (/owasp) or LLM01–LLM10 (/llm)
  | { page: string; label: string }; // any other page on the site

export type StudyTopic = {
  topic: string;
  exam: string[]; // the exam's topic labels this covers (src/lib/certify/bank.ts); tests check every one is here
  refs: StudyRef[];
};

export type RangeCert = {
  id: string;
  code: string; // short name, also used in certificate codes
  name: string;
  level: Level;
  icon: string;
  blurb: string;
  covers: string[]; // the study topics' names
  study: StudyTopic[]; // the study guide: every examined topic and where it's taught
  requires: CertRequirement;
  exam: { questions: number; minutes: number; pass: number }; // pass = percent needed
};

/** The anchor of a study topic on its certification page (/certify/rcse#study-mitre-att-ck). */
export const studyId = (topic: string) => "study-" + topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const L = (track: string, lesson: string): StudyRef => ({ track, lesson });
const lab = (track: string): StudyRef => ({ lab: track });
const term = (t: string): StudyRef => ({ term: t });
const risk = (code: string): StudyRef => ({ risk: code });
const page = (path: string, label: string): StudyRef => ({ page: path, label });
const topic = (name: string, exam: string[], ...refs: StudyRef[]): StudyTopic => ({ topic: name, exam, refs });

export const CORE_TRACKS = ["os", "crypto", "osint", "stego", "network", "splunk", "forensics", "webmobile", "genai"];

const defs: Omit<RangeCert, "covers">[] = [
  {
    id: "rcsf", code: "RCSF", name: "Range Certified Security Foundations", level: "Beginner", icon: "shield",
    blurb: "Proves you can use the command line, recognise encodings and hashes, read network traffic and logs, and explain the common web and LLM attacks — and how to stop them.",
    study: [
      topic("Linux command line & permissions", ["Linux"], L("os", "How do I read a Linux permission string?"), L("os", "What is a SUID binary and why check for it?"), L("os", "What does enumeration mean?"), lab("os"), page("/commands", "Command handbook"), page("/commands/practice", "Command practice")),
      topic("Encoding, hashing & encryption", ["Cryptography"], L("crypto", "Encoding vs. encryption — what’s the difference?"), L("crypto", "How do I identify a hash?"), lab("crypto"), term("Hash"), term("Salt"), page("/tools", "Lab tools")),
      topic("Networking & packet basics", ["Networking"], L("network", "What is a packet, a port, and a protocol?"), L("network", "How do I spot a port scan?"), L("network", "What is a Wireshark display filter?"), lab("network"), term("HTTP vs HTTPS")),
      topic("Logs & SIEM searches", ["Logs & SIEM"], L("splunk", "How do I read an SPL pipeline?"), L("splunk", "What does `stats` do?"), L("forensics", "How do I build a timeline from logs?"), lab("splunk"), term("SIEM")),
      topic("Web risks (SQLi, XSS, IDOR, JWT)", ["Web"], L("webmobile", "Why is building SQL from strings dangerous?"), L("webmobile", "What is a JWT, and what’s inside it?"), L("webmobile", "What is IDOR?"), lab("webmobile"), risk("A03"), risk("A01"), term("Cross-site scripting (XSS)")),
      topic("OSINT, stego & forensics basics", ["OSINT & stego", "Forensics"], L("osint", "What is metadata and why does it matter?"), L("stego", "What are “magic bytes”?"), L("forensics", "Why hash evidence first?"), lab("osint"), lab("stego"), lab("forensics")),
      topic("Prompt injection basics", ["GenAI"], L("genai", "What is prompt injection?"), L("genai", "Direct vs. indirect injection?"), lab("genai"), risk("LLM01")),
      topic("Ethics & authorization", ["Ethics"], page("/ethics", "Rules of engagement"), L("webmobile", "What is a penetration test, and how is it different from a scan?"), term("Scope / authorization"), term("Penetration test"), term("Rules of engagement")),
    ],
    requires: { anyTracks: { of: CORE_TRACKS, n: 5 }, solves: 3 },
    exam: { questions: 12, minutes: 20, pass: 80 },
  },
  {
    id: "rcdp", code: "RCDP", name: "Range Certified DevSecOps Practitioner", level: "Intermediate", icon: "devsecops",
    blurb: "Proves you can read pipelines, containers, Kubernetes and Terraform, and triage secret, dependency, image and infrastructure findings before they ship.",
    study: [
      topic("CI/CD pipelines & branch protection", ["CI/CD", "Pipelines"], L("devops", "What is a CI/CD pipeline?"), L("devops", "How do I protect the pipeline itself?"), lab("devops"), term("CI/CD pipeline"), term("Least privilege"), term("Workload identity (OIDC)")),
      topic("Containers & Kubernetes security", ["Containers", "Kubernetes"], L("devops", "Image, container, pod — what's the difference?"), L("devops", "How do I lock down a Kubernetes workload?"), L("devsecops", "How do I harden a container image?"), lab("devops"), term("Kubernetes / pod"), term("RBAC (role-based access control)")),
      topic("Infrastructure as code & cloud responsibility", ["IaC", "Cloud"], L("devops", "What is infrastructure as code?"), L("devops", "Who secures what in the cloud?"), L("devsecops", "What do IaC scanners look for?"), lab("devsecops"), term("Shared responsibility model")),
      topic("Secret scanning & rotation", ["Secrets"], L("devsecops", "What does a secret scanner find?"), lab("devsecops"), term("Secret scanning"), term("Secret manager")),
      topic("Dependency scanning & SBOMs", ["SCA & SBOM", "Triage"], L("devsecops", "What is dependency scanning (SCA) and an SBOM?"), L("devsecops", "How do I find and fix a vulnerable dependency?"), lab("devsecops"), term("SBOM"), term("Transitive dependency"), term("Fixed version"), term("Dependency confusion"), risk("A06")),
      topic("SAST / DAST", ["SAST / DAST"], L("devsecops", "What's the difference between SAST and DAST?"), L("devsecops", "Which scanner catches which problem (SAST, DAST, SCA, MAST)?"), L("devsecops", "How do I score a vulnerability with CVSS?"), term("SAST"), term("DAST"), term("IAST"), term("MAST"), term("CVSS"), term("Quality gate")),
      topic("Software supply chain & signing", ["Supply chain"], L("devsecops", "How do signing and SLSA protect the software supply chain?"), term("Supply-chain attack"), term("Image signing"), risk("A08")),
    ],
    requires: { certs: ["rcsf"], tracks: ["devops", "devsecops"], labs: ["devops-pipeline", "devsecops-review"] },
    exam: { questions: 12, minutes: 20, pass: 80 },
  },
  {
    id: "rcse", code: "RCSE", name: "Range Certified SecOps Expert", level: "Advanced", icon: "secops",
    blurb: "Proves you can hunt for attackers no alert caught, read and reason about detections, map them to MITRE ATT&CK, and run an incident from first signal to lessons learned.",
    study: [
      topic("Threat hunting & hypotheses", ["Hunting"], L("secops", "What is threat hunting?"), lab("secops"), term("Threat hunting")),
      topic("Process, network & DNS indicators", ["Network", "Identity", "Lateral movement"], L("secops", "What is beaconing?"), L("secops", "How do attackers move laterally, and how do I spot it?"), lab("secops"), term("Beaconing"), term("Command and control (C2)"), term("Lateral movement")),
      topic("Sigma & detection engineering", ["Detection"], L("secops", "What is a Sigma rule?"), lab("secops"), term("Sigma rule"), term("False positive")),
      topic("MITRE ATT&CK", ["ATT&CK", "Threat intel"], L("secops", "What is MITRE ATT&CK?"), L("secops", "What is threat intelligence, and what is the Pyramid of Pain?"), term("MITRE ATT&CK"), term("TTPs"), term("IOC")),
      topic("Windows & Sysmon events", ["Windows"], L("secops", "Which Windows and Sysmon events should I know?")),
      topic("Incident response & containment", ["Incident response", "Improvement", "Malware analysis"], L("secops", "What happens in incident response?"), L("secops", "How do I check a suspicious file safely?"), term("Incident response"), term("EDR")),
      topic("Evidence handling", ["Evidence"], L("forensics", "What do I collect first, and how do I keep evidence trustworthy?"), L("forensics", "Why hash evidence first?"), lab("forensics"), term("Chain of custody")),
    ],
    requires: { certs: ["rcsf"], tracks: ["splunk", "forensics", "secops"], labs: ["secops-hunt"] },
    exam: { questions: 15, minutes: 25, pass: 80 },
  },
  {
    id: "rcae", code: "RCAE", name: "Range Certified AISecOps Expert", level: "Advanced", icon: "aisecops",
    blurb: "Proves you can threat-model an AI application, defend it against prompt injection and excessive agency, keep models and data trustworthy, and monitor and govern it in production.",
    study: [
      topic("LLM threat modelling (OWASP LLM Top 10, MITRE ATLAS)", ["Threat modelling"], L("aisecops", "How do I threat-model an AI app?"), page("/llm", "OWASP LLM Top 10"), term("RAG")),
      topic("Direct & indirect prompt injection", ["Prompt injection", "Guardrails"], L("genai", "What is prompt injection?"), L("genai", "Direct vs. indirect injection?"), L("genai", "What actually helps defend an LLM app?"), L("aisecops", "What is RAG poisoning?"), lab("genai"), risk("LLM01"), term("Guardrail")),
      topic("Agent permissions & guardrails", ["Agents", "Output handling", "Data leakage"], L("aisecops", "Why limit what an AI agent can do?"), lab("aisecops"), risk("LLM06"), risk("LLM05"), risk("LLM02"), risk("LLM07"), term("Excessive agency")),
      topic("Model & data supply chain", ["Supply chain", "Data poisoning", "Privacy attacks"], L("aisecops", "How do I know a model file is the one I meant to load?"), L("aisecops", "What are privacy attacks on AI models?"), risk("LLM03"), risk("LLM04"), term("Model supply chain"), term("Training data poisoning")),
      topic("Evaluations & red teaming", ["Evaluations", "Red teaming"], L("aisecops", "How do I evaluate and red-team an AI app?"), term("Evaluation (eval)"), term("Red team / blue team")),
      topic("AI logging, monitoring & cost", ["Monitoring", "Cost & availability"], L("aisecops", "What should I log and monitor for an AI app?"), lab("aisecops"), risk("LLM10")),
      topic("AI governance (NIST AI RMF, ISO/IEC 42001)", ["Governance"], L("aisecops", "Which frameworks govern AI?"), term("NIST AI RMF")),
    ],
    requires: { certs: ["rcsf"], tracks: ["genai", "aisecops"], labs: ["aisecops-ops"] },
    exam: { questions: 15, minutes: 25, pass: 80 },
  },
];

export const rangeCerts: RangeCert[] = defs.map((c) => ({ ...c, covers: c.study.map((t) => t.topic) }));

export const rangeCertById: Record<string, RangeCert> = Object.fromEntries(rangeCerts.map((c) => [c.id, c]));
