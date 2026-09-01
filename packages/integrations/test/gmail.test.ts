import { describe, expect, it, vi } from 'vitest';
import { GmailAdapter } from '../src/adapters/gmail';
import { resolveCapability } from '../src/resolver';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('GmailAdapter — spec §81, §151', () => {
  it('declares reading supported and sending unsupported, with a reason', () => {
    const adapter = new GmailAdapter({ accessToken: 't' });
    const send = adapter.getCapabilities().find((c) => c.capability === 'SEND_MAIL')!;
    expect(send.supported).toBe(false);
    expect(send.note).toContain('발송 권한');

    expect(resolveCapability(adapter, 'READ_MAIL').kind).toBe('SUPPORTED');
    const sendResolution = resolveCapability(adapter, 'SEND_MAIL');
    expect(sendResolution.kind).toBe('UNAVAILABLE');
  });

  it('refuses to write even if something calls it directly', async () => {
    const adapter = new GmailAdapter({ accessToken: 't' });
    const res = await adapter.write({ capability: 'SEND_MAIL' });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('연결되어 있지 않습니다');
  });

  it('sends the token as a bearer header and never in the URL', async () => {
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) => json({ emailAddress: 'a@b.com' }),
    );
    await new GmailAdapter({
      accessToken: 'ya29.secret',
      fetch: fetchImpl as unknown as typeof globalThis.fetch,
    }).healthCheck();

    const call = fetchImpl.mock.calls[0]!;
    expect(String(call[0])).not.toContain('ya29');
    expect(call[1]?.headers).toMatchObject({ authorization: 'Bearer ya29.secret' });
  });

  it('summarises unread mail from the list and metadata calls', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/messages?')) return json({ messages: [{ id: 'm1', threadId: 't1' }] });
      return json({
        id: 'm1',
        threadId: 't1',
        snippet: '견적 문의드립니다',
        internalDate: '1756684800000',
        payload: {
          headers: [
            { name: 'From', value: '고객 <customer@example.com>' },
            { name: 'Subject', value: '견적 요청' },
          ],
        },
      });
    });

    const res = await new GmailAdapter({
      accessToken: 't',
      fetch: fetchImpl as unknown as typeof globalThis.fetch,
    }).read({ capability: 'READ_MAIL' });

    expect(res.ok).toBe(true);
    expect(res.data).toEqual([
      {
        id: 'm1',
        threadId: 't1',
        from: '고객 <customer@example.com>',
        subject: '견적 요청',
        snippet: '견적 문의드립니다',
        receivedAt: new Date(1756684800000).toISOString(),
      },
    ]);
  });

  it('caps how many messages it will pull in one call', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request) => json({ messages: [] }));
    await new GmailAdapter({
      accessToken: 't',
      fetch: fetchImpl as unknown as typeof globalThis.fetch,
    }).read({ capability: 'READ_MAIL', params: { max: 5000 } });
    expect(String(fetchImpl.mock.calls[0]![0])).toContain('maxResults=50');
  });

  it('reports an expired connection in words the founder can act on', async () => {
    const fetchImpl = async () => json({ error: 'unauthorized' }, 401);
    const res = await new GmailAdapter({
      accessToken: 'stale',
      fetch: fetchImpl as unknown as typeof globalThis.fetch,
    }).read({ capability: 'READ_MAIL' });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('다시 연결');
  });

  it('turns a network failure into a result, not an exception', async () => {
    const fetchImpl = async () => {
      throw new Error('socket hang up');
    };
    const res = await new GmailAdapter({
      accessToken: 't',
      fetch: fetchImpl as unknown as typeof globalThis.fetch,
    }).healthCheck();
    expect(res.ok).toBe(false);
  });
});
