# MYCORP — Omni-Channel / Web + iOS + Android 확장 개발 명세

## 72. 제품 플랫폼 정의

MYCORP는 단순 웹 SaaS가 아니다.

최종 제품은 아래 세 플랫폼에서 동일한 AI 기업을 운영할 수 있어야 한다.

1. Web
2. iOS
3. Android

사용자는 PC에서는 본사 전체를 관리하고, 모바일에서는 회장용 비서실과 결재 시스템을 중심으로 사용한다.

모든 플랫폼은 동일한 Backend, Database, Agent System, Conversation Memory, Approval System을 공유한다.

즉 사용자가 PC에서 비서실장에게 지시하고 이동 중 iPhone에서 결재한 뒤 Android 태블릿에서 업무 진행 상황을 보더라도 모든 상태가 실시간으로 동일해야 한다.

---

> **브랜드 정본:** [`docs/brand/BRAND.md`](../brand/BRAND.md) · **리네이밍 이력:** [`docs/spec/README.md`](./README.md)
> 제품명은 **MYCORP**다. `AI Company`는 제품 카테고리명으로만 사용한다.
> 브랜드·네이밍·호칭에서 이 명세와 브랜드 문서가 충돌하면 브랜드 문서가 우선한다.


# 73. Recommended Platform Architecture

웹:

Next.js

모바일:

React Native + Expo를 우선 검토한다.

이유:

- iOS/Android 동시 개발
- TypeScript 공유
- Web Backend와 코드 공유 가능
- Push Notification
- Camera
- File Upload
- Deep Link
- OAuth
- App Store / Google Play 배포
- 향후 Native Module 확장 가능

권장 구조:

apps/web

apps/mobile

packages/ui

packages/types

packages/api-client

packages/agent-types

packages/business-logic

packages/integrations

packages/auth

Monorepo 방식으로 구성한다.

Turborepo 또는 적절한 Monorepo Tool 사용.

---

# 74. Mobile UX Philosophy

모바일에서는 건물 전체 UI보다 다음 기능을 우선한다.

## 홈

"좋은 아침입니다, ○○○ 회장님."

AI 비서실장

긴급보고

결재대기

오늘 실적

현재 일하는 AI 직원

---

## 비서실장 Chat

모바일 UX의 핵심.

사용자는 카카오톡이나 메신저처럼 비서실장과 대화한다.

텍스트

음성

사진

문서

스크린샷

URL

파일

Excel

CSV

PDF

등을 보낼 수 있다.

---

## 결재

Mobile Approval을 매우 중요하게 구현한다.

Push:

"회장님, CMO가 Meta 광고 증액안을 결재 요청했습니다."

알림 클릭.

↓

결재안

↓

승인

수정 지시

반려

사용자가:

"금액 절반으로 줄여서 진행해."

라고 자연어로 답할 수도 있다.

---

# 75. Voice Command

사용자는 모바일에서 음성으로 업무를 지시할 수 있어야 한다.

예:

"비서실장, 오늘 매출 어떻게 됐어?"

"내일 예약 비어 있는 시간 확인해."

"블로그 이번 주 거 작성해."

"오늘 광고비 너무 많이 나갔는데 확인해."

"야놀자 예약 현황 알려줘."

"네이버 플레이스 리뷰 안 좋은 거 정리해."

Voice

↓

Speech to Text

↓

Secretary General

↓

Intent

↓

Task

↓

Agent

↓

Report

---

# 76. Conversational Operating System

MYCORP의 가장 중요한 원칙:

**모든 기능은 가능하면 자연어 채팅으로 접근 가능해야 한다.**

사용자가 메뉴를 찾아다니지 않아도 된다.

예:

"인스타 연결해."

"네이버 계정 연결해."

"내 Gmail 연결해."

"유튜브 채널 추가해."

"야놀자 예약 가져와."

"네이버 플레이스 리뷰 보여줘."

"이번 달 광고비 알려줘."

"Meta 광고 잠깐 멈춰."

"이번 주 예약 없는 시간 프로모션 돌려."

"지난달 세금계산서 찾아."

"이번 주 고객 문의 중 화난 고객만 보여줘."

"다음 주 월요일 예약 고객한테 안내 보내."

시스템은 자연어를 System Action으로 변환해야 한다.

---

# 77. Chat Action Router

비서실장 Conversation 뒤에 Action Router를 구축한다.

사용자 발언:

"인스타 연결해."

Intent:

