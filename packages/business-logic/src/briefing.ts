import type { FounderIdentity } from '@mycorp24/types';
import { formatAddress } from './address';
import { momentumSentence, type Momentum } from './momentum';

/**
 * Morning and evening briefings — spec §194, §195.
 *
 * Two rules shape every line. §156: never leave the founder holding information
 * with nothing to do about it. §165: two things they must decide beats
 * seventeen things they might.
 *
 * Sentences live in a per-locale table rather than being built by
 * concatenation. LOCALIZATION.md §5 is explicit that each locale's report
 * sentences are written, not translated — a Korean executive brief and an
 * English one are different documents, and word order alone would not fix it.
 */

export interface FounderDecision {
  readonly title: string;
  /** Why it cannot be delegated. §164. */
  readonly whyFounder: string;
  readonly estimateMinutes: number;
  /** What is waiting on it. §163 — delay has a cost worth naming. */
  readonly blocks?: string;
  readonly ageDays?: number;
}

export interface CompetitorChange {
  readonly competitor: string;
  readonly summary: string;
  /** 1..5 */
  readonly significance: number;
}

export interface ProposalSummary {
  readonly title: string;
  readonly type: string;
  /** 1 (highest) .. 5 */
  readonly priority: number;
  readonly expectedEffect?: string;
}

export interface BriefingInput {
  readonly founder: FounderIdentity;
  readonly pendingApprovals: number;
  readonly founderDecisions: readonly FounderDecision[];
  readonly agentTasksCompleted: number;
  readonly activeAgents: number;
  /**
   * Work the company started and could not finish. Reported right after what
   * it did finish, because a founder who is only ever told about successes
   * learns to distrust the whole briefing (§151).
   */
  readonly blockedWork?: number;
  readonly competitorChanges: readonly CompetitorChange[];
  readonly proposals: readonly ProposalSummary[];
  readonly momentum?: Momentum;
}

export interface BriefingLine {
  readonly kind: 'GREETING' | 'DECISION' | 'WORK' | 'COMPETITOR' | 'PROPOSAL' | 'MOMENTUM';
  readonly text: string;
}

/** Only what is worth interrupting someone for. §141, §158 — no push spam. */
const SIGNIFICANT = 4;
const MAX_DECISIONS = 3;
const MAX_PROPOSALS = 2;

interface Phrases {
  readonly morningGreeting: (addr: string) => string;
  readonly eveningGreeting: (addr: string) => string;
  readonly noDecisions: string;
  readonly decisionCount: (n: number) => string;
  readonly decisionItem: (d: FounderDecision) => string;
  readonly approvalsWaiting: (n: number) => string;
  readonly overnightWork: (tasks: number, agents: number) => string;
  readonly blockedWork: (n: number) => string;
  readonly oneCompetitor: (c: CompetitorChange) => string;
  readonly manyCompetitors: (first: CompetitorChange, total: number) => string;
  readonly proposal: (p: ProposalSummary) => string;
  readonly eveningTotals: (completed: number, delayed: number) => string;
  readonly highlight: (s: string) => string;
  readonly problem: (s: string) => string;
  readonly tomorrow: (s: string) => string;
  readonly founderTodo: (n: number) => string;
}

const KO: Phrases = {
  morningGreeting: (a) => `좋은 아침입니다, ${a}.`,
  eveningGreeting: (a) => `${a}, 오늘 업무 보고드리겠습니다.`,
  noDecisions: '오늘 직접 결정하셔야 할 일은 없습니다.',
  decisionCount: (n) => `오늘 직접 결정하셔야 할 일은 ${n}건입니다.`,
  decisionItem: (d) => {
    const stale = d.ageDays !== undefined && d.ageDays >= 3 ? `${d.ageDays}일째 보류 중 — ` : '';
    const blocks = d.blocks ? ` ${d.blocks}이(가) 함께 지연되고 있습니다.` : '';
    return `${stale}${d.title} (약 ${d.estimateMinutes}분).${blocks}`;
  },
  approvalsWaiting: (n) => `결재 대기 ${n}건이 있습니다.`,
  overnightWork: (tasks, agents) =>
    agents > 0
      ? `밤사이 AI 직원 ${agents}명이 ${tasks}건의 업무를 완료했습니다.`
      : `밤사이 ${tasks}건의 업무가 완료되었습니다.`,
  blockedWork: (n) => `${n}건은 진행하지 못하고 멈춰 있습니다. 업무 화면에 이유가 있습니다.`,
  oneCompetitor: (c) => `${c.competitor}에서 변화가 감지되었습니다. ${c.summary}`,
  manyCompetitors: (first, total) =>
    `경쟁사 ${total}곳에서 주목할 변화가 감지되었습니다. ${first.summary} 외 ${total - 1}건.`,
  proposal: (p) =>
    `${p.title} 제안을 준비했습니다.${p.expectedEffect ? ` 예상 효과: ${p.expectedEffect}.` : ''}`,
  eveningTotals: (c, d) =>
    d > 0 ? `${c}건 완료, ${d}건 지연되었습니다.` : `${c}건을 완료했습니다.`,
  highlight: (s) => `가장 좋은 성과: ${s}.`,
  problem: (s) => `문제: ${s}.`,
  tomorrow: (s) => `내일은 ${s}을(를) 우선하겠습니다.`,
  founderTodo: (n) => `회장님께서 직접 하셔야 할 일이 ${n}건 남아 있습니다.`,
};

