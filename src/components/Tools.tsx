"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import { Copyable } from "./Copyable";
import {
  ENCODERS, caesar, vigenere, xorToHex, xorFromHex,
  identifyHash, b64urlDecode, lsbEmbed, lsbExtract,
} from "@/lib/cryptoTools";

const ENC_OPTS: [string, string][] = [
  ["b64e", "Base64 encode"], ["b64d", "Base64 decode"],
  ["hexe", "Hex encode"], ["hexd", "Hex decode"],
  ["urle", "URL encode"], ["urld", "URL decode"], ["rot13", "ROT13"], ["atbash", "Atbash"],
  ["bine", "Binary encode"], ["bind", "Binary decode"],
  ["morse", "Morse encode"], ["morsed", "Morse decode"], ["rev", "Reverse"],
];

function Encoder() {
  const [input, setInput] = useState("H@ck1h3B0x{try_me}");
  const [op, setOp] = useState("b64e");
  const out = useMemo(() => {
    try { return ENCODERS[op](input) || "(empty)"; }
    catch { return "⚠ could not " + op + " that input"; }
  }, [input, op]);
  return (
    <div className="tool" id="tool-encoder">
      <div className="tool-h"><Icon name="crypto" /><h2>Encoder / decoder</h2></div>
      <div className="tool-sub">Base64, Hex, URL, ROT13, Atbash, binary, Morse — the everyday CTF encodings.</div>
      <div className="field">
        <label htmlFor="encIn">input</label>
        <textarea id="encIn" value={input} onChange={(e) => setInput(e.target.value)} />
      </div>
      <div className="ctrl">
        <select className="grow" value={op} onChange={(e) => setOp(e.target.value)} aria-label="operation">
          {ENC_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="field">
        <label>output <span style={{ color: "var(--faint)" }}>(click to copy)</span></label>
        <Copyable text={out} className="out" />
      </div>
    </div>
  );
}

function Cipher() {
  const [input, setInput] = useState("The quick brown fox");
  const [shift, setShift] = useState(3);
  const [vigKey, setVigKey] = useState("KEY");
  const [xorKey, setXorKey] = useState("s3cr3t");

  const caesarOut = caesar(input, shift);
  const brute = useMemo(() => Array.from({ length: 26 }, (_, i) => caesar(input, i).slice(0, 60)), [input]);
  const vigOut = `enc: ${vigenere(input, vigKey, false)}\ndec: ${vigenere(input, vigKey, true)}`;
  const xorHex = xorToHex(input, xorKey || " ");
  let xorBack = "(n/a)";
  try { xorBack = xorFromHex(xorHex, xorKey || " "); } catch { /* ignore */ }

  return (
    <div className="tool" id="tool-cipher">
      <div className="tool-h"><Icon name="zap" /><h2>Cipher playground</h2></div>
      <div className="tool-sub">Caesar with a live shift + 25-way brute force, Vigenère, and repeating-key XOR.</div>
      <div className="field">
        <label htmlFor="cipIn">text</label>
        <textarea id="cipIn" value={input} onChange={(e) => setInput(e.target.value)} />
      </div>
      <div className="slider-row">
        <label htmlFor="cipShift">Caesar shift</label>
        <input id="cipShift" type="range" min={0} max={25} value={shift} onChange={(e) => setShift(+e.target.value)} />
        <span className="shift-val">{shift}</span>
      </div>
      <div className="field"><label>caesar output</label><Copyable text={caesarOut || "…"} className="out" /></div>
      <div className="field">
        <label>brute force (all 25 shifts)</label>
        <div className="brute">
          {brute.map((line, i) => <div key={i}><b>ROT{i}</b>{line}</div>)}
        </div>
      </div>
      <div className="two">
        <div className="field"><label htmlFor="vigKey">Vigenère key</label>
          <input id="vigKey" type="text" value={vigKey} onChange={(e) => setVigKey(e.target.value)} /></div>
        <div className="field"><label htmlFor="xorKey">XOR key</label>
          <input id="xorKey" type="text" value={xorKey} onChange={(e) => setXorKey(e.target.value)} /></div>
      </div>
      <div className="two">
        <div className="field"><label>Vigenère (enc / dec)</label>
          <div className="out" style={{ fontSize: 12 }}>{vigOut}</div></div>
        <div className="field"><label>XOR → hex / hex → text</label>
          <div className="out" style={{ fontSize: 12 }}>{`hex: ${xorHex}\ntext: ${xorBack}`}</div></div>
      </div>
    </div>
  );
}

function Hashing() {
  const [input, setInput] = useState("password123");
  const [hashes, setHashes] = useState<[string, string][]>([]);
  useEffect(() => {
    let cancelled = false;
    const algos: [string, string][] = [["SHA-1", "SHA-1"], ["SHA-256", "SHA-256"], ["SHA-384", "SHA-384"], ["SHA-512", "SHA-512"]];
    const data = new TextEncoder().encode(input);
    (async () => {
      const results: [string, string][] = [];
      for (const [label, a] of algos) {
        try {
          const buf = await crypto.subtle.digest(a, data);
          const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
          results.push([label, hex]);
        } catch { results.push([label, "unavailable"]); }
      }
      if (!cancelled) setHashes(results);
    })();
    return () => { cancelled = true; };
  }, [input]);
  return (
    <div className="tool" id="tool-hash">
      <div className="tool-h"><Icon name="shield" /><h2>Hash generator</h2></div>
      <div className="tool-sub">SHA-1 / 256 / 384 / 512 via the browser&apos;s Web Crypto API.</div>
      <div className="field">
        <label htmlFor="hashIn">input</label>
        <textarea id="hashIn" style={{ minHeight: 52 }} value={input} onChange={(e) => setInput(e.target.value)} />
      </div>
      <div>
        {hashes.map(([label, hex]) => (
          <div className="hashline" key={label}>
            <span className="ht">{label}</span>
            <Copyable text={hex} className="hv" />
          </div>
        ))}
      </div>
    </div>
  );
}

function HashId() {
  const [input, setInput] = useState("5f4dcc3b5aa765d61d8327deb882cf99");
  const guesses = identifyHash(input);
  return (
    <div className="tool" id="tool-hashid">
      <div className="tool-h"><Icon name="osint" /><h2>Hash identifier</h2></div>
      <div className="tool-sub">Guess a hash / token type from its shape.</div>
      <div className="field">
        <label htmlFor="hidIn">hash or token</label>
        <input id="hidIn" type="text" value={input} onChange={(e) => setInput(e.target.value)} />
      </div>
      <div className="field">
        <label>likely type(s)</label>
        <div className={`out${guesses.length ? "" : " empty"}`}>
          {guesses.length ? guesses.join("  ·  ") : "no confident match — check length & charset"}
        </div>
      </div>
    </div>
  );
}

function Jwt() {
  const [input, setInput] = useState(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiYWRtaW4iLCJyb2xlIjoiZ3Vlc3QiLCJpYXQiOjE3MDAwMDAwMDB9.c2lnbmF0dXJl"
  );
  const { head, body } = useMemo(() => {
    const parts = input.trim().split(".");
    if (parts.length < 2) return { head: "⚠ not a JWT", body: "" };
    let head = "⚠ bad header", body = "⚠ bad payload";
    try { head = JSON.stringify(JSON.parse(b64urlDecode(parts[0])), null, 2); } catch { /* keep */ }
    try { body = JSON.stringify(JSON.parse(b64urlDecode(parts[1])), null, 2); } catch { /* keep */ }
    return { head, body };
  }, [input]);
  return (
    <div className="tool" id="tool-jwt">
      <div className="tool-h"><Icon name="webmobile" /><h2>JWT decoder</h2></div>
      <div className="tool-sub">Decode header &amp; payload. Signature is <b>not</b> verified — never trust an unverified token.</div>
      <div className="field">
        <label htmlFor="jwtIn">token</label>
        <textarea id="jwtIn" style={{ minHeight: 60 }} value={input} onChange={(e) => setInput(e.target.value)} />
      </div>
      <div className="two">
        <div className="field"><label>header</label><div className="out" style={{ fontSize: 12 }}>{head}</div></div>
        <div className="field"><label>payload</label><div className="out" style={{ fontSize: 12 }}>{body}</div></div>
      </div>
    </div>
  );
}

function Stego() {
  const coverRef = useRef<HTMLCanvasElement>(null);
  const stegoRef = useRef<HTMLCanvasElement>(null);
  const [msg, setMsg] = useState("flag{hidden_in_pixels}");
  const [out, setOut] = useState<{ ok: boolean; text: string }>({ ok: true, text: "…" });

  function drawDefaultCover() {
    const c = coverRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, 120, 120);
    g.addColorStop(0, "#ff3b47"); g.addColorStop(0.5, "#5ee0c8"); g.addColorStop(1, "#53b9f0");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 120, 120);
    ctx.fillStyle = "rgba(255,255,255,.12)";
    for (let i = 0; i < 60; i++) ctx.fillRect(Math.random() * 120, Math.random() * 120, 2, 2);
  }

  function embed() {
    const cover = coverRef.current, stego = stegoRef.current;
    if (!cover || !stego) return;
    const cctx = cover.getContext("2d"), sctx = stego.getContext("2d");
    if (!cctx || !sctx) return;
    try {
      const embedded = lsbEmbed(cctx.getImageData(0, 0, cover.width, cover.height), msg || " ");
      stego.width = cover.width; stego.height = cover.height;
      sctx.putImageData(embedded, 0, 0);
      const got = lsbExtract(sctx.getImageData(0, 0, stego.width, stego.height));
      setOut({ ok: true, text: "✓ recovered: " + (got || "(failed)") });
    } catch { setOut({ ok: false, text: "✗ message too large for this image" }); }
  }

  function reveal(file: File) {
    const stego = stegoRef.current; if (!stego) return;
    const sctx = stego.getContext("2d"); if (!sctx) return;
    const img = new Image();
    img.onload = () => {
      stego.width = Math.min(img.width, 480);
      stego.height = Math.round((stego.width * img.height) / img.width);
      sctx.drawImage(img, 0, 0, stego.width, stego.height);
      const got = lsbExtract(sctx.getImageData(0, 0, stego.width, stego.height));
      if (got && /[\x20-\x7e]/.test(got)) setOut({ ok: true, text: "✓ found: " + got });
      else setOut({ ok: false, text: "no LSB text message detected (most images carry none)" });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => setOut({ ok: false, text: "could not read that image" });
    img.src = URL.createObjectURL(file);
  }

  useEffect(() => { drawDefaultCover(); embed(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="tool" id="tool-stego">
      <div className="tool-h"><Icon name="stego" /><h2>LSB steganography</h2></div>
      <div className="tool-sub">Hide a message in the least-significant bits of an image, then extract it back — a self-contained demo of how stego works.</div>
      <div className="field">
        <label htmlFor="stIn">secret message</label>
        <input id="stIn" type="text" value={msg} onChange={(e) => setMsg(e.target.value)} />
      </div>
      <div className="ctrl">
        <button className="btn primary" onClick={embed}><Icon name="stego" />Embed &amp; extract</button>
        <label className="btn" style={{ cursor: "pointer" }}>
          <Icon name="resources" />Reveal from image
          <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) reveal(f); }} />
        </label>
      </div>
      <div className="stego-canvas">
        <figure><figcaption>cover</figcaption><canvas ref={coverRef} width={120} height={120} /></figure>
        <figure><figcaption>stego (identical to eye)</figcaption><canvas ref={stegoRef} width={120} height={120} /></figure>
      </div>
      <div className="field">
        <label>extracted</label>
        <div className="out"><span className={out.ok ? "tag-ok" : "tag-bad"}>{out.text}</span></div>
      </div>
    </div>
  );
}

