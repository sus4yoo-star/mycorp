# MYCORP24 본사 층별 소개 및 조직도
## MYCORP24 Headquarters

**MYCORP24**  
**Your Company. Always On.**

**One Founder. An Entire Company.**

MYCORP24는 1인 창업자와 소규모 사업자가 수십 명의 AI 임직원으로 구성된 하나의 기업을 운영할 수 있도록 만드는 AI Company Operating System이다.

사용자는 MYCORP24의 최고 의사결정권자이며, AI 임직원에게 일일이 업무를 지시하지 않는다.

**회장 / Founder → 비서실장 → 최고경영진 → 본부 → 팀 → AI 직원**

의 실제 기업 구조를 통해 회사를 운영한다.

---

> **브랜드 정본:** [`docs/brand/BRAND.md`](../brand/BRAND.md) · **리네이밍 이력:** [`docs/spec/README.md`](./README.md)
> 제품명은 **MYCORP24**다. `AI Company`는 제품 카테고리명으로만 사용한다.
> 브랜드·네이밍·호칭에서 이 명세와 브랜드 문서가 충돌하면 브랜드 문서가 우선한다.


# 전체 본사 구조

아래는 **기본 스택(Default Stack)** 이다. 소상공인 회사가 처음 설립될 때의 12층 구조다.

**본사 층수는 회사마다 다르다.** 부서가 신설되면 층이 삽입되고 타워가 자란다.
`1F ~ 9F`와 `B1 / B2`는 어떤 회사에서도 번호와 의미가 같고, `10F 이상`은 동적이다.
**회장실은 층 번호와 무관하게 언제나 최상층(`TOP`)** 이다.

전체 스택(Full Enterprise, 20층)과 층 삽입 규칙은
[04 명세 §220.3](./04-organization-expansion.md)을 따른다.

```text
                 MYCORP24 HEADQUARTERS

┌──────────────────────────────────────────────┐
│ 12F  CHAIRMAN FLOOR                         │
│      회장실 · 비서실 · 결재실 · VIP 회의실       │
├──────────────────────────────────────────────┤
│ 11F  EXECUTIVE STRATEGY FLOOR               │
│      경영전략실 · 신사업실 · CEO Office          │
├──────────────────────────────────────────────┤
│ 10F  EXECUTIVE BOARD FLOOR                  │
│      CMO · CRO · COO · CFO · CDO · CHRO      │
├──────────────────────────────────────────────┤
│ 9F   MARKETING & BRAND DIVISION             │
│      마케팅 · 브랜드 · 콘텐츠 · 광고 · CRM        │
├──────────────────────────────────────────────┤
│ 8F   SALES & GROWTH DIVISION                │
│      영업 · 제휴 · 리드 · Growth · 고객성공       │
├──────────────────────────────────────────────┤
│ 7F   DATA & INTELLIGENCE DIVISION           │
│      데이터 · BI · 시장정보 · AI 분석             │
├──────────────────────────────────────────────┤
│ 6F   OPERATIONS DIVISION                    │
│      운영 · 예약 · 자동화 · 품질 · 공급망          │
├──────────────────────────────────────────────┤
│ 5F   FINANCE & BUSINESS ADMINISTRATION      │
│      재무 · 회계 · 예산 · 비용 · 경영관리          │
├──────────────────────────────────────────────┤
│ 4F   PEOPLE & ORGANIZATION                  │
│      인사 · 조직 · AI 직원관리 · 성과관리          │
├──────────────────────────────────────────────┤
│ 3F   CUSTOMER EXPERIENCE CENTER             │
│      CS · 리뷰 · VOC · 커뮤니티 · 고객관리         │
├──────────────────────────────────────────────┤
│ 2F   CREATIVE STUDIO                        │
│      디자인 · 영상 · 이미지 · 숏폼 · 제작          │
├──────────────────────────────────────────────┤
│ 1F   MYCORP24 LOBBY                           │
│      통합 Inbox · 안내 · 방문자 · Connect Center   │
├──────────────────────────────────────────────┤
│ B1   AI INFRASTRUCTURE CENTER               │
│      Agent · MCP · API · Automation · Security│
├──────────────────────────────────────────────┤
│ B2   DATA VAULT & SYSTEM CORE               │
│      Memory · Database · Audit · Backup       │
└──────────────────────────────────────────────┘
```

