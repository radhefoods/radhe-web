import { describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import type { AddressInput, PlaceOrderInput } from "../src/lib/api/types.ts";
import { SKU } from "./data/catalogue.ts";
import { startMockApi } from "./testing.ts";

// Addresses and orders of the mock, exercised through the shop's API client.

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
  const input: PlaceOrderInput = {
    addressId: items[0].id,
    expectedTotal: bill.totals.total,
    consent: {
      accepted: true,
      versions: Object.fromEntries(legal.items.map((d) => [d.type, d.version])),
    },
  };
  return { ...client, input, bill };
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

describe("placing a pre-order", () => {
  it("confirms the cart, empties it and collects nothing", async () => {
    const { api, input } = await readyToOrder();
    const result = await api.placeOrder(input, "attempt-0001");
    expect(result.created).toBe(true);
    const { order } = result;
    expect(order.orderNumber).toBe("RF-1085");
    expect(order).toMatchObject({
      status: "confirmed",
      paymentStatus: "not_enabled",
      total: 3097,
      itemCount: 2,
      canCancel: true,
    });
    expect(order.payment).toMatchObject({
      status: "not_enabled",
      amountDue: 0,
      canPayOnline: false,
    });
    expect(order.items[0]).toMatchObject({
      name: "Chakki Atta",
      quantity: 2,
      unitPrice: 1299,
      lineTotal: 2598,
    });
    // Optional address fields are absent on the order, not null.
    expect(order.deliveryAddress).not.toHaveProperty("company");
    expect(order.acceptedTerms.documents).toContainEqual({
      type: "terms",
      version: 3,
    });
    const cart = await api.getCart();
    expect(cart.lines).toHaveLength(0);
  });

  it("answers the first order when the same key is sent again", async () => {
    const { api, input } = await readyToOrder();
    const first = await api.placeOrder(input, "attempt-0001");
    const again = await api.placeOrder(input, "attempt-0001");
    expect(again.created).toBe(false);
    expect(again.order.orderNumber).toBe(first.order.orderNumber);
    const { items } = await api.listOrders();
    expect(items).toHaveLength(1);
  });

  it("needs an idempotency key", async () => {
    const { api, input } = await readyToOrder();
    const error = await api.placeOrder(input, "short").catch((e) => e);
    expect(hasErrorCode(error, "IDEMPOTENCY_KEY_REQUIRED")).toBe(true);
  });

  it("refuses when the total is not the one the customer saw", async () => {
    const { api, input } = await readyToOrder();
    await mock.control("price", { productId: SKU.chakkiAtta5kg, price: 1399 });
    const error = await api.placeOrder(input, "attempt-0001").catch((e) => e);
    expect(hasErrorCode(error, "ORDER_TOTAL_CHANGED")).toBe(true);
    if (hasErrorCode(error, "ORDER_TOTAL_CHANGED")) {
      expect(error.details).toMatchObject({ expectedTotal: 3097, total: 3297 });
      expect(error.details.totals.subtotal).toBe(2798);
    }
    // Nothing was created: the same key works once the customer agrees.
    const agreed = await api.placeOrder(
      { ...input, expectedTotal: 3297 },
      "attempt-0001",
    );
    expect(agreed.created).toBe(true);
  });

  it("refuses when a legal text was republished meanwhile", async () => {
    const { api, input } = await readyToOrder();
    await mock.control("legal/republish", { type: "terms" });
    const error = await api.placeOrder(input, "attempt-0001").catch((e) => e);
    expect(hasErrorCode(error, "LEGAL_VERSION_CHANGED")).toBe(true);
    if (hasErrorCode(error, "LEGAL_VERSION_CHANGED")) {
      expect(error.details.current.terms).toBe(4);
    }
  });

  it("refuses lines that cannot be ordered and names them", async () => {
    const { api, input } = await readyToOrder();
    const bill = await api.setCartItem(SKU.kesarMango, 1);
    const error = await api
      .placeOrder(
        { ...input, expectedTotal: bill.totals.total },
        "attempt-0001",
      )
      .catch((e) => e);
    expect(hasErrorCode(error, "ORDER_ITEMS_NOT_ORDERABLE")).toBe(true);
    if (hasErrorCode(error, "ORDER_ITEMS_NOT_ORDERABLE")) {
      expect(error.details.lines).toEqual([
        expect.objectContaining({
          productId: SKU.kesarMango,
          issue: "sold_out",
        }),
      ]);
    }
  });

  it("refuses when ordering closed, the cart is empty or the address is gone", async () => {
    const { api, input } = await readyToOrder();
    const gone = await api
      .placeOrder(
        { ...input, addressId: "66e100000000000000000099" },
        "attempt-0001",
      )
      .catch((e) => e);
    expect(hasErrorCode(gone, "ADDRESS_NOT_FOUND")).toBe(true);

    await mock.control("cargo", { mode: "closed" });
    const closed = await api.placeOrder(input, "attempt-0001").catch((e) => e);
    expect(hasErrorCode(closed, "ORDERING_CLOSED")).toBe(true);

    await mock.control("cargo", { mode: "open" });
    await api.clearCart();
    const empty = await api.placeOrder(input, "attempt-0001").catch((e) => e);
    expect(hasErrorCode(empty, "CART_EMPTY")).toBe(true);
  });

  it("stops a customer with an overdue payment, and says what to pay", async () => {
    const { api, input } = await readyToOrder();
    await mock.control("customer", {
      email: "priya@example.com",
      overdue: true,
    });
    const permission = await api.getOrderingPermission();
    expect(permission).toMatchObject({
      canOrder: false,
      reason: "payment_overdue",
    });
    const error = await api.placeOrder(input, "attempt-0001").catch((e) => e);
    expect(hasErrorCode(error, "PAYMENT_OVERDUE")).toBe(true);
    if (hasErrorCode(error, "PAYMENT_OVERDUE")) {
      expect(error.details.orders[0]).toMatchObject({
        orderNumber: "RF-1001",
        amountDue: 3193,
      });
      expect(error.details.orders[0].orderUrl).toContain(
        "/account/orders/RF-1001",
      );
    }
  });

  it("reserves units, so the last ones cannot be ordered twice", async () => {
    const first = await readyToOrder("a@example.com");
    // 37 bags of bhujia are left, at most 12 per order.
    for (const key of ["attempt-a1", "attempt-a2", "attempt-a3"]) {
      await first.api.setCartItem(SKU.chakkiAtta5kg, 0);
      const bill = await first.api.setCartItem(SKU.bhujia, 12);
      await first.api.placeOrder(
        { ...first.input, expectedTotal: bill.totals.total },
        key,
      );
    }
    const second = await readyToOrder("b@example.com");
    const product = await second.api.getProduct("aloo-bhujia-400-g");
    expect(product.product.ordering).toMatchObject({
      remaining: 1,
      maxQuantity: 1,
    });
  });
});

describe("orders of a customer", () => {
  it("lists own orders newest first and reads one", async () => {
    const { api, input } = await readyToOrder();
    await api.placeOrder(input, "attempt-0001");
    const bill = await api.setCartItem(SKU.toorDal1kg, 1);
    await api.placeOrder(
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

  it("cancels a confirmed order and frees its units", async () => {
    const { api, input } = await readyToOrder();
    const bill = await api.setCartItem(SKU.bhujia, 10);
    await api.placeOrder(
      { ...input, expectedTotal: bill.totals.total },
      "attempt-0001",
    );
    expect(
      (await api.getProduct("aloo-bhujia-400-g")).product.ordering?.remaining,
    ).toBe(27);
    const { order } = await api.cancelOrder("RF-1085", {
      reason: "changed_mind",
    });
    expect(order).toMatchObject({ status: "cancelled", canCancel: false });
    expect(order.cancellation).toMatchObject({
      reason: "changed_mind",
      by: "customer",
    });
    expect(
      (await api.getProduct("aloo-bhujia-400-g")).product.ordering?.remaining,
    ).toBe(37);
  });
});
