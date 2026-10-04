// What happens to an order after it was placed, in the mock API: delivery
// statuses, the final bill, payment (doc 10), invoices and credit notes
// (doc 11) and returns (doc 12). The real API does these through its admin
// side; here the test controls of `server.ts` and the demo data stand in.

import { randomBytes } from "node:crypto";
import type {
  CursorPage,
  InvoiceDetail,
  InvoiceSummary,
  OrderPayment,
  OrderReturns,
  PaymentBlock,
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
  TIMEZONE,
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

// --- 10 Payments ------------------------------------------------------------

export function amountDueOf(order: OrderRecord): number {
  const payment = order.payment;
  if (!payment || payment.waived) return 0;
  return Math.max(
    0,
    payment.invoicedAmount - payment.creditedAmount - payment.paidAmount,
  );
}

/** The payment block of an order (doc 10.1). */
export function paymentBlockOf(order: OrderRecord): PaymentBlock {
  const payment = order.payment;
  if (!payment) {
    return {
      status: "not_enabled",
      amountDue: 0,
      invoice: null,
      deadline: null,
      paidAt: null,
      method: null,
      canPayOnline: false,
    };
  }
  const amountDue = amountDueOf(order);
  const owing =
    order.paymentStatus === "due" || order.paymentStatus === "overdue";
  return {
    status: order.paymentStatus,
    amountDue,
    invoicedAmount: payment.invoicedAmount,
    creditedAmount: payment.creditedAmount,
    paidAmount: payment.paidAmount,
    refundedAmount: payment.refundedAmount,
    invoice: {
      number: payment.invoiceNumber,
      issuedAt: payment.issuedAt,
      pdfPath: `/v1/store/invoices/${payment.invoiceNumber}/pdf`,
    },
    deadline: payment.deadline,
    isOverdue: owing && new Date(payment.deadline).getTime() < Date.now(),
    paidAt: payment.paidAt,
    method: payment.method,
    paymentType: payment.paymentType,
    receiptUrl:
      payment.method === "stripe"
        ? `https://pay.stripe.com/receipts/mock/${order.orderNumber}`
        : null,
    canPayOnline: stripe.enabled && owing && amountDue > 0,
    cashPossible: order.delivery.method === "radhe_delivery" && owing,
  };
}

/** The end of a day in German time, `days` from now, as the API sets deadlines. */
function deadlineIn(days: number): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(
    new Date(Date.now() + days * 86_400_000),
  );
  // 23:59:59 in Berlin is 21:59:59 or 22:59:59 UTC; the mock asks the offset.
  const probe = new Date(`${day}T12:00:00Z`);
  const berlinHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(probe),
  );
  const offsetHours = berlinHour - 12;
  return new Date(
    Date.parse(`${day}T23:59:59Z`) - offsetHours * 3_600_000,
  ).toISOString();
}

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
    dueAt: null,
    paidAt: null,
    total: totals.total,
    currency: "EUR",
    language: order.language,
    invoiceNumber: null,
    creditReason: null,
    orderId: "66f100000000000000000001",
    customerId: customer.id,
    cargoId: "66f0a1b2c3d4e5f6a7b8c9d0",
    deliveredOn: order.delivery.deliveredAt?.slice(0, 10) ?? null,
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

/** The admin activates payment: the invoice is issued, the order is `due`. */
export function activatePayment(order: OrderRecord, days = 5): void {
  const customer = db.customers.get(order.customerId);
  if (!customer || order.payment || order.delivery.deliveredAt === null) return;
  const totals = finalTotalsOf(order);
  const deadline = deadlineIn(days);
  const invoice = documentFor(
    order,
    customer,
    "invoice",
    totals,
    linesOf(order, (index) => keptQuantity(order, index)),
    { dueAt: deadline },
  );
  order.payment = {
    invoiceNumber: invoice.number,
    issuedAt: invoice.issuedAt,
    deadline,
    paidAt: null,
    method: null,
    paymentType: null,
    invoicedAmount: totals.total,
    creditedAmount: 0,
    paidAmount: 0,
    refundedAmount: 0,
    waived: false,
    payLinkToken: randomBytes(32).toString("base64url"),
  };
  order.paymentStatus = "due";
}

