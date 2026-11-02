/**
 * Money is integer paise (₹1 = 100) everywhere. These pure functions are the only place amounts are rounded, so a
 * total computed in two places can never differ by a paisa.
 */

export type Paise = number;

/** True for a whole, non-negative number of paise within the range JavaScript counts exactly. */
export function isPaise(value: unknown): value is Paise {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** The single rounding rule: to the nearest paisa, halves away from zero. */
export function roundToPaisa(value: number): Paise {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** `percent` % of an amount, rounded to the paisa. */
export function percentOf(amount: Paise, percent: number): Paise {
  return roundToPaisa((amount * percent) / 100);
}

/** A price after a percentage discount (B2B price = B2C price less the business's discount). */
export function applyDiscountPercent(price: Paise, discountPercent: number): Paise {
  return price - percentOf(price, discountPercent);
}

/** Splits a GST-inclusive amount into its taxable value and the GST inside it. */
export function splitInclusiveGst(
  amountInclGst: Paise,
  ratePercent: number,
): { taxableValue: Paise; gstAmount: Paise } {
  const taxableValue = roundToPaisa((amountInclGst * 100) / (100 + ratePercent));
  return { taxableValue, gstAmount: amountInclGst - taxableValue };
}

/** GST on an amount that excludes GST. */
export function gstOnExclusive(amountExclGst: Paise, ratePercent: number): Paise {
  return percentOf(amountExclGst, ratePercent);
}

export type GstSplit = { cgst: Paise; sgst: Paise; igst: Paise };

/**
 * A sale inside the seller's state is taxed as CGST + SGST (half each); across states as IGST. The SGST half takes
 * any odd paisa so the parts always add up to the GST amount exactly.
 */
export function splitGstByPlaceOfSupply(gstAmount: Paise, sameState: boolean): GstSplit {
  if (!sameState) return { cgst: 0, sgst: 0, igst: gstAmount };
  const cgst = Math.floor(gstAmount / 2);
  return { cgst, sgst: gstAmount - cgst, igst: 0 };
}

export type LineGst = GstSplit & {
  /** Unit price × quantity, GST included. */
  lineTotal: Paise;
  taxableValue: Paise;
  gstAmount: Paise;
};

/** GST for one invoice or order line whose unit price includes GST. Computed on the line, not per unit. */
export function lineGst(input: {
  unitPrice: Paise;
  quantity: number;
  gstRatePercent: number;
  sameState: boolean;
}): LineGst {
  if (!isPaise(input.unitPrice)) throw new RangeError('unitPrice must be whole paise');
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 0) {
    throw new RangeError('quantity must be a whole number');
  }
  const lineTotal = input.unitPrice * input.quantity;
  const { taxableValue, gstAmount } = splitInclusiveGst(lineTotal, input.gstRatePercent);
  return {
    lineTotal,
    taxableValue,
    gstAmount,
    ...splitGstByPlaceOfSupply(gstAmount, input.sameState),
  };
}
