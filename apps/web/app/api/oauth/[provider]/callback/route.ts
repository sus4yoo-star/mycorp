import { NextResponse, type NextRequest } from 'next/server';
import { exchangeCode, getProvider } from '@mycorp24/integrations';
import {
  appendAuditEvent,
  consumeOAuthState,
  getCurrentCompany,
  upsertConnection,
} from '@mycorp24/db';
import { getServerClient, getSessionUser } from '../../../../../lib/supabase/server';
import { getVault } from '../../../../../lib/vault';

/**
 * Finish an OAuth connection — spec §79, §106, §110.
 *
 * Order matters here:
 *   1. consume the state (single use, expiring, scoped to this user)
 *   2. exchange the code
 *   3. record the connection
 *   4. store the token encrypted, through the service role
 *   5. audit
 *
 * A failure at any step leaves no half-connected integration claiming to work.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: providerId } = await context.params;
  const provider = getProvider(providerId);
  if (!provider) return NextResponse.json({ error: 'unknown provider' }, { status: 404 });

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/connect?error=${reason}`, request.url));

  const params = request.nextUrl.searchParams;
  if (params.get('error')) {
    // The founder declined on the provider's screen. Not an error to report.
    return NextResponse.redirect(new URL('/connect?cancelled=1', request.url));
  }

  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return fail('missing_code');

  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL('/login?next=/connect', request.url));

  const db = await getServerClient();
  const consumed = await consumeOAuthState(db, state, provider.id);
  if (!consumed) return fail('invalid_state');

  const current = await getCurrentCompany(db, user.id);
  if (!current || current.companyId !== consumed.companyId) return fail('company_mismatch');

  const clientId = process.env[provider.clientIdEnv];
  const clientSecret = process.env[provider.clientSecretEnv];
  if (!clientId || !clientSecret) return fail('not_configured');

  const redirectUri = new URL(`/api/oauth/${provider.id}/callback`, request.url).toString();

  try {
    const tokens = await exchangeCode({
      provider,
      clientId,
      clientSecret,
      redirectUri,
      code,
      ...(consumed.codeVerifier ? { codeVerifier: consumed.codeVerifier } : {}),
    });

    const connectionId = await upsertConnection(db, {
      companyId: current.companyId,
      catalogId: provider.id.toLowerCase().replace(/_/g, '-'),
      // Honest status: we hold read scopes only, so say READ_ONLY (§150).
      status: 'READ_ONLY',
      connectedBy: user.id,
      scopes: tokens.scopes ?? provider.scopes,
    });

    await getVault().put(current.companyId, connectionId, {
      accessToken: tokens.accessToken,
      ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
      ...(tokens.expiresAt ? { expiresAt: tokens.expiresAt } : {}),
      ...(tokens.scopes ? { scopes: tokens.scopes } : {}),
    });

    await appendAuditEvent(db, {
      companyId: current.companyId,
      actor: user.id,
      action: `INTEGRATION:CONNECT`,
      outcome: 'EXECUTED',
      integration: provider.id,
    });

    return NextResponse.redirect(
      new URL(`${consumed.redirectTo ?? '/connect'}?connected=${provider.id}`, request.url),
    );
  } catch (err) {
    await appendAuditEvent(db, {
      companyId: current.companyId,
      actor: user.id,
      action: 'INTEGRATION:CONNECT',
      outcome: 'FAILED',
      integration: provider.id,
      // Never log a token. Provider error text is safe; the failure path has no
      // token in it by construction.
      reason: err instanceof Error ? err.message : 'unknown failure',
    }).catch(() => undefined);
    return fail('exchange_failed');
  }
}
