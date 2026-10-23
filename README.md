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
npm run dev     # http://localhost:3003  (Turbopack)
npm run build   # production build
npm start       # serve the production build on :3003
```

## Where things live

```text
src/
  app/                 routes: / /ethics /tracks/[slug] /owasp /llm /tools
                               /resources /challenges /scoreboard /login /register
                               api/auth/[...nextauth] api/register api/submit
  components/          Shell (chrome), TrackView, OwaspList, Tools, Copyable,
                       SubmitForm, Providers, icons
  data/                tracks.ts, owasp.ts, llm.ts, resources.ts, nav.ts,
                       challenges.ts  ← edit content here
  lib/                 cryptoTools.ts, progress.ts, toast.ts, db.ts (Prisma),
                       password.ts (scrypt)
  auth.ts              Auth.js v5 config (Credentials provider)
prisma/schema.prisma   hhb_user, hhb_solve  (hhb_-prefixed)
```

Track progress ("studied") is kept per-browser in `localStorage` — no account needed.

## Lab tools (all in-browser, nothing leaves the device)

Encoder/decoder (Base64/Hex/URL/ROT13/binary/Morse), cipher playground
(Caesar + 25-way brute force, Vigenère, XOR), SHA hash generator (Web Crypto),
hash identifier, JWT decoder, and an LSB steganography demo.

## Challenges & scoreboard (Neon)

The app ships a CTF mode — register a handle, solve the `/challenges` (all solvable
with the in-browser Lab tools), submit flags, and climb `/scoreboard`. Flags are
stored as SHA-256 hashes and checked server-side, so answers never reach the browser.

**Stack:** Auth.js v5 (Credentials + JWT sessions, scrypt password hashing — no OAuth
provider to provision) and Prisma against the shared Neon DB. Two tables, both
`hhb_`-prefixed: `hhb_user`, `hhb_solve`.

### One-time setup

1. Put the real connection string in `.env.local` (replace `PASSWORD`). `AUTH_SECRET`
   is already generated there. Both are git-ignored.
2. Apply the **additive** migration (creates only the two `hhb_` tables — never drops
   anything, per the shared-DB rule):

   ```bash
   npm run db:migrate
   # = prisma migrate diff --from-empty --to-schema-datamodel  (generates prisma/init.sql)
   #   then prisma db execute --file prisma/init.sql
   ```

   Review `prisma/init.sql` first if you like — it contains only `CREATE TABLE hhb_*`.
3. `npm run dev`, open `/register`, and play.

> **Never run `prisma db push` on this database** — it would offer to drop other apps'
> tables. Evolve the schema with `migrate diff` + `db execute` and strip any `DROP` of
> tables outside the `hhb_` prefix before executing.

Without a reachable DB the scoreboard/registration degrade gracefully (friendly
"connect the database" states), so the rest of the Range works offline.

## Extending it further

Content is data-driven — add a track, cheatsheet, or challenge by editing `src/data/*.ts`
(challenges live in `src/data/challenges.ts`; store `sha256(flag)`, never the flag).
Natural next steps: per-challenge solve timestamps on the board, writeups, or GitHub OAuth
alongside the credentials provider.
