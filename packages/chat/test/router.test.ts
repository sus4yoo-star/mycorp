import { describe, expect, it } from 'vitest';
import type { FounderIdentity } from '@mycorp24/types';
import {
  UI_CHAT_PARITY,
  route,
  routeWithFallback,
  type IntentClassifier,
  type RouterContext,
} from '../src/index';

const FOUNDER: FounderIdentity = {
  ownerDisplayName: '유상철',
  preferredTitle: '회장님',
  locale: 'ko-KR',
  addressForm: 'title_only',
};

const ctx = (over: Partial<RouterContext> = {}): RouterContext => ({
  founder: FOUNDER,
  connectedProviders: new Set(['GMAIL']),
  pendingApprovals: [
    { id: 'apr_1', title: 'Meta 광고 증액안', amount: 300_000, currency: 'KRW' },
    { id: 'apr_2', title: '주말 가격 변경안' },
  ],
  workingAgentCount: 31,
  ...over,
});

describe('intent classification — spec §77', () => {
  const cases: [string, string][] = [
    ['인스타 연결해', 'CONNECT_INTEGRATION'],
    ['결재할 거 있어?', 'LIST_APPROVALS'],
    ['첫 번째 거 승인해', 'DECIDE_APPROVAL'],
    ['이번 달 광고비 알려줘', 'SHOW_METRIC'],
    ['네이버 플레이스 리뷰 안 좋은 거 정리해', 'ANALYZE_REVIEWS'],
    ['직원들 뭐하고 있어?', 'AGENT_STATUS'],
    ['광고 현황 화면 보여줘', 'OPEN_ROUTE'],
    ['광고비 30만원 넘으면 무조건 나한테 물어봐', 'UPDATE_APPROVAL_POLICY'],
    ['매일 아침 8시에 매출 확인해서 이상하면 알려줘', 'CREATE_AUTOMATION'],
    ['비서실장, 알아서 처리하고 중요한 것만 나한테 보고해', 'DELEGATE'],
  ];

  for (const [utterance, intent] of cases) {
    it(`"${utterance}" → ${intent}`, () => {
      expect(route(utterance, ctx()).classification.intent).toBe(intent);
    });
  }

  it('says it did not understand rather than guessing', () => {
    const r = route('음 그러니까 저기 그거 있잖아', ctx());
    expect(r.classification.intent).toBe('UNKNOWN');
    expect(r.nextStep).toEqual({ kind: 'CLARIFY' });
  });
});

describe('the router never executes — spec §131, §220.4', () => {
  it('hands external work to the gateway rather than performing it', () => {
    const r = route('리뷰 분석해', ctx({ connectedProviders: new Set(['NAVER_PLACE']) }));
    expect(r.nextStep).toEqual({
      kind: 'GATEWAY_CALL',
      provider: 'NAVER_PLACE',
      capability: 'READ_REVIEWS',
    });
  });

  it('routes an approval decision to the approval flow, not to an adapter', () => {
    const r = route('첫 번째 거 승인해', ctx());
    expect(r.nextStep).toEqual({
      kind: 'DECIDE_APPROVAL',
      approvalId: 'apr_1',
      decision: 'APPROVE',
    });
  });
});

describe('honest reporting — spec §151, §104', () => {
  it('does not claim review analysis when the source is not connected', () => {
    const r = route('네이버 플레이스 리뷰 분석해', ctx({ connectedProviders: new Set() }));
    expect(r.reply).toContain('연결');
    expect(r.nextStep).toEqual({ kind: 'START_OAUTH', provider: 'NAVER_PLACE' });
    expect(r.reply).not.toMatch(/완료|했습니다$/);
  });

  it('says a metric needs a connection instead of inventing a number', () => {
    const r = route('이번 달 광고비 알려줘', ctx({ connectedProviders: new Set() }));
    const card = r.cards.find((c) => c.kind === 'METRIC');
    expect(card).toMatchObject({ ready: false });
    expect(r.reply).toContain('연결이 필요합니다');
  });

  it('reports an already-connected integration truthfully', () => {
    const r = route('Gmail 연결해', ctx());
    expect(r.reply).toContain('이미 연결');
    expect(r.nextStep).toEqual({ kind: 'NONE' });
  });
});

