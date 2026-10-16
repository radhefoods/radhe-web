// What happens to an order after the checkout, in the mock API: the payment
// page and its settlement (doc 10), the stock, delivery statuses, the final
// bill, invoices and credit notes (doc 11) and returns (doc 12). The real
// API hears from Stripe through webhooks and from Radhe Foods through its
// admin side; here the stand-in payment page and the test controls of
// `server.ts` do that.

import type {
  CheckoutSession,
  CursorPage,
  InvoiceDetail,
  InvoiceSummary,
  OrderPayment,
  OrderReturns,
  PaymentBlock,
  PaymentMethod,
  ReturnReason,
  ReturnRequest,
  Totals,
  VatGroup,
} from "../src/lib/api/types.ts";
import {
  HttpError,
  OBJECT_ID,
  objectBody,
  validationFailed,
} from "./errors.ts";
import {
  db,
  settings,
  type CustomerRecord,
  type Locale,
  type OrderRecord,
} from "./state.ts";
import { findProduct, packSize, vatOf } from "./views.ts";

/** Online payment "configured": off with `MOCK_STRIPE=off`. */
export const stripe = { enabled: process.env.MOCK_STRIPE !== "off" };

// --- The final bill ---------------------------------------------------------

/** Units that are charged: delivered minus returned; before delivery, as ordered. */
function keptQuantity(order: OrderRecord, index: number): number {
  const item = order.items[index];
  const delivered =
    order.delivery.deliveredAt === null
      ? item.quantity
      : item.deliveredQuantity;
  return Math.max(0, delivered - item.returnedQuantity);
}

/**
 * The bill after corrections and returns (doc 9.2): kept units at the agreed
 * prices; the agreed delivery fee stays and is 0 only when nothing was kept.
 * The fee is shared between the VAT rates by net value, like on the cart.
 */
export function finalTotalsOf(order: OrderRecord): Totals {
  const goods = new Map<number, number>();
  order.items.forEach((item, index) => {
    const total = keptQuantity(order, index) * item.unitPrice;
    if (total > 0)
      goods.set(item.vatRate, (goods.get(item.vatRate) ?? 0) + total);
  });
  const subtotal = [...goods.values()].reduce((a, b) => a + b, 0);
  const deliveryFee = subtotal === 0 ? 0 : order.totals.deliveryFee;
  const rates = [...goods.keys()].sort((a, b) => a - b);
  const nets = rates.map(
    (rate) => goods.get(rate)! - vatOf(goods.get(rate)!, rate),
  );
  const netSum = nets.reduce((a, b) => a + b, 0);
  let feeLeft = deliveryFee;
  const vat: VatGroup[] = rates.map((rate, index) => {
    const share =
      index === rates.length - 1
        ? feeLeft
        : Math.round((deliveryFee * nets[index]) / (netSum || 1));
    feeLeft -= share;
    const gross = goods.get(rate)! + share;
    const amount = vatOf(gross, rate);
    return { vatRate: rate, gross, net: gross - amount, vat: amount };
  });
  return {
    currency: "EUR",
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    netTotal: vat.reduce((sum, group) => sum + group.net, 0),
    vatTotal: vat.reduce((sum, group) => sum + group.vat, 0),
    vat,
  };
}

// --- Stock ------------------------------------------------------------------

/** Takes the units of every item off the shelf, or nothing when one is short. */
function takeStock(order: OrderRecord): boolean {
  const short = order.items.some(
    (item) => (findProduct(item.productId)?.stock ?? 0) < item.quantity,
  );
  if (short) return false;
  for (const item of order.items) {
    findProduct(item.productId)!.stock -= item.quantity;
  }
  order.payment.stockTaken = true;
  return true;
}

/** Puts the units of a cancelled order back on the shelf. */
export function releaseStock(order: OrderRecord): void {
  if (!order.payment.stockTaken) return;
  for (const item of order.items) {
    const product = findProduct(item.productId);
    if (product) product.stock += item.quantity;
  }
  order.payment.stockTaken = false;
}

// --- 10 Payments ------------------------------------------------------------

const MINUTE = 60_000;
/** A page with more than this left is handed out again instead of a new one. */
const REUSE_PAGE_MS = 5 * MINUTE;
/** PayPal in the mock: Stripe's "webhook" settles this long after the return. */
export const ASYNC_SETTLE_MS = 4_000;

