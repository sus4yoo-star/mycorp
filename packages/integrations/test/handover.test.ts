import { describe, expect, it } from 'vitest';
import { CAPABILITIES } from '../src/adapter';
import { MVP_CATALOG } from '../src/catalog';
import { handoverFor, providersForCapability } from '../src/handover';

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
