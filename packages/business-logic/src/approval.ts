import type { ApprovalMode, ApprovalPolicy, ExternalAction } from '@mycorp24/types';

/**
 * Approval evaluation — spec §112, §113.
 *
 * This is the policy check inside the tool gateway's second line of defence.
 * It decides only whether an action may proceed, is queued for the founder, or
 * is refused outright. It never performs the action.
 */

export interface ApprovalContext {
  readonly action: ExternalAction;
  /** Whole currency units. Absent for actions that cost nothing. */
  readonly amount?: number;
  readonly currency?: string;
}

export interface ApprovalOutcome {
  readonly mode: ApprovalMode;
  readonly reason: string;
}

/**
 * Actions that always require the founder, whatever the company policy says.
 * Spec §113 lists reservation cancellation and price changes as ALWAYS ASK;
 * signing contracts and deleting critical data carry the same weight (§211).
 */
const ALWAYS_ASK: ReadonlySet<ExternalAction> = new Set([
  'CANCEL_RESERVATION',
  'CHANGE_PRICE',
  'SIGN_CONTRACT',
  'DELETE_CRITICAL_DATA',
]);

export function evaluateApproval(
  ctx: ApprovalContext,
  policies: readonly ApprovalPolicy[],
): ApprovalOutcome {
  if (ALWAYS_ASK.has(ctx.action)) {
    return { mode: 'ASK', reason: `${ctx.action} always requires founder approval` };
  }

  const policy = policies.find((p) => p.action === ctx.action);
  if (!policy) {
    // An action with no policy is not implicitly allowed. Spec §151: never
    // pretend to have done something we were not cleared to do.
    return { mode: 'ASK', reason: `no policy configured for ${ctx.action}` };
  }

  if (policy.mode === 'BLOCK') {
    return { mode: 'BLOCK', reason: `${ctx.action} is blocked by company policy` };
  }

  if (policy.mode === 'ASK') {
    return { mode: 'ASK', reason: `company policy asks for approval on ${ctx.action}` };
  }

  // mode === 'AUTO'
  if (policy.autoBelowAmount !== undefined) {
    if (ctx.amount === undefined) {
      return { mode: 'ASK', reason: 'policy has a spend threshold but the action carries no amount' };
    }
    if (policy.currency && ctx.currency && policy.currency !== ctx.currency) {
      return { mode: 'ASK', reason: `currency mismatch: policy ${policy.currency}, action ${ctx.currency}` };
    }
    if (ctx.amount > policy.autoBelowAmount) {
      return {
        mode: 'ASK',
        reason: `amount ${ctx.amount} exceeds auto threshold ${policy.autoBelowAmount}`,
      };
    }
  }

  return { mode: 'AUTO', reason: 'within company auto-execution policy' };
}
