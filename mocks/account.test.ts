import { describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import { invoicePdfPath } from "../src/lib/api/store-api.ts";
import { SKU } from "./data/catalogue.ts";
import { startMockApi } from "./testing.ts";

// Payments, invoices, returns and the demo account of the mock, exercised
// through the shop's API client.

const mock = startMockApi();

/**
 * A customer with an address and two bags of atta (30.97) checked out: the
 * order waits for its payment on the mock's payment page.
 */
async function pendingOrder(email = "priya@example.com") {
  const client = await mock.signIn(email);
  const { items } = await client.api.createAddress({
    firstName: "Priya",
    lastName: "Shah",
    street: "Hauptstraße",
    houseNumber: "12",
    postalCode: "60311",
    city: "Frankfurt am Main",
  });
  const bill = await client.api.setCartItem(SKU.chakkiAtta5kg, 2);
  const legal = await client.api.listLegal();
  const result = await client.api.checkout(
    {
      addressId: items[0].id,
      expectedTotal: bill.totals.total,
      consent: {
        accepted: true,
        versions: Object.fromEntries(
          legal.items.map((d) => [d.type, d.version]),
        ),
      },
    },
    "attempt-0001",
  );
  return {
    ...client,
    orderNumber: result.order.orderNumber,
    page: result.checkout.url,
  };
}

/** Pays on the mock's payment page, as the browser would. */
function payOnPage(url: string, type: "card" | "paypal" = "card") {
  return fetch(`${url}/pay?type=${type}`, { redirect: "manual" });
}

/** The same order, paid by card: confirmed. */
async function paidOrder(email?: string) {
  const pending = await pendingOrder(email);
  await payOnPage(pending.page);
  return pending;
}

/** The same order, paid and delivered. */
async function deliveredOrder(email?: string) {
  const paid = await paidOrder(email);
  await mock.control("order", {
    orderNumber: paid.orderNumber,
    actions: ["deliver"],
  });
  return paid;
}

describe("payment at checkout", () => {
  it("is paid on the payment page and confirmed at once", async () => {
    const { api, orderNumber, page } = await pendingOrder();
    const back = await payOnPage(page);
    expect(back.status).toBe(302);
    expect(back.headers.get("location")).toBe(
      `http://localhost:3001/account/orders/${orderNumber}?payment=success`,
    );

    const answer = await api.getOrderPayment(orderNumber);
    expect(answer.status).toBe("confirmed");
    expect(answer.payment).toMatchObject({
      status: "paid",
      amount: 3097,
      paidAmount: 3097,
      creditedAmount: 0,
      refundedAmount: 0,
      method: "card",
      checkout: null,
      canPayOnline: false,
      lastFailure: null,
    });
    expect(answer.payment.paidAt).not.toBeNull();
    expect(answer.payment.receiptUrl).toContain("stripe.com");
    expect(answer.payment.invoice?.number).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(answer.payment.invoice?.pdfPath).toBe(
      invoicePdfPath(answer.payment.invoice!.number),
    );
    expect(answer.documents).toHaveLength(1);
    expect(answer.documents[0]).toMatchObject({ type: "invoice", total: 3097 });
    expect(answer.documents[0].paidAt).not.toBeNull();
  });

  it("with PayPal the confirmation arrives a moment later", async () => {
    const { api, orderNumber, page } = await pendingOrder();
    const back = await payOnPage(page, "paypal");
    expect(back.headers.get("location")).toContain(
      `/account/orders/${orderNumber}?payment=success`,
    );
    // Back in the shop before Stripe's notification: still pending, the
    // page still open.
    const first = await api.getOrderPayment(orderNumber);
    expect(first.payment.status).toBe("pending");
    expect(first.payment.checkout).not.toBeNull();
    // The notification arrives (a test control stands in for the wait).
    await mock.control("payment", { orderNumber, action: "settle" });
    const settled = await api.getOrderPayment(orderNumber);
    expect(settled.status).toBe("confirmed");
    expect(settled.payment).toMatchObject({ status: "paid", method: "paypal" });
  });

  it("a page that was left gets a new one", async () => {
    const { api, orderNumber } = await pendingOrder();
    await mock.control("payment", { orderNumber, action: "expire" });
    const expired = await api.getOrderPayment(orderNumber);
    expect(expired.payment).toMatchObject({
      status: "pending",
      checkout: null,
      canPayOnline: true,
    });
    const fresh = await api.createPaymentPage(orderNumber);
    expect(fresh.url).toContain(`/__mock/stripe/${orderNumber}`);
    expect(new Date(fresh.expiresAt).getTime()).toBeGreaterThan(Date.now());
    await payOnPage(fresh.url);
    expect((await api.getOrderPayment(orderNumber)).payment.status).toBe(
      "paid",
    );
  });

  it("a failed attempt can be paid again", async () => {
    const { api, orderNumber } = await pendingOrder();
    await mock.control("payment", { orderNumber, action: "fail" });
    const failed = (await api.getOrder(orderNumber)).order;
    expect(failed).toMatchObject({
      status: "pending_payment",
      paymentStatus: "failed",
      canCancel: true,
    });
    expect(failed.payment).toMatchObject({
      status: "failed",
      checkout: null,
      canPayOnline: true,
    });
    expect(failed.payment.lastFailure).toEqual(expect.any(String));

    const fresh = await api.createPaymentPage(orderNumber);
    expect((await api.getOrder(orderNumber)).order.paymentStatus).toBe(
      "pending",
    );
    await payOnPage(fresh.url);
    expect((await api.getOrder(orderNumber)).order).toMatchObject({
      status: "confirmed",
      paymentStatus: "paid",
    });
  });

  it("a product that sold out meanwhile cancels the order and charges nothing", async () => {
    const { api, orderNumber, page } = await pendingOrder();
    await mock.control("stock", { productId: SKU.chakkiAtta5kg, quantity: 1 });
    const back = await payOnPage(page);
    expect(back.headers.get("location")).toContain("?payment=success");

    const { order } = await api.getOrder(orderNumber);
    expect(order).toMatchObject({
      status: "cancelled",
      paymentStatus: "failed",
      canCancel: false,
    });
    expect(order.cancellation).toMatchObject({
      reason: "sold_out",
      by: "system",
    });
    expect(order.payment).toMatchObject({
      paidAmount: 0,
      canPayOnline: false,
      invoice: null,
    });
    const again = await api.createPaymentPage(orderNumber).catch((e) => e);
    expect(hasErrorCode(again, "ORDER_NOT_PAYABLE")).toBe(true);
    // The one unit that was left is still there, and the cart was kept.
    expect(
      (await api.getProduct("chakki-atta-5-kg")).product.ordering?.remaining,
    ).toBe(1);
    expect((await api.getCart()).lines).toHaveLength(1);
  });

  it("offers no online payment while it is not set up", async () => {
    const { api, orderNumber } = await pendingOrder();
    await mock.control("stripe", { enabled: false });
    const { payment } = await api.getOrderPayment(orderNumber);
    expect(payment.canPayOnline).toBe(false);
    const error = await api.createPaymentPage(orderNumber).catch((e) => e);
    expect(hasErrorCode(error, "ORDER_NOT_PAYABLE")).toBe(true);
  });

  it("is moved along by Radhe Foods once it is paid", async () => {
    const { api, orderNumber } = await paidOrder();
    await mock.control("order", { orderNumber, actions: ["process"] });
    expect((await api.getOrder(orderNumber)).order).toMatchObject({
      status: "processing",
      canCancel: true,
    });
    await mock.control("order", {
      orderNumber,
      actions: ["dispatch"],
      method: "dhl",
    });
    const dispatched = (await api.getOrder(orderNumber)).order;
    expect(dispatched).toMatchObject({
      status: "dispatched",
      canCancel: false,
    });
    expect(dispatched.delivery.trackingUrl).toContain("dhl.de");
    await mock.control("order", { orderNumber, actions: ["deliver"] });
    const delivered = (await api.getOrder(orderNumber)).order;
    expect(delivered.status).toBe("delivered");
    expect(delivered.returns.possible).toBe(true);
  });
});

describe("invoices", () => {
  it("lists own documents and serves the PDF only with the session", async () => {
    const { api, transport } = await paidOrder();
    const list = await api.listInvoices();
    expect(list.items).toHaveLength(1);
    const number = list.items[0].number;
    const { invoice } = await api.getInvoice(number.toLowerCase());
    expect(invoice.lines[0]).toMatchObject({
      description: "Chakki Atta, 5 kg",
      quantity: 2,
      lineTotal: 2598,
    });
    expect(invoice.totals.total).toBe(3097);
    expect(invoice.paidAt).toBe(invoice.issuedAt);

    const pdf = await transport.raw(invoicePdfPath(number));
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    const bytes = Buffer.from(await pdf.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");

    const stranger = await mock.signIn("someone@example.com");
    const error = await stranger.api.getInvoice(number).catch((e) => e);
    expect(hasErrorCode(error, "INVOICE_NOT_FOUND")).toBe(true);
    const anonymous = await fetch(`${mock.base()}${invoicePdfPath(number)}`);
    expect(anonymous.status).toBe(401);
  });
});

describe("returns", () => {
  it("asks to send units back, within what was delivered", async () => {
    const { api, orderNumber } = await deliveredOrder();
    const before = await api.getOrder(orderNumber);
    expect(before.order.returns.possible).toBe(true);
    expect(before.order.returns.until).not.toBeNull();

    const tooMany = await api
      .createReturn(orderNumber, {
        items: [
          { productId: SKU.chakkiAtta5kg, quantity: 3, reason: "damaged" },
        ],
      })
      .catch((e) => e);
    expect(hasErrorCode(tooMany, "RETURN_QUANTITY_INVALID")).toBe(true);
    if (hasErrorCode(tooMany, "RETURN_QUANTITY_INVALID")) {
      expect(tooMany.details.available).toBe(2);
    }

    const created = await api.createReturn(orderNumber, {
      items: [
        {
          productId: SKU.chakkiAtta5kg,
          quantity: 1,
          reason: "damaged",
          comment: "Bag was torn",
        },
      ],
      comment: "Please pick up on Monday.",
      locale: "en",
    });
    expect(created.return).toMatchObject({
      returnNumber: `${orderNumber}-R1`,
      status: "requested",
      canCancel: true,
      creditAmount: null,
    });
    const state = await api.getOrderReturns(orderNumber);
    expect(state.items).toHaveLength(1);
    expect(state.returnable).toEqual([
      expect.objectContaining({ productId: SKU.chakkiAtta5kg, available: 1 }),
    ]);
  });

  it("can be withdrawn until Radhe Foods decided", async () => {
    const { api, orderNumber } = await deliveredOrder();
    const item = {
      productId: SKU.chakkiAtta5kg,
      quantity: 1,
      reason: "changed_mind" as const,
    };
    const first = await api.createReturn(orderNumber, { items: [item] });
    const cancelled = await api.cancelReturn(first.return.returnNumber);
    expect(cancelled.return.status).toBe("cancelled");

    const second = await api.createReturn(orderNumber, { items: [item] });
    await mock.control("return", {
      returnNumber: second.return.returnNumber,
      action: "approve",
    });
    const error = await api
      .cancelReturn(second.return.returnNumber)
      .catch((e) => e);
    expect(hasErrorCode(error, "RETURN_TRANSITION_NOT_ALLOWED")).toBe(true);
  });

  it("a completed return lowers the bill and issues a credit note", async () => {
    const { api, orderNumber } = await deliveredOrder();
    const { return: request } = await api.createReturn(orderNumber, {
      items: [{ productId: SKU.chakkiAtta5kg, quantity: 1, reason: "quality" }],
    });
    await mock.control("return", {
      returnNumber: request.returnNumber,
      action: "complete",
    });

    const done = await api.getReturn(request.returnNumber);
    expect(done.return).toMatchObject({
      status: "completed",
      creditAmount: 1299,
    });
    const { order } = await api.getOrder(orderNumber);
    expect(order.total).toBe(3097);
    expect(order.finalTotal).toBe(1798);
    expect(order.items[0]).toMatchObject({
      returnedQuantity: 1,
      finalLineTotal: 1299,
    });
    expect(order.payment).toMatchObject({
      status: "paid",
      paidAmount: 3097,
      creditedAmount: 1299,
    });
    const documents = await api.listInvoices({ orderNumber });
    expect(documents.items.map((d) => d.type)).toEqual([
      "credit_note",
      "invoice",
    ]);
    expect(documents.items[0]).toMatchObject({
      creditReason: "return",
      total: 1299,
    });
    const { invoice: credit } = await api.getInvoice(documents.items[0].number);
    expect(credit.creditReference).toBe(request.returnNumber);
  });

  it("is not possible before delivery", async () => {
    const { api } = await mock.signIn("demo@radhefoods.de");
    const { items } = await api.listOrders();
    const confirmed = items.find((order) => order.status === "confirmed")!;
    const error = await api
      .createReturn(confirmed.orderNumber, {
        items: [{ productId: SKU.basmati5kg, quantity: 1, reason: "other" }],
      })
      .catch((e) => e);
    expect(hasErrorCode(error, "RETURN_NOT_POSSIBLE")).toBe(true);
  });
});

describe("the demo account", () => {
  it("comes with orders in the states a customer meets", async () => {
    const { api, customer } = await mock.signIn("demo@radhefoods.de");
    expect(customer.firstName).toBe("Priya");
    const { items } = await api.listOrders();
    expect(items.map((order) => [order.status, order.paymentStatus])).toEqual([
      ["cancelled", "failed"],
      ["confirmed", "paid"],
      ["cancelled", "refunded"],
      ["dispatched", "paid"],
      ["pending_payment", "pending"],
      ["delivered", "paid"],
    ]);
    const soldOut = (await api.getOrder(items[0].orderNumber)).order;
    expect(soldOut.cancellation).toMatchObject({
      reason: "sold_out",
      by: "system",
    });
    expect(soldOut.payment.paidAmount).toBe(0);
    const onItsWay = items[3];
    expect(onItsWay.delivery).toMatchObject({ method: "dhl" });
    expect(onItsWay.delivery.trackingUrl).toContain("dhl.de");
    const pending = (await api.getOrder(items[4].orderNumber)).order;
    expect(pending.payment.checkout).not.toBeNull();
    expect(pending.payment.canPayOnline).toBe(true);
    const paid = await api.getOrderReturns(items[5].orderNumber);
    expect(paid.items[0].status).toBe("requested");
    // The demo orders leave the demo customer with an empty cart.
    expect((await api.getCart()).lines).toHaveLength(0);
  });
});
