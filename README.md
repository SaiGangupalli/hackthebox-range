# H@ck1h3B0x Range

A hands-on, **defensive-security** training hub for the VICS Security Conclave 2026
H@ck1h3B0x CTF. Thirteen guided tracks across three levels — the nine CTF tracks (Beginner and
Intermediate), plus DevOps & Cloud, DevSecOps, Advanced SecOps and AISecOps — the OWASP Web and LLM
Top 10, in-browser labs and lab tools, and certifications: the Range's own exams and a guide to
industry certifications.

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

**Setting up on a new machine (reuses the shared DB):** `./scripts/setup.sh` checks
Node, runs `npm install`, and writes `.env.local` — it prompts (hidden) for the Neon
`DATABASE_URL` and `AUTH_SECRET`, or reads them from the environment. It never runs a
migration, because the shared `hhb` schema already exists; pass `--run` to start the dev
server afterwards.

If 3003 is taken, `dev` and `start` use the next free port and print it (3002 is never used: another
local app owns it). `PORT=4000 npm run dev` starts looking from 4000; `npm run dev -- --print-port`
only prints the port. If this app is already running, the script says where instead of starting a
second copy. Sign-in works on any port (`trustHost`, no fixed `AUTH_URL`).

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
prisma/schema.prisma   hhb_user, hhb_solve  (in the `hhb` Postgres schema)
prisma/sql/            every SQL change applied to the DB, in order
scripts/db.sh          db:diff / db:apply
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
provider to provision) and Prisma against the shared Neon DB. Two tables,
`hhb_user` and `hhb_solve`, in their own `hhb` Postgres schema. `schemas = ["hhb"]` in
`schema.prisma` scopes Prisma to it, so a diff never sees (or drops) other apps' tables.

Session cookies are named `hhb.*` rather than Auth.js's default `authjs.*`: browsers
share `localhost` cookies across ports, so another Auth.js app running locally would
otherwise overwrite this one's session.

### One-time setup

1. Put the real connection string in `.env.local` (replace `PASSWORD`). `AUTH_SECRET`
   is already generated there. Both are git-ignored.
2. Bring the DB up to date by replaying `prisma/sql/*.sql` in order (on a fresh
   database: `npm run db:diff`, review, `npm run db:apply -- init`).
3. `npm run dev`, open `/register`, and play.

### Changing the schema

```bash
npm run db:diff                  # live `hhb` schema -> schema.prisma, written to prisma/pending.sql
npm run db:apply -- add_writeups # runs pending.sql, keeps it as prisma/sql/<ts>_add_writeups.sql
```

Read `pending.sql` before applying — `db:diff` warns if it contains a `DROP`. Generated
diffs can't express renames or moves (they drop and recreate), so hand-edit those into
`pending.sql` first. Commit the new `prisma/sql/` file.

> **Never run `prisma db push` or `prisma migrate dev` on this database.**

Without a reachable DB the scoreboard/registration degrade gracefully (friendly
"connect the database" states), so the rest of the Range works offline.

### AI tutor (Claude)

Signed-in players get an **AI tutor** (floating "Ask the tutor" button on every page) that knows the
page they're on, plus **Explain** on every command, **Ask for a nudge** on lab objectives, **Explain
more** after quiz answers, and **AI quizzes**. All calls run server-side
(`src/lib/ai/`) on `claude-opus-5-5` with server-side refusal fallbacks; Grok (`X_GROK_API_KEY`) is a
backup used only when a Claude request fails. Prompts are built on the server from site content — the
tutor never sees lab solutions, flags or writeups — and each player has hourly limits
(`AI_TUTOR_PER_HOUR`, `AI_QUESTIONS_PER_HOUR`). See `.env.example`.

