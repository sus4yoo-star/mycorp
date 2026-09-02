import { formatAddress } from '@mycorp24/business-logic';
import type { GenerativeCard, NextStep, RouterContext, RouterResult } from './router';

/**
 * The chief of staff's voice — spec §77, §151; BRAND.md §10.
 *
 * The router decides; this composes what is said about the decision. Keeping
 * them apart is the whole point:
 *
 *   - The decision stays deterministic and tested. A model cannot talk the
 *     product into connecting an account, approving a spend, or changing a
 *     policy, because by the time these prompts are built `nextStep` is already
 *     fixed and nothing here can alter it.
 *   - The words stop being a lookup table. A fixed string cannot tell an order
 *     from a question, cannot answer a follow-up, and reads as a machine
 *     pretending to be a colleague — which is what the founder noticed.
 *
 * Everything the reply may assert is listed below as a fact. Anything absent is
 * something we do not know, and the instruction is to say so rather than fill
 * the gap (§151).
 */

export interface ReplyBrief {
  readonly address: string;
  readonly utterance: string;
  readonly intent: string;
  readonly mood: 'QUESTION' | 'INSTRUCTION';
  /** The reply the deterministic router would have given. Ground truth, not a draft to copy. */
  readonly fallbackReply: string;
  readonly nextStep: NextStep;
  readonly cards: readonly GenerativeCard[];
  readonly connectedProviders: readonly string[];
  readonly pendingApprovalCount: number;
  readonly workingAgentCount: number;
}

export function buildBrief(
  utterance: string,
  result: RouterResult,
  ctx: RouterContext,
): ReplyBrief {
  return {
    address: formatAddress(ctx.founder),
    utterance,
    intent: result.classification.intent,
    mood: result.classification.mood ?? 'INSTRUCTION',
    fallbackReply: result.reply,
    nextStep: result.nextStep,
    cards: result.cards,
    connectedProviders: [...ctx.connectedProviders].sort(),
    pendingApprovalCount: ctx.pendingApprovals.length,
    workingAgentCount: ctx.workingAgentCount ?? 0,
  };
}

/** What actually happens next, in words, so the reply cannot overstate it. */
function describeNextStep(step: NextStep): string {
  switch (step.kind) {
    case 'NONE':
      return '아무 일도 일어나지 않습니다. 이 답변이 전부입니다.';
    case 'CLARIFY':
      return '아직 아무 일도 시작하지 않았습니다. 회장님께 되물어야 합니다.';
    case 'START_OAUTH':
      return `${step.provider} 연결 화면이 열립니다. 아직 연결된 것은 아닙니다.`;
    case 'NAVIGATE':
      return `${step.route} 화면으로 이동합니다. 그 밖에는 아무 일도 일어나지 않습니다.`;
    case 'DECIDE_APPROVAL':
      return `결재 ${step.approvalId} 건이 ${step.decision === 'APPROVE' ? '승인' : '반려'}으로 기록됩니다.`;
    case 'GATEWAY_CALL':
      return `${step.provider}의 ${step.capability} 요청이 검사를 거칩니다. 아직 실행되지 않았습니다.`;
    case 'SAVE_APPROVAL_POLICY':
      return `${step.amount} ${step.currency} 기준의 결재 정책이 저장됩니다.`;
    case 'SAVE_PREFERENCE':
      return '회사 기억에 기록됩니다.';
    case 'CREATE_AUTOMATION':
      return '반복 업무로 등록됩니다.';
    case 'PLAN_DELEGATED_WORK':
      return '위임받은 일의 계획을 세웁니다. 실행 전에 결재가 필요한 것은 회장님께 올립니다.';
  }
}

export function systemPrompt(brief: ReplyBrief): string {
  const connected =
    brief.connectedProviders.length > 0
      ? brief.connectedProviders.join(', ')
      : '없음 — 지금 연결된 외부 서비스가 하나도 없습니다';

  return [
    '당신은 MYCORP24의 비서실장입니다. 회장님 한 분에게만 보고합니다.',
    '',
    '## 말투',
    `- 호칭은 "${brief.address}"입니다. 한 답변에서 두 번 이상 쓰지 마십시오.`,
    '- 짧게. 두세 문장이면 충분합니다. 인사말과 사과로 시작하지 마십시오.',
    '- 회장님은 결정하시는 분입니다. 설명을 늘어놓지 말고 결정에 필요한 것만 드리십시오.',
    '- 이모지, 느낌표, "물론이죠" 같은 추임새를 쓰지 마십시오.',
    '',
    '## 지금 회사의 사실',
    `- 연결된 서비스: ${connected}`,
    `- 결재 대기: ${brief.pendingApprovalCount}건`,
    `- 업무 중인 AI 직원: ${brief.workingAgentCount}명`,
    '',
    '## 이 발화에 대해 이미 정해진 것',
    `- 의도: ${brief.intent}`,
    `- 회장님은 ${brief.mood === 'QUESTION' ? '질문하셨습니다' : '지시하셨습니다'}.`,
    `- 다음에 실제로 일어나는 일: ${describeNextStep(brief.nextStep)}`,
    '',
    '## 반드시 지킬 것',
    '- 위 "다음에 실제로 일어나는 일"을 넘어서는 것을 했다고 말하지 마십시오.',
    '  아직 하지 않은 일을 완료했다고 말하는 것이 이 제품에서 가장 나쁜 실패입니다.',
    '- 위 "사실"에 없는 숫자, 금액, 지표, 계정, 날짜를 지어내지 마십시오.',
    '- 연결되지 않은 서비스의 데이터를 아는 척하지 마십시오. 연결되어 있지 않다고 말하십시오.',
    '- 모르면 모른다고 하십시오. 그것이 틀린 답보다 낫습니다.',
    '- 회장님이 질문하셨다면 답을 드리고, 지시가 필요하면 어떻게 말씀하시면 되는지 알려주십시오.',
    '  질문에 답하는 대신 일을 시작해 버리는 것은 회장님의 결정을 빼앗는 것입니다.',
    '- 답변만 쓰십시오. 머리말, 따옴표, 제목을 붙이지 마십시오.',
  ].join('\n');
}

export function userPrompt(brief: ReplyBrief): string {
  return [
    '회장님의 말씀:',
    brief.utterance,
    '',
    '규칙 기반 초안(사실 확인용. 문장을 그대로 베끼지 말고, 여기 없는 사실을 추가하지도 마십시오):',
    brief.fallbackReply,
  ].join('\n');
}
