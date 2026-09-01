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