CONNECT_INTEGRATION

Integration:

INSTAGRAM

Action:

START_OAUTH

↓

비서실장:

"네, 회장님. Instagram Business 계정을 연결하겠습니다."

[Instagram 연결]

OAuth 완료 후:

"연결이 완료되었습니다."

---

사용자:

"네이버 플레이스 리뷰 최근 안 좋은 거 찾아봐."

Intent:

ANALYZE_REVIEWS

Source:

NAVER_PLACE

Conditions:

rating <= threshold

period = recent

↓

Integration Layer

↓

Data Fetch

↓

Review Analysis Agent

↓

Secretary Report

---

# 78. Universal Integration Architecture

모든 외부 서비스 연결을 각각 앱 코드에 직접 박지 않는다.

공통 Integration Framework를 만든다.

Base Interface:

IntegrationAdapter

connect()

disconnect()

healthCheck()

getCapabilities()

read()

write()

execute()

refreshToken()

getWebhookConfig()

sync()

---

각 Connector는 Capability를 선언한다.

예:

NAVER_PLACE

READ_REVIEWS

READ_PLACE_INFO

READ_STATS

UPDATE_PLACE_INFO

RESPOND_REVIEW

등.

지원하지 않는 기능은 false.

---

# 79. Integration Priority Hierarchy

외부 서비스 연결 방식은 반드시 다음 우선순위를 따른다.

## Tier 1 — Official API

가장 우선.

공식 API.

OAuth.

Partner API.

Webhook.

---

## Tier 2 — MCP / Official Connector

MCP Server 또는 공식 Connector 제공 시 사용.

---

## Tier 3 — Email / Webhook / Export Integration

공식 API가 부족하면:

Email ingestion

Webhook

CSV

Excel

ICS

RSS

Notification forwarding

등을 활용.

---

## Tier 4 — Browser Automation

사용자 승인 및 사용자가 소유한 계정 세션 기반으로 Browser Automation을 사용.

단:

서비스 약관 준수.

자동 로그인 비밀번호 저장 최소화.

Captcha 우회 금지.

보안 기능 우회 금지.

---

## Tier 5 — Screen Understanding

다른 방법이 없는 경우에만 사용.

사용자가 업로드한 스크린샷 또는 승인된 Browser Session 화면에서 정보를 읽는다.

예:

예약관리 화면 Screenshot

↓

Vision Model

↓

Reservation Extraction

↓

Structured Data

다만 이것은 최후 수단이며 핵심 서비스는 가능한 공식 연동으로 구성한다.

---

# 80. Integration Registry

integrations_catalog 테이블을 만든다.

필드:

id

provider

category

display_name

auth_type

connection_method

capabilities

read_supported

write_supported

approval_required

webhook_supported

mobile_supported

status

notes

---

# 81. Email Integrations

지원 목표:

Gmail

Microsoft Outlook

IMAP 가능한 일반 메일

기능:

메일 검색

메일 읽기

스레드 이해

첨부파일 분석

업무메일 분류

고객문의 분류

영업문의 추출

예약문의 추출

견적문의 추출

계약관련 메일 감지

답장 초안

사용자 승인 후 발송

---

사용자:

"오늘 중요한 메일 있어?"

비서실장:

"회장님, 오늘 확인이 필요한 업무 메일은 4건입니다."

---

사용자:

"두 번째 메일 답장해. 다음 주 화요일 가능하다고."

↓

메일 작성 Agent

↓

Draft

↓

비서실장 확인

↓

필요 시 결재

↓

Send

---

# 82. Calendar

Google Calendar

Apple Calendar 연동 가능한 구조

Microsoft Calendar

ICS

기능:

일정 조회

미팅 탐색

예약 일정

일정 생성

충돌 확인

업무 스케줄

AI 직원 업무 Schedule

---

# 83. Kakao Ecosystem

연결 가능성을 다음과 같이 구분한다.

Kakao Login

KakaoTalk Channel

Kakao Business

Alimtalk

FriendTalk

Kakao Map

Kakao Local

Kakao Mobility 연계 가능성

각 서비스는 공식 API/비즈니스 계약 가능 범위에 따라 Adapter 구현.

사용자에게 지원하지 않는 기능을 지원한다고 가장하지 않는다.

---

# 84. Naver Ecosystem

Naver Login

Naver Search

Naver Blog

Naver Search Ads

Naver Place

SmartPlace

Naver Reservation

SmartStore

Naver Shopping

Naver Maps

