import type {
  AdapterResult,
  CapabilityDeclaration,
  IntegrationAdapter,
  ReadRequest,
  WriteRequest,
} from '../adapter';
import type { IntegrationStatus } from '@mycorp24/types';

/**
 * Instagram / Meta — spec §90, §149 (MVP integration #6).
 *
 * Declares reading supported and publishing **not** supported. Content
 * publishing needs `instagram_content_publish`, which Meta grants only after
 * App Review, and ad writes need `ads_management`. We have neither, so the
 * adapter says so rather than letting the chief of staff imply otherwise
 * (§104, §151).
 *
 * Reading insights requires an Instagram Business account linked to a Facebook
 * Page. When it is not, the Graph API returns an empty page list and we report
 * that plainly instead of showing zeroes as if they were data.
 */

const GRAPH = 'https://graph.facebook.com/v21.0';

export interface InstagramAdapterOptions {
  readonly accessToken: string;
  readonly fetch?: typeof globalThis.fetch;
}

interface PageList {
  data?: { id: string; name: string; instagram_business_account?: { id: string } }[];
}

interface MediaList {
  data?: {
    id: string;
    caption?: string;
    media_type?: string;
    permalink?: string;
    timestamp?: string;
    like_count?: number;
    comments_count?: number;
  }[];
}

export interface PostSummary {
  readonly id: string;
  readonly caption: string;
  readonly mediaType: string;
  readonly permalink: string;
  readonly postedAt: string | null;
  readonly likes: number;
  readonly comments: number;
}

export class InstagramAdapter implements IntegrationAdapter {
  readonly provider = 'INSTAGRAM';
  readonly status: IntegrationStatus = 'READ_ONLY';

  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(private readonly options: InstagramAdapterOptions) {
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  getCapabilities(): readonly CapabilityDeclaration[] {
    return [
      { capability: 'READ_SOCIAL', supported: true, tier: 'OFFICIAL_API' },
      { capability: 'READ_STATS', supported: true, tier: 'OFFICIAL_API' },
      {
        capability: 'PUBLISH_SOCIAL',
        supported: false,
        tier: 'OFFICIAL_API',
        note: 'Instagram 게시 권한(instagram_content_publish)은 Meta 앱 심사 승인 후에 사용할 수 있습니다. 현재 연결된 권한은 조회 전용입니다.',
      },
      {
        capability: 'READ_ADS',
        supported: false,
        tier: 'OFFICIAL_API',
        note: '광고 데이터 조회에는 ads_read 권한이 필요합니다. 현재 연결에는 포함되어 있지 않습니다.',
      },
      {
        capability: 'WRITE_ADS_BUDGET',
        supported: false,
        tier: 'OFFICIAL_API',
        note: '광고비 변경에는 ads_management 권한과 Meta 앱 심사가 필요합니다.',
      },
    ];
  }

  async connect(): Promise<AdapterResult> {
    return this.healthCheck();
  }

  async disconnect(): Promise<AdapterResult> {
    return { ok: true };
  }

  async healthCheck(): Promise<AdapterResult<{ healthy: boolean }>> {
    const account = await this.resolveBusinessAccount();
    return account.ok
      ? { ok: true, data: { healthy: true } }
      : { ok: false, error: account.error ?? 'Instagram 계정을 확인하지 못했습니다.' };
  }

  async read(req: ReadRequest): Promise<AdapterResult<PostSummary[]>> {
    if (req.capability !== 'READ_SOCIAL' && req.capability !== 'READ_STATS') {
      return { ok: false, error: `InstagramAdapter cannot read ${req.capability}` };
    }

    const account = await this.resolveBusinessAccount();
    if (!account.ok || !account.data) {
      return { ok: false, error: account.error ?? 'Instagram 비즈니스 계정을 찾지 못했습니다.' };
    }

    const limitParam = req.params?.['limit'];
    const limit = Math.min(Math.max(typeof limitParam === 'number' ? limitParam : 10, 1), 50);

    const media = await this.call<MediaList>(
      `/${account.data}/media?limit=${limit}` +
        '&fields=id,caption,media_type,permalink,timestamp,like_count,comments_count',
    );
    if (!media.ok || !media.data) {
      return { ok: false, error: media.error ?? 'Instagram 게시물을 가져오지 못했습니다.' };
    }

    return {
      ok: true,
      data: (media.data.data ?? []).map((m) => ({
        id: m.id,
        caption: m.caption ?? '',
        mediaType: m.media_type ?? 'UNKNOWN',
        permalink: m.permalink ?? '',
        postedAt: m.timestamp ?? null,
        likes: m.like_count ?? 0,
        comments: m.comments_count ?? 0,
      })),
    };
  }

  async write(req: WriteRequest): Promise<AdapterResult> {
    return {
      ok: false,
      error: `INSTAGRAM은 ${req.capability} 실행 권한이 연결되어 있지 않습니다.`,
    };
  }

  /** The Instagram business account id hangs off a Facebook Page, not the user. */
  private async resolveBusinessAccount(): Promise<AdapterResult<string>> {
    const pages = await this.call<PageList>('/me/accounts?fields=id,name,instagram_business_account');
    if (!pages.ok || !pages.data) {
      return { ok: false, error: pages.error ?? 'Facebook 페이지 목록을 가져오지 못했습니다.' };
    }

    const linked = (pages.data.data ?? []).find((p) => p.instagram_business_account?.id);
    if (!linked?.instagram_business_account) {
      return {
        ok: false,
        error:
          'Instagram 비즈니스 계정이 Facebook 페이지에 연결되어 있지 않습니다. Meta Business에서 연결한 뒤 다시 시도해 주십시오.',
      };
    }
    return { ok: true, data: linked.instagram_business_account.id };
  }

  private async call<T>(path: string): Promise<AdapterResult<T>> {
    const url = new URL(`${GRAPH}${path}`);
    try {
      const res = await this.fetchImpl(url.toString(), {
        // Bearer header, never `?access_token=` — a token in a URL ends up in
        // proxy logs, browser history and referrers.
        headers: {
          authorization: `Bearer ${this.options.accessToken}`,
          accept: 'application/json',
        },
      });

      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: 'Instagram 연결이 만료되었거나 권한이 부족합니다. 다시 연결해 주십시오.' };
      }
      if (res.status === 429) return { ok: false, error: 'Instagram 요청 한도에 도달했습니다.' };
      if (!res.ok) return { ok: false, error: `Meta Graph API 오류 (${res.status})` };

      return { ok: true, data: (await res.json()) as T };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Instagram 요청에 실패했습니다.',
      };
    }
  }
}
