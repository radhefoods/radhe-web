// Turns the fixture records into the answers of the store API, in the shapes
// of doc/CUSTOMER_WEB_API_DOCUMENTATION.md. The rules (ordering block, bill,
// VAT, delivery fee, search) follow the documentation; where it leaves a
// detail open, the choice made here is noted.

import type {
  ApiImage,
  Bill,
  BillLine,
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
  ProductFacets,
  ProductQuery,
  ProductSummary,
  ShopSettings,
  Totals,
  VatGroup,
} from "../src/lib/api/types.ts";
import {
  categories,
  products,
  type CategoryRecord,
  type ProductRecord,
  type Translated,
} from "./data/catalogue.ts";
import {
  TIMEZONE,
  legalDocuments,
  settings,
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

export function findProduct(id: string): ProductRecord | undefined {
  return productById.get(id);
}

// --- Settings and legal texts -----------------------------------------------

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
    delivery: { estimate: { ...settings.delivery.estimate } },
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
/**
 * Whether a product can be ordered right now (doc 7.1): switched on by the
 * admin, and the stock covers the smallest order. `maxQuantity` is the
 * product's limit per order capped by the stock, 0 when sold out. Nothing
 * is reserved before a payment, so `remaining` is what everyone sees.
 */
export function orderingOf(p: ProductRecord): Ordering {
  const remaining = p.stock;
  const cap =
    p.maxQuantity === null ? remaining : Math.min(p.maxQuantity, remaining);
  if (!p.isAvailable) {
    return {
      canOrder: false,
      reason: "product_unavailable",
      minQuantity: p.minQuantity,
      maxQuantity: cap,
      remaining,
    };
  }
  if (remaining < p.minQuantity) {
    return {
      canOrder: false,
      reason: "sold_out",
      minQuantity: p.minQuantity,
      maxQuantity: 0,
      remaining,
    };
  }
  return {
    canOrder: true,
    reason: null,
    minQuantity: p.minQuantity,
    maxQuantity: cap,
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

const PACK_KEY = (p: ProductRecord): string => `${p.packValue}${p.packUnit}`;

/** The filters of a list, without its paging and sorting. */
type Filters = Omit<ProductQuery, "sort" | "page" | "limit" | "groupPackSizes">;
/** A facet is counted without its own filter: the one to leave out. */
type Skipped =
  | "tag"
  | "brand"
  | "storageType"
  | "packSize"
  | "onSale"
  | "orderable"
  | "price";

/** Every pack-size record that passes the filters, in catalogue order. */
function filterRecords(
  query: Filters,
  locale: Locale,
  skip: Skipped | null = null,
): ProductRecord[] | { error: "CATEGORY_NOT_FOUND" } {
  let list = [...products];
  const on = (key: Skipped) => key !== skip;

  if (query.category) {
    const category = categoryBySlug(query.category);
    if (!category) return { error: "CATEGORY_NOT_FOUND" };
    const ids = new Set(descendantIds(category.id));
    list = list.filter((p) => ids.has(p.categoryId));
  }
  if (query.q) list = list.filter((p) => matchesSearch(p, query.q!, locale));
  // The values of one parameter are "any of them"; parameters narrow down.
  if (on("tag") && query.tag?.length) {
    const tags = query.tag;
    list = list.filter((p) => tags.some((tag) => p.tags.includes(tag)));
  }
  if (on("brand") && query.brand?.length) {
    const brands = query.brand;
    list = list.filter((p) => p.brand !== null && brands.includes(p.brand));
  }
  if (on("storageType") && query.storageType?.length) {
    const types = query.storageType;
    list = list.filter((p) => types.includes(p.storageType));
  }
  if (on("packSize") && query.packSize?.length) {
    const sizes = query.packSize;
    list = list.filter((p) => sizes.includes(PACK_KEY(p)));
  }
  if (on("onSale") && query.onSale !== undefined) {
    list = list.filter((p) => priceView(p).onSale === query.onSale);
  }
  if (query.available !== undefined) {
    list = list.filter((p) => p.isAvailable === query.available);
  }
  if (on("orderable") && query.orderable !== undefined) {
    list = list.filter((p) => orderingOf(p).canOrder === query.orderable);
  }
  if (query.featured !== undefined) {
    list = list.filter((p) => p.isFeatured === query.featured);
  }
  if (on("price") && query.minPrice !== undefined) {
    list = list.filter((p) => effectivePrice(p) >= query.minPrice!);
  }
  if (on("price") && query.maxPrice !== undefined) {
    list = list.filter((p) => effectivePrice(p) <= query.maxPrice!);
  }
  return list;
}

/**
 * A product with several pack sizes appears once: its default size when
 * that one passed the filters, otherwise the first size that did (so a
 * pack-size filter shows the matching size).
 */
function groupRecords(list: ProductRecord[]): ProductRecord[] {
  const byGroup = new Map<string, ProductRecord>();
  for (const p of list) {
    const chosen = byGroup.get(p.group);
    if (!chosen || (p.isDefaultSize && !chosen.isDefaultSize)) {
      byGroup.set(p.group, p);
    }
  }
  return [...byGroup.values()];
}

export function listProducts(
  query: ProductQuery,
  locale: Locale,
): Page<ProductSummary> | { error: "CATEGORY_NOT_FOUND" } {
  const records = filterRecords(query, locale);
  if ("error" in records) return records;
  let list = records;
  if (query.groupPackSizes ?? true) list = groupRecords(list);

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

/** Fixed price bands in cents, both ends inclusive; the last one is open. */
const PRICE_BANDS: [number, number | null][] = [
  [0, 199],
  [200, 499],
  [500, 999],
  [1000, 1999],
  [2000, 4999],
  [5000, null],
];
const UNIT_RANK: Record<ProductRecord["packUnit"], number> = {
  g: 0,
  kg: 0,
  ml: 1,
  l: 1,
  pcs: 2,
};

/** Counts per value over the products (one per group), most first. */
function countBy<T extends string>(
  list: ProductRecord[],
  valuesOf: (p: ProductRecord) => T[],
): { value: T; count: number }[] {
  const counts = new Map<T, number>();
  for (const p of groupRecords(list)) {
    for (const value of valuesOf(p)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** How many products have a pack size that passes the test. */
function productsWhere(
  list: ProductRecord[],
  test: (p: ProductRecord) => boolean,
): number {
  return new Set(list.filter(test).map((p) => p.group)).size;
}

/**
 * The counts behind the filters (doc `GET /v1/store/products/facets`): each
 * facet without its own filter and with all the others, so a count is what
 * the list would show with that value chosen. A product with several pack
 * sizes counts once, except in `packSizes`.
 */
export function productFacets(
  query: Filters,
  locale: Locale,
): ProductFacets | { error: "CATEGORY_NOT_FOUND" } {
  const all = filterRecords(query, locale);
  if ("error" in all) return all;
  const without = (skip: Skipped): ProductRecord[] => {
    const records = filterRecords(query, locale, skip);
    return "error" in records ? [] : records;
  };
  const flag = (
    list: ProductRecord[],
    test: (p: ProductRecord) => boolean,
  ): { value: boolean; count: number }[] => [
    { value: true, count: productsWhere(list, test) },
    { value: false, count: productsWhere(list, (p) => !test(p)) },
  ];

  const sizes = new Map<string, { record: ProductRecord; count: number }>();
  for (const p of without("packSize")) {
    const key = PACK_KEY(p);
    const entry = sizes.get(key);
    if (entry) entry.count += 1;
    else sizes.set(key, { record: p, count: 1 });
  }
  const priced = without("price");
  const prices = priced.map(effectivePrice);

  return {
    total: groupRecords(all).length,
    brands: countBy(without("brand"), (p) => (p.brand ? [p.brand] : [])),
    tags: countBy(without("tag"), (p) => p.tags),
    storageTypes: countBy(without("storageType"), (p) => [p.storageType]),
    packSizes: [...sizes]
      .map(([value, { record, count }]) => ({
        value,
        packSize: packSize(record, locale),
        count,
        rank: UNIT_RANK[record.packUnit],
        amount: baseAmount(record),
      }))
      .sort((a, b) => a.rank - b.rank || a.amount - b.amount)
      .map(({ value, packSize, count }) => ({ value, packSize, count })),
    priceBands: PRICE_BANDS.map(([min, max]) => ({
      min,
      max,
      count: productsWhere(priced, (p) => {
        const price = effectivePrice(p);
        return price >= min && (max === null || price <= max);
      }),
    })),
    price: prices.length
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : null,
    onSale: flag(without("onSale"), (p) => priceView(p).onSale),
    orderable: flag(without("orderable"), (p) => orderingOf(p).canOrder),
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
  const lines = items.map((item) => lineOf(item, locale));
  const totals = totalsOf(lines);
  const freeFrom = freeDeliveryFrom();
  return {
    // The checkout button: a cart with products and no issue on any line.
    canOrder: lines.length > 0 && lines.every((line) => line.issue === null),
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
