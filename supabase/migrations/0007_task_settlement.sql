-- Settling work is the founder's declaration, not any member's.
--
-- `tasks_rw` granted write to every company member, so a second member could
-- close the founder's blocked work as DONE — and the sentence the application
-- writes with it is "회장님이 직접 처리하셨습니다". A false statement about work
-- nobody did, attributed to the founder, in the audit trail.
--
-- The approval room already enforces founder-only in the database
-- (`approvals_decide`). Tasks now match it for the two statuses that mean the
-- work is over. Everything else about a task — opening it, delivering a draft,
-- blocking it — stays open to members, because that is the company working.
--
-- An UPDATE policy sees the old row in `using` and the new row in `with check`,
-- so this restricts what a row may become without restricting who may touch it.

drop policy if exists tasks_rw on tasks;

create policy tasks_read on tasks
  for select using (is_company_member(company_id));

create policy tasks_open on tasks
  for insert with check (
    is_company_member(company_id)
    and (status not in ('DONE', 'CANCELLED') or is_company_founder(company_id))
  );

create policy tasks_work on tasks
  for update using (is_company_member(company_id))
  with check (
    is_company_member(company_id)
    and (status not in ('DONE', 'CANCELLED') or is_company_founder(company_id))
  );

create policy tasks_delete on tasks
  for delete using (is_company_founder(company_id));
