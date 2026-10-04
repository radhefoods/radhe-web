// Everything the mock API remembers, in memory. A restart forgets it all.

import type {
  Address,
  OrderAddress,
  OrderCancellation,
  OrderStatus,
  OverdueOrder,
  PaymentStatus,
  DeliveryMethod,
  InvoiceDetail,
  OrderAdjustment,
  PaymentMethod,
  ReturnRequest,
  Totals,
} from "../src/lib/api/types.ts";
import type { Translated } from "./data/catalogue.ts";

export type Locale = "en" | "de";

export const TIMEZONE = "Europe/Berlin";

// --- Settings (doc 6) -------------------------------------------------------

export const settings = {
  deliveryFee: {
    tiers: [
      { minOrderValue: 0, fee: 499 },
      { minOrderValue: 5000, fee: 0 },
    ],
  },
  returns: { windowDays: 14 },
};

// --- Cargo (doc 7) ----------------------------------------------------------

export interface CargoRecord {
  id: string;
  code: string;
  name: Translated | null;
  message: Translated | null;
  orderOpenAt: Date;
  orderCloseAt: Date;
  deliveryStart: string;
  deliveryEnd: string;
}

/** `open`: a cargo takes orders. `closed`: none does, the next is scheduled. `none`: nothing is planned. */
export type CargoMode = "open" | "closed" | "none";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function berlinDay(date: Date): string {
  // en-CA prints YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(date);
}

function buildCargos(now: Date): { current: CargoRecord; next: CargoRecord } {
  const close = new Date(now.getTime() + 2 * DAY + 14 * HOUR + 5 * MINUTE);
  const nextClose = new Date(close.getTime() + 7 * DAY);
  return {
    current: {
      id: "66f0a1b2c3d4e5f6a7b8c9d0",
      code: "RF-C027",
      name: { en: "October delivery", de: "Oktober-Lieferung" },
      message: {
        en: "Fresh Kesar mangoes are part of this delivery.",
        de: "Frische Kesar-Mangos sind Teil dieser Lieferung.",
      },
      orderOpenAt: new Date(now.getTime() - 3 * DAY),
      orderCloseAt: close,
      deliveryStart: berlinDay(new Date(close.getTime() + 10 * DAY)),
      deliveryEnd: berlinDay(new Date(close.getTime() + 12 * DAY)),
    },
    next: {
      id: "66f0a1b2c3d4e5f6a7b8c9d1",
      code: "RF-C028",
      name: { en: "November delivery", de: "November-Lieferung" },
      message: null,
      orderOpenAt: new Date(close.getTime() + MINUTE),
      orderCloseAt: nextClose,
      deliveryStart: berlinDay(new Date(nextClose.getTime() + 10 * DAY)),
      deliveryEnd: berlinDay(new Date(nextClose.getTime() + 12 * DAY)),
    },
  };
}

const startedAt = new Date();
const cargos = buildCargos(startedAt);

function initialCargoMode(): CargoMode {
  const wanted = process.env.MOCK_CARGO;
  return wanted === "closed" || wanted === "none" ? wanted : "open";
}

export const cargoState: { mode: CargoMode } = { mode: initialCargoMode() };

/** The cargo that takes orders now, or null. */
export function currentCargo(now = new Date()): CargoRecord | null {
  if (cargoState.mode !== "open") return null;
  return now < cargos.current.orderCloseAt ? cargos.current : null;
}

/** The scheduled cargo that opens first, or null. */
export function nextCargo(): CargoRecord | null {
  if (cargoState.mode === "none") return null;
  if (cargoState.mode === "closed") {
    // Nothing is open: pretend the next cargo opens in a day and six hours.
    const opens = new Date(Date.now() + DAY + 6 * HOUR);
    return { ...cargos.next, orderOpenAt: opens };
  }
  return cargos.next;
}

// --- Legal texts (doc 6) ----------------------------------------------------

export interface LegalRecord {
  type: "terms" | "preorder_terms" | "privacy";
  version: number;
  title: Translated;
  content: Translated;
  publishedAt: string;
}

const SAMPLE_NOTE = {
  en: "_Sample text of the mock API. The real text is entered in the admin panel._",
  de: "_Beispieltext der Mock-API. Der echte Text wird im Admin-Bereich gepflegt._",
};

