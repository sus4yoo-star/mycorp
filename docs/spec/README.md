# MYCORP24 Product Specification

네 문서는 **하나의 Product Specification**으로 취급한다.

| 문서 | 범위 |
|---|---|
| [`01-headquarters-organization.md`](01-headquarters-organization.md) | 본사 층별 구조, 전체 조직도, 지시 흐름 |
| [`02-omnichannel-web-ios-android.md`](02-omnichannel-web-ios-android.md) | §72–155 — 플랫폼, Integration, Tool Gateway, 승인·보안, 모바일 |
| [`03-proactive-social-security.md`](03-proactive-social-security.md) | §156–200 — 선제 제안, 경쟁사 인텔리전스, 기업 네트워크, 보안 등급 |
| [`04-organization-expansion.md`](04-organization-expansion.md) | §201–220 — 법무·보안·기술·제품·감사·리스크·글로벌 조직 확장, 3선 방어, 정합성 부록 |

섹션 번호(§72–220)는 네 문서에 걸쳐 **연속**한다. 04 문서는 원본에서 §1–19로 작성되었으나
단일 명세로 합치면서 §201–219로 재번호했고, §220 부록이 추가되었다.

---

## 브랜드 리네이밍 이력 (2026-09-01)

제품명이 두 단계로 확정되었다. **`AI COMPANY` → `MYCORP` → `MYCORP24`.**

| 단계 | 변경 | 적용 범위 |
|---|---|---|
| 1 | `AI COMPANY` → `MYCORP` | 제품명 용법 전부 |
| 2 | `MYCORP` → **`MYCORP24`** | 제품명 용법 전부 |

세부 반영 내역:

| 변경 전 | 변경 후 | 비고 |
|---|---|---|
| `AI COMPANY` (제품명) | `MYCORP24` | 전 문서 |
| `aicompany://` → `mycorp://` | `mycorp24://` | §115 Deep Links |
| `# 109. AI Company Automation Engine` | `# 109. MYCORP24 Automation Engine` | 시스템 컴포넌트명 |
| `# 118. Share To AI COMPANY` | `# 118. Share To MYCORP24` | Share Extension |
| `mycorp.com/@alex` | `mycorp24.com/@alex` | §170 공개 프로필 URL |

`24`는 이름의 필수 구성요소다. 명세 어디에서도 `MYCORP`로 줄여 쓰지 않는다
([`../brand/BRAND.md`](../brand/BRAND.md) §3).

### 변경하지 않은 것

`AI Company`가 **카테고리 일반명사**로 쓰인 곳은 그대로 둔다.

- `AI Company Operating System` / `AI Company OS` — 제품 카테고리
- `AI Company Network` (§177) — 카테고리 기반 개념
- `Proactive AI Company` (문서 부제) — 서술

판단 기준: 그 자리에 우리 제품이 들어가면 `MYCORP24`, 업종·범주를 뜻하면 `AI Company`.
자세한 규칙은 [`../brand/BRAND.md`](../brand/BRAND.md) §6.

### ⚠️ `AMOV`가 예시로 등장하는 곳

§171 · §185 · §189의 `AMOV` / `AMOV AI COMPANY`는 **사용자의 회사 예시**로 쓰인 것이다.
그런데 `AMOV`는 이제 이 제품의 **마스터 브랜드**이기도 하다
([`../brand/BRAND.md`](../brand/BRAND.md) §2).

명세 내부에서는 제작사 본인의 회사를 예시로 든 것이므로 그대로 두었으나,
**대외 공개 자료 · 스크린샷 · 데모 데이터에서는 중립적인 예시 회사명을 쓸 것을 권장한다.**
독자가 "AMOV가 사용자 회사인가, 제작사인가"를 혼동하게 된다.

---

## 조직 정정 이력 (2026-09-01, 04 명세 반영)

| 항목 | 변경 | 근거 |
|---|---|---|
| `CSO` 중의성 | 영업 총괄을 `CRO`(Chief Revenue Officer)로 분리. `CSO`는 Chief **Strategy** Officer 전용 | §220.1 |
| 본사 층 구조 | 고정 12층 → **동적 타워**. 1F–9F·B1·B2 고정, 10F 이상 동적, 회장실은 언제나 최상층 | §220.3 |
| 임원회의 참석자 | CTO · CPO · CLO · CISO 추가 | §216, §220.2 |
| 회장 직속 조직 | 비서실 + **감사실 + 전사 리스크관리실** (상설, 생략 불가) | §201, §220.2 |

01 명세에 위 내용이 반영되어 있다.

---

## 명세를 읽기 전에

브랜드 · 네이밍 · 호칭 · 메시지에 관한 결정은 명세가 아니라
[`../brand/BRAND.md`](../brand/BRAND.md)가 정본이다.
명세와 브랜드 문서가 충돌하면 **브랜드 문서가 이긴다.**
