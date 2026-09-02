import type {
  AdapterResult,
  CapabilityDeclaration,
  IntegrationAdapter,
  ReadRequest,
  WriteRequest,
} from '../adapter';
import type { IntegrationStatus } from '@mycorp24/types';

/**
 * Gmail — spec §81, §149 (MVP integration #1).
 *
 * Declares only what the granted scopes actually allow. We ask for
 * `gmail.readonly`, so `SEND_MAIL` is declared **unsupported** with a reason
 * the chief of staff can read out verbatim. That is §151 at the adapter layer:
 * the honest "초안까지 준비했습니다" reply is only possible because the adapter
 * refuses to claim a capability it does not have.
 *
 * The adapter never decides whether an action is allowed — that is the tool
 * gateway's job (§131). It is handed a token and asked to perform one thing.
 */

const API = 'https://gmail.googleapis.com/gmail/v1';

export interface GmailAdapterOptions {
  readonly accessToken: string;
  readonly fetch?: typeof globalThis.fetch;
}

interface GmailMessageList {
  messages?: { id: string; threadId: string }[];
  resultSizeEstimate?: number;
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: { name: string; value: string }[] };
}

export interface MailSummary {
  readonly id: string;
  readonly threadId: string;
  readonly from: string;
  readonly subject: string;
  readonly snippet: string;
  readonly receivedAt: string | null;
}

export class GmailAdapter implements IntegrationAdapter {
  readonly provider = 'GMAIL';
  readonly status: IntegrationStatus = 'READ_ONLY';

  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(private readonly options: GmailAdapterOptions) {
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  getCapabilities(): readonly CapabilityDeclaration[] {
    return [
      { capability: 'READ_MAIL', supported: true, tier: 'OFFICIAL_API' },
      {
        capability: 'SEND_MAIL',
        supported: false,
        tier: 'OFFICIAL_API',
        note: '현재 연결된 권한은 읽기 전용입니다. 발송 권한은 아직 연결되어 있지 않습니다.',
      },
    ];
  }

  async connect(): Promise<AdapterResult> {
    return this.healthCheck();
  }

  async disconnect(): Promise<AdapterResult> {
    // Token revocation is the vault's job: the adapter is handed a token and
    // does not own its lifecycle.
    return { ok: true };
  }

  async healthCheck(): Promise<AdapterResult<{ healthy: boolean }>> {
    const res = await this.call<{ emailAddress?: string }>('/users/me/profile');
    return res.ok
      ? { ok: true, data: { healthy: true } }
      : { ok: false, error: res.error ?? 'Gmail profile lookup failed' };
  }

  async read(req: ReadRequest): Promise<AdapterResult<MailSummary[]>> {
    if (req.capability !== 'READ_MAIL') {
      return { ok: false, error: `GmailAdapter cannot read ${req.capability}` };
    }

    const query = typeof req.params?.['query'] === 'string' ? req.params['query'] : 'is:unread';
    const max = typeof req.params?.['max'] === 'number' ? req.params['max'] : 10;

    const list = await this.call<GmailMessageList>(
      `/users/me/messages?maxResults=${Math.min(Math.max(max, 1), 50)}&q=${encodeURIComponent(query)}`,
    );
    if (!list.ok || !list.data) return { ok: false, error: list.error ?? 'message list failed' };

    const ids = (list.data.messages ?? []).map((m) => m.id);
    const details = await Promise.all(
      ids.map((id) =>
        this.call<GmailMessage>(
          `/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        ),
      ),
    );

    const summaries: MailSummary[] = [];
    for (const d of details) {
      if (!d.ok || !d.data) continue;
      const headers = d.data.payload?.headers ?? [];
      const header = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name)?.value ?? '';
      summaries.push({
        id: d.data.id,
        threadId: d.data.threadId,
        from: header('from'),
        subject: header('subject'),
        snippet: d.data.snippet ?? '',
        receivedAt: d.data.internalDate
          ? new Date(Number(d.data.internalDate)).toISOString()
          : null,
      });
    }

    return { ok: true, data: summaries };
  }

  async write(req: WriteRequest): Promise<AdapterResult> {
    // Reached only if the gateway allowed it, which it cannot for a capability
    // declared unsupported. Refusing here too keeps the invariant local.
    return {
      ok: false,
      error: `GMAIL은 ${req.capability} 실행 권한이 연결되어 있지 않습니다.`,
    };
  }

  private async call<T>(path: string): Promise<AdapterResult<T>> {
    try {
      const res = await this.fetchImpl(`${API}${path}`, {
        headers: {
          authorization: `Bearer ${this.options.accessToken}`,
          accept: 'application/json',
        },
      });

      if (res.status === 401) {
        return { ok: false, error: 'Gmail 연결이 만료되었습니다. 다시 연결해 주십시오.' };
      }
      if (res.status === 429) {
        return { ok: false, error: 'Gmail 요청 한도에 도달했습니다.' };
      }
      if (!res.ok) {
        return { ok: false, error: `Gmail API 오류 (${res.status})` };
      }

      return { ok: true, data: (await res.json()) as T };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Gmail 요청에 실패했습니다.',
      };
    }
  }
}
