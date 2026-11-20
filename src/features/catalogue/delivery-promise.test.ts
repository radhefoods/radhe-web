import { describe, expect, it } from "vitest";
import type { ShopSettings } from "@/lib/api/types";
import { deliveryPromiseOf } from "./delivery-promise";

const base: ShopSettings = {
  currency: "EUR",
  timezone: "Europe/Berlin",
  deliveryFee: {
    tiers: [
      { minOrderValue: 0, fee: 699 },
      { minOrderValue: 4900, fee: 0 },
    ],
    freeFrom: 4900,
  },
  delivery: { estimate: { en: "2 to 4 working days", de: "2 bis 4 Werktage" } },
  returns: { windowDays: 14 },
};

describe("deliveryPromiseOf", () => {
  it("promises nothing without settings", () => {
    expect(deliveryPromiseOf(null)).toEqual({
      freeFrom: null,
      boxCapacity: null,
    });
  });

  it("reads the flat fee as before, from an API with or without the boxes", () => {
    expect(deliveryPromiseOf(base)).toEqual({
      freeFrom: 4900,
      boxCapacity: null,
    });
    expect(
      deliveryPromiseOf({
        ...base,
        shipping: {
          boxBased: false,
          countries: ["DE"],
          freeThresholdPerBox: null,
          maxBoxWeight: null,
          boxCapacity: null,
          feeTiers: null,
        },
      }),
    ).toEqual({ freeFrom: 4900, boxCapacity: null });
  });

  it("asks for 'per box' under the box rules, with what a box holds", () => {
    expect(
      deliveryPromiseOf({
        ...base,
        deliveryFee: {
          tiers: [
            { minOrderValue: 0, fee: 699 },
            { minOrderValue: 2001, fee: 499 },
            { minOrderValue: 3900, fee: 0 },
          ],
          freeFrom: 3900,
        },
        shipping: {
          boxBased: true,
          countries: ["DE"],
          freeThresholdPerBox: 3900,
          maxBoxWeight: 25000,
          boxCapacity: 24000,
          feeTiers: [
            { upTo: 2000, fee: 699 },
            { upTo: null, fee: 499 },
          ],
        },
      }),
    ).toEqual({ freeFrom: 3900, boxCapacity: 24000 });
  });
});
