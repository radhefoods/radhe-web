import type { ApiImage, Category, ProductSummary } from "@/lib/api/types";

// The categories as the home page and the page of all categories show them.

/**
 * The parent categories a visitor can shop: those of the API's tree (the
 * visible ones, in the admin's order) that hold at least one product. A
 * category without products would lead to an empty page.
 */
export function shopCategories(categories: Category[]): Category[] {
  return categories.filter((category) => category.productCount > 0);
}

/** A picture to stand for a category without one, by the category's id. */
export type StandInPictures = Record<string, ApiImage | null>;

/**
 * For every category the admin has given no picture, the picture of the
 * first product of its row (owner, 2026-10-24: the live categories have no
 * pictures yet, and a row of five ghosted marks is no invitation). A
 * category with its own picture, or whose products have none, gets no
 * stand-in.
 */
export function standInPictures(
  rows: { category: Category; items: ProductSummary[] }[],
): StandInPictures {
  const pictures: StandInPictures = {};
  for (const { category, items } of rows) {
    if (category.image) continue;
    const picture = items.find((item) => item.image !== null)?.image ?? null;
    if (picture) pictures[category.id] = picture;
  }
  return pictures;
}
