# MYCORP 조직 확장 명세
## Legal · Security · Product · Technology · Audit · Risk · Global

> **MYCORP — Your AI Company.**  
> One Founder. An Entire Company.

이 문서는 기존 MYCORP 조직도에 빠져 있던 핵심 기업 기능을 추가하기 위한 확장 명세다.

---

> **브랜드 정본:** [`docs/brand/BRAND.md`](../brand/BRAND.md) · **리네이밍 이력:** [`docs/spec/README.md`](./README.md)
> 제품명은 **MYCORP**다. `AI Company`는 제품 카테고리명으로만 사용한다.
> 섹션 번호는 §201–219이며, 01~03 명세(§72–200)에 이어지는 **연속 번호**다.


# 201. 최고 지배구조

```text
FOUNDER / CHAIRMAN
│
├─ AI Chief of Staff / 비서실
├─ Internal Audit Office / 감사실
├─ Enterprise Risk Office / 전사 리스크관리실
│
└─ Executive Board
   ├─ CEO / Chief Executive Officer
   ├─ CSO / Chief Strategy Officer
   ├─ CMO / Chief Marketing Officer
   ├─ CRO/CSO / Chief Revenue or Sales Officer
   ├─ COO / Chief Operating Officer
   ├─ CFO / Chief Financial Officer
   ├─ CDO / Chief Data Officer
   ├─ CTO / Chief Technology Officer
   ├─ CPO / Chief Product Officer
   ├─ CHRO / Chief Human Resources Officer
   ├─ CLO / Chief Legal Officer
   └─ CISO / Chief Information Security Officer
```

감사실과 전사 리스크관리실은 특정 임원 산하가 아니라 **Founder/Chairman 직속 독립 조직**으로 둔다.

---

# 202. Legal & Compliance Division
## 법무·준법본부 — CLO

### 계약법무팀
- 계약서 검토
- NDA
- 외주계약
- 공급계약
- 제휴계약
- 라이선스
- 이용약관
- 계약 위험조항 탐지

### IP & Brand Protection Team
- 상표
- 저작권
- 특허 관련 관리 지원
- 콘텐츠 권리
- 브랜드 도용 탐지
- 무단 사용 모니터링

### Privacy & AI Compliance Team
- 개인정보
- 데이터 처리
- AI 관련 규제
- 플랫폼 정책
- 국가별 개인정보 규제
- 데이터 보관 정책

### Dispute & Legal Risk Team
- 분쟁 가능성 분석
- 클레임 정리
- 증거자료 정리
- 내용증명 초안
- 사건 타임라인
- 외부 법률전문가 전달용 자료 작성

### Global Legal Team
- 해외 계약
- 국가별 사업 규제
- 해외 서비스 약관
- 글로벌 진출 법률 체크리스트

### Corporate Governance Team
- 회사 내부규정
- 권한체계
- 이사회/주주 관련 자료
- 내부 정책
- 승인 정책

> AI 법무팀은 법률전문가를 사칭하지 않는다. 실제 전문적 법률판단이 필요한 사안은 `EXTERNAL LEGAL REVIEW REQUIRED`로 분류한다.

---

# 203. Information Security Division
## 정보보안본부 — CISO

MYCORP는 메일, SNS, 광고, 예약, 고객, 매출, 결제 등 매우 민감한 시스템을 연결하므로 CISO를 독립 임원으로 둔다.

### Identity & Access Management
- 계정
- 역할
- 권한
- MFA
- OAuth
- 세션
- 기기 관리

### Credential Security
- API Key
- OAuth Token
- Refresh Token
- MCP Credential
- Secret Vault
- 암호화

### Security Monitoring
- 이상 로그인
- 비정상 API 호출
- 대량 다운로드
- 권한 오남용
- Agent 이상행동

### Incident Response
- 보안사고 탐지
- 계정 차단
- Token 폐기
- 영향 범위 분석
- 사고 보고서

### Data Security
- PUBLIC
- INTERNAL
- CONFIDENTIAL / 대외비
- SECRET / 기밀
- TOP SECRET / 극비