function pageIsOpen(order: OrderRecord): boolean {
  const page = order.payment.checkout;
  return page !== null && Date.parse(page.expiresAt) > Date.now();
}

/** An expired page is forgotten, as the API does when it asks Stripe. */
function forgetExpiredPage(order: OrderRecord): void {
  if (order.payment.checkout && !pageIsOpen(order)) {
    order.payment.checkout = null;
  }
}

/** The payment block of an order (doc 10.1). */
export function paymentBlockOf(order: OrderRecord): PaymentBlock {
  forgetExpiredPage(order);
  const payment = order.payment;
  const page = payment.checkout;
  return {
    status: order.paymentStatus,
    amount: payment.amount,
    paidAmount: payment.paidAmount,
    creditedAmount: payment.creditedAmount,
    refundedAmount: payment.refundedAmount,
    method: payment.method,
    paidAt: payment.paidAt,
    receiptUrl: payment.receiptUrl,
    invoice:
      payment.invoiceNumber && payment.invoiceIssuedAt
        ? {
            number: payment.invoiceNumber,
            issuedAt: payment.invoiceIssuedAt,
            pdfPath: `/v1/store/invoices/${payment.invoiceNumber}/pdf`,
          }
        : null,
    checkout: page ? { url: page.url, expiresAt: page.expiresAt } : null,
    canPayOnline:
      stripe.enabled &&
      order.status === "pending_payment" &&
      (order.paymentStatus === "pending" || order.paymentStatus === "failed"),
    lastFailure: payment.lastFailure,
  };
}

function notPayable(order: OrderRecord): HttpError {
  return new HttpError(
    409,
    "ORDER_NOT_PAYABLE",
    order.paymentStatus === "paid"
      ? "This order is paid."
      : "This order can no longer be paid.",
    { status: order.status, paymentStatus: order.paymentStatus },
  );
}

/**
 * `POST …/pay`, and the page of a repeated checkout key: the open page while
 * it has more than five minutes left, else a new one. The page is served by
 * the mock itself at `mockBase`.
 */
export function paymentPage(
  order: OrderRecord,
  mockBase: string,
): CheckoutSession {
  if (order.status !== "pending_payment" || !stripe.enabled) {
    throw notPayable(order);
  }
  forgetExpiredPage(order);
  const open = order.payment.checkout;
  if (open && Date.parse(open.expiresAt) - Date.now() > REUSE_PAGE_MS) {
    return { url: open.url, expiresAt: open.expiresAt };
  }
  const expiresAt = new Date(
    Date.now() + settings.checkoutMinutes * MINUTE,
  ).toISOString();
  const url = `${mockBase}/__mock/stripe/${order.orderNumber}`;
  order.payment.checkout = { url, expiresAt, completesAt: null };
  order.payment.attempts += 1;
  // A new page after a failed attempt: the payment waits again.
  order.paymentStatus = "pending";
  order.pendingUntil = new Date(
    Date.parse(expiresAt) + 10 * MINUTE,
  ).toISOString();
  return { url, expiresAt };
}

/**
 * The bank approved the amount (architecture 7.2): the stock is taken, the
 * money captured, the invoice issued, the order confirmed, the cart emptied.
 * When an item sold out meanwhile, nothing is charged and the order is
 * cancelled with `sold_out`.
 */
export function settlePayment(order: OrderRecord, method: PaymentMethod): void {
  // An order that no longer waits lets the approval go: nothing is charged.
  if (order.status !== "pending_payment") return;
  const customer = db.customers.get(order.customerId);
  if (!customer) return;
  order.paymentStatus = "authorized";
  if (!takeStock(order)) {
    cancelSoldOut(order);
    return;
  }
  const now = new Date().toISOString();
  const invoice = documentFor(
    order,
    customer,
    "invoice",
    order.totals,
    linesOf(order, (index) => order.items[index].quantity),
    { issuedAt: now, paidAt: now },
  );
  order.payment = {
    ...order.payment,
    paidAmount: order.payment.amount,
    paidAt: now,
    method,
    receiptUrl: `https://pay.stripe.com/receipts/mock/${order.orderNumber}`,
    invoiceNumber: invoice.number,
    invoiceIssuedAt: invoice.issuedAt,
    checkout: null,
    lastFailure: null,
  };
  order.paymentStatus = "paid";
  order.status = "confirmed";
  order.pendingUntil = null;
  customer.cart = [];
}

