#!/usr/bin/env bash
#
# Ask the deployed site what it actually serves.
#
# A green deploy means the build produced files and the CDN accepted them. It
# does not mean the site is up: a publish that loses the Next.js runtime serves
# Netlify's own 404 for every route while the deploy reports success. That
# happened — the site was dead for twenty minutes behind two green deploys, and
# nothing in CI noticed.
#
# So the rule here is narrow and true: a 404 or an unreachable host on any of
# these paths means the deploy is broken, whatever its colour. Redirects are
# expected — every private route bounces a signed-out visitor to /login.

set -uo pipefail

: "${APP_URL:?APP_URL is required}"
base="${APP_URL%/}"

# GMAIL, not google: unknown providers are supposed to 404, so probing one would
# test nothing. These ids come from packages/integrations/src/oauth.ts.
paths=(
  /
  /login
  /signup
  /onboarding
  /hq
  /briefing
  /chat
  /connect
  /approvals
  /competitors
  /auth/callback
  /api/oauth/GMAIL/start
)

echo "probing $base"
failed=0

for path in "${paths[@]}"; do
  code=""
  # A single cold miss right after a publish is not evidence of a broken site.
  for attempt in 1 2 3; do
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "${base}${path}" || echo 000)"
    case "$code" in
      404|000) sleep 3 ;;
      *) break ;;
    esac
  done

  printf '  %-26s %s\n' "$path" "$code"
  case "$code" in
    404) echo "::error::${path} returns 404 — the deploy is not serving it"; failed=1 ;;
    000) echo "::error::${path} could not be reached at all"; failed=1 ;;
  esac
done

if [ "$failed" -ne 0 ]; then
  echo
  echo "The site is not serving what it should. The last good deploy can be" >&2
  echo "restored from Netlify: mycorp24 -> Deploys -> pick one -> Publish deploy." >&2
  exit 1
fi

echo "all paths served."