### AI Security
- Prompt Injection 방어
- Tool Permission
- Agent Isolation
- Data Leakage 방지
- 외부 콘텐츠 신뢰도 검증

---

# 204. Technology Division
## 기술본부 — CTO

MYCORP를 사용하는 Founder가 SaaS, 앱, 웹서비스 또는 디지털 사업을 운영할 경우 기술조직도 제공한다.

### Software Engineering
- Web
- Backend
- Mobile
- API
- Database

### AI Engineering
- LLM
- Agent
- RAG
- MCP
- Tool Calling
- Model Routing

### DevOps / Platform
- 배포
- CI/CD
- Monitoring
- Infrastructure
- Cloud
- Backup

### QA Engineering
- 테스트
- 회귀검사
- 오류 탐지
- Release QA

### Technical Architecture
- 시스템 설계
- API Architecture
- Integration Architecture
- 기술부채 관리

---

# 205. Product Division
## 제품본부 — CPO

### Product Strategy
- 제품 전략
- Roadmap
- 시장 요구
- 경쟁 제품

### Product Management
- PRD
- Feature
- Backlog
- Priority
- Release

### UX Research
- 고객 인터뷰
- 행동 분석
- 사용성 문제
- VOC

### Product Analytics
- Activation
- Retention
- Conversion
- Feature Usage
- Churn

### Product Experimentation
- A/B Test
- Prototype
- MVP
- 신규 기능 검증

CTO는 **어떻게 만들 것인가**, CPO는 **무엇을 왜 만들 것인가**를 담당한다.

---

# 206. Procurement & Vendor Management
## 구매·조달·협력업체 관리

### Procurement Team
- 견적 비교
- 구매
- 외주
- 장비
- SaaS

### Vendor Management
- 공급업체 평가
- 계약기간
- 비용
- 서비스 품질
- 갱신 관리

### SaaS Cost Optimization
- 사용하지 않는 구독 탐지
- 중복 SaaS 탐지
- 요금제 최적화
- 갱신일 관리

---

# 207. PR & Corporate Communications
## 홍보·대외협력본부

### PR Team
- 보도자료
- 언론 대응
- 인터뷰
- 미디어 리스트

### Corporate Communications
- 회사 소개
- Founder 소개
- 공식 발표
- 대외 메시지

### Reputation Management
- 브랜드 평판
- 부정 이슈
- 검색 결과
- 온라인 여론

### Partnership Relations
- 기관
- 기업
- 협회
- 커뮤니티
- 전략 파트너

---

# 208. Investor Relations
## IR·투자전략

필요한 기업에 동적으로 생성한다.

### Fundraising
- 투자유치 전략
- 투자자 후보 발굴
- 투자 일정

### Investor Materials
- Pitch Deck
- Executive Summary
- Business Plan
- KPI
- Data Room

### Investor Relations
- 투자자 문의
- 업데이트
- 미팅 준비
- 후속조치

### Valuation Intelligence
- 비교기업
- 시장
- 성장률
- 투자사례

---

# 209. Internal Audit Office
## 감사실 — 회장 직속

MYCORP의 핵심 차별화 조직.

AI가 AI의 결과를 그대로 믿지 않고 **독립적으로 검증한다.**

### Performance Audit
- 보고 수치 검증
- KPI 산식 검증
- 과장 보고 탐지

### Financial Audit
- 비용
- 광고비
- 이상 지출
- 중복 결제

### Agent Audit
- AI 직원 권한 사용
- Tool Call
- 오류
- 정책 위반
- 불필요한 비용

### Execution Audit
- 승인받은 내용과 실제 실행 비교

### Example

마케팅본부:

> ROAS 320%를 달성했습니다.

감사실:

> 반품과 취소를 반영한 실질 ROAS는 241%입니다.

비서실장:

> 회장님, 마케팅본부 보고와 감사실 검증 결과에 차이가 있어 함께 보고드립니다.

---

# 210. Enterprise Risk Office
## 전사 리스크관리실 — 회장 직속

각 부서의 개별 위험을 회사 전체 관점에서 통합한다.

Risk Categories:

