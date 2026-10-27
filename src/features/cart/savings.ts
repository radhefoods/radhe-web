import type { BillLine, OrderItem } from "@/lib/api/types";

// The summary of a bill names what the sale prices save (owner,
// 2026-10-28): the subtotal at the regular prices, then "Discount" with
// the saving. The API's `subtotal` is already at the sale prices, so the
// saving is added back for the first row and taken off again in the
// second; the discount code and the total are the API's, untouched.

/**
 * What the reduced sizes of a bill save against their regular prices:
 * `(regular − paid) × units` over the lines. `0` when nothing is reduced,
 * and for a line whose product is gone.
 */
export function saleSavingsOf(lines: readonly BillLine[]): number {
  return lines.reduce((sum, line) => {
    const regular = line.product?.pricing.regularPrice ?? line.unitPrice;
    return sum + Math.max(0, regular - line.unitPrice) * line.quantity;
  }, 0);
}

/**
 * The same over the items of an order. `final` counts the units that were
 * kept after cancellations and returns (`finalLineTotal / unitPrice`, doc
 * 9.3) instead of the units ordered.
 */
export function orderSavingsOf(
  items: readonly OrderItem[],
  final = false,
): number {
  return items.reduce((sum, item) => {
    const regular = item.regularUnitPrice ?? item.unitPrice;
    const units = final
      ? item.unitPrice > 0
        ? Math.round(item.finalLineTotal / item.unitPrice)
        : 0
      : item.quantity;
    return sum + Math.max(0, regular - item.unitPrice) * units;
  }, 0);
}