Naver Search Advisor

Naver Analytics 계열

등을 Integration Catalog에 포함한다.

공식 Open API

Commerce API

Search Ads API

사업자 파트너 API

등 사용 가능한 공식 경로를 최우선으로 사용한다.

---

# 85. Naver Place

MYCORP의 국내 소상공인 핵심 Integration.

가능한 기능:

매장 정보

검색 노출 정보

리뷰

리뷰 분석

평점

키워드

고객 반응

경쟁업체 비교

사진/콘텐츠 관리 지원

운영 정보 확인

---

회장:

"요즘 우리 가게 리뷰 어때?"

↓

Naver Place Agent

↓

Review Analyzer

↓

Competitor Comparison

↓

비서실장 보고

---

# 86. Naver Reservation

예약 데이터가 공식 또는 파트너 Integration을 통해 연결 가능한 경우:

오늘 예약

내일 예약

취소

노쇼

시간대별 예약률

빈 시간

고객 반복예약

예약 상품

등 분석.

사용자:

"내일 빈 시간이 언제야?"

비서실장:

"회장님, 내일 14:00~16:00와 19:00 이후 예약률이 낮습니다."

"해당 시간대 프로모션안을 만들까요?"

---

# 87. Google Ecosystem

Google Login

Gmail

Google Calendar

Google Drive

Google Sheets

Google Docs

Google Analytics

Google Search Console

Google Ads

Google Business Profile

YouTube

Google Maps

연동 Architecture 구성.

---

# 88. Google Business Profile

국내 소상공인에게 중요.

기능:

리뷰

평점

Business Information

검색 노출

사진

고객 행동

리뷰 응답 초안

---

# 89. YouTube

YouTube Data API

YouTube Analytics

지원:

채널 분석

영상 분석

댓글

조회수

시청시간

CTR

구독자

경쟁채널

콘텐츠 아이디어

제목

설명

Thumbnail Brief

Shorts 기획

업로드 Workflow

---

회장:

"유튜브 왜 안 크냐?"

↓

YouTube Analytics

↓

Content Analysis

↓

Competitor Analysis

↓

Video Strategy Agent

↓

CMO

↓

비서실장 보고

---

# 90. Instagram / Meta

Meta Business

Instagram Graph API

Facebook

Meta Ads

지원:

Posts

Reels

Insights

Comments

Reach

Engagement

Followers

Campaigns

Adsets

Ads

Spend

ROAS

Conversions

Creative Analysis

---

# 91. TikTok

TikTok Business / Marketing API 등 공식 연결 방식 우선.

기능:

콘텐츠

Analytics

광고

댓글/반응

Trend

Creative 분석

---

# 92. Social Publishing Engine

콘텐츠 제작:

Strategy

↓

Copy

↓

Creative Brief

↓

Image/Video

↓

Channel Optimization

↓

Preview

↓

Approval

↓

Publish

지원 목표:

Instagram

Facebook

YouTube

TikTok

Naver Blog

Kakao Channel

기타.

---

# 93. Hospitality Integration

숙박업 고객을 위한 중요 Integration.

연결 대상 예:

야놀자

여기어때

Booking.com

Agoda

Airbnb

Expedia

자체 예약 시스템

PMS

Channel Manager

---

# 94. Yanolja

야놀자 Integration은 공개/파트너 API 제공 범위에 맞춰 구현한다.

가능한 우선순위:

Partner API

PMS/Channel Manager 연계

Email Reservation Parsing

Authorized Browser Session

CSV Export

Screen Understanding

예약 데이터 확보가 가능한 방식 중 가장 안정적이고 약관에 맞는 방식을 선택한다.

사용자의 아이디/비밀번호를 평문 저장하지 않는다.

---

# 95. Hospitality AI Workflow

회장:

"이번 주말 빈 방 있어?"

↓

Reservation Integration

↓

Occupancy Agent

↓

Pricing Agent

↓

Marketing Agent

↓

비서실장:

"회장님, 토요일 Deluxe 3실과 Sunday Standard 7실이 남아 있습니다."

"가격을 내리기보다 Sunday 체크아웃 연장 패키지를 권고합니다."

---

# 96. Commerce

연결 대상:

SmartStore

Cafe24

Shopify

WooCommerce

쿠팡

11번가

Gmarket

옥션

기타.

기능:

주문

매출

상품

재고

리뷰

반품

광고

고객

가격

---

# 97. POS

소상공인 핵심.

