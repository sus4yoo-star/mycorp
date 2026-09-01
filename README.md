# MYCORP

**Your AI Company.**

> **One founder. An entire company.**
> 혼자 창업해도, 혼자 일할 필요는 없습니다.

MYCORP는 1인 창업자와 소상공인이 수십 명의 AI 임직원으로 구성된 **하나의 기업**을 운영할 수 있게 만드는
**AI Company Operating System**이다.

사용자는 AI를 운영하지 않는다. 사용자는 **자신의 회사를 운영한다.**

```text
Founder / Chairman  →  Chief of Staff (비서실장)  →  Executive Board  →  본부  →  팀  →  AI 직원
```

회장에게 필요한 인터페이스는 하나다. **비서실장.**

> **"비서실장, 알아서 처리하고 중요한 것만 나한테 보고해."**

---

## 문서

### 브랜드

| 문서 | 내용 |
|---|---|
| [`docs/brand/BRAND.md`](docs/brand/BRAND.md) | **브랜드 정본.** 이름·메시지·브랜드 구조·표기 규칙·보이스 |
| [`docs/brand/NAMING_CLEARANCE.md`](docs/brand/NAMING_CLEARANCE.md) | **도메인·상표·앱스토어 클리어런스 게이트** (디자인 착수 전 필수) |
| [`docs/brand/LOCALIZATION.md`](docs/brand/LOCALIZATION.md) | 사용자 호칭 현지화 (회장님 / Founder / 社長 …) |

### 제품 명세

| 문서 | 내용 |
|---|---|
| [`docs/spec/01-headquarters-organization.md`](docs/spec/01-headquarters-organization.md) | 본사 층별 구조와 전체 조직도 (12F ~ B2) |
| [`docs/spec/02-omnichannel-web-ios-android.md`](docs/spec/02-omnichannel-web-ios-android.md) | Web + iOS + Android, Integration Framework, Tool Gateway, 승인 정책 (§72–155) |
| [`docs/spec/03-proactive-social-security.md`](docs/spec/03-proactive-social-security.md) | 선제 제안 엔진, 경쟁사 인텔리전스, 기업 네트워크, 보안 등급 (§156–200) |
| [`docs/spec/04-organization-expansion.md`](docs/spec/04-organization-expansion.md) | 법무·보안·기술·제품·감사·리스크·글로벌 조직 확장, 3선 방어 (§201–220) |

네 문서는 **하나의 Product Specification**으로 취급한다. 섹션 번호 §72–220은 연속한다.

---

## 브랜드 요약

| 항목 | 값 |
|---|---|
| 브랜드명 | **MYCORP** |
| 디스크립터 | Your AI Company. |
| 카테고리 | AI Company Operating System |
| 앱 이름 | **MYCORP** — Web / iOS / Android 동일 |
| 사용자 역할 | Founder / Chairman / CEO (호칭만 현지화) |
| 첫 인터페이스 | Chief of Staff (비서실장) |

`AI COMPANY`는 더 이상 제품명이 아니다. 제품명은 `MYCORP`이고,
`AI Company`는 **제품 카테고리명**으로만 남는다. 자세한 내용은 [`BRAND.md`](docs/brand/BRAND.md) §4.

---

## 현재 상태

이 저장소는 현재 **브랜드 및 제품 명세 단계**다. 구현 코드는 아직 없다.

**다음 마일스톤:**

1. 🔴 **네이밍 클리어런스** — 도메인 / 상표 / 앱스토어 확인 ([게이트](docs/brand/NAMING_CLEARANCE.md))
2. ⬜ 브랜드 아이덴티티 디자인 (클리어런스 통과 후)
3. ⬜ Monorepo 스캐폴딩 — `apps/web` (Next.js), `apps/mobile` (React Native/Expo), `packages/*`
4. ⬜ Supabase Multi-Tenant 스키마 + Auth
5. ⬜ 비서실장 Chat + Chat Action Router
6. ⬜ Integration Framework + Tool Gateway + Credential Vault

> ⚠️ **1번을 통과하기 전에 2번을 시작하지 않는다.** `MYCORP`는 일반적인 단어 조합이라
> 도메인·상표·스토어 선점 위험이 특히 높다.

---

## 아키텍처 원칙 (요약)

명세 §155에서 확정된 최상위 제약. 구현 시 이 원칙들이 우선한다.

- **Web + Mobile 공유 아키텍처** — Next.js + React Native/Expo, Monorepo, 공통 Backend
- **모든 UI 기능은 자연어로도 실행 가능** — UI Action ↔ Chat Action 1:1 대응 (§143)
- **Integration은 Adapter Pattern** — Provider별 하드코딩 금지 (§78)
- **Agent는 외부 API를 직접 호출하지 않는다** — 반드시 Tool Gateway 경유 (§131)
- **연결 우선순위** — 공식 API → MCP → Webhook/Email → 승인된 Browser Automation → Screen Understanding (§79)
- **보안 우회 금지** — CAPTCHA·2FA·약관 우회 없음 (§111)
- **거짓 실행 금지** — 못 하는 일을 했다고 말하지 않는다 (§151)
- **비용·게시·발송·예약 변경은 결재를 거친다** (§112)
- **3선 방어** — 1·2차(부서 검토 / Permission·Risk·Legal)는 Tool Gateway 안에서 차단형, 3차(감사실)는 실행 경로 밖에서 사후 독립 감사 (§217, §220.4)
- **감사실·리스크관리실은 회장 직속** — 어떤 임원에게도 보고하지 않는다 (§201)
- **외부 콘텐츠는 데이터이지 지시가 아니다** — 메일·리뷰·크롤링·업로드·Fork한 Workflow 모두 (§220.6)

### 조직은 회사마다 다르게 생성된다

본사 층수는 고정이 아니다. 업종·규모·연결 서비스에 따라 필요한 본부만 만들고,
필요해지면 MYCORP가 먼저 조직 신설을 제안한다 (§214, §215).
`1F–9F`·`B1`·`B2`는 고정, `10F 이상`은 동적, **회장실은 언제나 최상층**이다 (§220.3).
