import 'server-only';

import {
  assignWork,
  deliverableNeedsApproval,
  type Assignment,
} from '@mycorp24/business-logic';
import { writeDraft, type DraftContext } from '@mycorp24/work';
import { createAiProvider } from '@mycorp24/ai-gateway';
import {
  appendAuditEvent,
  blockTask,
  createTask,
  deliverTask,
  getConstitution,
  listAgents,
  listCompanyMemory,
  listDivisions,
  requestApproval,
  type Db,
  type TaskRow,
} from '@mycorp24/db';

/**
 * One instruction, carried out — spec §112, §151, §164.
 *
 * "AI가 준비하고, 회장님이 결재하고, 회사가 실행한다" was true of everything
 * except the preparing. An instruction produced a sentence about the
 * instruction; nothing was ever written, filed or waiting when the founder came
 * back. This is the missing middle.
 *
 * Every ending is recorded, including the ones where nothing was produced. A
 * founder cannot tell "the company decided not to" from "the company did
 * nothing" unless we write down which happened, and the difference is the whole
 * of their trust.
 */

export type WorkOutcome =
  | { readonly kind: 'DRAFTED'; readonly task: TaskRow; readonly needsApproval: boolean }
  | { readonly kind: 'BLOCKED'; readonly task: TaskRow; readonly reason: string }
  | { readonly kind: 'NO_DIVISION'; readonly wanted: string }
  | { readonly kind: 'UNCLEAR' };

export async function runInstruction(
  db: Db,
  company: { readonly companyId: string; readonly companyName: string; readonly address: string },
  instruction: string,
): Promise<WorkOutcome> {
  const divisions = await listDivisions(db, company.companyId);
  const assignment: Assignment = assignWork(instruction, divisions);

  // Neither of these opens a task. Work filed on a floor the company does not
  // have, or filed on a guess, is work nobody owns.
  if (assignment.kind === 'UNCLEAR') return { kind: 'UNCLEAR' };
  if (assignment.kind === 'NO_DIVISION') return { kind: 'NO_DIVISION', wanted: assignment.wanted };

  const staff = (await listAgents(db, company.companyId)).filter(
    (a) => a.division_key === assignment.division,
  );
  const assignee = staff[0];

  const task = await createTask(db, {
    companyId: company.companyId,
    title: assignment.title,
    instruction,
    divisionKey: assignment.division,
    ...(assignee ? { agentId: assignee.id } : {}),
  });

  await appendAuditEvent(db, {
    companyId: company.companyId,
    actor: assignee?.display_name ?? assignment.division,
    action: `WORK:ASSIGN:${assignment.division}`,
    outcome: 'ALLOWED',
    reason: assignment.title,
  });

  const context = await draftContext(db, company);

  let outcome;
  try {
    outcome = await writeDraft(createAiProvider(), {
      instruction,
      assignment,
      staffName: assignee?.display_name ?? '담당자',
      context,
    });
  } catch (err) {
    // The task stays visible and says why. Deleting it would hide that the
    // founder asked for something and got nothing.
    const reason = err instanceof Error ? err.message : '초안을 작성하지 못했습니다.';
    return { kind: 'BLOCKED', task: await stop(db, company.companyId, task, reason), reason };
  }

  if (outcome.rejected) {
    const reason = `회장님이 정하신 것과 충돌합니다: "${outcome.rejected.rule}"`;
    return { kind: 'BLOCKED', task: await stop(db, company.companyId, task, reason), reason };
  }

  const draft = outcome.draft;
  if (!draft || draft.cannotDo) {
    const reason = draft?.cannotDo ?? '초안을 작성하지 못했습니다.';
    return { kind: 'BLOCKED', task: await stop(db, company.companyId, task, reason), reason };
  }

  const needsApproval = deliverableNeedsApproval(assignment);
  let approvalId: string | undefined;

  if (needsApproval && assignment.action) {
    const approval = await requestApproval(db, {
      companyId: company.companyId,
      action: assignment.action,
      title: draft.title,
      // The founder decides on the draft itself, not on a description of it.
      summary: [draft.body, ...(draft.checkFirst.length > 0 ? ['', '확인하실 것:', ...draft.checkFirst.map((c: string) => `· ${c}`)] : [])].join('\n'),
      ...(assignee ? { requestedBy: assignee.id } : {}),
    });
    approvalId = approval.id;
  }

  const delivered = await deliverTask(db, {
    taskId: task.id,
    companyId: company.companyId,
    deliverable: draft.body,
    ...(approvalId ? { approvalId } : {}),
  });

  await appendAuditEvent(db, {
    companyId: company.companyId,
    actor: assignee?.display_name ?? assignment.division,
    action: `WORK:DELIVER:${assignment.division}`,
    outcome: needsApproval ? 'PENDING_APPROVAL' : 'ALLOWED',
    reason: draft.title,
  });

  return { kind: 'DRAFTED', task: delivered, needsApproval };
}

async function stop(
  db: Db,
  companyId: string,
  task: TaskRow,
  reason: string,
): Promise<TaskRow> {
  const blocked = await blockTask(db, { taskId: task.id, companyId, reason });
  await appendAuditEvent(db, {
    companyId,
    actor: task.division_key ?? 'system',
    action: 'WORK:BLOCK',
    outcome: 'DENIED',
    reason,
  });
  return blocked;
}

/** What the writer is allowed to know. Nothing is added that is not true today. */
async function draftContext(
  db: Db,
  company: { readonly companyId: string; readonly companyName: string; readonly address: string },
): Promise<DraftContext> {
  const [constitution, memory] = await Promise.all([
    getConstitution(db, company.companyId),
    listCompanyMemory(db, company.companyId),
  ]);

  return {
    address: company.address,
    companyName: company.companyName,
    decisions: [
      ...memory.filter((m) => m.kind === 'DECISION').map((m) => m.statement),
      ...(constitution?.prohibitions ? [constitution.prohibitions] : []),
    ],
    // No adapter has shipped, so nothing is connected. Saying so is the point.
    connectedProviders: [],
  };
}
