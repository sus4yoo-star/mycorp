import { describe, expect, it } from 'vitest';
import { buildBrief, systemPrompt, userPrompt } from '../src/compose';
import { route, type RouterContext } from '../src/router';

const ctx = (over: Partial<RouterContext> = {}): RouterContext => ({
  founder: {
    ownerDisplayName: '유상철',
    preferredTitle: '회장님',
    locale: 'ko-KR',
    addressForm: 'title_only',
  },
  connectedProviders: new Set<string>(),
  pendingApprovals: [],
  workingAgentCount: 0,
  ...over,
});

const briefFor = (utterance: string, c = ctx()) =>
  buildBrief(utterance, route(utterance, c), c);

describe('the prompt carries the facts the reply may use', () => {
  it('states plainly when nothing is connected, rather than omitting it', () => {
    const s = systemPrompt(briefFor('인스타 연결해'));
    expect(s).toContain('연결된 외부 서비스가 하나도 없습니다');
  });

  it('lists what is connected when something is', () => {
    const s = systemPrompt(briefFor('인스타 연결해', ctx({
      connectedProviders: new Set(['GMAIL', 'INSTAGRAM']),
    })));
    expect(s).toContain('GMAIL, INSTAGRAM');
  });

  it('carries the real pending count', () => {
    const s = systemPrompt(briefFor('결재할 거 있어?', ctx({
      pendingApprovals: [{ id: 'a', title: '광고 증액' }, { id: 'b', title: '가격 변경' }],
    })));
    expect(s).toContain('결재 대기: 2건');
  });
});

describe('the prompt bounds what the reply may claim', () => {
  // The model writes the words; it must not be able to promise more than the
  // router decided to do.
  it('says a connection has not happened yet when the step only opens the screen', () => {
    const s = systemPrompt(briefFor('인스타 연결해'));
    expect(s).toContain('아직 연결된 것은 아닙니다');
  });

  it('says nothing happens when the step is NONE', () => {
    const s = systemPrompt(briefFor('직원들 뭐하고 있어?'));
    expect(s).toContain('아무 일도 일어나지 않습니다');
  });

  it('forbids inventing numbers and claiming completed work', () => {
    const s = systemPrompt(briefFor('이번 달 광고비 알려줘'));
    expect(s).toContain('지어내지 마십시오');
    expect(s).toContain('완료했다고 말하는 것이');
  });

  it('tells the model which mood it is answering', () => {
    expect(systemPrompt(briefFor('인스타 연결해'))).toContain('지시하셨습니다');
    expect(systemPrompt(briefFor('인스타 어떻게 연결하지?'))).toContain('질문하셨습니다');
  });
});

describe('the deterministic reply travels as ground truth', () => {
  it('is offered for its facts, not its sentences', () => {
    const brief = briefFor('인스타 연결해');
    const u = userPrompt(brief);
    expect(u).toContain(brief.fallbackReply);
    expect(u).toContain('그대로 베끼지 말고');
  });

  it('includes what the founder actually said', () => {
    expect(userPrompt(briefFor('인스타 연결해'))).toContain('인스타 연결해');
  });
});
