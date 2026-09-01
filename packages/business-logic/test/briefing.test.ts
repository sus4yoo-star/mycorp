import { describe, expect, it } from 'vitest';
import type { FounderIdentity } from '@mycorp24/types';
import { composeEveningBriefing, composeMorningBriefing } from '../src/briefing';
import { computeMomentum } from '../src/momentum';

const FOUNDER: FounderIdentity = {
  ownerDisplayName: '유상철',
  preferredTitle: '회장님',
  locale: 'ko-KR',
  addressForm: 'title_only',
};

const base = {
  founder: FOUNDER,
  pendingApprovals: 0,
  founderDecisions: [],
  agentTasksCompleted: 0,
  activeAgents: 0,
  competitorChanges: [],
  proposals: [],
};

const text = (lines: { text: string }[]) => lines.map((l) => l.text).join('\n');

describe('composeMorningBriefing — spec §194', () => {
  it('greets in the founder locale and leads with decisions', () => {
    const lines = composeMorningBriefing({
      ...base,
      pendingApprovals: 2,
      founderDecisions: [
        { title: '신규 서비스 가격 결정', whyFounder: '경영 판단', estimateMinutes: 10 },
      ],
    });
    expect(lines[0]!.text).toBe('좋은 아침입니다, 회장님.');
    expect(lines[1]!.kind).toBe('DECISION');
    expect(lines[1]!.text).toContain('3건');
  });

  it('says there is nothing to decide rather than staying silent', () => {
    expect(text(composeMorningBriefing(base))).toContain('결정하셔야 할 일은 없습니다');
  });

  it('caps the decision list — two things beat seventeen (§165)', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      title: `결정 ${i}`,
      whyFounder: '판단',
      estimateMinutes: 10,
      ageDays: i,
    }));
    const lines = composeMorningBriefing({ ...base, founderDecisions: many });
    const listed = lines.filter((l) => l.kind === 'DECISION' && l.text.includes('약 10분'));
    expect(listed).toHaveLength(3);
    // The count is still honest even though the list is short.
    expect(lines.find((l) => l.text.includes('9건'))).toBeTruthy();
  });

  it('puts the longest-delayed decision first and names what it blocks (§163)', () => {
    const lines = composeMorningBriefing({
      ...base,
      founderDecisions: [
        { title: '새 결정', whyFounder: '판단', estimateMinutes: 5, ageDays: 0 },
        {
          title: '가격 결정',
          whyFounder: '판단',
          estimateMinutes: 10,
          ageDays: 5,
          blocks: '홈페이지 개편과 광고 캠페인',
        },
      ],
    });
    const first = lines.filter((l) => l.text.includes('약'))[0]!;
    expect(first.text).toContain('가격 결정');
    expect(first.text).toContain('5일째 보류');
    expect(first.text).toContain('홈페이지 개편과 광고 캠페인');
  });

  it('reports overnight work when there was any, and stays silent otherwise', () => {
    expect(
      text(composeMorningBriefing({ ...base, agentTasksCompleted: 67, activeAgents: 31 })),
    ).toContain('AI 직원 31명이 67건');
    expect(text(composeMorningBriefing(base))).not.toContain('밤사이');
  });

  it('mentions only competitor changes that matter — no push spam (§141, §158)', () => {
    const lines = composeMorningBriefing({
      ...base,
      competitorChanges: [
        { competitor: '경쟁사 A', summary: '가격 15% 인하', significance: 5 },
        { competitor: '경쟁사 B', summary: '인스타 게시물 1건', significance: 2 },
      ],
    });
    const t = text(lines);
    expect(t).toContain('가격 15% 인하');
    expect(t).not.toContain('경쟁사 B');
  });

  it('never leaves the founder with information and no next move (§156)', () => {
    const lines = composeMorningBriefing({
      ...base,
      competitorChanges: [{ competitor: '경쟁사 A', summary: '가격 15% 인하', significance: 5 }],
      proposals: [
        { title: '대응 프로모션 3안', type: 'COMPETITOR_MOVE', priority: 1, expectedEffect: '이탈 방어' },
      ],
    });
    expect(lines.some((l) => l.kind === 'PROPOSAL')).toBe(true);
    expect(text(lines)).toContain('예상 효과');
  });

  it('offers the highest-priority proposals first and caps them', () => {
    const lines = composeMorningBriefing({
      ...base,
      proposals: [
        { title: '낮은 우선순위', type: 'GROWTH', priority: 5 },
        { title: '가장 급한 건', type: 'RISK', priority: 1 },
        { title: '두 번째', type: 'GROWTH', priority: 2 },
      ],
    });
    const proposals = lines.filter((l) => l.kind === 'PROPOSAL');
    expect(proposals).toHaveLength(2);
    expect(proposals[0]!.text).toContain('가장 급한 건');
    expect(text(lines)).not.toContain('낮은 우선순위');
  });

  it('omits momentum entirely when it could not be measured', () => {
    const withNoData = composeMorningBriefing({ ...base, momentum: computeMomentum({}) });
    expect(withNoData.some((l) => l.kind === 'MOMENTUM')).toBe(false);

    const measured = composeMorningBriefing({
      ...base,
      momentum: computeMomentum({ goalProgress: 0.8 }),
    });
    expect(measured.some((l) => l.kind === 'MOMENTUM')).toBe(true);
  });

  it('addresses an English-locale founder correctly', () => {
    const lines = composeMorningBriefing({
      ...base,
      founder: {
        ownerDisplayName: 'Alex',
        preferredTitle: 'Boss',
        locale: 'en-US',
        addressForm: 'title_only',
      },
    });
    expect(lines[0]!.text).toBe('Good morning, Boss.');
  });
});