기본 스택에서 법무·보안·기술·제품은 전용 층 없이 **Specialist로 호출**된다.
해당 임원(CLO · CISO · CTO · CPO)이 임명되면 전용 층이 생성된다 (04 명세 §214, §215).

감사실과 전사 리스크관리실은 **어떤 회사에서도 생략하지 않는다.**
기본 스택에서는 12F 회장 직속으로 두고, 임원층이 늘어나면 회장실 바로 아래 전용 층으로 분리된다.

---

# 12F — CHAIRMAN FLOOR
## 회장실 · 비서실

MYCORP24에서 가장 높은 층이며 사용자의 공간이다.

이 층에는 AI 직원이 많은 것이 아니라, **기업 전체의 의사결정이 모이는 공간**이 위치한다.

### 회장실
Chairman Office / Founder Office

사용자의 개인 경영 공간.

주요 기능:

- 오늘의 경영현황
- 주요 KPI
- 매출
- 비용
- 고객
- 광고
- 예약
- 주문
- 긴급 이슈
- AI 제안
- 결재 대기
- 경영 목표

회장실 화면에서는 회사 전체를 한눈에 볼 수 있다.

---

### 비서실
Office of the Chief of Staff

MYCORP24에서 가장 중요한 조직.

구성:

**AI Chief of Staff / 비서실장**

**Executive Assistant**

**Scheduling Secretary**

**Reporting Secretary**

**Communication Secretary**

**Protocol & Priority Agent**

비서실장은 모든 회장 지시를 받아 기업 업무로 변환한다.

예:

회장:

"요즘 왜 장사가 안 돼?"

비서실장:

"데이터본부와 마케팅본부에 원인 분석을 지시하겠습니다."

---

### 결재실
Executive Approval Room

회장의 결재가 필요한 모든 안건.

- 광고비 집행
- 게시물 게시
- 고객 메시지
- 가격 변경
- 프로모션
- 예약 변경
- 계약
- 비용 지출
- 주요 정책 변경

---

### Executive Briefing Room

비서실장과 최고경영진이 회장에게 보고하는 공간.

---

### Board Room

회장이 AI 임원회의를 소집하는 공간.

예:

"임원들 의견 들어보자."

CMO

CFO

COO

CSO

CRO

CDO

등이 각자의 관점에서 의견을 제시한다.

임명된 임원에 따라 CTO · CPO · CLO · CISO도 참석한다 (04 명세 §216).

---

# 11F — EXECUTIVE STRATEGY FLOOR
## 경영전략실

회사의 방향을 설계하는 층.

### Chief Strategy Officer

경영전략을 총괄한다.

---

## 전략기획실

업무:

- 연간 사업계획
- 월간 전략
- KPI
- 목표관리
- 사업 포트폴리오
- 경영성과 분석

AI 직원:

Strategy Director

Business Strategy Manager

Strategic Planning Analyst

KPI Analyst

---

## 시장정보실

업무:

- 시장규모
- 경쟁사
- 업계 동향
- 가격
- 소비자 변화
- 트렌드

AI 직원:

Market Intelligence Lead

Competitor Analyst

Trend Researcher

Pricing Analyst

---

## 신사업개발실

업무:

- 신규 사업
- 신규 상품
- 신규 서비스
- 제휴
- 새로운 수익모델

AI 직원:

Business Development Director

New Business Manager

Opportunity Researcher

Business Model Analyst

---

# 10F — EXECUTIVE BOARD FLOOR
## 최고경영진

MYCORP24의 AI 임원들이 근무하는 층.

```text
                    CHAIRMAN

                       │
               AI CHIEF OF STAFF

                       │
 ┌─────────┬─────────┬─────────┬─────────┬─────────┐
 │   CMO   │   CRO   │   COO   │   CFO   │   CDO   │
 │Marketing│ Revenue │Operations│Finance │ Data    │
 └─────────┴─────────┴─────────┴─────────┴─────────┘

                 CHRO / CLO
```

---

## CMO
Chief Marketing Officer

마케팅 총괄.

---

## CRO
Chief Revenue Officer

매출과 영업 총괄.

> `CSO`는 Chief **Strategy** Officer(11F 경영전략실)로만 사용한다.
> 영업 총괄은 `CRO`다. 정정 근거는 04 명세 §220.1.

---

## COO
Chief Operating Officer

운영 총괄.

---

## CFO
Chief Financial Officer

재무 총괄.

---

