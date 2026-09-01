import { createHash } from 'node:crypto';

/**
 * Page snapshots — the mechanism behind competitor monitoring (spec §158).
 *
 * We keep a normalised text snapshot of a competitor's page and compare it to
 * the last one. Change detection has to survive the noise a real site emits:
 * timestamps, cache-busting query strings, rotating banners. A watcher that
 * fires on every page load is a watcher the founder turns off.
 */

/** Strip markup, scripts and styles. Deliberately simple: we compare text. */
export function extractText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Remove what changes on every load without the site having changed.
 * Without this, every check reports a difference and the signal is worthless.
 */
export function normalise(text: string): string {
  return text
    .replace(/\b\d{4}[-./]\d{1,2}[-./]\d{1,2}\b/g, '<date>')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, '<time>')
    .replace(/\b[0-9a-f]{8,}\b/gi, '<hash>')
    .replace(/\?\w+=[\w%.-]+/g, '')
    .toLowerCase()
    .trim();
}

export const fingerprint = (text: string): string =>
  createHash('sha256').update(normalise(text)).digest('hex').slice(0, 32);

/** Prices, so a change in them can be told apart from a change in copy. */
export function extractPrices(text: string): number[] {
  const prices = new Set<number>();
  for (const m of text.matchAll(/([\d,]{2,})\s*원/g)) {
    const n = Number(m[1]!.replace(/,/g, ''));
    if (Number.isFinite(n) && n >= 100) prices.add(n);
  }
  for (const m of text.matchAll(/(?:₩|\bKRW\s*)([\d,]{2,})/gi)) {
    const n = Number(m[1]!.replace(/,/g, ''));
    if (Number.isFinite(n) && n >= 100) prices.add(n);
  }
  return [...prices].sort((a, b) => a - b);
}

export interface Snapshot {
  readonly fingerprint: string;
  readonly text: string;
  readonly prices: readonly number[];
  readonly takenAt: string;
}

export function snapshot(html: string, takenAt = new Date().toISOString()): Snapshot {
  const text = extractText(html);
  return { fingerprint: fingerprint(text), text, prices: extractPrices(text), takenAt };
}

export interface PriceMove {
  readonly before: number;
  readonly after: number;
  /** Negative for a cut. */
  readonly percent: number;
}

export interface SnapshotDiff {
  readonly changed: boolean;
  readonly priceMove?: PriceMove;
  /** 0..1 — how much of the text is different. */
  readonly textDelta: number;
}

/**
 * Compare two snapshots.
 *
 * Price moves are matched on the *cheapest* price on the page, which is what a
 * customer comparing shops actually sees. Matching every number produces noise
 * from unrelated figures.
 */
export function diff(before: Snapshot, after: Snapshot): SnapshotDiff {
  const changed = before.fingerprint !== after.fingerprint;
  if (!changed) return { changed: false, textDelta: 0 };

  const a = new Set(normalise(before.text).split(' ').filter(Boolean));
  const b = new Set(normalise(after.text).split(' ').filter(Boolean));
  let shared = 0;
  for (const w of b) if (a.has(w)) shared += 1;
  const union = new Set([...a, ...b]).size;
  const textDelta = union === 0 ? 0 : Math.round((1 - shared / union) * 100) / 100;

  const lowBefore = before.prices[0];
  const lowAfter = after.prices[0];
  if (lowBefore !== undefined && lowAfter !== undefined && lowBefore !== lowAfter) {
    return {
      changed,
      textDelta,
      priceMove: {
        before: lowBefore,
        after: lowAfter,
        percent: Math.round(((lowAfter - lowBefore) / lowBefore) * 1000) / 10,
      },
    };
  }

  return { changed, textDelta };
}
