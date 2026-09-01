import type {
  AgentId,
  ApprovalPolicy,
  AuditEvent,
  CompanyId,
  ExternalAction,
  SecurityLevel,
} from '@mycorp24/types';
import { canRead } from '@mycorp24/types';
import { evaluateApproval } from '@mycorp24/business-logic';
import {
  resolveCapability,
  type Capability,
  type IntegrationAdapter,
} from '@mycorp24/integrations';

/**
 * Tool Gateway — spec §131, §220.4.
 *
 * Agents never call an external API. Every outbound action passes through
 * here, in this order:
 *
 *   permission -> risk -> approval policy -> credential -> adapter -> audit
 *
 * The first two lines of defence live inside this pipeline and are *blocking*.
 * The third line (the internal audit office) reads the audit log afterwards
 * and is deliberately not in this path: an auditor that can block execution
 * becomes an executor and loses its independence.
 *
 * Two invariants this module must never break:
 *   1. The adapter is not touched unless the request was allowed.
 *   2. An audit event is written for every attempt, allowed or not.
 */

export interface GatewayRequest {
  readonly companyId: CompanyId;
  readonly agent: AgentId;
  readonly capability: Capability;
  /** The approval-relevant classification of what is about to happen. */
  readonly action: ExternalAction;
  readonly amount?: number;
  readonly currency?: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  /** Classification of the data this call will touch. Spec §188. */
  readonly dataClassification?: SecurityLevel;
  /** Present when the founder already approved this specific request. */
  readonly approvalId?: string;
  /** Set when the founder consented to a browser-assisted fallback. Spec §111. */
  readonly consentedToFallback?: boolean;
}

export interface AgentPermissions {
  readonly allowedCapabilities: ReadonlySet<Capability>;
  readonly clearance: SecurityLevel;
}

export interface RiskAssessment {
  readonly blocked: boolean;
  readonly reason?: string;
}

export type RiskEngine = (req: GatewayRequest) => RiskAssessment;

export interface AuditSink {
  write(event: AuditEvent): Promise<void>;
}

export interface CredentialProvider {
  /** Resolves the credential for a provider, or null when not connected. */
  resolve(companyId: CompanyId, provider: string): Promise<string | null>;
}

export interface GatewayDeps {
  readonly permissionsFor: (agent: AgentId) => AgentPermissions | undefined;
  readonly policiesFor: (companyId: CompanyId) => readonly ApprovalPolicy[];
  readonly risk: RiskEngine;
  readonly credentials: CredentialProvider;
  readonly audit: AuditSink;
  readonly now?: () => Date;
}

export type GatewayOutcome =
  | { readonly kind: 'EXECUTED'; readonly data?: unknown }
  | { readonly kind: 'DENIED'; readonly reason: string }
  | { readonly kind: 'NEEDS_APPROVAL'; readonly reason: string }
  | { readonly kind: 'NEEDS_CONSENT'; readonly reason: string }
  | { readonly kind: 'FAILED'; readonly reason: string };

export class ToolGateway {
  constructor(private readonly deps: GatewayDeps) {}

  async execute(
    adapter: IntegrationAdapter,
    req: GatewayRequest,
  ): Promise<GatewayOutcome> {
    const at = (this.deps.now?.() ?? new Date()).toISOString();
    const base = {
      companyId: req.companyId,
      at,
      actor: req.agent,
      action: `${adapter.provider}:${req.capability}`,
      integration: adapter.provider,
    } as const;

    const deny = async (reason: string): Promise<GatewayOutcome> => {
      await this.deps.audit.write({ ...base, outcome: 'DENIED', reason });
      return { kind: 'DENIED', reason };
    };

    // --- 2nd line: permission ------------------------------------------------
    const perms = this.deps.permissionsFor(req.agent);
    if (!perms) return deny('agent has no permission profile');
    if (!perms.allowedCapabilities.has(req.capability)) {
      return deny(`agent is not permitted to use ${req.capability}`);
    }
    if (
      req.dataClassification &&
      !canRead(perms.clearance, req.dataClassification)
    ) {
      return deny(
        `agent clearance ${perms.clearance} cannot access ${req.dataClassification} data`,
      );
    }

    // --- capability resolution (spec §104) -----------------------------------
    const resolution = resolveCapability(adapter, req.capability);
    if (resolution.kind === 'UNAVAILABLE') return deny(resolution.note);
    if (resolution.kind === 'FALLBACK' && !req.consentedToFallback) {
      await this.deps.audit.write({
        ...base,
        outcome: 'DENIED',
        reason: resolution.note,
      });
      return { kind: 'NEEDS_CONSENT', reason: resolution.note };
    }

    // --- 2nd line: risk ------------------------------------------------------
    const risk = this.deps.risk(req);
    if (risk.blocked) return deny(risk.reason ?? 'blocked by risk engine');

    // --- 2nd line: approval policy (spec §112, §113) -------------------------
    const decision = evaluateApproval(
      { action: req.action, amount: req.amount, currency: req.currency },
      this.deps.policiesFor(req.companyId),
    );
    if (decision.mode === 'BLOCK') return deny(decision.reason);
    if (decision.mode === 'ASK' && !req.approvalId) {
      await this.deps.audit.write({
        ...base,
        outcome: 'PENDING_APPROVAL',
        reason: decision.reason,
      });
      return { kind: 'NEEDS_APPROVAL', reason: decision.reason };
    }

    // --- credential ----------------------------------------------------------
    const credential = await this.deps.credentials.resolve(
      req.companyId,
      adapter.provider,
    );
    if (!credential) {
      return deny(`${adapter.provider} is not connected for this company`);
    }

    // --- adapter -------------------------------------------------------------
    try {
      const result = await adapter.write({
        capability: req.capability,
        payload: req.payload,
      });
      if (!result.ok) {
        const reason = result.error ?? 'adapter reported failure';
        await this.deps.audit.write({ ...base, outcome: 'FAILED', reason });
        return { kind: 'FAILED', reason };
      }
      await this.deps.audit.write({ ...base, outcome: 'EXECUTED' });
      return { kind: 'EXECUTED', data: result.data };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'adapter threw';
      await this.deps.audit.write({ ...base, outcome: 'FAILED', reason });
      return { kind: 'FAILED', reason };
    }
  }
}

/**
 * Default risk engine.
 *
 * External content is data, never instruction (spec §220.6). Anything that
 * arrives from mail bodies, reviews, crawled pages, uploads, forked workflows
 * or third-party tool descriptions may inform an action but may never raise
 * the agent's own permissions. This engine refuses requests that carry a
 * payload attempting exactly that.
 */
export const defaultRiskEngine: RiskEngine = (req) => {
  const payload = req.payload ?? {};
  for (const key of Object.keys(payload)) {
    if (/^(permissions?|clearance|approvalPolicy|policy|role)$/i.test(key)) {
      return {
        blocked: true,
        reason: `payload attempts to change "${key}"; external content cannot alter permissions (§220.6)`,
      };
    }
  }
  return { blocked: false };
};