export const legalDocuments: LegalRecord[] = [
  {
    type: "terms",
    version: 3,
    title: {
      en: "Terms and Conditions",
      de: "Allgemeine Geschäftsbedingungen",
    },
    content: {
      en: `${SAMPLE_NOTE.en}\n\n## 1. Scope\n\nThese terms apply to all pre-orders placed in the Radhe Foods online shop.\n\n## 2. Conclusion of contract\n\nBy confirming a pre-order you make a binding order for the goods in your cart.\n\n## 3. Prices\n\nAll prices include VAT. Delivery fees are shown before you confirm.`,
      de: `${SAMPLE_NOTE.de}\n\n## 1. Geltungsbereich\n\nDiese Bedingungen gelten für alle Vorbestellungen im Onlineshop von Radhe Foods.\n\n## 2. Vertragsschluss\n\nMit der Bestätigung einer Vorbestellung geben Sie eine verbindliche Bestellung der Waren in Ihrem Warenkorb ab.\n\n## 3. Preise\n\nAlle Preise enthalten die Mehrwertsteuer. Lieferkosten werden vor der Bestätigung angezeigt.`,
    },
    publishedAt: "2026-09-01T08:00:00.000Z",
  },
  {
    type: "preorder_terms",
    version: 1,
    title: {
      en: "Pre-Order and Payment Terms",
      de: "Vorbestell- und Zahlungsbedingungen",
    },
    content: {
      en: `${SAMPLE_NOTE.en}\n\n## Pre-order\n\nYour order belongs to the delivery that is open when you confirm it.\n\n## Payment after delivery\n\nNothing is charged when you confirm. After delivery you receive an invoice with a payment deadline.`,
      de: `${SAMPLE_NOTE.de}\n\n## Vorbestellung\n\nIhre Bestellung gehört zu der Lieferung, die bei der Bestätigung geöffnet ist.\n\n## Zahlung nach Lieferung\n\nBei der Bestätigung wird nichts abgebucht. Nach der Lieferung erhalten Sie eine Rechnung mit Zahlungsfrist.`,
    },
    publishedAt: "2026-09-01T08:00:00.000Z",
  },
  {
    type: "privacy",
    version: 2,
    title: { en: "Privacy Policy", de: "Datenschutzerklärung" },
    content: {
      en: `${SAMPLE_NOTE.en}\n\n## What we store\n\nYour email address, your delivery addresses and your orders.\n\n## Your rights\n\nYou can ask for access, correction and deletion of your data at any time.`,
      de: `${SAMPLE_NOTE.de}\n\n## Was wir speichern\n\nIhre E-Mail-Adresse, Ihre Lieferadressen und Ihre Bestellungen.\n\n## Ihre Rechte\n\nSie können jederzeit Auskunft, Berichtigung und Löschung Ihrer Daten verlangen.`,
    },
    publishedAt: "2026-09-01T08:00:00.000Z",
  },
];

// --- Customers, sessions, carts (doc 1, 2, 8) --------------------------------

export interface CustomerRecord {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  locale: Locale;
  hasGoogleLogin: boolean;
  blocked: boolean;
  communication: {
    whatsappNumber: string | null;
    whatsappOptIn: boolean;
    whatsappOptInAt: string | null;
    marketingOptIn: boolean;
    marketingOptInAt: string | null;
    marketingOptOutAt: string | null;
  };
  createdAt: string;
  cart: { productId: string; quantity: number }[];
  addresses: Address[];
  /** Radhe Foods blocked ordering for this customer. */
  orderingBlocked: boolean;
  /** Unpaid orders past their deadline: they stop a new order. */
  overdue: OverdueOrder[];
}

