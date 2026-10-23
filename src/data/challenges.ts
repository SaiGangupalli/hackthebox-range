// Server-only challenge data. Flags are stored as SHA-256 hashes so the answers
// never ship to the browser; submissions are checked server-side in /api/submit.
// Every flag is solvable with the Range's own in-browser Lab tools.
export type Challenge = {
  id: string;
  track: string;
  title: string;
  points: number;
  prompt: string;
  hint: string;
  flagHash: string; // sha256(flag)
};

export const FLAG_FORMAT = "HHB{...}";

export const challenges: Challenge[] = [
  {
    id: "intro-01", track: "Warm-up", title: "Range check", points: 10,
    prompt: "Every range starts with a free flag. Submit it exactly as shown: HHB{r3ady_s3t_h4ck}",
    hint: "No tools needed — just paste it.",
    flagHash: "489a63ae7dbda7f0a1b8e2bad488e4f29cbe782873de1aaed729529f95240087",
  },
  {
    id: "crypto-b64", track: "Cryptography", title: "Not so secret", points: 20,
    prompt: "Decode this and submit the result:\n\nSEhCe2Jhc2U2NF9pc19ub3Rfc2VjcmV0fQ==",
    hint: "Tools → Encoder → Base64 decode.",
    flagHash: "aac168c9bdd01ed091a965ca5e105f8d8c2e8bc6283dc18ab3bd6cbe37d21bc0",
  },
  {
    id: "crypto-rot13", track: "Cryptography", title: "A classic shift", points: 20,
    prompt: "Rotate it back and submit:\n\nUUO{ebg13_vf_n_pynffvp}",
    hint: "Tools → Encoder → ROT13 (it's its own inverse).",
    flagHash: "a762b983c6a69c5e896aa8bc609ca11172a0a68d65a85ed527b178413475168a",
  },
  {
    id: "crypto-hex", track: "Cryptography", title: "Just bytes", points: 20,
    prompt: "These hex bytes spell a flag. Decode and submit:\n\n48 48 42 7b 68 65 78 5f 6d 65 5f 75 70 7d",
    hint: "Tools → Encoder → Hex decode.",
    flagHash: "a3e1a74961f036184a30dec47fecff0116489d9dd923cb7d4299c2ab1e30021f",
  },
  {
    id: "crypto-morse", track: "Cryptography", title: "Dots and dashes", points: 20,
    prompt: "Decode this Morse, lowercase the word, and wrap it: HHB{<word>}\n\n... - . --. ---",
    hint: "Tools → Encoder → Morse decode. The decoded word is a track on this site.",
    flagHash: "fe904bf1e425b98ad65bb674ab8f1ab4baf07ea4ff995c386aad9f13b827d362",
  },
  {
    id: "web-jwt", track: "Web & Mobile", title: "Tokens aren't vaults", points: 25,
    prompt: "Decode this token's payload and read the flag field:\n\neyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiY3RmLXBsYXllciIsImZsYWciOiJISEJ7and0c19hcmVudF9lbmNyeXB0ZWR9IiwiaWF0IjoxNzAwMDAwMDAwfQ.c2lnbmF0dXJl",
    hint: "Tools → JWT decoder. A JWT payload is only Base64url — not encrypted.",
    flagHash: "a79e0166eff3fdacc5cec65a87aa16ef70b9b2884d7e4de0e44477ef98fe9b0e",
  },
  {
    id: "crypto-hashid", track: "Cryptography", title: "Know your digest", points: 15,
    prompt: "Which SHA-2 variant produces a 128-hex-character digest? Submit as HHB{algorithm_lowercase}.",
    hint: "Tools → Hash identifier: paste a 128-hex string to confirm.",
    flagHash: "ac4af342a9dc950287545f428b0ec5e54c82d4db7af05160e23bbacf60b6e861",
  },
];

export const totalPoints = challenges.reduce((s, c) => s + c.points, 0);
