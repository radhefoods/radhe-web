import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { Ordering } from "@/lib/api/types";
import { refusalOf } from "./outcome";

const refused = (status: number, code: string, details?: unknown) =>
  new ApiError({ status, code, message: code, details });

const IN_STOCK: Ordering = {
  canOrder: true,
  reason: null,
  minQuantity: 1,
  maxQuantity: 6,
  remaining: 6,
};

describe("what a refusal of the back-in-stock routes means", () => {
  it("hands over the ordering of a pack size that came back", () => {
    expect(
      refusalOf(
        refused(409, "STOCK_ALERT_NOT_NEEDED", {
          variantId: "a",
          ordering: IN_STOCK,
        }),
      ),
    ).toEqual({ kind: "back", ordering: IN_STOCK });
  });

  it("does not trust an ordering that is missing, incomplete or not orderable", () => {
    for (const details of [
      undefined,
      null,
      {},
      { ordering: null },
      { ordering: { canOrder: true } },
      { ordering: { ...IN_STOCK, canOrder: false } },
      { ordering: { ...IN_STOCK, maxQuantity: "6" } },
    ]) {
      expect(
        refusalOf(refused(409, "STOCK_ALERT_NOT_NEEDED", details)),
      ).toEqual({ kind: "back", ordering: null });
    }
  });

  it("takes the feature off the page when the shop switched it off", () => {
    expect(refusalOf(refused(409, "STOCK_ALERTS_DISABLED"))).toEqual({
      kind: "off",
    });
  });

  it("takes one control away when its pack size left the shop", () => {
    expect(refusalOf(refused(404, "PRODUCT_VARIANT_NOT_FOUND"))).toEqual({
      kind: "gone",
    });
  });

  it("leads a customer whose session ended to the visitor's form", () => {
    for (const code of [
      "AUTH_TOKEN_INVALID",
      "AUTH_REFRESH_INVALID",
      "UNAUTHENTICATED",
      "CUSTOMER_NOT_FOUND",
    ]) {
      expect(refusalOf(refused(401, code))).toEqual({ kind: "signedOut" });
    }
  });

  it("names the fields of the form the API refused", () => {
    expect(
      refusalOf(
        refused(400, "VALIDATION_FAILED", [
          { field: "email", problems: ["email must be an email"] },
          { field: "consent", problems: ["consent must be true"] },
        ]),
      ),
    ).toEqual({ kind: "fields", email: true, consent: true });
    expect(
      refusalOf(
        refused(400, "VALIDATION_FAILED", [
          { field: "consent", problems: ["consent must be true"] },
        ]),
      ),
    ).toEqual({ kind: "fields", email: false, consent: true });
  });

  it("leaves everything else as a sentence to show", () => {
    const errors = [
      refused(409, "STOCK_ALERT_LIMIT_REACHED", { maximum: 50 }),
      refused(409, "STOCK_ALERT_LIMIT_REACHED", {
        maximum: 5,
        unconfirmed: true,
      }),
      refused(403, "CUSTOMER_BLOCKED"),
      refused(429, "RATE_LIMITED"),
      refused(0, "NETWORK_ERROR"),
      // A field the form does not have: nothing to mark.
      refused(400, "VALIDATION_FAILED", [
        { field: "variantId", problems: ["variantId must be a mongodb id"] },
      ]),
      new Error("not from the API"),
    ];
    for (const error of errors) {
      expect(refusalOf(error)).toEqual({ kind: "error", error });
    }
  });
});
