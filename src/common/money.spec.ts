import {
  applyDiscountPercent,
  gstOnExclusive,
  isPaise,
  lineGst,
  percentOf,
  roundToPaisa,
  splitGstByPlaceOfSupply,
  splitInclusiveGst,
} from './money';

describe('money', () => {
  it('accepts only whole, non-negative paise', () => {
    expect(isPaise(45_900)).toBe(true);
    expect(isPaise(0)).toBe(true);
    expect(isPaise(459.5)).toBe(false);
    expect(isPaise(-1)).toBe(false);
    expect(isPaise(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(isPaise('100')).toBe(false);
  });

  it('rounds halves away from zero', () => {
    expect(roundToPaisa(10.5)).toBe(11);
    expect(roundToPaisa(10.4999)).toBe(10);
    expect(roundToPaisa(-10.5)).toBe(-11);
  });

  it('takes a percentage of an amount to the nearest paisa', () => {
    expect(percentOf(45_900, 10)).toBe(4_590);
    expect(percentOf(999, 18)).toBe(180);
  });

  it('applies a B2B discount the same way the admin panel shows it', () => {
    expect(applyDiscountPercent(45_900, 12)).toBe(40_392);
    expect(applyDiscountPercent(45_900, 0)).toBe(45_900);
  });

  it('splits a GST-inclusive price into taxable value and GST that add back up exactly', () => {
    const { taxableValue, gstAmount } = splitInclusiveGst(45_900, 18);
    expect(taxableValue).toBe(38_898);
    expect(gstAmount).toBe(7_002);
    expect(taxableValue + gstAmount).toBe(45_900);
  });

  it('computes GST on an amount that excludes GST', () => {
    expect(gstOnExclusive(10_000, 18)).toBe(1_800);
    expect(gstOnExclusive(333, 18)).toBe(60);
  });

  it('splits GST into CGST and SGST inside the state, with the odd paisa on SGST', () => {
    expect(splitGstByPlaceOfSupply(7_003, true)).toEqual({ cgst: 3_501, sgst: 3_502, igst: 0 });
  });

  it('charges IGST on a sale to another state', () => {
    expect(splitGstByPlaceOfSupply(7_003, false)).toEqual({ cgst: 0, sgst: 0, igst: 7_003 });
  });

  it('computes GST on the whole line, not per unit', () => {
    const line = lineGst({ unitPrice: 999, quantity: 3, gstRatePercent: 18, sameState: true });
    expect(line.lineTotal).toBe(2_997);
    expect(line.taxableValue + line.gstAmount).toBe(2_997);
    expect(line.cgst + line.sgst).toBe(line.gstAmount);
  });

  it('refuses a fractional price or quantity', () => {
    expect(() =>
      lineGst({ unitPrice: 99.5, quantity: 1, gstRatePercent: 18, sameState: true }),
    ).toThrow(RangeError);
    expect(() =>
      lineGst({ unitPrice: 100, quantity: 1.5, gstRatePercent: 18, sameState: true }),
    ).toThrow(RangeError);
  });
});
