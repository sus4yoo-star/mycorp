import { z } from 'zod';
import type { AiProvider } from '@mycorp24/ai-gateway';
import { breaksDecision, type Assignment } from '@mycorp24/business-logic';

/**
 * The staff member who writes the draft — spec §112, §151, §164.
 *
 * The company's promise is that AI prepares and the founder decides. Until now
 * nothing prepared anything: an instruction produced a reply about the
 * instruction. This turns one assigned instruction into one draft the founder
 * can read, change their mind about, and approve.
 *
 * What the draft is allowed to be is narrower than what a model would happily
 * write:
 *
 *   - It is a draft. Nothing here sends, posts, pays or changes a price. The
 *     tool gateway does that, after a person decides (§131).
 *   - It invents no facts. The company's real numbers are not in this prompt,
 *     so a draft that quotes one made it up — and a founder who catches an
 *     invented number stops trusting the true ones too.
 *   - It obeys the founder's own decisions, checked after the fact as well as
 *     asked for in the prompt. A model told not to offer discounts mostly does
 *     not, and "mostly" is not a control (§139).
 */

export const DraftSchema = z.object({
  /** What the founder is looking at, in a few words. */
  title: z.string().min(2).max(60),
  /** The draft itself — the thing that would go out, or the report. */
  body: z.string().min(1).max(4000),
  /** What the founder should look at before deciding. Empty when there is nothing. */
  checkFirst: z.array(z.string().max(200)).max(3),
  /** Set when the work cannot be done honestly with what the company has. */
  cannotDo: z.string().max(300).optional(),
});

export type Draft = z.infer<typeof DraftSchema>;

export interface DraftContext {
  /** How the founder is addressed. Never guessed. */
  readonly address: string;
  readonly companyName: string;
  /** The founder's standing decisions — §139. */
  readonly decisions: readonly string[];
  /** Services actually connected. Empty means the company can see nothing. */
  readonly connectedProviders: readonly string[];
}

export interface DraftRequest {
  readonly instruction: string;
  readonly assignment: Extract<Assignment, { kind: 'ASSIGNED' }>;
  readonly staffName: string;
  readonly context: DraftContext;
}

export interface DraftOutcome {
  readonly draft: Draft | null;
  /** The founder's own rule that stopped it, when one did. */
  readonly rejected?: { readonly rule: string; readonly draft: Draft };
}

export function systemPrompt(req: DraftRequest): string {
  const { context: ctx } = req;
  const connected =
    ctx.connectedProviders.length > 0
      ? ctx.connectedProviders.join(', ')
      : '없음 — 외부 서비스가 하나도 연결되어 있지 않습니다';

  return [
    `당신은 ${ctx.companyName}의 ${req.staffName}입니다.`,
    `${ctx.address}의 지시를 받아 결과물 초안을 씁니다.`,
    '',
    '## 지금 회사의 사실',
    `- 연결된 서비스: ${connected}`,
    ctx.decisions.length > 0
      ? `- 회장님이 정하신 것:\n${ctx.decisions.map((d) => `  · ${d}`).join('\n')}`
      : '- 회장님이 따로 정해두신 금지 사항은 없습니다.',
    '',
    '## 반드시 지킬 것',
    '- 당신이 쓰는 것은 **초안**입니다. 보내지도, 게시하지도, 결제하지도 않습니다.',
    '  회장님이 보시고 결재하신 뒤에야 나갑니다. 이미 한 것처럼 쓰지 마십시오.',
    '- 숫자를 지어내지 마십시오. 매출·방문자·전환율 같은 수치는 위 사실에 없습니다.',
    '  지어낸 숫자 하나가 진짜 숫자까지 못 믿게 만듭니다.',
    '- 연결되지 않은 서비스의 데이터를 아는 척하지 마십시오.',
    '- 회장님이 정하신 것을 어기는 내용을 쓰지 마십시오.',
    '- 지시를 정직하게 수행할 수 없으면 `cannotDo`에 이유를 적고 본문은 비우십시오.',
    '  못 하는 일을 한 척하는 것이 이 회사에서 가장 나쁜 실패입니다.',
    '',
    '## 형식',
    '- `body`는 그대로 쓸 수 있는 완성된 초안입니다. 설명이나 머리말을 붙이지 마십시오.',
    '- `checkFirst`는 회장님이 결재 전에 확인하실 것만. 없으면 빈 배열.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function userPrompt(req: DraftRequest): string {
  return [
    '회장님의 지시:',
    req.instruction,
    '',
    `배정된 업무: ${req.assignment.title}`,
    req.assignment.action
      ? `이 초안이 승인되면 이어질 행동: ${req.assignment.action}`
      : '이 초안은 회사 내부 보고입니다. 밖으로 나가지 않습니다.',
  ].join('\n');
}

/**
 * Write one draft.
 *
 * A draft that breaks a company decision is not returned. It is reported in
 * `rejected` with the rule it broke, so the founder sees that their instruction
 * collided with their own earlier one — silently dropping it would look like
 * the company simply did nothing.
 */
export async function writeDraft(
  provider: AiProvider,
  req: DraftRequest,
): Promise<DraftOutcome> {
  const { value } = await provider.completeStructured({
    system: systemPrompt(req),
    messages: [{ role: 'user', content: userPrompt(req) }],
    schema: DraftSchema,
    tier: 'STANDARD',
  });

  if (value.cannotDo) return { draft: value };

  const rule = breaksDecision(`${value.title} ${value.body}`, req.context.decisions);
  if (rule) return { draft: null, rejected: { rule, draft: value } };

  return { draft: value };
}