## CDO
Chief Data Officer

데이터 및 경영 Intelligence 총괄.

---

## CHRO
Chief Human Resources Officer

조직 및 AI Workforce 총괄.

---

## CLO
Chief Legal & Compliance Officer

법무·리스크·규정 검토.

초기에는 필요 시 호출되는 Specialist 형태로 운영할 수 있다.

---

# 9F — MARKETING & BRAND DIVISION
## 마케팅본부

CMO 산하 핵심 조직.

MYCORP24 초기 버전에서 가장 강력하게 구현해야 하는 층이다.

---

## 9F-A 브랜드전략팀

업무:

- Brand Strategy
- Positioning
- Brand Identity
- Brand Voice
- 고객 인식
- 경쟁 브랜드

주요 AI 직원:

Brand Director

Brand Strategist

Brand Researcher

Positioning Specialist

---

## 9F-B 콘텐츠마케팅팀

업무:

- 블로그
- SNS
- 뉴스레터
- 상세페이지
- 광고 카피
- 콘텐츠 전략

AI 직원:

Content Director

Content Strategist

Copywriter

Blog Writer

SEO Writer

Social Copywriter

---

## 9F-C Performance Marketing Team

업무:

- Meta Ads
- Google Ads
- Naver Ads
- TikTok Ads
- ROAS
- CAC
- Conversion

AI 직원:

Performance Director

Paid Media Manager

Meta Ads Specialist

Google Ads Specialist

Naver Ads Specialist

Conversion Analyst

---

## 9F-D CRM & Retention Team

업무:

- 재구매
- 재방문
- 휴면고객
- Loyalty
- 고객 Segment
- 쿠폰
- CRM Campaign

AI 직원:

CRM Director

Retention Manager

Customer Segmentation Analyst

Lifecycle Marketing Specialist

---

## 9F-E Search / SEO / GEO Team

업무:

- Google Search
- Naver Search
- SEO
- Local SEO
- GEO
- AI Search
- Keyword

AI 직원:

SEO Lead

Naver Search Specialist

GEO Specialist

Keyword Analyst

---

## 9F-F Social Media Team

Instagram

TikTok

YouTube

Facebook

Threads

LinkedIn

Naver Blog

AI 직원:

Social Director

Instagram Manager

YouTube Manager

TikTok Manager

Community Manager

---

# 8F — SALES & GROWTH DIVISION
## 영업본부

CRO 산하.

마케팅에서 들어온 관심 고객을 실제 매출로 연결한다.

---

## Sales Strategy Team

영업전략

가격정책

Offer 설계

판매 Funnel

---

## Lead Generation Team

잠재고객 발굴

기업 리스트

영업기회 탐색

Inbound Lead

Outbound Lead

---

## Partnership Team

제휴

B2B

Influencer

지역 제휴

기업 파트너십

---

## Growth Team

실험

Conversion

Referral

Upsell

Cross Sell

Growth Loop

---

## Customer Success Team

구매 후 관리

재계약

Upsell

고객 이탈 방지

---

# 7F — DATA & INTELLIGENCE DIVISION
## 데이터본부

MYCORP24의 두뇌.

CDO가 총괄한다.

---

## Data Analytics Team

매출

주문

예약

광고

고객

상품

시간대

지역

등 모든 데이터를 분석한다.

---

## Business Intelligence Team

경영 Dashboard

KPI

Forecast

Anomaly Detection

---

## Customer Intelligence Team

고객 행동

Segment

LTV

Churn

Repeat Rate

---

## Competitive Intelligence Team

경쟁업체

가격

광고

SNS

리뷰

상품

시장점유

---

## Forecasting Team

매출예측

예약예측

수요예측

광고성과예측

---

# 6F — OPERATIONS DIVISION
## 운영본부

COO 산하.

사업의 실제 운영을 관리한다.

---

## Operations Planning

업무 운영

스케줄

Resource Planning

---

## Reservation Operations

Naver Reservation

Yanolja

Booking

Agoda

자체예약

등의 예약 정보를 관리한다.

---

## Commerce Operations

주문

배송

재고

상품

반품

---

## Process Automation Team

반복 업무 자동화.

MCP

API

Webhook

n8n형 Workflow

Browser Automation

---

## Quality Management

운영 이상

오류

고객불만

품질

서비스 관리

---

# 5F — FINANCE & BUSINESS ADMINISTRATION
## 재무본부

