// Turns the fixture records into the answers of the store API, in the shapes
// of doc/CUSTOMER_WEB_API_DOCUMENTATION.md. The rules (ordering block, bill,
// VAT, delivery fee, search) follow the documentation; where it leaves a
// detail open, the choice made here is noted.

import type {
  ApiImage,
  Bill,
  BillLine,
  Cargo,
  CargoStatus,
  CartItemInput,
  CartLineIssue,
  Category,
  CategoryDetail,
  Customer,
  LegalDocument,
  LegalSummary,
  Ordering,
  PackSize,
  PackSizeOption,
  Page,
  PriceView,
  ProductDetail,
  ProductQuery,
  ProductSummary,
  ShopSettings,
  Totals,
  VatGroup,
} from "../src/lib/api/types.ts";
import {
  cargoProducts,
  categories,
  products,
  type CategoryRecord,
  type ProductRecord,
  type Translated,
} from "./data/catalogue.ts";
import {
  TIMEZONE,
  currentCargo,
  legalDocuments,
  nextCargo,
  settings,
  type CargoRecord,
  type CustomerRecord,
  type LegalRecord,
  type Locale,
} from "./state.ts";

const pick = (value: Translated, locale: Locale): string =>
  value[locale] || value.en;
const pickOrNull = (value: Translated | null, locale: Locale): string | null =>
  value ? pick(value, locale) : null;

const productById = new Map(products.map((p) => [p.id, p]));
const categoryById = new Map(categories.map((c) => [c.id, c]));
const cargoProductById = new Map(cargoProducts.map((c) => [c.productId, c]));

export function findProduct(id: string): ProductRecord | undefined {
  return productById.get(id);
}

// --- Settings, legal, cargo -------------------------------------------------

export function freeDeliveryFrom(): number | null {
  const free = settings.deliveryFee.tiers
    .filter((tier) => tier.fee === 0)
    .map((tier) => tier.minOrderValue);
  return free.length ? Math.min(...free) : null;
}

export function settingsView(): ShopSettings {
  return {
    currency: "EUR",
    timezone: TIMEZONE,
    deliveryFee: {
      tiers: [...settings.deliveryFee.tiers].sort(
        (a, b) => a.minOrderValue - b.minOrderValue,
      ),
      freeFrom: freeDeliveryFrom(),
    },
    returns: { windowDays: settings.returns.windowDays },
  };
}

export function legalSummary(
  record: LegalRecord,
  locale: Locale,
): LegalSummary {
  return {
    type: record.type,
    version: record.version,
    title: pick(record.title, locale),
    publishedAt: record.publishedAt,
  };
}

export function legalList(locale: Locale): { items: LegalSummary[] } {
  return { items: legalDocuments.map((d) => legalSummary(d, locale)) };
}

export function legalDocument(
  type: string,
  locale: Locale,
): LegalDocument | null {
  const record = legalDocuments.find((d) => d.type === type);
  if (!record) return null;
  return {
    ...legalSummary(record, locale),
    content: pick(record.content, locale),
  };
}

function cargoView(record: CargoRecord, locale: Locale, now: Date): Cargo {
  const seconds = (to: Date) =>
    Math.max(0, Math.floor((to.getTime() - now.getTime()) / 1000));
  return {
    id: record.id,
    code: record.code,
    name: pickOrNull(record.name, locale),
    message: pickOrNull(record.message, locale),
    orderOpenAt: record.orderOpenAt.toISOString(),
    orderCloseAt: record.orderCloseAt.toISOString(),
    opensInSeconds: seconds(record.orderOpenAt),
    closesInSeconds: seconds(record.orderCloseAt),
    delivery: { start: record.deliveryStart, end: record.deliveryEnd },
  };
}

export function cargoStatus(locale: Locale): CargoStatus {
  const now = new Date();
  const current = currentCargo(now);
  const next = nextCargo();
  return {
    acceptingOrders: current !== null,
    current: current ? cargoView(current, locale, now) : null,
    next: next ? cargoView(next, locale, now) : null,
    serverTime: now.toISOString(),
    timezone: TIMEZONE,
  };
}

// --- Products ---------------------------------------------------------------

const UNIT_LABEL: Record<Locale, Record<ProductRecord["packUnit"], string>> = {
  en: { g: "g", kg: "kg", ml: "ml", l: "l", pcs: "pcs" },
  de: { g: "g", kg: "kg", ml: "ml", l: "l", pcs: "Stk." },
};

