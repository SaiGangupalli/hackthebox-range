// Real-world certifications, mapped to the tracks on this site, plus career
// roadmaps. Kept to stable facts (who issues it, level, format, what it
// proves); prices, exam codes and question counts change, so learners are sent
// to the official page for those. This site is not affiliated with any of
// these bodies.

export const CERTS_REVIEWED = "October 2026";

export const CERT_AREAS = ["Security foundations", "SecOps & blue team", "DevOps & cloud", "DevSecOps & cloud security", "AI security & governance"] as const;
export type CertArea = (typeof CERT_AREAS)[number];

export const CERT_TIERS = ["Foundational", "Associate", "Professional", "Expert"] as const;
export type CertTier = (typeof CERT_TIERS)[number];

export type IndustryCert = {
  id: string;
  name: string;
  provider: string;
  area: CertArea;
  tier: CertTier;
  format: string;
  proves: string; // plain English
  goodFor: string;
  topics: string[];
  prep: string[]; // track slugs on this site that build toward it
  note?: string; // prerequisites or recent changes
  url: string;
};

export const industryCerts: IndustryCert[] = [
  // ── Security foundations ──────────────────────────────────────────────────
  {
    id: "isc2-cc", name: "Certified in Cybersecurity (CC)", provider: "ISC2", area: "Security foundations", tier: "Foundational",
    format: "Multiple choice", proves: "You understand the core ideas of security: risk, access control, network security, incident response and security operations.",
    goodFor: "Complete beginners and career changers.", topics: ["security principles", "access control", "network security", "incident response & business continuity", "security operations"],
    prep: ["os", "crypto", "network"], url: "https://www.isc2.org/certifications/cc",
  },
  {
    id: "secplus", name: "Security+", provider: "CompTIA", area: "Security foundations", tier: "Foundational",
    format: "Multiple choice + performance-based tasks", proves: "Broad, job-ready security fundamentals: threats and vulnerabilities, secure architecture, security operations and governance.",
    goodFor: "A first security job; often requested for IT, SOC and government roles.", topics: ["threats, attacks & vulnerabilities", "cryptography & PKI", "identity & access", "network & cloud architecture", "security operations & incident response", "governance, risk & compliance"],
    prep: ["os", "crypto", "network", "webmobile", "forensics"], url: "https://www.comptia.org/en-us/certifications/security/",
  },
  {
    id: "cissp", name: "CISSP", provider: "ISC2", area: "Security foundations", tier: "Expert",
    format: "Multiple choice (adaptive)", proves: "Security leadership across eight domains, from risk management and architecture to operations and software security.",
    goodFor: "Experienced practitioners moving into architecture, management or consulting.", topics: ["security & risk management", "asset security", "security architecture", "network security", "identity & access", "assessment & testing", "security operations", "software development security"],
    prep: [], note: "Full certification requires several years of paid security work experience.", url: "https://www.isc2.org/certifications/cissp",
  },
  {
    id: "cism", name: "CISM", provider: "ISACA", area: "Security foundations", tier: "Expert",
    format: "Multiple choice", proves: "You can run a security programme: governance, risk management, programme development and incident management.",
    goodFor: "Security managers and leads.", topics: ["information security governance", "risk management", "security programme", "incident management"],
    prep: [], note: "Full certification requires security management experience.", url: "https://www.isaca.org/credentialing/cism",
  },

  // ── SecOps & blue team ────────────────────────────────────────────────────
  {
    id: "splunk-user", name: "Splunk Core Certified User", provider: "Splunk", area: "SecOps & blue team", tier: "Foundational",
    format: "Multiple choice", proves: "You can search, filter and report on data in Splunk with SPL.",
    goodFor: "Anyone heading into a SOC that uses Splunk.", topics: ["SPL basics", "searching & filtering", "transforming commands (stats, top)", "reports & dashboards", "lookups"],
    prep: ["splunk"], url: "https://www.splunk.com/en_us/training/certification-track/splunk-core-certified-user.html",
  },
  {
    id: "cysa", name: "CySA+ (Cybersecurity Analyst)", provider: "CompTIA", area: "SecOps & blue team", tier: "Associate",
    format: "Multiple choice + performance-based tasks", proves: "Analyst skills: monitoring and detection, threat hunting, vulnerability management and incident response.",
    goodFor: "SOC analysts after Security+.", topics: ["security operations & monitoring", "threat intelligence & hunting", "vulnerability management", "incident response", "reporting & communication"],
    prep: ["splunk", "forensics", "secops", "network"], url: "https://www.comptia.org/en-us/certifications/cybersecurity-analyst/",
  },
  {
    id: "btl1", name: "Blue Team Level 1 (BTL1)", provider: "Security Blue Team", area: "SecOps & blue team", tier: "Associate",
    format: "Hands-on practical exam", proves: "Practical defence in a timed lab: phishing analysis, threat intelligence, digital forensics, SIEM and incident response.",
    goodFor: "Junior defenders who want a hands-on credential.", topics: ["phishing analysis", "threat intelligence", "digital forensics", "SIEM", "incident response"],
    prep: ["splunk", "forensics", "secops"], url: "https://www.securityblue.team/certifications/blue-team-level-1",
  },
  {
    id: "sc-200", name: "Security Operations Analyst (SC-200)", provider: "Microsoft", area: "SecOps & blue team", tier: "Associate",
    format: "Multiple choice + case studies", proves: "Investigating and responding to threats with Microsoft Sentinel, Defender XDR and KQL.",
    goodFor: "SOC analysts in Microsoft environments.", topics: ["Microsoft Sentinel", "Defender XDR", "KQL hunting queries", "incident response"],
    prep: ["splunk", "secops"], url: "https://learn.microsoft.com/en-us/credentials/certifications/security-operations-analyst/",
  },
  {
    id: "gcih", name: "GCIH (Certified Incident Handler)", provider: "GIAC", area: "SecOps & blue team", tier: "Professional",
    format: "Multiple choice + hands-on lab questions", proves: "Detecting, responding to and resolving incidents, with a working knowledge of common attack techniques.",
    goodFor: "Incident responders and senior SOC analysts.", topics: ["incident handling process", "attack techniques & detection", "network & host investigation", "containment & recovery"],
    prep: ["secops", "forensics", "network"], url: "https://www.giac.org/certifications/certified-incident-handler-gcih/",
  },

  // ── DevOps & cloud ────────────────────────────────────────────────────────
  {
    id: "aws-ccp", name: "AWS Certified Cloud Practitioner", provider: "AWS", area: "DevOps & cloud", tier: "Foundational",
    format: "Multiple choice", proves: "You understand AWS cloud concepts, core services, security basics and billing.",
    goodFor: "Anyone starting with AWS, technical or not.", topics: ["cloud concepts", "core AWS services", "shared responsibility & security", "billing & pricing"],
    prep: ["devops"], url: "https://aws.amazon.com/certification/certified-cloud-practitioner/",
  },
  {
    id: "az-900", name: "Azure Fundamentals (AZ-900)", provider: "Microsoft", area: "DevOps & cloud", tier: "Foundational",
    format: "Multiple choice", proves: "You understand cloud concepts and core Azure services, governance and pricing.",
    goodFor: "Anyone starting with Azure.", topics: ["cloud concepts", "Azure architecture & services", "management & governance"],
    prep: ["devops"], url: "https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/",
  },
  {
    id: "kcna", name: "Kubernetes and Cloud Native Associate (KCNA)", provider: "Linux Foundation / CNCF", area: "DevOps & cloud", tier: "Foundational",
    format: "Multiple choice", proves: "You understand Kubernetes and the cloud-native ecosystem: containers, orchestration, observability and delivery.",
    goodFor: "A first step before CKA or CKAD.", topics: ["Kubernetes fundamentals", "container orchestration", "cloud-native architecture", "observability", "application delivery"],
    prep: ["devops"], url: "https://training.linuxfoundation.org/certification/kubernetes-cloud-native-associate/",
  },
  {
    id: "terraform", name: "Terraform Associate", provider: "HashiCorp", area: "DevOps & cloud", tier: "Associate",
    format: "Multiple choice", proves: "You can write, plan and apply infrastructure as code with Terraform, and manage state and modules.",
    goodFor: "Cloud, platform and DevOps engineers.", topics: ["infrastructure-as-code concepts", "Terraform workflow (init/plan/apply)", "state", "modules", "providers & variables"],
    prep: ["devops"], url: "https://developer.hashicorp.com/certifications",
  },
  {
    id: "gh-actions", name: "GitHub Actions", provider: "GitHub", area: "DevOps & cloud", tier: "Associate",
    format: "Multiple choice", proves: "You can build and secure CI/CD workflows with GitHub Actions.",
    goodFor: "Developers and DevOps engineers using GitHub.", topics: ["workflow syntax", "jobs, runners & triggers", "reusable workflows & actions", "secrets & permissions"],
    prep: ["devops"], url: "https://learn.github.com/certifications",
  },
  {
    id: "cka", name: "Certified Kubernetes Administrator (CKA)", provider: "Linux Foundation / CNCF", area: "DevOps & cloud", tier: "Professional",
    format: "Hands-on, performance-based (live cluster)", proves: "You can install, configure, troubleshoot and run Kubernetes clusters at the command line.",
    goodFor: "Platform and DevOps engineers running Kubernetes.", topics: ["cluster architecture & installation", "workloads & scheduling", "services & networking", "storage", "troubleshooting"],
    prep: ["devops", "os"], url: "https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/",
  },
  {
    id: "aws-devops-pro", name: "AWS Certified DevOps Engineer – Professional", provider: "AWS", area: "DevOps & cloud", tier: "Professional",
    format: "Multiple choice", proves: "You can build and run automated delivery, monitoring and incident response on AWS at scale.",
    goodFor: "Experienced DevOps engineers on AWS.", topics: ["SDLC automation", "configuration management & IaC", "resilient cloud solutions", "monitoring & logging", "incident & event response", "security & compliance"],
    prep: ["devops", "devsecops"], url: "https://aws.amazon.com/certification/certified-devops-engineer-professional/",
  },
  {
    id: "az-400", name: "DevOps Engineer Expert (AZ-400)", provider: "Microsoft", area: "DevOps & cloud", tier: "Expert",
    format: "Multiple choice + case studies", proves: "You can design and implement DevOps processes and pipelines with Azure DevOps and GitHub.",
    goodFor: "Senior DevOps engineers in Microsoft environments.", topics: ["source control strategy", "build & release pipelines", "security & compliance in pipelines", "instrumentation & feedback"],
    prep: ["devops", "devsecops"], note: "Also requires an Azure administrator or developer associate certification.", url: "https://learn.microsoft.com/en-us/credentials/certifications/devops-engineer/",
  },

  // ── DevSecOps & cloud security ────────────────────────────────────────────
  {
    id: "kcsa", name: "Kubernetes and Cloud Native Security Associate (KCSA)", provider: "Linux Foundation / CNCF", area: "DevSecOps & cloud security", tier: "Foundational",
    format: "Multiple choice", proves: "You understand how to secure Kubernetes and cloud-native systems: cluster components, workloads, supply chain and compliance.",
    goodFor: "A security-focused first step before CKS.", topics: ["cloud-native security overview", "cluster component security", "security fundamentals (RBAC, secrets, network policy)", "threat model", "platform & supply-chain security", "compliance"],
    prep: ["devops", "devsecops"], url: "https://training.linuxfoundation.org/certification/kubernetes-and-cloud-native-security-associate-kcsa/",
  },
  {
    id: "ghas", name: "GitHub Advanced Security", provider: "GitHub", area: "DevSecOps & cloud security", tier: "Associate",
    format: "Multiple choice", proves: "You can use secret scanning, dependency review and code scanning (CodeQL) to find and fix issues in repositories.",
    goodFor: "Developers and AppSec engineers on GitHub.", topics: ["secret scanning & push protection", "Dependabot & dependency review", "code scanning with CodeQL", "security workflows & governance"],
    prep: ["devsecops"], url: "https://learn.github.com/certifications",
  },
  {
    id: "az-500", name: "Azure Security Engineer Associate (AZ-500)", provider: "Microsoft", area: "DevSecOps & cloud security", tier: "Associate",
    format: "Multiple choice + case studies", proves: "You can secure identity, networking, compute, storage and data in Azure.",
    goodFor: "Cloud security engineers in Azure.", topics: ["identity & access", "networking security", "compute, storage & database security", "security operations"],
    prep: ["devops", "devsecops"], url: "https://learn.microsoft.com/en-us/credentials/certifications/azure-security-engineer/",
  },
  {
    id: "ccsk", name: "Certificate of Cloud Security Knowledge (CCSK)", provider: "Cloud Security Alliance", area: "DevSecOps & cloud security", tier: "Associate",
    format: "Online, open-book multiple choice", proves: "Vendor-neutral cloud security knowledge based on CSA's security guidance.",
    goodFor: "Anyone securing cloud workloads, regardless of provider.", topics: ["cloud governance & risk", "identity & access in the cloud", "data security", "workload & application security", "incident response in the cloud"],
    prep: ["devops", "devsecops"], url: "https://cloudsecurityalliance.org/education/ccsk",
  },
  {
    id: "cdp", name: "Certified DevSecOps Professional (CDP)", provider: "Practical DevSecOps", area: "DevSecOps & cloud security", tier: "Professional",
    format: "Hands-on practical exam", proves: "You can build security tooling into CI/CD: SCA, SAST, DAST, IaC and compliance as code.",
    goodFor: "Engineers building DevSecOps pipelines.", topics: ["secure SDLC", "SCA & SAST in pipelines", "DAST", "infrastructure as code security", "compliance as code"],
    prep: ["devops", "devsecops"], url: "https://www.practical-devsecops.com/certified-devsecops-professional/",
  },
  {
    id: "cks", name: "Certified Kubernetes Security Specialist (CKS)", provider: "Linux Foundation / CNCF", area: "DevSecOps & cloud security", tier: "Professional",
    format: "Hands-on, performance-based (live cluster)", proves: "You can harden clusters, workloads and the supply chain, and monitor and respond at runtime.",
    goodFor: "Kubernetes administrators specialising in security.", topics: ["cluster setup & hardening", "system hardening", "minimising microservice vulnerabilities", "supply-chain security", "monitoring, logging & runtime security"],
    prep: ["devops", "devsecops", "secops"], note: "Requires an active CKA.", url: "https://training.linuxfoundation.org/certification/certified-kubernetes-security-specialist/",
  },
  {
    id: "aws-security", name: "AWS Certified Security – Specialty", provider: "AWS", area: "DevSecOps & cloud security", tier: "Professional",
    format: "Multiple choice", proves: "Deep knowledge of securing AWS workloads: detection, incident response, logging, IAM, data protection and governance.",
    goodFor: "Experienced cloud security engineers on AWS.", topics: ["threat detection & incident response", "logging & monitoring", "infrastructure security", "identity & access management", "data protection", "governance"],
    prep: ["devops", "devsecops", "secops"], note: "AWS has announced an update to this exam — check the current exam guide.", url: "https://aws.amazon.com/certification/certified-security-specialty/",
  },
  {
    id: "ccsp", name: "CCSP", provider: "ISC2", area: "DevSecOps & cloud security", tier: "Expert",
    format: "Multiple choice", proves: "Advanced cloud security architecture, design, operations and service orchestration.",
    goodFor: "Experienced professionals designing cloud security.", topics: ["cloud concepts & architecture", "cloud data security", "platform & infrastructure security", "application security", "operations", "legal, risk & compliance"],
    prep: ["devsecops"], note: "Full certification requires several years of IT and security experience.", url: "https://www.isc2.org/certifications/ccsp",
  },

  // ── AI security & governance ──────────────────────────────────────────────
  {
    id: "aws-aip", name: "AWS Certified AI Practitioner", provider: "AWS", area: "AI security & governance", tier: "Foundational",
    format: "Multiple choice", proves: "You understand AI, machine learning and generative AI concepts on AWS, including responsible AI and security basics.",
    goodFor: "Anyone working with AI products, technical or not.", topics: ["AI & ML fundamentals", "generative AI & foundation models", "responsible AI", "security, compliance & governance for AI"],
    prep: ["genai"], url: "https://aws.amazon.com/certification/certified-ai-practitioner/",
  },
  {
    id: "secai", name: "SecAI+", provider: "CompTIA", area: "AI security & governance", tier: "Associate",
    format: "Multiple choice + performance-based tasks", proves: "Vendor-neutral, hands-on skills for securing AI systems against AI-specific threats, and for using AI in security operations.",
    goodFor: "Security practitioners who work with AI; Security+ or CySA+ level experience is recommended.", topics: ["AI concepts for security", "securing AI systems", "AI-specific threats (prompt injection, poisoning)", "AI-assisted security operations", "AI governance & compliance"],
    prep: ["genai", "aisecops"], note: "Launched in 2026 — new, so check what employers in your area ask for.", url: "https://www.comptia.org/en-us/certifications/secai/",
  },
  {
    id: "aigp", name: "AI Governance Professional (AIGP)", provider: "IAPP", area: "AI security & governance", tier: "Professional",
    format: "Multiple choice", proves: "You can govern AI responsibly: laws and frameworks (EU AI Act, NIST AI RMF, ISO/IEC 42001), risk and lifecycle oversight.",
    goodFor: "Privacy, legal, risk and policy professionals working on AI.", topics: ["AI governance foundations", "laws, standards & frameworks", "AI risk management", "governing AI development & deployment"],
    prep: ["genai", "aisecops"], url: "https://iapp.org/certify/aigp/",
  },
  {
    id: "iso42001", name: "ISO/IEC 42001 Lead Implementer", provider: "PECB (and other training bodies)", area: "AI security & governance", tier: "Professional",
    format: "Training course + exam", proves: "You can plan, build and maintain an AI management system that follows ISO/IEC 42001.",
    goodFor: "People who will build or audit an organisation's AI management system.", topics: ["ISO/IEC 42001 requirements", "AI risk & impact assessment", "AI management system implementation", "monitoring & continual improvement"],
    prep: ["aisecops"], note: "ISO/IEC 42001 certifies organisations; this credential certifies the person who implements it.", url: "https://pecb.com/en/education-and-certification-for-individuals/iso-iec-42001",
  },
  {
    id: "aaism", name: "Advanced in AI Security Management (AAISM)", provider: "ISACA", area: "AI security & governance", tier: "Expert",
    format: "Multiple choice", proves: "You can lead AI security: governance, risk management and security controls for AI programmes.",
    goodFor: "Security managers responsible for AI.", topics: ["AI governance & programme management", "AI risk management", "AI technologies & security controls"],
    prep: ["aisecops"], note: "For holders of CISM or CISSP.", url: "https://www.isaca.org/credentialing/aaism",
  },
];

