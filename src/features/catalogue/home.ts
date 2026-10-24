import type {
  ProductList,
  ProductQuery,
  ProductSummary,
} from "@/lib/api/types";

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
 * The server renders the first page; the browser asks for the following
 * pages as the visitor turns towards the end of the row, so the row runs
 * through every round (owner, 2026-10-24, evening). The category page
 * behind "See all" sends no view and shows the category the way the admin
 * set it; the two answers are cached apart, each for `REVALIDATE.catalogue`.
 */
export function rowQuery(category: string, page = 1): ProductQuery {
  return {
    category,
    view: "variants_by_size",
    page: page > 1 ? page : undefined,
    limit: ROW_SIZE,
  };
}

/** The page of a row to ask for after this one; `null` after the last. */
export function nextRowPage(list: Pick<ProductList, "page" | "totalPages">) {
  return list.page < list.totalPages ? list.page + 1 : null;
}

/**
 * The cards of a row after a page arrived: those loaded before, then the
 * page's cards that the row does not show yet. The server's first page
 * and the browser's later pages come from answers cached at different
 * times (five minutes in the shop, one in the API), so a card could cross
 * the border between two pages while the admin reorders the category; a
 * `variantId` is shown once.
 */
export function moreRowCards(
  shown: readonly string[],
  previous: readonly ProductSummary[],
  incoming: readonly ProductSummary[],
): ProductSummary[] {
  const seen = new Set([...shown, ...previous.map((p) => p.variantId)]);
  const added = incoming.filter((product) => {
    if (seen.has(product.variantId)) return false;
    seen.add(product.variantId);
    return true;
  });
  return [...previous, ...added];
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
