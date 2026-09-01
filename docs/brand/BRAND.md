# MYCORP — 브랜드 정본 (Brand Canon)

> 이 문서가 브랜드에 관한 **단일 진실 원천(Single Source of Truth)** 이다.
> 제품 명세(`docs/spec/`), UI 카피, 스토어 등록정보, 마케팅 자산은 모두 이 문서를 따른다.
> 충돌이 있으면 이 문서가 이긴다.

---

## 1. 브랜드 한 장 요약

| 항목 | 값 |
|---|---|
| 브랜드명 | **MYCORP** |
| 디스크립터 | **Your AI Company.** |
| 제품 카테고리 | AI Company Operating System |
| 앱 이름 (Web / iOS / Android) | **MYCORP** (동일, 분기 없음) |
| 사용자의 역할 | Founder / Chairman / CEO (국가별 호칭 현지화) |
| 첫 번째 인터페이스 | **Chief of Staff (비서실장)** |
| 상태 | 네이밍 클리어런스 **미완료** → `NAMING_CLEARANCE.md` 참조 |

---

## 2. 핵심 메시지

### 글로벌

> **MYCORP**
> **Your AI Company.**
> *You lead. Your AI company works.*

메인 메시지:

> **One founder. An entire company.**

### 한국

> **사장님에서 회장님으로.**
> **MYCORP가 당신의 회사를 만들어드립니다.**

메인 메시지:

> **혼자 창업해도, 혼자 일할 필요는 없습니다.**

### 메시지 계층

```text
브랜드명        MYCORP
디스크립터      Your AI Company.
메인 메시지     One founder. An entire company.
                혼자 창업해도, 혼자 일할 필요는 없습니다.
전환 메시지     사장님에서 회장님으로.
행동 메시지     "비서실장, 알아서 처리하고 중요한 것만 나한테 보고해."
```

한국 시장에서는 **정서적 신분 상승("회장님")** 을, 글로벌에서는 **역할과 레버리지("You lead")** 를 앞세운다.
같은 문장을 직역하지 않는다. 한국 카피를 영어로 번역하면 우스워지고, 영어 카피를 한국어로 번역하면 밋밋해진다.

---

## 3. 브랜드 구조 (Brand Architecture)

MYCORP는 **단일 브랜드(Branded House)** 다. 서브 브랜드를 만들지 않는다.

```text
                        MYCORP
                  "Your AI Company."
                          │
    ┌─────────────────────┼─────────────────────┐
    │                     │                     │
  MYCORP               MYCORP                MYCORP
   (Web)                (iOS)               (Android)
    │                     │                     │
    └─────────────────────┴─────────────────────┘
                          │
              동일 Backend / Agent System /
           Conversation Memory / Approval System
```

### 3.1 금지되는 이름 분기

플랫폼이나 사용자 등급에 따라 앱 이름을 나누지 **않는다.**

| ❌ 쓰지 않는다 | ✅ 대신 |
|---|---|
| MYCORP Chairman | MYCORP |
| MYCORP CEO | MYCORP |
| MYCORP Mobile / MYCORP Web | MYCORP |
| MYCORP Pro / MYCORP Lite | 요금제 이름으로만 존재 (앱 이름은 MYCORP) |
| AI COMPANY | MYCORP |

이유: 사용자는 하나의 회사를 운영한다. 앱이 여러 개로 보이면 "회사 하나"라는 제품의 근본 은유가 깨진다.
기기가 달라도 회장은 같은 본사에 출근하는 것이다.

### 3.2 내부 고유명사 (Named Entities)

MYCORP 안의 구성요소는 브랜드명을 접두하지 않고, 기업 조직 용어를 그대로 쓴다.

| 개념 | 정식 명칭 (EN) | 정식 명칭 (KO) |
|---|---|---|
| 본사 전체 | MYCORP HQ | MYCORP 본사 |
| 사용자의 첫 접점 | Chief of Staff | 비서실장 |
| 임원진 | Executive Board (CEO·CSO·CMO·CRO·COO·CFO·CDO·CTO·CPO·CHRO·CLO·CISO) | 최고경영진 |
| 회장 직속 감사 | Internal Audit Office | 감사실 |
| 회장 직속 리스크 | Enterprise Risk Office | 전사 리스크관리실 |
| 결재 | Executive Approval | 결재 |
| 운영 활력 지표 | MYCORP Momentum | MYCORP 모멘텀 |
| 공개 기업 프로필 | MYCORP Company Profile | 기업 프로필 |
| 기업 네트워크 | MYCORP Network | MYCORP 네트워크 |
| 외부 연결 | Connect Center | 연결 센터 |

---

## 4. "AI Company"의 지위

**`AI Company`는 제품명이 아니라 제품 카테고리명이다.**

- ✅ "MYCORP is an AI Company Operating System."
- ✅ "MYCORP builds your AI company."
- ✅ "당신의 AI 기업" (일반명사)
- ❌ "AI COMPANY에 출근하십시오." → "MYCORP에 출근하십시오."
- ❌ 로고, 앱 이름, 스토어 타이틀, 도메인, URL scheme 에 `AI COMPANY` 사용

