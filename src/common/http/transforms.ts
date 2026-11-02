import { Transform } from 'class-transformer';

/** Trims a string field before it is validated. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/** For optional text the apps send as "" when cleared: trims, and turns "" into null. */
export const EmptyToNull = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });
