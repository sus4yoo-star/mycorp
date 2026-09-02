# 설치 가이드

**목표: 한 번만 설정하면, 그 뒤로는 push만으로 배포까지 자동으로 끝나게.**

GitHub Actions가 Supabase 마이그레이션을 적용하고 Netlify에 배포합니다.
설정은 **GitHub 시크릿 등록 7개**가 전부이고, 이건 휴대폰 브라우저에서도 됩니다.

```text
git push  →  GitHub Actions
                ├─ supabase db push      (스키마 적용)
                ├─ verify.sql            (RLS 켜져 있는지 검증)
                └─ netlify deploy --prod (배포)
```

---

## 1. 시크릿 등록 (한 번)

**Settings → Secrets and variables → Actions → New repository secret**

주소: `https://github.com/<owner>/<repo>/settings/secrets/actions`

| 시크릿 | 어디서 | 비고 |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens | 개인 액세스 토큰 |
| `SUPABASE_PROJECT_ID` | 프로젝트 URL의 ref (`https://<ref>.supabase.co`) | 공개 값 |
| `SUPABASE_DB_PASSWORD` | 프로젝트 생성 시 정한 DB 비밀번호 | Settings → Database에서 재설정 가능 |
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API | 공개 값 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API | 공개 값 (브라우저로 나감) |
| `NETLIFY_AUTH_TOKEN` | app.netlify.com → User settings → Applications → New access token | 비밀 |
| `NETLIFY_SITE_ID` | 사이트 → Project configuration → General → **Project ID** | 공개 값. Netlify가 UI 용어를 Site → Project로 바꿔서 이름이 `Project ID`로 보이지만, 같은 화면에 "Also known as Site ID"라고 적혀 있는 그 값이 맞습니다 |

시크릿이 없으면 워크플로는 **실패하지 않고 건너뜁니다.** 절반만 설정해도 됩니다 —
Supabase만 넣으면 마이그레이션만 자동으로 돌아갑니다.

### Netlify 사이트가 아직 없다면

`netlify.toml`이 이미 저장소에 있으므로, Netlify에서 이 저장소를 한 번만 연결하면
사이트가 생깁니다. 그 뒤 Project configuration → General의 **Project ID**(= Site ID)를
위 시크릿에 넣으십시오.

### Netlify 런타임 환경변수

빌드에 필요한 공개 값은 GitHub 시크릿에서 주입되지만,
**서버에서만 쓰는 비밀은 Netlify 쪽에 직접** 넣어야 합니다
(Project configuration → Environment variables):

| 변수 | 성격 |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | **비밀. RLS를 무시합니다** |
| `MYCORP24_CREDENTIAL_KEY` | **비밀.** OAuth 토큰 암호화 키 |
| `MYCORP24_CRON_SECRET` | **비밀.** 경쟁사 관찰 스케줄러와 공유하는 값 |
| `ANTHROPIC_API_KEY` | **비밀** |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` | 연동을 쓸 때만 |
| `META_OAUTH_CLIENT_ID` / `_SECRET` | 연동을 쓸 때만 |

```bash
# MYCORP24_CREDENTIAL_KEY 생성 (32바이트 base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> **이 비밀들은 채팅·이슈·커밋 어디에도 붙여넣지 마십시오.**
> service role 키는 모든 테넌트의 모든 데이터를 읽습니다.
> `MYCORP24_CREDENTIAL_KEY`를 잃으면 저장된 OAuth 토큰을 복호화할 수 없고,
> 바꾸면 기존 연동이 전부 끊깁니다. 유출되면 암호화가 무의미해집니다.

---

### 경쟁사 자동 관찰

매일 아침 경쟁사를 확인하고 제안을 준비하는 워크플로가 있습니다
(`.github/workflows/intelligence.yml`, 06:10 KST).

GitHub 시크릿 2개를 추가하면 켜집니다:

| 시크릿 | 값 |
|---|---|
| `MYCORP24_APP_URL` | 배포된 주소 (예: `https://mycorp24.netlify.app`) |
| `MYCORP24_CRON_SECRET` | 아래로 생성 · **Netlify 환경변수에도 같은 값**을 넣습니다 |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

없으면 워크플로는 실패하지 않고 건너뜁니다.

## 2. 실행

시크릿을 넣었으면 **아무 것도 더 할 필요가 없습니다.** `main`에 push하면 배포됩니다.

