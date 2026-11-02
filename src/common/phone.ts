const INDIAN_MOBILE = /^[6-9]\d{9}$/;
const INDIA_PREFIX = '+91';

/**
 * An Indian mobile number in any common form ("98450 12345", "+91-98450-12345", "098450 12345") as E.164
 * ("+919845012345"), or null when it isn't one.
 */
export function normalizeIndianMobile(input: string): string | null {
  const digits = input
    .trim()
    .replace(/[\s-]/g, '')
    .replace(/^(\+91|91(?=\d{10}$)|0)/, '');
  return INDIAN_MOBILE.test(digits) ? `${INDIA_PREFIX}${digits}` : null;
}

/** "+919845012345" → "9845012345", the form the B2C apps show and send. */
export function toTenDigitMobile(e164: string): string {
  return e164.startsWith(INDIA_PREFIX) ? e164.slice(INDIA_PREFIX.length) : e164;
}

/** "+919845012345" → "+91 98••• ••345", for screens that confirm where a code was sent. */
export function maskPhone(e164: string): string {
  const digits = toTenDigitMobile(e164);
  return `${INDIA_PREFIX} ${digits.slice(0, 2)}••• ••${digits.slice(-3)}`;
}