/** A product sold out before the payment was captured: nothing is charged. */
export function cancelSoldOut(order: OrderRecord): void {
  releaseStock(order);
  order.paymentStatus = "failed";
  order.payment.lastFailure =
    "A product sold out before the payment was captured.";
  order.payment.checkout = null;
  order.status = "cancelled";
  order.cancellation = {
    reason: "sold_out",
    text: null,
    by: "system",
    at: new Date().toISOString(),
  };
  order.pendingUntil = null;
}

/** The bank declined, or the amount did not match: the attempt failed. */
export function failPayment(
  order: OrderRecord,
  reason = "Stripe: the payment failed",
): void {
  if (order.status !== "pending_payment") return;
  order.paymentStatus = "failed";
  order.payment.lastFailure = reason;
  order.payment.checkout = null;
}

/** The payment page expired without a payment. */
export function expirePaymentPage(order: OrderRecord): void {
  order.payment.checkout = null;
}

/** The customer paid with PayPal: Stripe tells a moment later (the webhook). */
export function settleLater(order: OrderRecord): void {
  if (order.payment.checkout) {
    order.payment.checkout.completesAt = new Date(
      Date.now() + ASYNC_SETTLE_MS,
    ).toISOString();
  }
}

/** Radhe Foods refunded everything that was paid (a cancelled paid order). */
export function refundOrder(order: OrderRecord): void {
  if (order.payment.paidAmount === 0) return;
  order.payment.refundedAmount = order.payment.paidAmount;
  order.paymentStatus = "refunded";
}

/** What asking Stripe finds: a completed page is settled, an expired one forgotten. */
function askStripe(order: OrderRecord): void {
  const page = order.payment.checkout;
  if (page?.completesAt && Date.parse(page.completesAt) <= Date.now()) {
    settlePayment(order, "paypal");
  }
  forgetExpiredPage(order);
}

/** `GET /v1/store/orders/{orderNumber}/payment` */
export function orderPayment(
  customer: CustomerRecord,
  order: OrderRecord,
): OrderPayment {
  askStripe(order);
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    payment: paymentBlockOf(order),
    documents: documentsOf(customer, order.orderNumber)
      .map(summaryOf)
      .reverse(),
  };
}

// --- 11 Invoices ------------------------------------------------------------

const SELLER: InvoiceDetail["seller"] = {
  name: "Radhe Foods (mock)",
  addressLines: ["Musterstraße 1", "60311 Frankfurt am Main"],
  email: "billing@radhefoods.de",
  phone: null,
  website: null,
  vatId: "DE000000000",
  taxNumber: null,
  registration: null,
};

function documentFor(
  order: OrderRecord,
  customer: CustomerRecord,
  type: "invoice" | "credit_note",
  totals: Totals,
  lines: InvoiceDetail["lines"],
  extra: Partial<InvoiceDetail>,
): InvoiceDetail {
  const year = new Date().getUTCFullYear();
  const sequence =
    type === "invoice" ? (db.invoiceSequence += 1) : (db.creditSequence += 1);
  const number = `${type === "invoice" ? "INV" : "CN"}-${year}-${String(sequence).padStart(6, "0")}`;
  const address = order.deliveryAddress;
  const document: InvoiceDetail = {
    id: `66f1c${sequence.toString(16).padStart(19, "0")}`,
    number,
    type,
    orderNumber: order.orderNumber,
    issuedAt: new Date().toISOString(),
    paidAt: null,
    total: totals.total,
    currency: "EUR",
    language: order.language,
    invoiceNumber: null,
    creditReason: null,
    orderId: "66f100000000000000000001",
    customerId: customer.id,
    creditReference: null,
    seller: SELLER,
    customer: {
      name: `${address.firstName} ${address.lastName}`,
      company: address.company ?? null,
      addressLines: [
        `${address.street} ${address.houseNumber}`,
        `${address.postalCode} ${address.city}`,
        "Deutschland",
      ],
      email: customer.email,
    },
    lines,
    totals,
    footer: null,
    ...extra,
  };
  db.invoices.set(number, document);
  return document;
}

