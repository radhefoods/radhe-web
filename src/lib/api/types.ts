// The shapes of the Radhe Foods store API, written from
// doc/CUSTOMER_WEB_API_DOCUMENTATION.md (the authority). Section numbers in
// the comments refer to that document. Nothing here is invented: when the API
// changes, this file changes with it.

import type { Locale } from "@/i18n/routing";

// --- 0.7 Data formats -------------------------------------------------------

/** MongoDB ObjectId, 24 hex characters. */
export type Id = string;
/** Integer cents in EUR, VAT included. Never a float. */
export type Cents = number;
/** ISO 8601 date-time in UTC. */
export type IsoDateTime = string;
/** Hundredths of a percent: 700 = 7 %. */
export type VatRate = number;

// --- 0.8 Pagination ---------------------------------------------------------

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

// --- 1, 2 Customer ----------------------------------------------------------

export interface Communication {
  whatsappNumber: string | null;
  whatsappOptIn: boolean;
  whatsappOptInAt: IsoDateTime | null;
  marketingOptIn: boolean;
  marketingOptInAt: IsoDateTime | null;
  marketingOptOutAt: IsoDateTime | null;
}

export interface Customer {
  id: Id;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  locale: Locale;
  hasGoogleLogin: boolean;
  communication: Communication;
  createdAt: IsoDateTime;
}