export function markPaid(
  order: OrderRecord,
  method: "stripe" | "cash",
  paymentType: "card" | "paypal" | null = null,
): void {
  if (!order.payment) return;
  const paidAt = new Date().toISOString();
  order.payment.paidAmount += amountDueOf(order);
  order.payment.paidAt = paidAt;
  order.payment.method = method;
  order.payment.paymentType =
    method === "stripe" ? (paymentType ?? "card") : null;
  order.paymentStatus = "paid";
  const invoice = db.invoices.get(order.payment.invoiceNumber);
  if (invoice) invoice.paidAt = paidAt;
}

/** The deadline passed: the order is overdue and stops new orders. */
export function markOverdue(order: OrderRecord): void {
  if (!order.payment || order.paymentStatus !== "due") return;
  order.payment.deadline = new Date(Date.now() - 86_400_000).toISOString();
  order.paymentStatus = "overdue";
  const invoice = db.invoices.get(order.payment.invoiceNumber);
  if (invoice) invoice.dueAt = order.payment.deadline;
}

/** Unpaid orders past their deadline, for the overdue rule (doc 9). */
export function overdueOrdersOf(customer: CustomerRecord) {
  return [...db.orders.values()]
    .filter(
      (o) => o.customerId === customer.id && o.paymentStatus === "overdue",
    )
    .map((order) => ({
      orderNumber: order.orderNumber,
      invoiceNumber: order.payment!.invoiceNumber,
      amountDue: amountDueOf(order),
      deadlineAt: order.payment!.deadline,
    }));
}

function summaryOf(document: InvoiceDetail): InvoiceSummary {
  return {
    id: document.id,
    number: document.number,
    type: document.type,
    orderNumber: document.orderNumber,
    issuedAt: document.issuedAt,
    dueAt: document.dueAt,
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

/** `GET /v1/store/orders/{orderNumber}/payment` */
export function orderPayment(
  customer: CustomerRecord,
  order: OrderRecord,
): OrderPayment {
  return {
    orderNumber: order.orderNumber,
    payment: paymentBlockOf(order),
    documents: documentsOf(customer, order.orderNumber).map(summaryOf),
  };
}

/** `POST …/checkout`: the address of the (mock) payment page. */
export function createCheckout(order: OrderRecord, mockBase: string) {
  if (!stripe.enabled) {
    throw new HttpError(
      503,
      "PAYMENTS_NOT_CONFIGURED",
      "Online payment is not set up on this server.",
    );
  }
  if (!order.payment) {
    throw new HttpError(
      409,
      "PAYMENT_NOT_ACTIVATED",
      "No invoice was issued yet.",
    );
  }
  if (order.paymentStatus !== "due" && order.paymentStatus !== "overdue") {
    throw new HttpError(409, "PAYMENT_NOT_POSSIBLE", "Nothing can be paid.", {
      paymentStatus: order.paymentStatus,
    });
  }
  if (amountDueOf(order) === 0) {
    throw new HttpError(409, "PAYMENT_NOTHING_DUE", "Nothing is due.");
  }
  return {
    url: `${mockBase}/__mock/stripe/${order.orderNumber}`,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  };
}

// --- 11 Invoices ------------------------------------------------------------

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
  if (order.payment && credit > 0) {
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
      { invoiceNumber: order.payment.invoiceNumber, creditReason: "return" },
    );
    // An unpaid invoice with nothing left is settled by the credit note.
    if (order.paymentStatus !== "paid" && amountDueOf(order) === 0) {
      order.paymentStatus = "paid";
      order.payment.method = "credit";
      order.payment.paidAt = now;
    }
  }
}

// --- Moving an order along (what the admin does) -----------------------------

export type OrderAction =
  | "prepare"
  | "dispatch"
  | "deliver"
  | "fail"
  | "activate"
  | "pay_cash"
  | "overdue";

export function advanceOrder(order: OrderRecord, action: OrderAction): void {
  const now = new Date().toISOString();
  switch (action) {
    case "prepare":
      order.status = "preparing";
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
    case "fail":
      order.status = "delivery_failed";
      break;
    case "activate":
      activatePayment(order);
      break;
    case "pay_cash":
      markPaid(order, "cash");
      break;
    case "overdue":
      markOverdue(order);
      break;
  }
}
