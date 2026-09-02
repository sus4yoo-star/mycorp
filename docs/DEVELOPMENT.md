# 개발 가이드

## 요구사항

- Node 22 이상 (`.nvmrc`)
- pnpm 10 (`corepack enable`)

## 시작하기

```bash
pnpm install
cp .env.example .env.local     # 값 채우기
pnpm dev                        # 전체 개발 서버
pnpm --filter @mycorp24/web dev # 웹만
```

## 자주 쓰는 명령

| 명령 | 설명 |
|---|---|
| `pnpm typecheck` | 전 패키지 타입 검사 |
| `pnpm test` | 전 패키지 테스트 |
| `pnpm build` | 전 패키지 빌드 |
| `pnpm test:db` | **RLS 정책 테스트** — 임시 Postgres를 띄워 정책을 공격 |
| `pnpm clearance` | 도메인 클리어런스 RDAP 조회 (§ 아래) |

## 구조

```text
apps/
  web/                Next.js 16 (App Router)
  mobile/             Expo / React Native
packages/
  types/              도메인 타입 — 보안등급·결재·리스크·연동 상태
  agent-types/        조직 taxonomy — 임원·본부·층 메타데이터
  business-logic/     층 계산 · 결재 판정 · 조직 프리셋 · 호칭 · 보안 분류
  integrations/       IntegrationAdapter 계약 · 카탈로그 · Capability Resolver
  tool-gateway/       외부 실행 파이프라인 (아래 참조)
  ai-gateway/         AI Provider Abstraction (Claude 기본)
  chat/               비서실장 Intent 분류 · Action Router · UI↔Chat parity
  db/                 Supabase 타입 · 데이터 접근 계층
  vault/              자격증명 암호화 (AES-256-GCM)
  intelligence/       경쟁사 관찰 · 외부 콘텐츠 방어 · 제안 생성
  auth/               멤버십 · need-to-know
  api-client/         웹·모바일 공용 API 클라이언트
supabase/migrations/  멀티테넌트 스키마 + RLS
scripts/              클리어런스 조회 스크립트
```

**패키지는 빌드 산출물이 아니라 TypeScript 소스를 그대로 export한다.**
웹은 `transpilePackages`, 모바일은 `metro.config.js`가 처리한다.
따라서 패키지에 별도 빌드 단계가 없다 — 편집하면 즉시 반영된다.

## 지켜야 하는 것

명세와 어긋나면 코드가 틀린 것이다. 특히:

### Tool Gateway를 우회하지 않는다 (§131, §220.4)

Agent는 외부 API를 직접 호출하지 않는다. 어떤 외부 동작도 이 순서를 거친다.

```text
permission → risk → approval policy → credential → adapter → audit
```

1·2선 방어는 **실행 경로 안에서 차단형**이고, 3선(감사실)은 **경로 밖에서 사후**다.
감사실이 실행을 막으면 곧 실행 주체가 되어 독립성을 잃는다.

두 불변식은 테스트로 고정되어 있다 (`packages/tool-gateway/test`):

- 허용되지 않은 요청은 **adapter에 도달하지 않는다**
- 모든 시도는 허용·거부와 무관하게 **audit에 기록된다**

### 외부 콘텐츠는 데이터이지 지시가 아니다 (§220.6)

메일 본문, 리뷰, 크롤링한 페이지, 업로드 파일, Fork한 Workflow, MCP 도구 설명 —
전부 외부인이 쓴 텍스트다. 행동의 근거는 될 수 있으나 **권한·승인 정책·보안등급을
바꾸도록 허용하지 않는다.** `defaultRiskEngine`이 이를 강제한다.

크롤링한 경쟁사 페이지는 모델에게 직접 들어간다. `packages/intelligence/src/untrusted.ts`가
세 겹으로 막는다 — 다만 **실제로 지탱하는 것은 첫 번째 하나뿐이다:**

1. 모델에게 설득당할 권한 자체를 주지 않는다. 모델은 **제안만** 만들고, 사람이 결정한다.
   실행·지출·게시·정책 변경 중 무엇도 할 수 없다.
2. 외부 텍스트를 매번 다른 구분자로 감싸 데이터임을 표시한다.
3. 명백한 주입 시도를 제거하고 **카운트한다** — 시도한 페이지 자체가 신호다.

2번과 3번을 방어라고 믿는 순간 뚫린다.

### 모델 출력이 DB 행이 될 때는 스키마를 강제한다

`completeStructured()`를 쓴다. 자유 텍스트를 정규식으로 파싱하면 아무도 요청하지 않은
필드 값을 에이전트가 지어내게 된다. 스키마는 실패를 조용하지 않게 만든다.

### 회사 결정은 프롬프트와 필터 두 곳에서 강제한다

"할인하지 마"라고 들은 모델은 **대체로** 따른다. "대체로"는 통제가 아니다.
`generateProposals()`는 출력에도 필터를 건다. 다만 이 필터는 백스톱이고,
진짜 통제는 제안이 아무것도 실행할 수 없다는 사실이다.

### 못 하는 일을 했다고 하지 않는다 (§151)

`resolveCapability()`가 `UNAVAILABLE`을 반환하면 그대로 보고한다.
"완료했습니다" 대신 "초안까지 준비했습니다. 게시 권한은 연결되어 있지 않습니다."

