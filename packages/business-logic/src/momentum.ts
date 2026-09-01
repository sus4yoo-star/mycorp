/**
 * Founder Momentum — spec §166.
 *
 * An executive productivity indicator, not a game score. No streaks, no
 * badges, no nagging: the founder is running a company, not levelling up.
 *
 * The rule that shapes the whole design: **a component with no data is
 * excluded, never scored zero.** A company with no ads has not "failed at
 * advertising", and telling a founder their momentum dropped because we lack a
 * number is worse than telling them nothing.
 */

export type MomentumComponent =
  | 'TASK_THROUGHPUT'
  | 'APPROVAL_LATENCY'
  | 'GOAL_PROGRESS'
  | 'CUSTOMER_RESPONSE'
  | 'CONTENT_CADENCE'
  | 'REVENUE_ACTIVITY'
  | 'DATA_REVIEW';

export interface MomentumInput {
  /** Agent tasks closed vs. opened over the window. */
  readonly tasksCompleted?: number;
  readonly tasksOpened?: number;
  /** Hours a pending approval has been waiting, oldest first. */
  readonly approvalAgeHours?: readonly number[];
  /** 0..1 */
  readonly goalProgress?: number;
  /** Customer messages answered vs. received. */
  readonly customerAnswered?: number;
  readonly customerReceived?: number;
  /** Content published in the window, and the cadence the company intends. */
  readonly contentPublished?: number;
  readonly contentTarget?: number;
  /** Revenue-generating activity happened at all. */
  readonly revenueEvents?: number;
  /** Days since the founder last looked at a report. */
  readonly daysSinceDataReview?: number;
}

export interface ComponentScore {
  readonly component: MomentumComponent;
  /** 0..100 */
  readonly score: number;
  readonly note: string;
}

export interface Momentum {
  /** 0..100, or null when nothing could be measured. */
  readonly score: number | null;
  readonly label: '정체' | '느림' | '보통' | '활발' | '고속';
  readonly components: readonly ComponentScore[];
  /** Components we deliberately did not score, and why. */
  readonly missing: readonly MomentumComponent[];
}

const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

const ratio = (done: number, total: number): number =>
  total <= 0 ? 100 : clamp((done / total) * 100);

/**
 * Approval latency, scored on the oldest waiting item rather than the average.
 * One decision sitting for a week is the problem; nine quick ones do not
 * cancel it out (§163).
 */
function approvalScore(ages: readonly number[]): number {
  if (ages.length === 0) return 100;
  const oldest = Math.max(...ages);
  if (oldest <= 4) return 100;
  if (oldest >= 168) return 0; // a week
  return clamp(100 - ((oldest - 4) / (168 - 4)) * 100);
}

function label(score: number): Momentum['label'] {
  if (score >= 85) return '고속';
  if (score >= 70) return '활발';
  if (score >= 50) return '보통';
  if (score >= 30) return '느림';
  return '정체';
}

export function computeMomentum(input: MomentumInput): Momentum {
  const components: ComponentScore[] = [];
  const missing: MomentumComponent[] = [];

  const add = (
    component: MomentumComponent,
    measurable: boolean,
    score: () => number,
    note: (s: number) => string,
  ) => {
    if (!measurable) {
      missing.push(component);
      return;
    }
    const s = score();
    components.push({ component, score: s, note: note(s) });
  };

  add(
    'TASK_THROUGHPUT',
    input.tasksOpened !== undefined || input.tasksCompleted !== undefined,
    () => ratio(input.tasksCompleted ?? 0, input.tasksOpened ?? 0),
    (s) => `업무 처리율 ${s}%`,
  );

  add(
    'APPROVAL_LATENCY',
    input.approvalAgeHours !== undefined,
    () => approvalScore(input.approvalAgeHours ?? []),
    (s) =>
      (input.approvalAgeHours?.length ?? 0) === 0
        ? '대기 중인 결재 없음'
        : `가장 오래 기다린 결재 ${Math.round(Math.max(...(input.approvalAgeHours ?? [0])))}시간` +
          (s < 50 ? ' — 지연' : ''),
  );

  add(
    'GOAL_PROGRESS',
    input.goalProgress !== undefined,
    () => clamp((input.goalProgress ?? 0) * 100),
    (s) => `목표 진척 ${s}%`,
  );

  add(
    'CUSTOMER_RESPONSE',
    input.customerReceived !== undefined,
    () => ratio(input.customerAnswered ?? 0, input.customerReceived ?? 0),
    (s) => `고객 응답률 ${s}%`,
  );

  add(
    'CONTENT_CADENCE',
    input.contentTarget !== undefined && input.contentTarget > 0,
    () => ratio(input.contentPublished ?? 0, input.contentTarget ?? 0),
    (s) => `콘텐츠 목표 대비 ${s}%`,
  );

  add(
    'REVENUE_ACTIVITY',
    input.revenueEvents !== undefined,
    () => ((input.revenueEvents ?? 0) > 0 ? 100 : 0),
    (s) => (s > 0 ? '매출 활동 있음' : '매출 활동 없음'),
  );

  add(
    'DATA_REVIEW',
    input.daysSinceDataReview !== undefined,
    () => clamp(100 - (input.daysSinceDataReview ?? 0) * 14),
    (s) => `최근 확인 ${input.daysSinceDataReview}일 전${s < 50 ? ' — 오래됨' : ''}`,
  );

  if (components.length === 0) {
    return { score: null, label: '보통', components: [], missing };
  }

  const score = clamp(
    components.reduce((sum, c) => sum + c.score, 0) / components.length,
  );
  return { score, label: label(score), components, missing };
}

/**
 * The one line the chief of staff would say about momentum.
 * Silent when there is nothing measured — saying "82" from no data is a lie.
 */
export function momentumSentence(m: Momentum): string | null {
  if (m.score === null) return null;
  const worst = [...m.components].sort((a, b) => a.score - b.score)[0];
  if (worst && worst.score < 50) {
    return `모멘텀 ${m.score}점 · ${m.label}. 가장 처진 항목은 "${worst.note}"입니다.`;
  }
  return `모멘텀 ${m.score}점 · ${m.label}.`;
}
