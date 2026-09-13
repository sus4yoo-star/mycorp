import { describe, expect, it } from 'vitest';
import { CAPABILITIES } from '../src/adapter';
import { MVP_CATALOG, connectionIdsFor, providerForCatalogId } from '../src/catalog';
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
  it('answers what we have built, not what the catalog is for', () => {
    // Gmail's catalog entry lists SEND_MAIL and the adapter declares it
    // unsupported — the OAuth flow does not even request the scope. Answering
    // from the catalog alone told founders that connecting Gmail would let the
    // company send mail. It would not.
    expect(providersForCapability('SEND_MAIL')).toEqual([]);
    expect(providersForCapability('PUBLISH_SOCIAL')).toEqual([]);
    expect(providersForCapability('WRITE_ADS_BUDGET')).toEqual([]);

    // What the adapters do declare supported still comes back.
    expect(providersForCapability('READ_MAIL').map((c) => c.id)).toEqual(['gmail']);
    expect(providersForCapability('READ_SOCIAL').map((c) => c.id)).toEqual(['meta-instagram']);
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

  it('never sends the founder to connect something that would not help', () => {
    // This is the rule the whole plan exists for. Today no shipped adapter can
    // perform any outbound action, so every one of these must say "아직 그럴 수
    // 있는 연결이 없습니다" — never "연결실에서 연결해 주시면 바로 실행합니다",
    // which costs the founder an OAuth grant and a second approval to learn the
    // answer was always no.
    for (const connected of [[], ['gmail'], ['meta-instagram'], ['gmail', 'meta-instagram', 'naver-place']]) {
      for (const action of ['SEND_EMAIL', 'PUBLISH_POST', 'REPLY_REVIEW', 'CHANGE_AD_BUDGET'] as const) {
        const plan = planHandover(action, connected);
        expect(plan.kind, `${action} with ${connected.join()}`).toBe('NO_PROVIDER');
        expect(plan.kind === 'NO_PROVIDER' && plan.reason).not.toMatch(/연결실/);
      }
    }
  });

  // The day a send-capable Gmail adapter ships, these are the branches that
  // take over. Nothing reaches them through a real action today, and a branch
  // nothing exercises is a branch that has never been shown to work.
  const WHEN_SENDING_SHIPS = {
    GMAIL: [{ capability: 'SEND_MAIL', supported: true, tier: 'OFFICIAL_API' }],
  } as const;

  it('still tells the founder to connect when connecting would genuinely help', () => {
    const plan = planHandover('SEND_EMAIL', [], WHEN_SENDING_SHIPS);
    expect(plan.kind).toBe('NOT_CONNECTED');
    expect(plan.kind === 'NOT_CONNECTED' && plan.reason).toMatch(/Gmail/);
    expect(plan.kind === 'NOT_CONNECTED' && plan.reason).toMatch(/연결실/);
  });

  it('is ready only when the company has a connection that can actually do it', () => {
    const ready = planHandover('SEND_EMAIL', ['gmail'], WHEN_SENDING_SHIPS);
    expect(ready.kind).toBe('READY');
    if (ready.kind === 'READY') expect(ready.target.provider).toBe('GMAIL');

    // An unrelated connection never makes an action look possible.
    expect(planHandover('SEND_EMAIL', ['meta-instagram'], WHEN_SENDING_SHIPS).kind)
      .toBe('NOT_CONNECTED');
  });
});

describe('the two spellings a connection can have', () => {
  it('recognises Meta under the id the OAuth callback actually stores', () => {
    // The callback writes provider.id lowercased with dashes — 'instagram' —
    // while the catalog entry is 'meta-instagram'. Comparing one against the
    // other missed every Meta connection and reported "연결되어 있지 않습니다"
    // to a founder who had connected it.
    expect(providerForCatalogId('instagram')).toBe('INSTAGRAM');
    expect(providerForCatalogId('meta-instagram')).toBe('INSTAGRAM');
    expect(providerForCatalogId('gmail')).toBe('GMAIL');
    expect(providerForCatalogId('nothing-we-know')).toBeNull();
  });

  it('is a round trip for every entry in the catalog', () => {
    // Anything that stops round-tripping is a provider whose connections
    // silently stop being found.
    for (const entry of MVP_CATALOG) {
      for (const id of connectionIdsFor(entry)) {
        expect(providerForCatalogId(id), id).toBe(entry.provider);
      }
      expect(connectionIdsFor(entry), entry.id).toContain(entry.id);
    }
  });

  it('plans against a connection stored under either spelling', () => {
    const shipped = {
      INSTAGRAM: [{ capability: 'PUBLISH_SOCIAL', supported: true, tier: 'OFFICIAL_API' }],
    } as const;
    for (const stored of ['instagram', 'meta-instagram']) {
      expect(planHandover('PUBLISH_POST', [stored], shipped).kind, stored).toBe('READY');
    }
  });
});