POS Adapter Framework.

예:

매출

시간대

상품

결제

객단가

방문

취소

할인

Integration 가능 업체를 점차 추가.

CSV Upload fallback 지원.

---

# 98. Payment Integration

사업자의 매출 분석용:

PG

카드매출

온라인결제

Toss Payments

Stripe

PortOne 등

서비스 자체 SaaS 결제와 사업자의 매출 데이터 Integration은 분리한다.

---

# 99. Accounting

향후:

세금계산서

매출

매입

비용

회계자료

연결 가능한 Accounting Solution Adapter 추가.

CFO Agent에서 사용.

---

# 100. File / Document System

사용자가 무엇이든 채팅창으로 던질 수 있어야 한다.

Excel

CSV

PDF

Word

PPT

Image

Screenshot

Receipt

Invoice

Contract

Menu

Price List

Reservation Sheet

Customer List

AI가 파일 유형을 자동 인식하고 관련 부서로 전달한다.

---

# 101. Screenshot as Input

회장:

Screenshot 업로드

"이거 분석해."

Vision Router가 화면 종류를 판단.

예:

Naver Ads Screenshot

↓

Performance Agent

예약관리 Screenshot

↓

Operations Agent

Excel Screenshot

↓

Data Agent

Instagram Analytics Screenshot

↓

Social Agent

---

# 102. URL as Input

회장:

"이 경쟁업체 분석해."

https://...

↓

Web Research Agent

↓

Marketing Strategy

↓

Report

---

# 103. Universal Command Layer

모든 기능은 다음 모델을 따른다.

User Message

↓

Secretary General

↓

Intent Engine

↓

Entity Extraction

↓

Permission Check

↓

Integration Capability Check

↓

Task Planner

↓

Agent Orchestrator

↓

Tool / API / MCP

↓

Result

↓

Executive Summary

↓

Approval if required

↓

Execution

↓

Audit

---

# 104. Integration Capability Resolver

예:

회장:

"네이버 예약 오늘 거 취소해."

시스템은 먼저:

현재 Naver Reservation Adapter가 WRITE_RESERVATION_CANCEL을 지원하는가?

YES

↓

Approval

↓

Execute

NO

↓

가능한 대안 탐색.

Authorized Browser Automation 가능?

YES

↓

사용자 승인 Session

↓

Action

모든 방식 불가:

비서실장이 솔직하게 보고.

"회장님, 현재 연결 방식에서는 예약 조회만 가능하고 취소 실행 권한은 제공되지 않습니다."

지원하지 않는 작업을 성공했다고 가장해서는 안 된다.

---

# 105. Connect Center

설정 > 연결

Category:

Communication

Marketing

Social

Search

Commerce

Reservation

Hospitality

Analytics

Finance

Documents

Productivity

---

연동 Card:

Instagram

Connected

Naver Place

Connected

Gmail

Connected

YouTube

Connected

Yanolja

Limited

Naver Reservation

Not Connected

Google Ads

Connected

---

# 106. Chat-Based Connection

설정 페이지 없이도 연결 가능.

회장:

"내 네이버 연결해."

비서실장:

"네, 회장님. 네이버 계정을 연결하겠습니다."

[네이버로 계속]

OAuth.

연결 완료.

---

# 107. Chat-Based Settings

사용자:

"보고서는 아침 8시에만 줘."

↓

Preference Update

---

"광고비 30만원 넘으면 무조건 나한테 물어봐."

↓

Approval Policy Update

---

"매출 10% 이상 떨어지면 바로 알려줘."

↓

Alert Rule

---

"긴 보고 싫어. 다섯 줄 안으로 해."

↓

Chairman Preference

---

# 108. Natural Language Automation

사용자:

"매일 아침 8시에 매출 확인해서 이상하면 알려줘."

↓

Automation 생성.

---

"매주 월요일 경쟁사 광고 분석해."

↓

Recurring Agent Task

---

"야놀자 빈방 생기면 광고팀한테 알려줘."

↓

Event-Based Workflow

---

# 109. MYCORP Automation Engine

schedule_rules

event_rules

condition_rules

workflow_rules

예:

IF

Occupancy < 60%

AND

date <= 3 days

THEN

Marketing Strategy Agent 실행

↓

Promotion Proposal

↓

Chairman Approval

---

# 110. Credentials Security

매우 중요.

비밀번호 평문 저장 금지.

OAuth Token 암호화.

Refresh Token 암호화.

민감 Credential은 Server Only.

