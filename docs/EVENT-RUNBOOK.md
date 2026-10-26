# Event-day runbook

For organizers running H@ck1h3B0x Range as a live CTF. Everything here is done from the
organizer console (`/admin`) unless it says otherwise. Your handle must be listed in
`ADMIN_HANDLES` to open it.

## The week before

**Host it next to the database.** The database is on Neon in AWS `ap-southeast-1` (Singapore).
Every database query waits for the round trip, so the distance between the app and the database adds
up. From a laptop about 70 ms away, a burst of 300 players arriving in 15 seconds still got every
request back within about a second (see the load test below). Hosted in the same region, each query
takes a millisecond or two, which leaves plenty of headroom.

**Run one instance.** Rate limits, the settings cache and the shared page cache live in memory. Two
instances behind a load balancer would each keep their own, which halves the protection and delays
organizer changes.

**Start it with `npm start`**, not `next start` directly: it sizes Node's thread pool to the machine
(`UV_THREADPOOL_SIZE`), so a burst of sign-ins hashes passwords on every core instead of four. If your
platform runs `next start` itself, set `UV_THREADPOOL_SIZE` to the number of CPU cores (up to 16).

**Set the environment** (see `.env.example`):

| Variable | What to set |
|---|---|
| `DATABASE_URL` | Neon's **pooled** connection string. For more than ~300 players, add `&connection_limit=40`. The database is shared with another app, so don't go much higher. |
| `AUTH_SECRET` | A long random value (`npx auth secret`). Keep it the same across restarts, or everyone is signed out. |
| `ADMIN_HANDLES` | Your organizers' handles, comma-separated. |
| `SITE_URL` | The public address, e.g. `https://range.example.org` (used in share previews, certificate links and the sitemap). |
| `TRUSTED_PROXY_HOPS` | Number of reverse proxies in front of the app that append to `X-Forwarded-For`. `1` (default) for a single proxy or a hosting platform, `2` for a CDN in front of nginx. |
| `RATE_REGISTER_PER_IP` | Sign-ups allowed per network per hour (default 300). Raise it if more players than that will register on site, behind the venue Wi-Fi. |
| `ANTHROPIC_API_KEY` | Optional; turns on the AI tutor and generated practice questions. |

**Put it behind a proxy.** The per-network limits rely on the proxy's `X-Forwarded-For`. Without
a proxy, Next.js passes on whatever header the client sends, so those limits can be dodged.
Per-player and per-account limits work either way. With nginx, use
`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`.

**Build and start:**

```bash
npm ci
npm run build
npm start          # first free port from $PORT (default 3003), skipping 3002
```

**Load-test it** against the deployed address, before players arrive:

```bash
npm run loadtest -- --url https://range.example.org --players 200 --ramp 30
```

It simulates players behind one IP signing up, signing in, browsing and submitting, then deletes
its `zz_load_…` test accounts (it needs `DATABASE_URL` in `.env.local` for that; if a run is
interrupted, `npm run loadtest -- --cleanup` removes them). Look for `failed 0` and `limited 0` on every row. Afterwards,
**restart the server**: the test fills the rate-limit counters for your IP, and a restart clears
them. Sessions survive restarts.

What it looked like in testing (production build, default connection pool, database 70 ms away):

| Players arriving | Got through | Slowest 5% of requests | Throughput |
|---|---|---|---|
| 150 over 30 s | 150/150 | under 1 s | — |
| 300 over 15 s | 300/300 | under 1 s (worst single request 1.3 s) | 209 requests/s |

The scoreboard, the activity feed and challenge solve counts are the same for everyone, so they're
shared for 5 seconds: a burst of players costs one database read. Each player's own solves, score and
rank are always fresh. The scoreboard therefore lags a solve by up to 5 seconds, and the page says so.
Bans clear the shared copy straight away.

**Set the event times** in `/admin` → *Event times*: start, end, and optionally a scoreboard
freeze (for example, the last hour). Times are entered in your browser's timezone, which is shown
next to the Save button. Open pages pick up changes within 30 seconds.

**Take a backup:** `npm run db:backup` (see [Recovering](#recovering)).

## On the day

| Situation | What to do |
|---|---|
| Starting late, or early | *Event times* → change the start, or press **Start now**. |
| Players need more time | **End 15 min later** (press it again for more). |
| Ended by mistake | **Reopen for 15 min**, then set the end you meant. |
| Tell everyone something | *Announcement*: shown at the top of every page within a minute. |
| A challenge is broken or its flag leaked | *Challenges* → **Hide**. Players stop seeing it and can't submit; points already scored stay. Post an announcement. |
| A player forgot their password | *Players* → **Reset password**. Give them the temporary password in person; they change it at `/account`. |
| "Too many sign-ups from this network" | More players registered on the venue Wi-Fi than `RATE_REGISTER_PER_IP` allows. Raise it and restart; the restart also clears the counter. Nobody is signed out. |
| A player can't sign in after many tries | They hit the 10-failures-in-15-minutes lock on their handle. A password reset clears it. |
| Possible flag sharing | *Possible flag sharing* lists pairs who solved the same challenges within two minutes of each other. It's a lead, not proof: teammates and friends sitting together show up too. Talk to them first; **Ban** if needed. A ban signs them out and removes them from the board. |
| Pages are slow | Check the server is in the database's region and `connection_limit` is set (see above). |
| The server crashed | Start it again. Sessions survive; rate-limit counters reset. |
| The database is unreachable | Pages show a "database unavailable" message and nothing is half-saved. Players resubmit flags once it's back. Check Neon's status page. |

Every console action is written to the audit log at the bottom of `/admin`.

## After the event

1. The end time closes submissions and shows the final board to everyone. There's nothing to press.
2. *Export results*: download **Player standings**, **Team standings**, **Every solve** and
   **Certificates**. Exports ignore the freeze; standings leave out banned players, and the solve
   log keeps them, marked. Ties go to whoever reached their score first.
3. `npm run db:backup` for your records.
4. To keep the range open for learning afterwards, press **Practice mode**: flags are accepted
   any time and the board is never frozen.

## Recovering

**Snapshots.** `npm run db:backup` writes this app's tables (the `hhb` schema only) to
`backups/hhb-<time>.json`. It's read-only. The file holds password hashes, so keep it private;
it's git-ignored and readable by your user only.

**Rolling back the live data.** The Neon database is shared with another app, so **don't restore
the main branch**: that would roll the other app back too. Instead:

1. In the Neon console, create a branch from a point in time just before the problem (this works
   within your plan's history window).
2. Copy that branch's pooled connection string into this app's `DATABASE_URL` and restart.

Only this app moves to the restored data, and the other app carries on as before. Anything this app
recorded after that point in time is not on the new branch.
