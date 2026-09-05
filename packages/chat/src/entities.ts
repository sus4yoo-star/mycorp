import type { Entities, Metric, Period } from './intent';

/**
 * Entity extraction — spec §103.
 *
 * Korean first: the MVP is a Korean product (§128). English patterns exist so
 * the same router serves the global build without a second implementation.
 */

const PROVIDERS: readonly { re: RegExp; provider: string }[] = [
  { re: /네이버\s*플레이스|naver\s*place|스마트\s*플레이스/i, provider: 'NAVER_PLACE' },
  { re: /네이버\s*예약|naver\s*reservation/i, provider: 'NAVER_RESERVATION' },
  { re: /스마트\s*스토어|smart\s*store/i, provider: 'SMARTSTORE' },
  { re: /인스타(그램)?|instagram|메타|meta/i, provider: 'INSTAGRAM' },
  { re: /유튜브|youtube/i, provider: 'YOUTUBE' },
  { re: /지메일|gmail|메일함/i, provider: 'GMAIL' },
  { re: /캘린더|calendar|일정표/i, provider: 'GOOGLE_CALENDAR' },
  { re: /야놀자|yanolja/i, provider: 'YANOLJA' },
  { re: /카카오|kakao/i, provider: 'KAKAO' },
  { re: /네이버|naver/i, provider: 'NAVER' },
];

const METRICS: readonly { re: RegExp; metric: Metric }[] = [
  { re: /매출|revenue|sales/i, metric: 'REVENUE' },
  { re: /광고비|광고\s*비용|ad\s*spend/i, metric: 'AD_SPEND' },
  { re: /예약|reservation|booking/i, metric: 'RESERVATIONS' },
  { re: /리뷰|review/i, metric: 'REVIEWS' },
  { re: /팔로워|follower|구독자/i, metric: 'FOLLOWERS' },
];

const PERIODS: readonly { re: RegExp; period: Period }[] = [
  { re: /오늘|today/i, period: 'TODAY' },
  { re: /어제|yesterday/i, period: 'YESTERDAY' },
  { re: /이번\s*주|this\s*week/i, period: 'THIS_WEEK' },
  { re: /이번\s*달|this\s*month/i, period: 'THIS_MONTH' },
  { re: /지난\s*달|저번\s*달|last\s*month/i, period: 'LAST_MONTH' },
  { re: /최근|recent/i, period: 'RECENT' },
];

const ORDINALS: readonly { re: RegExp; n: number }[] = [
  { re: /첫\s*번?\s*째|첫째|1\s*번(?!\s*째로)|first/i, n: 1 },
  { re: /두\s*번?\s*째|둘째|2\s*번|second/i, n: 2 },
  { re: /세\s*번?\s*째|셋째|3\s*번|third/i, n: 3 },
];

/** Routes the assistant may navigate to — spec §144. */
const ROUTES: readonly { re: RegExp; route: string }[] = [
  { re: /광고|ads?/i, route: '/analytics/ads' },
  { re: /결재|approval/i, route: '/approvals' },
  { re: /본사|건물|hq|headquarters/i, route: '/hq' },
  { re: /보고서|report/i, route: '/reports' },
  { re: /연결|연동|integration|connect/i, route: '/connect' },
  { re: /업무|일감|work/i, route: '/work' },
];

const first = <T>(text: string, table: readonly { re: RegExp }[], pick: (row: never) => T): T | undefined => {
  for (const row of table) if (row.re.test(text)) return pick(row as never);
  return undefined;
};

export const detectProvider = (t: string): string | undefined =>
  first(t, PROVIDERS, (r: { provider: string }) => r.provider);

export const detectMetric = (t: string): Metric | undefined =>
  first(t, METRICS, (r: { metric: Metric }) => r.metric);

export const detectPeriod = (t: string): Period | undefined =>
  first(t, PERIODS, (r: { period: Period }) => r.period);

export const detectOrdinal = (t: string): number | undefined =>
  first(t, ORDINALS, (r: { n: number }) => r.n);

export const detectRoute = (t: string): string | undefined =>
  first(t, ROUTES, (r: { route: string }) => r.route);

/**
 * Korean money. "30만원" -> 300000, "50,000원" -> 50000, "1억" -> 100000000.
 *
 * Returns undefined rather than guessing: an approval threshold parsed wrong is
 * worse than one the founder is asked to restate.
 */
export function detectAmount(text: string): { amount: number; currency: string } | undefined {
  const unit = /([\d,]+(?:\.\d+)?)\s*(억|만|천)?\s*원/.exec(text);
  if (unit) {
    const base = Number(unit[1]!.replace(/,/g, ''));
    if (!Number.isFinite(base)) return undefined;
    const mult = unit[2] === '억' ? 100_000_000 : unit[2] === '만' ? 10_000 : unit[2] === '천' ? 1_000 : 1;
    return { amount: base * mult, currency: 'KRW' };
  }
  const bare = /([\d,]+(?:\.\d+)?)\s*(억|만)\b/.exec(text);
  if (bare) {
    const base = Number(bare[1]!.replace(/,/g, ''));
    if (!Number.isFinite(base)) return undefined;
    return { amount: base * (bare[2] === '억' ? 100_000_000 : 10_000), currency: 'KRW' };
  }
  return undefined;
}

export function extractEntities(text: string): Entities {
  const money = detectAmount(text);
  return {
    ...(detectProvider(text) ? { provider: detectProvider(text)! } : {}),
    ...(detectMetric(text) ? { metric: detectMetric(text)! } : {}),
    ...(detectPeriod(text) ? { period: detectPeriod(text)! } : {}),
    ...(detectOrdinal(text) ? { ordinal: detectOrdinal(text)! } : {}),
    ...(detectRoute(text) ? { route: detectRoute(text)! } : {}),
    ...(money ? { amount: money.amount, currency: money.currency } : {}),
    ...(/반려|거절|reject/i.test(text)
      ? { decision: 'REJECT' as const }
      : /승인|approve/i.test(text)
        ? { decision: 'APPROVE' as const }
        : {}),
  };
}
