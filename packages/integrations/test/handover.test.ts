import { describe, expect, it } from 'vitest';
import { CAPABILITIES } from '../src/adapter';
import { MVP_CATALOG } from '../src/catalog';
import { handoverFor, planHandover, providersForCapability } from '../src/handover';

describe('handoverFor', () => {
  it('names a capability that actually exists', () => {
    // A typo here would map an approved action onto a capability no adapter can
    // ever declare, and the founder would be told "not connected" forever.
    for (const action of [
      'REPLY_REVIEW',
      'PUBLISH_POST',
      'SEND_EMAIL',
      'SEND_CUSTOMER_MESSAGE',
      'CHANGE_AD_BUDGET',
      'CANCEL_RESERVATION',
      'CHANGE_PRICE',
      'EDIT_PRODUCT',
    ] as const) {
      const h = handoverFor(action);
      expect(h, action).not.toBeNull();
      expect(CAPABILITIES).toContain(h!.capability);
      expect(h!.what.length).toBeGreaterThan(0);
    }
  });

  it('refuses to pretend a machine can sign a contract or move money', () => {
    // These end with the founder doing it themselves. Mapping them would let a
    // task reach DONE with nothing having happened.
    expect(handoverFor('SIGN_CONTRACT')).toBeNull();
    expect(handoverFor('SPEND_MONEY')).toBeNull();
    expect(handoverFor('ISSUE_COUPON')).toBeNull();
    expect(handoverFor('DELETE_CRITICAL_DATA')).toBeNull();
    expect(handoverFor('BULK_CUSTOMER_DATA')).toBeNull();
  });

  it('does not map an action onto a read-only capability', () => {
    for (const action of ['REPLY_REVIEW', 'PUBLISH_POST', 'SEND_EMAIL'] as const) {
      expect(handoverFor(action)!.capability).not.toMatch(/^READ_/);
    }
  });
});

describe('providersForCapability', () => {
  it('reads the catalog rather than a second list of its own', () => {
    expect(providersForCapability('SEND_MAIL').map((c) => c.id)).toEqual(['gmail']);
    expect(providersForCapability('PUBLISH_SOCIAL').map((c) => c.id)).toEqual(['meta-instagram']);
  });

  it('is empty for a capability nothing in the catalog claims', () => {
    // 네이버 플레이스 is READ_ONLY today, so replying to a review has no
    // provider at all. That emptiness is what the founder gets told.
    expect(providersForCapability('RESPOND_REVIEW')).toEqual([]);
  });

  it('never returns a provider that does not declare the capability', () => {
    for (const capability of CAPABILITIES) {
      for (const entry of providersForCapability(capability)) {
        expect(MVP_CATALOG).toContain(entry);
        expect(entry.capabilities).toContain(capability);
      }
    }
  });
});

describe('planHandover', () => {
  it('never claims an action was carried out just because it was approved', () => {
    // Every ending short of READY carries a reason, and every reason opens by
    // confirming the approval was in fact recorded — the founder's decision is
    // not what failed.
    for (const action of [
      'SIGN_CONTRACT',
      'SPEND_MONEY',
      'REPLY_REVIEW',
      'SEND_EMAIL',
      'PUBLISH_POST',
    ] as const) {
      const plan = planHandover(action, []);
      if (plan.kind === 'READY') throw new Error(`${action} was ready with nothing connected`);
      expect(plan.reason, action).toContain('승인은 기록되었습니다');
      expect(plan.reason.length, action).toBeGreaterThan(20);
    }
  });

  it('says the founder has to do it when no machine can', () => {
    const plan = planHandover('SIGN_CONTRACT', ['gmail', 'meta-instagram']);
    expect(plan.kind).toBe('NO_MACHINE');
    expect(plan.kind === 'NO_MACHINE' && plan.reason).toMatch(/회장님이 직접/);
  });

  it('distinguishes "nothing can do this" from "you have not connected it"', () => {
    // 리뷰 답글: nothing in the catalog claims RESPOND_REVIEW, so connecting
    // more accounts would not help. Saying "연결해 주세요" here would send the
    // founder to do something that changes nothing.
    const review = planHandover('REPLY_REVIEW', ['naver-place', 'gmail']);
    expect(review.kind).toBe('NO_PROVIDER');
    expect(review.kind === 'NO_PROVIDER' && review.reason).not.toMatch(/연결실/);

    // 메일: Gmail can, this company has not connected it.
    const mail = planHandover('SEND_EMAIL', []);
    expect(mail.kind).toBe('NOT_CONNECTED');
    expect(mail.kind === 'NOT_CONNECTED' && mail.reason).toMatch(/Gmail/);
    expect(mail.kind === 'NOT_CONNECTED' && mail.reason).toMatch(/연결실/);
  });

  it('is ready only when the company has the connection in hand', () => {
    const plan = planHandover('SEND_EMAIL', ['gmail']);
    expect(plan.kind).toBe('READY');
    if (plan.kind !== 'READY') return;
    expect(plan.target.provider).toBe('GMAIL');
    expect(plan.capability).toBe('SEND_MAIL');
  });

  it('ignores connections that have nothing to do with the action', () => {
    // Instagram being connected must not make a mail action look possible.
    expect(planHandover('SEND_EMAIL', ['meta-instagram']).kind).toBe('NOT_CONNECTED');
    expect(planHandover('PUBLISH_POST', ['gmail']).kind).toBe('NOT_CONNECTED');
    expect(planHandover('PUBLISH_POST', ['meta-instagram']).kind).toBe('READY');
  });
});
