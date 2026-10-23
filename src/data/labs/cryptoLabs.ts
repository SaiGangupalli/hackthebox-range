// Scenario for the crypto decoding lab (src/components/labs/CryptoLab.tsx).
// A chaining decoder: apply one operation, then another, peeling layers until a
// flag appears. Teaches the core skill — recognise the encoding, then reverse
// it — with no key needed (these are encodings, not encryption).

import type { Task } from "./types";

export type CryptoLab = {
  id: string;
  title: string;
  intro: string;
  samples: { label: string; value: string }[];
  tasks: Task[];
};

const has = (want: string) => (a: string) => a.trim().toLowerCase().replace(/\s+/g, "") === want.toLowerCase().replace(/\s+/g, "");

export const cryptoLabs: Record<string, CryptoLab> = {
  crypto: {
    id: "crypto-decode",
    title: "Lab · Peel the layers",
    intro:
      "Each string below is a flag hidden under one or more reversible encodings — not encryption, so no key is needed, just the right operation. Paste a string into the decoder, pick an operation, and Apply. If the result still looks encoded, apply another. Submit each flag.",
    samples: [
      { label: "sample A (base64)", value: "SEhCe2I2NF9kZWNvZGVzfQ==" },
      { label: "sample B (ROT13)", value: "UUO{ebg_naq_ebyy}" },
      { label: "sample C (two layers)", value: "NDggNDggNDIgN2IgNzQgNzcgNmYgNWYgNmMgNjEgNzkgNjUgNzIgNzMgN2Q=" },
      { label: "sample D (binary)", value: "01001000 01001000 01000010 01111011 01100010 01101001 01110100 01110011 01111101" },
    ],
    tasks: [
      {
        ask: "Sample A is Base64 (capitals, digits, `=` padding). Decode it — what flag?",
        placeholder: "HHB{…}",
        hint: "Paste sample A, choose “Base64 → text”, Apply. One layer is enough.",
        solution: "HHB{b64_decodes} — Base64 is an encoding, so it reverses with no key.",
        check: has("HHB{b64_decodes}"),
      },
      {
        ask: "Sample B looks like a flag with every letter shifted. Undo the shift.",
        placeholder: "HHB{…}",
        hint: "`UUO{…}` is `HHB{…}` rotated. Choose ROT13 — it is its own inverse, so applying it once decodes it.",
        solution: "HHB{rot_and_roll} — ROT13 undoes ROT13.",
        check: has("HHB{rot_and_roll}"),
      },
      {
        ask: "Sample C is Base64, but decoding once gives hex, not text. Peel both layers.",
        placeholder: "HHB{…}",
        hint: "Apply “Base64 → text” first; you’ll get space-separated hex bytes. Then apply “Hex → text” to that result.",
        solution: "HHB{two_layers} — Base64 wrapped a hex-encoded flag; two decodes in sequence reveal it.",
        check: has("HHB{two_layers}"),
      },
      {
        ask: "Sample D is groups of eight 1s and 0s. What does the binary spell?",
        placeholder: "HHB{…}",
        hint: "Eight bits per group = one byte each. Choose “Binary → text”.",
        solution: "HHB{bits} — each 8-bit group is one ASCII character.",
        check: has("HHB{bits}"),
      },
    ],
  },
};
