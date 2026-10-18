// Turns the fixture records into the answers of the store API, in the shapes
// of doc/CUSTOMER_WEB_API_DOCUMENTATION.md. The rules (default pack size,
// ordering block, bill, VAT, delivery fee, search) follow the documentation;
// where it leaves a detail open, the choice made here is noted.

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
  Page,
  PriceView,
  ProductDetail,
  ProductFacets,
  ProductQuery,
  ProductSummary,
  ProductVariant,
  ShopSettings,
  Totals,
  VatGroup,
} from "../src/lib/api/types.ts";
import {
  baseQuantity,
  categories,
  products,
  type CategoryRecord,
  type ProductRecord,
  type Translated,
  type VariantRecord,
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
/** A pack size and its product, by the size's id (the `variantId`). */
const variantById = new Map(
  products.flatMap((p) =>
    p.variants.map((v) => [v.id, { product: p, variant: v }] as const),
  ),
);

export function findProduct(id: string): ProductRecord | undefined {
  return productById.get(id);
}

export function findVariant(
  variantId: string,
): { product: ProductRecord; variant: VariantRecord } | undefined {
  return variantById.get(variantId);
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

// --- Pack sizes -------------------------------------------------------------

type PackUnit = VariantRecord["packUnit"];

const UNIT_LABEL: Record<Locale, Record<PackUnit, string>> = {
  en: { g: "g", kg: "kg", ml: "ml", l: "l", pcs: "pcs" },
  de: { g: "g", kg: "kg", ml: "ml", l: "l", pcs: "Stk." },
};

/** A pack size with its localized label ("0,5 kg", "6 Stk."). */
export function packSizeOf(
  value: number,
  unit: PackUnit,
  locale: Locale,
): PackSize {
  const number = new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", {
    maximumFractionDigits: 3,
  }).format(value);
  return { value, unit, label: `${number} ${UNIT_LABEL[locale][unit]}` };
}

export function packSize(v: VariantRecord, locale: Locale): PackSize {
  return packSizeOf(v.packValue, v.packUnit, locale);
}

/** The URL part of a pack (doc 7.1): `1kg`, `1-5kg`, `6pcs`, `6stk` in German. */
function packSlug(v: VariantRecord, locale: Locale): string {
  const unit = v.packUnit === "pcs" && locale === "de" ? "stk" : v.packUnit;
  return `${String(v.packValue).replace(".", "-")}${unit}`;
}

/** The URL of a pack size: the base slug of the product plus the pack. */
export function variantSlug(
  p: ProductRecord,
  v: VariantRecord,
  locale: Locale,
): string {
  return `${pick(p.slug, locale)}-${packSlug(v, locale)}`;
}

/** "Basmati Rice (1 kg)": the name of the product with the pack label. */
export function displayNameOf(
  p: ProductRecord,
  v: VariantRecord,
  locale: Locale,
): string {
  return `${pick(p.name, locale)} (${packSize(v, locale).label})`;
}

export function enabledVariants(p: ProductRecord): VariantRecord[] {
  return p.variants.filter((v) => v.isEnabled);
}

/**
 * The size that stands for the product (doc 7): the smallest enabled size
 * whose stock covers the smallest order, else the smallest enabled one,
 * else the smallest. Never the cheapest.
 */
export function defaultVariant(p: ProductRecord): VariantRecord {
  const enabled = enabledVariants(p);
  return (
    enabled.find((v) => v.stock >= p.minQuantity) ?? enabled[0] ?? p.variants[0]
  );
}

function effectivePrice(v: VariantRecord): number {
  return v.salePrice !== null && v.salePrice < v.regularPrice
    ? v.salePrice
    : v.regularPrice;
}

/** VAT inside a gross amount: `round(gross × rate / (10000 + rate))`. */
export function vatOf(gross: number, vatRate: number): number {
  return Math.round((gross * vatRate) / (10_000 + vatRate));
}

