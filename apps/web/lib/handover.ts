import 'server-only';

import { asAgentId, asCompanyId } from '@mycorp24/types';
import { handoverFor, providersForCapability } from '@mycorp24/integrations';
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
  const action = input.approval.action;
  const handover = handoverFor(action as never);

  if (!handover) {
    return {
      kind: 'CANNOT',
      detail:
        '승인은 기록되었습니다. 다만 이 건은 회사가 대신 실행할 수 있는 종류가 아니어서, 실행은 회장님이 직접 하셔야 합니다.',
    };
  }

  const candidates = providersForCapability(handover.capability);
  if (candidates.length === 0) {
    return {
      kind: 'CANNOT',
      detail: `승인은 기록되었습니다. 다만 ${handover.what}을(를) 대신 할 수 있는 연결이 아직 없습니다. 초안 그대로 회장님이 올려주셔야 합니다.`,
    };
  }

  const connections = await listConnections(db, input.companyId);
  const connected = candidates.filter((c) =>
    connections.some((row) => row.catalog_id === c.id),
  );

  if (connected.length === 0) {
    const names = candidates.map((c) => c.displayName).join(', ');
    return {
      kind: 'CANNOT',
      detail: `승인은 기록되었습니다. 다만 ${handover.what}을(를) 하려면 ${names} 연결이 필요합니다. 연결실에서 연결해 주시면 바로 실행합니다.`,
    };
  }

  // The gateway is still the only way out of the building. The approval id is
  // passed through so the ASK policy is satisfied by this decision rather than
  // raising a second approval for the same work (§112).
  const target = connected[0]!;
  const outcome = await runThroughGateway(
    {
      companyId: asCompanyId(input.companyId),
      agent: asAgentId(input.userId),
      provider: target.provider,
      capability: handover.capability as never,
      action: action as never,
      approvalId: input.approval.id,
      payload: { body: input.approval.summary },
    },
    { allowedCapabilities: new Set([handover.capability]), clearance: 'CONFIDENTIAL' },
  );

  if (outcome.kind === 'EXECUTED') {
    return {
      kind: 'DONE',
      what: handover.what,
      detail: `${target.displayName}에 ${handover.what} 완료했습니다.`,
    };
  }

  return {
    kind: 'CANNOT',
    // Every remaining outcome carries a reason — denied, needing consent, or
    // failed at the adapter. The founder gets that sentence, not "실패".
    detail: `승인은 기록되었습니다. 다만 ${target.displayName}에서 ${handover.what}이(가) 되지 않았습니다: ${outcome.reason}`,
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