- STRATEGIC
- FINANCIAL
- LEGAL
- SECURITY
- OPERATIONAL
- REPUTATIONAL
- CUSTOMER
- PLATFORM
- AI
- MARKET

### Risk Register

각 위험에 저장:

- risk_name
- category
- probability
- impact
- severity
- owner
- mitigation
- detected_at
- status

비서실장은 중요한 위험만 Founder에게 보고한다.

---

# 211. R&D / Innovation Lab
## 미래전략·혁신연구소

### AI Technology Research
- 신규 AI 모델
- Agent Framework
- MCP
- Automation
- Computer Vision
- Voice AI

### Business Innovation
- 신규 비즈니스 모델
- 신규 수익원
- 산업 변화

### Experimental Projects
- Prototype
- Proof of Concept
- 신규 Workflow

### Technology Watch
- 경쟁 기술
- 신규 SaaS
- AI 트렌드

---

# 212. Global Business Division
## 글로벌사업본부

전 세계 1인 창업자를 위한 MYCORP에서 중요한 조직이다.

### Market Expansion
- 진출 국가 분석
- 시장 규모
- 경쟁사
- 현지 채널

### Localization
- 언어
- 문화
- 가격
- 메시지
- 콘텐츠

### Global Partnerships
- 현지 파트너
- 유통
- 제휴

### International Operations
- 국가별 운영
- 시간대
- 고객 대응
- 해외 서비스

### Global Compliance
법무본부와 협업하여 국가별 규제를 검토한다.

---

# 213. 최종 MYCORP 조직 체계

```text
FOUNDER / CHAIRMAN
│
├── OFFICE OF THE CHIEF OF STAFF
│   ├── AI Chief of Staff
│   ├── Executive Assistant
│   ├── Reporting Secretary
│   └── Approval Office
│
├── INTERNAL AUDIT OFFICE
│
├── ENTERPRISE RISK OFFICE
│
├── EXECUTIVE BOARD
│   ├── CEO
│   ├── CSO  → Strategy
│   ├── CMO  → Marketing & Brand
│   ├── CRO  → Sales & Growth
│   ├── COO  → Operations
│   ├── CFO  → Finance
│   ├── CDO  → Data & Intelligence
│   ├── CTO  → Technology
│   ├── CPO  → Product
│   ├── CHRO → People & Organization
│   ├── CLO  → Legal & Compliance
│   └── CISO → Information Security
│
├── CUSTOMER EXPERIENCE
├── CREATIVE STUDIO
├── PROCUREMENT & VENDOR MANAGEMENT
├── PR & CORPORATE COMMUNICATIONS
├── INVESTOR RELATIONS
├── R&D / INNOVATION LAB
└── GLOBAL BUSINESS
```

---

# 214. 조직은 모든 회사에 똑같이 생성하지 않는다

MYCORP의 중요한 원칙:

**회사에 필요 없는 부서를 억지로 만들지 않는다.**

예를 들어 1인 카페 Founder에게 처음부터 IR팀 8명이나 Software Engineering 본부가 필요하지 않다.

회사 업종, 규모, 목표, 연결 서비스, 업무량에 따라 조직을 동적으로 구성한다.

예:

### Local Restaurant
- 비서실
- CMO
- 마케팅
- CRM
- 리뷰관리
- 예약운영
- 재무
- 데이터
- 법무 Specialist
- 보안 Specialist

### Solo SaaS Founder
- 비서실
- Strategy
- Product
- CTO
- Engineering
- Marketing
- Sales
- Data
- Finance
- Legal
- Security
- Customer Success

### Creator
- 비서실
- Content
- Creative Studio
- Social
- Brand
- Sales
- Partnership
- Finance
- Legal/IP

회사가 성장하거나 새로운 Integration이 연결되면 MYCORP가 먼저 조직 확장을 제안한다.

> “회장님, 최근 B2B 문의가 증가했습니다. 현재 마케팅본부에서 영업 업무까지 처리하고 있습니다. 영업본부를 신설하는 것을 제안드립니다.”

---

# 215. AI 조직 신설 제안

