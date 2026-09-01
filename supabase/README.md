# Supabase

MYCORP24 is multi-tenant. Every tenant-scoped table carries `company_id` and is
guarded by row level security; `is_company_member()` and `is_company_founder()`
are the only two predicates the policies need.

## Migrations

| File | What it does |
|---|---|
| `0001_init.sql` | Tables, enums, helper functions, RLS policies |
| `0002_found_company.sql` | `found_company()` — the only way a company is created |

```bash
supabase db push          # apply to the linked project
supabase db reset         # local
pnpm test:db              # policy tests, no project or Docker required
```

## Testing the policies

`pnpm test:db` boots a throwaway Postgres cluster, stubs the parts of Supabase
the schema depends on (`supabase/test/00_stub_supabase.sql`), applies the
migrations, and then **attacks the policies**:

- a member of one company cannot see, write into, or reach another company
- a signed-out caller sees nothing but the public integration catalog
- a non-founder cannot approve anything or rewrite the approval policy
- a member cannot promote itself to founder
- nobody but the service role can read stored credentials
- audit events can be appended but never rewritten or deleted
- a request with no JWT resolves to no user, not to every user

`04_flow.sql` then runs the founding and approval sequence the application
actually performs, as a signed-in user with RLS on.

**That flow test earned its keep immediately.** `0001` made onboarding
impossible: `companies` had no INSERT policy, and `memberships` required the
caller to already be a founder of the company they were joining, so the first
founder could never exist. Nothing in review caught it; the first run of the
flow test did. `0002` is the fix.

## Rules that must not be relaxed

- **Companies are created only through `found_company()`.** It is
  `security definer`, attaches the caller as founder in the same transaction,
  and there is no INSERT policy on `companies`. Two client calls plus a
  permissive membership policy would leave a window in which a company exists
  with no members and can be claimed by whoever learns its id.
- **Credentials never leave the server.** `integration_credentials` has RLS
  enabled and *no policy*, so anon and authenticated are denied outright. Only
  the service role reaches it. Spec §110, §187.
- **Audit is append-only.** `audit_events` has select and insert policies and
  deliberately no update or delete policy. Spec §220.4 — the internal audit
  office reads raw events, and nobody rewrites them.
- **Only the founder approves.** `approvals` is readable and insertable by any
  member, updatable only by a founder. Spec §112.
- **Helper functions pin `search_path`.** They are `security definer`; an
  unqualified name inside one is a privilege-escalation vector.

## Keeping types in step

`packages/db/src/database.types.ts` is hand-written to match these migrations.
Once a project exists, regenerate it:

```bash
supabase gen types typescript --linked > packages/db/src/database.types.ts
```

A drift between the migration and that file is a runtime error, not a type
error — the worst kind. Change both together.

## What is not here yet

Company memory, decision memory, the competitor watchlist, and the public
company profile tables (spec §138–140, §157, §170) land with the features that
use them. An empty table is worse than no table: it invites code that pretends
the feature exists.
