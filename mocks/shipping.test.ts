import { describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import type { AddressInput, CheckoutInput } from "../src/lib/api/types.ts";
import { consentVersions } from "../src/lib/checkout/order-attempt.ts";
import { SKU } from "./data/catalogue.ts";
import { startMockApi } from "./testing.ts";

// Delivery by the box (doc/BOX_BASED_SHIPPING.md and
// doc/BOX_BASED_SHIPPING_WEB_INTEGRATION.md), exercised through the shop's
// API client against the mock: the ten scenarios of section 12 of the
// integration guide, with the rules of its section 1 (39 € of goods per
// free box, 25 kg per box, 6.99 € per paid box up to 20 € of goods and
// 4.99 € above), and the mock as it is while the rules are off.

const mock = startMockApi();

const home: AddressInput = {
  firstName: "Priya",
  lastName: "Shah",
  street: "Hauptstraße",
  houseNumber: "12",
  postalCode: "60311",
  city: "Frankfurt am Main",
};

/** The pack sizes of the scenarios: what they cost and what they weigh. */
const PACKS = {
  /** A 20 kg sack for 29.50 €. */
  sack: { variantId: SKU.chakkiAtta5kg, price: 2950, shippingWeight: 20000 },
  /** A 5.1 kg bag for 10.00 €. */
  bag: { variantId: SKU.basmati5kg, price: 1000, shippingWeight: 5100 },
  /** 1 kg for 19.00 €. */
  small: { variantId: SKU.toorDal1kg, price: 1900, shippingWeight: 1000 },
  /** 2.1 kg for 10.00 €. */
  light: { variantId: SKU.basmati1kg, price: 1000, shippingWeight: 2100 },
  /** 5.3 kg for 25.00 €. */
  medium: { variantId: SKU.turmeric1kg, price: 2500, shippingWeight: 5300 },
  /** 11.2 kg for 39.00 €. */
  full: { variantId: SKU.turmeric400g, price: 3900, shippingWeight: 11200 },
} as const;

/** The admin enters the prices and weights of the scenarios. */
async function stockThePacks() {
  for (const pack of Object.values(PACKS)) {
    await mock.control("price", {
      variantId: pack.variantId,
      price: pack.price,
    });
  }
  await mock.control("shipping", {
    weights: Object.values(PACKS).map(({ variantId, shippingWeight }) => ({
      variantId,
      shippingWeight,
    })),
  });
}

/** Box-based shipping switched on, with the scenarios' packs. */
async function boxRules(rules: Record<string, unknown> = {}) {
  await stockThePacks();
  await mock.control("shipping", { enabled: true, ...rules });
}

const items = (...packs: [keyof typeof PACKS, number][]) =>
  packs.map(([pack, quantity]) => ({
    variantId: PACKS[pack].variantId,
    quantity,
  }));

/** A visitor's cart, priced by the preview. */
const preview = (...packs: [keyof typeof PACKS, number][]) =>
  mock.guestApi().previewCart(items(...packs));

/** A customer with an address and these packs in the cart. */
async function customerWith(...packs: [keyof typeof PACKS, number][]) {
  const client = await mock.signIn("priya@example.com");
  const { items: addresses } = await client.api.createAddress(home);
  for (const { variantId, quantity } of items(...packs)) {
    await client.api.setCartItem(variantId, quantity);
  }
  const legal = await client.api.listLegal();
  const input = (expectedTotal: number): CheckoutInput => ({
    addressId: addresses[0].id,
    expectedTotal,
    consent: { accepted: true, versions: consentVersions(legal.items) },
  });
  return { ...client, input };
}

describe("switched off (scenario 10)", () => {
  it("states the flat fee in the settings, and no rule of the boxes", async () => {
    const settings = await mock.guestApi().getSettings();
    expect(settings.deliveryFee).toEqual({
      tiers: [
        { minOrderValue: 0, fee: 499 },
        { minOrderValue: 5000, fee: 0 },
      ],
      freeFrom: 5000,
    });
    expect(settings.shipping).toEqual({
      boxBased: false,
      countries: ["DE"],
      freeThresholdPerBox: null,
      maxBoxWeight: null,
      boxCapacity: null,
      feeTiers: null,
    });
  });

  it("answers the bill of before: no boxes, no weights, the flat fee", async () => {
    await stockThePacks();
    const bill = await preview(["sack", 2]);
    expect(bill.shipping).toBeNull();
    expect(bill.lines[0].weight).toBeNull();
    expect(bill.totals).toMatchObject({
      subtotal: 5900,
      deliveryFee: 0,
      total: 5900,
    });
    expect(bill.delivery).toEqual({
      fee: 0,
      freeFrom: 5000,
      missingForFree: 0,
    });
    const small = await preview(["light", 1]);
    expect(small.delivery).toEqual({
      fee: 499,
      freeFrom: 5000,
      missingForFree: 4000,
    });
    expect(small.shipping).toBeNull();
  });

  it("places an order without any record of boxes", async () => {
    const { api, input } = await customerWith(["light", 1]);
    const bill = await api.getCart();
    const { order } = await api.checkout(input(bill.totals.total), "key-off-1");
    expect(order.shipping).toBeNull();
    expect(order.items[0].unitWeight).toBeNull();
    expect(order.totals.deliveryFee).toBe(499);
  });

  it("makes the delivery free with a free-delivery code under the flat fee too", async () => {
    await stockThePacks();
    const { api } = await customerWith(["light", 1]);
    const bill = await api.applyDiscount("freeship");
    expect(bill.discount).toEqual({
      code: "FREESHIP",
      type: "free_delivery",
      value: 0,
      amount: 0,
      applied: true,
      reason: null,
    });
    // Nothing off the goods; the saving is not sent under the flat fee.
    expect(bill.totals).toMatchObject({
      subtotal: 1000,
      discount: 0,
      deliveryFee: 0,
      total: 1000,
    });
    expect(bill.shipping).toBeNull();
    expect(bill.delivery).toMatchObject({ fee: 0, missingForFree: 0 });
    const without = await api.removeDiscount();
    expect(without.totals.deliveryFee).toBe(499);
  });
});

describe("the rules of the shop", () => {
  it("states the box rules, and the same rules for an order of one box", async () => {
    await boxRules();
    const settings = await mock.guestApi().getSettings();
    expect(settings.deliveryFee).toEqual({
      tiers: [
        { minOrderValue: 0, fee: 699 },
        { minOrderValue: 2001, fee: 499 },
        { minOrderValue: 3900, fee: 0 },
      ],
      freeFrom: 3900,
    });
    expect(settings.shipping).toEqual({
      boxBased: true,
      countries: ["DE"],
      freeThresholdPerBox: 3900,
      maxBoxWeight: 25000,
      boxCapacity: 25000,
      feeTiers: [
        { upTo: 2000, fee: 699 },
        { upTo: null, fee: 499 },
      ],
    });
  });

  it("takes the box itself off what a box holds", async () => {
    await boxRules({ boxTareWeight: 1000 });
    const settings = await mock.guestApi().getSettings();
    expect(settings.shipping).toMatchObject({
      maxBoxWeight: 25000,
      boxCapacity: 24000,
    });
    const bill = await preview(["sack", 1]);
    expect(bill.shipping).toMatchObject({
      weight: { goods: 20000, packaging: 1000, total: 21000 },
      box: { maxWeight: 25000, tareWeight: 1000, capacity: 24000 },
    });
    expect(bill.shipping?.boxes[0]).toMatchObject({
      weight: 21000,
      remaining: 4000,
      utilization: 84,
    });
  });
});

describe("one box (scenarios 1 to 3)", () => {
  it("1: 10.00 €, 2.1 kg pays 6.99 € and is 29.00 € from free", async () => {
    await boxRules();
    const bill = await preview(["light", 1]);
    expect(bill.totals).toMatchObject({
      subtotal: 1000,
      deliveryFee: 699,
      total: 1699,
    });
    expect(bill.lines[0].weight).toEqual({
      unit: 2100,
      total: 2100,
      estimated: false,
    });
    expect(bill.shipping).toEqual({
      orderValue: 1000,
      weight: { goods: 2100, packaging: 0, total: 2100, estimated: false },
      box: { maxWeight: 25000, tareWeight: 0, capacity: 25000 },
      boxes: [
        {
          number: 1,
          weight: 2100,
          remaining: 22900,
          utilization: 8,
          separate: false,
          overweight: false,
          free: false,
          fee: 699,
        },
      ],
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
    });
    // What the shop read before the boxes stays right.
    expect(bill.delivery).toEqual({
      fee: 699,
      freeFrom: 3900,
      missingForFree: 2900,
    });
  });

  it("2: 25.00 €, 5.3 kg pays 4.99 € and is 14.00 € from free", async () => {
    await boxRules();
    const bill = await preview(["medium", 1]);
    expect(bill.totals).toMatchObject({ deliveryFee: 499, total: 2999 });
    expect(bill.shipping).toMatchObject({
      orderValue: 2500,
      requiredBoxes: 1,
      paidBoxes: 1,
      feePerPaidBox: 499,
      fee: 499,
      missingForNextFreeBox: 1400,
      missingForFreeDelivery: 1400,
    });
    expect(bill.shipping?.currentBox?.utilization).toBe(21);
  });

  it("3: 39.00 €, 11.2 kg ships free", async () => {
    await boxRules();
    const bill = await preview(["full", 1]);
    expect(bill.totals).toMatchObject({ deliveryFee: 0, total: 3900 });
    expect(bill.shipping).toMatchObject({
      orderValue: 3900,
      requiredBoxes: 1,
      unlockedFreeBoxes: 1,
      freeBoxes: 1,
      paidBoxes: 0,
      fee: 0,
      regularFee: 0,
      missingForFreeDelivery: 0,
    });
    expect(bill.shipping?.boxes[0]).toMatchObject({ free: true, fee: 0 });
    expect(bill.delivery).toEqual({
      fee: 0,
      freeFrom: 3900,
      missingForFree: 0,
    });
  });

  it("changes the fee at the right cent", async () => {
    await boxRules();
    const at = async (price: number) => {
      await mock.control("price", {
        variantId: PACKS.light.variantId,
        price,
      });
      return (await preview(["light", 1])).totals.deliveryFee;
    };
    expect(await at(2000)).toBe(699);
    expect(await at(2001)).toBe(499);
    expect(await at(3899)).toBe(499);
    expect(await at(3900)).toBe(0);
  });
});

describe("two boxes (scenarios 4 to 6)", () => {
  it("4: a 20 kg sack and a 5.1 kg bag need two boxes, one of them free", async () => {
    await boxRules();
    const bill = await preview(["sack", 1], ["bag", 1]);
    expect(bill.totals).toMatchObject({
      subtotal: 3950,
      deliveryFee: 499,
      total: 4449,
    });
    expect(bill.shipping).toMatchObject({
      orderValue: 3950,
      weight: { goods: 25100, total: 25100 },
      requiredBoxes: 2,
      unlockedFreeBoxes: 1,
      freeBoxes: 1,
      paidBoxes: 1,
      missingForNextFreeBox: 3850,
      missingForFreeDelivery: 3850,
      feePerPaidBox: 499,
      fee: 499,
      currentBox: {
        number: 2,
        weight: 5100,
        remaining: 19900,
        utilization: 20,
      },
    });
    // The free boxes are the first ones.
    expect(
      bill.shipping?.boxes.map(({ number, weight, free, fee }) => ({
        number,
        weight,
        free,
        fee,
      })),
    ).toEqual([
      { number: 1, weight: 20000, free: true, fee: 0 },
      { number: 2, weight: 5100, free: false, fee: 499 },
    ]);
    // The value at which this cart is free: the threshold once per box.
    expect(bill.delivery).toEqual({
      fee: 499,
      freeFrom: 7800,
      missingForFree: 3850,
    });
  });

  it("5 and 6: 59.00 € pay one box, 19.00 € more make both free, and back", async () => {
    await boxRules();
    const { api } = await customerWith(["sack", 2]);
    const five = await api.getCart();
    expect(five.totals).toMatchObject({
      subtotal: 5900,
      deliveryFee: 499,
      total: 6399,
    });
    expect(five.shipping).toMatchObject({
      orderValue: 5900,
      weight: { goods: 40000 },
      requiredBoxes: 2,
      freeBoxes: 1,
      paidBoxes: 1,
      missingForNextFreeBox: 1900,
      fee: 499,
    });

    const six = await api.setCartItem(PACKS.small.variantId, 1);
    expect(six.totals).toMatchObject({
      subtotal: 7800,
      deliveryFee: 0,
      total: 7800,
    });
    expect(six.shipping).toMatchObject({
      orderValue: 7800,
      weight: { goods: 41000 },
      requiredBoxes: 2,
      unlockedFreeBoxes: 2,
      freeBoxes: 2,
      paidBoxes: 0,
      missingForFreeDelivery: 0,
      fee: 0,
    });
    // The kilogram went into the first box, which had room for it.
    expect(six.shipping?.boxes.map((box) => box.weight)).toEqual([
      21000, 20000,
    ]);

    const back = await api.setCartItem(PACKS.small.variantId, 0);
    expect(back.totals).toMatchObject({ deliveryFee: 499, total: 6399 });
    expect(back.shipping).toMatchObject({ freeBoxes: 1, paidBoxes: 1 });
  });

  it("prices a visitor's cart like a customer's", async () => {
    await boxRules();
    const { api } = await customerWith(["sack", 2]);
    const mine = await api.getCart();
    const theirs = await preview(["sack", 2]);
    expect(theirs.shipping).toEqual(mine.shipping);
    expect(theirs.totals).toEqual(mine.totals);
  });
});

describe("codes and coins (scenarios 7 to 9)", () => {
  it("7: a 10 % code on 78.00 € costs a free box", async () => {
    await boxRules();
    const { api } = await customerWith(["sack", 2], ["small", 1]);
    expect((await api.getCart()).shipping?.paidBoxes).toBe(0);
    const bill = await api.applyDiscount("DIWALI10");
    expect(bill.totals).toMatchObject({
      subtotal: 7800,
      discount: 780,
      deliveryFee: 499,
      total: 7519,
    });
    expect(bill.shipping).toMatchObject({
      orderValue: 7020,
      requiredBoxes: 2,
      unlockedFreeBoxes: 1,
      freeBoxes: 1,
      paidBoxes: 1,
      missingForNextFreeBox: 780,
      fee: 499,
      freeByCode: false,
    });
    const without = await api.removeDiscount();
    expect(without.shipping).toMatchObject({ paidBoxes: 0, fee: 0 });
    expect(without.totals.total).toBe(7800);
  });

  it("8: a free-delivery code makes every box free and takes nothing off the goods", async () => {
    await boxRules();
    const { api } = await customerWith(["sack", 2]);
    const bill = await api.applyDiscount("FREESHIP");
    expect(bill.discount).toMatchObject({
      code: "FREESHIP",
      type: "free_delivery",
      amount: 0,
      applied: true,
    });
    expect(bill.totals).toMatchObject({
      subtotal: 5900,
      discount: 0,
      deliveryFee: 0,
      total: 5900,
    });
    expect(bill.shipping).toMatchObject({
      requiredBoxes: 2,
      unlockedFreeBoxes: 1,
      freeBoxes: 2,
      paidBoxes: 0,
      regularFee: 499,
      fee: 0,
      freeByCode: true,
      missingForFreeDelivery: 0,
    });
    expect(bill.shipping?.boxes.every((box) => box.free)).toBe(true);
    expect(bill.delivery).toMatchObject({ fee: 0, missingForFree: 0 });

    // A visitor prices the same code with the preview.
    const guest = await mock
      .guestApi()
      .previewCart(items(["sack", 2]), { discountCode: "FREESHIP" });
    expect(guest.shipping).toMatchObject({ freeByCode: true, fee: 0 });
    expect(guest.totals.total).toBe(5900);

    const without = await api.removeDiscount();
    expect(without.totals).toMatchObject({ deliveryFee: 499, total: 6399 });
  });

  it("names no saving where the order ships free anyway", async () => {
    await boxRules();
    const { api } = await customerWith(["full", 1]);
    const bill = await api.applyDiscount("FREESHIP");
    expect(bill.shipping).toMatchObject({
      freeByCode: true,
      regularFee: 0,
      fee: 0,
    });
  });

  it("9: coins worth 1.95 € on 39.00 € bring the delivery fee back", async () => {
    await boxRules();
    // 100 coins take 5 % off the goods.
    await mock.control("rewards", {
      settings: { redemption: { percentPerCoin: 0.05 } },
    });
    const { api } = await customerWith(["full", 1]);
    expect((await api.getCart()).totals.deliveryFee).toBe(0);
    const bill = await api.redeemCoins();
    expect(bill.rewards).toMatchObject({ applied: true, amount: 195 });
    expect(bill.totals).toMatchObject({
      subtotal: 3900,
      rewards: 195,
      deliveryFee: 499,
      total: 3900 - 195 + 499,
    });
    expect(bill.shipping).toMatchObject({
      orderValue: 3705,
      paidBoxes: 1,
      missingForNextFreeBox: 195,
      fee: 499,
    });
    const without = await api.removeCoins();
    expect(without.totals).toMatchObject({ deliveryFee: 0, total: 3900 });
  });
});

describe("weights and parcels", () => {
  it("estimates the weight of a pack size that has none on record, and says so", async () => {
    await mock.control("shipping", { enabled: true });
    // 5 kg of atta without a weight: 5 % for its packaging.
    const bill = await mock
      .guestApi()
      .previewCart([{ variantId: SKU.chakkiAtta5kg, quantity: 2 }]);
    expect(bill.lines[0].weight).toEqual({
      unit: 5250,
      total: 10500,
      estimated: true,
    });
    expect(bill.shipping?.weight).toEqual({
      goods: 10500,
      packaging: 0,
      total: 10500,
      estimated: true,
    });
  });

  it("never divides a pack: three packs of 13 kg need three boxes", async () => {
    await boxRules();
    await mock.control("shipping", {
      weights: [{ variantId: PACKS.small.variantId, shippingWeight: 13000 }],
    });
    const bill = await preview(["small", 3]);
    expect(bill.shipping).toMatchObject({
      weight: { goods: 39000 },
      requiredBoxes: 3,
    });
  });

  it("sends a marked pack as a parcel of its own, which counts as a box", async () => {
    await boxRules();
    await mock.control("shipping", {
      weights: [{ variantId: PACKS.sack.variantId, shipsSeparately: true }],
    });
    const bill = await preview(["sack", 1], ["bag", 1]);
    expect(bill.shipping?.requiredBoxes).toBe(2);
    // The shared box comes first, then the parcel.
    expect(
      bill.shipping?.boxes.map(({ weight, separate, remaining }) => ({
        weight,
        separate,
        remaining,
      })),
    ).toEqual([
      { weight: 5100, separate: false, remaining: 19900 },
      { weight: 20000, separate: true, remaining: 0 },
    ]);
    expect(bill.shipping?.currentBox?.number).toBe(1);
    // Every pack alone: no box that the next goods go into.
    const alone = await preview(["sack", 2]);
    expect(alone.shipping).toMatchObject({
      requiredBoxes: 2,
      currentBox: null,
    });
  });

  it("sends a pack heavier than a box as a parcel, or refuses it", async () => {
    await boxRules();
    await mock.control("shipping", {
      weights: [{ variantId: PACKS.sack.variantId, shippingWeight: 30000 }],
    });
    const parcel = await preview(["sack", 1]);
    expect(parcel.canOrder).toBe(true);
    expect(parcel.shipping?.boxes[0]).toMatchObject({
      weight: 30000,
      separate: true,
      overweight: true,
      utilization: 100,
    });

    await mock.control("shipping", { overweight: "not_orderable" });
    const refused = await preview(["sack", 1], ["light", 1]);
    expect(refused.canOrder).toBe(false);
    expect(refused.lines.map((line) => line.issue)).toEqual([
      "too_heavy",
      null,
    ]);
    // The bill, the boxes and the fee are those of the lines that can be ordered.
    expect(refused.shipping).toMatchObject({
      orderValue: 1000,
      requiredBoxes: 1,
      fee: 699,
    });
  });

  it("lists the first 50 boxes and counts them all", async () => {
    await boxRules();
    // 60 sacks of 20 kg: one per box (the stock of the mock is 120).
    const bill = await preview(["sack", 60]);
    expect(bill.shipping?.requiredBoxes).toBe(60);
    expect(bill.shipping?.boxes).toHaveLength(50);
    // 1,770.00 € of goods unlock 45 boxes; 15 are paid.
    expect(bill.shipping).toMatchObject({
      unlockedFreeBoxes: 45,
      freeBoxes: 45,
      paidBoxes: 15,
      fee: 15 * 499,
    });
  });
});

describe("the order", () => {
  it("keeps the boxes it was placed with, whatever the rules become", async () => {
    await boxRules();
    const { api, input } = await customerWith(["sack", 2]);
    const bill = await api.getCart();
    const { order } = await api.checkout(input(bill.totals.total), "key-box-1");
    expect(order.totals).toMatchObject({ deliveryFee: 499, total: 6399 });
    expect(order.shipping).toEqual({
      orderValue: 5900,
      weight: { goods: 40000, packaging: 0, total: 40000, estimated: false },
      requiredBoxes: 2,
      freeBoxes: 1,
      paidBoxes: 1,
      feePerPaidBox: 499,
      regularFee: 499,
      fee: 499,
      freeByCode: false,
      boxes: [
        {
          number: 1,
          weight: 20000,
          separate: false,
          overweight: false,
          free: true,
          fee: 0,
        },
        {
          number: 2,
          weight: 20000,
          separate: false,
          overweight: false,
          free: false,
          fee: 499,
        },
      ],
    });
    expect(order.items[0]).toMatchObject({
      unitWeight: 20000,
      weightEstimated: false,
    });

    // The admin changes the rules and the weight afterwards.
    await mock.control("shipping", {
      freeThresholdPerBox: 9900,
      maxBoxWeight: 30000,
      weights: [{ variantId: PACKS.sack.variantId, shippingWeight: 9000 }],
    });
    const later = (await api.getOrder(order.orderNumber)).order;
    expect(later.shipping).toEqual(order.shipping);
    expect(later.totals.deliveryFee).toBe(499);
  });

  it("refuses an order whose bill changed with the rules, and answers the new totals", async () => {
    await boxRules();
    const { api, input } = await customerWith(["sack", 2]);
    const seen = (await api.getCart()).totals.total;
    await mock.control("shipping", {
      feeTiers: [{ upTo: null, fee: 599 }],
    });
    const error = await api
      .checkout(input(seen), "key-box-2")
      .catch((caught: unknown) => caught);
    expect(hasErrorCode(error, "ORDER_TOTAL_CHANGED")).toBe(true);
    if (hasErrorCode(error, "ORDER_TOTAL_CHANGED")) {
      expect(error.details).toMatchObject({
        expectedTotal: 6399,
        total: 6499,
        totals: { deliveryFee: 599 },
      });
    }
  });

  it("refuses an order with a line that is too heavy", async () => {
    await boxRules({ overweight: "not_orderable" });
    await mock.control("shipping", {
      weights: [{ variantId: PACKS.sack.variantId, shippingWeight: 30000 }],
    });
    const { api, input } = await customerWith(["sack", 1], ["light", 1]);
    const bill = await api.getCart();
    expect(bill.canOrder).toBe(false);
    const error = await api
      .checkout(input(bill.totals.total), "key-box-3")
      .catch((caught: unknown) => caught);
    expect(hasErrorCode(error, "ORDER_ITEMS_NOT_ORDERABLE")).toBe(true);
    if (hasErrorCode(error, "ORDER_ITEMS_NOT_ORDERABLE")) {
      // Only the line with an issue is named.
      expect(error.details.lines).toMatchObject([
        { variantId: PACKS.sack.variantId, issue: "too_heavy" },
      ]);
    }
  });

  it("refuses an order to a country the shop does not deliver to", async () => {
    await boxRules({ countries: ["AT"] });
    const { api, input } = await customerWith(["light", 1]);
    const bill = await api.getCart();
    const error = await api
      .checkout(input(bill.totals.total), "key-box-4")
      .catch((caught: unknown) => caught);
    expect(hasErrorCode(error, "DELIVERY_COUNTRY_NOT_SERVED")).toBe(true);
    if (hasErrorCode(error, "DELIVERY_COUNTRY_NOT_SERVED")) {
      expect(error.details).toEqual({ countryCode: "DE", countries: ["AT"] });
    }
  });

  it("goes back to the flat fee when the rules are switched off again", async () => {
    await boxRules();
    expect((await preview(["light", 1])).totals.deliveryFee).toBe(699);
    await mock.control("shipping", { enabled: false });
    const bill = await preview(["light", 1]);
    expect(bill.shipping).toBeNull();
    expect(bill.totals.deliveryFee).toBe(499);
  });
});