export function packSize(p: ProductRecord, locale: Locale): PackSize {
  const number = new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", {
    maximumFractionDigits: 3,
  }).format(p.packValue);
  return {
    value: p.packValue,
    unit: p.packUnit,
    label: `${number} ${UNIT_LABEL[locale][p.packUnit]}`,
  };
}

function effectivePrice(p: ProductRecord): number {
  return p.salePrice !== null && p.salePrice < p.regularPrice
    ? p.salePrice
    : p.regularPrice;
}

/** VAT inside a gross amount: `round(gross × rate / (10000 + rate))`. */
export function vatOf(gross: number, vatRate: number): number {
  return Math.round((gross * vatRate) / (10_000 + vatRate));
}

function priceView(p: ProductRecord): PriceView {
  const price = effectivePrice(p);
  const onSale = price < p.regularPrice;
  // The price per kilogram, litre or piece (German price-indication rule).
  const per =
    p.packUnit === "g" || p.packUnit === "kg"
      ? "kg"
      : p.packUnit === "ml" || p.packUnit === "l"
        ? "l"
        : "pcs";
  const amountInBase =
    p.packUnit === "g" || p.packUnit === "ml"
      ? p.packValue / 1000
      : p.packValue;
  return {
    currency: "EUR",
    price,
    regularPrice: p.regularPrice,
    salePrice: onSale ? price : null,
    onSale,
    discountPercent: onSale
      ? Math.floor(((p.regularPrice - price) * 100) / p.regularPrice)
      : 0,
    discountAmount: p.regularPrice - price,
    vatIncluded: true,
    vatRate: p.vatRate,
    vatPercent: p.vatRate / 100,
    vatAmount: vatOf(price, p.vatRate),
    basePrice: { amount: Math.round(price / amountInBase), per },
  };
}

/** The address of the mock itself, for the placeholder pictures. */
let mediaBase = "http://localhost:3000";
export function setMediaBase(url: string): void {
  mediaBase = url;
}

/** The address of a placeholder picture of the mock. */
export function productImageUrl(
  productId: string,
  size: "small" | "medium" | "large",
): string {
  return `${mediaBase}/media/products/${productId}/${size}.svg`;
}

function imageView(p: ProductRecord, locale: Locale): ApiImage {
  const url = (size: string) =>
    `${mediaBase}/media/products/${p.id}/${size}.svg`;
  return {
    id: p.id,
    alt: pick(p.name, locale),
    isPrimary: true,
    url: url("large"),
    sizes: {
      small: { url: url("small"), width: 320, height: 320 },
      medium: { url: url("medium"), width: 800, height: 800 },
      large: { url: url("large"), width: 1600, height: 1600 },
    },
  };
}

/** Whether, and how much of, a product can be ordered right now (doc 7.1). */
export function orderingOf(p: ProductRecord): Ordering {
  const closed = (reason: Ordering["reason"]): Ordering => ({
    canOrder: false,
    reason,
    minQuantity: p.minQuantity,
    maxQuantity: p.maxQuantity,
    remaining: null,
  });
  if (!currentCargo()) return closed("ordering_closed");
  if (!p.isAvailable) return closed("product_unavailable");
  const inCargo = cargoProductById.get(p.id);
  if (!inCargo) return closed("not_in_this_cargo");
  const remaining =
    inCargo.maxQuantity === null
      ? null
      : Math.max(0, inCargo.maxQuantity - inCargo.reservedQuantity);
  if (remaining === 0)
    return { ...closed("sold_out"), remaining: 0, maxQuantity: 0 };
  const limits = [p.maxQuantity, remaining].filter(
    (n): n is number => n !== null,
  );
  return {
    canOrder: true,
    reason: null,
    minQuantity: p.minQuantity,
    maxQuantity: limits.length ? Math.min(...limits) : null,
    remaining,
  };
}

function siblingsOf(p: ProductRecord): ProductRecord[] {
  return products
    .filter((other) => other.group === p.group)
    .sort((a, b) => baseAmount(a) - baseAmount(b));
}

function baseAmount(p: ProductRecord): number {
  return p.packUnit === "g" || p.packUnit === "ml"
    ? p.packValue / 1000
    : p.packValue;
}

