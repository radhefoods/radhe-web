import type { ProductQuery, ProductSummary } from "@/lib/api/types";

// What the home page asks the API for, and how it picks what it shows.

/** How many cards a row of the home page holds. */
export const ROW_SIZE = 8;

/** The products the admin marked as featured, in their sort order. */
export const featuredQuery: ProductQuery = { featured: true, limit: ROW_SIZE };

/**
 * The first products of the whole catalogue in the admin's order, one card
 * per product: "Popular right now" while nothing is marked featured.
 */
export const catalogueQuery: ProductQuery = { limit: ROW_SIZE };

/**
 * The query behind the row of a category: one card per pack size in rounds
 * (`variants_by_size`, doc PRODUCT_DISPLAY_ORDER section 8), so the first
 * cards are the smallest sizes of the most products (owner, 2026-10-24).
 * The category page behind "See all" sends no view and shows the category
 * the way the admin set it; the two answers are cached apart, each for
 * `REVALIDATE.catalogue`.
 */
export function rowQuery(category: string): ProductQuery {
  return { category, view: "variants_by_size", limit: ROW_SIZE };
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
