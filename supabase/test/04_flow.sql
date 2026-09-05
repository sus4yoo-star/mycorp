-- Onboarding and approval flow, run as a real signed-in user with RLS on.
--
-- The unit tests exercise our TypeScript; this exercises the database against
-- the exact sequence packages/db/src/queries.ts performs. A policy that blocks
-- a legitimate flow is as much a bug as one that permits an illegitimate one.

\set ON_ERROR_STOP on
\set QUIET on

-- A brand new user with no company yet.
insert into auth.users (id, email)
values ('55555555-5555-5555-5555-555555555555', 'new-founder@example.com')
on conflict do nothing;

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555"}';

  do $$
  declare new_company uuid;
  begin
    -- foundCompany step 1: company + founder membership + identity, atomically
    new_company := found_company('새회사', '김창업', '회장님', 'LOCAL_BUSINESS', 'ko-KR');

    assert (select role from memberships
             where company_id = new_company
               and user_id = '55555555-5555-5555-5555-555555555555') = 'FOUNDER',
      'the caller must become the founder of the company they create';
    assert (select owner_display_name from founder_identities
             where company_id = new_company) = '김창업',
      'the founder identity must be stored';

    -- step 2: divisions, executives, starting approval policy
    insert into divisions (company_id, division_key)
    values (new_company, 'MARKETING'), (new_company, 'OPERATIONS');

    insert into executives (company_id, role)
    values (new_company, 'CMO'), (new_company, 'COO');

    insert into approval_policies (company_id, action, mode)
    values (new_company, 'CHANGE_AD_BUDGET', 'ASK'), (new_company, 'SIGN_CONTRACT', 'BLOCK');

    assert (select count(*) from companies where id = new_company) = 1,
      'the founder must see the company they just created';
    assert (select count(*) from divisions where company_id = new_company) = 2,
      'seeded divisions must be visible';
    assert (select count(*) from approval_policies where company_id = new_company) = 2,
      'the starting approval policy must be visible';
  end $$;
rollback;

-- A company cannot be created outside found_company, and not at all anonymously.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555"}';
  do $$
  begin
    insert into companies (name) values ('우회 생성');
    raise exception 'TEST FAILED: a company was created without found_company';
  exception when insufficient_privilege then null;
  end $$;
rollback;

begin;
  set local role authenticated;
  do $$
  begin
    perform found_company('세션 없이', '아무개');
    raise exception 'TEST FAILED: found_company ran without a session';
  exception when invalid_authorization_specification then null;
  end $$;
rollback;

-- An approval can only be decided once.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

  do $$
  declare touched int;
  begin
    update approvals
       set status = 'APPROVED', decided_by = '11111111-1111-1111-1111-111111111111',
           decided_at = now()
     where id = 'a0000000-0000-0000-0000-000000000001'
       and company_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and status = 'PENDING';
    get diagnostics touched = row_count;
    assert touched = 1, 'the first decision must land';

    -- The same guard the application uses: only PENDING rows are decidable.
    update approvals
       set status = 'REJECTED'
     where id = 'a0000000-0000-0000-0000-000000000001'
       and status = 'PENDING';
    get diagnostics touched = row_count;
    assert touched = 0, 'TEST FAILED: an approval was decided twice';
  end $$;
rollback;

-- A founder can hire into their own company, and only their own. The roster
-- itself lives in TypeScript (packages/business-logic/src/staffing.ts); what
-- has to hold here is that the policy lets the founder write it and stops
-- anyone else, because a company with no staff reports "0명 업무 중" to someone
-- who was promised an organisation.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$
  declare hired int;
  begin
    insert into agents (company_id, display_name, division_key, reports_to, skills, clearance)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '리뷰 응대 담당',
            'CUSTOMER_EXPERIENCE', 'COO', array['READ_REVIEWS','RESPOND_REVIEW'], 'INTERNAL');
    select count(*) into hired from agents
     where company_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    assert hired >= 1, 'the founder could not staff their own company';
  end $$;

  -- Someone outside the company must not be able to place staff inside it.
  set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555"}';
  do $$
  begin
    insert into agents (company_id, display_name, division_key)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '잠입 담당', 'MARKETING');
    raise exception 'TEST FAILED: an outsider hired into another company';
  exception when insufficient_privilege then null;
  end $$;

  -- And must not be able to read who works there.
  do $$
  declare seen int;
  begin
    select count(*) into seen from agents
     where company_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    assert seen = 0, 'TEST FAILED: an outsider read another company''s roster';
  end $$;
rollback;