export const industryCertById: Record<string, IndustryCert> = Object.fromEntries(industryCerts.map((c) => [c.id, c]));

// Career roadmaps: tracks here → Range certifications → industry certifications.
export type RoadStep = { kind: "track" | "range" | "cert"; id: string };
export type Roadmap = { role: string; blurb: string; steps: RoadStep[] };

const t = (id: string): RoadStep => ({ kind: "track", id });
const r = (id: string): RoadStep => ({ kind: "range", id });
const c = (id: string): RoadStep => ({ kind: "cert", id });

export const roadmaps: Roadmap[] = [
  {
    role: "SOC analyst", blurb: "Watch, triage and investigate alerts; hunt for what they miss.",
    steps: [t("os"), t("network"), t("splunk"), t("forensics"), r("rcsf"), c("secplus"), c("splunk-user"), t("secops"), r("rcse"), c("cysa"), c("btl1"), c("gcih")],
  },
  {
    role: "DevOps / platform engineer", blurb: "Build pipelines and run containers, Kubernetes and cloud infrastructure.",
    steps: [t("os"), t("devops"), c("aws-ccp"), c("kcna"), c("terraform"), c("gh-actions"), c("cka"), c("aws-devops-pro")],
  },
  {
    role: "DevSecOps engineer", blurb: "Put security checks into every stage of delivery.",
    steps: [t("os"), t("webmobile"), t("devops"), t("devsecops"), r("rcsf"), r("rcdp"), c("kcsa"), c("ghas"), c("cka"), c("cks"), c("cdp")],
  },
  {
    role: "Cloud security engineer", blurb: "Secure identities, networks and data in AWS, Azure or Google Cloud.",
    steps: [t("devops"), t("devsecops"), r("rcdp"), c("ccsk"), c("az-500"), c("aws-security"), c("ccsp")],
  },
  {
    role: "AI security engineer", blurb: "Threat-model, defend and monitor AI features in production.",
    steps: [t("genai"), t("devsecops"), t("aisecops"), r("rcsf"), r("rcae"), c("aws-aip"), c("secai"), c("aigp"), c("aaism")],
  },
];