function packSizeOptions(
  p: ProductRecord,
  locale: Locale,
  withOrdering: boolean,
): PackSizeOption[] {
  return siblingsOf(p).map((size) => ({
    id: size.id,
    sku: size.sku,
    slug: pick(size.slug, locale),
    packSize: packSize(size, locale),
    pricing: priceView(size),
    isAvailable: size.isAvailable,
    quantity: { min: size.minQuantity, max: size.maxQuantity },
    ordering: withOrdering ? orderingOf(size) : null,
    image: imageView(size, locale),
    isDefault: size.isDefaultSize,
    isSelected: size.id === p.id,
  }));
}

export function productSummary(
  p: ProductRecord,
  locale: Locale,
  options: { withOrdering?: boolean } = {},
): ProductSummary {
  const withOrdering = options.withOrdering ?? true;
  const category = categoryById.get(p.categoryId);
  return {
    id: p.id,
    sku: p.sku,
    slug: pick(p.slug, locale),
    name: pick(p.name, locale),
    subtitle: pickOrNull(p.subtitle, locale),
    shortDescription: pickOrNull(p.shortDescription, locale),
    brand: p.brand,
    category: category
      ? {
          id: category.id,
          slug: pick(category.slug, locale),
          name: pick(category.name, locale),
        }
      : null,
    packSize: packSize(p, locale),
    pricing: priceView(p),
    isAvailable: p.isAvailable,
    isFeatured: p.isFeatured,
    quantity: { min: p.minQuantity, max: p.maxQuantity },
    ordering: withOrdering ? orderingOf(p) : null,
    storageType: p.storageType,
    tags: p.tags,
    image: imageView(p, locale),
    packSizes: packSizeOptions(p, locale, withOrdering),
  };
}

function ancestorsOf(category: CategoryRecord): CategoryRecord[] {
  const chain: CategoryRecord[] = [category];
  let parent = category.parentId ? categoryById.get(category.parentId) : null;
  while (parent) {
    chain.unshift(parent);
    parent = parent.parentId ? categoryById.get(parent.parentId) : null;
  }
  return chain;
}

function breadcrumbsOf(category: CategoryRecord | undefined, locale: Locale) {
  if (!category) return [];
  return ancestorsOf(category).map((c) => ({
    id: c.id,
    slug: pick(c.slug, locale),
    name: pick(c.name, locale),
  }));
}

export function productDetail(p: ProductRecord, locale: Locale): ProductDetail {
  return {
    ...productSummary(p, locale),
    slugs: { en: p.slug.en, de: p.slug.de },
    gtin: p.gtin,
    description: pickOrNull(p.description, locale),
    highlights: p.highlights.map((h) => pick(h, locale)),
    uses: p.uses.map((u) => pick(u, locale)),
    images: [imageView(p, locale)],
    breadcrumbs: breadcrumbsOf(categoryById.get(p.categoryId), locale),
    food: {
      ingredients: pickOrNull(p.food.ingredients, locale),
      allergens: pickOrNull(p.food.allergens, locale),
      nutrition: pickOrNull(p.food.nutrition, locale),
      storageInstructions: pickOrNull(p.food.storageInstructions, locale),
      origin: pickOrNull(p.food.origin, locale),
      manufacturer: p.food.manufacturer,
    },
    seo: {
      title: `${pick(p.name, locale)} ${packSize(p, locale).label}`,
      description: pickOrNull(p.shortDescription, locale),
    },
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
  };
}

export function productBySlug(slug: string): ProductRecord | undefined {
  return products.find((p) => p.slug.en === slug || p.slug.de === slug);
}

// --- Categories -------------------------------------------------------------

function descendantIds(id: string): string[] {
  const children = categories.filter((c) => c.parentId === id);
  return [id, ...children.flatMap((c) => descendantIds(c.id))];
}

function categoryView(record: CategoryRecord, locale: Locale): Category {
  const ids = new Set(descendantIds(record.id));
  const name = pick(record.name, locale);
  const tagline = pickOrNull(record.tagline, locale);
  return {
    id: record.id,
    slug: pick(record.slug, locale),
    slugs: { en: record.slug.en, de: record.slug.de },
    name,
    tagline,
    description: pickOrNull(record.description, locale),
    parentId: record.parentId,
    level: ancestorsOf(record).length as 1 | 2 | 3,
    image: null,
    productCount: products.filter((p) => ids.has(p.categoryId)).length,
    seo: { title: name, description: tagline },
    children: categories
      .filter((c) => c.parentId === record.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => categoryView(c, locale)),
  };
}

export function categoryTree(locale: Locale): { items: Category[] } {
  return {
    items: categories
      .filter((c) => c.parentId === null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => categoryView(c, locale)),
  };
}

