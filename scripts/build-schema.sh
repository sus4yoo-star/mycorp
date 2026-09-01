#!/usr/bin/env bash
#
# Concatenate the migrations into one paste-ready file.
#
# `supabase db push` is the normal path. This exists for the case where you have
# a browser and nothing else: open the Supabase SQL Editor, paste
# supabase/schema.sql, run. Same statements, same order.
#
# CI regenerates this and fails if it differs, so it cannot drift from the
# migrations it is built from.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/supabase/schema.sql"

{
  cat <<'HEADER'
-- MYCORP24 — full schema
--
-- GENERATED FILE. Do not edit.
--   Regenerate: pnpm build:schema
--   Source:     supabase/migrations/*.sql
--
-- Two ways to apply this:
--
--   1. Normally, and what CI does:
--        supabase db push
--
--   2. With only a browser:
--        Supabase dashboard -> SQL Editor -> New query -> paste this file -> Run
--
-- Then verify with supabase/verify.sql. Row level security is the whole
-- security model here; a table with it switched off is wide open.

HEADER

  for f in "$ROOT"/supabase/migrations/*.sql; do
    printf -- '-- ===========================================================================\n'
    printf -- '-- %s\n' "$(basename "$f")"
    printf -- '-- ===========================================================================\n\n'
    cat "$f"
    printf '\n\n'
  done
} > "$OUT"

echo "wrote $(basename "$OUT") ($(wc -l < "$OUT") lines)"
