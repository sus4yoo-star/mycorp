# MYCORP24 — working notes

A 회장님 (the sole founder) runs their company by talking to an AI 비서실장.
There is one human user. Every screen and sentence is addressed to them.

**[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) is the rulebook** — the tool
gateway, external content, credentials, floors, locale, what is deliberately
absent. Read it before changing behaviour; this file is only what it does not
say.

## The one rule everything else serves

Never tell the founder something happened when it did not (§151).

A founder who is told work was done, and later finds it was not, stops
believing the screens that were telling the truth too. So: an approval is a
decision, never an outcome. `DONE` is only for work that actually left the
building; approved-but-undeliverable ends `BLOCKED` with a reason naming what
is missing. Work the founder asked for never disappears silently — not on an
error path, not on an early return. A number with no source is worse than no
number.

When you cannot do something, say so in the sentence the founder reads.

## Commands

```bash
pnpm turbo run lint typecheck test build      # the gate — run before every commit
PGTEST_USER=pgtest bash scripts/db-test.sh    # RLS suite (see note below)
APP_URL=https://… bash scripts/smoke.sh       # ask the live site what it serves
```

`pnpm test:db` **fails as root** — initdb refuses to start a cluster. Set
`PGTEST_USER` to any existing non-root account; this container has `pgtest`.
The suite stands up a throwaway Postgres and attacks the policies as a real
signed-in user — no Docker, no network, no Supabase project.

Packages export raw TypeScript, so there is no build step between editing one
and seeing it in the app.

## Things that have cost time here

- **Route rendering looks wrong locally.** Without `NEXT_PUBLIC_SUPABASE_*` set,
  pages short-circuit to a setup notice and prerender static (○). With them set
  they are dynamic (ƒ), which is what production does. Check with the env before
  "fixing" a page that is not broken.
- **`curl -w '%{http_code}' || echo 000` yields `000000`.** curl prints its own
  000 on a connection failure. This made `scripts/smoke.sh` report
  "all paths served." for a site nobody could reach. Capture curl's exit status
  separately, and prove a check can fail before trusting a green run.
- **Netlify's `--filter` selects which `netlify.toml` is read, not a path base.**
  Paths inside it stay repo-root-relative.
- **Ask the system, don't guess.** Supabase migration state, Netlify's refusal
  reason, auth config field names — each has a script under `scripts/` that
  reads the answer back and fails loudly, by name, when its assumption breaks.
- Deploys are currently blocked on exhausted Netlify credits. Only the account
  owner can clear that.

## Korean that reaches the founder

- **Particles agree with the word before them.** Never hardcode 을/를, 은/는,
  이/가, 와/과, 으로/로 into a template with a variable in it — use
  `packages/types/src/particle.ts` (`eul`, `eun`, `i`, `wa`, `euro`, and the
  `withEul` / `withEun` / `withI` forms). ㄹ takes 로, alone among final
  consonants. `을(를)` is for printed documents that cannot know the word; we
  know the word.
- **No identifiers on screen.** `CUSTOMER_EXPERIENCE` is 고객경험센터
  (`divisionMeta(key).ko`); `GMAIL` is Gmail (`providerDisplayName`).
- **"오늘" means the founder's day**, not a rolling 24 hours — `seoulDayStart` /
  `isSeoulEvening` in `packages/business-logic/src/clock.ts`.
- Voice is fixed by `docs/brand/BRAND.md` §10; landing copy by
  `docs/brand/MESSAGING.md` — do not paraphrase either.

## Secrets

`SUPABASE_SERVICE_ROLE_KEY`, `MYCORP24_CREDENTIAL_KEY`, `MYCORP24_CRON_SECRET`,
`ANTHROPIC_API_KEY`: never paste a value into chat, a commit, an issue, a log or
an error message. Say where one lives, never what it is. The service role key
bypasses RLS entirely; losing `MYCORP24_CREDENTIAL_KEY` makes every stored OAuth
token undecryptable.

## Testing habits that hold here

- **Invert a new assertion to prove it fails.** A SQL check or a negative
  expectation that cannot fail is decoration. This is how the settle-once guard
  and the `CANCELLED` status check were confirmed.
- **Probe with real sentences.** Push what a 사장님 would actually type through
  `route()` and `assignWork()` and read the output as they would. This found six
  bugs in one sitting, including the product's own printed example
  ("리뷰 답변 준비해줘") never becoming work. Delete the probe file afterwards;
  move anything it caught into the real test file.

## Agents

`.claude/agents/` — `honesty-auditor`, `korean-copy`, `rls-boundary`,
`utterance-probe`. Each is written around what this repository has actually got
wrong. Use them for the reviews they cover rather than re-deriving the rules.

## Working agreement

Develop on the branch given for the task, commit with a message that says what
changed and why it mattered, push. **Do not open a pull request unless asked.**
