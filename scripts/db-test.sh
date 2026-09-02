#!/usr/bin/env bash
#
# Row level security tests against a throwaway Postgres cluster.
#
# The point is to attack the policies, not to read them. A tenant-isolation bug
# is invisible in review and obvious here.
#
# Usage:
#   pnpm test:db
#   PG_BIN=/usr/lib/postgresql/16/bin pnpm test:db     # explicit binaries
#   PGTEST_USER=pgtest pnpm test:db                    # when running as root
#
# Requires Postgres binaries (initdb, pg_ctl, psql). No Docker, no network, and
# no Supabase project — supabase/test/00_stub_supabase.sql recreates the parts
# of Supabase the schema depends on.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PGTEST_PORT:-55432}"
DB="mycorp24_rls_test"

# --- locate the binaries ---------------------------------------------------
if [[ -n "${PG_BIN:-}" ]]; then
  BIN="$PG_BIN"
elif command -v initdb >/dev/null 2>&1; then
  BIN="$(dirname "$(command -v initdb)")"
else
  BIN="$(ls -d /usr/lib/postgresql/*/bin /opt/homebrew/opt/postgresql*/bin \
             /usr/local/opt/postgresql*/bin 2>/dev/null | sort -V | tail -1 || true)"
fi

if [[ -z "${BIN:-}" || ! -x "$BIN/initdb" ]]; then
  echo "postgres binaries not found. Install Postgres, or set PG_BIN." >&2
  echo "  macOS:  brew install postgresql@16" >&2
  echo "  Debian: apt-get install postgresql" >&2
  exit 127
fi

# --- initdb refuses to run as root -----------------------------------------
RUN_AS=""
if [[ "$(id -u)" -eq 0 ]]; then
  if [[ -n "${PGTEST_USER:-}" ]] && id "$PGTEST_USER" >/dev/null 2>&1; then
    RUN_AS="$PGTEST_USER"
  else
    echo "Refusing to run as root: initdb will not start a cluster as root." >&2
    echo "Re-run as a normal user, or set PGTEST_USER to an existing account." >&2
    exit 1
  fi
fi

if [[ -n "$RUN_AS" ]]; then
  WORK="$(eval echo "~$RUN_AS")/.mycorp24-rls-test"
else
  WORK="${TMPDIR:-/tmp}/mycorp24-rls-test.$$"
fi

as() { if [[ -n "$RUN_AS" ]]; then su "$RUN_AS" -c "$1"; else bash -c "$1"; fi; }

cleanup() {
  as "$BIN/pg_ctl -D '$WORK/data' stop -m immediate" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

rm -rf "$WORK"
mkdir -p "$WORK/data" "$WORK/sock"
[[ -n "$RUN_AS" ]] && chown -R "$RUN_AS" "$WORK"

echo "▸ starting a temporary cluster on port $PORT"
as "$BIN/initdb -D '$WORK/data' -U postgres --auth=trust" >/dev/null
as "$BIN/pg_ctl -D '$WORK/data' -o \"-p $PORT -k '$WORK/sock' -c listen_addresses=''\" -l '$WORK/pg.log' start" >/dev/null

for _ in $(seq 1 30); do
  "$BIN/pg_isready" -h "$WORK/sock" -p "$PORT" >/dev/null 2>&1 && break
  sleep 1
done

PSQL=("$BIN/psql" -h "$WORK/sock" -p "$PORT" -U postgres -v ON_ERROR_STOP=1)

"${PSQL[@]}" -q -c "create database $DB;" >/dev/null

echo "▸ applying migrations"
"${PSQL[@]}" -q -d "$DB" \
  -f "$ROOT/supabase/test/00_stub_supabase.sql" \
  -f "$ROOT/supabase/migrations/0001_init.sql" \
  -f "$ROOT/supabase/migrations/0002_found_company.sql" \
  -f "$ROOT/supabase/migrations/0003_oauth_states.sql" \
  -f "$ROOT/supabase/migrations/0004_memory_and_proposals.sql" \
  -f "$ROOT/supabase/migrations/0005_competitor_snapshots.sql" \
  -f "$ROOT/supabase/test/01_grants.sql" \
  -f "$ROOT/supabase/test/02_seed.sql" >/dev/null

# verify.sql is what the deploy runs against the real project. If it only ever
# runs there, a mistake in it is discovered in production. Run it here too.
echo "▸ verifying the schema (supabase/verify.sql)"
"${PSQL[@]}" -q -d "$DB" -f "$ROOT/supabase/verify.sql" >/dev/null

echo "▸ running row level security tests"
"${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/test/03_rls.sql"
"${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/test/04_flow.sql"
