// Everything the mock API remembers, in memory. A restart forgets it all.

import { createHash, randomBytes } from "node:crypto";
import type {
  Address,
  DeliveryMethod,
  InvoiceDetail,
  OrderAddress,
  OrderAdjustment,
  OrderCancellation,
  OrderDiscount,
  OrderRewards,
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
  returns: { windowDays: 14, issueWindowDays: 14 },
  /** How long a payment page stays open, in minutes (`payments.checkoutMinutes`). */
  checkoutMinutes: 60,
};

// --- Legal pages (doc 6, `doc/LEGAL_PAGES.md`) --------------------------------

/** The six legal pages, in the order the API answers them. */
export const LEGAL_TYPES = [
  "imprint",
  "shipping",
  "refund",
  "terms",
  "privacy",
  "withdrawal",
] as const;
export type LegalType = (typeof LEGAL_TYPES)[number];

/** The texts accepted at checkout; the other four inform. */
export const CONSENT_TYPES = ["terms", "privacy"] as const;

/** The address of each page in both languages, as the API has it by default. */
export const LEGAL_SLUGS: Record<LegalType, Translated> = {
  imprint: { en: "imprint", de: "impressum" },
  shipping: { en: "shipping", de: "versand" },
  refund: { en: "refund-policy", de: "rueckerstattung" },
  terms: { en: "terms", de: "agb" },
  privacy: { en: "privacy", de: "datenschutz" },
  withdrawal: { en: "withdrawal", de: "widerruf" },
};

/** A text in one or both languages, as the admin may leave one out. */
type MaybeTranslated = Partial<Translated>;

export interface LegalRecord {
  type: LegalType;
  version: number;
  /** The German title is optional; the English one stands in. */
  title: { en: string; de?: string };
  /** A text may exist in one language only. */
  content: MaybeTranslated;
  publishedAt: string;
  /**
   * Whether the admin has published a version. A page without one does not
   * exist for customers: not in the list, `404` by its type or address.
   */
  published: boolean;
  /** What the admin wrote for search engines; it belongs to the page. */
  seo?: { title?: MaybeTranslated; description?: MaybeTranslated };
}

const SAMPLE_NOTE = {
  en: "_Sample text of the mock API. The real text is entered in the admin panel._",
  de: "_Beispieltext der Mock-API. Der echte Text wird im Admin-Bereich gepflegt._",
};

// As a shop in the middle of moving its legal pages to the panel: the terms,
// the privacy policy and the right of withdrawal are published in both
// languages, the shipping information in German only and with texts for
// search engines; the imprint and the refund policy are still drafts.
export const legalDocuments: LegalRecord[] = [
  {
    type: "imprint",
    version: 1,
    title: { en: "Imprint", de: "Impressum" },
    content: {
      en: `${SAMPLE_NOTE.en}\n\n## Provider\n\nRadhe Foods, Musterstraße 1, 60311 Frankfurt am Main.`,
      de: `${SAMPLE_NOTE.de}\n\n## Anbieter\n\nRadhe Foods, Musterstraße 1, 60311 Frankfurt am Main.`,
    },
    publishedAt: "2026-11-11T08:00:00.000Z",
    published: false,
  },
  {
    type: "shipping",
    version: 2,
    title: { en: "Shipping information", de: "Versandinformationen" },
    content: {
      de: `${SAMPLE_NOTE.de}\n\n## Liefergebiet\n\nWir liefern innerhalb Deutschlands.\n\n## Lieferzeit\n\nIhre Bestellung ist in der Regel in 2 bis 4 Werktagen bei Ihnen.\n\n<script>window.pasted = true</script>`,
    },
    publishedAt: "2026-11-11T09:00:00.000Z",
    published: true,
    seo: {
      title: {
        en: "Shipping | Radhe Foods",
        de: "Versand | Radhe Foods",
      },
      description: { de: "So liefert Radhe Foods Ihre Bestellung." },
    },
  },
  {
    type: "refund",
    version: 1,
    title: { en: "Refund policy", de: "Rückerstattungsrichtlinie" },
    content: {
      en: `${SAMPLE_NOTE.en}\n\n## Refunds\n\nWe refund to the payment method you paid with.`,
      de: `${SAMPLE_NOTE.de}\n\n## Erstattungen\n\nWir erstatten auf das Zahlungsmittel, mit dem Sie bezahlt haben.`,
    },
    publishedAt: "2026-11-11T08:00:00.000Z",
    published: false,
  },
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
    published: true,
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
    published: true,
  },
  {
    type: "withdrawal",
    version: 1,
    title: { en: "Right of withdrawal", de: "Widerrufsbelehrung" },
    content: {
      en: `${SAMPLE_NOTE.en}\n\n## Right of withdrawal\n\nYou have the right to withdraw from this contract within fourteen days without giving any reason.`,
      de: `${SAMPLE_NOTE.de}\n\n## Widerrufsrecht\n\nSie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.`,
    },
    publishedAt: "2026-11-11T08:30:00.000Z",
    published: true,
  },
];

