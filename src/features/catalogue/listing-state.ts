import type { ProductQuery, ProductSort } from "@/lib/api/types";

// The state of a product list lives in the address (`?q=…&sort=…&page=2`),
// so every view can be linked, shared and reached with the back button.
// Whatever arrives in the address is checked against what the API accepts
// before it is sent on: a hand-edited address must not produce an error.

export const SORTS: readonly ProductSort[] = [
  "recommended",
  "newest",
  "price_asc",
  "price_desc",
  "discount",
  "name",
];

export const PAGE_SIZE = 24;

export interface ListingState {
  q?: string;
  sort: ProductSort;
  onSale: boolean;
  orderable: boolean;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseListingState(params: RawParams): ListingState {
  const q = first(params.q)?.trim().slice(0, 80);
  const sort = first(params.sort) as ProductSort | undefined;
  const page = Number(first(params.page));
  return {
    // The API searches from two characters on.
    q: q && q.length >= 2 ? q : undefined,
    sort: sort && SORTS.includes(sort) ? sort : "recommended",
    onSale: first(params.onSale) === "1",
    orderable: first(params.orderable) === "1",
    page: Number.isInteger(page) && page >= 1 && page <= 500 ? page : 1,
  };
}

/** The query of the API for a state, within an optional category. */
export function toProductQuery(
  state: ListingState,
  category?: string,
): ProductQuery {
  return {
    category,
    q: state.q,
    sort: state.sort === "recommended" ? undefined : state.sort,
    onSale: state.onSale ? true : undefined,
    orderable: state.orderable ? true : undefined,
    page: state.page,
    limit: PAGE_SIZE,
  };
}

/** The address query for a state; defaults are left out. */
export function toSearchParams(
  state: ListingState,
  overrides: Partial<ListingState> = {},
): Record<string, string> {
  const next = { ...state, ...overrides };
  const query: Record<string, string> = {};
  if (next.q) query.q = next.q;
  if (next.sort !== "recommended") query.sort = next.sort;
  if (next.onSale) query.onSale = "1";
  if (next.orderable) query.orderable = "1";
  if (next.page > 1) query.page = String(next.page);
  return query;
}

/** Whether the list is narrowed or reordered: such views are not indexed. */
export function isFiltered(state: ListingState): boolean {
  return (
    Boolean(state.q) ||
    state.sort !== "recommended" ||
    state.onSale ||
    state.orderable
  );
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
