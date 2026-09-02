import { describe, expect, it } from 'vitest';
import type { ApprovalPolicy } from '@mycorp24/types';
import { evaluateApproval } from '../src/approval';

const policies: ApprovalPolicy[] = [
  { action: 'REPLY_REVIEW', mode: 'AUTO' },
  { action: 'PUBLISH_POST', mode: 'ASK' },
  { action: 'CHANGE_AD_BUDGET', mode: 'AUTO', autoBelowAmount: 50_000, currency: 'KRW' },
  { action: 'BULK_CUSTOMER_DATA', mode: 'BLOCK' },
];

describe('evaluateApproval — spec §112, §113', () => {
  it('auto-approves what the company allows', () => {
    expect(evaluateApproval({ action: 'REPLY_REVIEW' }, policies).mode).toBe('AUTO');
  });

  it('asks when the company asks', () => {
    expect(evaluateApproval({ action: 'PUBLISH_POST' }, policies).mode).toBe('ASK');
  });

  it('blocks what the company blocks', () => {
    expect(evaluateApproval({ action: 'BULK_CUSTOMER_DATA' }, policies).mode).toBe('BLOCK');
  });

  it('honours the spend threshold in both directions', () => {
    const under = { action: 'CHANGE_AD_BUDGET', amount: 49_000, currency: 'KRW' } as const;
    const over = { action: 'CHANGE_AD_BUDGET', amount: 51_000, currency: 'KRW' } as const;
    expect(evaluateApproval(under, policies).mode).toBe('AUTO');
    expect(evaluateApproval(over, policies).mode).toBe('ASK');
  });

  it('asks rather than assumes when the amount or currency is missing or mismatched', () => {
    expect(evaluateApproval({ action: 'CHANGE_AD_BUDGET' }, policies).mode).toBe('ASK');
    expect(
      evaluateApproval({ action: 'CHANGE_AD_BUDGET', amount: 10, currency: 'USD' }, policies).mode,
    ).toBe('ASK');
  });

  it('always asks for price changes and reservation cancellations, even on AUTO', () => {
    const permissive: ApprovalPolicy[] = [
      { action: 'CHANGE_PRICE', mode: 'AUTO' },
      { action: 'CANCEL_RESERVATION', mode: 'AUTO' },
      { action: 'SIGN_CONTRACT', mode: 'AUTO' },
      { action: 'DELETE_CRITICAL_DATA', mode: 'AUTO' },
    ];
    for (const p of permissive) {
      expect(evaluateApproval({ action: p.action }, permissive).mode).toBe('ASK');
    }
  });

  it('does not treat an unconfigured action as permitted', () => {
    expect(evaluateApproval({ action: 'SEND_EMAIL' }, policies).mode).toBe('ASK');
  });
});
