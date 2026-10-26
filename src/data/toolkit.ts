// A CTF toolkit reference: the tools used to solve each kind of challenge, with
// how to install them on Kali Linux and a usage example, plus an online version
// where one exists. Grouped by challenge type so it maps to the tracks and to
// the "where flags hide" lab. Rendered at /toolkit.
//
// Everything here is for AUTHORIZED practice only — your own labs, CTF platforms,
// or systems you have written permission to test. Most tools listed ship with
// Kali; "Pre-installed in Kali" means you can just run it.

export type TkTool = {
  n: string;     // name
  d: string;     // what it does / when to reach for it
  k?: string;    // how to get it on Kali (apt / pipx / gem / git), or "Pre-installed in Kali"
  x?: string;    // a usage example
  on?: string;   // an online version or alternative (URL)
};

export type TkGroup = { g: string; note: string; items: TkTool[] };

export const toolkit: TkGroup[] = [
  {
    g: "All-rounders & online",
    note: "Open these first — they handle a huge share of encoding, hashing and quick-decode challenges with nothing to install.",
    items: [
      { n: "CyberChef", d: "The 'cyber swiss-army knife': chain Base64, hex, XOR, ROT, Atbash, gunzip, magic-detect and 300+ operations in the browser. Try the 'Magic' op to auto-detect layers.", on: "https://gchq.github.io/CyberChef/", k: "Download a release to run offline: github.com/gchq/CyberChef/releases" },
      { n: "dCode", d: "Huge library of ciphers and puzzle solvers (Atbash, Vigenère, substitution, Morse, book ciphers) with an auto-identifier.", on: "https://www.dcode.fr/en" },
      { n: "CrackStation", d: "Free lookup of unsalted MD5/SHA hashes against a massive rainbow table — paste a hash, get the password if it's common.", on: "https://crackstation.net" },
      { n: "crt.sh", d: "Certificate-transparency search: find subdomains and forgotten hosts a target published in TLS certificates.", on: "https://crt.sh" },
    ],
  },
  {
    g: "Encoding & ciphers",
    note: "Tell encoding (no key, reversible) from encryption (needs a key), identify the scheme, then reverse it. See the Cryptography track.",
    items: [
      { n: "CyberChef / dCode", d: "First stop for Base64, hex, URL, binary, Morse, ROT13, Atbash, Vigenère and multi-layer chains.", on: "https://gchq.github.io/CyberChef/" },
      { n: "Ciphey", d: "Automated decoder: feed it unknown ciphertext and it tries encodings and classical ciphers until it finds English.", k: "pipx install ciphey", x: "ciphey -t 'SSY{zgyzhs_nriili}'" },
      { n: "openssl", d: "Decode/encode and do real crypto: base64, hex, and decrypt AES/DES when you have the key.", k: "Pre-installed in Kali", x: "echo SEhCe2Jhc2U2NH0= | openssl base64 -d" },
      { n: "xortool", d: "Recover the key length and key of repeating-key XOR ciphertext.", k: "pipx install xortool", x: "xortool -c 20 cipher.bin" },
    ],
  },
  {
    g: "Hashes & password cracking",
    note: "Identify the hash type first, then crack offline (John/hashcat) or brute a live login (hydra). The rockyou wordlist cracks most CTF passwords.",
    items: [
      { n: "hashid / hash-identifier", d: "Name the algorithm from a hash's shape before you try to crack it.", k: "Pre-installed in Kali", x: "hashid '5f4dcc3b5aa765d61d8327deb882cf99'" },
      { n: "John the Ripper", d: "Crack password hashes, and convert protected files to crackable hashes (zip2john, ssh2john, office2john, rar2john).", k: "Pre-installed in Kali (sudo apt install john)", x: "zip2john secret.zip > h.txt && john --wordlist=/usr/share/wordlists/rockyou.txt h.txt" },
      { n: "hashcat", d: "GPU-accelerated cracker; -m picks the hash mode (0 = MD5, 1000 = NTLM, 1800 = sha512crypt).", k: "Pre-installed in Kali", x: "hashcat -m 0 -a 0 hashes.txt /usr/share/wordlists/rockyou.txt" },
      { n: "hydra", d: "Brute-force a live network login — SSH, FTP, HTTP forms (authorized targets only).", k: "Pre-installed in Kali", x: "hydra -l alice -P rockyou.txt ssh://192.168.244.129" },
      { n: "rockyou.txt", d: "The default wordlist for all of the above — millions of real leaked passwords.", k: "sudo gunzip /usr/share/wordlists/rockyou.txt.gz" },
    ],
  },
  {
    g: "Steganography",
    note: "Something's hidden in an image/audio file. Work outside-in: strings & metadata, then appended data, then LSB bits, then password-protected payloads.",
    items: [
      { n: "exiftool", d: "Read (and write) metadata — author, GPS, comments — where flags often sit.", k: "Pre-installed in Kali", x: "exiftool Hideandseek.jpg" },
      { n: "binwalk", d: "Find and extract files embedded inside another file (a zip after a JPEG, etc.).", k: "Pre-installed in Kali", x: "binwalk -e suspicious.png" },
      { n: "zsteg", d: "Detect LSB steganography in PNG and BMP images.", k: "sudo gem install zsteg", x: "zsteg -a image.png" },
      { n: "steghide / stegseek", d: "Extract data hidden with steghide; stegseek brute-forces the passphrase with a wordlist.", k: "sudo apt install -y steghide stegseek", x: "stegseek image.jpg /usr/share/wordlists/rockyou.txt" },
      { n: "Aperi'Solve / StegOnline", d: "Run the whole stego pipeline (layers, bit-planes, strings, zsteg) in the browser.", on: "https://www.aperisolve.com" },
    ],
  },
  {
    g: "Forensics & file recovery",
    note: "Reconstruct what was left behind — metadata, deleted files, memory, saved credentials. This is the 'Where flags hide' lab.",
    items: [
      { n: "strings", d: "Print readable text inside any binary — flags, URLs and keys are often in the clear.", k: "Pre-installed in Kali", x: "strings -n 6 app.bin | grep -i ctf" },
      { n: "foremost / photorec", d: "Carve and recover deleted files from a disk image or raw blob by their signatures.", k: "sudo apt install -y foremost testdisk", x: "foremost -i disk.img -o recovered/" },
      { n: "Volatility 3", d: "Memory forensics: list processes, network connections and secrets from a RAM dump.", k: "pipx install volatility3", x: "vol -f memory.raw windows.pslist" },
      { n: "firefox_decrypt", d: "Decrypt saved browser logins from a Firefox profile (logins.json + key4.db).", k: "git clone https://github.com/unode/firefox_decrypt", x: "python3 firefox_decrypt.py ./profile.default" },
      { n: "oletools / unzip", d: "Office files are zips — read docProps/core.xml for author/keywords, and olevba for macros.", k: "pipx install oletools", x: "unzip -o report.docx -d doc/ && cat doc/docProps/core.xml" },
      { n: "Autopsy / Eric Zimmerman tools", d: "GUI disk forensics (Autopsy) and Windows artefact parsers ($Recycle.Bin, prefetch, registry).", on: "https://www.autopsy.com" },
    ],
  },
  {
    g: "Reversing & binaries",
    note: "Understand or edit a compiled program — ELF, Windows PE/EXE, .NET, or packed Python. Start with strings, then a disassembler.",
    items: [
      { n: "Ghidra", d: "Free NSA decompiler — turns a binary back into readable C to find the logic (and the flag check).", k: "sudo apt install -y ghidra", on: "https://dogbolt.org (online decompiler)" },
      { n: "radare2 / Cutter", d: "Disassemble, debug and patch from the terminal (r2) or a GUI (Cutter).", k: "Pre-installed in Kali", x: "r2 -A ./challenge   # then: afl, pdf @ main" },
      { n: "gdb + pwndbg", d: "Dynamic analysis: set breakpoints and watch memory as the program runs.", k: "sudo apt install -y gdb ; git clone https://github.com/pwndbg/pwndbg", x: "gdb ./challenge" },
      { n: "CFF Explorer / PE-bear", d: "Inspect and edit a Windows PE (sections, resources, strings) — the tool hinted at in the 'Windows Application' challenge.", on: "https://ntcore.com/?page_id=388" },
      { n: "dnSpy / ILSpy", d: "Decompile and debug .NET (C#) binaries back to source.", on: "https://github.com/dnSpyEx/dnSpy" },
      { n: "decompyle3 / upx", d: "Recover source from compiled Python (.pyc), and unpack UPX-packed executables.", k: "pipx install decompyle3 ; sudo apt install -y upx-ucl", x: "upx -d packed.exe" },
    ],
  },
  {
    g: "Web, APIs & mobile",
    note: "Test a running web app — proxy the traffic, find hidden content, probe inputs — or pull apart a mobile build. Authorized scope only. See the Web & Mobile and DevSecOps tracks.",
    items: [
      { n: "Burp Suite", d: "The intercepting proxy: read and modify every request, repeat and fuzz them. Community edition ships with Kali.", k: "Pre-installed in Kali", x: "burpsuite" },
      { n: "OWASP ZAP", d: "Open-source proxy + automated DAST scanner.", k: "sudo apt install -y zaproxy", x: "zaproxy" },
      { n: "ffuf / gobuster", d: "Discover hidden paths, files and vhosts by trying a wordlist.", k: "Pre-installed in Kali", x: "ffuf -w /usr/share/wordlists/dirb/common.txt -u https://app.example/FUZZ" },
      { n: "sqlmap", d: "Automate detecting and exploiting SQL injection (in authorized labs).", k: "Pre-installed in Kali", x: "sqlmap -u 'https://app.example/item?id=1' --batch" },
      { n: "nikto / nuclei", d: "Scan a web server for known issues, missing headers and exposed files; nuclei runs a huge template library.", k: "Pre-installed in Kali (nuclei: sudo apt install -y nuclei)", x: "nikto -h https://app.example" },
      { n: "curl", d: "The workhorse for reading raw responses: -i shows headers (where flags hide), and you can replay any request by hand.", k: "Pre-installed in Kali", x: "curl -i 'http://app.example/item?id=1' | grep -i flag" },
      { n: "jwt.io", d: "Decode and inspect JSON Web Tokens; check the algorithm and claims.", on: "https://jwt.io" },
      { n: "MobSF", d: "Mobile Application Security Testing — static + dynamic analysis of an APK/IPA (manifest, storage, traffic). The MAST equivalent of SAST+DAST.", k: "docker run -it -p 8000:8000 opensecurity/mobile-security-framework-mobsf", on: "https://mobsf.github.io/docs/" },
      { n: "apktool / jadx", d: "Decompile an Android APK back to smali/Java to read its code, strings and AndroidManifest.xml.", k: "sudo apt install -y apktool jadx", x: "jadx -d out/ app.apk" },
      { n: "aapt", d: "Dump an APK's permissions, components and metadata without fully decompiling it.", k: "Part of Android build-tools (sudo apt install -y aapt)", x: "aapt dump permissions app.apk" },
      { n: "frida / objection", d: "Hook and tamper with a running mobile app (bypass checks, dump secrets) — on devices you own.", k: "pipx install frida-tools objection", x: "objection -g com.example.app explore" },
    ],
  },
  {
    g: "Recon & network",
    note: "Find a host's address and which apps it's running — the first step on any box (tomjerry, boot-to-root). See the Network track lesson.",
    items: [
      { n: "ip / ifconfig", d: "Show your own address and subnet, so you know where to look.", k: "Pre-installed in Kali", x: "ip -4 a   # or: hostname -I" },
      { n: "netdiscover / arp-scan", d: "List live hosts on your local subnet by their MAC/IP.", k: "Pre-installed in Kali", x: "sudo netdiscover -r 192.168.244.0/24" },
      { n: "nmap", d: "Scan a host's ports and identify the service AND version behind each (-sV), run default checks (-sC).", k: "Pre-installed in Kali", x: "nmap -sV -sC 192.168.244.129" },
      { n: "ss / netstat", d: "On the target itself: list listening ports and the process behind each (0.0.0.0 = network-reachable).", k: "Pre-installed in Kali", x: "ss -tlnp" },
      { n: "Wireshark / tshark", d: "Open a packet capture and filter it down; tshark is the command-line version.", k: "Pre-installed in Kali", x: "tshark -r capture.pcap -Y 'http.request'" },
      { n: "whois / dig", d: "Look up who owns a domain and its DNS records (A, MX, TXT).", k: "Pre-installed in Kali", x: "dig +short example.com TXT" },
    ],
  },
  {
    g: "OSINT & footprinting",
    note: "Find what a target gives away in public — before touching anything. See the OSINT track. Collect from public sources only.",
    items: [
      { n: "theHarvester", d: "Gather emails, subdomains, hostnames and names for a domain from many public sources at once.", k: "Pre-installed in Kali", x: "theHarvester -d example.com -b all" },
      { n: "Sherlock", d: "Hunt a username across hundreds of social networks and sites.", k: "pipx install sherlock-project", x: "sherlock johndoe" },
      { n: "amass / Sublist3r", d: "Enumerate a domain's subdomains (passive and active).", k: "sudo apt install -y amass ; pipx install sublist3r", x: "amass enum -passive -d example.com" },
      { n: "exiftool (geolocation)", d: "Photo EXIF often holds GPS coordinates and the author's name — a classic OSINT lead.", k: "Pre-installed in Kali", x: "exiftool -gpslatitude -gpslongitude -author photo.jpg" },
      { n: "Shodan", d: "Search engine for internet-exposed devices and services (banners, ports, versions).", on: "https://www.shodan.io" },
      { n: "Wayback Machine / Google dorking", d: "Recover old versions of a page, and find indexed files with operators like site:, filetype:, intitle:.", on: "https://web.archive.org" },
    ],
  },
  {
    g: "Logs, SIEM & Splunk",
    note: "Turn thousands of log lines into a short answer. The Splunk challenges use SPL; off-SIEM, the shell does a lot. See the Splunk track.",
    items: [
      { n: "Splunk (Free)", d: "The SIEM behind the Splunk challenges — the Free tier indexes up to 500 MB/day on your own machine.", on: "https://www.splunk.com/en_us/download/splunk-enterprise.html" },
      { n: "SPL (Search Processing Language)", d: "Read a search left-to-right through its pipes: search terms, then stats/top/sort/table to summarise. Practise it in the Splunk track's lab.", on: "https://docs.splunk.com/Documentation/Splunk/latest/SearchReference" },
      { n: "grep / awk / sort / uniq", d: "Triage raw logs fast without a SIEM — count, group and rank.", k: "Pre-installed in Kali", x: "awk '{print $1}' access.log | sort | uniq -c | sort -nr | head" },
      { n: "jq", d: "Query and reshape JSON logs (guardrail logs, cloud trails).", k: "sudo apt install -y jq", x: "jq '.[] | select(.action==\"block\")' prompts.jsonl" },
      { n: "Sigma / sigma-cli", d: "Write a detection rule once and convert it to Splunk, Elastic or other query languages.", k: "pipx install sigma-cli", x: "sigma convert -t splunk -p splunk_windows rules/" },
    ],
  },
  {
    g: "GenAI & prompt security",
    note: "Attack and defend LLM apps — prompt injection, jailbreaks, data leaks. See the GenAI / Prompt Eng. and AISecOps tracks.",
    items: [
      { n: "Lakera Gandalf", d: "Browser game to practise prompt-injection against an LLM with increasing guardrails.", on: "https://gandalf.lakera.ai" },
      { n: "garak", d: "LLM vulnerability scanner — probes a model for prompt injection, jailbreaks, toxicity and data leakage.", k: "pipx install garak", x: "garak --model_type huggingface --model_name gpt2 --probes promptinject" },
      { n: "promptfoo", d: "Run evaluations and automated red-team tests against your prompts / LLM app, in CI.", k: "npm install -g promptfoo", x: "promptfoo redteam run" },
      { n: "PyRIT", d: "Microsoft's Python Risk Identification Toolkit for generative AI red-teaming.", on: "https://github.com/Azure/PyRIT" },
      { n: "OWASP LLM Top 10", d: "The standard for what to test on an AI app — the GenAI security checklist.", on: "https://genai.owasp.org" },
    ],
  },
  {
    g: "OS enumeration & privilege escalation",
    note: "Once you have a foothold (the boot-to-root boxes), enumerate the system and find the path to root — then harden exactly those. Authorized boxes only. See the OS track.",
    items: [
      { n: "LinPEAS / WinPEAS", d: "Automated privilege-escalation enumeration for Linux and Windows — highlights misconfigurations to abuse (and to fix).", k: "git clone https://github.com/peass-ng/PEASS-ng", x: "./linpeas.sh" },
      { n: "pspy", d: "Watch processes and cron jobs run without root — spots scheduled tasks and secrets passed on the command line.", on: "https://github.com/DominicBreuker/pspy" },
      { n: "GTFOBins / LOLBAS", d: "Which trusted Unix (GTFOBins) or Windows (LOLBAS) binaries can be abused for privesc — and which defenders should watch.", on: "https://gtfobins.github.io" },
      { n: "linux-exploit-suggester", d: "Match a kernel/OS version to likely local privilege-escalation exploits.", k: "git clone https://github.com/mzet-/linux-exploit-suggester", x: "./linux-exploit-suggester.sh" },
      { n: "enum4linux-ng", d: "Enumerate Windows/Samba hosts — shares, users, groups and policies.", k: "sudo apt install -y enum4linux-ng", x: "enum4linux-ng -A 192.168.244.129" },
    ],
  },
  {
    g: "Credential stores & DevSecOps",
    note: "Secrets hide in credential stores and repo history, not just env vars and logs. See the DevSecOps track and the Jenkins challenge.",
    items: [
      { n: "jenkins-credentials-decryptor", d: "Decrypt Jenkins credentials.xml given secrets/master.key and secrets/hudson.util.Secret.", k: "Download the release binary from github.com/hoto/jenkins-credentials-decryptor", x: "jenkins-credentials-decryptor -m master.key -s hudson.util.Secret -i credentials.xml" },
      { n: "gitleaks / trufflehog", d: "Scan a repo (history included) for committed secrets.", k: "sudo apt install -y gitleaks ; pipx install trufflehog3", x: "gitleaks detect --source ." },
      { n: "trivy", d: "Scan dependencies, images and IaC for known vulnerabilities, with the fixed version for each.", k: "sudo apt install -y trivy", x: "trivy fs ." },
    ],
  },
];
