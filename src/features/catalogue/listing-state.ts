import type {
  Cents,
  ListingView,
  ProductQuery,
  ProductSort,
  StorageType,
} from "@/lib/api/types";

// The state of a product list lives in the address (`?brand=MDH&brand=Amul
// &storageType=chilled&minPrice=500&maxPrice=999&onSale=1&sort=price_asc
// &page=2`), so every view can be linked, shared and reached with the back
// button. The parameters are those of the API, a list as a repeated
// parameter. Whatever arrives in the address is checked against what the
// API accepts before it is sent on: a hand-edited address must not produce
// an error.

export const SORTS: readonly ProductSort[] = [
  "recommended",
  "newest",
  "price_asc",
  "price_desc",
  "discount",
  "name",
];

export const PAGE_SIZE = 24;

export const STORAGE_TYPES: readonly StorageType[] = [
  "ambient",
  "chilled",
  "frozen",
];

/** `500g`, `1kg`, `0.5l`, `6pcs`: the form of the API. */
export const PACK_SIZE = /^\d{1,6}(?:\.\d{1,3})?(?:g|kg|ml|l|pcs)$/;

/** More values of one filter than anyone would choose. */
const MAX_VALUES = 20;

export interface PriceRange {
  min: Cents;
  /** `null`: no upper end. */
  max: Cents | null;
}

/** The filters that take several values, "any of them". */
export type ListFacet = "brands" | "tags" | "storageTypes" | "packSizes";

export interface ListingState {
  q?: string;
  sort: ProductSort;
  page: number;
  onSale: boolean;
  orderable: boolean;
  brands: string[];
  tags: string[];
  storageTypes: StorageType[];
  packSizes: string[];
  price: PriceRange | null;
}

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Every value of a parameter, trimmed, without blanks and repeats. */
function all(value: string | string[] | undefined): string[] {
  const values =
    value === undefined ? [] : Array.isArray(value) ? value : [value];
  return [
    ...new Set(values.map((v) => v.trim()).filter((v) => v !== "")),
  ].slice(0, MAX_VALUES);
}

function cents(value: string | undefined): Cents | undefined {
  if (value === undefined) return undefined;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 1_000_000_000
    ? number
    : undefined;
}

/** A price band as one control value, for the form: `200-499`, `5000-`. */
export function priceBandKey(range: PriceRange): string {
  return `${range.min}-${range.max ?? ""}`;
}

/** The range behind such a value, or `null` for anything else. */
export function parsePriceBandKey(key: string): PriceRange | null {
  const match = /^(\d{1,10})-(\d{1,10})?$/.exec(key);
  if (!match) return null;
  const min = Number(match[1]);
  const max = match[2] === undefined ? null : Number(match[2]);
  if (max !== null && max < min) return null;
  return { min, max };
}

export function sameRange(a: PriceRange | null, b: PriceRange | null): boolean {
  return a?.min === b?.min && a?.max === b?.max;
}

function isStorageType(value: string): value is StorageType {
  return (STORAGE_TYPES as readonly string[]).includes(value);
}

export function parseListingState(params: RawParams): ListingState {
  const q = first(params.q)?.trim().slice(0, 80);
  const sort = first(params.sort) as ProductSort | undefined;
  const page = Number(first(params.page));
  const min = cents(first(params.minPrice));
  const max = cents(first(params.maxPrice));
  let price: PriceRange | null = null;
  if (min !== undefined || max !== undefined) {
    const range = { min: min ?? 0, max: max ?? null };
    if (range.max === null || range.max >= range.min) price = range;
  } else {
    // The form without scripts sends the chosen band as one value.
    const band = first(params.priceBand);
    if (band) price = parsePriceBandKey(band);
  }
  return {
    // The API searches from two characters on.
    q: q && q.length >= 2 ? q : undefined,
    sort: sort && SORTS.includes(sort) ? sort : "recommended",
    page: Number.isInteger(page) && page >= 1 && page <= 500 ? page : 1,
    onSale: first(params.onSale) === "1",
    orderable: first(params.orderable) === "1",
    brands: all(params.brand).filter((value) => value.length <= 80),
    tags: all(params.tag).filter((value) => value.length <= 80),
    storageTypes: all(params.storageType).filter(isStorageType),
    packSizes: all(params.packSize).filter((value) => PACK_SIZE.test(value)),
    price,
  };
}

/**
 * The view of a list page (doc PRODUCT_DISPLAY_ORDER, section 8; owner,
 * 2026-10-24): a category page sends none and gets the `listingView` the
 * admin set for the category; "All products" and a search show one card
 * per pack size, the sizes of a product together.
 */
export function listingView(category?: string): ListingView | undefined {
  return category ? undefined : "variants_by_product";
}

