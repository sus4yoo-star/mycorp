#!/usr/bin/env bash
#
# Ask Netlify why it is refusing us.
#
# `netlify deploy` reports a bare "JSONHTTPError: Forbidden" and nothing else,
# which fits an expired token, a token without rights on this site, and an
# account limit equally well — three different fixes. This asks the API the
# three questions separately so the answer names one of them.
#
# Prints status codes and a few named fields. Never the token, and never a whole
# response body, which is how a credential ends up in a public build log.

set -uo pipefail

: "${NETLIFY_AUTH_TOKEN:?NETLIFY_AUTH_TOKEN is required}"
: "${NETLIFY_SITE_ID:?NETLIFY_SITE_ID is required}"

# curl already prints 000 when it cannot connect, so `|| echo 000` would append
# a second one and yield "000000" — a value no comparison below expects. Capture
# curl's own failure separately (same bug as scripts/smoke.sh had).
api() {
  local code
  if ! code="$(curl -sS -o /tmp/nf.json -w '%{http_code}' --max-time 30 \
    -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" \
    "https://api.netlify.com/api/v1/$1" 2>/dev/null)"; then
    code=000
  fi
  printf '%s' "${code:-000}"
}

say() { printf '  %-22s %s\n' "$1" "$2"; }

echo "▸ is the token still valid?"
code="$(api user)"
say "GET /user" "$code"
if [ "$code" = "200" ]; then
  say "account" "$(jq -r '.email // "?"' /tmp/nf.json | sed 's/\(..\).*@/\1***@/')"
else
  if [ "$code" = "000" ]; then
    # Not a token problem. Saying so saves someone rotating a working secret.
    echo "::error::api.netlify.com could not be reached at all. This says nothing about the token."
    exit 1
  fi
  say "message" "$(jq -r '.message // .error // "no message"' /tmp/nf.json 2>/dev/null)"
  echo "::error::The Netlify token is not being accepted. Regenerate it and update the NETLIFY_AUTH_TOKEN secret."
  exit 1
fi

echo "▸ may this token touch this site?"
code="$(api "sites/${NETLIFY_SITE_ID}")"
say "GET /sites/<id>" "$code"
if [ "$code" = "200" ]; then
  say "site" "$(jq -r '.name // "?"' /tmp/nf.json)"
  say "account_slug" "$(jq -r '.account_slug // "?"' /tmp/nf.json)"
  say "published_at" "$(jq -r '.published_deploy.published_at // "never"' /tmp/nf.json)"
else
  say "message" "$(jq -r '.message // .error // "no message"' /tmp/nf.json 2>/dev/null)"
  echo "::error::The token is valid but cannot see this site. Check NETLIFY_SITE_ID, and that the token's account owns it."
  exit 1
fi

echo "▸ has the account run out of something?"
code="$(api accounts)"
say "GET /accounts" "$code"
if [ "$code" = "200" ]; then
  say "plan" "$(jq -r '.[0].type_name // "?"' /tmp/nf.json)"
  # Only the metered capabilities: a name with numbers beside it is a limit
  # that can be reached. Anything at or past its allowance is the answer.
  jq -r '
    .[0].capabilities
    | to_entries[]
    | select(.value | type == "object")
    | select(.value.included != null or .value.used != null)
    | "  \(.key): used=\(.value.used // "?") of \(.value.included // "?")"
  ' /tmp/nf.json 2>/dev/null | sort
else
  say "message" "$(jq -r '.message // .error // "no message"' /tmp/nf.json 2>/dev/null)"
fi

echo "▸ what did the last deploys say?"
code="$(api "sites/${NETLIFY_SITE_ID}/deploys?per_page=5")"
say "GET /deploys" "$code"
if [ "$code" = "200" ]; then
  jq -r '.[] | "  \(.created_at)  \(.state)  \(.error_message // "")"' /tmp/nf.json 2>/dev/null
else
  say "message" "$(jq -r '.message // .error // "no message"' /tmp/nf.json 2>/dev/null)"
fi

echo
echo "Token and site both answer. If nothing above is exhausted, the refusal is"
echo "a hold on the account rather than a limit, and app.netlify.com will say so."
