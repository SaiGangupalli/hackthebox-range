#!/usr/bin/env bash
# One-command setup for a new machine that REUSES the shared Neon database.
# It installs dependencies and writes .env.local. It never runs DB migrations,
# because the shared `hhb` schema already exists.
#
#   ./scripts/setup.sh                                   interactive (prompts for secrets)
#   ./scripts/setup.sh --run                             ...then start the dev server
#   DATABASE_URL=... AUTH_SECRET=... ./scripts/setup.sh  non-interactive (CI / scripted)
#
# Secrets are taken from the environment if already set, otherwise prompted with
# the input hidden. They are written only to .env.local (git-ignored, chmod 600)
# and are never printed or committed.
set -eu
cd "$(dirname "$0")/.."

RUN=0
for a in "$@"; do
  case "$a" in
    --run|--dev) RUN=1 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) printf 'Unknown option: %s (try --help)\n' "$a" >&2; exit 2 ;;
  esac
done

say()  { printf '\033[36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[31mxx\033[0m %s\n' "$*" >&2; exit 1; }

# Hidden prompt that always restores terminal echo (so set -e can't leave it off).
read_hidden() { # $1 = prompt
  printf '%s' "$1"
  stty -echo 2>/dev/null || true
  IFS= read -r REPLY_HIDDEN || true
  stty echo 2>/dev/null || true
  printf '\n'
}

# ── 1. Prerequisites ─────────────────────────────────────────────────────────
command -v git  >/dev/null || die "git is not installed."
command -v node >/dev/null || die "Node.js is not installed — install Node 22 from https://nodejs.org"
command -v npm  >/dev/null || die "npm is not installed (it comes with Node.js)."
major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
[ "$major" -ge 22 ] || warn "Node $major detected; this project is built for Node 22 — upgrade if anything misbehaves."
say "Using Node $(node -v), npm $(npm -v)"

# ── 2. Dependencies ──────────────────────────────────────────────────────────
say "Installing dependencies (npm install — this also runs prisma generate)…"
npm install

# ── 3. .env.local ────────────────────────────────────────────────────────────
if [ -f .env.local ]; then
  say ".env.local already exists — leaving it untouched."
else
  [ -f .env.example ] || die ".env.example is missing — are you in the project root?"
  say "Creating .env.local (reusing the shared database — no migration will run)…"

  # DATABASE_URL (required): the shared Neon connection string.
  DB="${DATABASE_URL:-}"
  if [ -z "$DB" ] && [ -t 0 ]; then
    read_hidden "Paste the shared Neon DATABASE_URL (hidden): "; DB="$REPLY_HIDDEN"
  fi
  [ -n "$DB" ] || die "DATABASE_URL is required. Set it in the environment or paste it. Nothing was written."
  case "$DB" in postgres*://*) : ;; *) warn "That doesn't look like a postgres:// URL — continuing anyway." ;; esac

  # AUTH_SECRET: paste this machine's value to share logins across instances, or
  # leave blank to generate a fresh one.
  SECRET="${AUTH_SECRET:-}"
  if [ -z "$SECRET" ] && [ -t 0 ]; then
    read_hidden "AUTH_SECRET (Enter to generate; paste the other machine's to share logins): "; SECRET="$REPLY_HIDDEN"
  fi
  if [ -z "$SECRET" ]; then
    SECRET=$(openssl rand -base64 32 2>/dev/null || node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')
    say "Generated a new AUTH_SECRET (existing sessions from other instances won't carry over)."
  fi

  # ANTHROPIC_API_KEY (optional): only needed for the AI tutor/quizzes.
  AK="${ANTHROPIC_API_KEY:-}"
  if [ -z "$AK" ] && [ -t 0 ]; then
    read_hidden "ANTHROPIC_API_KEY (optional — Enter to skip): "; AK="$REPLY_HIDDEN"
  fi

  umask 077
  {
    printf 'DATABASE_URL="%s"\n' "$DB"
    printf 'AUTH_SECRET="%s"\n' "$SECRET"
    [ -n "$AK" ] && printf 'ANTHROPIC_API_KEY="%s"\n' "$AK"
    printf '\n# ---- reference: optional settings (from .env.example) ----\n'
    grep -vE '^(DATABASE_URL|AUTH_SECRET|ANTHROPIC_API_KEY)=' .env.example
  } > .env.local
  chmod 600 .env.local
  say "Wrote .env.local (chmod 600, git-ignored)."
fi

# ── 4. Database check (no migration — the shared schema already exists) ───────
say "Checking the database is reachable…"
if ( set -a; . ./.env.local; set +a; printf 'SELECT 1;' | npx prisma db execute --schema prisma/schema.prisma --stdin ) >/dev/null 2>&1; then
  say "Database reachable — shared 'hhb' schema is already there, nothing to migrate."
else
  warn "Couldn't run a test query. Check DATABASE_URL in .env.local and your network, then re-run."
fi

# ── Done ─────────────────────────────────────────────────────────────────────
say "Setup complete."
cat <<'NEXT'

  Start it:    npm run dev        -> http://localhost:3003   (then open /register)
  Production:  npm run build && npm start
  On the LAN:  open http://<this-machine-ip>:3003 from another device on the same Wi-Fi

NEXT

if [ "$RUN" -eq 1 ]; then say "Starting the dev server…"; exec npm run dev; fi
