import type { FounderIdentity } from '@mycorp24/types';
import { formatAddress } from '@mycorp24/business-logic';
import { extractEntities } from './entities';
import { readMood } from './mood';
import type { Classification, Entities, Intent, IntentClassifier } from './intent';

/**
 * Chat Action Router — spec §77, §103, §143, §144.
 *
 * The router turns an utterance into an intent, entities, a reply in the chief
 * of staff's voice, and a *next step*. It deliberately does not execute
 * anything: execution goes through the tool gateway, where permission, risk and
 * approval policy are enforced (§131, §220.4). A router that could act would be
 * a way around that pipeline.
 *
 * Two rules shape every branch below:
 *   - Never claim a capability the company has not connected (§151).
 *   - Never leave the founder with information and no next move (§156).
 */

export interface PendingApproval {
  readonly id: string;
  readonly title: string;
  readonly amount?: number;
  readonly currency?: string;
}

export interface RouterContext {
  readonly founder: FounderIdentity;
  /** Providers this company has actually connected. */
  readonly connectedProviders: ReadonlySet<string>;
  readonly pendingApprovals: readonly PendingApproval[];
  readonly workingAgentCount?: number;
}

export type GenerativeCard =
  | { readonly kind: 'APPROVAL_LIST'; readonly approvals: readonly PendingApproval[] }
  | { readonly kind: 'METRIC'; readonly metric: string; readonly period: string; readonly ready: boolean }
  | { readonly kind: 'AGENT_STATUS'; readonly working: number }
  | { readonly kind: 'CONNECT'; readonly provider: string; readonly connected: boolean }
  | { readonly kind: 'POLICY_CHANGE'; readonly summary: string }
  | { readonly kind: 'AUTOMATION'; readonly summary: string };

export type NextStep =
  | { readonly kind: 'NONE' }
  | { readonly kind: 'CLARIFY' }
  | { readonly kind: 'START_OAUTH'; readonly provider: string }
  | { readonly kind: 'NAVIGATE'; readonly route: string }
  | { readonly kind: 'DECIDE_APPROVAL'; readonly approvalId: string; readonly decision: 'APPROVE' | 'REJECT' }
  /** Must be handed to the tool gateway. The router never calls an adapter. */
  | { readonly kind: 'GATEWAY_CALL'; readonly provider: string; readonly capability: string }
  | { readonly kind: 'SAVE_APPROVAL_POLICY'; readonly amount: number; readonly currency: string }
  | { readonly kind: 'SAVE_PREFERENCE'; readonly note: string }
  | { readonly kind: 'CREATE_AUTOMATION'; readonly note: string }
  | { readonly kind: 'PLAN_DELEGATED_WORK' };