// --- Customers, sessions, carts (doc 1, 2, 8) --------------------------------

/** One product on a wishlist (doc 16), with the size it was saved from. */
export interface WishlistRecord {
  productId: string;
  variantId: string | null;
  addedAt: string;
}

/** One of a customer's lists (doc 16.2); the default is the heart's list. */
export interface WishlistListRecord {
  id: string;
  name: string;
  isDefault: boolean;
  /** Newest first, at most 200. */
  items: WishlistRecord[];
  createdAt: string;
  updatedAt: string;
}

/**
 * A sign-up that waits for its code (doc 1). The code is kept as typed:
 * this is a mock, and the tests read it from `GET /__mock/tokens`.
 */
export interface PendingSignupRecord {
  email: string;
  firstName: string;
  lastName: string;
  locale: Locale;
  passwordHash: string;
  referralCode: string | null;
  code: string;
  expiresAt: number;
  attemptsLeft: number;
  /** How many more codes went out for this sign-up. */
  resends: number;
  lastSentAt: number;
}

/** A customer's review of a delivered order (doc ORDER_REVIEWS); shown once published. */
export interface ReviewRecord {
  id: string;
  customerId: string;
  orderNumber: string;
  rating: number;
  text: string;
  locale: Locale;
  status: "pending" | "published" | "rejected";
  rejectionNote: string | null;
  reply: { text: string; at: string } | null;
  writtenAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

/** A problem report after a delivery (doc 23). */
export interface IssueRecord {
  /** "RF-1084-P1". */
  issueNumber: string;
  orderNumber: string;
  customerId: string;
  status: "open" | "in_review" | "resolved" | "rejected" | "cancelled";
  reportedAt: string;
  decidedAt: string | null;
  items: {
    productId: string;
    variantId: string;
    sku: string;
    name: Translated;
    packValue: number;
    packUnit: "g" | "kg" | "ml" | "l" | "pcs";
    quantity: number;
    refundedQuantity: number;
    unitPrice: number;
  }[];
  problems: (
    "damaged" | "missing" | "wrong_item" | "not_fresh" | "late" | "other"
  )[];
  description: string;
  /** The photos, by id in `db.issueImages`. */
  imageIds: string[];
  preferredResolution: "refund" | "replacement" | "none";
  resolution: {
    type: "refund" | "replacement" | "none";
    amount: number;
    note: string | null;
    at: string;
  } | null;
  history: {
    status: IssueRecord["status"];
    at: string;
    by: "customer" | "admin" | "system";
    note: string | null;
  }[];
  locale: Locale;
}

/** One person invited by another (doc 21). */
export interface ReferralRecord {
  id: string;
  code: string;
  referrerId: string;
  referredId: string;
  status: "registered" | "qualified" | "void";
  registeredAt: string;
  orderNumber: string | null;
  qualifiedAt: string | null;
  voidReason: "refunded" | null;
  voidAt: string | null;
}

export interface CustomerRecord {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  locale: Locale;
  /**
   * The password, hashed; the mock never keeps it as typed. `null` for a
   * guest record (doc 20), which cannot sign in.
   */
  passwordHash: string | null;
  /** A record made by a guest checkout, until the person signs up (doc 20). */
  kind: "registered" | "guest";
  emailVerifiedAt: string | null;
  /** The code of the referral link (doc 21); `null` for a guest record. */
  referralCode: string | null;
  /** Closed for good (CUSTOMER_ACCOUNTS 3): everything personal is gone. */
  deletedAt: string | null;
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
  /** One line per pack size. */
  cart: { variantId: string; quantity: number }[];
  /** The discount code kept with the cart (doc 9.6), upper case, or `null`. */
  discountCode: string | null;
  /**
   * The coins chosen on the checkout page (REWARDS 5): a number, `null`
   * inside for "as many as allowed"; `null` while nothing was chosen.
   */
  rewardCoins: { requested: number | null } | null;
  addresses: Address[];
  /** Up to 20 lists; the default one is made on first use. */
  wishlists: WishlistListRecord[];
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
    variantId: string;
    sku: string;
    name: Translated;
    packValue: number;
    packUnit: "g" | "kg" | "ml" | "l" | "pcs";
    quantity: number;
    unitPrice: number;
    regularUnitPrice: number | null;
    lineTotal: number;
    vatRate: number;
    vatAmount: number;
    /** The item's share of the discount code; `0` without one. */
    discountAmount: number;
    /** The item's share of the redeemed coins; `0` without any (REWARDS 4). */
    rewardAmount: number;
    deliveredQuantity: number;
    returnedQuantity: number;
  }[];
  totals: Totals;
  /** The discount code of the order, or `null` (doc 9.6). */
  discount: OrderDiscount | null;
  /** The coins redeemed on the order, or `null` (REWARDS 4). */
  rewards: OrderRewards | null;
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
  /** The key that opens a guest order (doc 20); `null` for an account's order. */
  guestToken: string | null;
}