환경변수 또는 Secrets Management.

Audit Log.

Connection revoke 기능.

Device/session 관리.

---

# 111. Browser Session Security

Browser Automation이 필요한 경우:

사용자가 명시적으로 연결.

Session Token은 암호화.

가능하면 별도 Secure Browser Worker.

비밀번호 저장 대신 기존 인증 Session 사용.

2FA 우회 금지.

CAPTCHA 우회 금지.

보안장치 우회 금지.

약관상 허용되지 않는 자동화는 수행하지 않는다.

---

# 112. Approval Before External Action

외부 서비스 WRITE Action은 Risk Engine을 통과한다.

예:

게시물 게시

댓글 답변

고객 메시지

예약 변경

가격 변경

광고 시작

광고 중단

광고비 변경

상품 수정

쿠폰 발행

등.

각 Action마다 Policy 설정.

AUTO

ASK

BLOCK

---

# 113. Chairman Control Policy

사용자가 설정할 수 있다.

예:

리뷰 답변:

AUTO

Instagram 게시:

ASK

Naver Blog:

ASK

광고비 50,000원 이하:

AUTO

50,000원 초과:

ASK

예약 취소:

ALWAYS ASK

가격 변경:

ALWAYS ASK

---

# 114. Mobile Push

Push Notification:

URGENT

APPROVAL

REPORT

TASK_COMPLETE

ALERT

CHAT

예:

"회장님, 긴급 보고가 있습니다."

"광고비가 오늘 예산의 85%에 도달했습니다."

"결재 요청 2건이 있습니다."

"AI 마케팅본부가 이번 주 콘텐츠 제작을 완료했습니다."

---

# 115. Deep Links

Push 클릭 시 정확한 화면으로 이동.

mycorp://approval/123

mycorp://report/456

mycorp://chat/thread

mycorp://task/789

---

# 116. App Authentication

iOS / Android:

Email

Google

Apple Sign In

향후 Kakao

Naver

Biometrics:

Face ID

Touch ID

Android Biometrics

민감 결재는 생체인증 Option 제공.

---

# 117. App Store Requirements

iOS와 Android 앱은 단순 웹뷰로 만들지 않는다.

모바일 고유 기능을 제공한다.

Push

Voice

Camera

File Upload

Biometric Approval

Share Sheet

Deep Link

Native Notifications

등.

App Store와 Google Play 정책을 준수한다.

---

# 118. Share To MYCORP

iOS/Android Share Extension을 고려한다.

사용자가 Instagram, Safari, Chrome, YouTube 등에서:

Share

↓

MYCORP

↓

"이거 경쟁사 분석해."

또는

"이거 우리 콘텐츠로 참고해."

---

# 119. Camera

사용자가 가게 현장을 촬영.

"이 매장 사진 보고 개선점 찾아."

↓

Vision Agent

↓

Brand / CX Agent

↓

Report

---

메뉴판 촬영:

"가격 분석해."

↓

OCR/Vision

↓

Pricing / Marketing Agent

---

# 120. QR / Receipt / Business Card

Camera Recognition 확장.

영수증

명함

QR

메뉴판

포스터

광고물

문서

를 AI 부서로 전달.

---

# 121. Web Headquarters vs Mobile Chairman App

Web:

Full Headquarters

Building View

Department

AI Employee

Analytics

Reports

Large Dashboards

Integrations

Admin

---

Mobile:

Secretary

Approval

Alert

Briefing

Voice Command

Quick Task

AI Employee Live Status

Simplified Building

---

# 122. Desktop Responsive Strategy

Desktop에서는 고밀도 Command Center.

1440px 이상 최적화.

Large Monitor에서:

좌측 본사 Navigation

중앙 Building / Dashboard

우측 Secretary Panel

동시에 보여줄 수 있음.

---

# 123. Real-Time Company Presence

사용자가 어떤 기기에서 로그인해도:

현재 업무

Agent Status

결재

대화

알림

보고

동기화.

Supabase Realtime / WebSocket 기반.

---

# 124. Offline Consideration

Mobile에서 네트워크가 잠깐 끊겨도:

최근 보고

최근 대화

결재안 Metadata

캐시.

외부 Action은 Online 상태에서만 실행.

---

# 125. Unified Inbox

여러 Channel의 메시지를 한 곳으로 모은다.

Gmail

Instagram DM

Kakao Channel

Naver

웹사이트 문의

예약문의

기타 가능 채널.