export interface RouterResult {
  readonly classification: Classification;
  readonly reply: string;
  readonly cards: readonly GenerativeCard[];
  readonly nextStep: NextStep;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

interface Rule {
  readonly intent: Intent;
  readonly re: RegExp;
}

/**
 * Ordered. The first match wins, so the specific sits above the general:
 * "결재 승인해" is a decision, not a request to list approvals.
 */
const RULES: readonly Rule[] = [
  { intent: 'DELEGATE', re: /알아서\s*(처리|해|챙|좀)|take\s+care\s+of\s+it/i },
  { intent: 'DECIDE_APPROVAL', re: /(승인|approve|반려|거절|reject)/i },
  { intent: 'UPDATE_APPROVAL_POLICY', re: /(넘|초과|이상|over).{0,12}(물어|승인|결재|approval)/i },
  { intent: 'CREATE_AUTOMATION', re: /(매일|매주|매달|매월|every\s+(day|week|month))/i },
  { intent: 'CONNECT_INTEGRATION', re: /(연결|연동|추가)\s*해?\s*줘?|connect/i },
  { intent: 'ANALYZE_REVIEWS', re: /리뷰.{0,20}(분석|안\s*좋|정리|어때|살펴)|review.{0,20}analy/i },
  { intent: 'LIST_APPROVALS', re: /결재.{0,10}(있|뭐|목록|대기|남)|approvals?\s*(pending|list)?/i },
  { intent: 'AGENT_STATUS', re: /(직원|임직원|팀).{0,10}(뭐|어떻|상태|하고)|누가\s*일|agent\s*status/i },
  { intent: 'OPEN_ROUTE', re: /(화면|페이지|screen|page).{0,10}(보여|열어|가|open|show)/i },
  { intent: 'OPEN_ROUTE', re: /(업무|일감).{0,8}(보여|뭐|어때|현황|목록|어디)/ },
  { intent: 'SHOW_REPORT', re: /보고서|report/i },
  { intent: 'UPDATE_PREFERENCE', re: /(보고|알림|리포트).{0,20}(시에|시\s*에|아침|저녁|밤|짧게|줄\s*안|간단)/i },
  { intent: 'SHOW_METRIC', re: /(매출|광고비|예약|팔로워|구독자|revenue|spend).{0,20}(어때|얼마|알려|보여|어떻|how)/i },
];

const classifyDeterministic = (text: string): Classification => {
  const entities = extractEntities(text);
  const mood = readMood(text);
  for (const rule of RULES) {
    if (rule.re.test(text)) return { intent: rule.intent, entities, confidence: 1, mood };
  }
  // A bare metric mention with no question word still reads as a metric ask.
  if (entities.metric && /\?|알려|보여|줘/.test(text)) {
    return { intent: 'SHOW_METRIC', entities, confidence: 0.8, mood };
  }
  return { intent: 'UNKNOWN', entities, confidence: 0, mood };
};

// ---------------------------------------------------------------------------
// Replies — the chief of staff's voice (BRAND.md §10)
// ---------------------------------------------------------------------------

const METRIC_KO: Record<string, string> = {
  REVENUE: '매출',
  AD_SPEND: '광고비',
  RESERVATIONS: '예약',
  REVIEWS: '리뷰',
  FOLLOWERS: '팔로워',
};

const PERIOD_KO: Record<string, string> = {
  TODAY: '오늘',
  YESTERDAY: '어제',
  THIS_WEEK: '이번 주',
  THIS_MONTH: '이번 달',
  LAST_MONTH: '지난달',
  RECENT: '최근',
};

const PROVIDER_KO: Record<string, string> = {
  NAVER_PLACE: '네이버 플레이스',
  NAVER_RESERVATION: '네이버 예약',
  NAVER: '네이버',
  INSTAGRAM: 'Instagram',
  YOUTUBE: 'YouTube',
  GMAIL: 'Gmail',
  GOOGLE_CALENDAR: 'Google Calendar',
  SMARTSTORE: '스마트스토어',
  YANOLJA: '야놀자',
  KAKAO: '카카오',
};

const providerName = (p: string): string => PROVIDER_KO[p] ?? p;

const won = (n: number): string => `${n.toLocaleString('ko-KR')}원`;

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function route(utterance: string, ctx: RouterContext): RouterResult {
  return respond(classifyDeterministic(utterance), ctx, utterance);
}

/**
 * Turn a classification into a reply and a next step.
 *
 * Split out from `route` so a model-produced classification goes through
 * exactly the same reply logic — there is one implementation of what the chief
 * of staff says, not two that can drift apart.
 */
// ---------------------------------------------------------------------------
// Questions about actions
// ---------------------------------------------------------------------------

/** Intents that would start something. Only these care about mood. */
const ACTION_INTENTS: ReadonlySet<Intent> = new Set<Intent>([
  'CONNECT_INTEGRATION',
  'DECIDE_APPROVAL',
  'UPDATE_APPROVAL_POLICY',
  'UPDATE_PREFERENCE',
  'CREATE_AUTOMATION',
  'DELEGATE',
]);

interface Explanation {
  readonly reply: string;
  readonly nextStep: NextStep;
  readonly cards?: readonly GenerativeCard[];
}

/**
 * Answer the question, then offer the move — never leave the founder holding
 * information with nothing to do (§156). Returns null when there is nothing
 * useful to say, and the normal branch handles it.
 */
function explain(
  classification: Classification,
  ctx: RouterContext,
  addr: string,
): Explanation | null {
  const e = classification.entities;

  switch (classification.intent) {
    case 'CONNECT_INTEGRATION': {
      const name = e.provider ? providerName(e.provider) : '해당 서비스';
      if (e.provider && ctx.connectedProviders.has(e.provider)) {
        return {
          reply: `${addr}, ${name}는 이미 연결되어 있습니다. 다시 연결하실 필요는 없습니다.`,
          nextStep: { kind: 'NAVIGATE', route: '/connect' },
          cards: [{ kind: 'CONNECT', provider: e.provider, connected: true }],
        };
      }
      return {
        reply:
          `${addr}, 연결은 '연결' 화면에서 ${name} 계정으로 로그인하시면 끝납니다. ` +
          `저희가 비밀번호를 보관하지는 않고, ${name}가 발급한 접근 권한만 암호화해서 보관합니다. ` +
          `지금 연결하시겠으면 "${e.provider ? `${name} 연결해` : '연결해'}"라고 지시해 주십시오.`,
        nextStep: { kind: 'NAVIGATE', route: '/connect' },
        ...(e.provider
          ? { cards: [{ kind: 'CONNECT' as const, provider: e.provider, connected: false }] }
          : {}),
      };
    }

    case 'DECIDE_APPROVAL': {
      const n = ctx.pendingApprovals.length;
      return {
        reply:
          n === 0
            ? `${addr}, 지금 결재 대기 중인 안건은 없습니다.`
            : `${addr}, 결재는 회장님만 하실 수 있습니다. 지금 ${n}건이 기다리고 있고, ` +
              `승인하시려면 "승인해", 반려하시려면 "반려해"라고 지시해 주십시오.`,
        nextStep: n === 0 ? { kind: 'NONE' } : { kind: 'NAVIGATE', route: '/approvals' },
        ...(n > 0
          ? { cards: [{ kind: 'APPROVAL_LIST' as const, approvals: ctx.pendingApprovals }] }
          : {}),
      };
    }

    case 'UPDATE_APPROVAL_POLICY':
      return {
        reply:
          `${addr}, 금액 기준을 정해두시면 그 이상은 저희가 먼저 회장님께 여쭙고, ` +
          `그 아래는 알아서 처리합니다. "광고비 30만원 넘으면 물어봐"처럼 말씀하시면 됩니다.`,
        nextStep: { kind: 'NAVIGATE', route: '/approvals' },
      };

    case 'CREATE_AUTOMATION':
      return {
        reply:
          `${addr}, 반복 업무는 주기와 할 일을 함께 말씀해 주시면 등록됩니다. ` +
          `"매주 월요일 아침에 리뷰 정리해"처럼요.`,
        nextStep: { kind: 'NONE' },
      };

    case 'DELEGATE':
      return {
        reply:
          `${addr}, 위임은 "알아서 처리하고 중요한 것만 보고해"라고 지시하시면 됩니다. ` +
          `그래도 결재가 필요한 일은 반드시 회장님께 올립니다.`,
        nextStep: { kind: 'NONE' },
      };

    default:
      return null;
  }
}

export function respond(
  classification: Classification,
  ctx: RouterContext,
  utterance = '',
): RouterResult {
  const addr = formatAddress(ctx.founder);
  const { entities: e } = classification;

  const done = (
    reply: string,
    nextStep: NextStep = { kind: 'NONE' },
    cards: readonly GenerativeCard[] = [],
  ): RouterResult => ({ classification, reply, cards, nextStep });

  // A question about an action is not the action. "인스타 연결해" is an order;
  // "인스타 연결해야하는데 어떻게하면 되지?" is a founder asking how, and
  // starting the connection there would answer a question by taking a decision
  // away from them — and then report work that has not happened.
  if (classification.mood === 'QUESTION' && ACTION_INTENTS.has(classification.intent)) {
    const answer = explain(classification, ctx, addr);
    if (answer) return done(answer.reply, answer.nextStep, answer.cards ?? []);
  }

  switch (classification.intent) {
    case 'CONNECT_INTEGRATION': {
      if (!e.provider) {
        return done(
          `${addr}, 어떤 서비스를 연결할까요? 네이버, Instagram, Gmail, YouTube 등을 지원합니다.`,
          { kind: 'CLARIFY' },
        );
      }
      const connected = ctx.connectedProviders.has(e.provider);
      const name = providerName(e.provider);
      return connected
        ? done(`${addr}, ${name}는 이미 연결되어 있습니다.`, { kind: 'NONE' }, [
            { kind: 'CONNECT', provider: e.provider, connected: true },
          ])
        : done(
            `네, ${addr}. ${name} 계정을 연결하겠습니다.`,
            { kind: 'START_OAUTH', provider: e.provider },
            [{ kind: 'CONNECT', provider: e.provider, connected: false }],
          );
    }

    case 'LIST_APPROVALS': {
      const n = ctx.pendingApprovals.length;
      if (n === 0) return done(`${addr}, 지금 결재 대기 중인 안건은 없습니다.`);
      return done(
        `${addr}, 결재 대기 ${n}건입니다.`,
        { kind: 'NAVIGATE', route: '/approvals' },
        [{ kind: 'APPROVAL_LIST', approvals: ctx.pendingApprovals }],
      );
    }

    case 'DECIDE_APPROVAL': {
      const decision = e.decision ?? 'APPROVE';
      const index = (e.ordinal ?? 1) - 1;
      const target = ctx.pendingApprovals[index];
      if (!target) {
        return done(
          ctx.pendingApprovals.length === 0
            ? `${addr}, 결재 대기 중인 안건이 없습니다.`
            : `${addr}, ${index + 1}번째 안건이 없습니다. 현재 대기 ${ctx.pendingApprovals.length}건입니다.`,
          { kind: 'CLARIFY' },
          ctx.pendingApprovals.length > 0
            ? [{ kind: 'APPROVAL_LIST', approvals: ctx.pendingApprovals }]
            : [],
        );
      }
      const verb = decision === 'APPROVE' ? '승인' : '반려';
      return done(
        `${addr}, "${target.title}"을 ${verb} 처리하겠습니다. 확인해 주십시오.`,
        { kind: 'DECIDE_APPROVAL', approvalId: target.id, decision },
        [{ kind: 'APPROVAL_LIST', approvals: [target] }],
      );
    }

    case 'SHOW_METRIC': {
      const metric = e.metric ?? 'REVENUE';
      const period = e.period ?? 'TODAY';
      const label = `${PERIOD_KO[period]} ${METRIC_KO[metric]}`;
      const needs = REQUIRED_PROVIDER[metric];
      const ready = !needs || ctx.connectedProviders.has(needs);
      return ready
        ? done(`${addr}, ${label}를 정리해 보고드리겠습니다.`, { kind: 'NONE' }, [
            { kind: 'METRIC', metric, period, ready: true },
          ])
        : done(
            `${addr}, ${label}를 보려면 ${providerName(needs)} 연결이 필요합니다. 아직 연결되어 있지 않습니다.`,
            { kind: 'START_OAUTH', provider: needs },
            [{ kind: 'METRIC', metric, period, ready: false }],
          );
    }

    case 'ANALYZE_REVIEWS': {
      const provider = e.provider ?? 'NAVER_PLACE';
      if (!ctx.connectedProviders.has(provider)) {
        return done(
          `${addr}, 리뷰 분석은 ${providerName(provider)} 연결 후에 가능합니다. 지금은 연결되어 있지 않습니다.`,
          { kind: 'START_OAUTH', provider },
        );
      }
      return done(
        `${addr}, ${providerName(provider)} 리뷰를 분석하겠습니다. 고객경험센터가 처리합니다.`,
        { kind: 'GATEWAY_CALL', provider, capability: 'READ_REVIEWS' },
      );
    }

    case 'AGENT_STATUS': {
      const working = ctx.workingAgentCount ?? 0;
      return done(
        working > 0
          ? `${addr}, 현재 AI 직원 ${working}명이 업무 중입니다.`
          : `${addr}, 지금 진행 중인 업무는 없습니다.`,
        { kind: 'NAVIGATE', route: '/hq' },
        [{ kind: 'AGENT_STATUS', working }],
      );
    }

    case 'SHOW_REPORT':
      return done(`${addr}, 보고서 화면으로 이동하겠습니다.`, {
        kind: 'NAVIGATE',
        route: '/reports',
      });

    case 'OPEN_ROUTE': {
      const route_ = e.route;
      if (!route_) {
        return done(`${addr}, 어느 화면으로 갈까요?`, { kind: 'CLARIFY' });
      }
      return done(`${addr}, 해당 화면으로 이동하겠습니다.`, {
        kind: 'NAVIGATE',
        route: route_,
      });
    }

    case 'UPDATE_APPROVAL_POLICY': {
      if (e.amount === undefined) {
        return done(`${addr}, 기준 금액을 말씀해 주시면 결재 정책에 반영하겠습니다.`, {
          kind: 'CLARIFY',
        });
      }
      // The card summary stands alone, so the reply must not repeat the title.
      const summary = `${won(e.amount)} 초과 지출 → 결재 필요`;
      return done(
        `${addr}, ${won(e.amount)} 초과 지출은 결재를 받도록 설정하겠습니다.`,
        { kind: 'SAVE_APPROVAL_POLICY', amount: e.amount, currency: e.currency ?? 'KRW' },
        [{ kind: 'POLICY_CHANGE', summary }],
      );
    }

    case 'UPDATE_PREFERENCE':
      return done(
        `${addr}, 보고 방식을 말씀하신 대로 조정하겠습니다.`,
        { kind: 'SAVE_PREFERENCE', note: utterance },
        [{ kind: 'POLICY_CHANGE', summary: utterance }],
      );

    case 'CREATE_AUTOMATION':
      return done(
        `${addr}, 정기 업무로 등록하겠습니다.`,
        { kind: 'CREATE_AUTOMATION', note: utterance },
        [{ kind: 'AUTOMATION', summary: utterance }],
      );

    case 'DELEGATE':
      return done(
        `${addr}, 각 본부에 확인하겠습니다. 비용이 발생하거나 외부에 나가는 일은 결재를 요청드리겠습니다.`,
        { kind: 'PLAN_DELEGATED_WORK' },
      );

    case 'UNKNOWN':
    default:
      return done(
        `${addr}, 제가 이해하지 못했습니다. 무엇을 확인해 드릴까요?`,
        { kind: 'CLARIFY' },
      );
  }
}

/** Metrics that cannot be answered without a connected source. */
const REQUIRED_PROVIDER: Record<string, string | undefined> = {
  REVENUE: undefined,
  AD_SPEND: 'INSTAGRAM',
  RESERVATIONS: 'NAVER_RESERVATION',
  REVIEWS: 'NAVER_PLACE',
  FOLLOWERS: 'INSTAGRAM',
};

// The screen a phrase names is decided in one place, `ROUTES` in entities.ts.
// There used to be a second table here, and it was the one that ran: entity
// extraction never set `route` at all, so adding a screen to the table that
// looks authoritative changed nothing. Two tables for one question drift, and
// the one that drifts silently is worse than the one that errors.

/**
 * Route with a model fallback for utterances the rules miss.
 *
 * If the classifier fails or returns low confidence we stay on `UNKNOWN` and
 * ask. A wrong action is worse than an honest question.
 */
export async function routeWithFallback(
  utterance: string,
  ctx: RouterContext,
  classifier?: IntentClassifier,
): Promise<RouterResult> {
  const direct = route(utterance, ctx);
  if (direct.classification.intent !== 'UNKNOWN' || !classifier) return direct;

  try {
    const guess = await classifier.classify(utterance);
    if (guess.intent === 'UNKNOWN' || guess.confidence < 0.6) return direct;
    // Rule-extracted entities are kept; the model may add to them but a
    // deterministic amount or ordinal is never overwritten by a guess.
    const merged: Entities = { ...guess.entities, ...direct.classification.entities };
    return respond({ ...guess, entities: merged }, ctx, utterance);
  } catch {
    // A classifier failure must not become a wrong action.
    return direct;
  }
}
