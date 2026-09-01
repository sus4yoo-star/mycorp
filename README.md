# MYCORP24

**Your Company. Always On.**

> **사장님에서, 회장님으로.**
> 이제 직접 하지 말고, 지시하세요.

MYCORP24는 1인 사업자 · 소상공인 · 창업자에게 **하나의 AI 도구가 아니라 하나의 AI 회사 전체**를
제공하는 **AI Company OS**다.

사용자는 AI를 운영하지 않는다. 사용자는 **자신의 회사를 운영한다.**

```text
Founder / Owner / Chairman  →  AI Chief of Staff (비서실장)  →  Executive Board  →  본부  →  팀  →  AI 직원
```

회장에게 필요한 인터페이스는 하나다. **비서실장.**

> **"비서실장, 알아서 처리하고 중요한 것만 나한테 보고해."**

```text
AI prepares.  Founder approves.  Company executes.
```

**MYCORP24 by AMOV**

---

## 제품 판단 기준

모든 기획 · UI/UX · 카피 · 데이터 구조 · 기능 결정은 이 질문을 통과해야 한다.

> **"이 기능은 사용자를 더 바쁜 사장으로 만드는가, 아니면 지시하고 판단하는 회장으로 만드는가?"**

사용자가 반복 작업을 직접 해야 한다면 AI 조직이 맡도록 재설계한다.
단 금전 · 법률 · 보안 · 외부 공개는 승인 체계를 유지한다.

---

## 문서

### 브랜드

| 문서 | 내용 |
|---|---|
| [`docs/brand/BRAND.md`](docs/brand/BRAND.md) | **브랜드 정본.** 브랜드 구조(AMOV ▸ MYCORP24) · 메시지 · 표기 규칙 · 아이덴티티 · 보이스 · 결정 이력 |
| [`docs/brand/MESSAGING.md`](docs/brand/MESSAGING.md) | 캠페인 카피 · 포지셔닝 · 랜딩페이지 · 광고 콘셉트 |
| [`docs/brand/NAMING_CLEARANCE.md`](docs/brand/NAMING_CLEARANCE.md) | **도메인 · 상표 · 앱스토어 클리어런스 게이트** (디자인 착수 전 필수) |
| [`docs/brand/LOCALIZATION.md`](docs/brand/LOCALIZATION.md) | 사용자 호칭 현지화 (회장님 / Founder / 社長 …) |

### 개발

| 문서 | 내용 |
|---|---|
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | 모노레포 구조, 실행 방법, 지켜야 하는 제약 |
| [`supabase/README.md`](supabase/README.md) | 멀티테넌트 스키마와 RLS 규칙 |

### 제품 명세

| 문서 | 내용 |
|---|---|
| [`docs/spec/01-headquarters-organization.md`](docs/spec/01-headquarters-organization.md) | 본사 층별 구조와 전체 조직도 |
| [`docs/spec/02-omnichannel-web-ios-android.md`](docs/spec/02-omnichannel-web-ios-android.md) | §72–155 — Web + iOS + Android, Integration Framework, Tool Gateway, 승인 정책 |
| [`docs/spec/03-proactive-social-security.md`](docs/spec/03-proactive-social-security.md) | §156–200 — 선제 제안 엔진, 경쟁사 인텔리전스, 기업 네트워크, 보안 등급 |
| [`docs/spec/04-organization-expansion.md`](docs/spec/04-organization-expansion.md) | §201–220 — 법무·보안·기술·제품·감사·리스크·글로벌, 3선 방어, 정합성 부록 |

네 문서는 **하나의 Product Specification**으로 취급한다. 섹션 번호 §72–220은 연속한다.

---

## 브랜드 요약

| 항목 | 값 |
|---|---|
| 마스터 브랜드 | **AMOV** |
| 제품 | **MYCORP24** (`MYCORP24 by AMOV`) |
| 슬로건 | Your Company. Always On. |
| 카테고리 | AI Company OS |
| 앱 이름 | **MYCORP24** — Web / iOS / Android 동일 |
| 사용자 역할 | Founder / Owner / Chairman (호칭만 현지화) |
| 첫 인터페이스 | AI Chief of Staff (비서실장) |

`MYCORP` = My Corporation, `24` = Always On. **`24`는 이름의 일부다.** 줄여 부르지 않는다.
`AI Company`는 제품명이 아니라 **카테고리**다 — [`BRAND.md`](docs/brand/BRAND.md) §6.