카테고리명을 우리가 만들어 쓰는 것은 전략적으로 유리하다.
MYCORP가 "AI Company"라는 카테고리를 정의한 브랜드로 인식되게 한다.
단, 카테고리는 **독점할 수 없으므로** 상표 출원 대상은 `MYCORP`이지 `AI COMPANY`가 아니다.

---

## 5. 사용자 호칭 (Localization)

앱 이름은 전 세계 공통 `MYCORP` 하나지만, **사용자를 부르는 호칭만 현지화한다.**
자세한 규칙과 필드 정의는 [`LOCALIZATION.md`](./LOCALIZATION.md).

요약:

| 지역 | 기본 호칭 |
|---|---|
| 한국 | 회장님 |
| 미국 / 글로벌 영어 | Founder |
| 일본 | 社長 |
| 그 외 | Founder |

사용자는 언제든 직접 바꿀 수 있다 (`preferred_title`).
`회장님 / 대표님 / 사장님 / Founder / CEO / President / Owner / Boss / Captain / Alex / 형` 등 자유 입력 허용.

---

## 6. 표기 규칙 (Wordmark & Casing)

| 맥락 | 표기 | 예 |
|---|---|---|
| 로고 / 워드마크 | `MYCORP` (전체 대문자) | MYCORP |
| 본문 / UI 텍스트 | `MYCORP` (전체 대문자) | "MYCORP가 당신의 회사를 만들어드립니다." |
| 도메인 / URL | 소문자 | `mycorp.com` |
| URL Scheme | 소문자 | `mycorp://approval/123` |
| 패키지 / 번들 ID | 소문자 역도메인 | `com.mycorp.app` |
| 코드 식별자 | 소문자 | `mycorp_company_id` |
| 소셜 핸들 | 소문자 | `@mycorp` |

- `MyCorp`, `Mycorp`, `MY CORP`, `My Corp` 표기는 사용하지 않는다.
- 소유격은 `MYCORP's` 가 아니라 문장을 다시 쓴다. (예: "MYCORP의 본사" / "the MYCORP HQ")

---

## 7. 아이덴티티 방향 (Identity Direction)

명세 §147을 브랜드 결정으로 확정한다.

**추구:** Premium Corporate Identity — 실제 기업의 인장(印章) 같은 무게감

- Building / Tower silhouette
- Monogram (M / MC)
- Corporate Seal
- Executive Emblem

**회피:**

- ✨ AI Sparkle 로고 (모든 AI 스타트업이 쓴다 — 카테고리를 정의하려는 브랜드가 카테고리 클리셰를 쓰면 안 된다)
- 로봇, 뇌, 회로 기판, 네온 그라디언트
- 귀여움 / 마스코트 / 게임화된 톤
- 채팅 말풍선 아이콘 (MYCORP는 챗봇이 아니다)

**톤:** 절제된, 신뢰할 수 있는, 기업적인. 사용자가 스크린샷을 찍어 SNS에 올렸을 때
"나 AI 툴 쓴다"가 아니라 **"나 회사 하나 운영한다"** 로 보여야 한다 (명세 §189).

> ⚠️ 시각 디자인 착수 전에 `NAMING_CLEARANCE.md`의 게이트를 통과해야 한다.

---

## 8. 보이스 & 톤

MYCORP의 목소리는 **유능한 비서실장의 목소리**다.

| 원칙 | 설명 | 예 |
|---|---|---|
| 보고하듯 쓴다 | 결론 먼저, 근거는 뒤에 | "회장님, 오늘 결재는 2건입니다." |
| 짧게 쓴다 | 회장은 긴 글을 읽지 않는다 | 기본 5줄 이내 |
| 다음 행동을 제안한다 | 정보만 던지지 않는다 | "…프로모션안을 만들까요?" |
| 거짓 실행을 하지 않는다 | 명세 §151 | "초안까지 준비했습니다. 게시 권한은 아직 연결되지 않았습니다." |
| 존중하되 아부하지 않는다 | 비서실장이지 아첨꾼이 아니다 | 위험은 위험이라고 보고한다 |

쓰지 않는 말: "AI가", "에이전트가", "프롬프트", "모델이", "토큰".
쓰는 말: "마케팅본부가", "데이터본부에서", "CMO가 검토 중입니다".

사용자는 AI를 운영하는 것이 아니라 **회사를 운영한다.** 용어가 그 사실을 배신하면 안 된다.

---

## 9. 브랜드 결정 이력

| 날짜 | 결정 | 비고 |
|---|---|---|
| 2026-09-01 | 제품명을 `AI COMPANY` → **`MYCORP`** 로 확정 | `AI Company`는 카테고리명으로 존치 |
| 2026-09-01 | Web / iOS / Android 앱 이름을 `MYCORP` 하나로 통일 | 등급·플랫폼별 이름 분기 금지 |
| 2026-09-01 | URL Scheme `aicompany://` → `mycorp://` | 명세 §115 반영 완료 |
| 2026-09-01 | 사용자 호칭만 국가별 현지화하기로 결정 | `LOCALIZATION.md` |
| 2026-09-01 | 영업 총괄 약어를 `CSO` → `CRO`로 분리 (`CSO`는 Strategy 전용) | 명세 §220.1 |
| — | 도메인 / 상표 / 스토어 클리어런스 | **미완료 (블로커)** |
