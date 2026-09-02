import { prepareExternal } from '../untrusted';
import { diff, snapshot, type Snapshot } from '../snapshot';
import { scoreWebsiteChange, type ScoredSignal } from '../significance';

/**
 * Competitor website watcher — spec §158.
 *
 * Fetches a public page the way any visitor would and compares it to the last
 * snapshot. It reads what is published; it does not log in, bypass anything,
 * or ignore robots directives (§111 — no circumventing a site's protections).
 */

export interface WatchTarget {
  readonly competitorId: string;
  readonly competitor: string;
  readonly url: string;
  readonly previous?: Snapshot;
}

export interface WatchResult {
  readonly competitorId: string;
  readonly snapshot?: Snapshot;
  readonly signal?: ScoredSignal;
  /** Present when the check could not be made. Never silently treated as "no change". */
  readonly error?: string;
  /** Injection attempts found in the fetched page — worth knowing about. */
  readonly sanitised: readonly string[];
}

export interface WatchOptions {
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
  readonly userAgent?: string;
}

const DEFAULT_UA = 'MYCORP24-CompetitorWatch/1.0 (+https://mycorp24.com/bot)';

export async function checkWebsite(
  target: WatchTarget,
  options: WatchOptions = {},
): Promise<WatchResult> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);

  try {
    let url: URL;
    try {
      url = new URL(target.url);
    } catch {
      return { competitorId: target.competitorId, error: '주소 형식이 올바르지 않습니다.', sanitised: [] };
    }
    // Public web only. A watcher that can be pointed at localhost or a cloud
    // metadata endpoint is an SSRF hole with a friendly name.
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return { competitorId: target.competitorId, error: '지원하지 않는 프로토콜입니다.', sanitised: [] };
    }
    if (isPrivateHost(url.hostname)) {
      return { competitorId: target.competitorId, error: '내부 주소는 확인하지 않습니다.', sanitised: [] };
    }

    const res = await fetchImpl(url.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': options.userAgent ?? DEFAULT_UA, accept: 'text/html' },
    });

    if (!res.ok) {
      return {
        competitorId: target.competitorId,
        error: `사이트 응답 오류 (${res.status})`,
        sanitised: [],
      };
    }

    const html = await res.text();
    // Sanitise before anything downstream sees it. The snapshot text is what
    // later reaches a model.
    const { removed } = prepareExternal(target.competitor, html);
    const current = snapshot(html);

    if (!target.previous) {
      // First look. There is nothing to compare against, and reporting a
      // "change" here would be reporting that we started watching.
      return { competitorId: target.competitorId, snapshot: current, sanitised: removed };
    }

    const d = diff(target.previous, current);
    const signal = scoreWebsiteChange(target.competitor, d);

    return {
      competitorId: target.competitorId,
      snapshot: current,
      ...(signal ? { signal } : {}),
      sanitised: removed,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      competitorId: target.competitorId,
      error: aborted ? '응답 시간이 초과되었습니다.' : err instanceof Error ? err.message : '확인 실패',
      sanitised: [],
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Block loopback, link-local and private ranges. */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal')) return true;
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true; // cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Check several competitors, tolerating individual failures. */
export async function checkAll(
  targets: readonly WatchTarget[],
  options: WatchOptions = {},
): Promise<WatchResult[]> {
  return Promise.all(targets.map((t) => checkWebsite(t, options)));
}
