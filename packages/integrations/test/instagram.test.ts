import { describe, expect, it, vi } from 'vitest';
import { InstagramAdapter } from '../src/adapters/instagram';
import { resolveCapability } from '../src/resolver';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('InstagramAdapter — spec §90, §151', () => {
  it('declares publishing and ad writes unsupported, each with a reason', () => {
    const adapter = new InstagramAdapter({ accessToken: 't' });
    for (const cap of ['PUBLISH_SOCIAL', 'READ_ADS', 'WRITE_ADS_BUDGET'] as const) {
      const decl = adapter.getCapabilities().find((c) => c.capability === cap)!;
      expect(decl.supported).toBe(false);
      expect(decl.note).toBeTruthy();
      expect(resolveCapability(adapter, cap).kind).toBe('UNAVAILABLE');
    }
    expect(resolveCapability(adapter, 'READ_SOCIAL').kind).toBe('SUPPORTED');
  });

  it('never puts the token in the query string', async () => {
    const fetchImpl = vi.fn(async (_u: string | URL | Request, _i?: RequestInit) =>
      json({ data: [] }),
    );
    await new InstagramAdapter({
      accessToken: 'EAAG.secret',
      fetch: fetchImpl as unknown as typeof globalThis.fetch,
    }).healthCheck();

    const call = fetchImpl.mock.calls[0]!;
    expect(String(call[0])).not.toContain('EAAG');
    expect(String(call[0])).not.toContain('access_token');
    expect(call[1]?.headers).toMatchObject({ authorization: 'Bearer EAAG.secret' });
  });

  it('says the Instagram account is not linked rather than reporting zeroes', async () => {
    const fetchImpl = async () => json({ data: [{ id: 'page-1', name: '페이지' }] });
    const res = await new InstagramAdapter({
      accessToken: 't',
      fetch: fetchImpl as unknown as typeof globalThis.fetch,
    }).read({ capability: 'READ_SOCIAL' });

    expect(res.ok).toBe(false);
    expect(res.error).toContain('연결되어 있지 않습니다');
  });

  it('summarises media once a business account is linked', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/me/accounts')) {
        return json({ data: [{ id: 'p1', name: '가게', instagram_business_account: { id: 'ig1' } }] });
      }
      return json({
        data: [
          {
            id: 'm1',
            caption: '신메뉴',
            media_type: 'IMAGE',
            permalink: 'https://instagram.com/p/1',
            timestamp: '2026-08-30T02:00:00+0000',
            like_count: 42,
            comments_count: 3,
          },
        ],
      });
    });

    const res = await new InstagramAdapter({
      accessToken: 't',
      fetch: fetchImpl as unknown as typeof globalThis.fetch,
    }).read({ capability: 'READ_SOCIAL' });

    expect(res.ok).toBe(true);
    expect(res.data).toEqual([
      {
        id: 'm1',
        caption: '신메뉴',
        mediaType: 'IMAGE',
        permalink: 'https://instagram.com/p/1',
        postedAt: '2026-08-30T02:00:00+0000',
        likes: 42,
        comments: 3,
      },
    ]);
  });

  it('caps the page size it will request', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).includes('/me/accounts')
        ? json({ data: [{ id: 'p1', instagram_business_account: { id: 'ig1' } }] })
        : json({ data: [] }),
    );
    await new InstagramAdapter({
      accessToken: 't',
      fetch: fetchImpl as unknown as typeof globalThis.fetch,
    }).read({ capability: 'READ_SOCIAL', params: { limit: 10_000 } });
    expect(String(fetchImpl.mock.calls[1]![0])).toContain('limit=50');
  });

  it('refuses a write even when called directly', async () => {
    const res = await new InstagramAdapter({ accessToken: 't' }).write({
      capability: 'PUBLISH_SOCIAL',
    });
    expect(res.ok).toBe(false);
  });

  it('reports an expired or under-scoped token in actionable words', async () => {
    const fetchImpl = async () => json({ error: {} }, 403);
    const res = await new InstagramAdapter({
      accessToken: 't',
      fetch: fetchImpl as unknown as typeof globalThis.fetch,
    }).healthCheck();
    expect(res.ok).toBe(false);
    expect(res.error).toContain('다시 연결');
  });
});
