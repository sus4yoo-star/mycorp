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