export interface SessionRecord {
  customerId: string;
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

/** An order as stored: snapshots, never references to the catalogue. */
export interface OrderRecord {
  orderNumber: string;
  customerId: string;
  idempotencyKey: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  placedAt: string;
  language: Locale;
  items: {
    productId: string;
    sku: string;
    name: Translated;
    quantity: number;
    unitPrice: number;
    regularUnitPrice: number | null;
    lineTotal: number;
    vatRate: number;
    vatAmount: number;
    deliveredQuantity: number;
    returnedQuantity: number;
  }[];
  totals: Totals;
  deliveryAddress: OrderAddress;
  note: string | null;
  cargoCode: string;
  promisedStart: string;
  promisedEnd: string;
  consent: {
    at: string;
    documents: {
      type: "terms" | "preorder_terms" | "privacy";
      version: number;
    }[];
  };
  cancellation: OrderCancellation | null;
  delivery: {
    method: DeliveryMethod;
    trackingNumber: string | null;
    dispatchedAt: string | null;
    deliveredAt: string | null;
  };
  adjustments: OrderAdjustment[];
  /** `null` until the admin activates payment (the invoice is issued). */
  payment: {
    invoiceNumber: string;
    issuedAt: string;
    deadline: string;
    paidAt: string | null;
    method: PaymentMethod | null;
    paymentType: "card" | "paypal" | null;
    invoicedAmount: number;
    creditedAmount: number;
    paidAmount: number;
    refundedAmount: number;
    waived: boolean;
    /** The token of the payment link in the emails (`/pay/<token>`). */
    payLinkToken: string;
  } | null;
}

/** Order numbers continue after this one: the first order is RF-1085. */
const FIRST_ORDER_SEQUENCE = 1084;

export interface OtpRecord {
  code: string;
  locale: Locale;
  attempts: number;
  sentAt: number;
  expiresAt: number;
  sentInLastHour: number[];
}

export const db = {
  customers: new Map<string, CustomerRecord>(),
  sessions: new Set<SessionRecord>(),
  otps: new Map<string, OtpRecord>(),
  /** By order number. Insertion order is the order of placement. */
  orders: new Map<string, OrderRecord>(),
  orderSequence: FIRST_ORDER_SEQUENCE,
  /** Invoices and credit notes by number, as the API shows them. */
  invoices: new Map<string, InvoiceDetail>(),
  invoiceSequence: 122,
  creditSequence: 6,
  /** Returns by return number. */
  returns: new Map<string, ReturnRequest>(),
};

/** The login code of the mock: every email gets this one. */
export const MOCK_OTP_CODE = "123456";
/** Signing in with this address answers `CUSTOMER_BLOCKED`. */
export const BLOCKED_EMAIL = "blocked@example.com";

export const ACCESS_TTL_SECONDS = Number(
  process.env.MOCK_ACCESS_TTL_SECONDS || 900,
);
export const REFRESH_TTL_SECONDS = 30 * 24 * 3600;
export const OTP_TTL_SECONDS = 600;
export const OTP_COOLDOWN_SECONDS = 60;
export const OTP_MAX_PER_HOUR = 5;
export const OTP_MAX_ATTEMPTS = 5;

let customerSequence = 0;
export function newCustomer(email: string, locale: Locale): CustomerRecord {
  customerSequence += 1;
  const customer: CustomerRecord = {
    id: `66f1${customerSequence.toString(16).padStart(20, "0")}`,
    email,
    firstName: null,
    lastName: null,
    phone: null,
    locale,
    hasGoogleLogin: false,
    blocked: false,
    communication: {
      whatsappNumber: null,
      whatsappOptIn: false,
      whatsappOptInAt: null,
      marketingOptIn: false,
      marketingOptInAt: null,
      marketingOptOutAt: null,
    },
    createdAt: new Date().toISOString(),
    cart: [],
    addresses: [],
    orderingBlocked: false,
    overdue: [],
  };
  db.customers.set(customer.id, customer);
  return customer;
}

export function customerByEmail(email: string): CustomerRecord | undefined {
  for (const customer of db.customers.values()) {
    if (customer.email === email) return customer;
  }
  return undefined;
}

/** Back to the state after start. Used by tests through `POST /__mock/reset`. */
export function resetState(): void {
  db.customers.clear();
  db.sessions.clear();
  db.otps.clear();
  db.orders.clear();
  db.orderSequence = FIRST_ORDER_SEQUENCE;
  db.invoices.clear();
  db.invoiceSequence = 122;
  db.creditSequence = 6;
  db.returns.clear();
  customerSequence = 0;
  cargoState.mode = initialCargoMode();
}
