import type { ExternalAction } from '@mycorp24/types';
import type { Division } from '@mycorp24/agent-types';

/**
 * Where an instruction goes — spec §112, §164, §215.
 *
 * The founder says what they want; this decides which floor it lands on and
 * what, if anything, it would end in. Deterministic on purpose: a model
 * choosing where work is filed would put it somewhere the founder does not
 * look, and no amount of fluent prose makes that recoverable.
 *
 * Three answers, and the last two matter as much as the first.
 *
 * `ASSIGNED` — we know the floor.
 *
 * `NO_DIVISION` — we know the floor and this company does not have it. Filing
 * it anyway would create work nobody owns; the honest reply names the division
 * the company would have to open (§215).
 *
 * `UNCLEAR` — we cannot tell. The chief of staff asks. Guessing produces a task
 * the founder never asked for, which is the failure this product must not have
 * (§151).
 */

export type Assignment =
  | {
      readonly kind: 'ASSIGNED';
      readonly division: Division;
      readonly title: string;
      /** What this work would end in, when it ends outside the company. */
      readonly action?: ExternalAction;
    }
  | { readonly kind: 'NO_DIVISION'; readonly wanted: Division }
  | { readonly kind: 'UNCLEAR' };

interface Rule {
  readonly re: RegExp;
  readonly division: Division;
  readonly title: string;
  readonly action?: ExternalAction;
}

/**
 * Ordered; the first match wins, so the specific sits above the general.
 * "광고비" is money before it is marketing, and "리뷰 답변" is a reply before it
 * is a review report.
 */
const RULES: readonly Rule[] = [
  { re: /리뷰|후기|평점/, division: 'CUSTOMER_EXPERIENCE', title: '리뷰 응대', action: 'REPLY_REVIEW' },
  { re: /광고\s*(비|예산)|예산\s*(조정|증액|감액)/, division: 'MARKETING', title: '광고 예산 검토', action: 'CHANGE_AD_BUDGET' },
  { re: /광고|캠페인/, division: 'MARKETING', title: '광고 운영', action: 'START_AD' },
  { re: /인스타|instagram|게시물|포스팅|콘텐츠|피드/i, division: 'MARKETING', title: '콘텐츠 준비', action: 'PUBLISH_POST' },
  { re: /쿠폰|프로모션|할인\s*행사/, division: 'MARKETING', title: '프로모션 준비', action: 'ISSUE_COUPON' },
  { re: /영상|사진|디자인|썸네일|제작/, division: 'CREATIVE', title: '제작', action: 'PUBLISH_POST' },
  { re: /가격|단가|요금표/, division: 'OPERATIONS', title: '가격 검토', action: 'CHANGE_PRICE' },
  { re: /예약/, division: 'OPERATIONS', title: '예약 운영', action: 'CHANGE_RESERVATION' },
  { re: /재고|영업시간|매장\s*정보/, division: 'OPERATIONS', title: '매장 운영' },
  { re: /매출|정산|비용|지출|세금/, division: 'FINANCE', title: '재무 정리' },
  { re: /지표|분석|통계|데이터/, division: 'DATA', title: '지표 정리' },
  { re: /메일|이메일|문의|고객\s*연락/, division: 'LOBBY', title: '문의 응대', action: 'SEND_CUSTOMER_MESSAGE' },
  { re: /계약|약관|법무/, division: 'LEGAL', title: '계약 검토', action: 'SIGN_CONTRACT' },
  { re: /채용|인사/, division: 'PEOPLE', title: '인사 업무' },
  { re: /경쟁사|시장\s*조사/, division: 'EXECUTIVE_STRATEGY', title: '시장 조사' },
];

export function assignWork(
  instruction: string,
  divisionsPresent: readonly Division[],
): Assignment {
  const text = instruction.trim();
  if (text.length === 0) return { kind: 'UNCLEAR' };

  const rule = RULES.find((r) => r.re.test(text));
  if (!rule) return { kind: 'UNCLEAR' };

  if (!divisionsPresent.includes(rule.division)) {
    return { kind: 'NO_DIVISION', wanted: rule.division };
  }

  return {
    kind: 'ASSIGNED',
    division: rule.division,
    title: rule.title,
    ...(rule.action ? { action: rule.action } : {}),
  };
}

/**
 * Does the finished draft need the founder before it leaves the company?
 *
 * Work with no outward action is a report: it can be read whenever the founder
 * likes and nothing happens if they never do. Work that ends in a post, a
 * reply, a price or a payment stops and waits, every time — the gate is the
 * product's promise, not a setting (BRAND.md §11).
 */
export const deliverableNeedsApproval = (assignment: Assignment): boolean =>
  assignment.kind === 'ASSIGNED' && assignment.action !== undefined;
