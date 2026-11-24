import { describe, expect, it } from "vitest";
import type { Bill, BillShipping } from "@/lib/api/types";
import {
  FULL_BOX_GRAMS,
  freeDeliveryCodeOf,
  isBoxFull,
  lostFreeBoxes,
  shippingMessageOf,
  shippingProgressOf,
} from "./shipping";

// The bills are written as the API answers them under the rules of the
// document (39 € of goods per free box, 25 kg per box, 6.99 € per paid box
// up to 20 € of goods and 4.99 € above): this module must not work any of
// these figures out, only choose the sentence and the length of the bar.

function shipping(overrides: Partial<BillShipping> = {}): BillShipping {
  return {
    orderValue: 1000,
    weight: { goods: 2100, packaging: 0, total: 2100, estimated: false },
    box: { maxWeight: 25000, tareWeight: 0, capacity: 25000 },
    boxes: [],
    requiredBoxes: 1,
    unlockedFreeBoxes: 0,
    freeBoxes: 0,
    paidBoxes: 1,
    freeThresholdPerBox: 3900,
    missingForNextFreeBox: 2900,
    missingForFreeDelivery: 2900,
    feePerPaidBox: 699,
    regularFee: 699,
    fee: 699,
    freeByCode: false,
    currentBox: { number: 1, weight: 2100, remaining: 22900, utilization: 8 },
    ...overrides,
  };
}

describe("shippingMessageOf", () => {
  it("says nothing when there is nothing to deliver", () => {
    expect(
      shippingMessageOf(
        shipping({ requiredBoxes: 0, paidBoxes: 0, currentBox: null }),
        null,
      ),
    ).toEqual({ kind: "none" });
  });

  it("asks for what is missing while the one box is paid (scenarios 1, 2, 9)", () => {
    expect(shippingMessageOf(shipping(), null)).toEqual({
      kind: "oneBox",
      missing: 2900,
      feePerPaidBox: 699,
    });
    expect(
      shippingMessageOf(
        shipping({
          orderValue: 2500,
          feePerPaidBox: 499,
          fee: 499,
          regularFee: 499,
          missingForNextFreeBox: 1400,
          missingForFreeDelivery: 1400,
        }),
        null,
      ),
    ).toEqual({ kind: "oneBox", missing: 1400, feePerPaidBox: 499 });
    // 39.00 € with coins worth 1.95 €: the goods are 37.05 €.
    expect(
      shippingMessageOf(
        shipping({
          orderValue: 3705,
          feePerPaidBox: 499,
          fee: 499,
          regularFee: 499,
          missingForNextFreeBox: 195,
          missingForFreeDelivery: 195,
        }),
        null,
      ),
    ).toEqual({ kind: "oneBox", missing: 195, feePerPaidBox: 499 });
  });

  it("says that the order ships free (scenarios 3 and 6)", () => {
    const one = shipping({
      orderValue: 3900,
      unlockedFreeBoxes: 1,
      freeBoxes: 1,
      paidBoxes: 0,
      missingForNextFreeBox: 3900,
      missingForFreeDelivery: 0,
      feePerPaidBox: 499,
      regularFee: 0,
      fee: 0,
    });
    expect(shippingMessageOf(one, null)).toEqual({ kind: "free", boxes: 1 });
    const two = shipping({
      orderValue: 7800,
      requiredBoxes: 2,
      unlockedFreeBoxes: 2,
      freeBoxes: 2,
      paidBoxes: 0,
      missingForNextFreeBox: 3900,
      missingForFreeDelivery: 0,
      feePerPaidBox: 499,
      regularFee: 0,
      fee: 0,
    });
    expect(shippingMessageOf(two, null)).toEqual({ kind: "free", boxes: 2 });
  });

  it("names the next box that would be free (scenarios 4, 5, 7)", () => {
    const two = (orderValue: number, missing: number) =>
      shipping({
        orderValue,
        requiredBoxes: 2,
        unlockedFreeBoxes: 1,
        freeBoxes: 1,
        paidBoxes: 1,
        missingForNextFreeBox: missing,
        missingForFreeDelivery: missing,
        feePerPaidBox: 499,
        regularFee: 499,
        fee: 499,
      });
    for (const [orderValue, missing] of [
      [3950, 3850],
      [5900, 1900],
      // 78.00 € with a 10 % code.
      [7020, 780],
    ]) {
      expect(shippingMessageOf(two(orderValue, missing), null)).toEqual({
        kind: "someFree",
        boxes: 2,
        freeBoxes: 1,
        paidBoxes: 1,
        feePerPaidBox: 499,
        missing,
        nextBox: 2,
      });
    }
  });

  it("says what the boxes cost while none is free", () => {
    expect(
      shippingMessageOf(
        shipping({
          orderValue: 3000,
          requiredBoxes: 2,
          paidBoxes: 2,
          missingForNextFreeBox: 900,
          missingForFreeDelivery: 4800,
          feePerPaidBox: 499,
          regularFee: 998,
          fee: 998,
        }),
        null,
      ),
    ).toEqual({ kind: "noneFree", boxes: 2, feePerPaidBox: 499, missing: 900 });
  });

  it("states the fee where no box is ever free by value", () => {
    expect(
      shippingMessageOf(
        shipping({
          orderValue: 5900,
          requiredBoxes: 2,
          paidBoxes: 2,
          freeThresholdPerBox: null,
          missingForNextFreeBox: null,
          missingForFreeDelivery: null,
          feePerPaidBox: 499,
          regularFee: 998,
          fee: 998,
        }),
        null,
      ),
    ).toEqual({
      kind: "noThreshold",
      fee: 998,
      paidBoxes: 2,
      feePerPaidBox: 499,
    });
  });

  it("names the free-delivery code and what it saves (scenario 8)", () => {
    const byCode = shipping({
      orderValue: 5900,
      requiredBoxes: 2,
      unlockedFreeBoxes: 1,
      freeBoxes: 2,
      paidBoxes: 0,
      missingForNextFreeBox: 1900,
      missingForFreeDelivery: 0,
      feePerPaidBox: 499,
      regularFee: 499,
      fee: 0,
      freeByCode: true,
    });
    expect(shippingMessageOf(byCode, "FREESHIP")).toEqual({
      kind: "freeByCode",
      code: "FREESHIP",
      saving: 499,
    });
    // An order that ships free anyway saves nothing with the code.
    expect(shippingMessageOf({ ...byCode, regularFee: 0 }, "FREESHIP")).toEqual(
      { kind: "freeByCode", code: "FREESHIP", saving: 0 },
    );
    // Without the name of the code the order is simply free.
    expect(shippingMessageOf(byCode, null)).toEqual({ kind: "free", boxes: 2 });
  });
});