새 부서가 필요하면 AI가 Founder에게 제안한다.

예:

> **조직개편 제안**
>
> 최근 해외 고객 비중이 18%까지 증가했습니다.
>
> 현재 마케팅본부와 CS팀에서 해외 업무를 분산 처리하고 있어 대응 효율이 낮아지고 있습니다.
>
> `Global Business Division` 신설을 제안합니다.
>
> 예상 AI 직원: 6명  
> 예상 월 AI 비용: $XX  
> 기대효과: 해외 대응시간 단축, 현지화 강화
>
> [승인] [수정] [보류]

승인하면 조직도가 실제로 변경된다.

---

# 216. AI 임원회의

중요한 의사결정에는 여러 임원이 참여한다.

예:

Founder:

> “미국 시장 진출할까?”

비서실장:

> “관련 임원회의를 소집하겠습니다.”

CSO:
시장성과 경쟁구조 분석

CMO:
고객획득 전략

CFO:
비용 및 손익

CLO:
법적 요구사항

CISO:
데이터 및 보안 위험

COO:
운영 가능성

Global Division:
현지화 전략

↓

비서실장이 통합:

- 추천
- 반대 의견
- 비용
- 예상효과
- 위험
- 필요한 결정

↓

Founder 결정

---

# 217. Three Lines of Defense

MYCORP의 AI 자율성을 안전하게 운영하기 위해 다음 구조를 적용한다.

## 1차 방어
실행 부서

CMO / COO / Sales / Product 등

자신의 업무에 대한 기본 검토 수행.

## 2차 방어
Risk / Legal / Security / Compliance

실행 전 정책 및 위험 검토.

## 3차 방어
Internal Audit

이미 수행된 업무와 시스템 자체를 독립적으로 감사.

---

# 218. 최종 철학

MYCORP의 목표는 AI Agent를 많이 보여주는 것이 아니다.

**Founder 한 명이 실제 기업의 기능을 가질 수 있게 만드는 것**이다.

마케팅이 필요하면 마케팅본부가 생기고,

제품이 필요하면 제품본부가 생기고,

기술이 필요하면 CTO 조직이 생기고,

해외에 진출하면 글로벌사업본부가 생긴다.

그리고 법무·보안·리스크·감사 조직이 AI의 자율성을 통제한다.

Founder는 모든 AI 직원을 직접 관리하지 않는다.

**비서실장에게 말한다.**

비서실장이 필요한 조직을 움직인다.

---

# 219. MYCORP 최종 메시지

**MYCORP**

**Your AI Company.**

**One Founder. An Entire Company.**

다른 서비스가 AI 직원을 제공한다면,

MYCORP는 **기업 전체를 제공한다.**

---

# 220. 부록 — 기존 명세와의 정합성 조정

§201–219는 §72–200의 조직을 **대체하지 않고 확장한다.**
확장 과정에서 발생한 충돌과 접점을 아래와 같이 정리한다. 이 부록이 우선한다.

---

## 220.1 CSO 중의성 해소 (필수 정정)

기존 명세 01에서 `CSO`가 두 의미로 쓰이고 있었다.

| 위치 | 기존 표기 | 문제 |
|---|---|---|
| 11F 경영전략실 | CSO = Chief **Strategy** Officer | — |
| 10F 임원 / 8F 영업본부 | CSO = Chief **Sales** Officer | 동일 약어 중복 |

**확정:**

| 약어 | 정식 명칭 | 담당 |
|---|---|---|
| `CSO` | Chief **Strategy** Officer | 경영전략·시장정보·신사업 (11F 계열) |
| `CRO` | Chief **Revenue** Officer | 영업·매출·성장 (8F 영업본부) |

`Chief Sales Officer`라는 명칭은 더 이상 사용하지 않는다.
UI·보고 문장·조직도 모두 `CRO`로 표기한다. 01 명세에 반영 완료.

> 한국어 표시: CSO → 전략총괄, CRO → 영업총괄. 단 UI 기본 표기는 영문 약어를 유지한다
> (사용자가 "임원"으로 인지하는 데 영문 약어가 더 효과적이다).