function linesOf(order: OrderRecord, quantityOf: (index: number) => number) {
  return order.items
    .map((item, index) => {
      const product = findProduct(item.productId);
      const quantity = quantityOf(index);
      const size = product ? packSize(product, order.language).label : "";
      return {
        description: `${item.name[order.language] || item.name.en}${size ? `, ${size}` : ""}`,
        sku: item.sku,
        quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        vatPercent: item.vatRate / 100,
        lineTotal: quantity * item.unitPrice,
      };
    })
    .filter((line) => line.quantity > 0);
}

function summaryOf(document: InvoiceDetail): InvoiceSummary {
  return {
    id: document.id,
    number: document.number,
    type: document.type,
    orderNumber: document.orderNumber,
    issuedAt: document.issuedAt,
    paidAt: document.paidAt,
    total: document.total,
    currency: "EUR",
    language: document.language,
    invoiceNumber: document.invoiceNumber,
    creditReason: document.creditReason,
  };
}

function documentsOf(customer: CustomerRecord, orderNumber?: string) {
  // Newest first.
  return [...db.invoices.values()]
    .filter(
      (d) =>
        d.customerId === customer.id &&
        (!orderNumber || d.orderNumber === orderNumber.toUpperCase()),
    )
    .reverse();
}

export function listInvoices(
  customer: CustomerRecord,
  orderNumber: string | undefined,
  limit: number,
  cursor: string | undefined,
): CursorPage<InvoiceSummary> {
  const all = documentsOf(customer, orderNumber);
  const start = cursor ? all.findIndex((d) => d.id === cursor) + 1 : 0;
  const page = all.slice(start, start + limit);
  return {
    items: page.map(summaryOf),
    nextCursor: start + limit < all.length ? page[page.length - 1].id : null,
  };
}

export function findInvoice(
  customer: CustomerRecord,
  number: string,
): InvoiceDetail {
  const document = db.invoices.get(number.toUpperCase());
  if (!document || document.customerId !== customer.id) {
    throw new HttpError(
      404,
      "INVOICE_NOT_FOUND",
      "This document does not exist.",
    );
  }
  return document;
}

