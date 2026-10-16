// Everything the mock API remembers, in memory. A restart forgets it all.

import type {
  Address,
  DeliveryMethod,
  InvoiceDetail,
  OrderAddress,
  OrderAdjustment,
  OrderCancellation,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
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
  delivery: {
    estimate: { en: "2 to 4 working days", de: "2 bis 4 Werktage" },
  },
  returns: { windowDays: 14 },
  /** How long a payment page stays open, in minutes (`payments.checkoutMinutes`). */
  checkoutMinutes: 60,
};

// --- Legal texts (doc 6) ----------------------------------------------------

export type LegalType = "terms" | "privacy";

export interface LegalRecord {
  type: LegalType;
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
      en: `${SAMPLE_NOTE.en}\n\n## 1. Scope\n\nThese terms apply to all orders placed in the Radhe Foods online shop.\n\n## 2. Conclusion of contract\n\nBy clicking "Buy now" you place a binding order for the goods in your cart. The contract is concluded when your payment is confirmed.\n\n## 3. Prices and payment\n\nAll prices include VAT. Delivery fees are shown before you order. You pay at checkout by card or PayPal.`,
      de: `${SAMPLE_NOTE.de}\n\n## 1. Geltungsbereich\n\nDiese Bedingungen gelten für alle Bestellungen im Onlineshop von Radhe Foods.\n\n## 2. Vertragsschluss\n\nMit dem Klick auf „Zahlungspflichtig bestellen“ geben Sie eine verbindliche Bestellung der Waren in Ihrem Warenkorb ab. Der Vertrag kommt mit der Bestätigung Ihrer Zahlung zustande.\n\n## 3. Preise und Zahlung\n\nAlle Preise enthalten die Mehrwertsteuer. Lieferkosten werden vor der Bestellung angezeigt. Sie zahlen an der Kasse per Karte oder PayPal.`,
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
  /** Blocked by Radhe Foods: cannot sign in or check out. */
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
}

export interface SessionRecord {
  customerId: string;
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

/** The open payment page of an order, played by the mock itself. */
export interface PaymentPageRecord {
  url: string;
  expiresAt: string;
  /** Set when the customer paid with PayPal: the "webhook" settles at this moment. */
  completesAt: string | null;
}

/** The payment of an order (doc 10.1), as stored. */
export interface PaymentRecord {
  /** The total to pay, agreed at checkout. */
  amount: number;
  paidAmount: number;
  creditedAmount: number;
  refundedAmount: number;
  method: PaymentMethod | null;
  paidAt: string | null;
  receiptUrl: string | null;
  invoiceNumber: string | null;
  invoiceIssuedAt: string | null;
  checkout: PaymentPageRecord | null;
  /** How many payment pages were opened. */
  attempts: number;
  lastFailure: string | null;
  /** The stock of the items was taken off the shelf. */
  stockTaken: boolean;
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
  consent: {
    at: string;
    documents: { type: LegalType; version: number }[];
  };
  cancellation: OrderCancellation | null;
  delivery: {
    method: DeliveryMethod;
    trackingNumber: string | null;
    dispatchedAt: string | null;
    deliveredAt: string | null;
  };
  adjustments: OrderAdjustment[];
  payment: PaymentRecord;
  /** When the cleanup gives an unpaid order up; `null` once paid or cancelled. */
  pendingUntil: string | null;
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
}