---

## 220.2 Executive Board 최종 구성

| 구분 | 구성 | 성격 |
|---|---|---|
| 회장 직속 | Office of the Chief of Staff / Internal Audit Office / Enterprise Risk Office | **상설**. 어떤 회사에서도 생략하지 않는다 |
| Executive Board | CEO · CSO · CMO · CRO · COO · CFO · CDO · CTO · CPO · CHRO · CLO · CISO | **조건부**. §214에 따라 필요한 임원만 임명 |

**CEO에 관한 주의.** 사용자는 Founder/Chairman이며, 동시에 CEO 호칭을 선택할 수 있다
(`BRAND.md` §5, `LOCALIZATION.md`). §201의 `CEO` 임원은 **사용자가 CEO 역할을 AI에 위임한 경우에만** 생성한다.
사용자가 스스로를 CEO라 부르는데 AI CEO가 별도로 존재하면 지배구조가 모순된다.

| 사용자 호칭 | AI CEO 생성 |
|---|---|
| 회장님 / Chairman / Founder | 선택 가능 (일상 경영을 위임) |
| CEO / 대표님 | **생성하지 않는다** (사용자가 곧 CEO) |

---

## 220.3 본사 건물은 고정 12층이 아니라 동적 타워다

§214("회사에 필요 없는 부서를 억지로 만들지 않는다")를 건물 UX에 그대로 적용한다.
**층수는 회사마다 다르다.** 부서가 생기면 층이 삽입되고 타워가 자란다 (§136 Company Grows With User).

**고정 규칙**

- `1F ~ 9F`, `B1`, `B2` 는 **번호 고정**. 어떤 회사에서도 의미가 같다.
- `10F 이상`은 **동적**. 회사가 임명한 임원 수만큼 존재한다.
- **회장실은 언제나 최상층**이다. 층 번호가 아니라 `TOP`으로 식별한다.
- 감사실·리스크관리실은 언제나 회장실 **바로 아래**. 임원층보다 위에 둔다 (독립성의 시각적 표현).

**기본 스택 — 소상공인 (12층)**

01 명세의 현재 구조가 그대로 기본값이다. 법무·보안은 층 없이 Specialist로 호출한다.

**전체 스택 — Full Enterprise (20층)**

```text
20F  TOP   CHAIRMAN FLOOR                  회장실 · 비서실 · 결재실
19F        AUDIT & RISK FLOOR              감사실 · 전사리스크관리실   [회장 직속]
18F        EXECUTIVE BOARD                 CEO·CSO·CMO·CRO·COO·CFO·CDO·CTO·CPO·CHRO·CLO·CISO
17F        EXECUTIVE STRATEGY              경영전략실 · 시장정보실 · 신사업개발실
16F        LEGAL & COMPLIANCE       CLO    [조건부]
15F        INFORMATION SECURITY     CISO   [조건부]
14F        TECHNOLOGY               CTO    [조건부]
13F        PRODUCT                  CPO    [조건부]
12F        GLOBAL BUSINESS                 [조건부]
11F        R&D / INNOVATION LAB            [조건부]
10F        CORPORATE AFFAIRS               PR · IR · 구매/벤더  [조건부]
─────────────────────────────────────────── 이하 번호 고정 ───
 9F        MARKETING & BRAND        CMO
 8F        SALES & GROWTH           CRO
 7F        DATA & INTELLIGENCE      CDO
 6F        OPERATIONS               COO
 5F        FINANCE & BUSINESS ADMIN CFO
 4F        PEOPLE & ORGANIZATION    CHRO
 3F        CUSTOMER EXPERIENCE
 2F        CREATIVE STUDIO
 1F        LOBBY                           Unified Inbox · Connect Center
 B1        AI INFRASTRUCTURE               Orchestrator · Tool Gateway · MCP
 B2        DATA VAULT & SYSTEM CORE        Memory · Audit Vault · Backup
```

**층 삽입 순서**는 고정한다. 부서가 추가될 때마다 층 번호가 흔들리면 사용자가 건물을 기억할 수 없다.
새 본부는 위 표의 자기 자리에 삽입되고, 그 위층들의 번호가 하나씩 올라간다.