-- Work: an instruction becomes a draft the founder decides on — spec §112, §164.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$
  declare
    t uuid;
  begin
    insert into tasks (company_id, title, instruction, division_key, status)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '리뷰 답변 초안',
            '리뷰 답변 좀 준비해줘', 'CUSTOMER_EXPERIENCE', 'IN_PROGRESS')
    returning id into t;

    -- The state that did not exist before: a draft is finished and waiting on
    -- the founder. Without it a task goes from being written to done, and the
    -- approval gate has nowhere to sit.
    update tasks
       set status = 'AWAITING_APPROVAL', deliverable = '초안 본문', delivered_at = now()
     where id = t;
    assert (select status from tasks where id = t) = 'AWAITING_APPROVAL',
      'a delivered draft could not wait for the founder';
  end $$;

  -- A task cannot claim to be delivered with nothing to show. Reporting work
  -- that produced nothing is the failure this product must not have.
  do $$
  declare
    t uuid;
  begin
    insert into tasks (company_id, title, instruction, status)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '빈 결과물', '해줘', 'TODO')
    returning id into t;
    update tasks set status = 'DONE' where id = t;
    raise exception 'TEST FAILED: a task was completed with no deliverable';
  exception when check_violation then null;
  end $$;

  -- Work the founder does themselves has no deliverable to produce.
  do $$
  begin
    insert into tasks (company_id, title, owner_kind, status, instruction)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '사업자등록 갱신',
            'FOUNDER', 'DONE', '이건 제가 합니다');
  end $$;
rollback;

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  insert into tasks (company_id, title, instruction)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '남의 일', '해줘');

  -- Work is as tenant-scoped as everything else.
  set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555"}';
  do $$
  declare seen int;
  begin
    select count(*) into seen from tasks
     where company_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    assert seen = 0, 'TEST FAILED: an outsider read another company''s work';
  end $$;
rollback;

-- Settlement: a decision closes the work it was raised for — spec §112, §151.
--
-- The gap this covers is the one a founder feels: before it, approving left the
-- task in AWAITING_APPROVAL for good, which from their chair looks identical to
-- the company dropping the work.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$
  declare
    t uuid;
    touched int;
  begin
    insert into tasks (company_id, title, instruction, division_key, status,
                       deliverable, delivered_at, approval_id)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '리뷰 답변 초안',
            '리뷰 답변 준비해줘', 'CUSTOMER_EXPERIENCE', 'AWAITING_APPROVAL',
            '초안 본문', now(), 'a0000000-0000-0000-0000-000000000001')
    returning id into t;

    -- The application finds the task by the approval it waits on.
    assert (select count(*) from tasks
             where company_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
               and approval_id = 'a0000000-0000-0000-0000-000000000001'
               and status = 'AWAITING_APPROVAL') = 1,
      'the task waiting on an approval could not be found by it';

    -- Approved but nothing is connected: the honest ending is BLOCKED with a
    -- reason, not DONE. DONE would tell the founder something left the building.
    update tasks
       set status = 'BLOCKED', detail = '승인은 기록되었습니다. 다만 연결이 없습니다.'
     where id = t and status = 'AWAITING_APPROVAL';
    get diagnostics touched = row_count;
    assert touched = 1, 'an approved task could not be closed out';

    -- Settling twice must not land: the same guard the application relies on.
    update tasks set status = 'DONE' where id = t and status = 'AWAITING_APPROVAL';
    get diagnostics touched = row_count;
    assert touched = 0, 'TEST FAILED: a task was settled twice';
  end $$;

  -- Rejected work is cancelled, and CANCELLED must be a status the table accepts.
  do $$
  declare t uuid;
  begin
    insert into tasks (company_id, title, instruction, status, deliverable, delivered_at)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '반려된 초안', '해줘',
            'AWAITING_APPROVAL', '초안 본문', now())
    returning id into t;
    update tasks set status = 'CANCELLED', detail = '회장님이 반려하셨습니다.' where id = t;
    assert (select status from tasks where id = t) = 'CANCELLED',
      'rejected work could not be cancelled';
  end $$;
rollback;

-- The founder disposes of work the company could not finish.
--
-- A blocked task has no deliverable to show, so the only honest way it reaches
-- DONE is by becoming the founder's own — which is exactly what happened when
-- they say "제가 직접 처리했습니다".
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
  do $$
  declare t uuid;
  begin
    insert into tasks (company_id, title, instruction, status, detail)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '리뷰 답글', '올려줘',
            'BLOCKED', '연결이 없습니다.')
    returning id into t;

    -- Still company work, still nothing produced: the table must refuse.
    begin
      update tasks set status = 'DONE' where id = t;
      raise exception 'TEST FAILED: blocked work was completed with nothing to show';
    exception when check_violation then null;
    end;

    update tasks set status = 'DONE', owner_kind = 'FOUNDER',
                     detail = '회장님이 직접 처리하셨습니다.'
     where id = t and status = 'BLOCKED';
    assert (select status from tasks where id = t) = 'DONE',
      'the founder could not close work they handled themselves';
  end $$;

  -- Dropping it needs no deliverable either way.
  do $$
  declare t uuid;
  begin
    insert into tasks (company_id, title, instruction, status)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '접을 일', '해줘', 'BLOCKED')
    returning id into t;
    update tasks set status = 'CANCELLED', detail = '회장님이 접으셨습니다.'
     where id = t and status = 'BLOCKED';
    assert (select status from tasks where id = t) = 'CANCELLED',
      'the founder could not drop work the company was stuck on';
  end $$;
rollback;

\echo 'FLOW: all checks passed'
