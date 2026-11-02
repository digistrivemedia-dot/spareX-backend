/**
 * Anything with a "day" meaning (financial year, daily reports, date filters) is worked out in Asia/Kolkata. India
 * has no daylight saving, so the offset is fixed.
 */
export const KOLKATA_UTC_OFFSET = '+05:30';

/** The UTC instant a Kolkata calendar day ("2026-10-12") starts. */
export function kolkataDayStart(day: string): Date {
  return new Date(`${day}T00:00:00.000${KOLKATA_UTC_OFFSET}`);
}

/** The UTC instant the Kolkata calendar day after `day` starts, for exclusive "up to and including" ranges. */
export function kolkataDayEnd(day: string): Date {
  const start = kolkataDayStart(day);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}