지금 바로 돌리고 싶으면 — **GitHub 모바일 앱이나 브라우저에서**:

**Actions → Deploy → Run workflow**

`skip_migrations` 옵션이 있어 코드만 다시 배포할 수도 있습니다.

---

## 3. 브라우저만 있을 때 (수동 경로)

CLI 없이 스키마를 넣어야 한다면:

1. `supabase/schema.sql` 전체 복사
2. Supabase 대시보드 → **SQL Editor** → New query → 붙여넣기 → Run
3. 같은 자리에 `supabase/verify.sql`을 붙여넣고 Run

`verify.sql`은 아무것도 바꾸지 않고, 상태가 안전하지 않으면 **예외를 던집니다:**

- `public`의 모든 테이블에 RLS가 켜져 있는가
- `integration_credentials`에 정책이 **하나도 없는가** (service role 전용, §110·§187)
- `audit_events`에 update·delete 정책이 **없는가** (append-only, §220.4)
- `companies`에 INSERT 정책이 **없는가** (`found_company()`만이 유일한 경로)
- security definer 함수들이 `search_path`를 고정하는가

`schema.sql`은 `supabase/migrations/`에서 생성되며, CI가 재생성해 비교하므로
드리프트가 생길 수 없습니다 (`pnpm build:schema`).

---

## 4. 로컬 개발

```bash
corepack enable
pnpm install
cp .env.example .env.local     # 값 채우기
pnpm dev
```

| 명령 | 설명 |
|---|---|
| `pnpm turbo run typecheck test build` | 전체 검사 |
| `pnpm test:db` | **RLS 정책 테스트** — 임시 Postgres를 띄워 정책을 공격 |
| `pnpm build:schema` | `supabase/schema.sql` 재생성 |
| `pnpm clearance` | 도메인 RDAP 조회 |

`pnpm test:db`는 Docker도, Supabase 프로젝트도, 네트워크도 필요 없습니다.

---

## 5. 첫 사용

1. `/login` — 이메일로 로그인 링크
2. `/onboarding` — 회사 설립 (질문 3개)
3. `/hq` · `/chat` · `/connect` · `/approvals`

이메일이 안 오면 Supabase → Authentication → URL Configuration에
`http://localhost:3000/auth/callback`과 배포 도메인이 있는지 확인하십시오.

---

## 6. OAuth 연동 (선택)

연동 없이도 제품은 동작합니다. 비서실장은 연결되지 않은 기능을 **했다고 말하지
않고** 연결이 필요하다고 보고합니다 (§151).

### Google (Gmail)

console.cloud.google.com → Credentials → OAuth client ID (Web)
Redirect URI: `https://<도메인>/api/oauth/GMAIL/callback`

요청 범위는 **읽기 전용**(`gmail.readonly`)입니다. 발송은 더 넓은 범위가 필요하고,
결재 흐름(§112)이 붙기 전까지 요청하지 않습니다.

### Meta (Instagram)

developers.facebook.com → Facebook Login
Redirect URI: `https://<도메인>/api/oauth/INSTAGRAM/callback`

조회 전용입니다. 게시(`instagram_content_publish`)와 광고비 변경(`ads_management`)은
Meta 앱 심사가 필요하며, 어댑터가 **미지원으로 선언**하고 그 이유를 표시합니다.

---

## 문제 해결

| 증상 | 원인 |
|---|---|
| Deploy가 통째로 skip됨 | 시크릿 미등록 — Actions 로그의 `preflight` 확인 |
| `supabase link` 실패 | `SUPABASE_DB_PASSWORD` 또는 `SUPABASE_PROJECT_ID` 오류 |
| verify.sql이 예외를 던짐 | 마이그레이션 일부만 적용됨 — 메시지가 어느 불변식인지 알려줍니다 |
| "설정이 필요합니다" 화면 | `NEXT_PUBLIC_SUPABASE_*` 누락 |
| 회사 설립 실패 | `0002_found_company.sql` 미적용 |
| 연결 후 `invalid_state` | Redirect URI 불일치, 또는 10분 초과 |
| 연결은 됐는데 데이터가 없음 | `MYCORP24_CREDENTIAL_KEY` 누락 또는 변경됨 |
| 다른 회사 데이터가 보임 | RLS가 꺼져 있음 — `verify.sql`을 돌리십시오 |