const EN: Phrases = {
  morningGreeting: (a) => `Good morning, ${a}.`,
  eveningGreeting: (a) => `${a}, here is today's report.`,
  noDecisions: 'Nothing needs your decision today.',
  decisionCount: (n) => `${n} ${n === 1 ? 'item needs' : 'items need'} your decision today.`,
  decisionItem: (d) => {
    const stale = d.ageDays !== undefined && d.ageDays >= 3 ? `Waiting ${d.ageDays} days — ` : '';
    const blocks = d.blocks ? ` It is holding up ${d.blocks}.` : '';
    return `${stale}${d.title} (about ${d.estimateMinutes} min).${blocks}`;
  },
  approvalsWaiting: (n) => `${n} ${n === 1 ? 'approval is' : 'approvals are'} waiting.`,
  overnightWork: (tasks, agents) =>
    agents > 0
      ? `Overnight, ${agents} of your AI staff completed ${tasks} tasks.`
      : `${tasks} tasks were completed overnight.`,
  blockedWork: (n) =>
    `${n} ${n === 1 ? 'task is' : 'tasks are'} stuck. The reason is on the work screen.`,
  oneCompetitor: (c) => `${c.competitor} made a move. ${c.summary}`,
  manyCompetitors: (first, total) =>
    `${total} competitors made notable moves. ${first.summary}, and ${total - 1} more.`,
  proposal: (p) =>
    `We have prepared: ${p.title}.${p.expectedEffect ? ` Expected effect: ${p.expectedEffect}.` : ''}`,
  eveningTotals: (c, d) =>
    d > 0 ? `${c} completed, ${d} delayed.` : `${c} tasks completed.`,
  highlight: (s) => `Best result: ${s}.`,
  problem: (s) => `Problem: ${s}.`,
  tomorrow: (s) => `Tomorrow we will prioritise ${s}.`,
  founderTodo: (n) => `${n} ${n === 1 ? 'item is' : 'items are'} still yours to do.`,
};

const phrasesFor = (locale: string): Phrases =>
  (locale.split('-')[0] ?? 'en').toLowerCase() === 'ko' ? KO : EN;

export function composeMorningBriefing(input: BriefingInput): BriefingLine[] {
  const p = phrasesFor(input.founder.locale);
  const addr = formatAddress(input.founder);
  const lines: BriefingLine[] = [{ kind: 'GREETING', text: p.morningGreeting(addr) }];

  // 1. What only the founder can do — first, always.
  const decisionCount = input.founderDecisions.length + input.pendingApprovals;
  if (decisionCount === 0) {
    lines.push({ kind: 'DECISION', text: p.noDecisions });
  } else {
    lines.push({ kind: 'DECISION', text: p.decisionCount(decisionCount) });
    // Longest-delayed first: §163 says the cost of delay is the story.
    for (const d of [...input.founderDecisions]
      .sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0))
      .slice(0, MAX_DECISIONS)) {
      lines.push({ kind: 'DECISION', text: p.decisionItem(d) });
    }
    if (input.pendingApprovals > 0) {
      lines.push({ kind: 'DECISION', text: p.approvalsWaiting(input.pendingApprovals) });
    }
  }

  // 2. What the company did while they were away.
  if (input.agentTasksCompleted > 0) {
    lines.push({
      kind: 'WORK',
      text: p.overnightWork(input.agentTasksCompleted, input.activeAgents),
    });
  }

  // 2b. And what it could not do. This line is not conditional on there being
  //     good news to soften: stuck work is the founder's to unstick.
  if ((input.blockedWork ?? 0) > 0) {
    lines.push({ kind: 'WORK', text: p.blockedWork(input.blockedWork!) });
  }

  // 3. Competitors — only what actually matters.
  const notable = input.competitorChanges.filter((c) => c.significance >= SIGNIFICANT);
  if (notable.length === 1) {
    lines.push({ kind: 'COMPETITOR', text: p.oneCompetitor(notable[0]!) });
  } else if (notable.length > 1) {
    lines.push({ kind: 'COMPETITOR', text: p.manyCompetitors(notable[0]!, notable.length) });
  }

  // 4. What the company proposes doing about it.
  for (const proposal of [...input.proposals]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_PROPOSALS)) {
    lines.push({ kind: 'PROPOSAL', text: p.proposal(proposal) });
  }

  // 5. Momentum, only when it could actually be measured.
  const m = input.momentum ? momentumSentence(input.momentum) : null;
  if (m) lines.push({ kind: 'MOMENTUM', text: m });

  return lines;
}

export interface EveningInput {
  readonly founder: FounderIdentity;
  readonly completed: number;
  readonly delayed: number;
  readonly highlight?: string;
  readonly problem?: string;
  readonly tomorrowFocus?: string;
  readonly founderTodo: number;
}

/** §195. Shorter than the morning: the founder is done for the day. */
export function composeEveningBriefing(input: EveningInput): BriefingLine[] {
  const p = phrasesFor(input.founder.locale);
  const lines: BriefingLine[] = [
    { kind: 'GREETING', text: p.eveningGreeting(formatAddress(input.founder)) },
    { kind: 'WORK', text: p.eveningTotals(input.completed, input.delayed) },
  ];

  if (input.highlight) lines.push({ kind: 'WORK', text: p.highlight(input.highlight) });
  if (input.problem) lines.push({ kind: 'WORK', text: p.problem(input.problem) });
  if (input.tomorrowFocus) {
    lines.push({ kind: 'PROPOSAL', text: p.tomorrow(input.tomorrowFocus) });
  }
  if (input.founderTodo > 0) {
    lines.push({ kind: 'DECISION', text: p.founderTodo(input.founderTodo) });
  }

  return lines;
}