function priceView(p: ProductRecord, v: VariantRecord): PriceView {
  const price = effectivePrice(v);
  const onSale = price < v.regularPrice;
  // The price per kilogram, litre or piece (German price-indication rule).
  const per =
    v.packUnit === "g" || v.packUnit === "kg"
      ? "kg"
      : v.packUnit === "ml" || v.packUnit === "l"
        ? "l"
        : "pcs";
  const amountInBase =
    v.packUnit === "g" || v.packUnit === "ml"
      ? v.packValue / 1000
      : v.packValue;
  return {
    currency: "EUR",
    price,
    regularPrice: v.regularPrice,
    salePrice: onSale ? price : null,
    onSale,
    discountPercent: onSale
      ? Math.floor(((v.regularPrice - price) * 100) / v.regularPrice)
      : 0,
    discountAmount: v.regularPrice - price,
    vatIncluded: true,
    vatRate: p.vatRate,
    vatPercent: p.vatRate / 100,
    vatAmount: vatOf(price, p.vatRate),
    basePrice: { amount: Math.round(price / amountInBase), per },
  };
}

/**
 * Whether a pack size can be ordered right now (doc 7.1): the product and
 * the size are switched on, and the stock of the size covers the smallest
 * order. `maxQuantity` is the product's limit per order capped by the size's
 * stock, 0 when sold out. Nothing is reserved before a payment, so
 * `remaining` is what everyone sees.
 */
