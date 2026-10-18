import type { ProductQuery, ProductSummary } from "@/lib/api/types";
import { parseListingState, toProductQuery } from "./listing-state";

// What the home page asks the API for, and how it picks what it shows.

/** How many products a row of the home page holds. */
export const ROW_SIZE = 8;

/** The products the admin marked as featured, in their sort order. */
export const featuredQuery: ProductQuery = { featured: true, limit: ROW_SIZE };

/**
 * The query behind a row of the home page: the first page of the plain
 * list, word for word what the category page (or "All products") asks for
 * on its first page. Both pages then read one and the same cached answer
 * of the API, so a price or a discount can never differ between them. The
 * row shows the first `ROW_SIZE` products of that page.
 */
export function rowQuery(category?: string): ProductQuery {
  return toProductQuery(parseListingState({}), category);
}

/**
 * The products of "Popular right now": those marked featured in the admin,
 * or, while none is, the first products of the whole catalogue in the
 * admin's order, so the row is there from the first day.
 */
export function popularProducts(
  featured: ProductSummary[],
  catalogue: ProductSummary[],
): ProductSummary[] {
  return (featured.length > 0 ? featured : catalogue).slice(0, ROW_SIZE);
}
