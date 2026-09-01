#!/usr/bin/env bash
#
# MYCORP24 naming clearance — automated portion.
#
# Checks domain registration for the MYCORP24 and AMOV candidate lists via
# RDAP, the official replacement for WHOIS. Everything else in
# docs/brand/NAMING_CLEARANCE.md needs a human: trademark search, an attorney's
# opinion on whether "24" carries distinctiveness, and app store name checks.
#
# Usage:  pnpm clearance            # or: bash scripts/clearance-check.sh
#
# Exit status is always 0 — this reports, it does not gate a build.

set -uo pipefail

COM_TLDS=(com net)
OTHER=(mycorp24.ai mycorp24.io mycorp24.app mycorp24.co mycorp24.dev)
DEFENSIVE=(getmycorp24.com mycorp24hq.com mycrop24.com my-corp24.com mycorp-24.com)
AMOV=(amov.com amov.io amov.studio amovlab.com)

green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }
dim()   { printf '\033[2m%s\033[0m'  "$1"; }

rdap_url() {
  case "${1##*.}" in
    com|net) echo "https://rdap.verisign.com/${1##*.}/v1/domain/$1" ;;
    *)       echo "https://rdap.org/domain/$1" ;;
  esac
}

check() {
  local domain="$1" url body code
  url="$(rdap_url "$domain")"
  body="$(curl -sS -m 20 -L -w $'\n%{http_code}' "$url" 2>/dev/null)" || {
    printf '  %-24s %s\n' "$domain" "$(dim 'lookup failed (network)')"
    return
  }
  code="${body##*$'\n'}"
  body="${body%$'\n'*}"

  case "$code" in
    404)
      printf '  %-24s %s\n' "$domain" "$(green 'AVAILABLE')"
      ;;
    200)
      local created expires
      created=$(printf '%s' "$body" | grep -o '"eventAction":"registration","eventDate":"[^"]*"' | head -1 | sed 's/.*"eventDate":"//;s/"//')
      expires=$(printf '%s' "$body" | grep -o '"eventAction":"expiration","eventDate":"[^"]*"' | head -1 | sed 's/.*"eventDate":"//;s/"//')
      printf '  %-24s %s  %s\n' "$domain" "$(red 'TAKEN')" \
        "$(dim "registered ${created:0:10} expires ${expires:0:10}")"
      ;;
    *)
      printf '  %-24s %s\n' "$domain" "$(dim "http $code")"
      ;;
  esac
}

section() { printf '\n\033[1m%s\033[0m\n' "$1"; }

printf '\033[1mMYCORP24 / AMOV — domain clearance\033[0m\n'
printf '%s\n' "$(dim "RDAP lookups. See docs/brand/NAMING_CLEARANCE.md for the full gate.")"

section "1차 도메인 (MYCORP24)"
for tld in "${COM_TLDS[@]}"; do check "mycorp24.$tld"; done
for d in "${OTHER[@]}"; do check "$d"; done

section "방어 등록 후보"
for d in "${DEFENSIVE[@]}"; do check "$d"; done

section "마스터 브랜드 (AMOV)"
for d in "${AMOV[@]}"; do check "$d"; done

cat <<'EOF'

이 스크립트가 확인하지 못하는 것 — 전부 사람이 해야 합니다:

  T1-T3  KIPRIS / USPTO 선행상표 조사
  T4     ★ "24"의 식별력 변리사 의견 — 이 게이트의 병목
  T5     ★ 결합 상표 필요 여부 → 로고 설계 조건을 결정합니다
  A1-A5  App Store / Google Play 앱 이름 (선착순 — 지금 예약)
  S1     @mycorp24 소셜 핸들 (선착순 — 지금 선점)

  체크리스트: docs/brand/NAMING_CLEARANCE.md
EOF