describe('entity extraction', () => {
  it('parses Korean money into whole won', () => {
    const r = route('광고비 30만원 넘으면 물어봐', ctx());
    expect(r.nextStep).toEqual({
      kind: 'SAVE_APPROVAL_POLICY',
      amount: 300_000,
      currency: 'KRW',
    });
  });

  it('parses a comma-separated amount', () => {
    const r = route('50,000원 초과는 결재 받아', ctx());
    expect(r.nextStep).toMatchObject({ amount: 50_000 });
  });

  it('asks for the number rather than assuming one', () => {
    const r = route('금액 넘으면 물어봐', ctx());
    expect(r.nextStep).toEqual({ kind: 'CLARIFY' });
  });

  it('resolves ordinals against the pending queue', () => {
    expect(route('두 번째 반려해', ctx()).nextStep).toEqual({
      kind: 'DECIDE_APPROVAL',
      approvalId: 'apr_2',
      decision: 'REJECT',
    });
  });

  it('refuses an ordinal that is out of range', () => {
    const r = route('세 번째 승인해', ctx());
    expect(r.nextStep).toEqual({ kind: 'CLARIFY' });
    expect(r.reply).toContain('없습니다');
  });
});

describe('the founder is addressed correctly', () => {
  it('uses the configured Korean title', () => {
    expect(route('결재할 거 있어?', ctx()).reply.startsWith('회장님,')).toBe(true);
  });

  it('uses an English form of address for an English locale', () => {
    const r = route(
      '결재할 거 있어?',
      ctx({
        founder: {
          ownerDisplayName: 'Alex',
          preferredTitle: 'Boss',
          locale: 'en-US',
          addressForm: 'title_only',
        },
      }),
    );
    expect(r.reply.startsWith('Boss,')).toBe(true);
  });
});

describe('UI ↔ chat parity — spec §143', () => {
  for (const entry of UI_CHAT_PARITY) {
    for (const utterance of entry.utterances) {
      it(`"${utterance}" serves ${entry.uiAction}`, () => {
        const r = route(utterance, ctx({ connectedProviders: new Set() }));
        expect(r.classification.intent).not.toBe('UNKNOWN');
        expect(r.nextStep.kind).not.toBe('CLARIFY');
      });
    }
  }
});

describe('model fallback', () => {
  const classifier = (intent: string, confidence = 0.9): IntentClassifier => ({
    classify: async () =>
      ({ intent, entities: { provider: 'YOUTUBE' }, confidence }) as never,
  });

  it('is only consulted when the rules found nothing', async () => {
    let called = 0;
    const spy: IntentClassifier = {
      classify: async () => {
        called += 1;
        return { intent: 'UNKNOWN', entities: {}, confidence: 0 };
      },
    };
    await routeWithFallback('결재할 거 있어?', ctx(), spy);
    expect(called).toBe(0);
  });

  it('uses a confident model classification', async () => {
    const r = await routeWithFallback('유튜브 좀 붙여봐', ctx(), classifier('CONNECT_INTEGRATION'));
    expect(r.classification.intent).toBe('CONNECT_INTEGRATION');
    expect(r.nextStep).toEqual({ kind: 'START_OAUTH', provider: 'YOUTUBE' });
  });

  it('ignores a low-confidence guess', async () => {
    const r = await routeWithFallback('음 그거', ctx(), classifier('DECIDE_APPROVAL', 0.3));
    expect(r.classification.intent).toBe('UNKNOWN');
  });

  it('degrades to a clarifying question when the classifier throws', async () => {
    const broken: IntentClassifier = {
      classify: async () => {
        throw new Error('model unavailable');
      },
    };
    const r = await routeWithFallback('음 그거', ctx(), broken);
    expect(r.nextStep).toEqual({ kind: 'CLARIFY' });
  });
});
