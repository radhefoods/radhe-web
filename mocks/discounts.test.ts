import { describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import type { AddressInput, CheckoutInput } from "../src/lib/api/types.ts";
import { SKU } from "./data/catalogue.ts";
import { startMockApi } from "./testing.ts";

// Discount codes on the checkout page (doc/DISCOUNT_CODES.md 1, 3 and 5;
// CUSTOMER_WEB_API_DOCUMENTATION 9.6), exercised through the shop's API
// client against the mock.

const mock = startMockApi();

const home: AddressInput = {
  firstName: "Priya",
  lastName: "Shah",
  street: "Hauptstraße",
  houseNumber: "12",
  postalCode: "60311",
  city: "Frankfurt am Main",
};

/** A customer with an address and two bags of atta (25.98 of goods, 4.99 delivery). */
async function withAtta(email = "priya@example.com", bags = 2) {
  const client = await mock.signIn(email);
  const { items } = await client.api.createAddress(home);
  await client.api.setCartItem(SKU.chakkiAtta5kg, bags);
  const legal = await client.api.listLegal();
  const input = (expectedTotal: number): CheckoutInput => ({
    addressId: items[0].id,
    expectedTotal,
    consent: {
      accepted: true,
      versions: Object.fromEntries(legal.items.map((d) => [d.type, d.version])),
    },
  });
  return { ...client, input };
}

/** Pays on the mock's payment page, as the browser would. */
function payOnPage(url: string) {
  return fetch(`${url}/pay?type=card`, { redirect: "manual" });
}

async function reasonOf(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    if (hasErrorCode(error, "DISCOUNT_NOT_APPLICABLE")) return error.details;
    throw error;
  }
}

describe("applying a code", () => {
  it("takes a percent off the goods, not off delivery, and keeps the code with the cart", async () => {
    const { api } = await withAtta();
    // Typed in any case; stored upper case.
    const bill = await api.applyDiscount("diwali10");
    expect(bill.discount).toEqual({
      code: "DIWALI10",
      type: "percent",
      value: 10,
      amount: 260,
      applied: true,
      reason: null,
    });
    expect(bill.lines[0]).toMatchObject({
      unitPrice: 1299,
      discountAmount: 260,
      lineTotal: 2338,
    });
    expect(bill.totals).toMatchObject({
      subtotal: 2598,
      discount: 260,
      deliveryFee: 499,
      total: 2837,
    });
    // VAT is computed on what is paid.
    expect(bill.totals.vat[0].gross).toBe(2837);
    expect(bill.totals.netTotal + bill.totals.vatTotal).toBe(2837);
    // Free delivery counts what is paid for the goods.
    expect(bill.delivery.missingForFree).toBe(5000 - 2338);

    // Every cart endpoint answers the same bill from now on.
    const again = await api.getCart();
    expect(again.discount?.code).toBe("DIWALI10");
    expect(again.totals.total).toBe(2837);
    const more = await api.setCartItem(SKU.chakkiAtta5kg, 3);
    expect(more.totals).toMatchObject({ subtotal: 3897, discount: 390 });
  });

  it("caps a fixed amount at the goods it applies to, and a second code replaces the first", async () => {
    const { api } = await withAtta();
    const five = await api.applyDiscount("WELCOME5");
    expect(five.discount).toMatchObject({
      type: "fixed",
      value: 500,
      amount: 500,
    });
    expect(five.totals.total).toBe(2598 - 500 + 499);
    const ten = await api.applyDiscount("DIWALI10");
    expect(ten.discount?.code).toBe("DIWALI10");
    expect(ten.totals.discount).toBe(260);
  });

  it("spreads the amount over the eligible lines in proportion, to the cent", async () => {
    const { api } = await withAtta();
    await api.setCartItem(SKU.mangoDrink, 4);
    const bill = await api.applyDiscount("DIWALI10");
    const shares = bill.lines.map((line) => line.discountAmount);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(bill.totals.discount);
    expect(bill.totals.discount).toBe(Math.round((2598 + 4 * 249) / 10));
    expect(bill.totals.vat.map((g) => g.vatRate)).toEqual([700, 1900]);
    expect(bill.totals.vat.reduce((sum, g) => sum + g.gross, 0)).toBe(
      bill.totals.total,
    );
    expect(bill.totals.total).toBe(
      bill.totals.subtotal - bill.totals.discount + bill.totals.deliveryFee,
    );
  });

  it("leaves reduced products out when the code excludes them", async () => {
    const { api } = await withAtta();
    await api.setCartItem(SKU.basmati5kg, 1); // on sale: 19.99 instead of 24.99
    const bill = await api.applyDiscount("NOSALE15");
    expect(bill.lines.map((line) => line.discountAmount)).toEqual([
      Math.round(2598 * 0.15),
      0,
    ]);
  });

  it("refuses with the reason, and keeps nothing", async () => {
    const { api } = await withAtta();
    const cases: [string, string][] = [
      ["NOPE", "not_found"],
      ["PAUSED", "inactive"],
      ["SOON", "not_started"],
      ["OLDTIMES", "expired"],
      ["GONE", "exhausted"],
    ];
    for (const [code, reason] of cases) {
      expect(await reasonOf(api.applyDiscount(code))).toEqual({ code, reason });
    }
    await api.setCartItem(SKU.chakkiAtta5kg, 1); // 12.99: below 20 €
    expect(await reasonOf(api.applyDiscount("WELCOME5"))).toEqual({
      code: "WELCOME5",
      reason: "below_minimum",
    });
    await api.removeCartItem(SKU.chakkiAtta5kg);
    await api.setCartItem(SKU.basmati5kg, 1); // only a product on sale
    expect(await reasonOf(api.applyDiscount("NOSALE15"))).toEqual({
      code: "NOSALE15",
      reason: "nothing_eligible",
    });
    expect((await api.getCart()).discount).toBeNull();
  });

  it("removes the code and answers the bill without it", async () => {
    const { api } = await withAtta();
    await api.applyDiscount("DIWALI10");
    const bill = await api.removeDiscount();
    expect(bill.discount).toBeNull();
    expect(bill.totals).toMatchObject({ discount: 0, total: 3097 });
    expect(bill.lines[0]).toMatchObject({ discountAmount: 0, lineTotal: 2598 });
  });
});

