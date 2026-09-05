/**
 * The company keeps the founder's hours — spec §194, §195.
 *
 * Everything about reporting depends on when "today" started and whether the
 * founder has finished for the day, and both were being computed inline in a
 * page where nothing could test them. Date arithmetic is exactly where a silent
 * off-by-one lives: a briefing that counts from the wrong midnight reports
 * yesterday's work as today's, and looks entirely plausible doing it.
 *
 * Korea does not observe daylight saving, so a fixed offset is correct here and
 * will stay correct. It is written as one constant so that if that ever stops
 * being true, there is a single place to fix.
 */

const KST_OFFSET_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;

/** Midnight in Seoul, as an instant. */
export function seoulDayStart(now: number = Date.now()): Date {
  return new Date(Math.floor((now + KST_OFFSET_MS) / DAY_MS) * DAY_MS - KST_OFFSET_MS);
}

/** The hour in Seoul, 0-23. */
export const seoulHour = (now: number = Date.now()): number =>
  new Date(now + KST_OFFSET_MS).getUTCHours();

/**
 * Evening runs from 18:00 to 05:00. A founder opening the app at 2am is
 * finishing a day, not starting one — the shorter report is the right one.
 */
export function isSeoulEvening(now: number = Date.now()): boolean {
  const hour = seoulHour(now);
  return hour >= 18 || hour < 5;
}
