import 'server-only';

import {
  ToolGateway,
  defaultRiskEngine,
  type AgentPermissions,
  type AuditSink,
  type CredentialProvider,
  type GatewayRequest,
} from '@mycorp24/tool-gateway';
import { GmailAdapter, type IntegrationAdapter } from '@mycorp24/integrations';
import { CredentialVault } from '@mycorp24/vault';
import { appendAuditEvent, listApprovalPolicies, listConnections } from '@mycorp24/db';
import type { ApprovalPolicy, CompanyId, ExternalAction } from '@mycorp24/types';
import { getServerClient } from './supabase/server';
import { getVault } from './vault';

/**
 * The real tool gateway — spec §131, §220.4.
 *
 * Assembles the pipeline from live parts: approval policy from the database,
 * credentials from the vault, audit into the append-only vault table. The
 * gateway's own guarantees (a denied request never reaches an adapter; every
 * attempt is audited) are tested in packages/tool-gateway; this file only
 * supplies the dependencies.
 */

/** Adapters we have actually built. Absent means "not connected", honestly. */
export function makeAdapter(provider: string, accessToken: string): IntegrationAdapter | null {
  switch (provider) {
    case 'GMAIL':
      return new GmailAdapter({ accessToken });
    default:
      return null;
  }
}

const catalogIdFor = (provider: string) => provider.toLowerCase().replace(/_/g, '-');

/**
 * Resolve a stored token for a provider.
 *
 * Returns null when the company has not connected it — which the gateway turns
 * into a plain "not connected" denial rather than an attempted call (§151).
 */
function credentialProvider(): CredentialProvider {
  return {
    async resolve(companyId, provider) {
      const db = await getServerClient();
      const connections = await listConnections(db, companyId);
      const connection = connections.find((c) => c.catalog_id === catalogIdFor(provider));
      if (!connection) return null;

      const credential = await getVault().get(companyId, connection.id);
      if (!credential) return null;

      // An expired access token is not a usable one. Refresh lands with the
      // first write-capable adapter; until then, saying so is the honest answer.
      if (CredentialVault.isExpiring(credential)) return null;

      return credential.accessToken;
    },
  };
}

function auditSink(): AuditSink {
  return {
    async write(event) {
      const db = await getServerClient();
      await appendAuditEvent(db, {
        companyId: event.companyId,
        actor: String(event.actor),
        action: event.action,
        outcome: event.outcome,
        ...(event.reason ? { reason: event.reason } : {}),
        ...(event.integration ? { integration: event.integration } : {}),
      });
    },
  };
}

const toPolicies = (
  rows: { action: string; mode: string; auto_below_amount: string | null; currency: string | null }[],
): ApprovalPolicy[] =>
  rows.map((r) => ({
    action: r.action as ExternalAction,
    mode: r.mode as ApprovalPolicy['mode'],
    ...(r.auto_below_amount !== null ? { autoBelowAmount: Number(r.auto_below_amount) } : {}),
    ...(r.currency !== null ? { currency: r.currency } : {}),
  }));

export interface GatewayCallInput extends GatewayRequest {
  readonly provider: string;
}

/**
 * Run one outbound action through the full pipeline.
 *
 * There is no path around this function to an adapter. That is the point of
 * §131: an agent that could call an API directly would bypass permission, risk
 * and approval in one step.
 */
export async function runThroughGateway(
  input: GatewayCallInput,
  permissions: AgentPermissions,
) {
  const db = await getServerClient();
  const policies = toPolicies(await listApprovalPolicies(db, input.companyId));
  const credentials = credentialProvider();

  const token = await credentials.resolve(input.companyId as CompanyId, input.provider);
  if (!token) {
    // Audit the refusal too: "we never tried" is itself a fact the internal
    // audit office needs (§209).
    await auditSink().write({
      companyId: input.companyId,
      at: new Date().toISOString(),
      actor: input.agent,
      action: `${input.provider}:${input.capability}`,
      outcome: 'DENIED',
      reason: 'integration is not connected',
      integration: input.provider,
    });
    return { kind: 'DENIED' as const, reason: `${input.provider} is not connected` };
  }

  const adapter = makeAdapter(input.provider, token);
  if (!adapter) {
    return { kind: 'DENIED' as const, reason: `no adapter is implemented for ${input.provider}` };
  }

  const gateway = new ToolGateway({
    permissionsFor: () => permissions,
    policiesFor: () => policies,
    risk: defaultRiskEngine,
    credentials,
    audit: auditSink(),
  });

  return gateway.execute(adapter, input);
}
