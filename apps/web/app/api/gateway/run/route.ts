import { NextResponse } from 'next/server';
import { EXTERNAL_ACTIONS, asAgentId, asCompanyId } from '@mycorp24/types';
import { CAPABILITIES } from '@mycorp24/integrations';
import { getCurrentCompany } from '@mycorp24/db';
import { getServerClient, getSessionUser } from '../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../lib/supabase/config';
import { runThroughGateway } from '../../../../lib/gateway';

/**
 * Execute one outbound action through the tool gateway.
 *
 * This is the only way the browser can cause an external call, and it cannot
 * choose its own permissions: the capability set below is fixed server side.
 * A request naming a capability outside it is rejected before anything else
 * happens (§131, §132).
 *
 * When the company's approval policy says ASK, the gateway stops and an
 * approval appears in the 결재실 rather than the action being silently dropped
 * (§112).
 */

/**
 * What the chief of staff may attempt on the founder's behalf from a chat.
 * Read-only. Writing capabilities arrive with the agent that owns them, each
 * with its own permission profile.
 */
const CHAT_CAPABILITIES = new Set<string>([
  'READ_MAIL',
  'READ_SOCIAL',
  'READ_STATS',
  'READ_REVIEWS',
]);

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'supabase is not configured' }, { status: 503 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'authentication required' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const provider = typeof input['provider'] === 'string' ? input['provider'] : '';
  const capability = typeof input['capability'] === 'string' ? input['capability'] : '';
  const action = typeof input['action'] === 'string' ? input['action'] : 'SEND_EMAIL';

  if (!CHAT_CAPABILITIES.has(capability) || !(CAPABILITIES as readonly string[]).includes(capability)) {
    return NextResponse.json({ error: 'capability is not permitted here' }, { status: 403 });
  }
  if (!(EXTERNAL_ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
  if (!provider) {
    return NextResponse.json({ error: 'provider is required' }, { status: 400 });
  }

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) return NextResponse.json({ error: 'no company' }, { status: 409 });

  const outcome = await runThroughGateway(
    {
      companyId: asCompanyId(current.companyId),
      // The founder is acting through the chief of staff; the audit trail
      // records the human, not an anonymous "system".
      agent: asAgentId(user.id),
      provider,
      capability: capability as never,
      action: action as never,
      approvalTitle: `${provider} ${capability}`,
      approvalSummary: '비서실장이 회장님 지시로 요청했습니다.',
    },
    // Read-only, INTERNAL clearance. Customer data and credentials stay out of
    // reach of a chat-initiated call (§188).
    { allowedCapabilities: new Set([capability]) as never, clearance: 'INTERNAL' },
  );

  return NextResponse.json(outcome);
}
