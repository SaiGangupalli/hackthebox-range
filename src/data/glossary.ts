// Plain-English glossary of the jargon used across the Range. Each entry is
// written for someone with no background: what it is, then (optionally) an
// everyday example. Rendered at /glossary and in the cheatsheet PDF. To add a
// term, append one line in the same shape; to add a category, list it in
// GLOSSARY_CATS too.

export type Term = { term: string; cat: string; def: string; eg?: string; track?: string };

export const GLOSSARY_CATS = ["Basics", "Networking"];

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
];
