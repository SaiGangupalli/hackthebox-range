// Pure, dependency-free helpers for the lab tools. Everything runs client-side.

const te = new TextEncoder();
const td = new TextDecoder();

const MORSE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....",
  I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.",
  Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..", "0": "-----", "1": ".----", "2": "..---", "3": "...--",
  "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
};
const MORSE_R: Record<string, string> = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

export function b64encode(s: string): string {
  let bin = "";
  te.encode(s).forEach((x) => (bin += String.fromCharCode(x)));
  return btoa(bin);
}
export function b64decode(s: string): string {
  const bin = atob(s.trim());
  return td.decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
export function hexEncode(s: string): string {
  return [...te.encode(s)].map((b) => b.toString(16).padStart(2, "0")).join(" ");
}
export function hexDecode(s: string): string {
  const h = s.replace(/[^0-9a-fA-F]/g, "");
  const a: number[] = [];
  for (let i = 0; i < h.length; i += 2) a.push(parseInt(h.substr(i, 2), 16));
  return td.decode(Uint8Array.from(a));
}
export function rot13(s: string): string {
  return s.replace(/[a-z]/gi, (c) => {
    const b = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - b + 13) % 26) + b);
  });
}
export function binEncode(s: string): string {
  return [...te.encode(s)].map((b) => b.toString(2).padStart(8, "0")).join(" ");
}
export function binDecode(s: string): string {
  const bits = s.replace(/[^01]/g, "");
  const a: number[] = [];
  for (let i = 0; i < bits.length; i += 8) a.push(parseInt(bits.substr(i, 8), 2));
  return td.decode(Uint8Array.from(a.filter((x) => !isNaN(x))));
}
export function morseEncode(s: string): string {
  return s.toUpperCase().split("").map((c) => (c === " " ? "/" : MORSE[c] || "")).join(" ").trim();
}
export function morseDecode(s: string): string {
  return s.trim().split(" ").map((t) => (t === "/" ? " " : MORSE_R[t] || "")).join("");
}
export function reverse(s: string): string {
  return [...s].reverse().join("");
}

// Atbash: replace each letter with its mirror (A↔Z, B↔Y…). No key, and its own
// inverse — encoding and decoding are the same operation. A giveaway in CTFs is
// text where common words become fixed patterns (e.g. "SUBSTITUTION" → "HFYHGRGFGRLM").
export function atbash(s: string): string {
  return s.replace(/[a-z]/gi, (c) => {
    const b = c <= "Z" ? 65 : 97;
    return String.fromCharCode(b + 25 - (c.charCodeAt(0) - b));
  });
}

export function caesar(s: string, n: number): string {
  return s.replace(/[a-z]/gi, (c) => {
    const b = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - b + n) % 26) + b);
  });
}
export function vigenere(s: string, key: string, dec: boolean): string {
  key = key.replace(/[^a-z]/gi, "").toUpperCase();
  if (!key) return s;
  let j = 0;
  return s.replace(/[a-z]/gi, (c) => {
    const b = c <= "Z" ? 65 : 97;
    const k = key.charCodeAt(j % key.length) - 65;
    j++;
    const sh = dec ? 26 - k : k;
    return String.fromCharCode(((c.charCodeAt(0) - b + sh) % 26) + b);
  });
}
export function xorToHex(s: string, key: string): string {
  const kb = te.encode(key), sb = te.encode(s);
  if (!kb.length) return "";
  return [...sb].map((b, i) => (b ^ kb[i % kb.length]).toString(16).padStart(2, "0")).join("");
}
export function xorFromHex(hex: string, key: string): string {
  const kb = te.encode(key);
  if (!kb.length) return "";
  const h = hex.replace(/[^0-9a-fA-F]/g, "");
  const a: number[] = [];
  for (let i = 0; i < h.length; i += 2) a.push(parseInt(h.substr(i, 2), 16));
  return td.decode(Uint8Array.from(a.map((b, i) => b ^ kb[i % kb.length])));
}

export const ENCODERS: Record<string, (s: string) => string> = {
  b64e: b64encode, b64d: b64decode, hexe: hexEncode, hexd: hexDecode,
  urle: encodeURIComponent, urld: decodeURIComponent, rot13, atbash,
  bine: binEncode, bind: binDecode, morse: morseEncode, morsed: morseDecode, rev: reverse,
};

export function identifyHash(h: string): string[] {
  h = h.trim();
  const g: string[] = [];
  if (/^[a-f0-9]{32}$/i.test(h)) g.push("MD5", "NTLM", "MD4");
  if (/^[a-f0-9]{40}$/i.test(h)) g.push("SHA-1", "RIPEMD-160");
  if (/^[a-f0-9]{56}$/i.test(h)) g.push("SHA-224");
  if (/^[a-f0-9]{64}$/i.test(h)) g.push("SHA-256", "SHA3-256");
  if (/^[a-f0-9]{96}$/i.test(h)) g.push("SHA-384");
  if (/^[a-f0-9]{128}$/i.test(h)) g.push("SHA-512", "SHA3-512");
  if (/^\$2[aby]\$/.test(h)) g.push("bcrypt");
  if (/^\$1\$/.test(h)) g.push("md5crypt");
  if (/^\$6\$/.test(h)) g.push("sha512crypt");
  if (/^\$argon2/.test(h)) g.push("Argon2");
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(h) && h.length % 4 === 0 && h.length >= 8) g.push("Base64 (encoding, not a hash)");
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(h)) g.push("JWT (decode it above)");
  return g;
}

export function b64urlDecode(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return b64decode(s);
}

// ---- LSB steganography (operates on canvas ImageData) ----
export function lsbEmbed(img: ImageData, msg: string): ImageData {
  const d = img.data;
  const bytes = te.encode(msg);
  const len = bytes.length;
  const all = new Uint8Array(4 + len);
  all[0] = (len >>> 24) & 255; all[1] = (len >>> 16) & 255; all[2] = (len >>> 8) & 255; all[3] = len & 255;
  all.set(bytes, 4);
  const cap = Math.floor((d.length * 3) / 4); // RGB only, skip alpha
  if (all.length * 8 > cap) throw new Error("too big");
  let bit = 0;
  for (let i = 0; i < d.length; i++) {
    if (i % 4 === 3) continue;
    const by = all[bit >> 3];
    if (by === undefined) break;
    const bv = (by >> (7 - (bit & 7))) & 1;
    d[i] = (d[i] & 0xfe) | bv;
    bit++;
  }
  return img;
}
export function lsbExtract(img: ImageData): string | null {
  const d = img.data;
  const slots: number[] = [];
  for (let i = 0; i < d.length; i++) {
    if (i % 4 === 3) continue;
    slots.push(d[i] & 1);
  }
  let len = 0;
  for (let k = 0; k < 32; k++) len = len * 2 + slots[k];
  if (len <= 0 || len > (slots.length - 32) / 8) return null;
  const bytes = new Uint8Array(len);
  for (let bi = 0; bi < len; bi++) {
    let v = 0;
    for (let k = 0; k < 8; k++) v = (v << 1) | slots[32 + bi * 8 + k];
    bytes[bi] = v;
  }
  try { return td.decode(bytes); } catch { return null; }
}