> 예: 12층 기본 스택에서 CISO를 임명 → INFORMATION SECURITY가 10F로 삽입,
> 기존 10F/11F/12F(임원층·전략실·회장실)는 11F/12F/13F로 상승. 회장실은 여전히 `TOP`.

---

## 220.4 Three Lines of Defense ↔ Tool Gateway (§131)

§217의 3선 방어는 개념이 아니라 **Tool Gateway의 실행 경로 그 자체**로 구현한다.

```text
   AI 직원 (실행 부서)
        │            ← 1차 방어: 부서 자체 검토. Agent 프롬프트/역할 제약에 내장
        ▼
   ┌─────────────── TOOL GATEWAY ───────────────┐
   │  Permission Engine   (권한: §132, §188)     │
   │  Risk Engine         (위험: §210 Register)  │   ← 2차 방어: 실행 경로 안에서
   │  Policy / Approval   (결재: §112, §113)     │      **차단 가능(blocking)**
   │  Legal Gate          (§202 계약·규제)        │
   │  Credential Vault    (§110, §187)          │
   └────────────────────┬───────────────────────┘
                        ▼
              Integration Adapter → External Service
                        │
                        ▼
                   AUDIT LOG (B2 Audit Vault)
                        │
                        ▼            ← 3차 방어: 실행 경로 **밖에서**, 사후, 비동기
              INTERNAL AUDIT OFFICE (§209)
```

**설계 제약 (구현 시 강제)**

1. 1차·2차 방어는 **동기·차단형**이다. 통과하지 못한 Action은 외부에 나가지 않는다.
2. 3차 방어(감사실)는 **실행을 막지 않는다.** 사후에 검증하고 회장에게 보고한다.
   감사실이 실행 경로에 들어가면 모든 업무가 느려지고, 감사실이 곧 실행 주체가 되어 독립성을 잃는다.
3. **감사실 Agent는 다른 부서가 만든 요약을 읽지 않는다.** 반드시 B2 Audit Vault의 원본 로그와
   Integration의 원천 데이터를 직접 읽는다. 마케팅본부의 보고서를 근거로 마케팅본부를 감사하는 것은 감사가 아니다.
4. 감사실·리스크관리실은 **어떤 임원에게도 보고하지 않는다.** 비서실장을 거쳐 회장에게만 보고한다.

§209의 ROAS 예시(320% vs 실질 241%)가 성립하려면 3·4가 반드시 지켜져야 한다.

---

## 220.5 감사실은 §151(No False Execution)의 시스템적 구현이다

§151은 "Agent가 거짓말하지 않는다"는 **행동 규칙**이다.
§209 감사실은 그 규칙이 지켜졌는지 **검증하는 조직**이다.

| 계층 | 장치 | 실패 시 |
|---|---|---|
| 규칙 | §151 No False Execution | Agent가 스스로 지켜야 함 |
| 구조 | Tool Gateway가 실제 실행 여부를 기록 | 실행하지 않은 것은 로그에 없음 |
| 검증 | 감사실 Execution Audit — 승인 내용 vs 실제 실행 비교 | 불일치를 회장에게 보고 |

즉 §209의 Execution Audit은 **"승인된 것과 다르게 실행되었는가"** 와
**"실행했다고 보고했는데 실제로는 실행되지 않았는가"** 를 동시에 잡는다.
후자가 없으면 §151은 지켜지기를 바라는 문장에 그친다.

---

## 220.6 CISO 신설로 소유 조직이 생기는 기존 명세

기존 명세에 흩어져 있던 보안 요구사항의 **책임 조직**이 §203으로 확정된다.

| 기존 명세 | 소유 팀 (§203) |
|---|---|
| §110 Credentials Security | Credential Security |
| §111 Browser Session Security | Credential Security + AI Security |
| §116 App Authentication / Biometrics | Identity & Access Management |
| §180–182 보안등급 (공개/사내한/대외비/기밀/극비) | Data Security |
| §183 Automatic Security Detection | Data Security |
| §187 Secret Vault | Credential Security |
| §188 Need-To-Know | Identity & Access Management |
| §130 MCP Permission | AI Security |

