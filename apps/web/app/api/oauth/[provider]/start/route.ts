import { NextResponse, type NextRequest } from 'next/server';
import { buildAuthorizeUrl, createPkcePair, createState, getProvider } from '@mycorp24/integrations';
import { createOAuthState, getCurrentCompany } from '@mycorp24/db';
import { getServerClient, getSessionUser } from '../../../../../lib/supabase/server';

/**
 * Begin an OAuth connection — spec §79 tier 1, §106.
 *
 * The state and the PKCE verifier are stored server side against this user and
 * company. Nothing secret is placed in the redirect: the browser only ever
 * carries the opaque state.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: providerId } = await context.params;
  const provider = getProvider(providerId);
  if (!provider) {
    return NextResponse.json({ error: 'unknown provider' }, { status: 404 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login?next=/connect', request.url));
  }

  const clientId = process.env[provider.clientIdEnv];
  if (!clientId || !process.env[provider.clientSecretEnv]) {
    return NextResponse.redirect(
      new URL(`/connect?error=not_configured&provider=${provider.id}`, request.url),
    );
  }

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) return NextResponse.redirect(new URL('/onboarding', request.url));

  const state = createState();
  const pkce = provider.supportsPkce ? createPkcePair() : undefined;

  await createOAuthState(db, {
    state,
    companyId: current.companyId,
    userId: user.id,
    provider: provider.id,
    ...(pkce ? { codeVerifier: pkce.verifier } : {}),
    redirectTo: '/connect',
  });

  const redirectUri = new URL(`/api/oauth/${provider.id}/callback`, request.url).toString();

  return NextResponse.redirect(
    buildAuthorizeUrl({ provider, clientId, redirectUri, state, ...(pkce ? { pkce } : {}) }),
  );
}
