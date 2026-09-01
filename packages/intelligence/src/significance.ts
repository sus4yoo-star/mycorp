import type { SnapshotDiff } from './snapshot';

/**
 * How much a detected change is worth telling the founder — spec §141, §158.
 *
 * 1 is noise, 5 is "today". The briefing only surfaces 4 and up, so this
 * function decides what the founder's morning looks like. Scoring generously
 * would be the fastest way to make the product something people mute.
 */

export type SignalKind =
  | 'PRICE_CHANGE'
  | 'NEW_PRODUCT'
  | 'NEW_SERVICE'
  | 'AD_CAMPAIGN'
  | 'SOCIAL_CONTENT'
  | 'REVIEW_SURGE'
  | 'RATING_CHANGE'
  | 'NEW_LOCATION'
  | 'PROMOTION'
  | 'SITE_CHANGE'
  | 'HIRING'
  | 'PARTNERSHIP'
  | 'RANKING_CHANGE';

export interface ScoredSignal {
  readonly kind: SignalKind;
  readonly summary: string;
  readonly significance: number;
  readonly evidence: Readonly<Record<string, unknown>>;
}

/** A price cut a customer would notice. Below this, it is rounding. */
const MATERIAL_PRICE_MOVE = 5;

/** Below this the page changed a word; above it, something happened. */
const MATERIAL_TEXT_DELTA = 0.25;

export function scoreWebsiteChange(
  competitor: string,
  d: SnapshotDiff,
): ScoredSignal | null {
  if (!d.changed) return null;

  if (d.priceMove && Math.abs(d.priceMove.percent) >= MATERIAL_PRICE_MOVE) {
    const { before, after, percent } = d.priceMove;
    const direction = percent < 0 ? '인하' : '인상';
    // A cut is more urgent than a rise: it moves customers away from us.
    const significance = percent < 0 ? (Math.abs(percent) >= 15 ? 5 : 4) : 3;
    return {
      kind: 'PRICE_CHANGE',
      summary: `${competitor}이(가) 최저가를 ${before.toLocaleString('ko-KR')}원에서 ${after.toLocaleString('ko-KR')}원으로 ${Math.abs(percent)}% ${direction}했습니다.`,
      significance,
      evidence: { before, after, percent },
    };
  }

  if (d.textDelta >= MATERIAL_TEXT_DELTA) {
    return {
      kind: 'SITE_CHANGE',
      summary: `${competitor} 웹사이트 내용이 크게 바뀌었습니다 (약 ${Math.round(d.textDelta * 100)}% 변경).`,
      // Worth logging, not worth a morning mention on its own.
      significance: d.textDelta >= 0.6 ? 4 : 3,
      evidence: { textDelta: d.textDelta },
    };
  }

  return {
    kind: 'SITE_CHANGE',
    summary: `${competitor} 웹사이트에 소폭 변경이 있었습니다.`,
    significance: 1,
    evidence: { textDelta: d.textDelta },
  };
}

/** What the briefing will actually surface (§158). */
export const isReportable = (s: ScoredSignal): boolean => s.significance >= 4;