describe("at the checkout", () => {
  it("makes the order with the code, reserves a use, counts it when paid, and the invoice shows the line", async () => {
    const { api, input } = await withAtta();
    const bill = await api.applyDiscount("DIWALI10");
    const result = await api.checkout(
      input(bill.totals.total),
      "key-discount-1",
    );
    expect(result.order.discount).toEqual({
      code: "DIWALI10",
      type: "percent",
      value: 10,
      amount: 260,
      state: "reserved",
    });
    expect(result.order.totals.discount).toBe(260);
    expect(result.order.items[0].discountAmount).toBe(260);
    expect(result.order.payment.amount).toBe(2837);

    await payOnPage(result.checkout.url);
    const { order } = await api.getOrder(result.order.orderNumber);
    expect(order.status).toBe("confirmed");
    expect(order.discount?.state).toBe("used");
    expect(order.finalTotals.discount).toBe(260);

    const documents = await api.listInvoices({
      orderNumber: order.orderNumber,
    });
    const { invoice } = await api.getInvoice(documents.items[0].number);
    expect(invoice.lines.at(-1)).toMatchObject({
      description: "Discount DIWALI10",
      quantity: 1,
      lineTotal: -260,
      vatRate: 700,
    });
    expect(invoice.totals.discount).toBe(260);
    expect(invoice.totals.total).toBe(2837);

    // The paid order let go of the code: the next cart starts without one.
    const next = await api.setCartItem(SKU.toorDal1kg, 1);
    expect(next.discount).toBeNull();
  });

  it("gives a use back when the order is given up unpaid", async () => {
    const { api, input } = await withAtta();
    const bill = await api.applyDiscount("DIWALI10");
    const result = await api.checkout(
      input(bill.totals.total),
      "key-discount-2",
    );
    const { order } = await api.cancelOrder(result.order.orderNumber, {
      reason: "changed_mind",
    });
    expect(order.discount?.state).toBe("released");
  });

  it("a code the customer already paid with once is refused the second time", async () => {
    const { api, input } = await withAtta();
    const bill = await api.applyDiscount("WELCOME5");
    const result = await api.checkout(
      input(bill.totals.total),
      "key-discount-3",
    );
    await payOnPage(result.checkout.url);
    await api.setCartItem(SKU.chakkiAtta5kg, 2);
    expect(await reasonOf(api.applyDiscount("WELCOME5"))).toEqual({
      code: "WELCOME5",
      reason: "already_used",
    });
  });

  it("refuses a code that stopped applying with 409, removes it, and the bill is plain again", async () => {
    const { api, input } = await withAtta();
    await api.applyDiscount("WELCOME5");
    // The cart shrinks below the minimum of 20 €: the code stays on the
    // bill, not applied, with its reason.
    const shrunk = await api.setCartItem(SKU.chakkiAtta5kg, 1);
    expect(shrunk.discount).toMatchObject({
      code: "WELCOME5",
      amount: 0,
      applied: false,
      reason: "below_minimum",
    });
    expect(shrunk.totals).toMatchObject({ discount: 0, total: 1299 + 499 });

    const error = await api
      .checkout(input(shrunk.totals.total), "key-discount-4")
      .catch((caught: unknown) => caught);
    expect(hasErrorCode(error, "DISCOUNT_NOT_APPLICABLE")).toBe(true);
    if (hasErrorCode(error, "DISCOUNT_NOT_APPLICABLE")) {
      expect(error.status).toBe(409);
      expect(error.details).toEqual({
        code: "WELCOME5",
        reason: "below_minimum",
      });
    }
    expect((await api.getCart()).discount).toBeNull();

    // The order goes through without the code.
    const result = await api.checkout(input(1798), "key-discount-4");
    expect(result.order.discount).toBeNull();
    expect(result.order.totals.discount).toBe(0);
  });

  it("validates the body", async () => {
    const { api } = await withAtta();
    const tooLong = await api
      .applyDiscount("X".repeat(41))
      .catch((caught: unknown) => caught);
    expect(hasErrorCode(tooLong, "VALIDATION_FAILED")).toBe(true);
    const empty = await api
      .applyDiscount("  ")
      .catch((caught: unknown) => caught);
    expect(hasErrorCode(empty, "VALIDATION_FAILED")).toBe(true);
  });
});
