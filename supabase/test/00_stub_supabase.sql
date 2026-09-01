-- Test-only stub of the parts of Supabase our schema depends on.
--
-- Supabase provides `auth.users`, `auth.uid()` and the anon / authenticated /
-- service_role roles. A plain Postgres cluster does not, so we recreate just
-- enough of them to exercise row level security locally.
--
-- This file is NEVER applied to a real project — it lives under supabase/test
-- and is only loaded by scripts/db-test.sh.

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

-- Supabase reads the subject out of the verified JWT claims. Tests set the
-- claim with `set local request.jwt.claims`.
--
-- The empty-string guard runs BEFORE the cast, matching Supabase's own
-- implementation. An unset GUC reads back as '' rather than NULL, and casting
-- that to json raises — which inside a policy would turn "no session" into a
-- query error instead of "sees nothing".
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  )::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
