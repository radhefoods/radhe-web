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
/** `YYYY-MM-DD`, meant in the business time zone (Europe/Berlin). */
export type CalendarDay = string;
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
  returns: { windowDays: number };
}

export type LegalType = "terms" | "preorder_terms" | "privacy";

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

// --- 7 Catalogue and cargo --------------------------------------------------

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

export type OrderingReason =
  "ordering_closed" | "product_unavailable" | "not_in_this_cargo" | "sold_out";

export interface Ordering {
  canOrder: boolean;
  reason: OrderingReason | null;
  minQuantity: number;
  maxQuantity: number | null;
  remaining: number | null;
}

export interface Cargo {
  id: Id;
  code: string;
  name: string | null;
  message: string | null;
  orderOpenAt: IsoDateTime;
  orderCloseAt: IsoDateTime;
  opensInSeconds: number;
  closesInSeconds: number;
  delivery: { start: CalendarDay; end: CalendarDay };
}

export interface CargoStatus {
  acceptingOrders: boolean;
  current: Cargo | null;
  next: Cargo | null;
  serverTime: IsoDateTime;
  timezone: string;
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
  tag?: string;
  brand?: string;
  onSale?: boolean;
  available?: boolean;
  orderable?: boolean;
  featured?: boolean;
  minPrice?: Cents;
  maxPrice?: Cents;
  sort?: ProductSort;
  groupPackSizes?: boolean;
  page?: number;
  limit?: number;
}

// --- 8 Cart -----------------------------------------------------------------

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
  ordering: Ordering | null;
  product: ProductSummary | null;
}

/** The answer of every cart endpoint (8.1). */
export interface Bill {
  canOrder: boolean;
  cargo: Cargo | null;
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

// --- 9 Orders ---------------------------------------------------------------

export type OrderStatus =
  | "confirmed"
  | "preparing"
  | "dispatched"
  | "delivered"
  | "delivery_failed"
  | "returned"
  | "cancelled";

export type PaymentStatus =
  "not_enabled" | "due" | "overdue" | "paid" | "waived" | "refunded";

export type DeliveryMethod = "radhe_delivery" | "dhl" | "hermes";

export interface OrderDelivery {
  method: DeliveryMethod;
  trackingNumber: string | null;
  trackingUrl: string | null;
  dispatchedAt: IsoDateTime | null;
  deliveredAt: IsoDateTime | null;
  promisedStart: CalendarDay;
  promisedEnd: CalendarDay;
  cargo: string;
}

export interface OrderSummary {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  placedAt: IsoDateTime;
  total: Cents;
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

export type CancellationReason =
  | "changed_mind"
  | "ordered_by_mistake"
  | "wrong_items"
  | "delivery_too_late"
  | "other";

export interface OrderCancellation {
  reason: CancellationReason | string;
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
  canCancel: boolean;
  returns: { possible: boolean; until: IsoDateTime | null };
  cancellation: OrderCancellation | null;
  acceptedTerms: {
    at: IsoDateTime;
    documents: { type: LegalType; version: number }[];
  };
}

export type ConsentVersions = Partial<Record<LegalType, number>>;

export interface PlaceOrderInput {
  addressId: Id;
  expectedTotal: Cents;
  consent: { accepted: true; versions: ConsentVersions };
  note?: string;
  language?: Locale;
}

export interface PlaceOrderResult {
  created: boolean;
  order: OrderDetail;
}

export type OrderingBlockReason =
  "account_blocked" | "ordering_blocked" | "payment_overdue";

export interface OverdueOrder {
  orderNumber: string;
  invoiceNumber: string;
  amountDue: Cents;
  deadlineAt: IsoDateTime;
}

export interface OrderingPermission {
  canOrder: boolean;
  reason: OrderingBlockReason | null;
  overdue: OverdueOrder[];
}

// --- 10 Payments ------------------------------------------------------------

export type PaymentMethod = "stripe" | "cash" | "credit";

/**
 * Before activation only the first seven keys exist; the others are present
 * once an invoice was issued (10.1).
 */
export interface PaymentBlock {
  status: PaymentStatus;
  amountDue: Cents;
  invoice: { number: string; issuedAt: IsoDateTime; pdfPath: string } | null;
  deadline: IsoDateTime | null;
  paidAt: IsoDateTime | null;
  method: PaymentMethod | null;
  canPayOnline: boolean;
  invoicedAmount?: Cents;
  creditedAmount?: Cents;
  paidAmount?: Cents;
  refundedAmount?: Cents;
  isOverdue?: boolean;
  paymentType?: "card" | "paypal" | null;
  receiptUrl?: string | null;
  cashPossible?: boolean;
}

export interface OrderPayment {
  orderNumber: string;
  payment: PaymentBlock;
  documents: InvoiceSummary[];
}

export interface CheckoutSession {
  url: string;
  expiresAt: IsoDateTime;
}

export interface PayLink {
  orderNumber: string;
  firstName: string | null;
  language: Locale;
  payment: PaymentBlock;
}

// --- 11 Invoices and credit notes -------------------------------------------

export interface InvoiceSummary {
  id: Id;
  number: string;
  type: "invoice" | "credit_note";
  orderNumber: string;
  issuedAt: IsoDateTime;
  dueAt: IsoDateTime | null;
  paidAt: IsoDateTime | null;
  total: Cents;
  currency: "EUR";
  language: Locale;
  invoiceNumber: string | null;
  creditReason: "return" | "adjustment" | null;
}

export interface InvoiceDetail extends InvoiceSummary {
  orderId: Id;
  customerId: Id;
  cargoId: Id;
  deliveredOn: CalendarDay | null;
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