/** A one-page PDF with the lines of the document, written by hand. */
export function invoicePdf(document: InvoiceDetail): Buffer {
  const money = (cents: number) => `${(cents / 100).toFixed(2)} EUR`;
  const ascii = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ß/g, "ss")
      .replace(/[^\x20-\x7e]/g, "?")
      .replace(/([\\()])/g, "\\$1");
  const lines = [
    `${document.type === "invoice" ? "Invoice" : "Credit note"} ${document.number}`,
    `Order ${document.orderNumber}`,
    `Issued ${document.issuedAt.slice(0, 10)}`,
    "",
    document.seller.name,
    ...document.seller.addressLines,
    "",
    document.customer.name,
    ...document.customer.addressLines,
    "",
    ...document.lines.map(
      (line) =>
        `${line.quantity} x ${line.description}   ${money(line.lineTotal)}`,
    ),
    "",
    `Delivery   ${money(document.totals.deliveryFee)}`,
    `Total   ${money(document.totals.total)}`,
    `VAT included   ${money(document.totals.vatTotal)}`,
    "",
    "Mock document of the mock API. Not a real invoice.",
  ];
  const content = [
    "BT",
    "/F1 11 Tf",
    "50 790 Td",
    "15 TL",
    ...lines.map((line) => `(${ascii(line)}) Tj T*`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

// --- 12 Returns -------------------------------------------------------------

const RETURN_REASONS: ReturnReason[] = [
  "damaged",
  "wrong_item",
  "quality",
  "not_as_described",
  "changed_mind",
  "other",
];

/** End of the return window of a delivered order, or null. */
export function returnWindowEnd(order: OrderRecord): string | null {
  const days = settings.returns.windowDays;
  if (!order.delivery.deliveredAt || days <= 0) return null;
  return new Date(
    Date.parse(order.delivery.deliveredAt) + days * 86_400_000,
  ).toISOString();
}

function returnsOf(order: OrderRecord): ReturnRequest[] {
  return [...db.returns.values()].filter(
    (r) => r.orderNumber === order.orderNumber,
  );
}

/** Units that can still be sent back: delivered, minus returned, minus in open requests. */
function returnable(order: OrderRecord) {
  const open = returnsOf(order).filter(
    (r) => r.status === "requested" || r.status === "approved",
  );
  return order.items.map((item) => {
    const inRequests = open
      .flatMap((r) => r.items)
      .filter((i) => i.productId === item.productId)
      .reduce((sum, i) => sum + (i.approvedQuantity ?? i.quantity), 0);
    return {
      productId: item.productId,
      sku: item.sku,
      available: Math.max(
        0,
        item.deliveredQuantity - item.returnedQuantity - inRequests,
      ),
    };
  });
}

export function returnsInfo(order: OrderRecord) {
  const until = returnWindowEnd(order);
  const open =
    order.status === "delivered" &&
    until !== null &&
    Date.parse(until) > Date.now();
  return {
    possible: open && returnable(order).some((row) => row.available > 0),
    until,
  };
}

export function orderReturns(order: OrderRecord): OrderReturns {
  return { items: returnsOf(order), returnable: returnable(order) };
}

export function createReturn(
  order: OrderRecord,
  raw: unknown,
  locale: Locale,
): { return: ReturnRequest } {
  const body = objectBody(raw, ["items", "comment", "locale"]);
  if (order.status !== "delivered") {
    throw new HttpError(
      409,
      "RETURN_NOT_POSSIBLE",
      "Only a delivered order can be returned.",
      { status: order.status },
    );
  }
  const until = returnWindowEnd(order);
  if (until === null || Date.parse(until) < Date.now()) {
    throw new HttpError(
      409,
      "RETURN_WINDOW_CLOSED",
      "The return window is over.",
      {
        until,
        windowDays: settings.returns.windowDays,
      },
    );
  }
  if (
    !Array.isArray(body.items) ||
    body.items.length < 1 ||
    body.items.length > 100
  ) {
    throw validationFailed("items", "items must contain 1 to 100 entries");
  }
  if (
    body.comment !== undefined &&
    (typeof body.comment !== "string" || body.comment.length > 1000)
  ) {
    throw validationFailed(
      "comment",
      "comment must be at most 1000 characters",
    );
  }
  const available = new Map(
    returnable(order).map((row) => [row.productId, row]),
  );
  const seen = new Set<string>();
  const items = body.items.map((entry, index) => {
    const item = objectBody(entry, [
      "productId",
      "quantity",
      "reason",
      "comment",
    ]);
    const productId = item.productId;
    if (typeof productId !== "string" || !OBJECT_ID.test(productId)) {
      throw validationFailed(
        `items.${index}.productId`,
        "productId must be an id",
      );
    }
    if (seen.has(productId)) {
      throw validationFailed("items", "items must not contain a product twice");
    }
    seen.add(productId);
    const quantity = item.quantity;
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 10_000
    ) {
      throw validationFailed(
        `items.${index}.quantity`,
        "quantity must not be less than 1",
      );
    }
    if (!RETURN_REASONS.includes(item.reason as ReturnReason)) {
      throw validationFailed(
        `items.${index}.reason`,
        `reason must be one of: ${RETURN_REASONS.join(", ")}`,
      );
    }
    if (
      item.comment !== undefined &&
      (typeof item.comment !== "string" || item.comment.length > 500)
    ) {
      throw validationFailed(
        `items.${index}.comment`,
        "comment must be at most 500 characters",
      );
    }
    const orderItem = order.items.find((i) => i.productId === productId);
    const row = available.get(productId);
    if (!orderItem || !row) {
      throw new HttpError(
        400,
        "ORDER_ITEM_NOT_FOUND",
        "This product is not part of the order.",
        { productId },
      );
    }
    if (quantity > row.available) {
      throw new HttpError(
        409,
        "RETURN_QUANTITY_INVALID",
        "More units than can be returned.",
        { productId, sku: row.sku, available: row.available },
      );
    }
    const product = findProduct(productId);
    return {
      productId,
      sku: orderItem.sku,
      name: orderItem.name[locale] || orderItem.name.en,
      packSize: product
        ? packSize(product, locale)
        : { value: 1, unit: "pcs" as const, label: "1" },
      quantity,
      approvedQuantity: null,
      unitPrice: orderItem.unitPrice,
      reason: item.reason as ReturnReason,
      comment: (item.comment as string | undefined)?.trim() || null,
    };
  });

  const number = `${order.orderNumber}-R${returnsOf(order).length + 1}`;
  const request: ReturnRequest = {
    returnNumber: number,
    orderNumber: order.orderNumber,
    status: "requested",
    requestedAt: new Date().toISOString(),
    decidedAt: null,
    completedAt: null,
    items,
    comment: (body.comment as string | undefined)?.trim() || null,
    answer: null,
    creditAmount: null,
    canCancel: true,
  };
  db.returns.set(number, request);
  return { return: request };
}

export function findReturn(
  customer: CustomerRecord,
  returnNumber: string,
): ReturnRequest {
  const request = db.returns.get(returnNumber.toUpperCase());
  const order = request && db.orders.get(request.orderNumber);
  if (!request || !order || order.customerId !== customer.id) {
    throw new HttpError(404, "RETURN_NOT_FOUND", "This return does not exist.");
  }
  return request;
}

export function cancelReturn(request: ReturnRequest): {
  return: ReturnRequest;
} {
  if (request.status === "cancelled") return { return: request };
  if (request.status !== "requested") {
    throw new HttpError(
      409,
      "RETURN_TRANSITION_NOT_ALLOWED",
      "Radhe Foods has decided about this return already.",
      { from: request.status, to: "cancelled" },
    );
  }
  request.status = "cancelled";
  request.canCancel = false;
  return { return: request };
}

/** What the admin does with a return: approve, reject, or complete it. */
export function decideReturn(
  request: ReturnRequest,
  action: "approve" | "reject" | "complete",
): void {
  const order = db.orders.get(request.orderNumber);
  const customer = order && db.customers.get(order.customerId);
  if (!order || !customer) return;
  const now = new Date().toISOString();
  request.canCancel = false;
  if (action === "reject") {
    request.status = "rejected";
    request.decidedAt = now;
    request.answer = "Returns of opened food are not possible. (mock answer)";
    return;
  }
  if (action === "approve") {
    request.status = "approved";
    request.decidedAt = now;
    for (const item of request.items) item.approvedQuantity = item.quantity;
    return;
  }
  // Completed: the units are booked on the order and its bill goes down.
  const before = finalTotalsOf(order).total;
  for (const item of request.items) {
    item.approvedQuantity ??= item.quantity;
    const orderItem = order.items.find((i) => i.productId === item.productId);
    if (orderItem) orderItem.returnedQuantity += item.approvedQuantity;
  }
  const after = finalTotalsOf(order);
  const credit = before - after.total;
  request.status = "completed";
  request.decidedAt ??= now;
  request.completedAt = now;
  request.creditAmount = credit;
  if (after.subtotal === 0) order.status = "returned";
  if (credit > 0) {
    order.payment.creditedAmount += credit;
    documentFor(
      order,
      customer,
      "credit_note",
      { ...after, total: credit, subtotal: credit, deliveryFee: 0 },
      request.items.map((item) => ({
        description: `${item.name}, ${item.packSize.label}`,
        sku: item.sku,
        quantity: item.approvedQuantity ?? item.quantity,
        unitPrice: item.unitPrice,
        vatRate:
          order.items.find((i) => i.productId === item.productId)?.vatRate ??
          700,
        vatPercent:
          (order.items.find((i) => i.productId === item.productId)?.vatRate ??
            700) / 100,
        lineTotal: (item.approvedQuantity ?? item.quantity) * item.unitPrice,
      })),
      {
        invoiceNumber: order.payment.invoiceNumber,
        creditReason: "return",
        creditReference: request.returnNumber,
      },
    );
  }
}

// --- Moving an order along (what the admin does) -----------------------------

export type OrderAction = "process" | "dispatch" | "deliver" | "refund";

export function advanceOrder(order: OrderRecord, action: OrderAction): void {
  const now = new Date().toISOString();
  switch (action) {
    case "process":
      order.status = "processing";
      break;
    case "dispatch":
      order.status = "dispatched";
      order.delivery.dispatchedAt = now;
      if (order.delivery.method !== "radhe_delivery") {
        order.delivery.trackingNumber = "00340434161094015902";
      }
      break;
    case "deliver":
      order.status = "delivered";
      order.delivery.dispatchedAt ??= now;
      order.delivery.deliveredAt = now;
      for (const item of order.items) item.deliveredQuantity = item.quantity;
      break;
    case "refund":
      refundOrder(order);
      break;
  }
}
