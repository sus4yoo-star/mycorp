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
