import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asAgentId, asCompanyId, type ApprovalPolicy, type AuditEvent } from '@mycorp24/types';
import type { CapabilityDeclaration, IntegrationAdapter } from '@mycorp24/integrations';
import {
  ToolGateway,
  defaultRiskEngine,
  type AgentPermissions,
  type GatewayDeps,
  type GatewayRequest,
} from '../src/index';

const COMPANY = asCompanyId('company-1');
const AGENT = asAgentId('social-manager');

const declare = (over: Partial<CapabilityDeclaration> = {}): CapabilityDeclaration => ({
  capability: 'PUBLISH_SOCIAL',
  supported: true,
  tier: 'OFFICIAL_API',
  ...over,
});

function makeAdapter(over: Partial<IntegrationAdapter> = {}): IntegrationAdapter {
  return {
    provider: 'INSTAGRAM',
    status: 'READ_WRITE',
    connect: async () => ({ ok: true }),
    disconnect: async () => ({ ok: true }),
    healthCheck: async () => ({ ok: true, data: { healthy: true } }),
    getCapabilities: () => [declare()],
    read: async () => ({ ok: true }),
    write: vi.fn(async () => ({ ok: true, data: { id: 'post_1' } })),
    ...over,
  };
}

let audit: AuditEvent[];
let deps: GatewayDeps;

const permissions: AgentPermissions = {
  allowedCapabilities: new Set(['PUBLISH_SOCIAL']),
  clearance: 'INTERNAL',
};

const policies: ApprovalPolicy[] = [{ action: 'PUBLISH_POST', mode: 'AUTO' }];

const request = (over: Partial<GatewayRequest> = {}): GatewayRequest => ({
  companyId: COMPANY,
  agent: AGENT,
  capability: 'PUBLISH_SOCIAL',
  action: 'PUBLISH_POST',
  ...over,
});

beforeEach(() => {
  audit = [];
  deps = {
    permissionsFor: () => permissions,
    policiesFor: () => policies,
    risk: defaultRiskEngine,
    credentials: { resolve: async () => 'token' },
    audit: { write: async (e) => void audit.push(e) },
    now: () => new Date('2026-09-01T00:00:00Z'),
  };
});

