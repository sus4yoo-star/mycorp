#!/usr/bin/env bash
#
# Reconcile Supabase's migration history with what the database actually holds.
#
# A project whose schema was pasted into the SQL Editor by hand has every object
# and no history, so `db push` replays from the top and dies on the first
# `create type ... already exists`. `migration repair --status applied` fixes
# that — but it writes history without running SQL, so marking a migration
# applied is a claim, not evidence.
#
# So nothing is marked on a hunch. For each migration not in the history, the
# database is asked whether the object that migration creates is really there,
# and only then is it marked. Whatever is genuinely missing is left for
# `db push` to apply. supabase/verify.sql afterwards is the second opinion:
# it asserts every expected table exists, so a wrong answer here fails the
# deploy instead of shipping against a database with holes in it.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(dirname "$here")"
query="$here/supabase-query.sh"

# One object per migration, created in its opening statements. A migration with
# no entry here stops the script rather than being guessed at — guessing is the
# thing this script exists to remove.
markers='
0001 type  security_level
0002 proc  found_company
0003 class oauth_states
0004 type  memory_kind
0005 class competitor_snapshots
'

exists_sql() {
  case "$1" in
    type)  printf "select (to_regtype('public.%s') is not null) as present" "$2" ;;
    class) printf "select (to_regclass('public.%s') is not null) as present" "$2" ;;
    proc)  printf "select exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '%s') as present" "$2" ;;
    *)     echo "unknown marker kind: $1" >&2; return 1 ;;
  esac
}

echo "▸ reading the remote migration history"
history_present="$(printf "%s" \
  "select (to_regclass('supabase_migrations.schema_migrations') is not null) as present" \
  | "$query" | jq -r '.[0].present')"

if [ "$history_present" = "true" ]; then
  applied="$(printf "%s" \
    'select version from supabase_migrations.schema_migrations order by version' \
    | "$query" | jq -r '.[].version')"
else
  applied=''
fi

repair=()
for f in "$root"/supabase/migrations/*.sql; do
  base="$(basename "$f")"
  version="${base%%_*}"

  entry="$(awk -v v="$version" '$1 == v { print $2, $3; exit }' <<<"$markers")"
  if [ -z "$entry" ]; then
    echo "no marker object recorded for $base." >&2
    echo "Add one to scripts/supabase-reconcile.sh so its state can be checked." >&2
    exit 1
  fi
  read -r kind name <<<"$entry"

  if grep -qxF "$version" <<<"$applied"; then
    echo "  $version  in history"
  elif [ "$(exists_sql "$kind" "$name" | "$query" | jq -r '.[0].present')" = "true" ]; then
    echo "  $version  not in history, but $name exists — marking applied"
    repair+=("$version")
  else
    echo "  $version  not applied — db push will run it"
  fi
done

if [ "${#repair[@]}" -eq 0 ]; then
  echo "▸ history already matches the database"
  exit 0
fi

echo "▸ marking ${#repair[@]} migration(s) as applied"
for version in "${repair[@]}"; do
  supabase migration repair --status applied "$version"
done