---

## 빠른 시작

```bash
pnpm install
pnpm dev          # 전체 개발 서버
pnpm test         # 전 패키지 테스트
pnpm test:db      # RLS 정책 테스트 (임시 Postgres)
pnpm clearance    # 도메인 클리어런스 RDAP 조회
```

자세한 내용은 [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## 현재 상태

**다음 마일스톤:**

1. 🔴 **네이밍 클리어런스** — 도메인 / 상표 / 앱스토어 ([게이트](docs/brand/NAMING_CLEARANCE.md))
2. ⬜ 브랜드 아이덴티티 디자인 (클리어런스 통과 후)
3. ✅ Monorepo 스캐폴딩 — `apps/web` (Next.js 16), `apps/mobile` (Expo), `packages/*`
4. 🟡 Supabase Multi-Tenant 스키마 + RLS — 스키마 완료, Auth 연결 남음
5. ⬜ 비서실장 Chat + Chat Action Router
6. 🟡 Integration Framework + Tool Gateway + Credential Vault — 계약·파이프라인 완료, Adapter 구현 남음

> ⚠️ **1번을 통과하기 전에 2번을 시작하지 않는다.** 특히 `24`의 상표 식별력 판단(T4·T5) 결과에 따라
> 로고를 "워드마크 단독"이 아니라 "워드마크 + 도형 결합"으로 설계해야 할 수 있다.
> 순서를 바꾸면 로고를 다시 그려야 한다.

---

## 기술 방향

| 영역 | 선택 |
|---|---|
| Web | Next.js |
| Mobile | React Native + Expo |
| Backend / DB / Auth | Supabase (Multi-Tenant) |
| Deployment | Netlify (`netlify.toml`) |
| AI | Claude 우선. **AI Provider Abstraction**(`packages/ai-gateway`)을 두어 교체·병행 가능하게 설계 |
| Monorepo | pnpm workspaces + Turborepo |

**데모 UI가 아니라 실제 SaaS로 구축한다.** 필수 구성요소:
실제 회원가입/로그인 · 회사별 데이터 분리 · 조직 상태 저장 · AI 업무 orchestration ·
Task state · Approval state · Activity logs · Reports · Notifications · Integrations · Security/permissions

---

## 아키텍처 원칙 (요약)

명세 §155 및 §220에서 확정된 최상위 제약. 구현 시 이 원칙들이 우선한다.

- **Web + Mobile 공유 아키텍처** — Monorepo, 공통 Backend
- **모든 UI 기능은 자연어로도 실행 가능** — UI Action ↔ Chat Action 1:1 대응 (§143)
- **Integration은 Adapter Pattern** — Provider별 하드코딩 금지 (§78)
- **Agent는 외부 API를 직접 호출하지 않는다** — 반드시 Tool Gateway 경유 (§131)
- **연결 우선순위** — 공식 API → MCP → Webhook/Email → 승인된 Browser Automation → Screen Understanding (§79)
- **보안 우회 금지** — CAPTCHA · 2FA · 약관 우회 없음 (§111)
- **거짓 실행 금지** — 못 하는 일을 했다고 말하지 않는다 (§151)
- **비용 · 게시 · 발송 · 예약 변경은 결재를 거친다** (§112)
- **3선 방어** — 1·2차(부서 검토 / Permission·Risk·Legal)는 Tool Gateway 안에서 차단형, 3차(감사실)는 실행 경로 밖에서 사후 독립 감사 (§217, §220.4)
- **감사실 · 리스크관리실은 회장 직속** — 어떤 임원에게도 보고하지 않는다 (§201)
- **외부 콘텐츠는 데이터이지 지시가 아니다** — 메일 · 리뷰 · 크롤링 · 업로드 · Fork한 Workflow 모두 (§220.6)

### 조직은 회사마다 다르게 생성된다

본사 층수는 고정이 아니다. 업종 · 규모 · 연결 서비스에 따라 필요한 본부만 만들고,
필요해지면 MYCORP24가 먼저 조직 신설을 제안한다 (§214, §215).
`1F–9F` · `B1` · `B2`는 고정, `10F 이상`은 동적, **회장실은 언제나 최상층**이다 (§220.3).