CFO 산하.

---

## Financial Planning Team

매출

예산

목표

손익

Forecast

---

## Cost Management Team

광고비

SaaS 비용

운영비

고정비

변동비

---

## Accounting Intelligence Team

세금계산서

매출/매입

증빙

회계자료 분석

---

## Cash Flow Team

현금흐름

지출

Runway

예상 잔액

---

## Profitability Team

상품별 수익

채널별 수익

고객별 수익

캠페인별 수익

---

# 4F — PEOPLE & ORGANIZATION
## 인사·조직본부

MYCORP24의 특이한 부서.

실제 사람뿐 아니라 **AI 직원 자체를 관리한다.**

---

## AI Workforce Management

AI 직원 배치

Agent 생성

역할 변경

Skill 추가

Agent 제거

---

## Performance Management

AI 직원별:

업무량

성과

정확도

비용

실패율

평균처리시간

---

## Organization Development

회사의 성장에 따라 조직을 자동 확장한다.

예:

Instagram 연결

↓

Social Team 강화

Yanolja 연결

↓

OTA Operations Team 생성

SmartStore 연결

↓

Commerce Team 생성

---

# 3F — CUSTOMER EXPERIENCE CENTER
## 고객경험센터

고객이 회사와 만나는 모든 접점을 관리한다.

---

## Customer Service Team

Email

DM

문의

예약

CS

---

## Review Management Team

Naver Place

Google

Yanolja

여기어때

쇼핑몰 리뷰

등 관리.

---

## VOC Intelligence Team

고객 불만

요구

칭찬

개선사항을 분석한다.

---

## Community Team

SNS 댓글

Community

회원

Follower

Fan

관리.

---

# 2F — CREATIVE STUDIO
## 크리에이티브 제작센터

마케팅본부와 협업하지만 독립 Studio 형태로 운영한다.

---

## Creative Director Office

Creative 전체 방향.

---

## Design Team

광고

Banner

Poster

SNS

Thumbnail

Brand Visual

---

## Image AI Team

AI Image Generation

Product Image

Campaign Visual

---

## Video Team

Shorts

Reels

TikTok

YouTube

광고영상

---

## Motion Team

Motion Graphic

Animation

Visual Effects

---

## Creative QA

Brand Consistency

Text

Visual

Format

Platform Specification

검수.

---

# 1F — MYCORP24 LOBBY
## 통합 업무 입구

각종 외부 정보가 MYCORP24로 들어오는 곳.

---

## Unified Inbox

Gmail

Outlook

Instagram

Kakao

Naver

Website

Customer Inquiry

등.

---

## Connect Center

외부 서비스 연결.

예:

Google

Naver

Kakao

Meta

Instagram

YouTube

TikTok

SmartStore

Cafe24

Yanolja

Booking

Agoda

POS

---

## Document Reception

Excel

CSV

PDF

Screenshot

Image

계약서

영수증

명함

업로드.

AI가 어떤 부서에서 처리할지 자동 판단한다.

---

# B1 — AI INFRASTRUCTURE CENTER
## AI 인프라센터

눈에는 직원들이 보이지만 실제 모든 AI 업무가 돌아가는 핵심 시스템.

---

## Agent Orchestrator

어떤 AI 직원을 호출할지 결정.

---

## Tool Gateway

모든 외부 API/MCP 호출 관리.

---

## MCP Center

MCP Server 관리.

---

## Integration Gateway

Naver

Google

Meta

Kakao

Yanolja

등 Adapter 관리.

---

## Workflow Automation Engine

Scheduled Workflow

Event Workflow

Conditional Workflow

---

## AI Model Gateway

Claude

OpenAI

Gemini

기타 AI 모델 관리.

Agent에 가장 적합한 모델을 배정한다.

---

## Security Center

Permission

Authentication

Credential

Risk

Approval Policy

---

# B2 — DATA VAULT & SYSTEM CORE
## 기업 기억 및 데이터 금고

MYCORP24가 회사에 대해 기억하는 모든 정보.

---

## Company Memory

사업 정보

제품

서비스

가격

브랜드

고객

경쟁업체

---

## Chairman Memory

회장 성향

선호 보고 방식

예산 성향

의사결정 기준

---

## Decision Memory

과거 결정.

예:

"할인은 하지 않는다."

"광고비 100만원 이상은 항상 결재."

---

## Audit Vault

