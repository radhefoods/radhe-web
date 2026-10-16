import { describe, expect, it } from "vitest";
import type { Ordering } from "@/lib/api/types";
import { cappedByLimit, fewLeft, orderingReason } from "./availability";

const ordering = (partial: Partial<Ordering>): Ordering => ({
  canOrder: true,
  reason: null,
  minQuantity: 1,
  maxQuantity: 37,
  remaining: 37,
  ...partial,
});

describe("availability", () => {
  it("names the reason only when the product cannot be ordered", () => {
    expect(orderingReason(null)).toBeNull();
    expect(orderingReason(ordering({}))).toBeNull();
    expect(
      orderingReason(
        ordering({ canOrder: false, reason: "sold_out", remaining: 0 }),
      ),
    ).toBe("sold_out");
    expect(
      orderingReason(
        ordering({ canOrder: false, reason: "product_unavailable" }),
      ),
    ).toBe("product_unavailable");
  });

  it("says how many are left only when they are few", () => {
    expect(fewLeft(ordering({ remaining: 37 }))).toBeNull();
    expect(fewLeft(ordering({ remaining: 10, maxQuantity: 10 }))).toBe(10);
    expect(fewLeft(ordering({ remaining: 3, maxQuantity: 3 }))).toBe(3);
    expect(
      fewLeft(
        ordering({
          canOrder: false,
          reason: "sold_out",
          remaining: 0,
          maxQuantity: 0,
        }),
      ),
    ).toBeNull();
    expect(fewLeft(null)).toBeNull();
  });

  it("tells a limit per order from the stock", () => {
    expect(cappedByLimit(ordering({ maxQuantity: 12, remaining: 37 }))).toBe(
      true,
    );
    expect(cappedByLimit(ordering({ maxQuantity: 37, remaining: 37 }))).toBe(
      false,
    );
  });
});
