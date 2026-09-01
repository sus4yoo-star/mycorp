-- Table grants.
--
-- RLS decides which *rows* a role may touch; grants decide which *tables* it
-- may reach at all. Supabase issues these for the API roles; we mirror them so
-- the local tests fail for the same reasons production would.
--
-- integration_credentials is deliberately absent: no grant, no policy, so only
-- the service role (which bypasses RLS and owns the schema) can read it.

grant select, insert, update, delete on
  companies, memberships, founder_identities, divisions, executives, agents,
  tasks, approval_policies, approvals, proposals, risk_register,
  integration_connections, oauth_states, company_memory,
  company_constitution, competitors, competitor_signals, founder_tasks,
  competitor_snapshots, intelligence_runs
to authenticated;

grant select, insert on audit_events to authenticated;
grant usage, select on sequence audit_events_id_seq to authenticated;
grant usage, select on sequence intelligence_runs_id_seq to authenticated;

grant select on integrations_catalog to anon, authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
