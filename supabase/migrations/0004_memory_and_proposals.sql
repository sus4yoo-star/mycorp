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
