import type { ConnectionTier } from '@mycorp24/types';
import { type Capability, type IntegrationAdapter } from './adapter';

/**
 * Capability resolution — spec §104.
 *
 * When the founder asks for something, we answer one of three ways:
 *   - we can do it, on this tier
 *   - we cannot do it this way, but here is a permitted fallback
 *   - we cannot do it at all, and we say so plainly (§151)
 *
 * We never report success for a capability the adapter does not have.
 */

export type Resolution =
  | { readonly kind: 'SUPPORTED'; readonly tier: ConnectionTier }
  | { readonly kind: 'FALLBACK'; readonly tier: ConnectionTier; readonly requiresConsent: true; readonly note: string }
  | { readonly kind: 'UNAVAILABLE'; readonly note: string };

/** Tiers that need the founder to opt in per session. Spec §79 tier 4-5, §111. */
const CONSENT_TIERS: ReadonlySet<ConnectionTier> = new Set([
  'BROWSER_AUTOMATION',
  'SCREEN_UNDERSTANDING',
]);

export function resolveCapability(
  adapter: IntegrationAdapter,
  capability: Capability,
): Resolution {
  const decl = adapter.getCapabilities().find((d) => d.capability === capability);

  if (!decl) {
    return {
      kind: 'UNAVAILABLE',
      note: `${adapter.provider}는 ${capability} 기능을 선언하지 않았습니다.`,
    };
  }

  if (!decl.supported) {
    return {
      kind: 'UNAVAILABLE',
      note:
        decl.note ??
        `현재 연결 방식에서는 ${capability} 실행 권한이 제공되지 않습니다.`,
    };
  }

  if (CONSENT_TIERS.has(decl.tier)) {
    return {
      kind: 'FALLBACK',
      tier: decl.tier,
      requiresConsent: true,
      note:
        decl.note ??
        '공식 API로는 불가능하여 회장님이 승인한 브라우저 세션이 필요합니다.',
    };
  }

  return { kind: 'SUPPORTED', tier: decl.tier };
}