export function orderingOf(p: ProductRecord, v: VariantRecord): Ordering {
  const remaining = v.stock;
  const cap =
    p.maxQuantity === null ? remaining : Math.min(p.maxQuantity, remaining);
  if (!p.isAvailable || !v.isEnabled) {
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

// --- Products ---------------------------------------------------------------

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

function imageView(p: ProductRecord, locale: Locale): ApiImage | null {
  if (p.tint === null) return null;
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

function variantView(
  p: ProductRecord,
  v: VariantRecord,
  locale: Locale,
  selected: VariantRecord,
  withOrdering: boolean,
): ProductVariant {
  return {
    id: v.id,
    sku: v.sku,
    slug: variantSlug(p, v, locale),
    packSize: packSize(v, locale),
    displayName: displayNameOf(p, v, locale),
    pricing: priceView(p, v),
    ordering: withOrdering ? orderingOf(p, v) : null,
    isDefault: v.id === defaultVariant(p).id,
    isSelected: v.id === selected.id,
  };
}

/**
 * The list entry of a product (doc 7): the product shown as one of its pack
 * sizes, the default one unless another is asked for.
 */
export function productSummary(
  p: ProductRecord,
  locale: Locale,
  options: { selected?: VariantRecord; withOrdering?: boolean } = {},
): ProductSummary {
  const selected = options.selected ?? defaultVariant(p);
  const withOrdering = options.withOrdering ?? true;
  const category = categoryById.get(p.categoryId);
  const variants = enabledVariants(p).map((v) =>
    variantView(p, v, locale, selected, withOrdering),
  );
  return {
    id: p.id,
    variantId: selected.id,
    sku: selected.sku,
    slug: variantSlug(p, selected, locale),
    name: pick(p.name, locale),
    displayName: displayNameOf(p, selected, locale),
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
    packSize: packSize(selected, locale),
    pricing: priceView(p, selected),
    isAvailable: p.isAvailable,
    isFeatured: p.isFeatured,
    quantity: { min: p.minQuantity, max: p.maxQuantity },
    ordering: withOrdering ? orderingOf(p, selected) : null,
    storageType: p.storageType,
    tags: p.tags,
    image: imageView(p, locale),
    variants,
    variantCount: variants.length,
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

/** The product page, opened on one pack size (doc 7). */
export function productDetail(
  p: ProductRecord,
  v: VariantRecord,
  locale: Locale,
): ProductDetail {
  const summary = productSummary(p, locale, { selected: v });
  return {
    ...summary,
    slugs: { en: variantSlug(p, v, "en"), de: variantSlug(p, v, "de") },
    gtin: v.gtin,
    description: pickOrNull(p.description, locale),
    highlights: p.highlights.map((h) => pick(h, locale)),
    uses: p.uses.map((u) => pick(u, locale)),
    images: [imageView(p, locale)].filter(
      (image): image is ApiImage => image !== null,
    ),
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
      title: summary.displayName,
      description: pickOrNull(p.shortDescription, locale),
    },
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
  };
}

/**
 * The product and the pack size a URL names (doc 7): the URL of a size in
 * either language, or the base slug of the product, which selects the default
 * size. The URL of a disabled size answers nothing, like the API's 404.
 */
export function productBySlug(
  slug: string,
): { product: ProductRecord; variant: VariantRecord } | undefined {
  for (const product of products) {
    for (const variant of product.variants) {
      if (
        variantSlug(product, variant, "en") === slug ||
        variantSlug(product, variant, "de") === slug
      ) {
        return variant.isEnabled ? { product, variant } : undefined;
      }
    }
    if (product.slug.en === slug || product.slug.de === slug) {
      return { product, variant: defaultVariant(product) };
    }
  }
  return undefined;
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
      ...p.variants.map((v) => v.sku),
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

/** The value of the `packSize` parameter for a size: `500g`, `1kg`. */
const PACK_KEY = (v: VariantRecord): string => `${v.packValue}${v.packUnit}`;

const isOnSale = (p: ProductRecord, v: VariantRecord) => priceView(p, v).onSale;
const isOrderable = (p: ProductRecord, v: VariantRecord) =>
  orderingOf(p, v).canOrder;

/** The filters of a list, without its paging and sorting. */
type Filters = Omit<ProductQuery, "sort" | "page" | "limit">;
/** A facet is counted without its own filter: the one to leave out. */
type Skipped =
  | "tag"
  | "brand"
  | "storageType"
  | "packSize"
  | "onSale"
  | "orderable"
  | "price";

/**
 * Every product that passes the filters, in catalogue order (doc 7). A size
 * filter matches when one enabled size matches; the offer and the ordering
 * filters when some enabled size is reduced or can be ordered; the price
 * filters use the default size.
 */
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
    list = list.filter((p) =>
      enabledVariants(p).some((v) => sizes.includes(PACK_KEY(v))),
    );
  }
  if (on("onSale") && query.onSale !== undefined) {
    list = list.filter(
      (p) => enabledVariants(p).some((v) => isOnSale(p, v)) === query.onSale,
    );
  }
  if (query.available !== undefined) {
    list = list.filter((p) => p.isAvailable === query.available);
  }
  if (on("orderable") && query.orderable !== undefined) {
    list = list.filter(
      (p) =>
        enabledVariants(p).some((v) => isOrderable(p, v)) === query.orderable,
    );
  }
  if (query.featured !== undefined) {
    list = list.filter((p) => p.isFeatured === query.featured);
  }
  if (on("price") && query.minPrice !== undefined) {
    list = list.filter(
      (p) => effectivePrice(defaultVariant(p)) >= query.minPrice!,
    );
  }
  if (on("price") && query.maxPrice !== undefined) {
    list = list.filter(
      (p) => effectivePrice(defaultVariant(p)) <= query.maxPrice!,
    );
  }
  return list;
}

/**
 * The size a list entry shows: the default size, or, with a pack-size
 * filter, the smallest enabled size that was asked for.
 */
function shownVariant(p: ProductRecord, query: Filters): VariantRecord {
  if (query.packSize?.length) {
    const sizes = query.packSize;
    const match = enabledVariants(p).find((v) => sizes.includes(PACK_KEY(v)));
    if (match) return match;
  }
  return defaultVariant(p);
}

export function listProducts(
  query: ProductQuery,
  locale: Locale,
): Page<ProductSummary> | { error: "CATEGORY_NOT_FOUND" } {
  const records = filterRecords(query, locale);
  if ("error" in records) return records;
  const list = [...records];

  const byName = (a: ProductRecord, b: ProductRecord) =>
    pick(a.name, locale).localeCompare(pick(b.name, locale), locale);
  const price = (p: ProductRecord) => effectivePrice(defaultVariant(p));
  const discount = (p: ProductRecord) =>
    priceView(p, defaultVariant(p)).discountPercent;
  const sorters: Record<
    string,
    (a: ProductRecord, b: ProductRecord) => number
  > = {
    recommended: (a, b) =>
      Number(b.isFeatured) - Number(a.isFeatured) || a.sortOrder - b.sortOrder,
    newest: (a, b) => b.publishedAt.localeCompare(a.publishedAt),
    price_asc: (a, b) => price(a) - price(b),
    price_desc: (a, b) => price(b) - price(a),
    discount: (a, b) => discount(b) - discount(a) || a.sortOrder - b.sortOrder,
    name: byName,
  };
  list.sort(sorters[query.sort ?? "recommended"]);

  const page = query.page ?? 1;
  const limit = query.limit ?? 24;
  const total = list.length;
  return {
    items: list
      .slice((page - 1) * limit, page * limit)
      .map((p) =>
        productSummary(p, locale, { selected: shownVariant(p, query) }),
      ),
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
const UNIT_RANK: Record<PackUnit, number> = {
  g: 0,
  kg: 0,
  ml: 1,
  l: 1,
  pcs: 2,
};

/** Counts per value over the products, most first. */
function countBy<T extends string>(
  list: ProductRecord[],
  valuesOf: (p: ProductRecord) => T[],
): { value: T; count: number }[] {
  const counts = new Map<T, number>();
  for (const p of list) {
    for (const value of valuesOf(p)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/**
 * The counts behind the filters (doc `GET /v1/store/products/facets`): each
 * facet without its own filter and with all the others, so a count is what
 * the list would show with that value chosen. A product counts once, except
 * in `packSizes`, where each of its enabled sizes counts; the price facets
 * use the default size, like the price filter.
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
    { value: true, count: list.filter(test).length },
    { value: false, count: list.filter((p) => !test(p)).length },
  ];

  const sizes = new Map<string, { sample: VariantRecord; count: number }>();
  for (const p of without("packSize")) {
    for (const v of enabledVariants(p)) {
      const key = PACK_KEY(v);
      const entry = sizes.get(key);
      if (entry) entry.count += 1;
      else sizes.set(key, { sample: v, count: 1 });
    }
  }
  const priced = without("price");
  const prices = priced.map((p) => effectivePrice(defaultVariant(p)));

  return {
    total: all.length,
    brands: countBy(without("brand"), (p) => (p.brand ? [p.brand] : [])),
    tags: countBy(without("tag"), (p) => p.tags),
    storageTypes: countBy(without("storageType"), (p) => [p.storageType]),
    packSizes: [...sizes]
      .map(([value, { sample, count }]) => ({
        value,
        packSize: packSize(sample, locale),
        count,
        rank: UNIT_RANK[sample.packUnit],
        amount: baseQuantity(sample.packValue, sample.packUnit),
      }))
      .sort((a, b) => a.rank - b.rank || a.amount - b.amount)
      .map(({ value, packSize, count }) => ({ value, packSize, count })),
    priceBands: PRICE_BANDS.map(([min, max]) => ({
      min,
      max,
      count: prices.filter(
        (price) => price >= min && (max === null || price <= max),
      ).length,
    })),
    price: prices.length
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : null,
    onSale: flag(without("onSale"), (p) =>
      enabledVariants(p).some((v) => isOnSale(p, v)),
    ),
    orderable: flag(without("orderable"), (p) =>
      enabledVariants(p).some((v) => isOrderable(p, v)),
    ),
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

/** A cart line is one pack size (doc 8). */
function lineOf(item: CartItemInput, locale: Locale): BillLine {
  const found = findVariant(item.variantId);
  if (!found) {
    return {
      variantId: item.variantId,
      productId: null,
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
  const { product: p, variant: v } = found;
  const ordering = orderingOf(p, v);
  let issue: CartLineIssue | null = null;
  if (!ordering.canOrder) issue = ordering.reason;
  else if (item.quantity < ordering.minQuantity)
    issue = "quantity_below_minimum";
  else if (item.quantity > ordering.maxQuantity) {
    issue = "quantity_above_maximum";
  }
  const unitPrice = effectivePrice(v);
  const lineTotal = unitPrice * item.quantity;
  return {
    variantId: v.id,
    productId: p.id,
    quantity: item.quantity,
    unitPrice,
    lineTotal,
    vatRate: p.vatRate,
    vatAmount: vatOf(lineTotal, p.vatRate),
    issue,
    ordering,
    // Inside a line the product's own `ordering` fields are always null.
    product: productSummary(p, locale, { selected: v, withOrdering: false }),
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
    communication: { ...record.communication },
    createdAt: record.createdAt,
  };
}

/** A placeholder picture: the tint of the product and its initials. */
export function placeholderSvg(productId: string, size: number): string | null {
  const p = findProduct(productId);
  if (!p || p.tint === null) return null;
  const initials = p.name.en
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 400 400"><rect width="400" height="400" fill="${p.tint}"/><circle cx="200" cy="190" r="96" fill="#ffffff" fill-opacity="0.55"/><text x="200" y="212" font-family="Georgia, serif" font-size="64" text-anchor="middle" fill="#020E43" fill-opacity="0.7">${initials}</text><text x="200" y="352" font-family="Arial, sans-serif" font-size="18" text-anchor="middle" fill="#020E43" fill-opacity="0.5">mock picture</text></svg>`;
}
