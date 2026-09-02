import { describe, expect, it } from 'vitest';
import { readMood } from '../src/mood';

describe('readMood', () => {
  // The pair that shipped broken: both contain 연결, one is an order and one is
  // a question, and the product answered them identically.
  it('separates the order from the question about the same verb', () => {
    expect(readMood('인스타 연결해')).toBe('INSTRUCTION');
    expect(readMood('인스타 계정 연결해야하는데 어떻게하면 되지?')).toBe('QUESTION');
  });

  it('reads plain instructions as instructions', () => {
    for (const s of [
      '인스타 연결해',
      '광고비 30만원 넘으면 물어봐',
      '알아서 처리하고 중요한 것만 보고해',
      '결재 승인해',
      '매주 월요일에 리뷰 정리해',
    ]) {
      expect(readMood(s), s).toBe('INSTRUCTION');
    }
  });

  it('reads questions as questions', () => {
    for (const s of [
      '어떻게 연결하지?',
      '연결 방법이 뭐야',
      '이거 승인해도 될까',
      '지금 결재할 게 있나요',
      '광고비는 언제 반영되나요',
      'how do I connect instagram',
    ]) {
      expect(readMood(s), s).toBe('QUESTION');
    }
  });

  // A founder typing fast adds question marks to orders. Punctuation alone is
  // not enough to refuse to act.
  it('does not turn an order into a question because of a stray mark', () => {
    expect(readMood('인스타 연결해?')).toBe('INSTRUCTION');
    expect(readMood('결재 승인해?')).toBe('INSTRUCTION');
  });

  it('treats an empty utterance as an instruction so nothing changes for it', () => {
    expect(readMood('   ')).toBe('INSTRUCTION');
  });
});

// ---------------------------------------------------------------------------

import { route } from '../src/router';
import type { RouterContext } from '../src/router';

const ctx = (connected: string[] = []): RouterContext => ({
  founder: {
    ownerDisplayName: '유상철',
    preferredTitle: '회장님',
    locale: 'ko-KR',
    addressForm: 'title_only',
  },
  connectedProviders: new Set(connected),
  pendingApprovals: [],
  workingAgentCount: 0,
});

describe('a question about an action does not start the action', () => {
  it('answers "how do I connect" instead of claiming to connect', () => {
    const asked = route('인스타 계정 연결해야하는데 어떻게하면 되지?', ctx());
    expect(asked.nextStep.kind).not.toBe('START_OAUTH');
    expect(asked.reply).not.toContain('연결하겠습니다');
  });

  it('still connects when told to', () => {
    const told = route('인스타 연결해', ctx());
    expect(told.nextStep).toEqual({ kind: 'START_OAUTH', provider: 'INSTAGRAM' });
  });

  // The two utterances that shipped with the same answer must not share one.
  it('gives the order and the question different replies', () => {
    const told = route('인스타 연결해', ctx());
    const asked = route('인스타 계정 연결해야하는데 어떻게하면 되지?', ctx());
    expect(asked.reply).not.toBe(told.reply);
  });

  it('never decides an approval because the founder wondered aloud', () => {
    const asked = route('이거 승인해도 될까?', ctx());
    expect(asked.nextStep.kind).not.toBe('DECIDE_APPROVAL');
  });

  it('says so when the thing asked about is already connected', () => {
    const asked = route('인스타 어떻게 연결하지?', ctx(['INSTAGRAM']));
    expect(asked.reply).toContain('이미 연결');
    expect(asked.nextStep.kind).not.toBe('START_OAUTH');
  });
});
