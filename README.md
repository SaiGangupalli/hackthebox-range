# H@ck1h3B0x Range

A hands-on, **defensive-security** training hub for the VICS Security Conclave 2026
H@ck1h3B0x CTF. Covers the nine CTF tracks, the OWASP Web Top 10 and the OWASP LLM
Top 10, with copy-to-clipboard cheatsheets and six lab tools that run entirely in
the browser.

> **Authorized use only.** Everything here is for CTF, your own lab, or systems you
> have written permission to test. See the in-app **Rules of engagement** page.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- Plain CSS design system (dark-first, light theme via `prefers-color-scheme` / toggle)
- No database and no network calls — all lab tools are client-side. `turbopack.root`
  is pinned in `next.config.ts` because a stray `~/package.json` otherwise confuses
  Next's workspace-root detection.

## Run it

```bash
npm install
npm run dev     # http://localhost:3000  (Turbopack)
npm run build   # production build
npm start       # serve the production build
```

## Where things live

```
src/
  app/                 routes: / /ethics /tracks/[slug] /owasp /llm /tools /resources
  components/          Shell (chrome), TrackView, OwaspList, Tools, Copyable, icons
  data/                tracks.ts, owasp.ts, llm.ts, resources.ts, nav.ts  ← edit content here
  lib/                 cryptoTools.ts (pure helpers), progress.ts (localStorage), toast.ts
```

Track progress ("studied") is kept per-browser in `localStorage` — no account needed.

## Lab tools (all in-browser, nothing leaves the device)

Encoder/decoder (Base64/Hex/URL/ROT13/binary/Morse), cipher playground
(Caesar + 25-way brute force, Vigenère, XOR), SHA hash generator (Web Crypto),
hash identifier, JWT decoder, and an LSB steganography demo.

## Extending it (future seams)

The content is data-driven, so adding a track or a cheatsheet is a `data/*.ts` edit.
If you later want accounts, a scoreboard, or saved writeups, the intended path is the
house stack — **Auth.js + Prisma + Neon**. Note the shared Neon DB rule: use an
`hhb_` table prefix and apply schema changes additively with
`prisma migrate diff` + `db execute`, never `prisma db push`.
