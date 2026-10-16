// Addresses, checkout and orders of the mock API (doc 3 and 9): the checks
// of a checkout in the order the documentation lists them, the order that
// waits for its payment, and what the customer can do with it.

import type {
  Address,
  CheckoutResult,
  CursorPage,
  CustomerCancellationReason,
  OrderAddress,
  OrderDetail,
  OrderSummary,
} from "../src/lib/api/types.ts";
import { products } from "./data/catalogue.ts";
import {
  HttpError,
  OBJECT_ID,
  PHONE,
  objectBody,
  validationFailed,
} from "./errors.ts";
import {
  db,
  legalDocuments,
  type CustomerRecord,
  type Locale,
  type OrderRecord,
} from "./state.ts";
import {
  finalTotalsOf,
  paymentBlockOf,
  paymentPage,
  releaseStock,
  returnsInfo,
  stripe,
} from "./payments.ts";
import { billOf, findProduct, packSize, productImageUrl } from "./views.ts";

const ADDRESS_LIMIT = 10;

// --- Fixtures that orders and tests change, and how to restore them ----------

const initialStock = new Map(products.map((p) => [p.id, p.stock]));
const initialPrices = new Map(
  products.map((p) => [p.id, [p.regularPrice, p.salePrice] as const]),
);
const initialLegalVersions = new Map(
  legalDocuments.map((document) => [document.type, document.version]),
);

/** Back to the fixtures as they were at start (`POST /__mock/reset`). */
export function resetFixtures(): void {
  for (const p of products) {
    const [regular, sale] = initialPrices.get(p.id)!;
    p.regularPrice = regular;
    p.salePrice = sale;
    p.stock = initialStock.get(p.id) ?? p.stock;
  }
  for (const document of legalDocuments) {
    document.version = initialLegalVersions.get(document.type)!;
  }
}

// --- 3 Addresses ------------------------------------------------------------

const ADDRESS_KEYS = [
  "firstName",
  "lastName",
  "company",
  "street",
  "houseNumber",
  "additionalLine",
  "postalCode",
  "city",
  "countryCode",
  "phone",
  "isDefault",
];

function text(
  body: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
): string {
  const value =
    typeof body[key] === "string" ? (body[key] as string).trim() : "";
  if (value.length < min || value.length > max) {
    throw validationFailed(key, `${key} must be ${min} to ${max} characters`);
  }
  return value;
}

function optionalText(
  body: Record<string, unknown>,
  key: string,
  max: number,
): string | null {
  const value = body[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.trim().length > max) {
    throw validationFailed(key, `${key} must be at most ${max} characters`);
  }
  // An empty optional string counts as "not provided".
  return value.trim() || null;
}

/** Checks the fields that are present; `partial` skips the missing ones. */
function addressFields(
  raw: unknown,
  partial: boolean,
): Partial<Omit<Address, "id">> {
  const body = objectBody(raw, ADDRESS_KEYS);
  const fields: Partial<Omit<Address, "id">> = {};
  const has = (key: string) => !partial || body[key] !== undefined;

  if (has("firstName")) fields.firstName = text(body, "firstName", 1, 80);
  if (has("lastName")) fields.lastName = text(body, "lastName", 1, 80);
  if (has("street")) fields.street = text(body, "street", 1, 120);
  if (has("houseNumber")) fields.houseNumber = text(body, "houseNumber", 1, 20);
  if (has("city")) fields.city = text(body, "city", 1, 80);
  if (has("postalCode")) {
    if (
      typeof body.postalCode !== "string" ||
      !/^\d{5}$/.test(body.postalCode)
    ) {
      throw validationFailed(
        "postalCode",
        "postalCode must be exactly 5 digits",
      );
    }
    fields.postalCode = body.postalCode;
  }
  if (body.company !== undefined) {
    fields.company = optionalText(body, "company", 120);
  }
  if (body.additionalLine !== undefined) {
    fields.additionalLine = optionalText(body, "additionalLine", 120);
  }
  if (body.phone !== undefined) {
    const phone = optionalText(body, "phone", 16);
    if (phone !== null && !PHONE.test(phone)) {
      throw validationFailed("phone", "phone must be in international format");
    }
    fields.phone = phone;
  }
  if (body.countryCode !== undefined && body.countryCode !== "DE") {
    throw validationFailed("countryCode", "countryCode must be DE");
  }
  if (body.isDefault !== undefined) {
    if (typeof body.isDefault !== "boolean") {
      throw validationFailed("isDefault", "isDefault must be a boolean value");
    }
    fields.isDefault = body.isDefault;
  }
  return fields;
}

