/**
 * MYCORP24 organization taxonomy.
 *
 * Spec: 01 (headquarters), §201 (governance), §214 (dynamic org),
 * §220.1 (CSO/CRO), §220.2 (board roster), §220.3 (dynamic tower).
 */

// ---------------------------------------------------------------------------
// Governance — spec §201, §220.2
// ---------------------------------------------------------------------------

/**
 * Offices reporting directly to the founder. Never omitted for any company,
 * whatever its size or industry (spec §220.9).
 */
export const FOUNDER_DIRECT_OFFICES = [
  'CHIEF_OF_STAFF',
  'INTERNAL_AUDIT',
  'ENTERPRISE_RISK',
] as const;

export type FounderDirectOffice = (typeof FOUNDER_DIRECT_OFFICES)[number];

/**
 * Executive roster.
 *
 * `CSO` is Chief **Strategy** Officer and `CRO` is Chief **Revenue** Officer.
 * The spec used to say "Chief Sales Officer" for CSO; that was ambiguous and
 * is corrected in §220.1. Do not reintroduce "Chief Sales Officer".
 */
export const EXECUTIVE_ROLES = [
  'CEO',
  'CSO',
  'CMO',
  'CRO',
  'COO',
  'CFO',
  'CDO',
  'CTO',
  'CPO',
  'CHRO',
  'CLO',
  'CISO',
] as const;

export type ExecutiveRole = (typeof EXECUTIVE_ROLES)[number];

export const EXECUTIVE_TITLE: Record<ExecutiveRole, { en: string; ko: string }> = {
  CEO: { en: 'Chief Executive Officer', ko: '최고경영자' },
  CSO: { en: 'Chief Strategy Officer', ko: '전략총괄' },
  CMO: { en: 'Chief Marketing Officer', ko: '마케팅총괄' },
  CRO: { en: 'Chief Revenue Officer', ko: '영업총괄' },
  COO: { en: 'Chief Operating Officer', ko: '운영총괄' },
  CFO: { en: 'Chief Financial Officer', ko: '재무총괄' },
  CDO: { en: 'Chief Data Officer', ko: '데이터총괄' },
  CTO: { en: 'Chief Technology Officer', ko: '기술총괄' },
  CPO: { en: 'Chief Product Officer', ko: '제품총괄' },
  CHRO: { en: 'Chief Human Resources Officer', ko: '인사총괄' },
  CLO: { en: 'Chief Legal Officer', ko: '법무총괄' },
  CISO: { en: 'Chief Information Security Officer', ko: '정보보안총괄' },
};

// ---------------------------------------------------------------------------
// Divisions
// ---------------------------------------------------------------------------

export const DIVISIONS = [
  'CHAIRMAN',
  'AUDIT_RISK',
  'EXECUTIVE_STRATEGY',
  'EXECUTIVE_BOARD',
  'LEGAL',
  'INFOSEC',
  'TECHNOLOGY',
  'PRODUCT',
  'GLOBAL',
  'RND',
  'CORPORATE_AFFAIRS',
  'MARKETING',
  'SALES',
  'DATA',
  'OPERATIONS',
  'FINANCE',
  'PEOPLE',
  'CUSTOMER_EXPERIENCE',
  'CREATIVE',
  'LOBBY',
  'AI_INFRASTRUCTURE',
  'DATA_VAULT',
] as const;

export type Division = (typeof DIVISIONS)[number];

export interface DivisionMeta {
  readonly key: Division;
  readonly en: string;
  readonly ko: string;
  /** The executive who owns it, if any. Founder-direct offices have none. */
  readonly owner?: ExecutiveRole | FounderDirectOffice;
  /**
   * Fixed floors keep their number in every company (spec §220.3).
   * `null` means the floor number is assigned dynamically.
   */
  readonly fixedFloor: number | 'B1' | 'B2' | null;
  /** Present in every company regardless of preset. */
  readonly alwaysPresent: boolean;
}

/**
 * Ordered from the top of the tower down. `resolveFloorStack` relies on this
 * order: a newly created division is inserted at its own position, and floors
 * above it shift up by one. Reordering this array changes every company's
 * building, so treat the order as part of the product, not an implementation
 * detail.
 */