/** The query of the API for a state, within an optional category. */
export function toProductQuery(
  state: ListingState,
  category?: string,
): ProductQuery {
  return {
    category,
    view: listingView(category),
    q: state.q,
    sort: state.sort === "recommended" ? undefined : state.sort,
    onSale: state.onSale ? true : undefined,
    orderable: state.orderable ? true : undefined,
    brand: state.brands.length ? state.brands : undefined,
    tag: state.tags.length ? state.tags : undefined,
    storageType: state.storageTypes.length ? state.storageTypes : undefined,
    packSize: state.packSizes.length ? state.packSizes : undefined,
    minPrice: state.price ? state.price.min : undefined,
    maxPrice: state.price?.max ?? undefined,
    page: state.page,
    limit: PAGE_SIZE,
  };
}

export type SearchParams = Record<string, string | string[]>;

/** The address query for a state; defaults are left out. */
export function toSearchParams(
  state: ListingState,
  overrides: Partial<ListingState> = {},
): SearchParams {
  const next = { ...state, ...overrides };
  const query: SearchParams = {};
  if (next.q) query.q = next.q;
  if (next.brands.length) query.brand = next.brands;
  if (next.storageTypes.length) query.storageType = next.storageTypes;
  if (next.packSizes.length) query.packSize = next.packSizes;
  if (next.tags.length) query.tag = next.tags;
  if (next.price) {
    query.minPrice = String(next.price.min);
    if (next.price.max !== null) query.maxPrice = String(next.price.max);
  }
  if (next.onSale) query.onSale = "1";
  if (next.orderable) query.orderable = "1";
  if (next.sort !== "recommended") query.sort = next.sort;
  if (next.page > 1) query.page = String(next.page);
  return query;
}

/** The same as a query string, without the `?`; empty for the plain list. */
export function toQueryString(
  state: ListingState,
  overrides: Partial<ListingState> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(toSearchParams(state, overrides))) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.set(key, value);
    }
  }
  return params.toString();
}

/** Whether any filter narrows the list (search and sorting aside). */
export function hasFilters(state: ListingState): boolean {
  return filterCount(state) > 0;
}

/** How many filter values are applied: the badge of the filter button. */
export function filterCount(state: ListingState): number {
  return (
    Number(state.onSale) +
    Number(state.orderable) +
    Number(state.price !== null) +
    state.brands.length +
    state.tags.length +
    state.storageTypes.length +
    state.packSizes.length
  );
}

/** Whether the list is narrowed or reordered: such views are not indexed. */
export function isFiltered(state: ListingState): boolean {
  return Boolean(state.q) || state.sort !== "recommended" || hasFilters(state);
}

/** The state without any filter; the search and the sorting stay. */
export function clearedFilters(state: ListingState): ListingState {
  return {
    ...state,
    page: 1,
    onSale: false,
    orderable: false,
    brands: [],
    tags: [],
    storageTypes: [],
    packSizes: [],
    price: null,
  };
}

/** The state with one value of a facet added or removed, back on page 1. */
export function toggled(
  state: ListingState,
  facet: ListFacet,
  value: string,
): ListingState {
  const values = state[facet] as string[];
  const next = values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
  return { ...state, page: 1, [facet]: next };
}

/** One applied filter value, for the row of chips. */
export type ActiveFilter =
  | { kind: ListFacet; value: string }
  | { kind: "price"; value: PriceRange }
  | { kind: "onSale" | "orderable" };

/** The applied filters in a fixed order, each with the state without it. */
export function activeFilters(
  state: ListingState,
): { filter: ActiveFilter; without: ListingState }[] {
  const result: { filter: ActiveFilter; without: ListingState }[] = [];
  for (const kind of ["storageTypes", "brands", "packSizes", "tags"] as const) {
    for (const value of state[kind]) {
      result.push({
        filter: { kind, value },
        without: toggled(state, kind, value),
      });
    }
  }
  if (state.price) {
    result.push({
      filter: { kind: "price", value: state.price },
      without: { ...state, page: 1, price: null },
    });
  }
  if (state.onSale) {
    result.push({
      filter: { kind: "onSale" },
      without: { ...state, page: 1, onSale: false },
    });
  }
  if (state.orderable) {
    result.push({
      filter: { kind: "orderable" },
      without: { ...state, page: 1, orderable: false },
    });
  }
  return result;
}

/** The page numbers to show: first, last, and those around the current. */
export function pageWindow(current: number, total: number): (number | null)[] {
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...pages]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
  const result: (number | null)[] = [];
  let previous = 0;
  for (const page of sorted) {
    // `null` stands for the gap between two shown numbers.
    if (page - previous > 1) result.push(null);
    result.push(page);
    previous = page;
  }
  return result;
}
