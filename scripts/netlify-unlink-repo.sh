#!/usr/bin/env bash
#
# Disconnect Netlify's own Git integration from the site.
#
# The site was building twice for every change: Netlify's integration built each
# push and each pull request preview, and the GitHub Actions pipeline deployed
# the same commit again. That is what exhausted the account's credits.
#
# The Actions pipeline is the one worth keeping — it also applies database
# migrations, asserts the row level security invariants against the real
# project, corrects the auth redirect URLs, and checks the site is actually
# serving before calling itself done. Netlify's integration does none of that.
#
# Unlinking leaves deploys to the CLI and API, which is exactly how that
# pipeline ships. It changes nothing about the site that is live now.
#
# Run once, on 2026-09-03, and kept for the day someone reconnects the
# repository from the Netlify dashboard by accident: there is no workflow
# wired to it, so running it is a deliberate act.

set -uo pipefail

: "${NETLIFY_AUTH_TOKEN:?NETLIFY_AUTH_TOKEN is required}"
: "${NETLIFY_SITE_ID:?NETLIFY_SITE_ID is required}"

BASE="https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}"
AUTH=(-H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}")

# Only ever print these. The site object carries build settings, and a whole
# body in a build log is how a secret escapes.
show_repo() {
  curl -sS -o /tmp/site.json -w '' --max-time 30 "${AUTH[@]}" "$BASE" 2>/dev/null
  jq -r '"  repo_url:     \(.build_settings.repo_url // "none")\n  provider:     \(.build_settings.provider // "none")\n  auto publish: \(.published_deploy.branch // "?")"' \
    /tmp/site.json 2>/dev/null
}

echo "▸ before"
show_repo

echo "▸ unlinking"
code="$(curl -sS -o /tmp/unlink.json -w '%{http_code}' --max-time 30 \
  -X PUT "${AUTH[@]}" "${BASE}/unlink_repo" 2>/dev/null || echo 000)"
echo "  PUT /unlink_repo  $code"
if [ "$code" -lt 200 ] || [ "$code" -ge 300 ]; then
  echo "  message: $(jq -r '.message // .error // "no message"' /tmp/unlink.json 2>/dev/null)" >&2
  echo "::error::Netlify refused to unlink the repository."
  exit 1
fi

echo "▸ after"
show_repo

if [ "$(jq -r '.build_settings.repo_url // "none"' /tmp/site.json 2>/dev/null)" != "none" ]; then
  echo "::error::The call succeeded but the repository is still linked."
  exit 1
fi

echo
echo "Netlify no longer builds this repository. Deploys come from the GitHub"
echo "Actions pipeline only. The live site is untouched."
