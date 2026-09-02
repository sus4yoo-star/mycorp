#!/usr/bin/env bash
#
# Keep Supabase's auth redirect settings pointing at the deployed app.
#
# Supabase does not fail when an app asks to be redirected somewhere it does not
# recognise. It substitutes the project's Site URL and sends the mail anyway, so
# a magic link arrives pointing at http://localhost:3000 and nothing in the code
# explains why. Two settings decide it: site_url, and uri_allow_list, which the
# requested address must match.
#
# So they stop being something a person remembers to set. The allow list is
# merged, never replaced — entries added by hand stay. And the field names are
# read from the project rather than assumed: if this API stops calling them what
# we expect, the run says so and names what it found instead of quietly writing
# nothing.

set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
: "${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID is required}"
: "${APP_URL:?APP_URL is required}"

API="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/config/auth"
CURRENT="$(mktemp)"
RESULT="$(mktemp)"
trap 'rm -f "$CURRENT" "$RESULT"' EXIT

code="$(curl -sS -o "$CURRENT" -w '%{http_code}' \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" "$API")"
if [ "$code" != "200" ]; then
  echo "could not read the auth config (HTTP $code)" >&2
  exit 1
fi

# Never print this document. It carries the SMTP password.
if ! jq -e 'has("site_url") and has("uri_allow_list")' "$CURRENT" >/dev/null; then
  echo "this project's auth config has no site_url / uri_allow_list." >&2
  echo "URL-ish keys it does have — update this script to match:" >&2
  jq -r 'keys[] | select(test("url|uri|redirect|site"; "i"))' "$CURRENT" >&2
  exit 1
fi

want_site="${APP_URL%/}"
want_entry="${want_site}/**"

site="$(jq -r '.site_url // ""' "$CURRENT")"
allow="$(jq -r '.uri_allow_list // ""' "$CURRENT")"

merged="$allow"
case ",${allow}," in
  *",${want_entry},"*) ;;
  *) merged="${allow:+${allow},}${want_entry}" ;;
esac

if [ "$site" = "$want_site" ] && [ "$merged" = "$allow" ]; then
  echo "auth URLs already correct (site_url=${site})"
  exit 0
fi

echo "site_url:       ${site:-<empty>}  ->  ${want_site}"
echo "uri_allow_list: ${allow:-<empty>}  ->  ${merged}"

code="$(
  jq -n --arg s "$want_site" --arg a "$merged" '{site_url: $s, uri_allow_list: $a}' \
    | curl -sS -o "$RESULT" -w '%{http_code}' -X PATCH \
        -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
        -H 'Content-Type: application/json' \
        --data-binary @- "$API"
)"

if [ "$code" -lt 200 ] || [ "$code" -ge 300 ]; then
  echo "updating the auth config failed (HTTP $code)" >&2
  jq -r '.message // .msg // "no message"' "$RESULT" 2>/dev/null >&2 || true
  exit 1
fi

echo "auth URLs updated."
