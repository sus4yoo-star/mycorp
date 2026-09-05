-- MYCORP24 — post-migration verification.
--
-- Paste into the Supabase SQL Editor after applying the schema. It changes
-- nothing and raises if the database is not in a safe state.
--
-- What it checks is exactly what would be catastrophic to get wrong: a
-- tenant-scoped table with row level security switched off is readable by every
-- user of the project.

do $$
declare
  missing text;
  n int;
begin
  -- 0. Every table the migrations create must actually be here.
  --
  --    `migration repair --status applied` writes history without running SQL,
  --    so a wrong repair leaves the database quietly missing objects while the
  --    deploy reports success. This check is what makes that claim falsifiable:
  --    the name of the missing table names the migration that never ran.
  select string_agg(t, ', ' order by t) into missing
    from unnest(array[
      -- 0001_init
      'agents', 'approval_policies', 'approvals', 'audit_events', 'companies',
      'divisions', 'executives', 'founder_identities',
      'integration_connections', 'integration_credentials',
      'integrations_catalog', 'memberships', 'proposals', 'risk_register',
      'tasks',
      -- 0003_oauth_states
      'oauth_states',
      -- 0004_memory_and_proposals
      'company_constitution', 'company_memory', 'competitor_signals',
      'competitors', 'founder_tasks',
      -- 0005_competitor_snapshots
      'competitor_snapshots', 'intelligence_runs'
    ]) as t
   where to_regclass('public.' || t) is null;

  if missing is not null then
    raise exception 'missing table(s): % — a migration did not run', missing;
  end if;

  -- 0b. Columns a later migration adds are just as skippable by a wrong
  --     repair, and their absence is silent: the app would fail at runtime on
  --     the first instruction a founder gives.
  select string_agg(c, ', ' order by c) into missing
    from unnest(array['instruction', 'deliverable', 'delivered_at', 'approval_id']) as c
   where not exists (
     select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tasks' and column_name = c);

  if missing is not null then
    raise exception 'tasks is missing column(s): % — migration 0006 did not run', missing;
  end if;

  -- 0c. A decision has to be able to close the work it was raised for.
  select count(*) into n from pg_constraint
   where conrelid = 'public.tasks'::regclass
     and conname = 'tasks_status_check'
     and pg_get_constraintdef(oid) like '%CANCELLED%'
     and pg_get_constraintdef(oid) like '%AWAITING_APPROVAL%';
  if n <> 1 then
    raise exception 'tasks_status_check does not admit AWAITING_APPROVAL and CANCELLED';
  end if;

  -- 1. Every table in `public` must have row level security enabled.
  select string_agg(tablename, ', ' order by tablename) into missing
    from pg_tables
   where schemaname = 'public' and not rowsecurity;

  if missing is not null then
    raise exception 'RLS is OFF for: %', missing;
  end if;

  -- 2. Credentials must have RLS on and no policy at all, so only the service
  --    role can reach them (spec §110, §187).
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'integration_credentials';
  if n <> 0 then
    raise exception 'integration_credentials must have no policy, found %', n;
  end if;

  -- 3. The audit vault must be append-only: no update or delete policy.
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'audit_events'
     and cmd in ('UPDATE', 'DELETE');
  if n <> 0 then
    raise exception 'audit_events must not be updatable or deletable, found % policies', n;
  end if;

  -- 4. Companies must be creatable only through found_company().
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'companies' and cmd = 'INSERT';
  if n <> 0 then
    raise exception 'companies must have no INSERT policy, found %', n;
  end if;

  if to_regprocedure('public.found_company(text,text,text,text,text)') is null then
    raise exception 'found_company() is missing — migration 0002 was not applied';
  end if;

  -- 5. Security-definer helpers must pin search_path.
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.prosecdef
     and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%';
  if n <> 0 then
    raise exception '% security definer function(s) do not pin search_path', n;
  end if;

  raise notice 'MYCORP24 schema verified: RLS on everywhere, credentials sealed, audit append-only.';
end
$$;

-- A readable summary for the eye as well as the assertion above.
select tablename,
       rowsecurity as rls_enabled,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = t.tablename) as policies
  from pg_tables t
 where schemaname = 'public'
 order by tablename;
