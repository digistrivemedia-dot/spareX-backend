import { maskPhone, normalizeIndianMobile, toTenDigitMobile } from './phone';

describe('phone', () => {
  it.each([
    ['9845012345', '+919845012345'],
    ['98450 12345', '+919845012345'],
    ['+91 98450-12345', '+919845012345'],
    ['+919845012345', '+919845012345'],
    ['919845012345', '+919845012345'],
    ['09845012345', '+919845012345'],
  ])('normalises %s to E.164', (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each(['5845012345', '984501234', '98450123456', 'abcdefghij', ''])(
    'rejects %s as an Indian mobile number',
    (input) => {
      expect(normalizeIndianMobile(input)).toBeNull();
    },
  );

  it('gives back the 10 digits the B2C apps use', () => {
    expect(toTenDigitMobile('+919845012345')).toBe('9845012345');
  });

  it('masks all but the first two and last three digits', () => {
    expect(maskPhone('+919845012345')).toBe('+91 98••• ••345');
  });
});
