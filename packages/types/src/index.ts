/**
 * MYCORP24 core domain types.
 *
 * Every value in this file traces back to a numbered section of the product
 * specification in `docs/spec/`. When a type and the spec disagree, the spec
 * wins and this file is wrong.
 */

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

export type CompanyId = string & { readonly __brand: 'CompanyId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type AgentId = string & { readonly __brand: 'AgentId' };
export type TaskId = string & { readonly __brand: 'TaskId' };
export type ApprovalId = string & { readonly __brand: 'ApprovalId' };

export const asCompanyId = (v: string): CompanyId => v as CompanyId;
export const asUserId = (v: string): UserId => v as UserId;
export const asAgentId = (v: string): AgentId => v as AgentId;

// ---------------------------------------------------------------------------
// Security classification — spec §180–182
// ---------------------------------------------------------------------------

export const SECURITY_LEVELS = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'SECRET',
  'TOP_SECRET',
] as const;

export type SecurityLevel = (typeof SECURITY_LEVELS)[number];

/** Ordering matters: a reader cleared for N can read <= N. */
export const SECURITY_RANK: Record<SecurityLevel, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  SECRET: 3,
  TOP_SECRET: 4,
};

/** Korean UX labels — spec §181. */
export const SECURITY_LABEL_KO: Record<SecurityLevel, string> = {
  PUBLIC: '공개',
  INTERNAL: '사내한',
  CONFIDENTIAL: '대외비',
  SECRET: '기밀',
  TOP_SECRET: '극비',
};

export const canRead = (clearance: SecurityLevel, label: SecurityLevel): boolean =>
  SECURITY_RANK[clearance] >= SECURITY_RANK[label];

// ---------------------------------------------------------------------------
// Visibility — spec §179
// ---------------------------------------------------------------------------

export const VISIBILITY = [
  'PUBLIC',
  'FOLLOWERS',
  'PARTNERS',
  'TEAM_ONLY',
  'PRIVATE',
  'CONFIDENTIAL',
  'SECRET',
] as const;

export type Visibility = (typeof VISIBILITY)[number];

// ---------------------------------------------------------------------------
// Approval — spec §112, §113
// ---------------------------------------------------------------------------

export type ApprovalMode = 'AUTO' | 'ASK' | 'BLOCK';

/** Actions that touch money, customers, or the outside world. Spec §112. */
export const EXTERNAL_ACTIONS = [
  'PUBLISH_POST',
  'REPLY_REVIEW',
  'SEND_CUSTOMER_MESSAGE',
  'SEND_EMAIL',
  'CHANGE_RESERVATION',
  'CANCEL_RESERVATION',
  'CHANGE_PRICE',
  'START_AD',
  'STOP_AD',
  'CHANGE_AD_BUDGET',
  'EDIT_PRODUCT',
  'ISSUE_COUPON',
  'SIGN_CONTRACT',
  'SPEND_MONEY',
  'BULK_CUSTOMER_DATA',
  'DELETE_CRITICAL_DATA',
] as const;

export type ExternalAction = (typeof EXTERNAL_ACTIONS)[number];

export interface ApprovalPolicy {
  readonly action: ExternalAction;
  readonly mode: ApprovalMode;
  /** Optional spend threshold in minor units (KRW has no minor unit; use whole won). */
  readonly autoBelowAmount?: number;
  readonly currency?: string;
}

export interface ApprovalRequest {
  readonly id: ApprovalId;
  readonly companyId: CompanyId;
  readonly action: ExternalAction;
  readonly title: string;
  readonly summary: string;
  readonly amount?: number;
  readonly currency?: string;
  readonly requestedBy: AgentId;
  readonly requestedAt: string;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'AMENDED';
}

// ---------------------------------------------------------------------------
// Integration status — spec §150
// ---------------------------------------------------------------------------

export const INTEGRATION_STATUS = [
  'FULL',
  'READ_WRITE',
  'READ_ONLY',
  'PARTNER_REQUIRED',
  'BROWSER_ASSISTED',
  'MANUAL',
  'UNAVAILABLE',
] as const;

export type IntegrationStatus = (typeof INTEGRATION_STATUS)[number];

/** Connection tiers, most preferred first — spec §79. */
export const CONNECTION_TIERS = [
  'OFFICIAL_API',
  'MCP',
  'EMAIL_WEBHOOK_EXPORT',
  'BROWSER_AUTOMATION',
  'SCREEN_UNDERSTANDING',
] as const;

export type ConnectionTier = (typeof CONNECTION_TIERS)[number];

// ---------------------------------------------------------------------------
// Risk — spec §210
// ---------------------------------------------------------------------------

export const RISK_CATEGORIES = [
  'STRATEGIC',
  'FINANCIAL',
  'LEGAL',
  'SECURITY',
  'OPERATIONAL',
  'REPUTATIONAL',
  'CUSTOMER',
  'PLATFORM',
  'AI',
  'MARKET',
] as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export interface RiskEntry {
  readonly riskName: string;
  readonly category: RiskCategory;
  /** 0..1 */
  readonly probability: number;
  /** 0..1 */
  readonly impact: number;
  readonly owner: string;
  readonly mitigation: string;
  readonly detectedAt: string;
  readonly status: 'OPEN' | 'MITIGATING' | 'ACCEPTED' | 'CLOSED';
}

export const riskSeverity = (r: Pick<RiskEntry, 'probability' | 'impact'>): number =>
  Math.round(r.probability * r.impact * 100) / 100;

// ---------------------------------------------------------------------------
// Proposals — spec §161
// ---------------------------------------------------------------------------

export const PROPOSAL_TYPES = [
  'OPPORTUNITY',
  'RISK',
  'IMPROVEMENT',
  'BENCHMARK',
  'COST_SAVING',
  'GROWTH',
  'AUTOMATION',
  'CUSTOMER_ISSUE',
  'COMPETITOR_MOVE',
] as const;

export type ProposalType = (typeof PROPOSAL_TYPES)[number];

// ---------------------------------------------------------------------------
// Founder identity — spec §167, docs/brand/LOCALIZATION.md
// ---------------------------------------------------------------------------

export type AddressForm = 'title_only' | 'name_title' | 'name_only' | 'custom';

export interface FounderIdentity {
  readonly ownerDisplayName: string;
  readonly preferredTitle: string;
  readonly preferredNickname?: string;
  readonly locale: string;
  readonly addressForm: AddressForm;
  /** Used only when addressForm === 'custom'. */
  readonly customAddress?: string;
}

// ---------------------------------------------------------------------------
// Audit — spec §220.4, B2 Audit Vault
// ---------------------------------------------------------------------------

export interface AuditEvent {
  readonly companyId: CompanyId;
  readonly at: string;
  readonly actor: AgentId | UserId;
  readonly action: string;
  readonly outcome: 'ALLOWED' | 'DENIED' | 'PENDING_APPROVAL' | 'EXECUTED' | 'FAILED';
  readonly reason?: string;
  readonly integration?: string;
  readonly payloadDigest?: string;
}
