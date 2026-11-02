import { KOLKATA_UTC_OFFSET } from '../src/common/time';

const pad = (value: number) => String(value).padStart(2, '0');
const KOLKATA_OFFSET_MS = (5 * 60 + 30) * 60_000;

/**
 * Like the frontends' mock `daysAgo`: demo dates are relative to today so the data always looks current. The hour
 * is Kolkata time.
 */
export function daysAgo(days: number, hour = 11, minute = 0): Date {
  const todayInKolkata = new Date(Date.now() + KOLKATA_OFFSET_MS).toISOString().slice(0, 10);
  const day = new Date(`${todayInKolkata}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - days);
  return new Date(
    `${day.toISOString().slice(0, 10)}T${pad(hour)}:${pad(minute)}:00${KOLKATA_UTC_OFFSET}`,
  );
}
