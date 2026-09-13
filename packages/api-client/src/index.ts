import type { ApprovalRequest, CompanyId } from '@mycorp24/types';

/**
 * Typed client for the MYCORP24 API.
 *
 * Deliberately thin: it exists so the web and mobile apps share one definition
 * of every endpoint. Business rules live in `@mycorp24/business-logic` and are
 * enforced on the server, never here.
 *
 * NOT WIRED YET, and read this before building on it:
 *
 *   - Nothing imports this package. Web talks to Supabase directly through
 *     `@mycorp24/db`; mobile has no data layer at all.
 *   - The two endpoints below do not exist. The web app serves /api/chat,
 *     /api/gateway/run, /api/intelligence/collect and /api/oauth/*, and no
 *     /api/companies/… route has been written.
 *
 * So this compiles and would fail at runtime against the app as it stands.
 * It is kept because spec §02 (omnichannel) calls for exactly this seam, but
 * a typed method is not an endpoint — check the route exists before you trust
 * one of these signatures.
 */

export interface ApiClientOptions {
  readonly baseUrl: string;
  readonly accessToken?: string;
  readonly fetch?: typeof globalThis.fetch;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(private readonly options: ApiClientOptions) {
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    if (this.options.accessToken) {
      headers.set('authorization', `Bearer ${this.options.accessToken}`);
    }

    const res = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ApiError(body || res.statusText, res.status);
    }
    return (await res.json()) as T;
  }

  listApprovals(companyId: CompanyId): Promise<ApprovalRequest[]> {
    return this.request(`/api/companies/${companyId}/approvals`);
  }

  decideApproval(
    companyId: CompanyId,
    approvalId: string,
    decision: 'APPROVE' | 'REJECT',
    note?: string,
  ): Promise<ApprovalRequest> {
    return this.request(`/api/companies/${companyId}/approvals/${approvalId}`, {
      method: 'POST',
      body: JSON.stringify({ decision, note }),
    });
  }
}