function makeDefault(customer: CustomerRecord, id: string): void {
  for (const address of customer.addresses)
    address.isDefault = address.id === id;
}

function findAddress(customer: CustomerRecord, id: string): Address {
  const address = customer.addresses.find((a) => a.id === id);
  if (!OBJECT_ID.test(id) || !address) {
    throw new HttpError(
      404,
      "ADDRESS_NOT_FOUND",
      "This address does not exist.",
    );
  }
  return address;
}

let addressSequence = 0;

export const addresses = {
  list: (customer: CustomerRecord) => ({ items: customer.addresses }),

  create(customer: CustomerRecord, raw: unknown) {
    const fields = addressFields(raw, false);
    if (customer.addresses.length >= ADDRESS_LIMIT) {
      throw new HttpError(
        400,
        "ADDRESS_LIMIT_REACHED",
        "The address book is full.",
        { maximum: ADDRESS_LIMIT },
      );
    }
    addressSequence += 1;
    const address: Address = {
      id: `66e1${addressSequence.toString(16).padStart(20, "0")}`,
      firstName: fields.firstName!,
      lastName: fields.lastName!,
      company: fields.company ?? null,
      street: fields.street!,
      houseNumber: fields.houseNumber!,
      additionalLine: fields.additionalLine ?? null,
      postalCode: fields.postalCode!,
      city: fields.city!,
      countryCode: "DE",
      phone: fields.phone ?? null,
      isDefault: false,
    };
    customer.addresses.push(address);
    // The first address becomes the default.
    if (fields.isDefault || customer.addresses.length === 1) {
      makeDefault(customer, address.id);
    }
    return { items: customer.addresses };
  },

  update(customer: CustomerRecord, id: string, raw: unknown) {
    const address = findAddress(customer, id);
    const { isDefault, ...fields } = addressFields(raw, true);
    Object.assign(address, fields);
    if (isDefault) makeDefault(customer, id);
    return { items: customer.addresses };
  },

  setDefault(customer: CustomerRecord, id: string) {
    findAddress(customer, id);
    makeDefault(customer, id);
    return { items: customer.addresses };
  },

  remove(customer: CustomerRecord, id: string) {
    const address = findAddress(customer, id);
    customer.addresses = customer.addresses.filter((a) => a.id !== id);
    if (address.isDefault && customer.addresses[0]) {
      customer.addresses[0].isDefault = true;
    }
    return { items: customer.addresses };
  },
};

// --- 9 Orders and checkout --------------------------------------------------

function trackingUrlOf(order: OrderRecord, locale: Locale): string | null {
  const number = order.delivery.trackingNumber;
  if (!number) return null;
  if (order.delivery.method === "dhl") {
    return `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${number}&lang=${locale}`;
  }
  if (order.delivery.method === "hermes") {
    return `https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsinformation#${number}`;
  }
  return null;
}

function summaryOf(order: OrderRecord, locale: Locale): OrderSummary {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    placedAt: order.placedAt,
    total: order.totals.total,
    finalTotal: finalTotalsOf(order).total,
    currency: "EUR",
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    preview: order.items.slice(0, 3).map((item) => ({
      name: item.name[locale] || item.name.en,
      imageUrl: productImageUrl(item.productId, "small"),
    })),
    delivery: {
      method: order.delivery.method,
      trackingNumber: order.delivery.trackingNumber,
      trackingUrl: trackingUrlOf(order, locale),
      dispatchedAt: order.delivery.dispatchedAt,
      deliveredAt: order.delivery.deliveredAt,
    },
  };
}

/**
 * Whether the customer may cancel (doc 9.5): always while the order waits
 * for its payment; a paid order until it is dispatched (the default rule).
 */
