import { describe, expect, it } from "vitest";
import type { BillLine, OrderItem } from "@/lib/api/types";
import { orderSavingsOf, saleSavingsOf } from "./savings";

const line = (
  unitPrice: number,
  regularPrice: number | null,
  quantity: number,
): BillLine =>
  ({
    variantId: `v${unitPrice}`,
    quantity,
    unitPrice,
    product:
      regularPrice === null
        ? null
        : { pricing: { regularPrice, price: unitPrice } },
  }) as unknown as BillLine;

const item = (partial: Partial<OrderItem>): OrderItem =>
  ({
    quantity: 1,
    unitPrice: 449,
    regularUnitPrice: null,
    finalLineTotal: 449,
    ...partial,
  }) as OrderItem;

describe("the saving of the sale prices", () => {
  it("adds (regular − paid) × units over the reduced lines of a bill", () => {
    expect(
      saleSavingsOf([
        line(219, 249, 1),
        line(449, 499, 6),
        line(1299, 1299, 2),
      ]),
    ).toBe(30 + 300);
  });

  it("is nothing for a plain cart, a gone product, or a raised price", () => {
    expect(saleSavingsOf([])).toBe(0);
    expect(saleSavingsOf([line(1299, 1299, 3)])).toBe(0);
    expect(saleSavingsOf([line(999, null, 2)])).toBe(0);
    expect(saleSavingsOf([line(999, 899, 2)])).toBe(0);
  });

  it("counts the units ordered, or those kept after returns", () => {
    const items = [
      item({
        quantity: 2,
        unitPrice: 999,
        regularUnitPrice: 1299,
        finalLineTotal: 999,
      }),
      item({
        quantity: 1,
        unitPrice: 399,
        regularUnitPrice: null,
        finalLineTotal: 0,
      }),
    ];
    expect(orderSavingsOf(items)).toBe(600);
    expect(orderSavingsOf(items, true)).toBe(300);
  });
});
