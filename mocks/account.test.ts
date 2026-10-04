import { describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import { invoicePdfPath } from "../src/lib/api/store-api.ts";
import { SKU } from "./data/catalogue.ts";
import { startMockApi } from "./testing.ts";

// Payments, invoices, returns and the demo account of the mock, exercised
// through the shop's API client.

const mock = startMockApi();

/** A customer with one delivered order: two bags of atta, 30.97. */
async function deliveredOrder(email = "priya@example.com") {
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
  const { order } = await client.api.placeOrder(
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
  await mock.control("order", {
    orderNumber: order.orderNumber,
    actions: ["deliver"],
  });
  return { ...client, orderNumber: order.orderNumber };
}

describe("payment after delivery", () => {
  it("has nothing to pay until the invoice is issued", async () => {
    const { api, orderNumber } = await deliveredOrder();
    const { order } = await api.getOrder(orderNumber);
    expect(order.status).toBe("delivered");
    expect(order.payment).toEqual({
      status: "not_enabled",
      amountDue: 0,
      invoice: null,
      deadline: null,
      paidAt: null,
      method: null,
      canPayOnline: false,
    });
    const error = await api.createOrderCheckout(orderNumber).catch((e) => e);
    expect(hasErrorCode(error, "PAYMENT_NOT_ACTIVATED")).toBe(true);
  });

  it("issues an invoice with a deadline and offers online and cash", async () => {
    const { api, orderNumber } = await deliveredOrder();
    await mock.control("order", { orderNumber, actions: ["activate"] });
    const { payment, documents } = await api.getOrderPayment(orderNumber);
    expect(payment).toMatchObject({
      status: "due",
      amountDue: 3097,
      invoicedAmount: 3097,
      isOverdue: false,
      canPayOnline: true,
      cashPossible: true,
    });
    expect(payment.invoice?.number).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(payment.invoice?.pdfPath).toBe(
      invoicePdfPath(payment.invoice!.number),
    );
    expect(new Date(payment.deadline!).getTime()).toBeGreaterThan(Date.now());
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({ type: "invoice", total: 3097 });
  });

  it("is paid on the payment page and says how", async () => {
    const { api, orderNumber } = await deliveredOrder();
    await mock.control("order", { orderNumber, actions: ["activate"] });
    const session = await api.createOrderCheckout(orderNumber);
    expect(session.url).toContain(`/__mock/stripe/${orderNumber}`);

    const back = await fetch(`${session.url}/pay?type=paypal`, {
      redirect: "manual",
    });
    expect(back.status).toBe(302);
    expect(back.headers.get("location")).toBe(
      `http://localhost:3001/account/orders/${orderNumber}?payment=success`,
    );

    const { payment } = await api.getOrderPayment(orderNumber);
    expect(payment).toMatchObject({
      status: "paid",
      amountDue: 0,
      method: "stripe",
      paymentType: "paypal",
      canPayOnline: false,
    });
    const again = await api.createOrderCheckout(orderNumber).catch((e) => e);
    expect(hasErrorCode(again, "PAYMENT_NOT_POSSIBLE")).toBe(true);
  });

  it("offers no online payment while it is not set up", async () => {
    const { api, orderNumber } = await deliveredOrder();
    await mock.control("order", { orderNumber, actions: ["activate"] });
    await mock.control("stripe", { enabled: false });
    const { payment } = await api.getOrderPayment(orderNumber);
    expect(payment.canPayOnline).toBe(false);
    expect(payment.cashPossible).toBe(true);
    const error = await api.createOrderCheckout(orderNumber).catch((e) => e);
    expect(hasErrorCode(error, "PAYMENTS_NOT_CONFIGURED")).toBe(true);
  });

  it("an overdue payment stops new orders until it is paid", async () => {
    const { api, orderNumber } = await deliveredOrder();
    await mock.control("order", {
      orderNumber,
      actions: ["activate", "overdue"],
    });
    const { order } = await api.getOrder(orderNumber);
    expect(order.paymentStatus).toBe("overdue");
    expect(order.payment.isOverdue).toBe(true);
    const blocked = await api.getOrderingPermission();
    expect(blocked).toMatchObject({
      canOrder: false,
      reason: "payment_overdue",
    });
    expect(blocked.overdue[0]).toMatchObject({ orderNumber, amountDue: 3097 });

    await mock.control("order", { orderNumber, actions: ["pay_cash"] });
    expect((await api.getOrderingPermission()).canOrder).toBe(true);
    const paid = await api.getOrder(orderNumber);
    expect(paid.order.payment).toMatchObject({
      status: "paid",
      method: "cash",
    });
  });
});

describe("invoices", () => {
  it("lists own documents and serves the PDF only with the session", async () => {
    const { api, orderNumber, transport } = await deliveredOrder();
    await mock.control("order", { orderNumber, actions: ["activate"] });
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
    await mock.control("order", { orderNumber, actions: ["activate"] });
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
      creditedAmount: 1299,
      amountDue: 1798,
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
      ["confirmed", "not_enabled"],
      ["cancelled", "not_enabled"],
      ["dispatched", "not_enabled"],
      ["delivered", "due"],
      ["delivered", "paid"],
    ]);
    const onItsWay = items[2];
    expect(onItsWay.delivery).toMatchObject({ method: "dhl" });
    expect(onItsWay.delivery.trackingUrl).toContain("dhl.de");
    const paid = await api.getOrderReturns(items[4].orderNumber);
    expect(paid.items[0].status).toBe("requested");
    // The demo orders do not stop the demo customer from ordering.
    expect((await api.getOrderingPermission()).canOrder).toBe(true);
  });
});
