import type { ExternalAction } from '@mycorp24/types';
import type { Capability } from './adapter';
import { MVP_CATALOG, type CatalogEntry } from './catalog';

/**
 * What an approved decision would actually hand to a machine — spec §104, §151.
 *
 * A founder pressing 승인 has decided that the thing *should* happen. Whether it
 * *can* happen is a separate question, and the two were being conflated: an
 * approved action used to leave the task waiting forever, which reads as the
 * company quietly losing the work.
 *
 * This table answers only the first half of "can we": which capability the
 * action needs. Whether any connection actually provides it is decided later,
 * against the company's real connections — mapping an action here is never a
 * claim that it works.
 */

export interface Handover {
  /** The capability an adapter must declare to carry the action out. */
  readonly capability: Capability;
  /** What would happen, in the words shown to the founder. */
  readonly what: string;
}

const HANDOVERS: Partial<Record<ExternalAction, Handover>> = {
  REPLY_REVIEW: { capability: 'RESPOND_REVIEW', what: '리뷰 답글 등록' },
  PUBLISH_POST: { capability: 'PUBLISH_SOCIAL', what: '게시물 발행' },
  SEND_EMAIL: { capability: 'SEND_MAIL', what: '메일 발송' },
  SEND_CUSTOMER_MESSAGE: { capability: 'SEND_MAIL', what: '고객 안내 발송' },
  CHANGE_AD_BUDGET: { capability: 'WRITE_ADS_BUDGET', what: '광고 예산 변경' },
  CANCEL_RESERVATION: { capability: 'WRITE_RESERVATION_CANCEL', what: '예약 취소' },
  CHANGE_PRICE: { capability: 'WRITE_PRODUCTS', what: '판매가 변경' },
  EDIT_PRODUCT: { capability: 'WRITE_PRODUCTS', what: '상품 정보 수정' },
};

/**
 * Null means no machine can be asked to do this — a signed contract, money
 * moving, a coupon issued. The founder does it themselves, and we say so
 * rather than marking the task done on their behalf.
 */
export const handoverFor = (action: ExternalAction): Handover | null =>
  HANDOVERS[action] ?? null;

/** Catalog entries that claim the capability. Claiming is not connecting. */
export const providersForCapability = (
  capability: Capability,
): readonly CatalogEntry[] => MVP_CATALOG.filter((e) => e.capabilities.includes(capability));

/**
 * How far an approved action can actually get, given what the company has
 * connected.
 *
 * This is the part worth testing and the part that was living in a server-only
 * file where nothing could reach it. The rule it encodes is the product's most
 * important one: an approval is a decision, not an outcome, and every ending
 * short of execution has to say what stopped it (§151).
 */
export type HandoverPlan =
  /** No machine can be asked to do this. The founder does it themselves. */
  | { readonly kind: 'NO_MACHINE'; readonly reason: string }
  /** We would know how, but nothing in the catalog can do it yet. */
  | { readonly kind: 'NO_PROVIDER'; readonly what: string; readonly reason: string }
  /** Something could do it; this company has not connected it. */
  | {
      readonly kind: 'NOT_CONNECTED';
      readonly what: string;
      readonly candidates: readonly CatalogEntry[];
      readonly reason: string;
    }
  /** Hand it to the gateway. Still not a claim that it will succeed. */
  | {
      readonly kind: 'READY';
      readonly what: string;
      readonly capability: Capability;
      readonly target: CatalogEntry;
    };

/** Every refusal starts the same way, because the approval really was recorded. */
const RECORDED = '승인은 기록되었습니다.';

export function planHandover(
  action: ExternalAction,
  connectedCatalogIds: readonly string[],
): HandoverPlan {
  const handover = handoverFor(action);
  if (!handover) {
    return {
      kind: 'NO_MACHINE',
      reason: `${RECORDED} 다만 이 건은 회사가 대신 실행할 수 있는 종류가 아니어서, 실행은 회장님이 직접 하셔야 합니다.`,
    };
  }

  const candidates = providersForCapability(handover.capability);
  if (candidates.length === 0) {
    return {
      kind: 'NO_PROVIDER',
      what: handover.what,
      reason: `${RECORDED} 다만 ${handover.what}을(를) 대신 할 수 있는 연결이 아직 없습니다. 초안 그대로 회장님이 올려주셔야 합니다.`,
    };
  }

  const connected = new Set(connectedCatalogIds);
  const target = candidates.find((c) => connected.has(c.id));

  if (!target) {
    return {
      kind: 'NOT_CONNECTED',
      what: handover.what,
      candidates,
      reason:
        `${RECORDED} 다만 ${handover.what}을(를) 하려면 ` +
        `${candidates.map((c) => c.displayName).join(', ')} 연결이 필요합니다. ` +
        '연결실에서 연결해 주시면 바로 실행합니다.',
    };
  }

  return { kind: 'READY', what: handover.what, capability: handover.capability, target };
}
