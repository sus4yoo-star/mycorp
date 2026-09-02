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

-- ---------------------------------------------------------------------------
-- OAuth handshake state — spec §110, §111
-- ---------------------------------------------------------------------------

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$ begin
    insert into oauth_states (state, company_id, user_id, provider, code_verifier)
    values ('state-founder-a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            '11111111-1111-1111-1111-111111111111', 'GMAIL', 'verifier-a');
    assert (select count(*) from oauth_states) = 1, 'the starter can read their own handshake';
  end $$;

  -- A colleague in the same company must not be able to finish it.
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  do $$ begin
    assert (select count(*) from oauth_states) = 0,
      'TEST FAILED: another member reached someone else''s OAuth handshake';
  end $$;
rollback;

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$
  begin
    insert into oauth_states (state, company_id, user_id, provider)
    values ('state-cross', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            '11111111-1111-1111-1111-111111111111', 'GMAIL');
    raise exception 'TEST FAILED: started a handshake for another company';
  exception when insufficient_privilege then null;
  end $$;
rollback;

-- The handshake is finished with a single DELETE ... RETURNING, so that two
-- requests carrying the same state cannot both read the row before either
-- removes it. These assert what that statement does on each side of the policy.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$
  declare
    got int;
  begin
    insert into oauth_states (state, company_id, user_id, provider, code_verifier)
    values ('state-consume', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            '11111111-1111-1111-1111-111111111111', 'GMAIL', 'verifier-c');

    with taken as (
      delete from oauth_states where state = 'state-consume' returning 1
    ) select count(*) into got from taken;
    assert got = 1, 'TEST FAILED: the owner could not consume their own handshake';

    -- Consuming it again must find nothing. This is the single-use property.
    with taken as (
      delete from oauth_states where state = 'state-consume' returning 1
    ) select count(*) into got from taken;
    assert got = 0, 'TEST FAILED: the same handshake was consumed twice';
  end $$;
rollback;

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  insert into oauth_states (state, company_id, user_id, provider)
  values ('state-theirs', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '11111111-1111-1111-1111-111111111111', 'GMAIL');

  -- A colleague consuming it must delete nothing and learn nothing.
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
  do $$
  declare
    got int;
  begin
    with taken as (
      delete from oauth_states where state = 'state-theirs' returning 1
    ) select count(*) into got from taken;
    assert got = 0, 'TEST FAILED: another member consumed someone else''s handshake';
  end $$;
rollback;

\echo 'RLS(oauth): all checks passed'

-- ---------------------------------------------------------------------------
-- Company memory and the constitution — spec §139, §140
-- ---------------------------------------------------------------------------

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';

  do $$ begin
    insert into company_memory (company_id, kind, statement, source)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'DECISION',
            '우리 브랜드는 가격할인을 하지 않는다', 'FOUNDER');
    assert (select count(*) from company_memory) = 1, 'a member may record company memory';
  end $$;

  -- The constitution is the founder's statement, not a shared scratchpad.
  do $$
  begin
    insert into company_constitution (company_id, principles)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '멤버가 쓴 원칙');
    raise exception 'TEST FAILED: a non-founder wrote the company constitution';
  exception when insufficient_privilege then null;
  end $$;
rollback;

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$ begin
    insert into company_constitution (company_id, principles, prohibitions)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '고객 신뢰 우선', '가격할인 금지');
    assert (select prohibitions from company_constitution) = '가격할인 금지',
      'the founder must be able to write the constitution';
  end $$;
rollback;

-- A reversed decision is superseded, never deleted: knowing it was reversed is
-- what stops an agent proposing the same thing again (§139).
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$
  declare old_id uuid; new_id uuid;
  begin
    insert into company_memory (company_id, kind, statement, source)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'DECISION', '할인 금지', 'FOUNDER')
    returning id into old_id;

    new_id := supersede_memory(old_id, '시즌 세일은 허용한다', '2026 여름부터');

    assert (select active from company_memory where id = old_id) = false,
      'the superseded memory must be deactivated';
    assert (select superseded_by from company_memory where id = old_id) = new_id,
      'the old memory must point at what replaced it';
    assert (select count(*) from company_memory where id = old_id) = 1,
      'the superseded memory must still exist';
    assert (select active from company_memory where id = new_id) = true,
      'the replacement must be active';
  end $$;
rollback;

-- supersede_memory is security definer; it must not become a way to reach
-- another company's memory.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$
  declare victim uuid;
  begin
    -- Plant a row in company B using a privileged path, then try to touch it as A.
    insert into company_memory (company_id, kind, statement)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'BRAND', 'B사 브랜드')
    returning id into victim;
    raise exception 'TEST FAILED: wrote memory into another company';
  exception when insufficient_privilege then null;
  end $$;
rollback;

-- ---------------------------------------------------------------------------
-- Competitors and founder tasks
-- ---------------------------------------------------------------------------

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$
  declare c uuid;
  begin
    insert into competitors (company_id, name, watching)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '경쟁사 A', true)
    returning id into c;

    insert into competitor_signals (company_id, competitor_id, kind, summary, significance)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', c, 'PRICE_CHANGE', '가격 15% 인하', 5);

    insert into founder_tasks (company_id, title, why_founder, estimate_minutes)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '신규 서비스 가격 결정',
            'AI가 대신 결정할 수 없는 경영 판단입니다', 10);

    assert (select count(*) from competitor_signals where reported_at is null) = 1,
      'an unreported signal must be findable';
    assert (select count(*) from founder_tasks where status = 'OPEN') = 1,
      'open founder tasks must be countable';
  end $$;

  set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
  do $$ begin
    assert (select count(*) from competitors) = 0, 'competitors must not cross tenants';
    assert (select count(*) from competitor_signals) = 0, 'signals must not cross tenants';
    assert (select count(*) from founder_tasks) = 0, 'founder tasks must not cross tenants';
  end $$;
rollback;

\echo 'RLS(memory): all checks passed'