export function canCancelOf(order: OrderRecord): boolean {
  return (
    order.status === "pending_payment" ||
    order.status === "confirmed" ||
    order.status === "processing"
  );
}

export function orderDetail(order: OrderRecord, locale: Locale): OrderDetail {
  const delivered = order.delivery.deliveredAt !== null;
  return {
    ...summaryOf(order, locale),
    language: order.language,
    items: order.items.map((item) => {
      const product = findProduct(item.productId);
      const kept = delivered
        ? item.deliveredQuantity - item.returnedQuantity
        : item.quantity;
      return {
        productId: item.productId,
        sku: item.sku,
        name: item.name[locale] || item.name.en,
        packSize: product
          ? packSize(product, locale)
          : { value: 1, unit: "pcs", label: "1" },
        imageUrl: productImageUrl(item.productId, "small"),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        regularUnitPrice: item.regularUnitPrice,
        lineTotal: item.lineTotal,
        vatRate: item.vatRate,
        vatPercent: item.vatRate / 100,
        vatAmount: item.vatAmount,
        deliveredQuantity: item.deliveredQuantity,
        returnedQuantity: item.returnedQuantity,
        finalLineTotal: Math.max(0, kept) * item.unitPrice,
      };
    }),
    totals: order.totals,
    finalTotals: finalTotalsOf(order),
    adjustments: order.adjustments,
    deliveryAddress: order.deliveryAddress,
    note: order.note,
    payment: paymentBlockOf(order),
    canCancel: canCancelOf(order),
    returns: returnsInfo(order),
    cancellation: order.cancellation,
    acceptedTerms: order.consent,
  };
}

function ordersOf(customer: CustomerRecord): OrderRecord[] {
  // Newest first.
  return [...db.orders.values()]
    .filter((order) => order.customerId === customer.id)
    .reverse();
}

export function findOrder(
  customer: CustomerRecord,
  orderNumber: string,
): OrderRecord {
  const order = db.orders.get(orderNumber.toUpperCase());
  if (!order || order.customerId !== customer.id) {
    throw new HttpError(404, "ORDER_NOT_FOUND", "This order does not exist.");
  }
  return order;
}

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,64}$/;
const LEGAL_TYPES = ["terms", "privacy"] as const;

/**
 * `POST /v1/store/checkout`, with the checks in the documented order. The
 * order is created as `pending_payment` with a payment page on the mock;
 * nothing is reserved and the cart is kept until the payment goes through.
 */