/** Order numbers continue after this one: the first order is RF-1085. */
const FIRST_ORDER_SEQUENCE = 1084;

/** An open link of the password reset email (doc 1), by its token. */
export interface PasswordResetRecord {
  customerId: string;
  createdAt: number;
  expiresAt: number;
}

/** The coins of one customer (REWARDS 4): the sums of the ledger. */
export interface RewardAccountRecord {
  customerId: string;
  /** Spendable; below zero after coins were taken back. */
  available: number;
  /** Held by orders that wait for their payment. */
  reserved: number;
  earned: number;
  redeemed: number;
  lastActivityAt: string | null;
}

/** One movement of the ledger, written once, with its key. */
export interface RewardTransactionRecord {
  id: string;
  customerId: string;
  type:
    | "welcome"
    | "order"
    | "referral_inviter"
    | "referral_invitee"
    | "review"
    | "redeem"
    | "redeem_return"
    | "reversal"
    | "adjustment"
    | "expiry";
  coins: number;
  state: "done" | "reserved" | "spent" | "released";
  key: string;
  orderNumber: string | null;
  reference: string | null;
  rate: number | null;
  reason: string | null;
  note: string | null;
  at: string;
}

export const db = {
  customers: new Map<string, CustomerRecord>(),
  sessions: new Set<SessionRecord>(),
  /** Sign-ups that wait for their code, by email (doc 1). */
  pendingSignups: new Map<string, PendingSignupRecord>(),
  /** Who invited whom (doc 21). */
  referrals: [] as ReferralRecord[],
  /** Reviews by id (doc ORDER_REVIEWS). */
  reviews: new Map<string, ReviewRecord>(),
  /** Problem reports by number (doc 23), and their photos by id. */
  issues: new Map<string, IssueRecord>(),
  issueImages: new Map<string, { type: string; data: Buffer }>(),
  /** Open links of the password reset email, by token. */
  passwordResets: new Map<string, PasswordResetRecord>(),
  /** When each customer asked for a link, for the limit of three per hour. */
  passwordResetRequests: new Map<string, number[]>(),
  /** By order number. Insertion order is the order of placement. */
  orders: new Map<string, OrderRecord>(),
  orderSequence: FIRST_ORDER_SEQUENCE,
  /** Invoices and credit notes by number, as the API shows them. */
  invoices: new Map<string, InvoiceDetail>(),
  invoiceSequence: 122,
  creditSequence: 6,
  /** Returns by return number. */
  returns: new Map<string, ReturnRequest>(),
  /** A test control: `false` answers no banners at all (doc 17). */
  bannersEnabled: true,
  /** The coins (REWARDS 4): one account per customer, and the ledger. */
  rewardAccounts: new Map<string, RewardAccountRecord>(),
  rewardTransactions: [] as RewardTransactionRecord[],
};

