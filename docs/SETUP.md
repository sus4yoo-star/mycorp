# 설치 가이드

로컬에서 MYCORP24를 실제로 띄우는 순서입니다. 각 단계는 앞 단계가 끝나야 의미가 있습니다.

---

## 0. 사전 준비

```bash
corepack enable          # pnpm
node -v                  # 22 이상
pnpm install
```

---

## 1. Supabase 프로젝트

### 1.1 마이그레이션 적용

```bash
npm i -g supabase                 # 또는 brew install supabase/tap/supabase
supabase login
supabase link --project-ref <프로젝트-ref>
supabase db push
```

`supabase db push`는 `supabase/migrations/`의 세 파일을 순서대로 적용합니다.

| 파일 | 내용 |
|---|---|
| `0001_init.sql` | 테이블 · 열거형 · RLS 정책 |
| `0002_found_company.sql` | `found_company()` — 회사 생성의 유일한 경로 |
| `0003_oauth_states.sql` | OAuth 핸드셰이크 상태 · 연결 컬럼 |

`supabase link`가 DB 비밀번호를 물어봅니다. **어디에도 붙여넣지 마시고** Supabase 대시보드에서만 확인하십시오.

### 1.2 적용 확인

```sql
-- SQL Editor에서
select tablename, rowsecurity from pg_tables
 where schemaname = 'public' order by tablename;
```

**모든 행의 `rowsecurity`가 `true`여야 합니다.** 하나라도 false면 그 테이블은 무방비입니다.

### 1.3 정책 검증 (선택, 권장)

```bash
pnpm test:db
```

실제 프로젝트가 아니라 임시 로컬 클러스터에서 정책을 공격합니다.
Docker도 네트워크도 필요 없습니다.

---

## 2. 환경변수

```bash
cp .env.example .env.local
```

| 변수 | 어디서 | 성격 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 대시보드 → Settings → API | 공개 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 같은 화면 | 공개 (브라우저로 나감) |
| `SUPABASE_SERVICE_ROLE_KEY` | 같은 화면 | **비밀. RLS를 무시합니다** |
| `MYCORP24_CREDENTIAL_KEY` | 아래 명령으로 생성 | **비밀** |
| `ANTHROPIC_API_KEY` | console.anthropic.com | **비밀** |

```bash
# 자격증명 암호화 키 (32바이트 base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> **`SUPABASE_SERVICE_ROLE_KEY`와 `MYCORP24_CREDENTIAL_KEY`는 채팅·이슈·커밋 어디에도
> 붙여넣지 마십시오.** service role 키는 모든 테넌트의 모든 데이터를 읽습니다.
> `MYCORP24_CREDENTIAL_KEY`를 잃어버리면 저장된 OAuth 토큰을 복호화할 수 없고,
> 유출되면 암호화가 무의미해집니다.
>
> `.env.local`은 `.gitignore`에 있습니다. 그 상태를 유지하십시오.

---

## 3. 실행

```bash
pnpm dev
```

1. `/login` — 이메일로 로그인 링크
2. `/onboarding` — 회사 설립 (질문 3개)
3. `/hq` — 본사. 층수는 업종에 따라 다릅니다
4. `/chat` — 비서실장
5. `/connect` — 연결 센터
6. `/approvals` — 결재실

이메일이 안 오면 Supabase → Authentication → Providers → Email이 켜져 있는지,
Redirect URLs에 `http://localhost:3000/auth/callback`이 있는지 확인하십시오.

---

## 4. OAuth 연동 (선택)

연동 없이도 제품은 동작합니다. 비서실장은 연결되지 않은 기능을 **했다고 말하지
않고** 연결이 필요하다고 보고합니다 (§151).

### Google (Gmail)

1. console.cloud.google.com → APIs & Services → Credentials
2. OAuth client ID (Web application)
3. Authorized redirect URI:
   `http://localhost:3000/api/oauth/GMAIL/callback`
   (배포 시 `https://<도메인>/api/oauth/GMAIL/callback` 추가)
4. Gmail API 활성화
5. `GOOGLE_OAUTH_CLIENT_ID` · `GOOGLE_OAUTH_CLIENT_SECRET`를 `.env.local`에

현재 요청 범위는 **읽기 전용**(`gmail.readonly`)입니다. 발송은 더 넓은 범위가
필요하고, 결재 흐름(§112)이 붙기 전까지는 요청하지 않습니다.

### Meta (Instagram)

`META_OAUTH_CLIENT_ID` · `META_OAUTH_CLIENT_SECRET`.
Redirect URI는 `/api/oauth/INSTAGRAM/callback`.
어댑터는 아직 구현되지 않았습니다 — 연결 센터가 그렇게 표시합니다.

---

## 5. 배포 (Netlify)

`netlify.toml`이 이미 있습니다. 필요한 것:

- 위의 환경변수 전부를 Netlify Environment variables에 등록
- OAuth Redirect URI에 배포 도메인 추가
- Supabase Authentication → URL Configuration에 배포 도메인 추가

---

## 문제 해결

| 증상 | 원인 |
|---|---|
| "설정이 필요합니다" 화면 | `NEXT_PUBLIC_SUPABASE_*`가 비어 있음 |
| 회사 설립이 안 됨 | `0002_found_company.sql` 미적용 |
| 연결 후 "invalid_state" | redirect URI 불일치, 또는 10분 초과 |
| 연결은 됐는데 데이터가 안 옴 | `MYCORP24_CREDENTIAL_KEY` 누락 또는 변경됨 |
| 다른 회사 데이터가 보임 | RLS가 꺼져 있음 — 1.2를 다시 확인 |