export function checkout(
  customer: CustomerRecord,
  key: string | undefined,
  raw: unknown,
  locale: Locale,
  mockBase: string,
): { status: 200 | 201; body: CheckoutResult } {
  const body = objectBody(raw, [
    "addressId",
    "expectedTotal",
    "consent",
    "note",
    "language",
  ]);
  if (typeof body.addressId !== "string" || !OBJECT_ID.test(body.addressId)) {
    throw validationFailed("addressId", "addressId must be an id");
  }
  const expectedTotal = body.expectedTotal;
  if (
    typeof expectedTotal !== "number" ||
    !Number.isInteger(expectedTotal) ||
    expectedTotal < 1 ||
    expectedTotal > 1_000_000_000
  ) {
    throw validationFailed("expectedTotal", "expectedTotal must be an integer");
  }
  const consent = objectBody(body.consent, ["accepted", "versions"]);
  if (consent.accepted !== true) {
    throw validationFailed("consent.accepted", "accepted must be true");
  }
  const versions = objectBody(consent.versions, [...LEGAL_TYPES]);
  for (const type of LEGAL_TYPES) {
    const version = versions[type];
    if (
      version !== undefined &&
      (typeof version !== "number" || !Number.isInteger(version) || version < 1)
    ) {
      throw validationFailed(
        `consent.versions.${type}`,
        `${type} must not be less than 1`,
      );
    }
  }
  if (body.note !== undefined && typeof body.note !== "string") {
    throw validationFailed("note", "note must be a string");
  }
  const note = (body.note as string | undefined)?.trim() || null;
  if (note && note.length > 500) {
    throw validationFailed("note", "note must be at most 500 characters");
  }
  if (
    body.language !== undefined &&
    body.language !== "en" &&
    body.language !== "de"
  ) {
    throw validationFailed("language", "language must be one of: en, de");
  }

  if (!key || !IDEMPOTENCY_KEY.test(key)) {
    throw new HttpError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "Send an Idempotency-Key header: 8 to 64 letters, digits, hyphens or underscores, for example a UUID.",
    );
  }
  if (!stripe.enabled) {
    throw new HttpError(
      503,
      "PAYMENTS_NOT_CONFIGURED",
      "Online payment is not set up on this server.",
    );
  }
  // (409 COMPANY_DETAILS_MISSING: the seller of the mock is always complete.)

  // The same attempt again: the first order and its page, nothing else happens.
  const existing = [...db.orders.values()].find(
    (order) => order.customerId === customer.id && order.idempotencyKey === key,
  );
  if (existing) {
    const page = paymentPage(existing, mockBase);
    return {
      status: 200,
      body: {
        created: false,
        order: orderDetail(existing, locale),
        checkout: page,
      },
    };
  }

  if (customer.blocked) {
    throw new HttpError(403, "CUSTOMER_BLOCKED", "This account is blocked.");
  }
  const address = customer.addresses.find((a) => a.id === body.addressId);
  if (!address) {
    throw new HttpError(
      404,
      "ADDRESS_NOT_FOUND",
      "This address does not exist.",
    );
  }

  const published = new Map(legalDocuments.map((d) => [d.type, d.version]));
  const missing = LEGAL_TYPES.filter((type) => !published.has(type));
  if (missing.length > 0) {
    throw new HttpError(
      409,
      "LEGAL_DOCUMENTS_MISSING",
      "The shop has no published terms or privacy policy yet.",
      { missing },
    );
  }
  const current = Object.fromEntries(published);
  const accepted = versions as Record<string, number | undefined>;
  if ([...published].some(([type, version]) => accepted[type] !== version)) {
    throw new HttpError(
      409,
      "LEGAL_VERSION_CHANGED",
      "A legal text was republished. Please read and accept the current version.",
      { current },
    );
  }

  if (customer.cart.length === 0) {
    throw new HttpError(409, "CART_EMPTY", "The cart is empty.");
  }
  const bill = billOf(customer.cart, locale);
  const issues = bill.lines.filter((line) => line.issue !== null);
  if (issues.length > 0) {
    throw new HttpError(
      409,
      "ORDER_ITEMS_NOT_ORDERABLE",
      "Some products cannot be ordered.",
      {
        lines: issues.map((line) => ({
          productId: line.productId,
          sku: line.product?.sku ?? null,
          quantity: line.quantity,
          issue: line.issue,
          minQuantity: line.ordering?.minQuantity ?? null,
          maxQuantity: line.ordering?.maxQuantity ?? null,
          remaining: line.ordering?.remaining ?? null,
        })),
      },
    );
  }
  if (bill.totals.total !== expectedTotal) {
    throw new HttpError(
      409,
      "ORDER_TOTAL_CHANGED",
      "The total has changed since the customer saw it.",
      { expectedTotal, total: bill.totals.total, totals: bill.totals },
    );
  }

  db.orderSequence += 1;
  const deliveryAddress: OrderAddress = {
    firstName: address.firstName,
    lastName: address.lastName,
    street: address.street,
    houseNumber: address.houseNumber,
    postalCode: address.postalCode,
    city: address.city,
    countryCode: "DE",
    // These three are absent when they were not set.
    ...(address.company && { company: address.company }),
    ...(address.additionalLine && { additionalLine: address.additionalLine }),
    ...(address.phone && { phone: address.phone }),
  };
  const now = new Date().toISOString();
  const order: OrderRecord = {
    orderNumber: `RF-${db.orderSequence}`,
    customerId: customer.id,
    idempotencyKey: key,
    status: "pending_payment",
    paymentStatus: "pending",
    placedAt: now,
    language: (body.language as Locale | undefined) ?? customer.locale,
    items: bill.lines.map((line) => {
      const product = findProduct(line.productId)!;
      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        regularUnitPrice:
          line.unitPrice < product.regularPrice ? product.regularPrice : null,
        lineTotal: line.lineTotal,
        vatRate: line.vatRate,
        vatAmount: line.vatAmount,
        deliveredQuantity: 0,
        returnedQuantity: 0,
      };
    }),
    // The agreed bill: order totals carry no `vatPercent`.
    totals: {
      ...bill.totals,
      vat: bill.totals.vat.map(({ vatRate, gross, net, vat }) => ({
        vatRate,
        gross,
        net,
        vat,
      })),
    },
    deliveryAddress,
    note,
    consent: {
      at: now,
      documents: [...published].map(([type, version]) => ({ type, version })),
    },
    cancellation: null,
    delivery: {
      method: "radhe_delivery",
      trackingNumber: null,
      dispatchedAt: null,
      deliveredAt: null,
    },
    adjustments: [],
    payment: {
      amount: bill.totals.total,
      paidAmount: 0,
      creditedAmount: 0,
      refundedAmount: 0,
      method: null,
      paidAt: null,
      receiptUrl: null,
      invoiceNumber: null,
      invoiceIssuedAt: null,
      checkout: null,
      attempts: 0,
      lastFailure: null,
      stockTaken: false,
    },
    pendingUntil: null,
  };
  db.orders.set(order.orderNumber, order);
  const page = paymentPage(order, mockBase);
  return {
    status: 201,
    body: {
      created: true,
      order: orderDetail(order, locale),
      checkout: page,
    },
  };
}