// "Which tool do I need?" — each card says when to reach for the tool.
const TOOL_INDEX: [string, string, string, string][] = [
  ["tool-encoder", "crypto", "Encoder / decoder", "Text looks scrambled but uses letters, digits, % or = signs. Try decoding it."],
  ["tool-cipher", "zap", "Cipher playground", "Letters look shifted or like nonsense words. Try Caesar, Vigenère or XOR."],
  ["tool-hash", "shield", "Hash generator", "You need the SHA fingerprint of some text, e.g. to compare with a known hash."],
  ["tool-hashid", "osint", "Hash identifier", "You found a long hex string and want to know what kind of hash it is."],
  ["tool-jwt", "webmobile", "JWT decoder", "You have a token shaped like xxx.yyy.zzz and want to read what's inside."],
  ["tool-stego", "stego", "LSB steganography", "You want to see how a message can hide inside an image's pixels."],
];

export function Tools() {
  return (
    <>
      <div className="eyebrow"><Icon name="tools" />in-browser lab · nothing leaves your device</div>
      <h1 className="view-title">Lab tools</h1>
      <p className="lede">Six safe utilities that run entirely in your browser. Great for the Crypto, Stego and Web tracks — paste a CTF string and experiment.</p>
      <h2 className="sec-h"><Icon name="osint" />Which tool do I need?</h2>
      <div className="tool-index">
        {TOOL_INDEX.map(([id, icon, name, when]) => (
          <a key={id} className="tool-card" href={`#${id}`}>
            <Icon name={icon} />
            <b>{name}</b>
            <p>{when}</p>
          </a>
        ))}
      </div>
      <Encoder />
      <Cipher />
      <Hashing />
      <HashId />
      <Jwt />
      <Stego />
      <div className="callout info">
        <Icon name="book" />
        <div>Want more? <b>CyberChef</b> chains dozens of these operations, and <b>dcode.fr</b> auto-identifies classical ciphers. Both are linked in <Link href="/resources">Resources</Link>.</div>
      </div>
    </>
  );
}