/** Signing in with this address answers `CUSTOMER_BLOCKED`. */
export const BLOCKED_EMAIL = "blocked@example.com";

export const ACCESS_TTL_SECONDS = Number(
  process.env.MOCK_ACCESS_TTL_SECONDS || 900,
);
export const REFRESH_TTL_SECONDS = 30 * 24 * 3600;
/** A password reset link is valid this long and works once (doc 1). */
export const RESET_TTL_SECONDS = 3600;
export const RESET_MAX_PER_HOUR = 3;

/** Eight letters and digits without the ones that look alike (doc 21). */
export function makeReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    randomBytes(8),
    (byte) => alphabet[byte % alphabet.length],
  ).join("");
}

/** The way the mock keeps passwords: never as typed, like the real API. */
export function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "passwort1",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyui",
  "qwertyuiop",
  "iloveyou",
  "letmein1",
  "welcome1",
  "admin123",
  "abcd1234",
]);

/**
 * Too easy to guess (doc 1, `PASSWORD_TOO_WEAK`): a common password, one
 * character repeated, or the customer's own address or its name part.
 */
export function isWeakPassword(password: string, email: string): boolean {
  const lower = password.toLowerCase();
  const name = email.split("@")[0].toLowerCase();
  return (
    COMMON_PASSWORDS.has(lower) ||
    /^(.)\1*$/.test(password) ||
    lower === email.toLowerCase() ||
    (name.length >= 3 && lower.includes(name))
  );
}

let customerSequence = 0;
export function newCustomer(input: {
  email: string;
  locale: Locale;
  firstName: string;
  lastName: string;
  /** `null` makes a guest record (doc 20). */
  passwordHash: string | null;
}): CustomerRecord {
  customerSequence += 1;
  const now = new Date().toISOString();
  const customer: CustomerRecord = {
    id: `66f1${customerSequence.toString(16).padStart(20, "0")}`,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: null,
    locale: input.locale,
    passwordHash: input.passwordHash,
    kind: input.passwordHash === null ? "guest" : "registered",
    emailVerifiedAt: input.passwordHash === null ? null : now,
    referralCode: input.passwordHash === null ? null : makeReferralCode(),
    deletedAt: null,
    blocked: false,
    communication: {
      whatsappNumber: null,
      whatsappOptIn: false,
      whatsappOptInAt: null,
      marketingOptIn: false,
      marketingOptInAt: null,
      marketingOptOutAt: null,
    },
    createdAt: now,
    cart: [],
    discountCode: null,
    rewardCoins: null,
    addresses: [],
    wishlists: [],
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
  db.pendingSignups.clear();
  db.referrals = [];
  db.reviews.clear();
  db.issues.clear();
  db.issueImages.clear();
  db.passwordResets.clear();
  db.passwordResetRequests.clear();
  db.orders.clear();
  db.orderSequence = FIRST_ORDER_SEQUENCE;
  db.invoices.clear();
  db.invoiceSequence = 122;
  db.creditSequence = 6;
  db.returns.clear();
  db.bannersEnabled = true;
  db.rewardAccounts.clear();
  db.rewardTransactions = [];
  customerSequence = 0;
}
