-- MYCORP24 — full schema
--
-- GENERATED FILE. Do not edit.
--   Regenerate: pnpm build:schema
--   Source:     supabase/migrations/*.sql
--
-- ===========================================================================
-- READ THIS BEFORE PASTING
-- ===========================================================================
--
-- This file is for a database that has NEVER had the schema applied.
-- It is not re-runnable: `create table` and `create type` fail on objects that
-- already exist, and a half-failed paste is worse than not starting.
--
--   Empty database, browser only:
--       SQL Editor -> New query -> paste this whole file -> Run
--
--   Empty database, CLI (what CI does):
--       supabase db push
--
--   ALREADY APPLIED, and you want the newer tables:
--       Do NOT paste this file again.
--       Paste only the migration files under supabase/migrations/ that you have
--       not applied yet, in filename order. Each one is additive on its own.
--
-- Either way, finish by running supabase/verify.sql. It changes nothing and
-- raises if the database is not in a safe state. Row level security is the
-- whole security model here; a table with it switched off is wide open.

-- ===========================================================================
-- 0001_init.sql
-- ===========================================================================

-- MYCORP24 — multi-tenant core schema
--
-- Every tenant-scoped table carries company_id and is guarded by row level
-- security. The application mirrors these rules in @mycorp24/auth, but the
-- database is the enforcement point: a bug in the app must not become a leak.
--
-- Spec references: §110 (credentials), §112-113 (approval), §180-188 (security
-- classification and need-to-know), §201/§220.2 (governance), §210 (risk),
-- §220.3 (dynamic tower), §220.4 (audit vault).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type security_level as enum
  ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET');

create type approval_mode as enum ('AUTO', 'ASK', 'BLOCK');

create type approval_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'AMENDED');

create type membership_role as enum ('FOUNDER', 'MEMBER', 'VIEWER');

create type integration_status as enum
  ('FULL', 'READ_WRITE', 'READ_ONLY', 'PARTNER_REQUIRED',
   'BROWSER_ASSISTED', 'MANUAL', 'UNAVAILABLE');

create type risk_category as enum
  ('STRATEGIC', 'FINANCIAL', 'LEGAL', 'SECURITY', 'OPERATIONAL',
   'REPUTATIONAL', 'CUSTOMER', 'PLATFORM', 'AI', 'MARKET');

create type audit_outcome as enum
  ('ALLOWED', 'DENIED', 'PENDING_APPROVAL', 'EXECUTED', 'FAILED');

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------

create table companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  industry      text,
  preset        text not null default 'LOCAL_BUSINESS',
  locale        text not null default 'ko-KR',
  slogan        text,
  logo_url      text,
  founded_on    date,
  created_at    timestamptz not null default now()
);

create table memberships (
  user_id       uuid not null references auth.users (id) on delete cascade,
  company_id    uuid not null references companies (id) on delete cascade,
  role          membership_role not null default 'MEMBER',
  created_at    timestamptz not null default now(),
  primary key (user_id, company_id)
);

create index memberships_company_idx on memberships (company_id);

-- How the chief of staff addresses the founder. Spec §167.
create table founder_identities (
  company_id          uuid primary key references companies (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,
  owner_display_name  text not null,
  preferred_title     text not null default '회장님',
  preferred_nickname  text,
  address_form        text not null default 'title_only'
                        check (address_form in ('title_only','name_title','name_only','custom')),
  custom_address      text,
  locale              text not null default 'ko-KR'
);

-- ---------------------------------------------------------------------------
-- Membership helper
--
-- SECURITY DEFINER so policies can call it without recursing into the RLS on
-- memberships itself. search_path is pinned: an unqualified name inside a
-- definer function is a privilege-escalation vector.
-- ---------------------------------------------------------------------------

create or replace function is_company_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from memberships m
    where m.company_id = target and m.user_id = auth.uid()
  );
$$;

create or replace function is_company_founder(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from memberships m
    where m.company_id = target
      and m.user_id = auth.uid()
      and m.role = 'FOUNDER'
  );
$$;

-- ---------------------------------------------------------------------------
-- Organization — spec §201, §214, §220.3
-- ---------------------------------------------------------------------------

create table divisions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies (id) on delete cascade,
  division_key  text not null,
  created_at    timestamptz not null default now(),
  unique (company_id, division_key)
);

create index divisions_company_idx on divisions (company_id);

create table executives (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies (id) on delete cascade,
  role          text not null,
  display_name  text,
  appointed_at  timestamptz not null default now(),
  unique (company_id, role)
);

create table agents (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies (id) on delete cascade,
  display_name  text not null,
  division_key  text not null,
  reports_to    text,
  skills        text[] not null default '{}',
  -- Need-to-know: an agent reads at most this classification. Spec §188.
  clearance     security_level not null default 'INTERNAL',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create index agents_company_idx on agents (company_id);

-- ---------------------------------------------------------------------------
-- Work, approvals, proposals
-- ---------------------------------------------------------------------------

create table tasks (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies (id) on delete cascade,
  title         text not null,
  detail        text,
  division_key  text,
  agent_id      uuid references agents (id) on delete set null,
  -- AI work and work only the founder can do are tracked separately. Spec §164.
  owner_kind    text not null default 'AGENT' check (owner_kind in ('AGENT','FOUNDER')),
  status        text not null default 'TODO'
                  check (status in ('TODO','IN_PROGRESS','BLOCKED','DONE','CANCELLED')),
  classification security_level not null default 'INTERNAL',
  due_at        timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index tasks_company_status_idx on tasks (company_id, status);

create table approval_policies (
  company_id        uuid not null references companies (id) on delete cascade,
  action            text not null,
  mode              approval_mode not null,
  auto_below_amount numeric(14,2),
  currency          text,
  updated_at        timestamptz not null default now(),
  primary key (company_id, action)
);

create table approvals (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies (id) on delete cascade,
  action        text not null,
  title         text not null,
  summary       text not null,
  amount        numeric(14,2),
  currency      text,
  requested_by  uuid references agents (id) on delete set null,
  status        approval_status not null default 'PENDING',
  decided_by    uuid references auth.users (id) on delete set null,
  decided_at    timestamptz,
  decision_note text,
  created_at    timestamptz not null default now()
);

create index approvals_pending_idx on approvals (company_id, status)
  where status = 'PENDING';

create table proposals (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies (id) on delete cascade,
  proposal_type text not null,
  title         text not null,
  background    text,
  evidence      jsonb not null default '{}'::jsonb,
  recommendation text,
  expected_cost numeric(14,2),
  expected_effect text,
  risk          text,
  division_key  text,
  priority      int not null default 3 check (priority between 1 and 5),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Risk register — spec §210
-- ---------------------------------------------------------------------------

create table risk_register (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies (id) on delete cascade,
  risk_name     text not null,
  category      risk_category not null,
  probability   numeric(3,2) not null check (probability between 0 and 1),
  impact        numeric(3,2) not null check (impact between 0 and 1),
  severity      numeric(4,2) generated always as (probability * impact) stored,
  owner         text,
  mitigation    text,
  status        text not null default 'OPEN'
                  check (status in ('OPEN','MITIGATING','ACCEPTED','CLOSED')),
  detected_at   timestamptz not null default now()
);

create index risk_open_idx on risk_register (company_id, severity desc)
  where status <> 'CLOSED';

-- ---------------------------------------------------------------------------
-- Integrations — spec §80, §110
-- ---------------------------------------------------------------------------

-- Global catalog. Not tenant scoped: it describes what MYCORP24 can connect to.
create table integrations_catalog (
  id                text primary key,
  provider          text not null,
  category          text not null,
  display_name      text not null,
  auth_type         text not null,
  capabilities      text[] not null default '{}',
  approval_required boolean not null default true,
  webhook_supported boolean not null default false,
  mobile_supported  boolean not null default true,
  status            integration_status not null,
  notes             text
);

create table integration_connections (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies (id) on delete cascade,
  catalog_id      text not null references integrations_catalog (id),
  status          integration_status not null default 'READ_ONLY',
  connected_by    uuid references auth.users (id) on delete set null,
  connected_at    timestamptz not null default now(),
  last_health_at  timestamptz,
  unique (company_id, catalog_id)
);

-- Credential vault — spec §110, §187.
--
-- Ciphertext only. Passwords are never stored, plaintext or otherwise. RLS
-- denies every client role: this table is reachable only through the service
-- role from server code, so an anon or authenticated JWT cannot read it even
-- with a company membership.
create table integration_credentials (
  connection_id   uuid primary key references integration_connections (id) on delete cascade,
  company_id      uuid not null references companies (id) on delete cascade,
  ciphertext      bytea not null,
  nonce           bytea not null,
  key_version     int not null default 1,
  expires_at      timestamptz,
  rotated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit vault — spec §220.4
--
-- Append only. The internal audit office reads these rows directly; it must
-- never read another division's summary of them.
-- ---------------------------------------------------------------------------

create table audit_events (
  id            bigserial primary key,
  company_id    uuid not null references companies (id) on delete cascade,
  at            timestamptz not null default now(),
  actor         text not null,
  action        text not null,
  outcome       audit_outcome not null,
  reason        text,
  integration   text,
  payload_digest text
);

create index audit_company_at_idx on audit_events (company_id, at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table companies                enable row level security;
alter table memberships              enable row level security;
alter table founder_identities       enable row level security;
alter table divisions                enable row level security;
alter table executives               enable row level security;
alter table agents                   enable row level security;
alter table tasks                    enable row level security;
alter table approval_policies        enable row level security;
alter table approvals                enable row level security;
alter table proposals                enable row level security;
alter table risk_register            enable row level security;
alter table integration_connections  enable row level security;
alter table integration_credentials  enable row level security;
alter table audit_events             enable row level security;
alter table integrations_catalog     enable row level security;

create policy companies_read on companies
  for select using (is_company_member(id));
create policy companies_write on companies
  for update using (is_company_founder(id)) with check (is_company_founder(id));

create policy memberships_read on memberships
  for select using (user_id = auth.uid() or is_company_member(company_id));
create policy memberships_manage on memberships
  for all using (is_company_founder(company_id)) with check (is_company_founder(company_id));

create policy founder_identity_rw on founder_identities
  for all using (is_company_member(company_id)) with check (is_company_founder(company_id));

-- Tenant-scoped tables the whole company may read and write.
create policy divisions_rw on divisions
  for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy executives_rw on executives
  for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy agents_rw on agents
  for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy tasks_rw on tasks
  for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy proposals_rw on proposals
  for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy risk_rw on risk_register
  for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy connections_rw on integration_connections
  for all using (is_company_member(company_id)) with check (is_company_member(company_id));

-- Approval policy is the founder's control surface. Spec §113.
create policy approval_policies_read on approval_policies
  for select using (is_company_member(company_id));
create policy approval_policies_write on approval_policies
  for all using (is_company_founder(company_id)) with check (is_company_founder(company_id));

-- Anyone in the company sees what is pending; only the founder decides.
create policy approvals_read on approvals
  for select using (is_company_member(company_id));
create policy approvals_insert on approvals
  for insert with check (is_company_member(company_id));
create policy approvals_decide on approvals
  for update using (is_company_founder(company_id)) with check (is_company_founder(company_id));

-- Audit is readable by the company and append-only for everyone.
-- No update or delete policy exists, so neither is ever permitted.
create policy audit_read on audit_events
  for select using (is_company_member(company_id));
create policy audit_append on audit_events
  for insert with check (is_company_member(company_id));

-- The catalog is public reference data.
create policy catalog_read on integrations_catalog
  for select using (true);

-- integration_credentials intentionally has no policy: with RLS enabled and no
-- policy, every client role is denied. Server code uses the service role, which
-- bypasses RLS. Spec §110 — sensitive credentials are server only.


-- ===========================================================================
-- 0002_found_company.sql
-- ===========================================================================

-- Founding a company under row level security.
--
-- 0001 left onboarding impossible, and the flow test in supabase/test/04_flow.sql
-- caught it: `companies` had no INSERT policy, and `memberships` required the
-- caller to already be a founder of the company they were joining. The first
-- founder could therefore never be created.
--
-- The fix is a single security-definer function rather than a pair of
-- permissive policies. Two reasons:
--
--   1. Atomicity. Creating the company and claiming it must happen in one
--      transaction. Done as two client calls with a permissive membership
--      policy, there is a window in which a company exists with no members, and
--      anyone who learns its id could claim it.
--   2. Least privilege. No INSERT policy on `companies` means there is no way
--      to create one except through this function, which always attaches the
--      caller as its founder.

create or replace function found_company(
  p_name               text,
  p_owner_display_name text,
  p_preferred_title    text default '회장님',
  p_preset             text default 'LOCAL_BUSINESS',
  p_locale             text default 'ko-KR'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user    uuid := auth.uid();
  v_company uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'company name is required' using errcode = '22023';
  end if;
  if coalesce(btrim(p_owner_display_name), '') = '' then
    raise exception 'founder name is required' using errcode = '22023';
  end if;

  insert into companies (name, preset, locale)
  values (btrim(p_name), p_preset, p_locale)
  returning id into v_company;

  insert into memberships (user_id, company_id, role)
  values (v_user, v_company, 'FOUNDER');

  insert into founder_identities
    (company_id, user_id, owner_display_name, preferred_title, locale)
  values
    (v_company, v_user, btrim(p_owner_display_name),
     coalesce(nullif(btrim(p_preferred_title), ''), '회장님'), p_locale);

  return v_company;
end
$$;

revoke all on function found_company(text, text, text, text, text) from public;
grant execute on function found_company(text, text, text, text, text) to authenticated;


-- ===========================================================================
-- 0003_oauth_states.sql
-- ===========================================================================

-- OAuth handshake state — spec §110, §111.
--
-- The state parameter is the CSRF defence for the authorization code flow, and
-- the PKCE verifier must never reach the browser. Both are held server side,
-- scoped to the company and the user who started the flow, single-use, and
-- short-lived.

create table oauth_states (
  state          text primary key,
  company_id     uuid not null references companies (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  provider       text not null,
  code_verifier  text,
  redirect_to    text,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '10 minutes'
);

create index oauth_states_expiry_idx on oauth_states (expires_at);

alter table oauth_states enable row level security;

-- A handshake belongs to the person who started it. Not to their company at
-- large: a colleague must not be able to complete someone else's connection.
create policy oauth_states_own on oauth_states
  for all
  using (user_id = auth.uid() and is_company_member(company_id))
  with check (user_id = auth.uid() and is_company_member(company_id));

-- Expired handshakes are garbage. Called opportunistically when a new one is
-- created, so no scheduler is required for correctness.
create or replace function prune_oauth_states()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from oauth_states where expires_at < now();
$$;

grant execute on function prune_oauth_states() to authenticated;

-- What a completed connection knows about itself.
alter table integration_connections
  add column external_account text,
  add column scopes text[] not null default '{}';


-- ===========================================================================
-- 0004_memory_and_proposals.sql
-- ===========================================================================

-- Company memory, the constitution, competitors and founder tasks.
--
-- Spec §138–140 (memory, decisions, constitution), §156–166 (proactive
-- proposals, competitor watchlist, founder accountability, momentum),
-- §194–195 (morning and evening briefings).
--
-- This is what separates the product from a chatbot: the company keeps
-- remembering, watching and proposing when nobody has typed anything.

-- ---------------------------------------------------------------------------
-- Company memory — spec §138, §139
-- ---------------------------------------------------------------------------

create type memory_kind as enum (
  'BUSINESS',      -- products, prices, customers, seasonality
  'BRAND',         -- voice, positioning, what we do not do
  'DECISION',      -- "우리 브랜드는 절대 가격할인 하지마"
  'PREFERENCE',    -- how the founder wants to be reported to
  'FAILURE',       -- what did not work, so we stop proposing it
  'SUCCESS'
);

create table company_memory (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies (id) on delete cascade,
  kind         memory_kind not null,
  statement    text not null,
  detail       text,
  -- A decision the founder stated outranks something an agent inferred.
  source       text not null default 'AGENT' check (source in ('FOUNDER', 'AGENT')),
  classification security_level not null default 'INTERNAL',
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  superseded_by uuid references company_memory (id) on delete set null
);

create index company_memory_active_idx
  on company_memory (company_id, kind) where active;

comment on table company_memory is
  'Long-term company context. Every agent reads the active rows for its company '
  'before acting, so a decision stated once is not re-litigated (spec §139).';

-- ---------------------------------------------------------------------------
-- Company constitution — spec §140
-- ---------------------------------------------------------------------------

create table company_constitution (
  company_id   uuid primary key references companies (id) on delete cascade,
  principles   text,
  prohibitions text,
  brand_philosophy text,
  goals        text,
  budget_stance text,
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Competitor watchlist — spec §157, §158
-- ---------------------------------------------------------------------------

create table competitors (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies (id) on delete cascade,
  name         text not null,
  website      text,
  location     text,
  industry     text,
  social       jsonb not null default '{}'::jsonb,
  price_range  text,
  positioning  text,
  strengths    text,
  weaknesses   text,
  watching     boolean not null default true,
  last_checked_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (company_id, name)
);

create type signal_kind as enum (
  'PRICE_CHANGE', 'NEW_PRODUCT', 'NEW_SERVICE', 'AD_CAMPAIGN', 'SOCIAL_CONTENT',
  'REVIEW_SURGE', 'RATING_CHANGE', 'NEW_LOCATION', 'PROMOTION', 'SITE_CHANGE',
  'HIRING', 'PARTNERSHIP', 'RANKING_CHANGE'
);

create table competitor_signals (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies (id) on delete cascade,
  competitor_id uuid not null references competitors (id) on delete cascade,
  kind          signal_kind not null,
  summary       text not null,
  evidence      jsonb not null default '{}'::jsonb,
  -- 1 (noise) .. 5 (the founder should hear about this today)
  significance  int not null default 3 check (significance between 1 and 5),
  detected_at   timestamptz not null default now(),
  reported_at   timestamptz
);

create index competitor_signals_unreported_idx
  on competitor_signals (company_id, significance desc, detected_at desc)
  where reported_at is null;

-- ---------------------------------------------------------------------------
-- Founder tasks — spec §163, §164
--
-- Work the AI genuinely cannot do: signing, photographing, phoning, deciding.
-- Tracked separately from agent tasks so "오늘 직접 하셔야 할 일은 두 가지입니다"
-- is a real count rather than a guess.
-- ---------------------------------------------------------------------------

create table founder_tasks (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies (id) on delete cascade,
  title        text not null,
  why_founder  text not null,
  blocks       text,
  status       text not null default 'OPEN'
                 check (status in ('OPEN', 'DONE', 'DROPPED')),
  -- Minutes. §165: a ten-minute task gets done; a vague one does not.
  estimate_minutes int not null default 10,
  due_on       date,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index founder_tasks_open_idx
  on founder_tasks (company_id, created_at) where status = 'OPEN';

-- ---------------------------------------------------------------------------
-- Proposals gain a lifecycle — spec §161
-- ---------------------------------------------------------------------------

alter table proposals
  add column status text not null default 'OPEN'
    check (status in ('OPEN', 'ACCEPTED', 'DECLINED', 'SUPERSEDED')),
  add column decided_at timestamptz,
  add column source_signal_id uuid references competitor_signals (id) on delete set null;

create index proposals_open_idx
  on proposals (company_id, priority, created_at) where status = 'OPEN';

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table company_memory       enable row level security;
alter table company_constitution enable row level security;
alter table competitors          enable row level security;
alter table competitor_signals   enable row level security;
alter table founder_tasks        enable row level security;

create policy company_memory_rw on company_memory
  for all using (is_company_member(company_id)) with check (is_company_member(company_id));

-- The constitution is the founder's statement of what the company will and will
-- not do. Everyone reads it; only the founder writes it (§140).
create policy constitution_read on company_constitution
  for select using (is_company_member(company_id));
create policy constitution_write on company_constitution
  for all using (is_company_founder(company_id)) with check (is_company_founder(company_id));

create policy competitors_rw on competitors
  for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy competitor_signals_rw on competitor_signals
  for all using (is_company_member(company_id)) with check (is_company_member(company_id));
create policy founder_tasks_rw on founder_tasks
  for all using (is_company_member(company_id)) with check (is_company_member(company_id));

-- ---------------------------------------------------------------------------
-- Superseding a memory rather than deleting it — spec §139
--
-- A decision that was reversed is itself worth remembering: it stops an agent
-- proposing the reversed thing again next quarter.
-- ---------------------------------------------------------------------------

create or replace function supersede_memory(p_old uuid, p_statement text, p_detail text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old company_memory;
  v_new uuid;
begin
  select * into v_old from company_memory where id = p_old;
  if v_old.id is null then
    raise exception 'memory not found' using errcode = 'P0002';
  end if;
  if not is_company_member(v_old.company_id) then
    raise exception 'not a member of that company' using errcode = '42501';
  end if;

  insert into company_memory (company_id, kind, statement, detail, source, classification)
  values (v_old.company_id, v_old.kind, p_statement, p_detail, 'FOUNDER', v_old.classification)
  returning id into v_new;

  update company_memory
     set active = false, superseded_by = v_new
   where id = p_old;

  return v_new;
end
$$;

revoke all on function supersede_memory(uuid, text, text) from public;
grant execute on function supersede_memory(uuid, text, text) to authenticated;


-- ===========================================================================
-- 0005_competitor_snapshots.sql
-- ===========================================================================

-- Snapshots behind competitor monitoring — spec §158.
--
-- One row per competitor holding the last normalised view of their page. The
-- watcher compares against it; without a stored previous state every check
-- would look like a change, and the founder would learn to ignore the alerts.

create table competitor_snapshots (
  competitor_id uuid primary key references competitors (id) on delete cascade,
  company_id    uuid not null references companies (id) on delete cascade,
  url           text not null,
  fingerprint   text not null,
  -- Normalised page text. Capped by the collector before it gets here.
  content       text not null,
  prices        bigint[] not null default '{}',
  taken_at      timestamptz not null default now()
);

create index competitor_snapshots_company_idx on competitor_snapshots (company_id);

alter table competitor_snapshots enable row level security;

create policy competitor_snapshots_rw on competitor_snapshots
  for all using (is_company_member(company_id)) with check (is_company_member(company_id));

-- Records every collection run, successful or not.
--
-- A run that failed must be visible. "No signals today" and "we could not
-- check today" look identical to a founder unless we write down which it was
-- (§151 — never let silence imply success).
create table intelligence_runs (
  id           bigserial primary key,
  company_id   uuid not null references companies (id) on delete cascade,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  competitors_checked int not null default 0,
  signals_found int not null default 0,
  proposals_created int not null default 0,
  errors       text[] not null default '{}',
  -- Injection attempts found in fetched pages. Worth surfacing on its own.
  sanitised    text[] not null default '{}'
);

create index intelligence_runs_recent_idx
  on intelligence_runs (company_id, started_at desc);

alter table intelligence_runs enable row level security;

create policy intelligence_runs_read on intelligence_runs
  for select using (is_company_member(company_id));
create policy intelligence_runs_write on intelligence_runs
  for all using (is_company_member(company_id)) with check (is_company_member(company_id));


-- ===========================================================================
-- 0006_work.sql
-- ===========================================================================

-- Work the company actually does — spec §112, §164, §220.4.
--
-- `tasks` existed from the first migration and nothing ever wrote to it. It
-- recorded that work existed but not what came of it, so there was no way for
-- an instruction to become something the founder could look at and approve.
--
-- Three columns close that:
--
--   instruction   what the founder actually said. Work must be traceable to a
--                 real instruction; a task with no instruction was invented by
--                 the company, and the founder is entitled to know which is
--                 which (§151).
--   deliverable   what the assigned staff produced. A draft, never an action.
--   approval_id   the approval it is waiting on, when it needs one.
--
-- Nothing here lets a task execute. Anything that touches the outside world
-- still goes through the tool gateway (§131), and the founder still decides.

alter table tasks
  add column if not exists instruction  text,
  add column if not exists deliverable  text,
  add column if not exists delivered_at timestamptz,
  add column if not exists approval_id  uuid references approvals (id) on delete set null;

-- A delivered draft waits for the founder. Without this state a task would go
-- straight from "being written" to "done", and the approval gate would have
-- nowhere to sit.
alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check
  check (status in ('TODO', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'BLOCKED', 'DONE', 'CANCELLED'));

-- A deliverable is the point of the task, so it must not be silently missing.
alter table tasks drop constraint if exists tasks_delivered_has_deliverable;
alter table tasks add constraint tasks_delivered_has_deliverable
  check (
    status not in ('AWAITING_APPROVAL', 'DONE')
    or owner_kind <> 'AGENT'
    or deliverable is not null
  );

create index if not exists tasks_open_idx
  on tasks (company_id, created_at desc)
  where status in ('TODO', 'IN_PROGRESS', 'AWAITING_APPROVAL');


