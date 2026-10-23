// Scenario for the packet-capture lab (src/components/labs/PacketLab.tsx):
// read a small recorded capture with Wireshark-style display filters. Defensive
// traffic analysis — spot a cleartext login, a port scan, and odd DNS.

import type { Packet } from "@/lib/sim/packets";
import type { Task } from "./types";

export type PacketLab = {
  id: string;
  title: string;
  intro: string;
  packets: Packet[];
  starters: string[];
  tasks: Task[];
};

const CLIENT = "10.0.0.8";
const SERVER = "93.184.216.34";
const SCANNER = "203.0.113.9";

const pkts: Packet[] = [];
let t = 0;
// Deterministic timing (no Math.random) so server and client renders match.
const add = (p: Omit<Packet, "t">) => { pkts.push({ ...p, t: Math.round(t * 1000) / 1000 }); t += 0.08 + (pkts.length % 5) * 0.011; };

// 1) DNS lookup for the shop, then the page load over HTTP (cleartext login).
add({ src: CLIENT, dst: "10.0.0.1", proto: "DNS", sport: 51515, dport: 53, len: 74, info: "Standard query A shop.example", dns: { qry: "shop.example", type: "A" } });
add({ src: "10.0.0.1", dst: CLIENT, proto: "DNS", sport: 53, dport: 51515, len: 90, info: "Standard query response A 93.184.216.34", dns: { qry: "shop.example", type: "A", answer: SERVER, response: true } });
add({ src: CLIENT, dst: SERVER, proto: "TCP", sport: 50010, dport: 80, len: 60, info: "50010 → 80 [SYN]", flags: "SYN" });
add({ src: SERVER, dst: CLIENT, proto: "TCP", sport: 80, dport: 50010, len: 60, info: "80 → 50010 [SYN, ACK]", flags: "SYN,ACK" });
add({ src: CLIENT, dst: SERVER, proto: "HTTP", sport: 50010, dport: 80, len: 230, info: "GET /login HTTP/1.1", flags: "PSH,ACK", http: { method: "GET", uri: "/login", host: "shop.example" } });
add({ src: SERVER, dst: CLIENT, proto: "HTTP", sport: 80, dport: 50010, len: 520, info: "HTTP/1.1 200 OK (text/html)", flags: "PSH,ACK", http: { code: 200, host: "shop.example" } });
add({
  src: CLIENT, dst: SERVER, proto: "HTTP", sport: 50010, dport: 80, len: 388, info: "POST /login HTTP/1.1 (application/x-www-form-urlencoded)",
  flags: "PSH,ACK", http: { method: "POST", uri: "/login", host: "shop.example" },
  payload: "username=jordan&password=Hunter2!&remember=1",
});
add({ src: SERVER, dst: CLIENT, proto: "HTTP", sport: 80, dport: 50010, len: 300, info: "HTTP/1.1 302 Found → /dashboard", flags: "PSH,ACK", http: { code: 302, host: "shop.example" } });

// 2) A port scan from an outside host: many SYNs to different ports, no data.
for (const port of [21, 22, 23, 25, 80, 110, 139, 443, 445, 3306, 3389, 8080]) {
  add({ src: SCANNER, dst: CLIENT, proto: "TCP", sport: 44000, dport: port, len: 58, info: `44000 → ${port} [SYN]`, flags: "SYN" });
}
add({ src: CLIENT, dst: SCANNER, proto: "TCP", sport: 22, dport: 44000, len: 58, info: "22 → 44000 [SYN, ACK]", flags: "SYN,ACK" });
add({ src: CLIENT, dst: SCANNER, proto: "TCP", sport: 445, dport: 44000, len: 58, info: "445 → 44000 [RST, ACK]", flags: "RST,ACK" });

// 3) Odd DNS: a workstation makes repeated lookups to long sub-domains of one
//    base domain — the shape of DNS tunnelling / exfiltration.
const WS = "10.0.0.23";
for (const chunk of ["a1b2c3d4", "e5f6a7b8", "c9d0e1f2", "a3b4c5d6", "e7f8a9b0"]) {
  add({ src: WS, dst: "10.0.0.1", proto: "DNS", sport: 52000, dport: 53, len: 96, info: `Standard query TXT ${chunk}.tunnel.badguy.example`, dns: { qry: `${chunk}.tunnel.badguy.example`, type: "TXT" } });
}
// a little ordinary TLS browsing for contrast
add({ src: CLIENT, dst: "140.82.112.3", proto: "TLS", sport: 50080, dport: 443, len: 571, info: "Client Hello (SNI=github.com)", flags: "PSH,ACK", tls: { sni: "github.com" } });

export const packetLabs: Record<string, PacketLab> = {
  network: {
    id: "net-capture",
    title: "Lab · Read the capture",
    intro:
      "A short capture from a small network. Use display filters to cut it down to what matters. Syntax: field == value, joined with && / ||, ! to negate — e.g. http.request.method == \"POST\". Click a packet to see its bytes. Press Enter to apply a filter.",
    packets: pkts,
    starters: [
      'http.request.method == "POST"',
      "tcp.flags.syn == 1 && tcp.flags.ack == 0",
      "dns",
      "dns.qry.name contains tunnel",
    ],
    tasks: [
      {
        ask: "Filter to the HTTP POST and read its body. What username was submitted over cleartext HTTP?",
        placeholder: "a username",
        hint: 'http.request.method == "POST" — click the matching packet and read the form body in the detail pane.',
        solution: "jordan — sent as username=jordan over plain HTTP, so anyone on the path can read it. The fix is HTTPS.",
        check: (a) => a.trim().toLowerCase() === "jordan",
      },
      {
        ask: "One external host is port-scanning the client (lots of bare SYNs). What is its source IP?",
        placeholder: "an IP",
        hint: "tcp.flags.syn == 1 && tcp.flags.ack == 0 isolates connection attempts; one source hits many ports.",
        solution: "203.0.113.9 — a single source sending SYNs to a dozen ports with no completed handshakes = a scan.",
        check: (a) => a.includes("203.0.113.9"),
      },
      {
        ask: "A workstation is making suspicious DNS lookups. What base domain are the odd queries going to?",
        placeholder: "a domain",
        hint: "Start with dns, then narrow: dns.qry.name contains tunnel. Long random sub-domains of one base domain is the DNS-tunnelling shape.",
        solution: "tunnel.badguy.example — repeated TXT lookups to random sub-domains of one base domain is classic DNS exfiltration.",
        check: (a) => a.trim().toLowerCase().includes("badguy.example"),
      },
    ],
  },
};
