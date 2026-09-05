import { describe, expect, it } from 'vitest';
import type { AiProvider, StructuredRequest, StructuredResult } from '@mycorp24/ai-gateway';
import { assignWork } from '@mycorp24/business-logic';
import type { Division } from '@mycorp24/agent-types';
import { systemPrompt, userPrompt, writeDraft, type Draft, type DraftContext } from '../src/draft';

const DIVISIONS: readonly Division[] = ['CUSTOMER_EXPERIENCE', 'MARKETING', 'FINANCE'];

const context = (over: Partial<DraftContext> = {}): DraftContext => ({
  address: '회장님',
  companyName: '블루커피',
  decisions: ['우리 브랜드는 절대 가격할인 하지마'],
  connectedProviders: [],
  ...over,
});

const request = (instruction: string, ctx = context()) => {
  const assignment = assignWork(instruction, DIVISIONS);
  if (assignment.kind !== 'ASSIGNED') throw new Error('fixture must be assignable');
  return { instruction, assignment, staffName: '리뷰 응대 담당', context: ctx };
};

/** A provider that returns what we hand it and records what it was asked. */
function fake(payload: unknown) {
  const seen: { system?: string; user?: string } = {};
  const provider: AiProvider = {
    name: 'fake',
    complete: async () => {
      throw new Error('not used');
    },
    stream: async function* () {
      throw new Error('not used');
    },
    completeStructured: async <T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> => {
      seen.system = req.system;
      seen.user = req.messages.map((m) => m.content).join('\n');
      return { value: payload as T, model: 'fake', usage: { inputTokens: 0, outputTokens: 0 } };
    },
  };
  return { provider, seen };
}

const draft = (over: Partial<Draft> = {}): Draft => ({
  title: '리뷰 답변 초안',
  body: '방문해 주셔서 감사합니다.',
  checkFirst: [],
  ...over,
});

describe('the prompt bounds what a draft may claim', () => {
  it('says plainly that nothing is connected, rather than leaving it out', () => {
    expect(systemPrompt(request('리뷰 답변 준비해'))).toContain('하나도 연결되어 있지 않습니다');
  });

  it('lists what is connected when something is', () => {
    const ctx = context({ connectedProviders: ['NAVER_PLACE', 'INSTAGRAM'] });
    expect(systemPrompt(request('리뷰 답변 준비해', ctx))).toContain('NAVER_PLACE, INSTAGRAM');
  });

  it('carries the founder decisions the draft has to live under', () => {
    expect(systemPrompt(request('리뷰 답변 준비해'))).toContain('가격할인 하지마');
  });

  it('says there are none rather than omitting the section', () => {
    const ctx = context({ decisions: [] });
    expect(systemPrompt(request('리뷰 답변 준비해', ctx))).toContain('금지 사항은 없습니다');
  });

  // The founder's numbers are not in this prompt, so any number in a draft was
  // invented — and one invented number costs the true ones their credibility.
  it('forbids invented numbers and pretending the work is done', () => {
    const s = systemPrompt(request('리뷰 답변 준비해'));
    expect(s).toContain('지어내지 마십시오');
    expect(s).toContain('이미 한 것처럼 쓰지 마십시오');
  });

  it('requires an honest refusal instead of a pretend result', () => {
    expect(systemPrompt(request('리뷰 답변 준비해'))).toContain('cannotDo');
  });

  it('tells the writer whether this leaves the company', () => {
    expect(userPrompt(request('리뷰 답변 준비해'))).toContain('REPLY_REVIEW');
    expect(userPrompt(request('이번 달 매출 정리해줘'))).toContain('밖으로 나가지 않습니다');
  });
});

describe('writeDraft', () => {
  it('returns the draft the staff wrote', async () => {
    const { provider } = fake(draft());
    const out = await writeDraft(provider, request('리뷰 답변 준비해'));
    expect(out.draft?.body).toBe('방문해 주셔서 감사합니다.');
    expect(out.rejected).toBeUndefined();
  });

  // A model told not to offer discounts mostly does not, and "mostly" is not a
  // control. The check runs after the fact as well as in the prompt.
  it('stops a draft that breaks a decision the founder made', async () => {
    const { provider } = fake(draft({ body: '가격할인 쿠폰을 드리겠습니다.' }));
    const out = await writeDraft(provider, request('리뷰 답변 준비해'));
    expect(out.draft).toBeNull();
    expect(out.rejected?.rule).toBe('우리 브랜드는 절대 가격할인 하지마');
  });

  // Dropping it silently would look like the company simply did nothing.
  it('keeps the blocked draft so the founder can see what collided', async () => {
    const { provider } = fake(draft({ body: '가격할인 진행하겠습니다.' }));
    const out = await writeDraft(provider, request('리뷰 답변 준비해'));
    expect(out.rejected?.draft.body).toContain('가격할인');
  });

  it('passes an honest refusal through untouched', async () => {
    const { provider } = fake(draft({ body: '', cannotDo: '리뷰를 읽을 수 없습니다.' }));
    const out = await writeDraft(provider, request('리뷰 답변 준비해'));
    expect(out.draft?.cannotDo).toBe('리뷰를 읽을 수 없습니다.');
    expect(out.rejected).toBeUndefined();
  });

  it('has nothing to enforce when the company has decided nothing', async () => {
    const { provider } = fake(draft({ body: '가격할인 이벤트를 제안합니다.' }));
    const out = await writeDraft(provider, request('리뷰 답변 준비해', context({ decisions: [] })));
    expect(out.draft).not.toBeNull();
  });
});
