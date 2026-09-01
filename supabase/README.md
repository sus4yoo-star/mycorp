# Supabase

MYCORP24 is multi-tenant. Every tenant-scoped table carries `company_id` and is
guarded by row level security; `is_company_member()` and `is_company_founder()`
are the only two predicates policies need.

## Applying migrations

```bash
supabase db reset          # local
supabase db push           # linked project
```

## Rules that must not be relaxed

- **Credentials never leave the server.** `integration_credentials` has RLS
  enabled and *no policy*, so anon and authenticated roles are denied outright.
  Only the service role reaches it. Spec §110, §187.
- **Audit is append-only.** `audit_events` has select and insert policies and
  deliberately no update or delete policy. Spec §220.4 — the internal audit
  office reads raw events, and nobody rewrites them.
- **Only the founder approves.** `approvals` can be read and inserted by any
  member, but updated only by a founder. Spec §112.
- **Helper functions pin `search_path`.** They are `security definer`; an
  unqualified name inside one is a privilege-escalation vector.

## What is not here yet

Company memory, decision memory, the competitor watchlist, and the public
company profile tables (spec §138–140, §157, §170) land with the features that
use them. An empty table is worse than no table: it invites code that pretends
the feature exists.