AI가:

고객문의

불만

영업

예약

협업

스팸

긴급

으로 분류.

---

# 126. AI Customer Response

AI가 답변 초안 작성.

사용자 Policy에 따라:

Draft Only

Approval Required

Auto Reply

설정 가능.

---

# 127. Omnichannel Customer Identity

같은 고객이:

Instagram DM

Email

예약

구매

리뷰

에서 나타날 수 있다.

가능한 범위 내에서 Customer Profile을 통합.

단 개인정보 보호 및 서비스 약관 준수.

---

# 128. Korea-First Product

MYCORP는 글로벌 확장 가능하게 만들되 MVP는 한국 소상공인 중심.

따라서 국내 우선 연결:

Naver

Kakao

Instagram

YouTube

Google

Meta

TikTok

Naver Place

Naver Reservation

SmartStore

Cafe24

POS

Yanolja

여기어때

배달/예약/숙박 관련 주요 서비스

---

# 129. Integration Marketplace

향후:

"연결할 서비스 추가"

Marketplace 형식.

마케팅

예약

호텔

쇼핑몰

회계

CRM

Communication

Analytics

---

개발자가 추가 Connector를 만들 수 있는 SDK 구조도 고려한다.

---

# 130. MCP Support

MCP Client Layer를 둔다.

지원 가능한 MCP Server를 Registry에 등록한다.

MCP Tool:

name

description

inputSchema

riskLevel

provider

permissions

Company별 Enable/Disable.

Agent가 MCP Tool을 직접 호출하기 전에 Permission Engine을 통과해야 한다.

---

# 131. Tool Gateway

Agent가 API를 직접 호출하지 않는다.

모든 외부 Action은 Tool Gateway를 통한다.

Agent

↓

Tool Gateway

↓

Permission

↓

Risk

↓

Credential

↓

Integration Adapter

↓

External Service

↓

Audit Log

이 구조를 강제한다.

---

# 132. Permission Architecture

Agent별 Tool Permission.

예:

Content Writer

read analytics

write draft

NO publish

---

Social Manager

read social

write draft

request publish

---

CMO

approve internal plan

NO financial execution without Chairman

---

# 133. AI Employee Tool Skills

각 AI 직원에게 Tool Skill을 추가.

예:

박콘텐츠 대리

Skills:

NAVER_BLOG_WRITE_DRAFT

INSTAGRAM_COPY

YOUTUBE_DESCRIPTION

SEO_OPTIMIZE

---

이광고 과장

Skills:

GOOGLE_ADS_READ

META_ADS_READ

NAVER_ADS_READ

CAMPAIGN_ANALYZE

CAMPAIGN_EDIT_REQUEST

---

# 134. Dynamic Hiring

연결된 서비스에 따라 AI 직원이 추가될 수 있다.

예:

사용자가 Yanolja 연결.

System:

"숙박 OTA 관리 업무가 확인되었습니다."

↓

OTA Revenue Manager AI 채용.

---

SmartStore 연결.

↓

Commerce Specialist 추가.

---

# 135. AI Hiring UX

비서실장:

"회장님, 네이버 스마트스토어 연결이 완료되었습니다."

"전자상거래 업무를 담당할 AI 직원 4명을 추가 배치하는 것을 권고드립니다."

[배치]

---

# 136. Company Grows With User

처음:

직원 27명.

Integration 추가:

직원 42명.

Business 기능 추가:

직원 63명.

사용자는 AI Tool을 추가하는 것이 아니라:

**회사가 성장하는 경험**

을 한다.

---

# 137. Connected Company Graph

회사의 모든 데이터를 Graph로 연결.

Company

Customer

Campaign

Channel

Reservation

Product

Content

Ad

Order

Review

Task

Report

Employee

관계를 추적.

장기적으로 AI가 기업 전체 Context를 이해하도록 한다.

---

# 138. Company Memory

MYCORP는 회사에 대해 장기적으로 기억해야 한다.

Brand

Products

Prices

Customers

Past Campaigns

Decisions

Chairman Preferences

Failures

Successful Campaigns

Competitors

Seasonality

Policies

Goals

---

# 139. Decision Memory

회장이:

"우리 브랜드는 절대 가격할인 하지마."

라고 지시.

↓

Company Policy Memory.

향후 모든 Agent가 참고.

---

# 140. Company Constitution

Settings에:

회사 원칙

금지사항

브랜드 철학

목표

예산 기준

승인 정책

을 저장.

