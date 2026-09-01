-- Deterministic fixtures for the RLS tests.
--
-- Two companies with separate people, so "can A see B" is a real question.

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'founder-a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'member-a@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'founder-b@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'outsider@example.com');

insert into companies (id, name, preset) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Company A', 'LOCAL_BUSINESS'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Company B', 'SOLO_SAAS');

insert into memberships (user_id, company_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'FOUNDER'),
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'MEMBER'),
  ('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'FOUNDER');

insert into approvals (id, company_id, action, title, summary) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'CHANGE_AD_BUDGET', 'Meta 광고 증액안', '일 예산 30만원으로 증액'),
  ('b0000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'PUBLISH_POST', 'B사 게시물', '공개 게시');

insert into approval_policies (company_id, action, mode) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'REPLY_REVIEW', 'AUTO');

insert into tasks (company_id, title) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A사 업무'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B사 업무');

insert into audit_events (company_id, actor, action, outcome) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'agent-1', 'INSTAGRAM:PUBLISH_SOCIAL', 'EXECUTED');

insert into integrations_catalog (id, provider, category, display_name, auth_type, status)
values ('gmail', 'GMAIL', 'COMMUNICATION', 'Gmail', 'OAUTH2', 'READ_WRITE');

insert into integration_connections (id, company_id, catalog_id)
values ('c0000000-0000-0000-0000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gmail');

insert into integration_credentials (connection_id, company_id, ciphertext, nonce)
values ('c0000000-0000-0000-0000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '\x0badc0de'::bytea, '\x0badbeef'::bytea);