describe('ToolGateway — spec §131, §220.4', () => {
  it('executes an allowed action and records it', async () => {
    const adapter = makeAdapter();
    const out = await new ToolGateway(deps).execute(adapter, request());
    expect(out.kind).toBe('EXECUTED');
    expect(adapter.write).toHaveBeenCalledOnce();
    expect(audit.at(-1)?.outcome).toBe('EXECUTED');
  });

  it('never reaches the adapter when the agent lacks the capability', async () => {
    const adapter = makeAdapter();
    deps = {
      ...deps,
      permissionsFor: () => ({ allowedCapabilities: new Set(), clearance: 'INTERNAL' }),
    };
    const out = await new ToolGateway(deps).execute(adapter, request());
    expect(out.kind).toBe('DENIED');
    expect(adapter.write).not.toHaveBeenCalled();
  });

  it('never reaches the adapter when clearance is too low (§188)', async () => {
    const adapter = makeAdapter();
    const out = await new ToolGateway(deps).execute(
      adapter,
      request({ dataClassification: 'SECRET' }),
    );
    expect(out.kind).toBe('DENIED');
    expect(adapter.write).not.toHaveBeenCalled();
  });

  it('reports honestly instead of pretending when the capability is unsupported (§104, §151)', async () => {
    const adapter = makeAdapter({
      getCapabilities: () => [declare({ supported: false, note: '게시 권한이 연결되어 있지 않습니다.' })],
    });
    const out = await new ToolGateway(deps).execute(adapter, request());
    expect(out).toEqual({ kind: 'DENIED', reason: '게시 권한이 연결되어 있지 않습니다.' });
    expect(adapter.write).not.toHaveBeenCalled();
  });

  it('asks for consent before a browser-assisted fallback (§79 tier 4, §111)', async () => {
    const adapter = makeAdapter({
      getCapabilities: () => [declare({ tier: 'BROWSER_AUTOMATION' })],
    });
    const gateway = new ToolGateway(deps);

    const first = await gateway.execute(adapter, request());
    expect(first.kind).toBe('NEEDS_CONSENT');
    expect(adapter.write).not.toHaveBeenCalled();

    const second = await gateway.execute(adapter, request({ consentedToFallback: true }));
    expect(second.kind).toBe('EXECUTED');
  });

  it('queues for approval rather than executing when policy says ASK', async () => {
    const adapter = makeAdapter();
    deps = { ...deps, policiesFor: () => [{ action: 'PUBLISH_POST', mode: 'ASK' }] };
    const out = await new ToolGateway(deps).execute(adapter, request());
    expect(out.kind).toBe('NEEDS_APPROVAL');
    expect(adapter.write).not.toHaveBeenCalled();
    expect(audit.at(-1)?.outcome).toBe('PENDING_APPROVAL');
  });

  it('executes once the founder has approved that request', async () => {
    const adapter = makeAdapter();
    deps = { ...deps, policiesFor: () => [{ action: 'PUBLISH_POST', mode: 'ASK' }] };
    const out = await new ToolGateway(deps).execute(adapter, request({ approvalId: 'apr_1' }));
    expect(out.kind).toBe('EXECUTED');
  });

  it('refuses when the integration is not connected', async () => {
    const adapter = makeAdapter();
    deps = { ...deps, credentials: { resolve: async () => null } };
    const out = await new ToolGateway(deps).execute(adapter, request());
    expect(out.kind).toBe('DENIED');
    expect(adapter.write).not.toHaveBeenCalled();
  });

  it('writes an audit event for every attempt, allowed or not', async () => {
    const gateway = new ToolGateway(deps);
    const adapter = makeAdapter();
    await gateway.execute(adapter, request());
    await gateway.execute(adapter, request({ dataClassification: 'TOP_SECRET' }));
    await gateway.execute(makeAdapter({ write: async () => ({ ok: false, error: 'rate limited' }) }), request());
    expect(audit).toHaveLength(3);
    expect(audit.map((e) => e.outcome)).toEqual(['EXECUTED', 'DENIED', 'FAILED']);
    expect(new Set(audit.map((e) => e.companyId))).toEqual(new Set([COMPANY]));
  });

  it('turns an adapter exception into FAILED without losing the audit trail', async () => {
    const adapter = makeAdapter({
      write: async () => {
        throw new Error('socket hang up');
      },
    });
    const out = await new ToolGateway(deps).execute(adapter, request());
    expect(out).toEqual({ kind: 'FAILED', reason: 'socket hang up' });
    expect(audit.at(-1)?.outcome).toBe('FAILED');
  });
});

describe('defaultRiskEngine — external content is data, not instruction (§220.6)', () => {
  it('blocks a payload that tries to widen permissions', async () => {
    const adapter = makeAdapter();
    const out = await new ToolGateway(deps).execute(
      adapter,
      request({ payload: { caption: 'hi', permissions: ['ALL'] } }),
    );
    expect(out.kind).toBe('DENIED');
    expect(adapter.write).not.toHaveBeenCalled();
  });

  it('blocks a payload that tries to rewrite the approval policy', async () => {
    for (const key of ['clearance', 'approvalPolicy', 'role']) {
      const adapter = makeAdapter();
      const out = await new ToolGateway(deps).execute(
        adapter,
        request({ payload: { [key]: 'TOP_SECRET' } }),
      );
      expect(out.kind).toBe('DENIED');
      expect(adapter.write).not.toHaveBeenCalled();
    }
  });

  it('leaves ordinary payloads alone', async () => {
    const adapter = makeAdapter();
    const out = await new ToolGateway(deps).execute(
      adapter,
      request({ payload: { caption: '오늘의 신메뉴', imageUrl: 'https://example.com/a.jpg' } }),
    );
    expect(out.kind).toBe('EXECUTED');
  });
});