AI 직원의 System Context에 반영.

---

# 141. AI Secretary Proactivity

비서실장은 지시를 기다리기만 하지 않는다.

데이터에서 이상이 발견되면 먼저 보고한다.

단 Push Spam 금지.

중요도 판단.

예:

"회장님, 오늘 네이버 플레이스 검색 유입이 평소보다 38% 감소했습니다."

---

# 142. One Sentence Product Experience

사용자가 앱을 열고 이렇게 말할 수 있어야 한다.

"비서실장, 우리 회사 알아서 좀 챙겨봐."

그리고 MYCORP가 실제 회사 데이터를 확인하여 필요한 업무를 판단하고 제안해야 한다.

단 비용 발생 또는 외부 영향 Action은 승인 정책을 따른다.

---

# 143. No UI Limit Philosophy

모든 주요 UI Action은 대응되는 Conversation Action을 가진다.

예:

UI:

연결 > Gmail > Connect

Chat:

"Gmail 연결해."

동일 기능.

---

UI:

결재 > 승인

Chat:

"첫 번째 거 승인해."

동일 기능.

---

UI:

Reports > Monthly

Chat:

"지난달 보고서 보여줘."

동일 기능.

---

# 144. AI Navigation

사용자가:

"광고 현황 화면 보여줘."

라고 말하면 앱이 해당 화면으로 이동 가능.

Chat → UI Navigation Tool.

예:

OPEN_ROUTE

route:

/analytics/ads

---

# 145. Generative UI

비서실장이 필요할 때 채팅 내부에 UI Card를 생성.

예:

"이번 주 매출 보여줘."

↓

Chart Card.

---

"결재할 거 있어?"

↓

Approval Cards.

---

"직원들 뭐하고 있어?"

↓

Live Agent Cards.

---

# 146. Streaming Work Visibility

AI가 작업 중일 때 단순 spinner만 보여주지 않는다.

비서실장:

"데이터본부에서 지난 90일 매출을 분석하고 있습니다."

↓

"CRM팀이 재구매 고객을 분류하고 있습니다."

↓

"CMO가 두 분석 결과를 검토하고 있습니다."

실제 Task Event와 연결.

---

# 147. App Icon / Identity

Premium Corporate Identity.

일반 AI Sparkle Logo를 피한다.

MYCORP가 "기업"으로 느껴져야 한다.

Building

Monogram

Corporate Seal

Executive Emblem

등의 방향 검토.

---

# 148. Development Priority Revision

기존 Phase에 다음을 추가.

## Phase J

React Native / Expo

Mobile Authentication

Secretary Chat

Approval

Push

---

## Phase K

Integration Framework

OAuth

Credential Vault

Tool Gateway

---

## Phase L

Google / Gmail / YouTube

---

## Phase M

Meta / Instagram

---

## Phase N

Naver / Kakao

---

## Phase O

Reservation / Commerce / Hospitality

---

## Phase P

Browser Automation Fallback

Screen Understanding

---

# 149. MVP Integration Scope

초기 개발에서 모든 외부 서비스를 한 번에 완벽히 연결하려다 전체 제품 개발이 중단되지 않도록 한다.

하지만 Architecture는 처음부터 모든 Integration을 추가할 수 있어야 한다.

MVP 실제 연결 우선순위:

1. Gmail
2. Google Calendar
3. Google Analytics
4. Google Search Console
5. YouTube
6. Instagram / Meta
7. Naver Search / Naver Open API 계열
8. Naver Ads 가능한 API
9. Naver Place 가능한 범위
10. CSV / Excel
11. Website
12. Manual Data

그 이후:

Kakao

Naver Reservation

SmartStore

Cafe24

POS

Yanolja

여기어때

기타 OTA.

---

# 150. 중요한 현실성 원칙

"무엇이든 연결 가능"이라는 Product Vision은 유지한다.

그러나 구현에서는 외부 플랫폼이 제공하는 권한과 공식 API 한계를 존중한다.

따라서 Integration Status를 다음처럼 표시한다.

FULL

READ_WRITE

READ_ONLY

PARTNER_REQUIRED

BROWSER_ASSISTED

MANUAL

UNAVAILABLE

---

# 151. No False Execution

Agent가 외부 시스템과 연결되어 있지 않다면:

"완료했습니다."

라고 거짓말하지 않는다.

반드시:

"초안까지 준비했습니다."

"현재 이 계정에는 게시 권한이 연결되어 있지 않습니다."