export function categoryBySlug(slug: string): CategoryRecord | undefined {
  return categories.find((c) => c.slug.en === slug || c.slug.de === slug);
}

export function categoryDetail(
  record: CategoryRecord,
  locale: Locale,
): CategoryDetail {
  return {
    ...categoryView(record, locale),
    breadcrumbs: breadcrumbsOf(record, locale),
  };
}

// --- Product listing --------------------------------------------------------

/** Lower case, umlauts and accents folded: "Müsli" → "musli". */
function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function matchesSearch(p: ProductRecord, q: string, locale: Locale): boolean {
  const haystack = fold(
    [
      pick(p.name, locale),
      p.name.en,
      p.subtitle ? pick(p.subtitle, locale) : "",
      p.sku,
      p.brand ?? "",
      ...p.tags,
      ...p.keywords,
    ].join(" "),
  ).split(/[^a-z0-9]+/);
  // Every word of the query must begin a word of the product.
  return fold(q)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .every((word) => haystack.some((h) => h.startsWith(word)));
}

export function listProducts(
  query: ProductQuery,
  locale: Locale,
): Page<ProductSummary> | { error: "CATEGORY_NOT_FOUND" } {
  let list = [...products];

  if (query.category) {
    const category = categoryBySlug(query.category);
    if (!category) return { error: "CATEGORY_NOT_FOUND" };
    const ids = new Set(descendantIds(category.id));
    list = list.filter((p) => ids.has(p.categoryId));
  }
  if (query.q) list = list.filter((p) => matchesSearch(p, query.q!, locale));
  if (query.tag) list = list.filter((p) => p.tags.includes(query.tag!));
  if (query.brand) list = list.filter((p) => p.brand === query.brand);
  if (query.onSale !== undefined) {
    list = list.filter((p) => priceView(p).onSale === query.onSale);
  }
  if (query.available !== undefined) {
    list = list.filter((p) => p.isAvailable === query.available);
  }
  if (query.orderable !== undefined) {
    list = list.filter((p) => orderingOf(p).canOrder === query.orderable);
  }
  if (query.featured !== undefined) {
    list = list.filter((p) => p.isFeatured === query.featured);
  }
  if (query.minPrice !== undefined) {
    list = list.filter((p) => effectivePrice(p) >= query.minPrice!);
  }
  if (query.maxPrice !== undefined) {
    list = list.filter((p) => effectivePrice(p) <= query.maxPrice!);
  }

  if (query.groupPackSizes ?? true) {
    // A product with several pack sizes appears once: its default size when
    // that one passed the filters, otherwise the first size that did.
    const byGroup = new Map<string, ProductRecord>();
    for (const p of list) {
      const chosen = byGroup.get(p.group);
      if (!chosen || (p.isDefaultSize && !chosen.isDefaultSize)) {
        byGroup.set(p.group, p);
      }
    }
    list = [...byGroup.values()];
  }

  const byName = (a: ProductRecord, b: ProductRecord) =>
    pick(a.name, locale).localeCompare(pick(b.name, locale), locale);
  const sorters: Record<
    string,
    (a: ProductRecord, b: ProductRecord) => number
  > = {
    recommended: (a, b) =>
      Number(b.isFeatured) - Number(a.isFeatured) || a.sortOrder - b.sortOrder,
    newest: (a, b) => b.publishedAt.localeCompare(a.publishedAt),
    price_asc: (a, b) => effectivePrice(a) - effectivePrice(b),
    price_desc: (a, b) => effectivePrice(b) - effectivePrice(a),
    discount: (a, b) =>
      priceView(b).discountPercent - priceView(a).discountPercent ||
      a.sortOrder - b.sortOrder,
    name: byName,
  };
  list.sort(sorters[query.sort ?? "recommended"]);

  const page = query.page ?? 1;
  const limit = query.limit ?? 24;
  const total = list.length;
  return {
    items: list
      .slice((page - 1) * limit, page * limit)
      .map((p) => productSummary(p, locale)),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// --- The bill (doc 8.1) -----------------------------------------------------

function deliveryFeeFor(subtotal: number): number {
  // The highest tier whose minimum the value of the goods reaches.
  const tier = [...settings.deliveryFee.tiers]
    .sort((a, b) => b.minOrderValue - a.minOrderValue)
    .find((t) => subtotal >= t.minOrderValue);
  return tier ? tier.fee : 0;
}

function totalsOf(lines: BillLine[]): Totals {
  const orderable = lines.filter((line) => line.issue === null);
  const subtotal = orderable.reduce((sum, line) => sum + line.lineTotal, 0);
  // Nothing to deliver, nothing to charge for delivery.
  const deliveryFee = orderable.length ? deliveryFeeFor(subtotal) : 0;

  // Goods per VAT rate; the delivery fee is shared across the rates by the
  // net value of the goods, the last rate takes the rounding rest.
  const goods = new Map<number, number>();
  for (const line of orderable) {
    goods.set(line.vatRate, (goods.get(line.vatRate) ?? 0) + line.lineTotal);
  }
  const rates = [...goods.keys()].sort((a, b) => a - b);
  const netOfGoods = rates.map(
    (rate) => goods.get(rate)! - vatOf(goods.get(rate)!, rate),
  );
  const netSum = netOfGoods.reduce((a, b) => a + b, 0);
  let feeLeft = deliveryFee;
  const vat: VatGroup[] = rates.map((rate, index) => {
    const share =
      index === rates.length - 1
        ? feeLeft
        : Math.round((deliveryFee * netOfGoods[index]) / (netSum || 1));
    feeLeft -= share;
    const gross = goods.get(rate)! + share;
    const vatAmount = vatOf(gross, rate);
    return {
      vatRate: rate,
      vatPercent: rate / 100,
      gross,
      net: gross - vatAmount,
      vat: vatAmount,
    };
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

function lineOf(item: CartItemInput, locale: Locale): BillLine {
  const p = findProduct(item.productId);
  if (!p) {
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: 0,
      lineTotal: 0,
      vatRate: 0,
      vatAmount: 0,
      issue: "product_not_found",
      ordering: null,
      product: null,
    };
  }
  const ordering = orderingOf(p);
  let issue: CartLineIssue | null = null;
  if (!ordering.canOrder) issue = ordering.reason;
  else if (item.quantity < ordering.minQuantity)
    issue = "quantity_below_minimum";
  else if (
    ordering.maxQuantity !== null &&
    item.quantity > ordering.maxQuantity
  ) {
    issue = "quantity_above_maximum";
  }
  const unitPrice = effectivePrice(p);
  const lineTotal = unitPrice * item.quantity;
  return {
    productId: p.id,
    quantity: item.quantity,
    unitPrice,
    lineTotal,
    vatRate: p.vatRate,
    vatAmount: vatOf(lineTotal, p.vatRate),
    issue,
    ordering,
    // Inside a line the product's own `ordering` is always null.
    product: productSummary(p, locale, { withOrdering: false }),
  };
}

export function billOf(items: CartItemInput[], locale: Locale): Bill {
  const now = new Date();
  const cargo = currentCargo(now);
  const lines = items.map((item) => lineOf(item, locale));
  const totals = totalsOf(lines);
  const freeFrom = freeDeliveryFrom();
  return {
    canOrder:
      cargo !== null &&
      lines.length > 0 &&
      lines.every((line) => line.issue === null),
    cargo: cargo ? cargoView(cargo, locale, now) : null,
    lines,
    totals,
    delivery: {
      fee: totals.deliveryFee,
      freeFrom,
      missingForFree:
        freeFrom === null ? null : Math.max(0, freeFrom - totals.subtotal),
    },
  };
}

// --- Customer ---------------------------------------------------------------

export function customerView(record: CustomerRecord): Customer {
  return {
    id: record.id,
    email: record.email,
    firstName: record.firstName,
    lastName: record.lastName,
    phone: record.phone,
    locale: record.locale,
    hasGoogleLogin: record.hasGoogleLogin,
    communication: { ...record.communication },
    createdAt: record.createdAt,
  };
}

/** A placeholder picture: the tint of the product and its initials. */
export function placeholderSvg(productId: string, size: number): string | null {
  const p = findProduct(productId);
  if (!p) return null;
  const initials = p.name.en
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 400 400"><rect width="400" height="400" fill="${p.tint}"/><circle cx="200" cy="190" r="96" fill="#ffffff" fill-opacity="0.55"/><text x="200" y="212" font-family="Georgia, serif" font-size="64" text-anchor="middle" fill="#020E43" fill-opacity="0.7">${initials}</text><text x="200" y="352" font-family="Arial, sans-serif" font-size="18" text-anchor="middle" fill="#020E43" fill-opacity="0.5">mock picture</text></svg>`;
}
