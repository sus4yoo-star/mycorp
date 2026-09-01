import { createHash, randomBytes } from 'node:crypto';

/**
 * OAuth 2.0 — spec §79 tier 1, §110, §111.
 *
 * Official APIs and OAuth come first; nothing here touches a password, and
 * nothing bypasses a provider's security. A user's credentials are entered on
 * the provider's own domain and we never see them.
 *
 * Provider differences live in `OAUTH_PROVIDERS`, not in the call sites. Adding
 * a provider is a table entry plus an adapter.
 */

export interface OAuthProvider {
  readonly id: string;
  readonly displayName: string;
  readonly authorizeUrl: string;
  readonly tokenUrl: string;
  readonly revokeUrl?: string;
  readonly scopes: readonly string[];
  /** Extra authorize params. Google needs these to return a refresh token. */
  readonly authorizeParams?: Readonly<Record<string, string>>;
  readonly supportsPkce: boolean;
  /** Env var holding the client id / secret for this provider. */
  readonly clientIdEnv: string;
  readonly clientSecretEnv: string;
}

export const OAUTH_PROVIDERS: Readonly<Record<string, OAuthProvider>> = {
  GMAIL: {
    id: 'GMAIL',
    displayName: 'Gmail',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    scopes: [
      // Read and draft only. Sending is a separate, wider scope and stays out
      // until the send flow goes through approval (§112).
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    // Without both of these Google returns no refresh token on re-consent, and
    // the connection silently dies when the access token expires.
    authorizeParams: { access_type: 'offline', prompt: 'consent' },
    supportsPkce: true,
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
  },
  GOOGLE_CALENDAR: {
    id: 'GOOGLE_CALENDAR',
    displayName: 'Google Calendar',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    authorizeParams: { access_type: 'offline', prompt: 'consent' },
    supportsPkce: true,
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
  },
  INSTAGRAM: {
    id: 'INSTAGRAM',
    displayName: 'Instagram / Meta',
    authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    scopes: [
      'instagram_basic',
      'pages_show_list',
      'business_management',
      'read_insights',
    ],
    supportsPkce: false,
    clientIdEnv: 'META_OAUTH_CLIENT_ID',
    clientSecretEnv: 'META_OAUTH_CLIENT_SECRET',
  },
};

/**
 * Provider ids arrive from a URL path segment, so the lookup must not walk the
 * prototype chain: `'__proto__' in OAUTH_PROVIDERS` is true, and indexing with
 * it hands back `Object.prototype` rather than a provider.
 */
export const isKnownProvider = (id: string): boolean =>
  Object.hasOwn(OAUTH_PROVIDERS, id);

/** Safe lookup. Returns undefined for anything not explicitly registered. */
export const getProvider = (id: string): OAuthProvider | undefined =>
  Object.hasOwn(OAUTH_PROVIDERS, id) ? OAUTH_PROVIDERS[id] : undefined;

export class OAuthError extends Error {
  constructor(
    message: string,
    readonly provider: string,
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

// ---------------------------------------------------------------------------
// State and PKCE
// ---------------------------------------------------------------------------

const base64url = (buf: Buffer): string =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * Opaque, single-use CSRF token. Stored server side against the company and
 * user that started the flow, and deleted when it is used — see
 * supabase/migrations/0003_oauth_states.sql.
 */
export const createState = (): string => base64url(randomBytes(32));

export interface PkcePair {
  readonly verifier: string;
  readonly challenge: string;
  readonly method: 'S256';
}

export function createPkcePair(): PkcePair {
  const verifier = base64url(randomBytes(64));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge, method: 'S256' };
}

// ---------------------------------------------------------------------------
// Authorize
// ---------------------------------------------------------------------------

export interface AuthorizeInput {
  readonly provider: OAuthProvider;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly pkce?: PkcePair;
  readonly scopes?: readonly string[];
}

export function buildAuthorizeUrl(input: AuthorizeInput): string {
  const url = new URL(input.provider.authorizeUrl);
  const scopes = input.scopes ?? input.provider.scopes;

  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('state', input.state);

  for (const [k, v] of Object.entries(input.provider.authorizeParams ?? {})) {
    url.searchParams.set(k, v);
  }

  if (input.provider.supportsPkce && input.pkce) {
    url.searchParams.set('code_challenge', input.pkce.challenge);
    url.searchParams.set('code_challenge_method', input.pkce.method);
  }

  return url.toString();
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

export interface TokenSet {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: string;
  readonly scopes?: readonly string[];
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

const toTokenSet = (body: TokenResponse): TokenSet => ({
  accessToken: body.access_token!,
  ...(body.refresh_token ? { refreshToken: body.refresh_token } : {}),
  ...(body.expires_in
    ? { expiresAt: new Date(Date.now() + body.expires_in * 1000).toISOString() }
    : {}),
  ...(body.scope ? { scopes: body.scope.split(' ') } : {}),
});

async function postForm(
  provider: OAuthProvider,
  params: Record<string, string>,
  fetchImpl: typeof globalThis.fetch,
): Promise<TokenSet> {
  const res = await fetchImpl(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: new URLSearchParams(params).toString(),
  });

  let body: TokenResponse;
  try {
    body = (await res.json()) as TokenResponse;
  } catch {
    throw new OAuthError(`${provider.displayName} returned a non-JSON token response`, provider.id);
  }

  if (!res.ok || body.error) {
    // Provider error descriptions are safe to surface; tokens are not, and the
    // failure path never has one.
    throw new OAuthError(
      body.error_description ?? body.error ?? `token request failed (${res.status})`,
      provider.id,
    );
  }
  if (!body.access_token) {
    throw new OAuthError('token response carried no access token', provider.id);
  }

  return toTokenSet(body);
}

export interface ExchangeInput {
  readonly provider: OAuthProvider;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly code: string;
  readonly codeVerifier?: string;
  readonly fetch?: typeof globalThis.fetch;
}

export const exchangeCode = (input: ExchangeInput): Promise<TokenSet> =>
  postForm(
    input.provider,
    {
      grant_type: 'authorization_code',
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      // Must match the authorize request exactly or the provider rejects it.
      redirect_uri: input.redirectUri,
      ...(input.provider.supportsPkce && input.codeVerifier
        ? { code_verifier: input.codeVerifier }
        : {}),
    },
    input.fetch ?? globalThis.fetch,
  );

export interface RefreshInput {
  readonly provider: OAuthProvider;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * Refresh an access token.
 *
 * Google does not return a new refresh token on refresh, so the caller must
 * keep the existing one. Dropping it silently is how a connection dies weeks
 * later with no obvious cause.
 */
export const refreshAccessToken = (input: RefreshInput): Promise<TokenSet> =>
  postForm(
    input.provider,
    {
      grant_type: 'refresh_token',
      refresh_token: input.refreshToken,
      client_id: input.clientId,
      client_secret: input.clientSecret,
    },
    input.fetch ?? globalThis.fetch,
  );
