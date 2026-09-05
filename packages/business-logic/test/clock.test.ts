import { describe, expect, it } from 'vitest';
import { isSeoulEvening, seoulDayStart, seoulHour } from '../src/clock';

/** A moment stated in UTC, so the expectations below are unambiguous. */
const at = (iso: string): number => Date.parse(iso);

describe('seoulDayStart', () => {
  it('is the Seoul midnight before the given instant', () => {
    // 2026-03-04 09:30 KST is 00:30 UTC. The day began at 15:00 UTC the day before.
    expect(seoulDayStart(at('2026-03-04T00:30:00Z')).toISOString()).toBe(
      '2026-03-03T15:00:00.000Z',
    );
  });

  it('does not roll over early for a late Seoul evening', () => {
    // 23:59 KST on the 4th — still the 4th, however late it looks in UTC.
    expect(seoulDayStart(at('2026-03-04T14:59:00Z')).toISOString()).toBe(
      '2026-03-03T15:00:00.000Z',
    );
    // One minute later it is the 5th in Seoul.
    expect(seoulDayStart(at('2026-03-04T15:00:00Z')).toISOString()).toBe(
      '2026-03-04T15:00:00.000Z',
    );
  });

  it('never returns a time in the future', () => {
    for (const iso of [
      '2026-01-01T00:00:00Z',
      '2026-06-30T12:00:00Z',
      '2026-12-31T23:59:59Z',
    ]) {
      expect(seoulDayStart(at(iso)).getTime()).toBeLessThanOrEqual(at(iso));
    }
  });

  it('is always exactly a Seoul midnight', () => {
    for (let i = 0; i < 48; i += 1) {
      const t = at('2026-03-04T00:00:00Z') + i * 1_800_000;
      expect(seoulHour(seoulDayStart(t).getTime())).toBe(0);
    }
  });
});

describe('isSeoulEvening', () => {
  it('runs from 18:00 to 05:00 Seoul time', () => {
    // 18:00 KST = 09:00 UTC.
    expect(isSeoulEvening(at('2026-03-04T09:00:00Z'))).toBe(true);
    // 17:59 KST.
    expect(isSeoulEvening(at('2026-03-04T08:59:00Z'))).toBe(false);
    // 02:00 KST — a founder up late is finishing a day, not starting one.
    expect(isSeoulEvening(at('2026-03-03T17:00:00Z'))).toBe(true);
    // 05:00 KST — morning.
    expect(isSeoulEvening(at('2026-03-03T20:00:00Z'))).toBe(false);
  });
});