describe("shippingProgressOf", () => {
  it("runs to the next free box", () => {
    // Scenario 1: 10.00 € of 39.00 € is 26 %.
    expect(Math.round(shippingProgressOf(shipping())! * 100)).toBe(26);
    // 59.00 € with one free box: 20.00 € into the second 39.00 €.
    expect(
      Math.round(
        shippingProgressOf(
          shipping({
            orderValue: 5900,
            requiredBoxes: 2,
            unlockedFreeBoxes: 1,
            freeBoxes: 1,
            paidBoxes: 1,
          }),
        )! * 100,
      ),
    ).toBe(51);
  });

  it("is full when no box is paid", () => {
    expect(
      shippingProgressOf(shipping({ orderValue: 3900, paidBoxes: 0 })),
    ).toBe(1);
    expect(
      shippingProgressOf(
        shipping({ orderValue: 5900, paidBoxes: 0, freeByCode: true }),
      ),
    ).toBe(1);
  });

  it("has no bar without a threshold or without boxes", () => {
    expect(
      shippingProgressOf(shipping({ freeThresholdPerBox: null })),
    ).toBeNull();
    expect(
      shippingProgressOf(shipping({ requiredBoxes: 0, paidBoxes: 0 })),
    ).toBeNull();
  });
});

describe("isBoxFull", () => {
  it("calls a box full under the room worth naming", () => {
    const box = { number: 1, weight: 24600, utilization: 98 };
    expect(isBoxFull({ ...box, remaining: FULL_BOX_GRAMS - 1 })).toBe(true);
    expect(isBoxFull({ ...box, remaining: FULL_BOX_GRAMS })).toBe(false);
    expect(isBoxFull({ ...box, remaining: 0 })).toBe(true);
  });
});

describe("freeDeliveryCodeOf", () => {
  const discount = (
    overrides: Partial<NonNullable<Bill["discount"]>>,
  ): Pick<Bill, "discount"> => ({
    discount: {
      code: "FREESHIP",
      type: "free_delivery",
      value: 0,
      amount: 0,
      applied: true,
      reason: null,
      ...overrides,
    },
  });

  it("names an applied free-delivery code only", () => {
    expect(freeDeliveryCodeOf(discount({}))).toBe("FREESHIP");
    expect(
      freeDeliveryCodeOf(discount({ applied: false, reason: "expired" })),
    ).toBeNull();
    expect(
      freeDeliveryCodeOf(discount({ code: "DIWALI10", type: "percent" })),
    ).toBeNull();
    expect(freeDeliveryCodeOf({ discount: null })).toBeNull();
  });
});

describe("lostFreeBoxes", () => {
  const bill = (paidBoxes: number | null): Pick<Bill, "shipping"> => ({
    shipping: paidBoxes === null ? null : shipping({ paidBoxes }),
  });

  it("counts the boxes a discount made paid", () => {
    // 78.00 € unlock two boxes; with 10 % off, 70.20 € unlock one.
    expect(lostFreeBoxes(bill(0), bill(1))).toBe(1);
    expect(lostFreeBoxes(bill(0), bill(2))).toBe(2);
  });

  it("is zero when nothing was lost, and under the flat fee", () => {
    expect(lostFreeBoxes(bill(1), bill(1))).toBe(0);
    expect(lostFreeBoxes(bill(2), bill(1))).toBe(0);
    expect(lostFreeBoxes(bill(null), bill(1))).toBe(0);
    expect(lostFreeBoxes(bill(0), bill(null))).toBe(0);
    expect(lostFreeBoxes(undefined, bill(1))).toBe(0);
  });
});
