# MYCORP — 호칭 현지화 (Address & Title Localization)

앱 이름은 전 세계 공통 **`MYCORP`** 하나다.
현지화하는 것은 **사용자를 부르는 호칭**과 **AI 임직원의 어투**뿐이다.

---

## 1. 원칙

1. **브랜드명은 번역하지 않는다.** 어느 지역에서도 `MYCORP`다.
2. **역할은 번역하지 않는다.** Chief of Staff / CMO / CFO 등 직책 체계는 공통 구조다. 표시 문자열만 현지어를 쓴다.
3. **호칭은 반드시 현지화한다.** 한국에서 "Founder님"은 어색하고, 미국에서 "Chairman"은 과하다.
4. **사용자가 최종 결정권을 갖는다.** 지역 기본값은 첫 화면의 제안일 뿐, 언제든 바꿀 수 있다.

---

## 2. 지역별 기본 호칭

| 로케일 | 기본 호칭 | 인사 예시 |
|---|---|---|
| `ko-KR` | 회장님 | "좋은 아침입니다, 회장님." |
| `en-US` / `en-GB` | Founder | "Good morning, Founder." |
| `ja-JP` | 社長 | 「おはようございます、社長。」 |
| `zh-TW` / `zh-HK` | 董事長 | 「早安，董事長。」 |
| `es` / `pt` | Founder | "Buenos días, Founder." |
| 그 외 | Founder | — |

한국어 선택지 (사용자 전환용): `회장님` · `대표님` · `사장님` · `이사님` · 이름 + `님`
영어 선택지: `Founder` · `CEO` · `Chairman` · `President` · `Owner` · `Boss` · `Captain` · 이름 그대로

> 한국 기본값을 `회장님`으로 두는 것은 브랜드 전략이다.
> "사장님에서 회장님으로"는 이 제품이 파는 **신분 전환** 그 자체다 (`BRAND.md` §2).

---

## 3. 데이터 모델

명세 §167의 필드를 그대로 사용한다.

```ts
interface OwnerIdentity {
  owner_display_name: string;   // "유상철", "Alex"
  preferred_title: string;      // "회장님", "Founder", "Boss"
  preferred_nickname?: string;  // 비서실장이 편하게 부를 때
  locale: string;               // "ko-KR"
  address_form: 'title_only'    // "회장님"
              | 'name_title'    // "유상철 회장님"
              | 'name_only'     // "Alex"
              | 'custom';
}
```

**호출 문자열 생성 규칙**

| `address_form` | 결과 |
|---|---|
| `title_only` | `{preferred_title}` → "회장님" |
| `name_title` | `{owner_display_name} {preferred_title}` → "유상철 회장님" |
| `name_only` | `{owner_display_name}` → "Alex" |
| `custom` | 사용자가 입력한 문자열 그대로 |

호칭은 **문자열 조립이 아니라 로케일별 템플릿**으로 처리한다.
한국어는 `{name} {title}` 이지만 영어는 `{title} {name}` 이 자연스러운 경우가 있고,
일본어는 조사·경어 처리가 다르다. 하드코딩된 `` `${name}님` `` 을 만들지 않는다.

---

## 4. AI 임직원 이름

명세 §168. AI 직원 이름도 지역에 맞춰 제안하되, 사용자가 바꿀 수 있다.

| 옵션 | 설명 | 예 |
|---|---|---|
| `professional_local` | 현지 직장인 이름 + 직급 | 박콘텐츠 대리, 이광고 과장 |
| `global` | 영문 이름 | Olivia (CMO), James (Chief of Staff) |
| `role_only` | 직책만 | 비서실장, CMO |
| `custom` | 사용자 직접 입력 | — |
| `generated` | 회사 성격에 맞춰 자동 생성 | — |

기본값: `ko-KR`은 `professional_local`, 그 외는 `role_only`.

---

## 5. 어투 (Register)

호칭만 바꾸고 어투를 그대로 두면 어색해진다. 로케일별로 문장 레지스터가 달라야 한다.

| 로케일 | 레지스터 | 보고 예 |
|---|---|---|
| `ko-KR` | 격식체 (하십시오체), 두괄식 | "회장님, 오늘 결재는 2건입니다. 광고비 증액안과 가격 변경안입니다." |
| `en-US` | 간결한 executive brief, 존칭 최소 | "Two approvals today: an ad budget increase and a price change." |
| `ja-JP` | 丁寧語, 결론 후치 허용 | 「社長、本日の決裁は2件でございます。」 |

한국어 보고에서 영어 문장을 그대로 번역하면 비서실장이 아니라 번역기처럼 들린다.
**각 로케일의 보고 문장은 번역이 아니라 각각 작성한다.**

---

## 6. 체크리스트

- [ ] 앱 이름은 어떤 로케일에서도 `MYCORP` 로 표시된다
- [ ] 호칭 문자열이 코드에 하드코딩되어 있지 않다
- [ ] 온보딩에서 호칭을 물어보고, 설정에서 언제든 바꿀 수 있다
- [ ] Push 알림 문구도 호칭 템플릿을 사용한다 (명세 §114)
- [ ] 로케일별 보고 문장이 번역이 아니라 각각 작성되어 있다
