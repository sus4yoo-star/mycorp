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
-- ===========================================================================
-- READ THIS BEFORE PASTING
-- ===========================================================================
--
-- This file is for a database that has NEVER had the schema applied.
-- It is not re-runnable: `create table` and `create type` fail on objects that
-- already exist, and a half-failed paste is worse than not starting.
--
--   Empty database, browser only:
--       SQL Editor -> New query -> paste this whole file -> Run
--
--   Empty database, CLI (what CI does):
--       supabase db push
--
--   ALREADY APPLIED, and you want the newer tables:
--       Do NOT paste this file again.
--       Paste only the migration files under supabase/migrations/ that you have
--       not applied yet, in filename order. Each one is additive on its own.
--
-- Either way, finish by running supabase/verify.sql. It changes nothing and
-- raises if the database is not in a safe state. Row level security is the
-- whole security model here; a table with it switched off is wide open.

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