export const DIVISION_META: readonly DivisionMeta[] = [
  { key: 'CHAIRMAN', en: 'Chairman Floor', ko: '회장실·비서실·결재실', owner: 'CHIEF_OF_STAFF', fixedFloor: null, alwaysPresent: true },
  { key: 'AUDIT_RISK', en: 'Audit & Risk Floor', ko: '감사실·전사리스크관리실', owner: 'INTERNAL_AUDIT', fixedFloor: null, alwaysPresent: true },
  { key: 'EXECUTIVE_STRATEGY', en: 'Executive Strategy', ko: '경영전략실·시장정보실·신사업개발실', owner: 'CSO', fixedFloor: null, alwaysPresent: false },
  { key: 'EXECUTIVE_BOARD', en: 'Executive Board', ko: '최고경영진', fixedFloor: null, alwaysPresent: true },
  { key: 'LEGAL', en: 'Legal & Compliance', ko: '법무·준법본부', owner: 'CLO', fixedFloor: null, alwaysPresent: false },
  { key: 'INFOSEC', en: 'Information Security', ko: '정보보안본부', owner: 'CISO', fixedFloor: null, alwaysPresent: false },
  { key: 'TECHNOLOGY', en: 'Technology', ko: '기술본부', owner: 'CTO', fixedFloor: null, alwaysPresent: false },
  { key: 'PRODUCT', en: 'Product', ko: '제품본부', owner: 'CPO', fixedFloor: null, alwaysPresent: false },
  { key: 'GLOBAL', en: 'Global Business', ko: '글로벌사업본부', fixedFloor: null, alwaysPresent: false },
  { key: 'RND', en: 'R&D / Innovation Lab', ko: '미래전략·혁신연구소', fixedFloor: null, alwaysPresent: false },
  { key: 'CORPORATE_AFFAIRS', en: 'Corporate Affairs', ko: '홍보·IR·구매', fixedFloor: null, alwaysPresent: false },
  { key: 'MARKETING', en: 'Marketing & Brand', ko: '마케팅본부', owner: 'CMO', fixedFloor: 9, alwaysPresent: false },
  { key: 'SALES', en: 'Sales & Growth', ko: '영업본부', owner: 'CRO', fixedFloor: 8, alwaysPresent: false },
  { key: 'DATA', en: 'Data & Intelligence', ko: '데이터본부', owner: 'CDO', fixedFloor: 7, alwaysPresent: false },
  { key: 'OPERATIONS', en: 'Operations', ko: '운영본부', owner: 'COO', fixedFloor: 6, alwaysPresent: false },
  { key: 'FINANCE', en: 'Finance & Business Administration', ko: '재무본부', owner: 'CFO', fixedFloor: 5, alwaysPresent: false },
  { key: 'PEOPLE', en: 'People & Organization', ko: '인사·조직본부', owner: 'CHRO', fixedFloor: 4, alwaysPresent: false },
  { key: 'CUSTOMER_EXPERIENCE', en: 'Customer Experience Center', ko: '고객경험센터', fixedFloor: 3, alwaysPresent: false },
  { key: 'CREATIVE', en: 'Creative Studio', ko: '크리에이티브 제작센터', fixedFloor: 2, alwaysPresent: false },
  { key: 'LOBBY', en: 'Lobby', ko: '통합 Inbox·Connect Center', fixedFloor: 1, alwaysPresent: true },
  { key: 'AI_INFRASTRUCTURE', en: 'AI Infrastructure Center', ko: 'AI 인프라센터', fixedFloor: 'B1', alwaysPresent: true },
  { key: 'DATA_VAULT', en: 'Data Vault & System Core', ko: '기업 기억 및 데이터 금고', fixedFloor: 'B2', alwaysPresent: true },
];

const META_BY_KEY = new Map<Division, DivisionMeta>(DIVISION_META.map((d) => [d.key, d]));

export const divisionMeta = (key: Division): DivisionMeta => {
  const meta = META_BY_KEY.get(key);
  if (!meta) throw new Error(`Unknown division: ${key}`);
  return meta;
};

// ---------------------------------------------------------------------------
// Agent permissions — spec §132, §188
// ---------------------------------------------------------------------------

export interface AgentProfile {
  readonly id: string;
  readonly displayName: string;
  readonly division: Division;
  readonly reportsTo?: ExecutiveRole | FounderDirectOffice;
  /** Tool skills this agent may request. Spec §133. */
  readonly skills: readonly string[];
  /** Highest classification this agent may read. Spec §188. */
  readonly clearance: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET' | 'TOP_SECRET';
}
