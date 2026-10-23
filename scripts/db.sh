#!/bin/sh
# Reviewable, additive schema changes for the shared Neon DB (see README).
#   db.sh diff         write prisma/pending.sql (live `hhb` schema -> schema.prisma)
#   db.sh apply <name> run prisma/pending.sql, then keep it as prisma/sql/<ts>_<name>.sql
set -eu
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a

PENDING=prisma/pending.sql

case "${1:-}" in
  diff)
    # --from-schema-datasource introspects only the `schemas` listed in schema.prisma.
    status=0
    prisma migrate diff --from-schema-datasource prisma/schema.prisma \
      --to-schema-datamodel prisma/schema.prisma --script --exit-code > "$PENDING" || status=$?
    if [ "$status" -eq 0 ]; then rm -f "$PENDING"; echo "DB is in sync with schema.prisma."; exit 0; fi
    [ "$status" -eq 2 ] || exit "$status"
    cat "$PENDING"
    echo
    grep -qiw DROP "$PENDING" && echo "!! pending.sql contains DROP — check it is intended." >&2
    echo "Review $PENDING, then: npm run db:apply -- <name>"
    ;;
  apply)
    name="${2:?usage: npm run db:apply -- <name>}"
    [ -s "$PENDING" ] || { echo "No $PENDING — run: npm run db:diff" >&2; exit 1; }
    prisma db execute --file "$PENDING" --schema prisma/schema.prisma
    out="prisma/sql/$(date -u +%Y%m%d%H%M%S)_$name.sql"
    mv "$PENDING" "$out"
    echo "Applied. Recorded as $out (commit it)."
    ;;
  *)
    echo "usage: db.sh diff | apply <name>" >&2
    exit 1
    ;;
esac
