import type { Division, ExecutiveRole } from '@mycorp24/agent-types';

/**
 * Org presets — spec §214.
 *
 * A preset is a seed, not a cage: §215 lets the company propose new divisions
 * later. Two rules hold for every preset (spec §220.9):
 *   - the chief of staff, internal audit and enterprise risk offices always exist
 *   - investor relations is never created automatically
 */

export type IndustryPreset = 'LOCAL_BUSINESS' | 'SOLO_SAAS' | 'CREATOR';

export interface OrgPreset {
  readonly key: IndustryPreset;
  readonly ko: string;
  readonly divisions: readonly Division[];
  readonly executives: readonly ExecutiveRole[];
  /** Capabilities covered by an on-demand specialist instead of a division. */
  readonly specialists: readonly string[];
}

export const ORG_PRESETS: Record<IndustryPreset, OrgPreset> = {
  LOCAL_BUSINESS: {
    key: 'LOCAL_BUSINESS',
    ko: '동네 사업장 (음식점·미용·숙박 등)',
    divisions: [
      'MARKETING',
      'OPERATIONS',
      'CUSTOMER_EXPERIENCE',
      'DATA',
      'FINANCE',
    ],
    executives: ['CMO', 'COO', 'CFO', 'CDO'],
    specialists: ['LEGAL', 'SECURITY'],
  },
  SOLO_SAAS: {
    key: 'SOLO_SAAS',
    ko: '1인 SaaS 창업자',
    divisions: [
      'EXECUTIVE_STRATEGY',
      'PRODUCT',
      'TECHNOLOGY',
      'MARKETING',
      'SALES',
      'DATA',
      'FINANCE',
      'LEGAL',
      'INFOSEC',
      'CUSTOMER_EXPERIENCE',
    ],
    executives: ['CSO', 'CPO', 'CTO', 'CMO', 'CRO', 'CDO', 'CFO', 'CLO', 'CISO'],
    specialists: [],
  },
  CREATOR: {
    key: 'CREATOR',
    ko: '크리에이터',
    divisions: [
      'MARKETING',
      'CREATIVE',
      'SALES',
      'FINANCE',
      'CUSTOMER_EXPERIENCE',
    ],
    executives: ['CMO', 'CRO', 'CFO'],
    specialists: ['LEGAL_IP'],
  },
};

export const resolvePreset = (key: IndustryPreset): OrgPreset => ORG_PRESETS[key];

/** Never seeded automatically — the founder has to ask for it. Spec §220.9. */
export const NEVER_AUTO_CREATED: readonly Division[] = ['CORPORATE_AFFAIRS'];
