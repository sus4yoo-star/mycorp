#!/usr/bin/env bash
#
# Run SQL against the linked Supabase project and print the result as JSON.
#
# Reads SQL on stdin. Goes through the Management API rather than psql: the
# runner is IPv4-only and the project's database host is not, so a direct
# connection is not a path we can rely on from CI. The access token we already
# need for `supabase link` is enough — no database password, no region, no
# connection string to assemble.

set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
: "${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID is required}"

sql="$(cat)"
[ -n "${sql//[[:space:]]/}" ] || { echo "no SQL on stdin" >&2; exit 2; }

out="$(mktemp)"
trap 'rm -f "$out"' EXIT

code="$(
  jq -n --arg q "$sql" '{query: $q}' \
    | curl -sS -o "$out" -w '%{http_code}' \
        -X POST "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/database/query" \
        -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
        -H 'Content-Type: application/json' \
        --data-binary @-
)"

# The server's own message is the useful part of a SQL failure — a raised
# exception from verify.sql arrives this way, and swallowing it would turn a
# named problem into "the step failed".
if [ "$code" -lt 200 ] || [ "$code" -ge 300 ]; then
  echo "supabase query failed (HTTP $code):" >&2
  cat "$out" >&2
  echo >&2
  exit 1
fi

cat "$out"
