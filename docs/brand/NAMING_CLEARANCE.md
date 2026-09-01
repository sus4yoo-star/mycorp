# MYCORP — 네이밍 클리어런스 (Naming Clearance)

> **상태: 미완료 — 브랜드 디자인 착수 전 반드시 통과해야 하는 게이트.**
> 로고, 앱 아이콘, 스토어 등록정보, 도메인 구매, 상표 출원은 이 문서의 게이트를 통과한 뒤에 진행한다.

---

## 0. 왜 이 게이트가 필요한가

`MYCORP`는 **일반적인 단어 조합**(`my` + `corp`)이다. 이것은 장점이자 위험이다.

**장점** — 뜻이 즉시 읽힌다. 발음이 쉽다. 국제적으로 통한다. 카테고리를 정의하기 좋다.

**위험** — 정확히 그 이유로:

1. **선점 가능성이 매우 높다.** `mycorp.com`은 수십 년간 기술 문서에서 예시 도메인으로 쓰여 왔다(예: Windows DNS devolution 설명의 `MYSERVER.mycorp.com`). 미등록 상태일 가능성은 낮다.
2. **상표 식별력이 약하다.** 서술적/일반적 용어는 등록이 거절되거나, 등록되더라도 **권리 범위가 좁아 타인의 유사 사용을 막기 어렵다.**
3. **앱스토어 충돌 가능성.** `MyCorp`, `MyCorp HR`, `Mcorp` 류의 사내 포털·ERP·HR 앱이 다수 존재할 개연성이 크다. Apple/Google 모두 **혼동 가능한 앱 이름**을 거절할 수 있다.
4. **검색 노출(SEO/ASO) 희석.** 일반 단어는 브랜드 검색어를 우리 것으로 만들기 어렵다.

따라서 이 게이트의 목적은 단순히 "쓸 수 있나?"가 아니라
**"이 이름을 우리 자산으로 만들 수 있나?"** 를 판단하는 것이다.

---

## 1. 현재까지 확인된 것 (예비 조사, 비확정)

이 세션의 네트워크는 egress 허용목록으로 제한되어 있어 **RDAP/WHOIS·KIPRIS·USPTO·App Store Connect에 직접 조회할 수 없었다.**
아래는 일반 웹 검색으로 얻은 **참고 신호일 뿐이며, 법적·상업적 판단의 근거로 사용할 수 없다.**

