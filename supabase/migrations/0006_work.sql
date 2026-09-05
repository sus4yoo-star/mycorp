-- Work the company actually does — spec §112, §164, §220.4.
--
-- `tasks` existed from the first migration and nothing ever wrote to it. It
-- recorded that work existed but not what came of it, so there was no way for
-- an instruction to become something the founder could look at and approve.
--
-- Three columns close that:
--
--   instruction   what the founder actually said. Work must be traceable to a
--                 real instruction; a task with no instruction was invented by
--                 the company, and the founder is entitled to know which is
--                 which (§151).
--   deliverable   what the assigned staff produced. A draft, never an action.
--   approval_id   the approval it is waiting on, when it needs one.
--
-- Nothing here lets a task execute. Anything that touches the outside world
-- still goes through the tool gateway (§131), and the founder still decides.

alter table tasks
  add column if not exists instruction  text,
  add column if not exists deliverable  text,
  add column if not exists delivered_at timestamptz,
  add column if not exists approval_id  uuid references approvals (id) on delete set null;

-- A delivered draft waits for the founder. Without this state a task would go
-- straight from "being written" to "done", and the approval gate would have
-- nowhere to sit.
alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check
  check (status in ('TODO', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'BLOCKED', 'DONE', 'CANCELLED'));

-- A deliverable is the point of the task, so it must not be silently missing.
alter table tasks drop constraint if exists tasks_delivered_has_deliverable;
alter table tasks add constraint tasks_delivered_has_deliverable
  check (
    status not in ('AWAITING_APPROVAL', 'DONE')
    or owner_kind <> 'AGENT'
    or deliverable is not null
  );

create index if not exists tasks_open_idx
  on tasks (company_id, created_at desc)
  where status in ('TODO', 'IN_PROGRESS', 'AWAITING_APPROVAL');