"연결하시면 바로 실행할 수 있습니다."

라고 말한다.

---

# 152. Ultimate User Experience

PC:

회장이 본사 건물을 열어본다.

마케팅팀이 일하고 있다.

데이터팀이 분석 중이다.

CMO가 보고서를 검토하고 있다.

비서실에 결재안이 올라와 있다.

---

차량 이동 중:

iPhone Push.

"회장님, 오늘 광고비 조정안 결재가 필요합니다."

↓

Face ID

↓

"승인."

---

저녁:

회장:

"비서실장, 오늘 회사 어땠어?"

비서실장:

"회장님, 오늘 총 83건의 업무를 처리했습니다.

매출은 전주 대비 8.4% 증가했고 신규예약은 17건 발생했습니다.

마케팅본부의 재방문 캠페인이 가장 좋은 성과를 냈습니다.

내일은 네이버 플레이스 노출 감소 원인을 우선 분석하겠습니다."

---

# 153. 최종 제품 정의

MYCORP는:

Chatbot이 아니다.

Marketing Tool이 아니다.

Agent Dashboard가 아니다.

Automation Tool이 아니다.

ERP도 아니다.

CRM도 아니다.

각 기능을 모두 포함할 수 있는 상위 개념이다.

**AI-Powered Company Operating System**

사용자는 AI를 운영하지 않는다.

사용자는 자신의 기업을 운영한다.

MYCORP는 사용자의 지시를

기업 업무로 번역하고,

직원을 배치하고,

데이터를 분석하고,

업무를 수행하고,

보고서를 작성하고,

결재를 요청하고,

승인된 행동을 실행한다.

---

# 154. 최종 핵심 문구

## 소상공인에게 AI 기업을 드립니다.

마케팅팀을 채용할 필요도,

데이터팀을 만들 필요도,

AI 사용법을 배울 필요도 없습니다.

MYCORP에 출근하십시오.

비서실장에게 지시하십시오.

AI 임직원들이 일합니다.

당신은 보고받고,

판단하고,

결재하십시오.

**사장님에서 회장님으로.**

**MYCORP가 당신의 회사를 만들어드립니다.**

---

## Global Lockup

**MYCORP**

**Your AI Company.**

*You lead. Your AI company works.*

**One founder. An entire company.**

> 한국 카피와 글로벌 카피는 서로의 번역이 아니다. 각각 작성한다.
> 표기·사용 규칙은 [`docs/brand/BRAND.md`](../brand/BRAND.md) §2, §6.

---

# 155. Claude Code 추가 최종 명령

기존 MYCORP SaaS 명세와 본 확장 명세를 하나의 Product Specification으로 취급하라.

웹 전용으로 구현하지 말 것.

처음부터 Web + Mobile Shared Architecture를 고려할 것.

Web은 Next.js.

Mobile은 React Native/Expo를 기본 선택으로 한다.

Backend는 공통 사용.

Supabase Multi-Tenant Architecture를 유지한다.

모든 주요 UI 기능은 자연어 Chat Action으로도 실행 가능하게 설계한다.

Integration Layer는 Provider별 하드코딩이 아닌 Adapter Pattern으로 구현한다.

Agent가 외부 API를 직접 호출하지 않고 Tool Gateway를 통해 호출하도록 한다.

공식 API와 OAuth를 가장 우선하며 MCP, Webhook, Email Parser, Authorized Browser Automation, Screen Understanding 순으로 fallback한다.

외부 서비스의 보안 기능을 우회하지 않는다.

외부 Action은 Permission 및 Risk Engine을 통과한다.

금전, 게시, 발송, 예약 변경 등 중요한 Action은 Approval Policy를 따른다.

실행 가능하지 않은 기능을 실행했다고 가장하지 않는다.

iOS App Store 및 Google Play Store에 실제 배포 가능한 구조로 작성한다.

모바일에서는 Push Notification, Voice Command, Camera/File Upload, Biometric Approval, Deep Link를 구현 가능한 구조로 포함한다.

최종적으로 사용자가 메뉴를 몰라도 다음 한 문장만으로 회사를 운영할 수 있어야 한다.

**"비서실장, 알아서 처리하고 중요한 것만 나한테 보고해."**

그러나 외부 영향, 비용, 고객 접촉 및 정책상 결재가 필요한 업무는 회장에게 결재를 요청해야 한다.

이 철학이 MYCORP 전체 Architecture와 UX의 최상위 원칙이다.