import 'server-only';

import { asAgentId, asCompanyId, withI } from '@mycorp24/types';
import { planHandover } from '@mycorp24/integrations';
import {
  appendAuditEvent,
  listConnections,
  settleTask,
  taskForApproval,
  type ApprovalRow,
  type Db,
  type TaskRow,
} from '@mycorp24/db';
import { runThroughGateway } from './gateway';

/**
 * What happens after 승인 — spec §112, §151.
 *
 * "AI가 준비하고, 회장님이 결재하고, 회사가 실행한다." The third clause had no
 * code behind it: a decided approval left its task sitting in 결재 대기 for
 * good. From the founder's chair that is indistinguishable from the company
 * dropping the work.
 *
 * So a decision now closes the task, and closes it truthfully. Rejected work is
 * cancelled. Approved work is attempted, and only reaches DONE if something
 * actually left the building; when nothing can, the task ends BLOCKED naming
 * exactly what is missing, which is a sentence the founder can act on.
 */

export type Settlement =
  | { readonly kind: 'NO_TASK' }
  | { readonly kind: 'CANCELLED'; readonly task: TaskRow }
  | { readonly kind: 'EXECUTED'; readonly task: TaskRow; readonly what: string }
  | { readonly kind: 'CANNOT_EXECUTE'; readonly task: TaskRow; readonly reason: string };

export async function settleApproval(
  db: Db,
  input: {
    readonly companyId: string;
    readonly userId: string;
    readonly approval: ApprovalRow;
    readonly decision: 'APPROVE' | 'REJECT';
    readonly note?: string;
  },
): Promise<Settlement> {
  const task = await taskForApproval(db, input.companyId, input.approval.id);
  // An approval raised straight from the gateway has no task behind it. The
  // decision still stands; there is simply nothing to close.
  if (!task) return { kind: 'NO_TASK' };

  if (input.decision === 'REJECT') {
    const detail = input.note
      ? `회장님이 반려하셨습니다: ${input.note}`
      : '회장님이 반려하셨습니다.';
    return { kind: 'CANCELLED', task: await close(db, input, task, 'CANCELLED', detail) };
  }

  const reason = await attempt(db, input);
  if (reason.kind === 'DONE') {
    return {
      kind: 'EXECUTED',
      task: await close(db, input, task, 'DONE', reason.detail),
      what: reason.what,
    };
  }

  return {
    kind: 'CANNOT_EXECUTE',
    task: await close(db, input, task, 'BLOCKED', reason.detail),
    reason: reason.detail,
  };
}

type Attempt =
  | { readonly kind: 'DONE'; readonly detail: string; readonly what: string }
  | { readonly kind: 'CANNOT'; readonly detail: string };

/**
 * Try to hand the approved action to a machine.
 *
 * Every path out of here is honest about how far it got. Nothing reports
 * success on the strength of the founder's approval alone.
 */
async function attempt(
  db: Db,
  input: { readonly companyId: string; readonly userId: string; readonly approval: ApprovalRow },
): Promise<Attempt> {
  const connections = await listConnections(db, input.companyId);
  const plan = planHandover(
    input.approval.action as never,
    connections.map((row) => row.catalog_id),
  );

  // Everything short of READY already carries the sentence the founder reads.
  // The rules behind it are tested in packages/integrations; this file only
  // supplies what the company has actually connected.
  if (plan.kind !== 'READY') return { kind: 'CANNOT', detail: plan.reason };

  // The gateway is still the only way out of the building. The approval id is
  // passed through so the ASK policy is satisfied by this decision rather than
  // raising a second approval for the same work (§112).
  //
  // CONFIDENTIAL clearance, higher than a chat-initiated call gets: these
  // actions touch customers by design, and the founder authorised this exact
  // one. It is scoped to the single capability the plan named.
  const outcome = await runThroughGateway(
    {
      companyId: asCompanyId(input.companyId),
      agent: asAgentId(input.userId),
      provider: plan.target.provider,
      capability: plan.capability as never,
      action: input.approval.action as never,
      approvalId: input.approval.id,
      payload: { body: input.approval.summary },
    },
    { allowedCapabilities: new Set([plan.capability]), clearance: 'CONFIDENTIAL' },
  );

  if (outcome.kind === 'EXECUTED') {
    return {
      kind: 'DONE',
      what: plan.what,
      detail: `${plan.target.displayName}에 ${plan.what} 완료했습니다.`,
    };
  }

  return {
    kind: 'CANNOT',
    // Every remaining outcome carries a reason — denied, needing consent, or
    // failed at the adapter. The founder gets that sentence, not "실패".
    detail: `승인은 기록되었습니다. 다만 ${plan.target.displayName}에서 ${withI(plan.what)} 되지 않았습니다: ${outcome.reason}`,
  };
}

async function close(
  db: Db,
  input: { readonly companyId: string; readonly userId: string },
  task: TaskRow,
  status: 'DONE' | 'CANCELLED' | 'BLOCKED',
  detail: string,
): Promise<TaskRow> {
  const settled = await settleTask(db, {
    taskId: task.id,
    companyId: input.companyId,
    status,
    detail,
  });

  await appendAuditEvent(db, {
    companyId: input.companyId,
    actor: input.userId,
    action: `WORK:SETTLE:${status}`,
    outcome: status === 'DONE' ? 'EXECUTED' : 'DENIED',
    reason: detail,
  });

  return settled;
}
