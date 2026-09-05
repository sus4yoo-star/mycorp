import { describe, expect, it } from 'vitest';
import type { Division } from '@mycorp24/agent-types';
import { assignWork, deliverableNeedsApproval } from '../src/work';
import { resolvePreset } from '../src/presets';

const LOCAL: readonly Division[] = resolvePreset('LOCAL_BUSINESS').divisions;
const ALL: readonly Division[] = [
  'CUSTOMER_EXPERIENCE', 'MARKETING', 'CREATIVE', 'OPERATIONS', 'FINANCE',
  'DATA', 'LOBBY', 'LEGAL', 'PEOPLE', 'EXECUTIVE_STRATEGY',
];

const assigned = (s: string, d: readonly Division[] = ALL) => {
  const a = assignWork(s, d);
  if (a.kind !== 'ASSIGNED') throw new Error(`expected ASSIGNED for "${s}", got ${a.kind}`);
  return a;
};

describe('assignWork', () => {
  it('sends work to the floor that does it', () => {
    expect(assigned('리뷰 답변 좀 준비해줘').division).toBe('CUSTOMER_EXPERIENCE');
    expect(assigned('인스타 콘텐츠 3개 준비해').division).toBe('MARKETING');
    expect(assigned('이번 달 매출 정리해줘').division).toBe('FINANCE');
    expect(assigned('예약 현황 정리해').division).toBe('OPERATIONS');
  });

  // "광고비" is money before it is marketing: the budget rule has to win, or a
  // spend request is filed as ordinary campaign work and skips the gate.
  it('reads the specific before the general', () => {
    expect(assigned('광고비 좀 조정해줘').action).toBe('CHANGE_AD_BUDGET');
    expect(assigned('광고 새로 하나 돌려줘').action).toBe('START_AD');
  });

  // Guessing produces a task the founder never asked for.
  it('says it cannot tell rather than choosing a floor at random', () => {
    for (const s of ['그거 좀 해줘', '음', '내일 얘기하자', '']) {
      expect(assignWork(s, ALL).kind, s).toBe('UNCLEAR');
    }
  });

  // Filing work into a division the company does not have creates work nobody
  // owns, on a floor the founder cannot open.
  it('refuses to file work on a floor the company does not have', () => {
    const a = assignWork('계약서 검토해줘', LOCAL);
    expect(a.kind).toBe('NO_DIVISION');
    if (a.kind === 'NO_DIVISION') expect(a.wanted).toBe('LEGAL');
  });

  it('names a division the local preset genuinely has', () => {
    expect(assignWork('리뷰 답변 준비해', LOCAL).kind).toBe('ASSIGNED');
  });
});

describe('deliverableNeedsApproval — BRAND.md §11', () => {
  it('stops anything that would leave the company', () => {
    for (const s of ['리뷰 답변 준비해', '인스타 콘텐츠 준비해', '가격표 바꿔줘', '광고비 올려줘']) {
      expect(deliverableNeedsApproval(assignWork(s, ALL)), s).toBe(true);
    }
  });

  // A report changes nothing if the founder never opens it, so it does not
  // queue behind a decision they have not been asked for.
  it('lets work that stays inside the company through', () => {
    for (const s of ['이번 달 매출 정리해줘', '지표 정리해줘', '채용 정리해줘']) {
      expect(deliverableNeedsApproval(assignWork(s, ALL)), s).toBe(false);
    }
  });

  it('never asks for approval on work that was never assigned', () => {
    expect(deliverableNeedsApproval(assignWork('그거 해줘', ALL))).toBe(false);
    expect(deliverableNeedsApproval(assignWork('계약서 검토해줘', LOCAL))).toBe(false);
  });
});

// ---------------------------------------------------------------------------

import { breaksDecision } from '../src/constitution';

describe('breaksDecision — spec §139', () => {
  const decisions = ['우리 브랜드는 절대 가격할인 하지마', '쿠폰 발행 금지'];

  it('names the rule the founder wrote, not just "blocked"', () => {
    expect(breaksDecision('가격할인 이벤트를 제안합니다', decisions))
      .toBe('우리 브랜드는 절대 가격할인 하지마');
  });

  it('catches a draft that reuses only part of the banned phrase', () => {
    expect(breaksDecision('쿠폰 이벤트를 준비했습니다', decisions))
      .toBe('쿠폰 발행 금지');
  });

  it('lets ordinary work through', () => {
    expect(breaksDecision('신메뉴 사진을 새로 찍겠습니다', decisions)).toBeNull();
  });

  it('has nothing to enforce when the company has decided nothing', () => {
    expect(breaksDecision('가격할인 하겠습니다', [])).toBeNull();
  });

  // A sentence that permits is not a ban, and treating it as one would stop
  // the company doing what the founder asked for.
  it('ignores a decision that forbids nothing', () => {
    expect(breaksDecision('가격할인 이벤트', ['여름에는 시즌 메뉴를 늘린다'])).toBeNull();
  });
});