누가

언제

무슨 데이터를 보고

어떤 판단을 했으며

어떤 Action을 실행했는지 기록.

---

# MYCORP24 전체 조직도

```text
                         FOUNDER / CHAIRMAN
                                │
                                │
                       AI CHIEF OF STAFF
                            비서실장
                                │
             ┌──────────────────┴──────────────────┐
             │                                     │
     Corporate Strategy                     Executive Board
             │                                     │
         Strategy                   ┌───────────────┼───────────────┐
         New Business               │               │               │
         Intelligence              CMO             CRO             COO
                                    │               │               │
                              Marketing          Revenue       Operations
                                    │               │               │
                         ┌──────────┼───────┐       │          ┌────┼─────┐
                         │          │       │       │          │    │     │
                       Brand     Content Performance Growth  Booking Commerce Automation
                         │          │       │
                       Social      SEO     CRM

                         Executive Board
                              │
                 ┌────────────┼────────────┐
                 │            │            │
                CDO          CFO          CHRO
                 │            │            │
               Data        Finance      Organization
                 │            │            │
        ┌────────┼──────┐     │       AI Workforce
        │        │      │     │       Performance
       BI    Customer Forecast │       AI Hiring
                                 │
                          ┌──────┼──────┐
                          │      │      │
                        FP&A  Cost   Cash Flow


                      CUSTOMER EXPERIENCE
                              │
                   ┌──────────┼─────────┐
                   │          │         │
                   CS       Reviews    VOC


                       CREATIVE STUDIO
                              │
                ┌─────────────┼─────────────┐
                │             │             │
              Design        Image         Video
                                              │
                                           Motion


                       AI INFRASTRUCTURE
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
       Orchestrator       Tool Gateway     Integration Hub
           │                  │                  │
        Agents            API / MCP          External Apps
```

---

# 회장의 실제 지시 흐름

예:

**"비서실장, 다음 달 매출 20% 올릴 방법 가져와."**

12F 비서실

↓

11F 경영전략실
시장과 경쟁사 분석

↓

7F 데이터본부
지난 매출과 고객 분석

↓

9F 마케팅본부
신규 고객 전략

↓

8F 영업본부
전환과 매출전략

↓

5F 재무본부
예산 및 수익성 검토

↓

10F 임원회의

CMO / CFO / CRO 의견 취합

↓

12F 비서실장

최종 경영보고

↓

회장 결재

↓

각 본부 실행

이 흐름 자체가 MYCORP24의 핵심 제품 경험이다.

---

# 앱에서의 건물 표시

사용자는 Web에서는 건물 전체를 볼 수 있다.

예:

**MYCORP24 HQ**

12F  
CHAIRMAN FLOOR  
회장실 / 비서실  
● 회장님 접속중

11F  
STRATEGY  
● AI 6명 업무중

10F  
EXECUTIVE BOARD  
● 임원회의 진행중

9F  
MARKETING  
● 18명 업무중 · 11건 진행

8F  
SALES  
● 7명 업무중

7F  
DATA  
● 분석업무 4건

6F  
OPERATIONS  
● 예약 최적화 진행중

5F  
FINANCE  
● 오늘 비용 분석완료

4F  
ORGANIZATION  
● AI 직원 73명 관리

3F  
CUSTOMER EXPERIENCE  
● 신규문의 14건

2F  
CREATIVE STUDIO  
● 이미지 8건 · 영상 3건 제작중

1F  
LOBBY  
● 외부서비스 11개 연결

B1  
AI INFRASTRUCTURE  
● 정상

B2  
DATA VAULT  
● Secure

---

# MYCORP24의 핵심 조직 철학

일반 AI 서비스는 사용자가 여러 AI Agent를 직접 선택한다.

MYCORP24는 다르다.

사용자는 조직도를 알 필요조차 없다.

회장에게는 한 명만 있으면 된다.

**비서실장.**

그리고 비서실장이 기업 전체를 움직인다.

사용자가 말한다.

**"비서실장, 알아서 처리해."**

그러면 MYCORP24의 수십 명의 AI 직원이 각자 자신의 자리에서 업무를 시작한다.

사용자는 업무 진행 상황을 건물에서 볼 수 있고,

최종적으로는 보고받고,

판단하고,

결재한다.

그것이 MYCORP24다.

**MYCORP24**

**Your Company. Always On.**

**One Founder. An Entire Company.**