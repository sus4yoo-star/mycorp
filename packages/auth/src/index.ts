import type { CompanyId, SecurityLevel, UserId } from '@mycorp24/types';
import { canRead } from '@mycorp24/types';
import type { AgentProfile, Division } from '@mycorp24/agent-types';

/**
 * Membership and need-to-know — spec §188, §220.6.
 *
 * Multi-tenancy is enforced in the database with row level security; this
 * module is the application-side mirror of the same rules so a mistake shows up
 * as a denial in tests rather than a leak in production.
 */

export type MembershipRole = 'FOUNDER' | 'MEMBER' | 'VIEWER';

export interface Membership {
  readonly userId: UserId;
  readonly companyId: CompanyId;
  readonly role: MembershipRole;
}

export interface Session {
  readonly userId: UserId;
  readonly companyId: CompanyId;
  readonly role: MembershipRole;
  /** Set when the founder passed biometric re-auth for a sensitive approval. */
  readonly elevatedUntil?: string;
}

/** Only the founder may approve. Spec §112: the founder is the approval authority. */
export const canApprove = (s: Session): boolean => s.role === 'FOUNDER';

export const isMemberOf = (s: Session, companyId: CompanyId): boolean =>
  s.companyId === companyId;

/**
 * Whether an agent may read data at a given classification.
 *
 * A copywriter does not get customer PII; a marketing analyst gets ad data but
 * not bank data. Clearance is per agent, never per company.
 */
export const agentMayRead = (
  agent: Pick<AgentProfile, 'clearance'>,
  label: SecurityLevel,
): boolean => canRead(agent.clearance, label);

/** Agents may only act inside their own division. */
export const agentBelongsTo = (
  agent: Pick<AgentProfile, 'division'>,
  division: Division,
): boolean => agent.division === division;

/**
 * Biometric re-auth window for sensitive approvals — spec §116.
 * An elevated session is not a permanent state; it expires.
 */
export function isElevated(s: Session, now: Date = new Date()): boolean {
  if (!s.elevatedUntil) return false;
  const until = Date.parse(s.elevatedUntil);
  return Number.isFinite(until) && until > now.getTime();
}

export { explainSignInError, type SignInFailure } from "./signin-errors";
