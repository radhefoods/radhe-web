import { describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import type { AddressInput, CheckoutInput } from "../src/lib/api/types.ts";
import { SKU } from "./data/catalogue.ts";
import { startMockApi } from "./testing.ts";

// Addresses, checkout and orders of the mock, exercised through the shop's
// API client.

const mock = startMockApi();

const home: AddressInput = {
  firstName: "Priya",
  lastName: "Shah",
  street: "Hauptstraße",
  houseNumber: "12",
  postalCode: "60311",
  city: "Frankfurt am Main",
};

/** A customer with an address and two bags of atta in the cart (30.97 in total). */
async function readyToOrder(email = "priya@example.com") {
  const client = await mock.signIn(email);
  const { items } = await client.api.createAddress(home);
  const bill = await client.api.setCartItem(SKU.chakkiAtta5kg, 2);
  const legal = await client.api.listLegal();
  const input: CheckoutInput = {
    addressId: items[0].id,
    expectedTotal: bill.totals.total,
    consent: {
      accepted: true,
      versions: Object.fromEntries(legal.items.map((d) => [d.type, d.version])),
    },
  };
  return { ...client, input, bill };
}

/** Pays on the mock's payment page, as the browser would. */
function payOnPage(url: string, type: "card" | "paypal" = "card") {
  return fetch(`${url}/pay?type=${type}`, { redirect: "manual" });
}

describe("addresses", () => {
  it("makes the first address the default and keeps one default", async () => {
    const { api } = await mock.signIn("anna@example.com");
    const first = await api.createAddress(home);
    expect(first.items).toHaveLength(1);
    expect(first.items[0]).toMatchObject({
      isDefault: true,
      countryCode: "DE",
      company: null,
    });
    const second = await api.createAddress({
      ...home,
      street: "Nebenweg",
      company: "Shah GmbH",
      isDefault: true,
    });
    expect(second.items.map((a) => a.isDefault)).toEqual([false, true]);
    const back = await api.setDefaultAddress(second.items[0].id);
    expect(back.items.map((a) => a.isDefault)).toEqual([true, false]);
  });

  it("changes single fields and clears optional ones with null", async () => {
    const { api } = await mock.signIn("anna@example.com");
    const { items } = await api.createAddress({
      ...home,
      company: "Shah GmbH",
    });
    const changed = await api.updateAddress(items[0].id, {
      city: "Berlin",
      postalCode: "10115",
      company: null,
    });
    expect(changed.items[0]).toMatchObject({
      city: "Berlin",
      postalCode: "10115",
      company: null,
      street: "Hauptstraße",
    });
  });

  it("gives the default to the first remaining address on delete", async () => {
    const { api } = await mock.signIn("anna@example.com");
    await api.createAddress(home);
    const two = await api.createAddress({ ...home, street: "Nebenweg" });
    const left = await api.deleteAddress(two.items[0].id);
    expect(left.items).toHaveLength(1);
    expect(left.items[0].isDefault).toBe(true);
  });

  it("validates like the API and names the field", async () => {
    const { api } = await mock.signIn("anna@example.com");
    const error = await api
      .createAddress({ ...home, postalCode: "6031" })
      .catch((e) => e);
    expect(hasErrorCode(error, "VALIDATION_FAILED")).toBe(true);
    if (hasErrorCode(error, "VALIDATION_FAILED")) {
      expect(error.details[0].field).toBe("postalCode");
    }
    const missing = await api
      .updateAddress("66e100000000000000000099", { city: "Köln" })
      .catch((e) => e);
    expect(hasErrorCode(missing, "ADDRESS_NOT_FOUND")).toBe(true);
  });

  it("stops at ten addresses", async () => {
    const { api } = await mock.signIn("anna@example.com");
    for (let i = 0; i < 10; i += 1) {
      await api.createAddress({ ...home, houseNumber: String(i + 1) });
    }
    const error = await api.createAddress(home).catch((e) => e);
    expect(hasErrorCode(error, "ADDRESS_LIMIT_REACHED")).toBe(true);
  });
});

describe("checkout", () => {
  it("turns the cart into an order that waits for its payment", async () => {
    const { api, input } = await readyToOrder();
    const result = await api.checkout(input, "attempt-0001");
    expect(result.created).toBe(true);
    const { order } = result;
    expect(order.orderNumber).toBe("RF-1085");
    expect(order).toMatchObject({
      status: "pending_payment",
      paymentStatus: "pending",
      total: 3097,
      itemCount: 2,
      canCancel: true,
    });
    expect(order.payment).toMatchObject({
      status: "pending",
      amount: 3097,
      paidAmount: 0,
      invoice: null,
      canPayOnline: true,
      lastFailure: null,
    });
    expect(result.checkout.url).toContain("/__mock/stripe/RF-1085");
    expect(order.payment.checkout).toEqual(result.checkout);
    expect(order.items[0]).toMatchObject({
      name: "Chakki Atta",
      quantity: 2,
      unitPrice: 1299,
      lineTotal: 2598,
    });
    // Optional address fields are absent on the order, not null.
    expect(order.deliveryAddress).not.toHaveProperty("company");
    expect(order.acceptedTerms.documents).toEqual([
      { type: "terms", version: 3 },
      { type: "privacy", version: 2 },
    ]);
    // Nothing is reserved and the cart is kept until the payment goes through.
    const cart = await api.getCart();
    expect(cart.lines).toHaveLength(1);
    const product = await api.getProduct("chakki-atta-5-kg");
    expect(product.product.ordering?.remaining).toBe(120);
  });

  it("answers the first order and its page when the same key is sent again", async () => {
    const { api, input } = await readyToOrder();
    const first = await api.checkout(input, "attempt-0001");
    const again = await api.checkout(input, "attempt-0001");
    expect(again.created).toBe(false);
    expect(again.order.orderNumber).toBe(first.order.orderNumber);
    expect(again.checkout.url).toBe(first.checkout.url);
    const { items } = await api.listOrders();
    expect(items).toHaveLength(1);
  });

  it("needs an idempotency key", async () => {
    const { api, input } = await readyToOrder();
    const error = await api.checkout(input, "short").catch((e) => e);
    expect(hasErrorCode(error, "IDEMPOTENCY_KEY_REQUIRED")).toBe(true);
  });

  it("refuses when the total is not the one the customer saw", async () => {
    const { api, input } = await readyToOrder();
    await mock.control("price", { productId: SKU.chakkiAtta5kg, price: 1399 });
    const error = await api.checkout(input, "attempt-0001").catch((e) => e);
    expect(hasErrorCode(error, "ORDER_TOTAL_CHANGED")).toBe(true);
    if (hasErrorCode(error, "ORDER_TOTAL_CHANGED")) {
      expect(error.details).toMatchObject({ expectedTotal: 3097, total: 3297 });
      expect(error.details.totals.subtotal).toBe(2798);
    }
    // Nothing was created: the same key works once the customer agrees.
    const agreed = await api.checkout(
      { ...input, expectedTotal: 3297 },
      "attempt-0001",
    );
    expect(agreed.created).toBe(true);
  });

  it("refuses when a legal text was republished meanwhile", async () => {
    const { api, input } = await readyToOrder();
    await mock.control("legal/republish", { type: "terms" });
    const error = await api.checkout(input, "attempt-0001").catch((e) => e);
    expect(hasErrorCode(error, "LEGAL_VERSION_CHANGED")).toBe(true);
    if (hasErrorCode(error, "LEGAL_VERSION_CHANGED")) {
      expect(error.details.current.terms).toBe(4);
    }
  });

  it("refuses lines that cannot be ordered and names them", async () => {
    const { api, input } = await readyToOrder();
    const bill = await api.setCartItem(SKU.kesarMango, 1);
    const error = await api
      .checkout({ ...input, expectedTotal: bill.totals.total }, "attempt-0001")
      .catch((e) => e);
    expect(hasErrorCode(error, "ORDER_ITEMS_NOT_ORDERABLE")).toBe(true);
    if (hasErrorCode(error, "ORDER_ITEMS_NOT_ORDERABLE")) {
      expect(error.details.lines).toEqual([
        expect.objectContaining({
          productId: SKU.kesarMango,
          issue: "sold_out",
          remaining: 0,
        }),
      ]);
    }
  });

  it("refuses when the address is gone, payment is not set up, or the cart is empty", async () => {
    const { api, input } = await readyToOrder();
    const gone = await api
      .checkout(
        { ...input, addressId: "66e100000000000000000099" },
        "attempt-0001",
      )
      .catch((e) => e);
    expect(hasErrorCode(gone, "ADDRESS_NOT_FOUND")).toBe(true);

    await mock.control("stripe", { enabled: false });
    const off = await api.checkout(input, "attempt-0001").catch((e) => e);
    expect(hasErrorCode(off, "PAYMENTS_NOT_CONFIGURED")).toBe(true);

    await mock.control("stripe", { enabled: true });
    await api.clearCart();
    const empty = await api.checkout(input, "attempt-0001").catch((e) => e);
    expect(hasErrorCode(empty, "CART_EMPTY")).toBe(true);
  });

  it("is paid on the payment page: the stock is taken, the invoice issued, the cart emptied", async () => {
    const { api, input } = await readyToOrder();
    // 37 bags of bhujia are in stock, at most 12 per order.
    const bill = await api.setCartItem(SKU.bhujia, 12);
    const result = await api.checkout(
      { ...input, expectedTotal: bill.totals.total },
      "attempt-0001",
    );
    const back = await payOnPage(result.checkout.url);
    expect(back.status).toBe(302);
    expect(back.headers.get("location")).toBe(
      "http://localhost:3001/account/orders/RF-1085?payment=success",
    );

    const { order } = await api.getOrder("RF-1085");
    expect(order).toMatchObject({
      status: "confirmed",
      paymentStatus: "paid",
      canCancel: true,
    });
    expect(order.payment).toMatchObject({
      status: "paid",
      paidAmount: bill.totals.total,
      method: "card",
      checkout: null,
      canPayOnline: false,
    });
    expect(order.payment.invoice?.number).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(
      (await api.getProduct("aloo-bhujia-400-g")).product.ordering,
    ).toMatchObject({ remaining: 25, maxQuantity: 12 });
    expect((await api.getCart()).lines).toHaveLength(0);

    // The key of a paid order opens no new page.
    const again = await api
      .checkout({ ...input, expectedTotal: bill.totals.total }, "attempt-0001")
      .catch((e) => e);
    expect(hasErrorCode(again, "ORDER_NOT_PAYABLE")).toBe(true);
  });
});

describe("orders of a customer", () => {
  it("lists own orders newest first and reads one", async () => {
    const { api, input } = await readyToOrder();
    await api.checkout(input, "attempt-0001");
    const bill = await api.setCartItem(SKU.toorDal1kg, 1);
    await api.checkout(
      { ...input, expectedTotal: bill.totals.total },
      "attempt-0002",
    );
    const list = await api.listOrders();
    expect(list.items.map((o) => o.orderNumber)).toEqual([
      "RF-1086",
      "RF-1085",
    ]);
    expect(list.nextCursor).toBeNull();
    const { order } = await api.getOrder("rf-1085");
    expect(order.orderNumber).toBe("RF-1085");

    const stranger = await mock.signIn("someone@example.com");
    const error = await stranger.api.getOrder("RF-1085").catch((e) => e);
    expect(hasErrorCode(error, "ORDER_NOT_FOUND")).toBe(true);
  });

  it("gives an unpaid order up: the page is closed, nothing is charged", async () => {
    const { api, input } = await readyToOrder();
    const result = await api.checkout(input, "attempt-0001");
    const { order } = await api.cancelOrder("RF-1085", {
      reason: "changed_mind",
    });
    expect(order).toMatchObject({
      status: "cancelled",
      paymentStatus: "pending",
      canCancel: false,
    });
    expect(order.payment).toMatchObject({ checkout: null, paidAmount: 0 });
    expect(order.cancellation).toMatchObject({
      reason: "changed_mind",
      by: "customer",
    });
    // The page was closed: paying on it leads back without a payment.
    const back = await payOnPage(result.checkout.url);
    expect(back.headers.get("location")).toContain("?payment=cancelled");
    expect((await api.getOrder("RF-1085")).order.paymentStatus).toBe("pending");
  });

  it("cancels a paid order and puts its units back", async () => {
    const { api, input } = await readyToOrder();
    const bill = await api.setCartItem(SKU.bhujia, 10);
    const result = await api.checkout(
      { ...input, expectedTotal: bill.totals.total },
      "attempt-0001",
    );
    await payOnPage(result.checkout.url);
    expect(
      (await api.getProduct("aloo-bhujia-400-g")).product.ordering?.remaining,
    ).toBe(27);
    const { order } = await api.cancelOrder("RF-1085", {
      reason: "ordered_by_mistake",
      text: "Wrong size.",
    });
    expect(order).toMatchObject({
      status: "cancelled",
      paymentStatus: "paid",
      canCancel: false,
    });
    expect(order.cancellation).toMatchObject({
      reason: "ordered_by_mistake",
      text: "Wrong size.",
      by: "customer",
    });
    expect(
      (await api.getProduct("aloo-bhujia-400-g")).product.ordering?.remaining,
    ).toBe(37);
  });
});
