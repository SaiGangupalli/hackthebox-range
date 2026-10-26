// Plain-English glossary of the jargon used across the Range. Each entry is
// written for someone with no background: what it is, then (optionally) an
// everyday example. Rendered at /glossary and in the cheatsheet PDF. To add a
// term, append one line in the same shape; to add a category, list it in
// GLOSSARY_CATS too.

export type Term = { term: string; cat: string; def: string; eg?: string; track?: string };

/** Stable anchor for a term on /glossary (/glossary#term-sigma-rule). */
export const termId = (term: string) => "term-" + term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const GLOSSARY_CATS = ["Basics", "Networking", "Systems", "Cryptography", "Web & apps", "Logs & forensics", "DevOps & cloud", "DevSecOps", "Security operations", "AI security"];

export const glossary: Term[] = [
  // Basics
  { term: "CTF (Capture the Flag)", cat: "Basics", def: "A security game where you solve puzzles to find a secret string called a flag, then submit it for points.", eg: "Decoding a Base64 string to reveal HHB{…} is a typical CTF task." },
  { term: "Flag (CTF)", cat: "Basics", def: "The secret answer string you find in a challenge, usually in a fixed format so it's easy to recognise.", eg: "HHB{st3go_in_plain_sight}" },
  { term: "Vulnerability", cat: "Basics", def: "A weakness in software or setup that could let someone do something they shouldn't.", eg: "A login that builds SQL from user input has an injection vulnerability." },
  { term: "Exploit", cat: "Basics", def: "A method or piece of code that takes advantage of a vulnerability." },
  { term: "Payload", cat: "Basics", def: "The specific input sent to trigger a vulnerability — the 'message' in an attack.", eg: "In a test, the text typed into a login box to change the query is the payload." },
  { term: "Attack surface", cat: "Basics", def: "Every place an attacker could interact with a system: forms, open ports, APIs, uploads, people.", eg: "A shop with a login, a search box and an admin page has three obvious entry points." },
  { term: "Scope / authorization", cat: "Basics", def: "The written permission that says exactly what you may test. Testing outside it is illegal, even if you mean well." },
  { term: "Red team / blue team", cat: "Basics", def: "Red team plays the attacker to find weaknesses; blue team defends, detects and responds. This range teaches both, aimed at defense." },
  { term: "Defense in depth", cat: "Basics", def: "Using several layers of protection so that if one fails, another still stops the attack.", eg: "Like a house with a fence, a lock and an alarm — not just one." },
  { term: "Least privilege", cat: "Basics", def: "Give every user, program or AI tool only the access it needs for its job — nothing more." },
  { term: "Penetration test", cat: "Basics", def: "An authorized, scoped, time-boxed attack on a system to find real weaknesses before criminals do. It runs in phases — recon, enumeration, exploitation, post-exploitation, reporting — and the deliverable is a report with findings, CVSS severities and fixes.", eg: "A vuln scan lists possible issues; a pentest proves which are exploitable and how far they go." },
  { term: "Rules of engagement", cat: "Basics", def: "The written agreement for a pentest: what's in scope, what's off-limits, when testing may run, who to call, and how findings are handled. Staying inside it is what keeps the test legal." },
  { term: "Fuzzing", cat: "Basics", def: "Throwing large amounts of unexpected or malformed input at a program to find inputs that crash it or slip past checks.", eg: "Spraying thousands of URL paths at a web app to discover hidden pages (ffuf)." },
  { term: "Purple team", cat: "Basics", def: "Red (attack) and blue (defend) working together: the attacker shows a technique, the defender confirms their tools catch it, and detection improves on the spot." },

  // Networking
  { term: "IP address", cat: "Networking", def: "A number that identifies a device on a network, like a postal address for a computer.", eg: "10.0.0.8 or 93.184.216.34" },
  { term: "Port", cat: "Networking", def: "A numbered door on a computer. Different services listen behind different doors.", eg: "80 = web (HTTP), 443 = secure web (HTTPS), 22 = SSH, 53 = DNS" },
  { term: "Protocol", cat: "Networking", def: "An agreed set of rules two computers follow to talk — the 'language' spoken through a port.", eg: "HTTP, DNS, SSH, TLS" },
  { term: "Packet", cat: "Networking", def: "A small chunk of data sent across a network. Big messages are split into many packets." },
  { term: "TCP handshake (SYN, SYN-ACK, ACK)", cat: "Networking", def: "How two computers start a TCP conversation: 'Can we talk?' (SYN), 'Yes, can you hear me?' (SYN-ACK), 'Yes' (ACK).", eg: "Lots of SYNs with no reply from one source is a port scan." },
  { term: "Port scan", cat: "Networking", def: "Knocking on many ports quickly to see which ones are open. Defenders watch for it as an early warning sign." },
  { term: "DNS", cat: "Networking", def: "The internet's phone book: turns names like shop.example into IP addresses." },
  { term: "HTTP vs HTTPS", cat: "Networking", def: "HTTP sends web traffic as readable text. HTTPS wraps it in encryption (TLS) so others on the network can't read it." },
  { term: "TLS", cat: "Networking", def: "The encryption layer behind HTTPS and many other secure connections." },
  { term: "Cleartext", cat: "Networking", def: "Data sent without encryption, readable by anyone who can see the traffic.", eg: "A password posted over plain HTTP is in cleartext." },
  { term: "Packet capture (pcap)", cat: "Networking", def: "A recording of network traffic you can open later in Wireshark to inspect." },
  { term: "Display filter", cat: "Networking", def: "A Wireshark expression that hides every packet except the ones you care about.", eg: 'http.request.method == "POST"' },

  // Systems
  { term: "Terminal / shell", cat: "Systems", def: "A text window where you type commands instead of clicking. The shell is the program that reads and runs them.", eg: "Typing ls and pressing Enter lists the files in a folder.", track: "os" },
  { term: "Root", cat: "Systems", def: "The all-powerful administrator account on Linux. Anything running as root can change anything on the machine.", track: "os" },
  { term: "File permissions", cat: "Systems", def: "Rules saying who may read, write or run a file: the owner, the owner's group, and everyone else.", eg: "-rw-r----- means the owner can read and write, the group can read, everyone else gets nothing.", track: "os" },
  { term: "SUID", cat: "Systems", def: "A permission bit that makes a program run with its owner's powers instead of yours. Unexpected SUID programs are a classic thing to audit.", track: "os" },
  { term: "Privilege escalation", cat: "Systems", def: "Turning limited access into more — a normal user becoming root (local), or a low-privilege account gaining admin (vertical). Misused SUID files, writable services and weak sudo rules are common routes; least privilege and patching close them.", track: "os" },
  { term: "Cron job", cat: "Systems", def: "A task the system runs automatically on a schedule.", eg: "*/5 * * * * means every five minutes.", track: "os" },
  { term: "Pipe ( | )", cat: "Systems", def: "Sends one command's output straight into the next command, so small tools can be chained into one answer.", eg: "grep Failed auth.log | wc -l counts failed logins.", track: "os" },

  // Cryptography
  { term: "Encoding", cat: "Cryptography", def: "Rewriting data in another format so it can be stored or sent. Anyone can reverse it — no key, no secrecy.", eg: "Base64, hex and URL-encoding.", track: "crypto" },
  { term: "Encryption", cat: "Cryptography", def: "Scrambling data so only someone with the right key can read it.", eg: "HTTPS encrypts web traffic; AES encrypts files.", track: "crypto" },
  { term: "Hash", cat: "Cryptography", def: "A one-way fingerprint of data. The same input always gives the same hash, but you can't turn the hash back into the input.", eg: "sha256sum file.iso proves a download wasn't changed.", track: "crypto" },
  { term: "Salt", cat: "Cryptography", def: "Random data added to each password before hashing, so two people with the same password get different hashes and pre-computed lookup tables don't work." },
  { term: "Base64", cat: "Cryptography", def: "An encoding that turns any data into letters, digits, + and /, often ending in = signs. Common in CTFs, emails and web tokens.", eg: "SGk= decodes to Hi.", track: "crypto" },
  { term: "Symmetric vs asymmetric encryption", cat: "Cryptography", def: "Symmetric uses one shared key to lock and unlock. Asymmetric uses a key pair: a public key anyone can use to lock, and a private key only the owner has to unlock.", track: "crypto" },
  { term: "Digital signature", cat: "Cryptography", def: "Proof, made with a private key, that data came from a specific sender and wasn't changed on the way." },
  { term: "Atbash cipher", cat: "Cryptography", def: "A cipher that mirrors the alphabet (A↔Z, B↔Y…). It has no key and is its own inverse, so applying it twice gives the original. A giveaway is that common words become fixed patterns.", eg: "SUBSTITUTION encrypts to HFYHGRGFGRLM; the flag HHB{ shows up as SSY{.", track: "crypto" },
  { term: "Substitution cipher", cat: "Cryptography", def: "Each letter is consistently replaced by another. Caesar/ROT (shift) and Atbash (mirror) are simple cases; a general one is cracked with letter-frequency analysis, not brute force.", track: "crypto" },

  // Web & apps
  { term: "SQL injection", cat: "Web & apps", def: "When user input ends up as part of a database query, so typed text can change what the query does. Fixed with parameterised queries.", track: "webmobile" },
  { term: "Cross-site scripting (XSS)", cat: "Web & apps", def: "When a site shows user input as code, so a script runs in other visitors' browsers. Fixed by encoding output and a Content Security Policy.", track: "webmobile" },
  { term: "IDOR", cat: "Web & apps", def: "Insecure Direct Object Reference: the server returns any record you ask for by ID without checking it's yours. Fixed with an ownership check on every request.", eg: "Changing /invoice/1001 to /invoice/1002 shows someone else's invoice.", track: "webmobile" },
  { term: "JWT", cat: "Web & apps", def: "JSON Web Token: a signed token that says who you are. Anyone can read its contents; the signature only stops tampering — and only if the server checks it.", track: "webmobile" },
  { term: "Session cookie", cat: "Web & apps", def: "A small value your browser sends with every request so the site remembers you're signed in. Whoever has it is treated as you." },
  { term: "CSRF", cat: "Web & apps", def: "Cross-site request forgery: tricking a signed-in user's browser into sending a request they didn't intend. Prevented with anti-CSRF tokens and SameSite cookies." },
  { term: "Content Security Policy (CSP)", cat: "Web & apps", def: "A header that tells the browser which sources of scripts, styles and images a page may use, limiting what injected code can do." },

  // Logs & forensics
  { term: "Log", cat: "Logs & forensics", def: "A timestamped record of events a system wrote down: logins, web requests, errors.", track: "splunk" },
  { term: "SIEM", cat: "Logs & forensics", def: "Security Information and Event Management: a system that collects logs from everywhere so analysts can search, chart and alert on them in one place.", eg: "Splunk, Elastic, Microsoft Sentinel.", track: "splunk" },
  { term: "SPL", cat: "Logs & forensics", def: "Splunk's search language. Commands are chained with | , like a shell pipeline.", eg: "index=auth action=failure | stats count by src", track: "splunk" },
  { term: "Timeline", cat: "Logs & forensics", def: "Events from different sources put in time order, so the story of an incident becomes clear.", track: "forensics" },
  { term: "Chain of custody", cat: "Logs & forensics", def: "A record of who collected and handled evidence, and when — so it can be trusted later.", track: "forensics" },
  { term: "Magic bytes", cat: "Logs & forensics", def: "The first few bytes of a file that identify its real type, whatever its name says.", eg: "PNG files start with 89 50 4E 47; Zip files with PK.", track: "stego" },
  { term: "Metadata (EXIF)", cat: "Logs & forensics", def: "Hidden information stored inside a file: author, device, time, sometimes GPS location. In Office files it's in docProps/core.xml (an Office file is a zip); in photos it's EXIF. People forget to strip it.", track: "osint" },
  { term: "Recycle Bin ($I / $R)", cat: "Logs & forensics", def: "Where Windows keeps deleted files. For each one a $I record holds the original name and time, and a $R file holds the actual data — deletion only unlinks the name, so the bytes survive until overwritten and can be recovered.", track: "forensics" },
  { term: "strings (tool)", cat: "Logs & forensics", def: "Prints the readable text runs inside a binary. Flags, URLs, passwords and keys compiled into a program often sit in the clear — the first thing to try on an unknown executable (or with a PE editor like CFF Explorer).", track: "forensics" },
  { term: "Steganography", cat: "Logs & forensics", def: "Hiding a message inside another file — an image, audio, or text — so nobody suspects it's there.", track: "stego" },
  { term: "OSINT", cat: "Logs & forensics", def: "Open-source intelligence: building a picture from public information only, such as websites, DNS records and photo metadata.", track: "osint" },

  // DevOps & cloud
  { term: "CI/CD pipeline", cat: "DevOps & cloud", def: "Automatic steps that run when code changes: test it, build it, deploy it. CI checks every change; CD ships the ones that pass.", track: "devops" },
  { term: "Container", cat: "DevOps & cloud", def: "A packaged app with everything it needs to run, isolated from other apps on the same machine.", eg: "A Docker container running a web shop.", track: "devops" },
  { term: "Container image", cat: "DevOps & cloud", def: "The template a container starts from. A version tag like shop:1.4.2 says exactly which build it is; latest says nothing.", track: "devops" },
  { term: "Kubernetes / pod", cat: "DevOps & cloud", def: "Kubernetes runs containers across many machines and restarts them when they fail. A pod is its smallest unit — one or more containers running together.", track: "devops" },
  { term: "RBAC (role-based access control)", cat: "DevOps & cloud", def: "Granting access by role instead of per person. In Kubernetes a Role (or ClusterRole) lists allowed verbs on resources; a RoleBinding is namespaced, a ClusterRoleBinding applies cluster-wide — so prefer the narrower one.", track: "devops" },
  { term: "Workload identity (OIDC)", cat: "DevOps & cloud", def: "Letting a pipeline or workload prove who it is with a short-lived identity token, which the cloud swaps for temporary credentials — so there's no long-lived access key stored as a secret to leak.", track: "devops" },
  { term: "Infrastructure as code (IaC)", cat: "DevOps & cloud", def: "Describing servers, networks and storage in files (for example Terraform) instead of setting them up by hand, so changes can be reviewed like code.", track: "devops" },
  { term: "Shared responsibility model", cat: "DevOps & cloud", def: "In the cloud, the provider secures the platform; you secure what you build on it — your settings, accounts, data and code.", track: "devops" },
  { term: "Secret manager", cat: "DevOps & cloud", def: "A service that stores passwords, keys and tokens safely and hands them to apps at runtime, so secrets never sit in code or config files.", track: "devops" },

  // DevSecOps
  { term: "Shift left", cat: "DevSecOps", def: "Moving security checks earlier — into the editor and the pipeline — where problems are cheaper and faster to fix.", track: "devsecops" },
  { term: "SAST", cat: "DevSecOps", def: "Static application security testing: scanning source code for risky patterns without running it.", track: "devsecops" },
  { term: "DAST", cat: "DevSecOps", def: "Dynamic application security testing: probing a running app from the outside, the way a user's browser would.", eg: "OWASP ZAP, Burp Suite.", track: "devsecops" },
  { term: "IAST", cat: "DevSecOps", def: "Interactive application security testing: a sensor inside the running app watches real requests flow through the code, so it confirms which flaws are truly reachable — between SAST and DAST.", track: "devsecops" },
  { term: "MAST", cat: "DevSecOps", def: "Mobile application security testing: SAST, DAST and config checks aimed at a mobile build — its manifest, stored data and network traffic.", eg: "MobSF; the mobile modes of Fortify and Checkmarx.", track: "webmobile" },
  { term: "SCA (dependency scanning)", cat: "DevSecOps", def: "Software composition analysis: checking the third-party libraries you use against lists of known vulnerabilities, and telling you the version that fixes each.", eg: "Trivy, Grype, Snyk, Black Duck, Dependabot, OWASP Dependency-Check.", track: "devsecops" },
  { term: "SBOM", cat: "DevSecOps", def: "Software bill of materials: an ingredient list of every component and version in a release, so you can tell fast whether a new vulnerability affects you.", track: "devsecops" },
  { term: "CVE", cat: "DevSecOps", def: "Common Vulnerabilities and Exposures: a public ID for a known vulnerability, so everyone can refer to the same issue.", eg: "CVE-2021-44906", track: "devsecops" },
  { term: "CVSS", cat: "DevSecOps", def: "Common Vulnerability Scoring System: a 0–10 score for how severe a flaw is, built from how it's reached and its impact. Bands: 0.1–3.9 Low, 4–6.9 Medium, 7–8.9 High, 9–10 Critical. Severity isn't the same as priority — weigh exposure and exploitability too.", eg: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H = 9.8 Critical.", track: "devsecops" },
  { term: "Fixed version", cat: "DevSecOps", def: "The release of a dependency that patches a known vulnerability. SCA tools print it next to each finding, so the fix is usually 'upgrade to this version or later'.", eg: "minimist 1.2.5 → fixed in 1.2.6.", track: "devsecops" },
  { term: "Quality gate", cat: "DevSecOps", def: "A pass/fail rule a build must clear before it merges or ships — e.g. no new critical vulnerabilities, coverage above a threshold. SonarQube is a common one.", track: "devsecops" },
  { term: "Dependency confusion", cat: "DevSecOps", def: "A supply-chain trick where an attacker publishes a public package with the same name as your private one, hoping the build pulls theirs. A typosquat is the look-alike-name version.", eg: "Internal 'acme-utils' vs a public 'acme-utils' an attacker uploads.", track: "devsecops" },
  { term: "Secret scanning", cat: "DevSecOps", def: "Searching code and its history for passwords, keys and tokens that were committed by mistake. A found secret must be revoked, not just deleted.", track: "devsecops" },
  { term: "Transitive dependency", cat: "DevSecOps", def: "A library you didn't add yourself, pulled in by a library you did add. Most vulnerable code arrives this way.", track: "devsecops" },
  { term: "Supply-chain attack", cat: "DevSecOps", def: "Compromising software by tampering with something it's built from — a library, a build tool, a container image — rather than attacking it directly.", track: "devsecops" },
  { term: "Image signing", cat: "DevSecOps", def: "Cryptographically signing a container image so you can verify who built it and that it hasn't changed before you deploy it.", eg: "Sigstore cosign.", track: "devsecops" },

  // Security operations
  { term: "SOC", cat: "Security operations", def: "Security operations centre: the team that watches alerts, investigates and responds to incidents.", track: "secops" },
  { term: "Threat hunting", cat: "Security operations", def: "Searching logs on purpose for attacker behaviour that no alert caught, starting from a hypothesis.", track: "secops" },
  { term: "IOC", cat: "Security operations", def: "Indicator of compromise: a clue that something bad happened, such as a known malicious IP address, domain or file hash.", track: "secops" },
  { term: "TTPs", cat: "Security operations", def: "Tactics, techniques and procedures: how an attacker behaves. Harder for them to change than an IP address, so detecting behaviour lasts longer.", track: "secops" },
  { term: "MITRE ATT&CK", cat: "Security operations", def: "A public catalogue of attacker techniques, each with an ID, used to describe what happened and to find gaps in detection.", eg: "T1059.001 = PowerShell.", track: "secops" },
  { term: "Sigma rule", cat: "Security operations", def: "A detection written once in a shared YAML format and converted into the search language of any SIEM.", track: "secops" },
  { term: "Command and control (C2)", cat: "Security operations", def: "The server attackers use to send instructions to machines they've compromised.", track: "secops" },
  { term: "Beaconing", cat: "Security operations", def: "Malware checking in with its C2 server on a timer. In logs it looks like very regular connections from one host to one destination.", track: "secops" },
  { term: "Lateral movement", cat: "Security operations", def: "An attacker moving from the first machine they reached to others inside the network, usually with stolen credentials.", track: "secops" },
  { term: "EDR", cat: "Security operations", def: "Endpoint detection and response: software on laptops and servers that records activity, raises alerts and can isolate a machine.", track: "secops" },
  { term: "Incident response", cat: "Security operations", def: "The practised process for handling an attack: prepare, detect and analyse, contain, eradicate, recover, then learn lessons.", track: "secops" },
  { term: "False positive", cat: "Security operations", def: "An alert that fired on harmless activity. Too many and analysts start ignoring alerts, so detections are tuned to reduce them.", track: "secops" },

  // AI security
  { term: "LLM", cat: "AI security", def: "Large language model: an AI that predicts and generates text. Chatbots and AI assistants are built on them.", track: "genai" },
  { term: "System prompt", cat: "AI security", def: "Hidden instructions an app gives the model before the user's message. Assume it can be extracted — never put secrets in it.", track: "genai" },
  { term: "Prompt injection", cat: "AI security", def: "Text that tries to override an AI app's instructions. Direct injection comes from the user; indirect injection hides in content the AI reads, such as a web page or document.", track: "genai" },
  { term: "RAG", cat: "AI security", def: "Retrieval-augmented generation: the app looks up relevant documents and pastes them into the prompt so the model can answer from them.", track: "aisecops" },
  { term: "RAG poisoning", cat: "AI security", def: "Planting instructions or false information in documents a RAG app will retrieve, so the model follows or repeats them.", track: "aisecops" },
  { term: "AI agent / tools", cat: "AI security", def: "An AI that can take actions — send email, call APIs, run code — not just write text. Its tools decide how much damage a manipulated model can do.", track: "aisecops" },
  { term: "Excessive agency", cat: "AI security", def: "Giving an AI agent more tools or permissions than its job needs. Limit tools, allow-list destinations and require approval for risky actions.", track: "aisecops" },
  { term: "Guardrail", cat: "AI security", def: "A check around an AI model that filters what goes in or comes out, such as blocking known attacks or removing personal data.", track: "aisecops" },
  { term: "Evaluation (eval)", cat: "AI security", def: "A repeatable test suite for an AI system — for example a set of injection attempts — run before each release, like unit tests for behaviour.", track: "aisecops" },
  { term: "Hallucination", cat: "AI security", def: "When a model states something false with confidence. Answers that matter should be checked against trusted sources.", track: "genai" },
  { term: "Training data poisoning", cat: "AI security", def: "Slipping crafted examples into the data a model learns from, to plant a hidden behaviour or bias.", track: "aisecops" },
  { term: "Model supply chain", cat: "AI security", def: "Everything a model comes from: weights, datasets, adapters, libraries. Verify hashes or signatures and prefer safe formats like safetensors.", track: "aisecops" },
  { term: "NIST AI RMF", cat: "AI security", def: "A framework from the US National Institute of Standards and Technology for managing AI risk, built around four functions: Govern, Map, Measure, Manage.", track: "aisecops" },
];