### AI Security가 막아야 하는 실제 경로

§203의 `Prompt Injection 방어 / 외부 콘텐츠 신뢰도 검증`은 추상적 항목이 아니다.
MYCORP는 아래 경로로 **외부인이 작성한 텍스트를 Agent에게 먹인다.**

| 경로 | 명세 | 위험 |
|---|---|---|
| 고객 이메일 본문 | §81 Email Integrations | 메일에 심어진 지시가 Agent 지시로 둔갑 |
| 리뷰·댓글·DM | §85, §125 Unified Inbox | 리뷰 텍스트에 심어진 명령 |
| 경쟁사 웹사이트 | §102 URL as Input, §157 경쟁사 조사 | 크롤링 대상이 악의적으로 작성 |
| 업로드 스크린샷/문서 | §100, §101 | 이미지 내 텍스트 명령 |
| 다른 회사의 공개 Workflow | §175 Fork Workflow | **다른 사용자가 작성한 실행 가능한 구조** |
| MCP Server 도구 설명 | §130 | 서드파티가 제공한 텍스트 |

**원칙:** 외부에서 들어온 모든 콘텐츠는 **데이터이지 지시가 아니다.**
Agent는 외부 콘텐츠를 근거로 Tool을 호출할 수 있으나, 외부 콘텐츠가 **권한·승인 정책·보안등급을
바꾸도록 허용하지 않는다.** §175 Fork Workflow는 특히 위험하므로 복제 시 원본의 권한 설정을 승계하지 않고
**수입 회사의 정책으로 재평가**한다.

---

## 220.7 조직 신설(§215)과 직원 채용(§134)의 구분

| 항목 | §134 Dynamic Hiring | §215 조직 신설 제안 |
|---|---|---|
| 단위 | AI 직원 | 본부 / 팀 |
| 계기 | Integration 연결 | 업무량·비중 변화, 임원 부재 |
| 예 | SmartStore 연결 → Commerce Specialist 배치 | 해외 비중 18% → Global Business Division 신설 |
| 승인 | 배치 확인 | 회장 결재 (조직도 변경) |
| 담당 | 4F Organization Development | 4F Organization Development + CHRO |

둘 다 4F 인사·조직본부가 소유한다. §215의 제안 카드에 표시하는
`예상 AI 직원 수 / 예상 월 AI 비용`은 5F Cost Management Team이 산출한다 (추측값을 쓰지 않는다).

---

## 220.8 법무의 한계 표시 (§202) ↔ §104 Capability Resolver

§202의 `EXTERNAL LEGAL REVIEW REQUIRED`는 §104 Integration Capability Resolver,
§150 Integration Status, §151 No False Execution과 **같은 원칙의 법무 버전**이다.

| 영역 | 못 하는 것을 표시하는 방법 |
|---|---|
| 외부 연동 | `READ_ONLY` / `PARTNER_REQUIRED` / `UNAVAILABLE` (§150) |
| 실행 | "초안까지 준비했습니다" (§151) |
| 법무 | `EXTERNAL LEGAL REVIEW REQUIRED` (§202) |
| 보안 | 권한 없음을 그대로 보고 (§188) |

AI 법무팀은 계약서를 **검토**하고 위험 조항을 **표시**하되, 법률 자문을 제공하지 않는다.
"이 계약은 문제없습니다" 라고 말하지 않는다.

---

## 220.9 조직 프리셋과 클리어런스·브랜드 문서의 관계

§214의 업종별 프리셋(Local Restaurant / Solo SaaS Founder / Creator)은
온보딩에서 첫 조직도를 생성하는 **시드 데이터**로 구현한다. 프리셋은 시작점일 뿐이며
§215에 따라 언제든 확장된다.

프리셋에 관계없이 **항상 생성되는 것**: 비서실 · 감사실 · 리스크관리실.
프리셋에 관계없이 **절대 자동 생성하지 않는 것**: IR (사용자가 투자유치를 명시할 때만).