| 항목 | 예비 신호 | 판단 |
|---|---|---|
| `mycorp.com` | 소유자 미확인. 기술 문서에서 예시 도메인으로 광범위하게 사용된 이력 | ⚠️ 선점되어 있을 가능성 높음 — **실측 필요** |
| 유사 상표 | `MYCORPORATION` (USPTO Reg. #2663123, MyCorporation Business Services, Inc. / 법인 설립 서비스) | ⚠️ 동일 분류는 아니나 **유사도 검토 필요** |
| 유사 앱 | Google Play에 `Mcorp` (팀 협업 앱) 존재 | ⚠️ 스토어 심사 시 혼동 가능성 검토 필요 |
| 한국 상표 (KIPRIS) | **미조회** | ❓ |
| App Store / Google Play 정밀 조회 | **미조회** | ❓ |

> 위 표의 어떤 항목도 "확인됨"이 아니다. 전부 §2의 실측으로 대체되어야 한다.

---

## 2. 실측 체크리스트 (Gate)

각 항목은 **증거(스크린샷·조회 ID·출력 JSON)를 남기고** 상태를 갱신한다.

### 2.1 도메인

| # | 항목 | 방법 | 상태 |
|---|---|---|---|
| D1 | `mycorp.com` 등록 여부·소유자·만료일 | RDAP `https://rdap.verisign.com/com/v1/domain/MYCORP.COM` | ☐ |
| D2 | 등록되어 있다면 인수 가능성·호가 | 도메인 브로커 문의 (예산 상한 먼저 결정) | ☐ |
| D3 | `mycorp.ai` / `mycorp.io` / `mycorp.app` / `mycorp.co` | RDAP | ☐ |
| D4 | `mycorp.co.kr` / `mycorp.kr` | KISA 후이즈 (whois.kr) | ☐ |
| D5 | 방어 등록 후보 (`getmycorp.com`, `mycorphq.com`, `mycorp.team`) | 레지스트라 | ☐ |
| D6 | 타이포스쿼팅 방어 (`mycrop.com`, `my-corp.com`) | 레지스트라 | ☐ |

**합격 기준:** 1차 도메인을 **소유하거나**, 명확한 인수 경로 + 예산 승인이 있을 것.
합의된 fallback이 없는 상태로 디자인을 시작하지 않는다.

### 2.2 상표

| # | 항목 | 방법 | 상태 |
|---|---|---|---|
| T1 | 한국 — 09류(소프트웨어), 42류(SaaS), 35류(광고·경영) 선행상표 | KIPRIS (kipris.or.kr) | ☐ |
| T2 | 미국 — 동일 분류 선행상표 | USPTO TESS / Trademark Search | ☐ |
| T3 | EU / 일본 — 필요 시 | EUIPO / J-PlatPat | ☐ |
| T4 | 식별력 자문 — `MYCORP` 단독 등록 가능성 | 변리사 의견서 | ☐ |
| T5 | 등록 가능성이 낮을 경우, **결합 상표**로 출원 검토 | 예: `MYCORP` + 도형(엠블럼) 결합, 또는 `MYCORP — Your AI Company` | ☐ |

**합격 기준:** 변리사로부터 (a) 출원 가능 또는 (b) 결합 상표로 출원 가능하다는 서면 의견 확보.

> 상표 출원 대상은 **`MYCORP`** 이다. `AI COMPANY`는 카테고리 일반명사이므로 출원하지 않는다.

### 2.3 앱스토어

| # | 항목 | 방법 | 상태 |
|---|---|---|---|
| A1 | App Store에 `MyCorp` / `My Corp` / `Mycorp` 동명·유사명 앱 존재 여부 | App Store 검색 (KR / US 스토어프론트 각각) | ☐ |
| A2 | Google Play 동일 조사 | Play 스토어 검색 (KR / US) | ☐ |
| A3 | App Store Connect에서 앱 이름 `MYCORP` 예약 시도 | App Store Connect (앱 이름은 선점 방식) | ☐ |
| A4 | Google Play Console 앱 이름 등록 가능 여부 | Play Console | ☐ |
| A5 | 번들 ID `com.mycorp.app` 확보 | ADC / Play Console — **D1 도메인 소유와 연동 권장** | ☐ |

**합격 기준:** 양대 스토어에서 앱 이름 `MYCORP` 확보 완료. 확보 못 하면 §4로 간다.

**주의:** App Store 앱 이름은 **선착순 예약제**다. 다른 게이트를 기다리지 말고 **A3/A4는 지금 바로** 시도한다. 비용이 들지 않고, 잃을 것이 없다.

### 2.4 소셜 핸들

| # | 항목 | 상태 |
|---|---|---|
| S1 | `@mycorp` — Instagram / X / Threads / LinkedIn / YouTube | ☐ |
| S2 | 확보 불가 시 통일 대체 핸들 결정 (예: `@mycorphq` — **전 채널 동일하게**) | ☐ |

### 2.5 법인·기타

| # | 항목 | 상태 |
|---|---|---|
| C1 | 국내 동일·유사 상호 법인 존재 여부 (등기 상호 검색) | ☐ |
| C2 | 부정적 연상 검색 (`mycorp scam`, `mycorp 사기` 등) | ☐ |
| C3 | 주요 진출 예정 언어권에서 발음·의미 문제 없는지 | ☐ |

---

## 3. 우선순위와 병렬 처리

```text
지금 즉시 (비용 0, 선착순 리스크)
  ├─ A3  App Store Connect 앱 이름 예약 시도
  ├─ A4  Google Play Console 앱 이름 확인
  └─ S1  소셜 핸들 선점

1주 내 (사실 확인)
  ├─ D1  mycorp.com RDAP
  ├─ D3/D4  대체 TLD / 국내 TLD
  ├─ T1/T2  KIPRIS / USPTO 선행상표 조사
  └─ A1/A2  스토어 유사명 조사

2~3주 (판단과 집행)
  ├─ T4  변리사 의견서
  ├─ D2  도메인 인수 협상 (필요 시)
  └─ ✅ GATE 판정 → 브랜드 디자인 착수
```

**A3·A4·S1은 다른 게이트를 기다리지 않는다.** 이름을 최종 확정하지 않더라도 예약 자체는 손해가 없다.

---

## 4. 게이트 실패 시 — 대응 순서

`MYCORP` 자체를 버리는 것은 **마지막 선택지**다. 순서대로 검토한다.

### 4.1 1순위 — 이름 유지, 자산만 조정

| 상황 | 대응 |
|---|---|
| `mycorp.com` 인수 불가 | `mycorp.ai` 를 1차 도메인으로 — AI 제품에는 오히려 자연스럽다 |
| 스토어 앱 이름 `MYCORP` 불가 | 스토어 표기만 `MYCORP — Your AI Company` (앱 내부·아이콘·마케팅은 `MYCORP` 유지) |
| 소셜 `@mycorp` 불가 | 전 채널 `@mycorphq` 로 통일 |
| 상표 단독 등록 곤란 | 워드마크+엠블럼 **결합 상표**로 출원 |

이 경우 브랜드는 그대로다. `BRAND.md`의 표기 규칙만 갱신한다.

### 4.2 2순위 — 이름 변경

동일 분류에 강한 선행상표가 있거나 스토어가 혼동을 이유로 거절하면 변경한다.
대체 후보는 **같은 개념(내 회사 / 조직 / 지휘)** 을 유지하되 식별력이 높아야 한다.

후보 방향 (확정 아님, 클리어런스 실패 시 별도 세션에서 도출):

- 조어형 — 사전에 없는 단어. 식별력·도메인·상표 모두 유리
- `MYCORP` + 접미형 — `MYCORP HQ` 등, 인지 자산 승계 가능
- 은유형 — 본사/집무실/인장 계열의 기업 은유

> 이름을 바꾸더라도 **브랜드 구조·메시지·조직 은유는 그대로 유지된다.**
> `BRAND.md`의 §2~§8은 이름과 독립적으로 설계되어 있다. 바꾸는 것은 워드마크뿐이다.

---

## 5. 게이트 판정

브랜드 디자인 착수 조건 — 아래 4개가 모두 ✅ 여야 한다.

- [ ] **도메인** — 1차 도메인 소유 또는 인수 경로 + 예산 확정
- [ ] **상표** — 변리사 서면 의견 (단독 또는 결합 출원 가능)
- [ ] **스토어** — App Store / Google Play 앱 이름 확보 (또는 §4.1 대체안 확정)
- [ ] **충돌** — 동일 분류 내 혼동 우려 상표·앱 없음

판정일: ____________  판정자: ____________  결과: ☐ 통과  ☐ 조건부 통과  ☐ 재검토

---

## 부록 — 근거 링크

- MyCorporation 상표 (Trademarkia): https://www.trademarkia.com/mycorporation-76384727
- Mcorp (Google Play): https://play.google.com/store/apps/details?id=com.mcorp.app
- KIPRIS (한국 특허정보넷): https://www.kipris.or.kr
- USPTO Trademark Search: https://tmsearch.uspto.gov
- App Store Connect: https://appstoreconnect.apple.com
- Google Play Console: https://play.google.com/console
