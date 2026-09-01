-- Row level security tests.
--
-- These attack the policies rather than describe them. Every check either
-- passes silently or raises, so a single non-zero exit means a policy regressed.
--
-- Run with: bash scripts/db-test.sh

\set ON_ERROR_STOP on
\set QUIET on

\set founder_a '11111111-1111-1111-1111-111111111111'
\set member_a  '22222222-2222-2222-2222-222222222222'
\set founder_b '33333333-3333-3333-3333-333333333333'
\set outsider  '44444444-4444-4444-4444-444444444444'
\set company_a 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
\set company_b 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

-- ---------------------------------------------------------------------------
-- Tenant isolation
-- ---------------------------------------------------------------------------

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  do $$ begin
    assert (select count(*) from companies) = 1,
      'founder A must see exactly one company';
    assert (select name from companies) = 'Company A',
      'founder A must see only Company A';
    assert (select count(*) from tasks) = 1,
      'tasks must be scoped to the company';
    assert (select count(*) from approvals) = 1,
      'approvals must be scoped to the company';
    assert (select count(*) from audit_events) = 1,
      'audit events must be scoped to the company';
  end $$;
rollback;

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
  do $$ begin
    assert (select name from companies) = 'Company B',
      'founder B must see only Company B';
    assert (select count(*) from approvals
            where company_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 0,
      'company B must not reach company A approvals';
  end $$;
rollback;

-- Someone with no membership sees nothing at all.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444"}';
  do $$ begin
    assert (select count(*) from companies) = 0, 'outsider must see no company';
    assert (select count(*) from approvals) = 0, 'outsider must see no approval';
    assert (select count(*) from tasks) = 0, 'outsider must see no task';
    assert (select count(*) from audit_events) = 0, 'outsider must see no audit event';
  end $$;
rollback;

-- An unauthenticated caller sees nothing but the public catalog.
begin;
  set local role anon;
  do $$ begin
    assert (select count(*) from integrations_catalog) = 1,
      'the integration catalog is public reference data';
  end $$;
  do $$
  begin
    perform 1 from companies;
    raise exception 'TEST FAILED: anon reached companies';
  exception when insufficient_privilege then null;
  end $$;
rollback;

-- ---------------------------------------------------------------------------
-- Writes cannot cross a tenant boundary (WITH CHECK)
-- ---------------------------------------------------------------------------

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$
  begin
    insert into tasks (company_id, title)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '남의 회사에 넣기');
    raise exception 'TEST FAILED: wrote a task into another company';
  exception when insufficient_privilege then null;
  end $$;
rollback;

-- ---------------------------------------------------------------------------
-- Only the founder decides — spec §112
-- ---------------------------------------------------------------------------

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  do $$
  declare touched int;
  begin
    assert (select count(*) from approvals) = 1,
      'a member may see what is pending';
    update approvals set status = 'APPROVED'
      where id = 'a0000000-0000-0000-0000-000000000001';
    get diagnostics touched = row_count;
    assert touched = 0, 'TEST FAILED: a non-founder approved something';
  end $$;
rollback;

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$
  declare touched int;
  begin
    update approvals set status = 'APPROVED'
      where id = 'a0000000-0000-0000-0000-000000000001';
    get diagnostics touched = row_count;
    assert touched = 1, 'the founder must be able to approve';
  end $$;
rollback;

-- Approval policy is the founder's control surface — spec §113
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  do $$
  begin
    assert (select count(*) from approval_policies) = 1,
      'a member may read the policy';
    insert into approval_policies (company_id, action, mode)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SPEND_MONEY', 'AUTO');
    raise exception 'TEST FAILED: a non-founder rewrote the approval policy';
  exception when insufficient_privilege then null;
  end $$;
rollback;

-- ---------------------------------------------------------------------------
-- Credentials are server only — spec §110, §187
-- ---------------------------------------------------------------------------

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$
  begin
    perform 1 from integration_credentials;
    raise exception 'TEST FAILED: a member read stored credentials';
  exception when insufficient_privilege then null;
  end $$;
rollback;

begin;
  set local role anon;
  do $$
  begin
    perform 1 from integration_credentials;
    raise exception 'TEST FAILED: anon read stored credentials';
  exception when insufficient_privilege then null;
  end $$;
rollback;

-- The service role is the only way in, and it is server side.
begin;
  set local role service_role;
  do $$ begin
    assert (select count(*) from integration_credentials) = 1,
      'the service role must still be able to use credentials';
  end $$;
rollback;

-- ---------------------------------------------------------------------------
-- The audit vault is append only — spec §220.4
-- ---------------------------------------------------------------------------

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  do $$ begin
    insert into audit_events (company_id, actor, action, outcome)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'agent-2', 'GMAIL:SEND_MAIL', 'DENIED');
    assert (select count(*) from audit_events) = 2, 'audit events must be appendable';
  end $$;

  do $$
  begin
    update audit_events set outcome = 'EXECUTED';
    raise exception 'TEST FAILED: an audit event was rewritten';
  exception when insufficient_privilege then null;
  end $$;

  do $$
  begin
    delete from audit_events;
    raise exception 'TEST FAILED: an audit event was deleted';
  exception when insufficient_privilege then null;
  end $$;
rollback;

-- ---------------------------------------------------------------------------
-- Membership cannot be granted to yourself
-- ---------------------------------------------------------------------------

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444"}';
  do $$
  begin
    insert into memberships (user_id, company_id, role)
    values ('44444444-4444-4444-4444-444444444444',
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'FOUNDER');
    raise exception 'TEST FAILED: an outsider joined a company';
  exception when insufficient_privilege then null;
  end $$;
rollback;

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  do $$
  declare touched int;
  begin
    update memberships set role = 'FOUNDER'
      where user_id = '22222222-2222-2222-2222-222222222222';
    get diagnostics touched = row_count;
    assert touched = 0, 'TEST FAILED: a member promoted itself to founder';
  end $$;
rollback;

-- ---------------------------------------------------------------------------
-- The helper functions do not leak across tenants
-- ---------------------------------------------------------------------------

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  do $$ begin
    assert is_company_member('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
      'member A is a member of company A';
    assert not is_company_member('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
      'member A is not a member of company B';
    assert not is_company_founder('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
      'member A is not a founder';
  end $$;
rollback;

-- A request with no JWT resolves to no user, not to every user.
begin;
  set local role authenticated;
  do $$ begin
    assert auth.uid() is null, 'a missing JWT must not resolve to a user';
    assert (select count(*) from companies) = 0, 'no JWT must see nothing';
  end $$;
rollback;

\echo 'RLS: all checks passed'