### 층 번호를 하드코딩하지 않는다 (§220.3)

본사 층수는 회사마다 다르다. `resolveFloorStack()`을 쓴다.
`1F–9F`·`B1`·`B2`는 고정, `10F` 이상은 동적, 회장실은 언제나 최상층이다.

### 호칭과 보고 문장을 문자열로 조립하지 않는다

`formatAddress()`를 쓴다. 한국어는 이름 뒤에 호칭이 오고 영어는 앞에 온다.
`` `${name}님` `` 같은 코드를 만들지 않는다.

보고 문장도 같다. `briefing.ts`의 로케일별 문장 표를 쓴다.
한국어 브리핑과 영어 브리핑은 **번역이 아니라 서로 다른 문서**다 (LOCALIZATION §5).
테스트가 한쪽 언어에 다른 언어가 새어 들어가는 것을 막는다.

### 측정할 수 없는 것을 0점으로 만들지 않는다

`computeMomentum()`은 데이터가 없는 항목을 **제외**한다. 0점으로 넣으면
"광고를 안 하는 회사"가 "광고에 실패한 회사"가 되고, 회장님께 거짓을 보고하게 된다.
아무것도 측정 못 하면 점수는 `null`이고, 비서실장은 그 줄을 말하지 않는다.

### 자격증명은 서버에만 (§110, §187)

`integration_credentials`는 RLS가 켜져 있고 **정책이 하나도 없다.**
anon·authenticated 역할은 전부 거부되며 service role로만 접근한다. 이 상태를 유지한다.

### Service role 클라이언트를 요청 경로에 두지 않는다

`apps/web/lib/supabase/service.ts`는 RLS를 우회한다. 자격증명 복호화, 스케줄된
Agent 실행, 감사실의 원본 조회처럼 **사용자 세션이 없는 것이 정당한 작업**에만 쓴다.
다른 모든 곳에서는 RLS가 안전망이지만 여기에는 안전망이 없다.
`server-only`가 클라이언트 번들에 섞이는 것을 빌드 오류로 만든다.

### 회사 생성은 `found_company()`로만

`companies`에는 INSERT 정책이 없다. 회사 생성·founder 멤버십·호칭 저장이
한 트랜잭션에서 일어나야 하기 때문이다. 클라이언트에서 두 번 호출하면
멤버가 없는 회사가 잠깐 존재하고, id를 아는 사람이 가로챌 수 있다.

## AI 호출

```ts
import { createAiProvider } from '@mycorp24/ai-gateway';

const ai = createAiProvider();
const result = await ai.complete({
  system: '당신은 MYCORP24의 비서실장입니다.',
  messages: [{ role: 'user', content: '오늘 매출 어때?' }],
  tier: 'EXECUTIVE',
});
```

비용은 **모델을 낮춰서가 아니라 `tier`(effort)로 조절한다.** 모델을 내리는 것은
회장의 결정이지 우리의 결정이 아니고, 모델을 섞으면 프롬프트 캐시 네임스페이스가 갈린다.

## 데이터베이스

```bash
pnpm test:db
```

임시 Postgres 클러스터를 띄워 마이그레이션을 적용하고 **정책을 공격한다.**
Docker도, Supabase 프로젝트도, 네트워크도 필요 없다.
자세한 내용은 [`supabase/README.md`](../supabase/README.md).

> 이 테스트는 첫 실행에서 실제 버그를 잡았다 — `0001`만으로는 회사 설립이
> RLS 때문에 불가능했다. 정책 버그는 코드 리뷰로 안 잡힌다.

## 네이밍 클리어런스

```bash
pnpm clearance
```

RDAP으로 도메인 등록 여부만 확인한다. 상표(특히 `24`의 식별력)와 앱스토어 이름은
사람이 해야 한다 — [`docs/brand/NAMING_CLEARANCE.md`](./brand/NAMING_CLEARANCE.md).

## 배포

Netlify (`netlify.toml`). 루트에서 빌드하고 `apps/web`을 배포한다.
`/hq`는 `searchParams`를 읽으므로 서버 렌더링 라우트다.

### 토큰을 로그에 남기지 않는다

OAuth 토큰은 암호화되어 저장되고, 오류 경로에도 토큰이 들어가지 않도록 설계되어 있다.
`console.log(tokens)` 한 줄이 §110을 무너뜨린다.

### 요청 범위를 부풀리지 않는다

Gmail은 `gmail.readonly`만 요청한다. 어댑터는 `SEND_MAIL`을 **미지원으로 선언**하고
그 이유를 문자열로 갖는다. 비서실장이 "초안까지 준비했습니다"라고 정직하게 말할 수
있는 것은 어댑터가 없는 권한을 주장하지 않기 때문이다.

## 아직 없는 것

Push 알림, 경쟁사 신호를 실제로 수집하는 크롤러, 공개 기업 프로필,
소셜·생체 인증, 제안을 생성하는 에이전트.

스키마와 화면은 있고 **데이터를 만드는 쪽이 아직 없다.** 그래서 아침 보고는
빈 상태에서 "관찰할 데이터가 없다"고 정직하게 말한다.

**비어 있는 골격을 미리 만들지 않았다.** 동작하지 않는 껍데기는 그것이 존재한다고
착각하게 만드는 코드를 부른다 — 이 제품에서는 §151 위반의 시작점이다.
