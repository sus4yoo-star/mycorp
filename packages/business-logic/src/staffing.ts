import type { SecurityLevel } from '@mycorp24/types';
import type { Division } from '@mycorp24/agent-types';

/**
 * Who actually works here — spec §132, §188, §214.
 *
 * A company was being founded with floors and executives and nobody in them:
 * the `agents` table stayed empty, so the chief of staff reported "0명 업무 중"
 * to a founder who had just been told an AI organisation works around the
 * clock. Floors are not a company.
 *
 * Two rules shape the roster below.
 *
 * **Staff are roles, not invented people.** Every one is named for the work it
 * does — 리뷰 응대 담당, 광고 운영 담당. Giving them human names would be the
 * product's first lie, and the founder would catch it the moment they wondered
 * who 김민수 is.
 *
 * **Nobody is cleared for more than their work needs** (§188). Most of the
 * company reads INTERNAL. Money and audit read CONFIDENTIAL because they must;
 * nothing here reads SECRET, because nothing here needs to.
 */

export interface AgentSeed {
  readonly displayName: string;
  readonly division: Division;
  /** Executive or founder-direct office this role answers to. */
  readonly reportsTo: string;
  /**
   * Tool skills this role may request through the gateway (§133). Typed as
   * strings rather than importing the capability union, which would make the
   * business rules depend on the integration layer; a test asserts every name
   * here is one the gateway knows, which catches a typo without the coupling.
   */
  readonly skills: readonly string[];
  readonly clearance: SecurityLevel;
}

/**
 * The roster for a division, used only when the company actually has it.
 *
 * Keyed by division so a preset that omits a division omits its staff too —
 * there is no such thing as a marketing agent in a company with no marketing
 * floor, and creating one would put work somewhere the founder cannot see it.
 */
const ROSTER: Partial<Record<Division, readonly AgentSeed[]>> = {
  CHAIRMAN: [
    {
      displayName: '비서실장',
      division: 'CHAIRMAN',
      reportsTo: 'CHIEF_OF_STAFF',
      // Reads widely because it is the founder's single interface, and every
      // approval passes through it.
      skills: ['READ_MAIL', 'READ_CALENDAR', 'READ_STATS'],
      clearance: 'CONFIDENTIAL',
    },
  ],
  AUDIT_RISK: [
    {
      displayName: '감사 담당',
      division: 'AUDIT_RISK',
      reportsTo: 'INTERNAL_AUDIT',
      // Reads the record; changes nothing. An auditor with write access is not
      // an auditor.
      skills: [],
      clearance: 'CONFIDENTIAL',
    },
    {
      displayName: '리스크 담당',
      division: 'AUDIT_RISK',
      reportsTo: 'ENTERPRISE_RISK',
      skills: [],
      clearance: 'CONFIDENTIAL',
    },
  ],
  MARKETING: [
    {
      displayName: '콘텐츠 담당',
      division: 'MARKETING',
      reportsTo: 'CMO',
      skills: ['READ_SOCIAL', 'PUBLISH_SOCIAL'],
      clearance: 'INTERNAL',
    },
    {
      displayName: '광고 운영 담당',
      division: 'MARKETING',
      reportsTo: 'CMO',
      skills: ['READ_ADS', 'WRITE_ADS_BUDGET'],
      clearance: 'INTERNAL',
    },
  ],
  SALES: [
    {
      displayName: '영업 담당',
      division: 'SALES',
      reportsTo: 'CRO',
      skills: ['READ_ORDERS', 'READ_MAIL'],
      clearance: 'INTERNAL',
    },
  ],
  OPERATIONS: [
    {
      displayName: '예약 운영 담당',
      division: 'OPERATIONS',
      reportsTo: 'COO',
      skills: ['READ_RESERVATIONS', 'READ_CALENDAR', 'WRITE_CALENDAR'],
      clearance: 'INTERNAL',
    },
    {
      displayName: '매장 정보 담당',
      division: 'OPERATIONS',
      reportsTo: 'COO',
      skills: ['READ_PLACE_INFO', 'UPDATE_PLACE_INFO'],
      clearance: 'INTERNAL',
    },
  ],
  CUSTOMER_EXPERIENCE: [
    {
      displayName: '리뷰 응대 담당',
      division: 'CUSTOMER_EXPERIENCE',
      reportsTo: 'COO',
      skills: ['READ_REVIEWS', 'RESPOND_REVIEW'],
      clearance: 'INTERNAL',
    },
  ],
  DATA: [
    {
      displayName: '지표 담당',
      division: 'DATA',
      reportsTo: 'CDO',
      skills: ['READ_STATS', 'READ_ORDERS'],
      clearance: 'INTERNAL',
    },
  ],
  FINANCE: [
    {
      displayName: '정산 담당',
      division: 'FINANCE',
      reportsTo: 'CFO',
      skills: ['READ_ORDERS', 'READ_STATS'],
      clearance: 'CONFIDENTIAL',
    },
  ],
  CREATIVE: [
    {
      displayName: '제작 담당',
      division: 'CREATIVE',
      reportsTo: 'CMO',
      skills: ['READ_SOCIAL'],
      clearance: 'INTERNAL',
    },
  ],
  EXECUTIVE_STRATEGY: [
    {
      displayName: '시장조사 담당',
      division: 'EXECUTIVE_STRATEGY',
      reportsTo: 'CSO',
      skills: ['READ_STATS'],
      clearance: 'CONFIDENTIAL',
    },
  ],
  PRODUCT: [
    {
      displayName: '제품 기획 담당',
      division: 'PRODUCT',
      reportsTo: 'CPO',
      skills: ['READ_PRODUCTS', 'WRITE_PRODUCTS'],
      clearance: 'INTERNAL',
    },
  ],
  TECHNOLOGY: [
    {
      displayName: '기술 담당',
      division: 'TECHNOLOGY',
      reportsTo: 'CTO',
      skills: [],
      clearance: 'INTERNAL',
    },
  ],
  LEGAL: [
    {
      displayName: '계약 검토 담당',
      division: 'LEGAL',
      reportsTo: 'CLO',
      skills: [],
      clearance: 'CONFIDENTIAL',
    },
  ],
  INFOSEC: [
    {
      displayName: '보안 담당',
      division: 'INFOSEC',
      reportsTo: 'CISO',
      skills: [],
      clearance: 'CONFIDENTIAL',
    },
  ],
  LOBBY: [
    {
      displayName: '접수 담당',
      division: 'LOBBY',
      reportsTo: 'CHIEF_OF_STAFF',
      skills: ['READ_MAIL', 'READ_SOCIAL', 'READ_REVIEWS'],
      clearance: 'INTERNAL',
    },
  ],
};

/**
 * The staff for the divisions a company actually has.
 *
 * Divisions with no entry in the roster get nobody, and that is deliberate: the
 * data vault and the AI infrastructure floor are machinery, not desks.
 */
export function staffFor(divisions: readonly Division[]): readonly AgentSeed[] {
  const present = new Set(divisions);
  return Object.entries(ROSTER)
    .filter(([division]) => present.has(division as Division))
    .flatMap(([, seeds]) => seeds ?? []);
}

/** Divisions the roster can staff. Anything else is machinery or empty by design. */
export const STAFFED_DIVISIONS = Object.keys(ROSTER) as readonly Division[];
