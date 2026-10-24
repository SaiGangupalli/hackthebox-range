// `start` marks platforms that suit complete beginners.
export type ResourceGroup = { g: string; items: { n: string; u: string; d: string; start?: boolean }[] };

export const resources: ResourceGroup[] = [
  { g: "Web & app", items: [
    { n: "PortSwigger Web Security Academy", u: "https://portswigger.net/web-security", d: "Free, authoritative web-security labs.", start: true },
    { n: "OWASP Juice Shop", u: "https://owasp.org/www-project-juice-shop/", d: "Vulnerable app that maps to the Top 10." },
    { n: "OWASP Cheat Sheet Series", u: "https://cheatsheetseries.owasp.org", d: "Concise defensive how-tos per topic." },
  ]},
  { g: "All-round CTF", items: [
    { n: "picoCTF", u: "https://picoctf.org", d: "Beginner-friendly, always-on challenges.", start: true },
    { n: "TryHackMe", u: "https://tryhackme.com", d: "Guided learning paths, in-browser.", start: true },
    { n: "HackTheBox", u: "https://www.hackthebox.com", d: "Boxes, Sherlocks (DFIR) & Academy." },
    { n: "CTFtime", u: "https://ctftime.org", d: "Calendar of live competitions & writeups." },
  ]},
  { g: "By discipline", items: [
    { n: "OverTheWire", u: "https://overthewire.org", d: "Linux/shell wargames (start: Bandit).", start: true },
    { n: "CryptoHack", u: "https://cryptohack.org", d: "Modern cryptography puzzles." },
    { n: "malware-traffic-analysis.net", u: "https://www.malware-traffic-analysis.net", d: "Packet-capture investigations." },
    { n: "Splunk BOTS", u: "https://bots.splunk.com", d: "Blue-team SIEM datasets." },
    { n: "Lakera Gandalf", u: "https://gandalf.lakera.ai", d: "Prompt-injection practice." },
  ]},
  { g: "Reference", items: [
    { n: "GTFOBins", u: "https://gtfobins.github.io", d: "Unix binaries abused for privesc (and to harden)." },
    { n: "LOLBAS", u: "https://lolbas-project.github.io", d: "Living-off-the-land Windows binaries." },
    { n: "HackTricks", u: "https://book.hacktricks.xyz", d: "Broad methodology reference." },
    { n: "OWASP LLM Top 10", u: "https://genai.owasp.org", d: "The GenAI security standard." },
  ]},
];
