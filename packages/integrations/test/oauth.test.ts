import { describe, expect, it, vi } from 'vitest';
import {
  OAUTH_PROVIDERS,
  OAuthError,
  buildAuthorizeUrl,
  createPkcePair,
  createState,
  exchangeCode,
  isKnownProvider,
  refreshAccessToken,
} from '../src/oauth';

const gmail = OAUTH_PROVIDERS['GMAIL']!;
const meta = OAUTH_PROVIDERS['INSTAGRAM']!;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('authorize URL — spec §79 tier 1', () => {
  it('carries the exact redirect, scopes and state', () => {
    const url = new URL(
      buildAuthorizeUrl({
        provider: gmail,
        clientId: 'client-123',
        redirectUri: 'https://mycorp24.com/api/oauth/GMAIL/callback',
        state: 'state-abc',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-123');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://mycorp24.com/api/oauth/GMAIL/callback',
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('state-abc');
    expect(url.searchParams.get('scope')).toContain('gmail.readonly');
  });

  it('asks Google for offline access so a refresh token comes back', () => {
    const url = new URL(
      buildAuthorizeUrl({
        provider: gmail,
        clientId: 'c',
        redirectUri: 'https://x/cb',
        state: 's',
      }),
    );
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('sends a PKCE challenge where the provider supports it, and not otherwise', () => {
    const pkce = createPkcePair();
    const withPkce = new URL(
      buildAuthorizeUrl({ provider: gmail, clientId: 'c', redirectUri: 'https://x/cb', state: 's', pkce }),
    );
    expect(withPkce.searchParams.get('code_challenge')).toBe(pkce.challenge);
    expect(withPkce.searchParams.get('code_challenge_method')).toBe('S256');

    const without = new URL(
      buildAuthorizeUrl({ provider: meta, clientId: 'c', redirectUri: 'https://x/cb', state: 's', pkce }),
    );
    expect(without.searchParams.get('code_challenge')).toBeNull();
  });

  it('never puts a client secret in the authorize URL', () => {
    const url = buildAuthorizeUrl({
      provider: gmail,
      clientId: 'c',
      redirectUri: 'https://x/cb',
      state: 's',
    });
    expect(url).not.toContain('secret');
    expect(url).not.toContain('client_secret');
  });
});

describe('state and PKCE', () => {
  it('produces unguessable, unique state', () => {
    const states = new Set(Array.from({ length: 200 }, () => createState()));
    expect(states.size).toBe(200);
    for (const s of states) expect(s.length).toBeGreaterThanOrEqual(43);
  });

  it('produces a verifier that hashes to the challenge', async () => {
    const { verifier, challenge } = createPkcePair();
    const { createHash } = await import('node:crypto');
    const expected = createHash('sha256')
      .update(verifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(challenge).toBe(expected);
    expect(verifier).not.toBe(challenge);
  });

  it('uses url-safe characters only', () => {
    const { verifier, challenge } = createPkcePair();
    for (const v of [createState(), verifier, challenge]) {
      expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe('token exchange', () => {
  it('posts the code, the exact redirect and the PKCE verifier', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      jsonResponse({ access_token: 'ya29.a', refresh_token: '1//r', expires_in: 3600, scope: 'a b' }),
    );
    const tokens = await exchangeCode({
      provider: gmail,
      clientId: 'c',
      clientSecret: 'sec',
      redirectUri: 'https://x/cb',
      code: 'auth-code',
      codeVerifier: 'verifier',
      fetch: fetchImpl as unknown as typeof globalThis.fetch,
    });

    const body = new URLSearchParams(String(fetchImpl.mock.calls[0]![1]?.body));
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('redirect_uri')).toBe('https://x/cb');
    expect(body.get('code_verifier')).toBe('verifier');

    expect(tokens.accessToken).toBe('ya29.a');
    expect(tokens.refreshToken).toBe('1//r');
    expect(tokens.scopes).toEqual(['a', 'b']);
    expect(Date.parse(tokens.expiresAt!)).toBeGreaterThan(Date.now());
  });

  it('surfaces the provider error instead of pretending it worked', async () => {
    const fetchImpl = async () =>
      jsonResponse({ error: 'invalid_grant', error_description: 'Code was already redeemed' }, 400);
    await expect(
      exchangeCode({
        provider: gmail,
        clientId: 'c',
        clientSecret: 's',
        redirectUri: 'https://x/cb',
        code: 'used',
        fetch: fetchImpl as unknown as typeof globalThis.fetch,
      }),
    ).rejects.toThrow('Code was already redeemed');
  });

  it('treats a 200 with no access token as a failure', async () => {
    const fetchImpl = async () => jsonResponse({ token_type: 'Bearer' });
    await expect(
      exchangeCode({
        provider: gmail,
        clientId: 'c',
        clientSecret: 's',
        redirectUri: 'https://x/cb',
        code: 'x',
        fetch: fetchImpl as unknown as typeof globalThis.fetch,
      }),
    ).rejects.toThrow(OAuthError);
  });

  it('refreshes without requiring a new refresh token to come back', async () => {
    const fetchImpl = async () => jsonResponse({ access_token: 'ya29.new', expires_in: 3600 });
    const tokens = await refreshAccessToken({
      provider: gmail,
      clientId: 'c',
      clientSecret: 's',
      refreshToken: '1//r',
      fetch: fetchImpl as unknown as typeof globalThis.fetch,
    });
    expect(tokens.accessToken).toBe('ya29.new');
    expect(tokens.refreshToken).toBeUndefined();
  });
});

describe('provider registry', () => {
  it('knows the MVP providers and rejects anything else', () => {
    expect(isKnownProvider('GMAIL')).toBe(true);
    expect(isKnownProvider('INSTAGRAM')).toBe(true);
    expect(isKnownProvider('__proto__')).toBe(false);
    expect(isKnownProvider('EVIL')).toBe(false);
  });

  it('never hardcodes a secret in the registry', () => {
    for (const p of Object.values(OAUTH_PROVIDERS)) {
      expect(p.clientIdEnv).toMatch(/_CLIENT_ID$/);
      expect(p.clientSecretEnv).toMatch(/_CLIENT_SECRET$/);
    }
  });
});
