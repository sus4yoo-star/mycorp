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

api() {
  curl -sS -o /tmp/nf.json -w '%{http_code}' --max-time 30 \
    -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" \
    "https://api.netlify.com/api/v1/$1" 2>/dev/null || echo 000
}

say() { printf '  %-22s %s\n' "$1" "$2"; }

echo "▸ is the token still valid?"
code="$(api user)"
say "GET /user" "$code"
if [ "$code" = "200" ]; then
  say "account" "$(jq -r '.email // "?"' /tmp/nf.json | sed 's/\(..\).*@/\1***@/')"
else
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

echo "▸ is the account itself blocked?"
code="$(api accounts)"
say "GET /accounts" "$code"
if [ "$code" = "200" ]; then
  jq -r '.[] | "  \(.slug): type=\(.type_name // "?") capabilities=\(.capabilities | keys | join(","))"' \
    /tmp/nf.json 2>/dev/null | head -20
else
  say "message" "$(jq -r '.message // .error // "no message"' /tmp/nf.json 2>/dev/null)"
fi

echo
echo "Token and site both answer. If the deploy still returns Forbidden, the"
echo "refusal is about the deploy itself — a plan limit or a hold on the"
echo "account — and app.netlify.com will say which."