describe('composeEveningBriefing — spec §195', () => {
  it('reports completion and delay, and what is still on the founder', () => {
    const t = text(
      composeEveningBriefing({
        founder: FOUNDER,
        completed: 83,
        delayed: 2,
        highlight: '재방문 캠페인',
        problem: '네이버 플레이스 노출 감소',
        tomorrowFocus: '노출 감소 원인 분석',
        founderTodo: 1,
      }),
    );
    expect(t).toContain('83건 완료, 2건 지연');
    expect(t).toContain('재방문 캠페인');
    expect(t).toContain('내일은 노출 감소 원인 분석');
    expect(t).toContain('1건 남아');
  });

  it('does not manufacture a delay count when there is none', () => {
    const t = text(
      composeEveningBriefing({ founder: FOUNDER, completed: 12, delayed: 0, founderTodo: 0 }),
    );
    expect(t).toContain('12건을 완료했습니다');
    expect(t).not.toContain('지연');
    expect(t).not.toContain('남아 있습니다');
  });
});

describe('locale phrasing — LOCALIZATION.md §5', () => {
  const EN_FOUNDER: FounderIdentity = {
    ownerDisplayName: 'Alex',
    preferredTitle: 'Boss',
    locale: 'en-US',
    addressForm: 'title_only',
  };

  it('writes the whole brief in the founder locale, not a translated greeting', () => {
    const t = text(
      composeMorningBriefing({
        ...base,
        founder: EN_FOUNDER,
        pendingApprovals: 1,
        agentTasksCompleted: 12,
        activeAgents: 4,
        proposals: [{ title: 'Weekend promotion', type: 'GROWTH', priority: 1 }],
      }),
    );
    expect(t).toContain('Good morning, Boss.');
    expect(t).toContain('needs your decision today');
    expect(t).toContain('completed 12 tasks');
    expect(t).toContain('We have prepared: Weekend promotion.');
    // No Korean leaks into an English brief.
    expect(t).not.toMatch(/[가-힣]/);
  });

  it('keeps the Korean brief free of English sentences', () => {
    const t = text(
      composeMorningBriefing({
        ...base,
        pendingApprovals: 1,
        agentTasksCompleted: 12,
        activeAgents: 4,
      }),
    );
    expect(t).not.toMatch(/Good morning|approvals are|tasks completed/);
  });

  it('uses singular and plural correctly in English', () => {
    const one = text(
      composeMorningBriefing({ ...base, founder: EN_FOUNDER, pendingApprovals: 1 }),
    );
    const many = text(
      composeMorningBriefing({ ...base, founder: EN_FOUNDER, pendingApprovals: 3 }),
    );
    expect(one).toContain('1 item needs');
    expect(many).toContain('3 items need');
  });

  it('writes the evening report in the founder locale too', () => {
    const t = text(
      composeEveningBriefing({
        founder: EN_FOUNDER,
        completed: 5,
        delayed: 1,
        founderTodo: 2,
      }),
    );
    expect(t).toContain("here is today's report");
    expect(t).toContain('5 completed, 1 delayed.');
    expect(t).toContain('2 items are still yours to do.');
  });
});
