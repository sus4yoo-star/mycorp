import { withEul, type ExternalAction } from '@mycorp24/types';
import type { Capability, CapabilityDeclaration } from './adapter';
import { GMAIL_CAPABILITIES } from './adapters/gmail';
import { INSTAGRAM_CAPABILITIES } from './adapters/instagram';
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

/**
 * What a shipped adapter actually declares it can do, by provider.
 *
 * Read from the adapters themselves rather than restated here, so this cannot
 * drift from the code that would do the work.
 */
export type ShippedCapabilities = Readonly<Record<string, readonly CapabilityDeclaration[]>>;

const SHIPPED: ShippedCapabilities = {
  GMAIL: GMAIL_CAPABILITIES,
  INSTAGRAM: INSTAGRAM_CAPABILITIES,
};

/**
 * Providers that could carry this capability out **today**.
 *
 * The catalog's capability list is what a provider is for; it is not what we
 * have built. Gmail's entry lists SEND_MAIL and the adapter declares it
 * unsupported — the OAuth flow does not even ask for the scope.
 *
 * Filtering on the catalog alone produced a promise no connection could keep:
 * a founder who approved a 메일 발송 was told "연결실에서 연결해 주시면 바로
 * 실행합니다", granted Google access, gave the instruction again, approved
 * again, and landed back on 중단 — having spent a real action to learn that
 * the answer was always no. An honest "아직 그럴 수 있는 연결이 없습니다" costs
 * them nothing.
 */
export const providersForCapability = (
  capability: Capability,
  shipped: ShippedCapabilities = SHIPPED,
): readonly CatalogEntry[] =>
  MVP_CATALOG.filter(
    (e) =>
      e.capabilities.includes(capability) &&
      (shipped[e.provider] ?? []).some((d) => d.capability === capability && d.supported),
  );

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

/**
 * `shipped` is injectable for one reason: today no adapter declares any
 * outbound capability supported, so NOT_CONNECTED and READY cannot be reached
 * through any real action. They are the branches that come alive the day a
 * write adapter ships, and a branch nothing exercises is a branch that has
 * never been shown to work.
 */
export function planHandover(
  action: ExternalAction,
  connectedCatalogIds: readonly string[],
  shipped: ShippedCapabilities = SHIPPED,
): HandoverPlan {
  const handover = handoverFor(action);
  if (!handover) {
    return {
      kind: 'NO_MACHINE',
      reason: `${RECORDED} 다만 이 건은 회사가 대신 실행할 수 있는 종류가 아니어서, 실행은 회장님이 직접 하셔야 합니다.`,
    };
  }

  const candidates = providersForCapability(handover.capability, shipped);
  if (candidates.length === 0) {
    return {
      kind: 'NO_PROVIDER',
      what: handover.what,
      reason: `${RECORDED} 다만 ${withEul(handover.what)} 대신 할 수 있는 연결이 아직 없습니다. 초안 그대로 회장님이 올려주셔야 합니다.`,
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
        `${RECORDED} 다만 ${withEul(handover.what)} 하려면 ` +
        `${candidates.map((c) => c.displayName).join(', ')} 연결이 필요합니다. ` +
        '연결실에서 연결해 주시면 바로 실행합니다.',
    };
  }

  return { kind: 'READY', what: handover.what, capability: handover.capability, target };
}