**AI quizzes** (`/quiz` → *AI quiz*, and under every track's quiz) are written fresh each round for
the tracks, level, length (5 or 10) and optional focus the player picks, or for their weakest quizzes.
Questions mix concepts, scenarios and snippets to read (logs, command output, config). After a round,
players can re-test what they missed, step the level up or down, or get another round with no repeats.
Every question is signed by the server (`src/lib/ai/signed.ts`, keyed by `AUTH_SECRET`), so only
questions the server wrote can be sent back for the tutor to explain or for the next round to build on.
AI rounds are practice only and don't change best scores or XP.

The **command handbook** (`/commands`) explains every command in the Range in plain English — the
terminal's commands and the track labs' tools — with an example and tip for each, and prints to PDF.
Each card also lists every other way the drills and labs use that command (built from
`src/data/drills.ts` and the labs' suggested commands, linking to the drill), and every drill pipeline
is in *Put them together*; `tests/handbook.test.ts` fails if a drill or lab uses something the
handbook doesn't show. The **command dojo** (`/commands/practice`) has 66 graded drills
in 12 levels, from `pwd` to a full incident triage, played in the simulated terminal (`src/lib/sim/shell.ts`).
Drills live in `src/data/drills.ts`; add new ones at the **end** of the list (progress is saved per
position) and give them a `level` — the page shows them grouped by level.

### Levels & certifications

- **Levels** — every track has a level in `src/data/path.ts` (`Beginner`, `Intermediate`,
  `Advanced`); the home page, sidebar, challenges (optional `level` field) and command practice are
  grouped by it. The four newer tracks' labs live in `src/data/labs/advancedLabs.ts`.
- **Range certifications** — `/certifications` and `/certify/<id>`. Four exams (RCSF, RCDP, RCSE,
  RCAE) in `src/data/certify.ts`; each needs finished tracks and labs (checked from synced progress
  and verified solves), then a timed exam drawn at random from a **server-only** bank
  (`src/lib/certify/bank.ts` — never import it from client code). Grading, attempts and certificates
  live in `src/lib/certify/exam.ts` and are stored as server-only rows in `hhb_progress` (kinds
  `exam` and `cert`; `/api/progress` refuses those kinds from browsers). A failed attempt waits
  `CERT_RETRY_MINUTES` (default 30) before a retry. Certificates are public and verifiable at
  `/cert/<code>`, print to PDF, and show on the player's profile. They're practice credentials, not
  industry certifications — the pages say so.
- **Industry guide** — `src/data/industryCerts.ts`: 30 certifications by area and level, mapped to
  tracks here, plus career roadmaps. Keep it to stable facts and link the official page; bump
  `CERTS_REVIEWED` when you re-check it. Signed-in players can generate AI practice questions on any
  certification's topics (`/api/ai/questions` with `{ cert }`).

### Organizers & security

- **Organizer console** — `/admin`, for handles listed in `ADMIN_HANDLES` (everyone else gets a
  404). Set the event's start, freeze and end times (with "start now", "end now" and "15 minutes
  more" buttons), download results as CSV (player and team standings, every solve, certificates),
  post a site-wide announcement banner, hide a broken or leaked challenge (players can't see
  or submit it; points already scored stay), ban a player (signs them out everywhere via the JWT
  callback, blocks sign-in, removes them from scoreboard, feed and first bloods), reset a player's
  password (a one-time temporary password they can change at `/account`), spot possible flag
  sharing (pairs solving the same challenges within two minutes), and read the audit log. Stored in
  `hhb_setting` (`src/lib/settings.ts`, cached for 10 s).
- **Rate limits** — `src/lib/rateLimit.ts`: failed sign-ins per handle (lockout) and per IP,
  sign-ups per IP, flag submissions per player and per challenge, team-join attempts, and a general
  write limit. In memory, so per server process; per-IP limits are generous because event players
  often share one venue IP. Tune with the `RATE_*` variables in `.env.example`. The client IP is
  read from `X-Forwarded-For` as added by your proxy (`TRUSTED_PROXY_HOPS`); entries the client
  sent itself are ignored.
- **Event day** — [`docs/EVENT-RUNBOOK.md`](docs/EVENT-RUNBOOK.md): deployment checklist, what to do
  when something goes wrong mid-event, and recovery. `npm run loadtest` simulates a room of players
  behind one IP; `npm run db:backup` snapshots this app's tables to `backups/` (git-ignored). The
  scoreboard, activity feed and challenge stats are shared in memory for 5 seconds (`src/lib/cache.ts`),
  so a room of players refreshing at once costs one database read.
- **Headers** — `next.config.ts` sends a Content-Security-Policy (same-origin plus Google Fonts;
  inline scripts allowed because Next.js bootstraps with them), `X-Frame-Options: DENY`, `nosniff`,
  a strict referrer policy, a locked-down Permissions-Policy and, in production, HSTS.
  `X-Powered-By` is off.
- **Share previews & search** — every page has Open Graph/Twitter metadata with a generated preview
  image; certificate links get their own (`src/app/cert/[code]/opengraph-image.tsx`). `robots.txt`
  keeps personal and organizer pages out of search; `sitemap.xml` lists the public ones. Set
  `SITE_URL` so these use your real address.
- **Accessibility** — a skip-to-content link, real heading structure, text contrast of at least 4.5:1
  in both themes, and reduced motion when the system asks for it.
- **Errors** — `src/app/error.tsx` and `global-error.tsx` show a calm retry screen instead of the
  framework default.

### Community features

- **My learning** — `/learning`: the next step on the path, progress by level, what to review
  (unfinished labs, quizzes below full marks), command practice by tier, certification readiness and
  challenges that match the tracks you've finished.
- **Flashcards** — `/review`: spaced repetition (Leitner boxes 1–5; gaps of 1, 3, 7, 16 and 35 days)
  over every glossary term and quiz question (`src/data/cards.ts`, scheduler in `src/lib/review.ts`).
  Up to 15 new cards a day; keyboard: Space to flip, 1–4 to grade. Saved in the browser.
- **Profiles, XP & ranks** — `/u/<handle>`. Signed-in learning progress (labs, quizzes, finished
  tracks) syncs to `hhb_progress`; XP and HTB-style ranks (Noob → Omniscient) are computed from it
  plus solved challenges. Browser-reported progress is clamped to what the content allows; the CTF
  score only ever counts server-verified flags.
- **Richer challenges** — solve counts, first blood, difficulty votes (`hhb_vote`, solvers only),
  paid hints that cost points (`hhb_hint_unlock`, free once solved) and writeups shown only to solvers.
- **Teams** — `/teams`: create a team (join code), join, leave; `TEAM_MAX` caps size (default 4).
  Team score counts each challenge once, at the first member's solve.
- **Badges & activity feed** — computed from the data above; nothing extra stored.
- **Event mode** — set the start, end and optional freeze in the organizer console (or with
  `EVENT_START` / `EVENT_END` / `EVENT_FREEZE`; console times win) to run a timed CTF: flags are
  accepted only during the window, and during a freeze the scoreboard, feed and other players'
  profiles show standings as of the freeze. No times = always-open practice. Open pages pick up
  changes within 30 seconds.

## Tests

```bash
npm test          # simulator, drills, labs, content and challenge checks (Node's test runner, ~1 s)
npm run typecheck
```

Tests live in `tests/*.test.ts` and run the app's TypeScript directly (`--experimental-strip-types`,
with `tests/support/loader.mjs` resolving the `@/` alias), so there's nothing extra to install. They
cover only code that doesn't need the database. Among other things they check that every command
drill and every objective of the newer labs is solvable, that exam banks are big enough, that every
link between tracks, labs, glossary terms and certifications resolves, and that no flag is written
in `challenges.ts` in plain text. `.github/workflows/ci.yml` runs type-check, tests and build on push.

## Extending it further

Content is data-driven — add a track, cheatsheet, or challenge by editing `src/data/*.ts`
(challenges live in `src/data/challenges.ts`; store `sha256(flag)`, never the flag).
To hash a new flag: `npm run flag-hash` (prompts, so the flag stays out of your shell history) — it
prints the `flagHash` line to paste and warns if the flag is already used or isn't in `HHB{...}` form.
Natural next steps: per-challenge solve timestamps on the board, writeups, or GitHub OAuth
alongside the credentials provider.
