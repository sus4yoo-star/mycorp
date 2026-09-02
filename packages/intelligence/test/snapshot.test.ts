import { describe, expect, it } from 'vitest';
import { diff, extractPrices, extractText, normalise, snapshot } from '../src/snapshot';
import { isPrivateHost } from '../src/sources/website';
import { scoreWebsiteChange, isReportable } from '../src/significance';

const page = (body: string) =>
  `<html><head><style>.a{color:red}</style><script>var x=1</script></head><body>${body}</body></html>`;

describe('snapshot', () => {
  it('strips scripts, styles and markup', () => {
    const text = extractText(page('<h1>블루커피</h1><p>아메리카노 4,500원</p>'));
    expect(text).toBe('블루커피 아메리카노 4,500원');
    expect(text).not.toContain('var x');
    expect(text).not.toContain('color:red');
  });

  it('normalises away the things that change every page load', () => {
    const a = normalise('업데이트 2026-08-31 14:22 build 9f2ac41b8e');
    const b = normalise('업데이트 2026-09-01 09:05 build 771bd0aa42');
    expect(a).toBe(b);
  });

  it('does not report a change when only a timestamp moved', () => {
    const before = snapshot(page('<p>메뉴</p><time>2026-08-31 10:00</time>'));
    const after = snapshot(page('<p>메뉴</p><time>2026-09-01 11:30</time>'));
    expect(diff(before, after).changed).toBe(false);
  });

  it('finds Korean prices in several formats', () => {
    expect(extractPrices('아메리카노 4,500원 · 라떼 ₩5000 · KRW 6,000')).toEqual([4500, 5000, 6000]);
  });

  it('ignores numbers that are not prices', () => {
    expect(extractPrices('2026년 · 전화 02-1234-5678 · 4,500원')).toEqual([4500]);
  });

  it('reports a price move on the cheapest item, which is what customers compare', () => {
    const before = snapshot(page('<p>아메리카노 5,000원 라떼 6,000원</p>'));
    const after = snapshot(page('<p>아메리카노 4,000원 라떼 6,000원</p>'));
    const d = diff(before, after);
    expect(d.priceMove).toEqual({ before: 5000, after: 4000, percent: -20 });
  });
});

describe('significance — spec §141, §158', () => {
  const priceCut = (percent: number) => ({
    changed: true,
    textDelta: 0.1,
    priceMove: { before: 10_000, after: Math.round(10_000 * (1 + percent / 100)), percent },
  });

  it('treats a deep price cut as something to hear about today', () => {
    const s = scoreWebsiteChange('경쟁사 A', priceCut(-20))!;
    expect(s.kind).toBe('PRICE_CHANGE');
    expect(s.significance).toBe(5);
    expect(isReportable(s)).toBe(true);
    expect(s.summary).toContain('20% 인하');
  });

  it('ranks a price rise below a cut — a cut moves customers away from us', () => {
    expect(scoreWebsiteChange('A', priceCut(20))!.significance).toBeLessThan(
      scoreWebsiteChange('A', priceCut(-20))!.significance,
    );
  });

  it('does not wake the founder for rounding', () => {
    const s = scoreWebsiteChange('A', priceCut(-2))!;
    expect(isReportable(s)).toBe(false);
  });

  it('does not report a signal when nothing changed', () => {
    expect(scoreWebsiteChange('A', { changed: false, textDelta: 0 })).toBeNull();
  });

  it('keeps a small copy edit out of the briefing', () => {
    const s = scoreWebsiteChange('A', { changed: true, textDelta: 0.05 })!;
    expect(s.significance).toBe(1);
    expect(isReportable(s)).toBe(false);
  });
});

describe('watcher will not be pointed inward', () => {
  const privateHosts = [
    'localhost', '127.0.0.1', '10.1.2.3', '192.168.0.5', '172.16.0.1',
    '169.254.169.254', '::1', 'db.internal',
  ];
  for (const h of privateHosts) {
    it(`refuses ${h}`, () => expect(isPrivateHost(h)).toBe(true));
  }
  it('allows a real site', () => {
    expect(isPrivateHost('competitor.co.kr')).toBe(false);
    expect(isPrivateHost('8.8.8.8')).toBe(false);
  });
});
