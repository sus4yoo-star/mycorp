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