export function listOrders(
  customer: CustomerRecord,
  locale: Locale,
  limit: number,
  cursor: string | undefined,
): CursorPage<OrderSummary> {
  const all = ordersOf(customer);
  // The cursor of the mock is the order number the next page starts after.
  const start = cursor
    ? all.findIndex((order) => order.orderNumber === cursor) + 1
    : 0;
  const pageItems = all.slice(start, start + limit);
  const more = start + limit < all.length;
  return {
    items: pageItems.map((order) => summaryOf(order, locale)),
    nextCursor: more ? pageItems[pageItems.length - 1].orderNumber : null,
  };
}

export function getOrder(
  customer: CustomerRecord,
  orderNumber: string,
  locale: Locale,
) {
  return { order: orderDetail(findOrder(customer, orderNumber), locale) };
}

const CANCEL_REASONS: CustomerCancellationReason[] = [
  "changed_mind",
  "ordered_by_mistake",
  "wrong_items",
  "delivery_too_late",
  "other",
];

/**
 * `POST …/cancel`. An unpaid order is given up: its page is closed, nothing
 * is charged. A paid one gives its units back; the refund is decided by
 * Radhe Foods (a test control stands in for that).
 */
export function cancelOrder(
  customer: CustomerRecord,
  orderNumber: string,
  raw: unknown,
  locale: Locale,
) {
  const order = findOrder(customer, orderNumber);
  const body = objectBody(raw, ["reason", "text"]);
  if (!CANCEL_REASONS.includes(body.reason as CustomerCancellationReason)) {
    throw validationFailed(
      "reason",
      `reason must be one of: ${CANCEL_REASONS.join(", ")}`,
    );
  }
  if (
    body.text !== undefined &&
    (typeof body.text !== "string" || body.text.length > 1000)
  ) {
    throw validationFailed("text", "text must be at most 1000 characters");
  }
  // Cancelling a cancelled order answers 200, unchanged.
  if (order.status === "cancelled") {
    return { order: orderDetail(order, locale) };
  }
  if (!canCancelOf(order)) {
    throw new HttpError(
      409,
      "ORDER_CANNOT_BE_CANCELLED",
      "This order can no longer be cancelled. Please contact Radhe Foods.",
      { status: order.status },
    );
  }
  order.payment.checkout = null;
  order.pendingUntil = null;
  releaseStock(order);
  order.status = "cancelled";
  order.cancellation = {
    reason: body.reason as CustomerCancellationReason,
    text: (body.text as string | undefined) ?? null,
    by: "customer",
    at: new Date().toISOString(),
  };
  return { order: orderDetail(order, locale) };
}