export interface OtpRequestResult {
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export interface SessionResult {
  customer: Customer;
  accessTokenExpiresInSeconds: number;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  locale?: Locale;
}

export interface UpdateCommunicationInput {
  whatsappNumber?: string | null;
  whatsappOptIn?: boolean;
  marketingOptIn?: boolean;
}

// --- 3 Addresses ------------------------------------------------------------

export interface Address {
  id: Id;
  firstName: string;
  lastName: string;
  company: string | null;
  street: string;
  houseNumber: string;
  additionalLine: string | null;
  postalCode: string;
  city: string;
  countryCode: "DE";
  phone: string | null;
  isDefault: boolean;
}

export interface AddressInput {
  firstName: string;
  lastName: string;
  company?: string | null;
  street: string;
  houseNumber: string;
  additionalLine?: string | null;
  postalCode: string;
  city: string;
  countryCode?: "DE";
  phone?: string | null;
  isDefault?: boolean;
}

export interface AddressList {
  items: Address[];
}

// --- 4 Unsubscribe ----------------------------------------------------------

export interface UnsubscribeResult {
  email: string;
  marketingOptIn: false;
}

// --- 6 Settings and legal texts ---------------------------------------------

export interface DeliveryFeeTier {
  minOrderValue: Cents;
  fee: Cents;
}

export interface ShopSettings {
  currency: "EUR";
  timezone: string;
  deliveryFee: {
    tiers: DeliveryFeeTier[];
    freeFrom: Cents | null;
  };
  /** How long delivery takes, as Radhe Foods words it, in both languages. */
  delivery: { estimate: Record<Locale, string> };
  /** Days after delivery for a return; `0` switches returns off. */
  returns: { windowDays: number };
}

/** Both must be published before any order can be placed. */
export type LegalType = "terms" | "privacy";

export interface LegalSummary {
  type: LegalType;
  version: number;
  title: string;
  publishedAt: IsoDateTime;
}

export interface LegalDocument extends LegalSummary {
  /** Plain text or Markdown, as the admin entered it. */
  content: string;
}

// --- 7 Catalogue ------------------------------------------------------------

export type BasePriceUnit = "kg" | "l" | "pcs";

export interface PriceView {
  currency: "EUR";
  price: Cents;
  regularPrice: Cents;
  salePrice: Cents | null;
  onSale: boolean;
  discountPercent: number;
  discountAmount: Cents;
  vatIncluded: boolean;
  vatRate: VatRate;
  vatPercent: number;
  vatAmount: Cents;
  basePrice: { amount: Cents; per: BasePriceUnit };
}

export type PackUnit = "g" | "kg" | "ml" | "l" | "pcs";

export interface PackSize {
  value: number;
  unit: PackUnit;
  /** Localized, for example "0,5 kg". */
  label: string;
}

export interface ImageVariant {
  url: string;
  width: number;
  height: number;
}

export interface ApiImage {
  id: Id;
  alt: string;
  isPrimary: boolean;
  /** The largest variant. */
  url: string;
  sizes: {
    small: ImageVariant;
    medium: ImageVariant;
    large: ImageVariant;
  };
}

/**
 * `product_unavailable`: Radhe Foods switched the product off for ordering.
 * `sold_out`: the stock does not cover the smallest order.
 */
export type OrderingReason = "product_unavailable" | "sold_out";

/**
 * Whether a product can be put in an order at this moment (7.1). `canOrder`
 * is the state of the add-to-cart button. `maxQuantity` is the product's
 * limit per order capped by the stock, `0` when sold out. `remaining` is the
 * stock; nothing is reserved before a payment goes through, so it can still
 * change.
 */
export interface Ordering {
  canOrder: boolean;
  reason: OrderingReason | null;
  minQuantity: number;
  maxQuantity: number;
  remaining: number;
}

export interface Seo {
  title: string | null;
  description: string | null;
}

export interface LocalizedSlugs {
  en: string;
  de: string;
}

export interface Category {
  id: Id;
  slug: string;
  slugs: LocalizedSlugs;
  name: string;
  tagline: string | null;
  description: string | null;
  parentId: Id | null;
  level: 1 | 2 | 3;
  image: ApiImage | null;
  productCount: number;
  seo: Seo;
  children: Category[];
}

export interface Breadcrumb {
  id: Id;
  slug: string;
  name: string;
}

export interface CategoryDetail extends Category {
  breadcrumbs: Breadcrumb[];
}

export type StorageType = "ambient" | "chilled" | "frozen";

export interface QuantityLimits {
  min: number;
  max: number | null;
}

export interface PackSizeOption {
  id: Id;
  sku: string;
  slug: string;
  packSize: PackSize;
  pricing: PriceView;
  isAvailable: boolean;
  quantity: QuantityLimits;
  ordering: Ordering | null;
  image: ApiImage | null;
  isDefault: boolean;
  isSelected: boolean;
}

export interface ProductSummary {
  id: Id;
  sku: string;
  slug: string;
  name: string;
  subtitle: string | null;
  shortDescription: string | null;
  brand: string | null;
  category: { id: Id; slug: string; name: string } | null;
  packSize: PackSize;
  pricing: PriceView;
  /** The admin's switch; use `ordering` for the button. */
  isAvailable: boolean;
  isFeatured: boolean;
  quantity: QuantityLimits;
  /** `null` inside a cart line: use the line's own `ordering` there. */
  ordering: Ordering | null;
  storageType: StorageType;
  tags: string[];
  image: ApiImage | null;
  packSizes: PackSizeOption[];
}

export interface ProductDetail extends ProductSummary {
  slugs: LocalizedSlugs;
  gtin: string | null;
  description: string | null;
  highlights: string[];
  uses: string[];
  images: ApiImage[];
  breadcrumbs: Breadcrumb[];
  food: {
    ingredients: string | null;
    allergens: string | null;
    nutrition: string | null;
    storageInstructions: string | null;
    origin: string | null;
    manufacturer: string | null;
  };
  seo: Seo;
  publishedAt: IsoDateTime | null;
  updatedAt: IsoDateTime;
}

export type ProductSort =
  "recommended" | "newest" | "price_asc" | "price_desc" | "discount" | "name";

export interface ProductQuery {
  category?: string;
  q?: string;
  /** Labels, any of them. */
  tag?: string[];
  /** Brands, any of them. */
  brand?: string[];
  /** Any of them. */
  storageType?: StorageType[];
  /** Value and unit without a space (`500g`, `1kg`, `0.5l`, `6pcs`), any of them. */
  packSize?: string[];
  onSale?: boolean;
  available?: boolean;
  /** `true`: only products that can be ordered now (switched on, in stock). */
  orderable?: boolean;
  featured?: boolean;
  minPrice?: Cents;
  maxPrice?: Cents;
  sort?: ProductSort;
  groupPackSizes?: boolean;
  page?: number;
  limit?: number;
}

/** One value of a facet and how many products choosing it would leave. */
export interface FacetCount<T> {
  value: T;
  count: number;
}

export interface PackSizeFacet extends FacetCount<string> {
  /** The size to show; `value` is what goes into `packSize`. */
  packSize: PackSize;
}

/** A fixed price band in cents, both ends inclusive; `max` is `null` for the last. */
export interface PriceBand {
  min: Cents;
  max: Cents | null;
  count: number;
}

/**
 * The counts behind the filters (`GET /v1/store/products/facets`). Each
 * facet is counted without its own filter and with all the others, so a
 * count says what choosing that value would leave. `total` is the total
 * of the list with every filter.
 */
export interface ProductFacets {
  total: number;
  brands: FacetCount<string>[];
  tags: FacetCount<string>[];
  storageTypes: FacetCount<StorageType>[];
  packSizes: PackSizeFacet[];
  priceBands: PriceBand[];
  /** The cheapest and the dearest product under the other filters. */
  price: { min: Cents; max: Cents } | null;
  onSale: FacetCount<boolean>[];
  orderable: FacetCount<boolean>[];
}

// --- 8 Cart -----------------------------------------------------------------

/**
 * Why a line cannot be ordered as it is. `quantity_above_maximum` also
 * means "more than in stock".
 */
export type CartLineIssue =
  | OrderingReason
  | "product_not_found"
  | "quantity_below_minimum"
  | "quantity_above_maximum";

export interface VatGroup {
  vatRate: VatRate;
  /** Present on the bill; absent on order and invoice totals. */
  vatPercent?: number;
  gross: Cents;
  net: Cents;
  vat: Cents;
}

export interface Totals {
  currency: "EUR";
  subtotal: Cents;
  deliveryFee: Cents;
  total: Cents;
  netTotal: Cents;
  vatTotal: Cents;
  vat: VatGroup[];
}

export interface BillLine {
  productId: Id;
  quantity: number;
  unitPrice: Cents;
  lineTotal: Cents;
  vatRate: VatRate;
  vatAmount: Cents;
  issue: CartLineIssue | null;
  /** `null` when the product no longer exists. */
  ordering: Ordering | null;
  product: ProductSummary | null;
}

/**
 * The answer of every cart endpoint (8.1). `canOrder` is `true` only when
 * the cart is not empty and every line is free of issues: the state of the
 * checkout button.
 */
export interface Bill {
  canOrder: boolean;
  lines: BillLine[];
  totals: Totals;
  delivery: {
    fee: Cents;
    freeFrom: Cents | null;
    missingForFree: Cents | null;
  };
}

export interface CartItemInput {
  productId: Id;
  quantity: number;
}

// --- 9 Orders and checkout --------------------------------------------------

/**
 * `pending_payment` waits for the payment; the payment confirms the order.
 * Radhe Foods can step one status back to correct a mistake (13).
 */
export type OrderStatus =
  | "pending_payment"
  | "confirmed"
  | "processing"
  | "dispatched"
  | "delivered"
  | "returned"
  | "cancelled";

/**
 * `authorized` lasts moments: the bank approved, the API takes the stock
 * and captures. `failed`: the last attempt did not go through; a new page
 * sets it back to `pending`. Partial refunds keep `paid`.
 */
export type PaymentStatus =
  "pending" | "authorized" | "paid" | "failed" | "refunded";

/** Chosen by Radhe Foods, never by the customer. */
export type DeliveryMethod = "radhe_delivery" | "dhl" | "hermes";

/**
 * There is no promised date: the delivery estimate comes from the
 * settings (6). `trackingUrl` is `null` for `radhe_delivery`.
 */
export interface OrderDelivery {
  method: DeliveryMethod;
  trackingNumber: string | null;
  trackingUrl: string | null;
  dispatchedAt: IsoDateTime | null;
  deliveredAt: IsoDateTime | null;
}

export interface OrderSummary {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  /** When the checkout started. */
  placedAt: IsoDateTime;
  /** The agreed bill. */
  total: Cents;
  /** The bill after corrections and returns. */
  finalTotal: Cents;
  currency: "EUR";
  itemCount: number;
  preview: { name: string; imageUrl: string | null }[];
  delivery: OrderDelivery;
}

export interface OrderItem {
  productId: Id;
  sku: string;
  name: string;
  packSize: PackSize;
  imageUrl: string | null;
  quantity: number;
  unitPrice: Cents;
  regularUnitPrice: Cents | null;
  lineTotal: Cents;
  vatRate: VatRate;
  vatPercent: number;
  vatAmount: Cents;
  deliveredQuantity: number;
  returnedQuantity: number;
  finalLineTotal: Cents;
}

export type AdjustmentReason =
  "missing" | "damaged" | "wrong_item" | "customer_complaint" | "other";

export interface OrderAdjustment {
  productId: Id;
  sku: string;
  from: number;
  to: number;
  reason: AdjustmentReason;
  at: IsoDateTime;
}

/** `company`, `additionalLine`, `phone` are absent when they were not set. */
export interface OrderAddress {
  firstName: string;
  lastName: string;
  company?: string;
  street: string;
  houseNumber: string;
  additionalLine?: string;
  postalCode: string;
  city: string;
  countryCode: "DE";
  phone?: string;
}

/** The reasons the shop sends (`by: "customer"`). */
export type CustomerCancellationReason =
  | "changed_mind"
  | "ordered_by_mistake"
  | "wrong_items"
  | "delivery_too_late"
  | "other";

/** Every reason an order can carry, by who cancelled it (13). */
export type CancellationReason =
  | CustomerCancellationReason
  // by Radhe Foods
  | "customer_request"
  | "product_unavailable"
  | "duplicate_order"
  | "suspected_misuse"
  // by the API
  | "payment_not_completed"
  | "sold_out";

export interface OrderCancellation {
  reason: CancellationReason;
  /** Only shown when `by` is `customer`. */
  text?: string | null;
  by: "customer" | "admin" | "system";
  at: IsoDateTime;
}

export interface OrderDetail extends OrderSummary {
  language: Locale;
  items: OrderItem[];
  totals: Totals;
  finalTotals: Totals;
  adjustments: OrderAdjustment[];
  deliveryAddress: OrderAddress;
  note: string | null;
  payment: PaymentBlock;
  /** Always while `pending_payment`; for a paid order by the shop's rule (9.5). */
  canCancel: boolean;
  returns: { possible: boolean; until: IsoDateTime | null };
  cancellation: OrderCancellation | null;
  acceptedTerms: {
    at: IsoDateTime;
    documents: { type: LegalType; version: number }[];
  };
}

export type ConsentVersions = Partial<Record<LegalType, number>>;

/** Body of `POST /v1/store/checkout`; the `Idempotency-Key` travels as a header. */
export interface CheckoutInput {
  addressId: Id;
  /** `totals.total` of the bill the customer saw. */
  expectedTotal: Cents;
  consent: { accepted: true; versions: ConsentVersions };
  note?: string;
  language?: Locale;
}

/** `created` is `false` when the same key was seen before. */
export interface CheckoutResult {
  created: boolean;
  order: OrderDetail;
  checkout: CheckoutSession;
}

// --- 10 Payments ------------------------------------------------------------

/** The Stripe payment method, once paid. */
export type PaymentMethod = "card" | "paypal";

/** A payment page: the answer of the checkout and of `POST …/pay`. */
export interface CheckoutSession {
  url: string;
  expiresAt: IsoDateTime;
}

/** `order.payment`, and the `payment` of `GET …/payment` (10.1). */
export interface PaymentBlock {
  status: PaymentStatus;
  /** The total to pay, agreed at checkout. */
  amount: Cents;
  paidAmount: Cents;
  /** Sum of the credit notes issued after the invoice. */
  creditedAmount: Cents;
  /** Sum of the refunds Radhe Foods completed. */
  refundedAmount: Cents;
  method: PaymentMethod | null;
  paidAt: IsoDateTime | null;
  receiptUrl: string | null;
  /** Once paid. `pdfPath` is relative to the API base URL and needs the session. */
  invoice: { number: string; issuedAt: IsoDateTime; pdfPath: string } | null;
  /** While a payment page is open and not expired. */
  checkout: CheckoutSession | null;
  /** Show "Pay now" only when `true`. */
  canPayOnline: boolean;
  /** English, for developers; the shop shows a generic message. */
  lastFailure: string | null;
}

export interface OrderPayment {
  orderNumber: string;
  status: OrderStatus;
  payment: PaymentBlock;
  /** The invoice and its credit notes, oldest first; empty while not paid. */
  documents: InvoiceSummary[];
}

// --- 11 Invoices and credit notes -------------------------------------------

export interface InvoiceSummary {
  id: Id;
  number: string;
  type: "invoice" | "credit_note";
  orderNumber: string;
  issuedAt: IsoDateTime;
  /** An invoice is paid when it is issued; `null` on a credit note. */
  paidAt: IsoDateTime | null;
  total: Cents;
  currency: "EUR";
  language: Locale;
  /** On a credit note: the invoice it corrects. */
  invoiceNumber: string | null;
  creditReason: "return" | "adjustment" | null;
}

export interface InvoiceDetail extends InvoiceSummary {
  orderId: Id;
  customerId: Id;
  /** On a credit note: the return number or the corrected product with the reason. */
  creditReference: string | null;
  seller: {
    name: string;
    addressLines: string[];
    email: string | null;
    phone: string | null;
    website: string | null;
    vatId: string | null;
    taxNumber: string | null;
    registration: string | null;
  };
  customer: {
    name: string;
    company: string | null;
    addressLines: string[];
    email: string;
  };
  lines: {
    description: string;
    sku: string;
    quantity: number;
    unitPrice: Cents;
    vatRate: VatRate;
    vatPercent: number;
    lineTotal: Cents;
  }[];
  totals: Totals;
  footer: string | null;
}

// --- 12 Returns -------------------------------------------------------------

export type ReturnStatus =
  "requested" | "approved" | "rejected" | "completed" | "cancelled";

export type ReturnReason =
  | "damaged"
  | "wrong_item"
  | "quality"
  | "not_as_described"
  | "changed_mind"
  | "other";

export interface ReturnItem {
  productId: Id;
  sku: string;
  name: string;
  packSize: PackSize;
  quantity: number;
  approvedQuantity: number | null;
  unitPrice: Cents;
  reason: ReturnReason;
  comment: string | null;
}

export interface ReturnRequest {
  returnNumber: string;
  orderNumber: string;
  status: ReturnStatus;
  requestedAt: IsoDateTime;
  decidedAt: IsoDateTime | null;
  completedAt: IsoDateTime | null;
  items: ReturnItem[];
  comment: string | null;
  answer: string | null;
  creditAmount: Cents | null;
  canCancel: boolean;
}

export interface OrderReturns {
  items: ReturnRequest[];
  returnable: { productId: Id; sku: string; available: number }[];
}

export interface CreateReturnInput {
  items: {
    productId: Id;
    quantity: number;
    reason: ReturnReason;
    comment?: string;
  }[];
  comment?: string;
  locale?: Locale;
}
