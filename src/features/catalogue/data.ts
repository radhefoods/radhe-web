import { cache } from "react";
import type { Locale } from "@/i18n/routing";
import { hasErrorCode } from "@/lib/api/errors";
import { REVALIDATE, TAGS, serverApi } from "@/lib/api/server";
import type {
  Banner,
  Category,
  CategoryDetail,
  Page,
  ProductDetail,
  ProductFacets,
  ProductQuery,
  ProductSummary,
  ShopSettings,
} from "@/lib/api/types";

// What the server reads from the API to render public pages. Every answer
// is cached by Next.js for a few minutes (`REVALIDATE`) and shared by the
// components of one request (`cache`).
//
// Two kinds of readers:
// - the frame of the shop (settings, categories) must never take a page
//   down: on failure they answer `null` / an empty list;
// - the content of a page throws, so the error page with "try again" shows.

const catalogue = { revalidate: REVALIDATE.catalogue, tags: [TAGS.catalogue] };

export const getSettings = cache(async (): Promise<ShopSettings | null> => {
  try {
    return await serverApi.getSettings({
      next: { revalidate: REVALIDATE.settings, tags: [TAGS.settings] },
    });
  } catch {
    return null;
  }
});

export const getCategories = cache(
  async (locale: Locale): Promise<Category[]> => {
    try {
      const { items } = await serverApi.listCategories({
        locale,
        next: catalogue,
      });
      return items;
    } catch {
      return [];
    }
  },
);

/** `null` when the category does not exist (or is hidden). */
export const getCategory = cache(
  async (slug: string, locale: Locale): Promise<CategoryDetail | null> => {
    try {
      const { category } = await serverApi.getCategory(slug, {
        locale,
        next: catalogue,
      });
      return category;
    } catch (error) {
      if (
        hasErrorCode(error, "CATEGORY_NOT_FOUND") ||
        hasErrorCode(error, "NOT_FOUND")
      ) {
        return null;
      }
      throw error;
    }
  },
);

/** `null` when the product does not exist (or is not active). */
export const getProduct = cache(
  async (slug: string, locale: Locale): Promise<ProductDetail | null> => {
    try {
      const { product } = await serverApi.getProduct(slug, {
        locale,
        next: catalogue,
      });
      return product;
    } catch (error) {
      if (
        hasErrorCode(error, "PRODUCT_NOT_FOUND") ||
        hasErrorCode(error, "NOT_FOUND")
      ) {
        return null;
      }
      throw error;
    }
  },
);

export function listProducts(
  query: ProductQuery,
  locale: Locale,
): Promise<Page<ProductSummary>> {
  return serverApi.listProducts(query, { locale, next: catalogue });
}

/** The counts behind the filters of a list, under the same query. */
export function getProductFacets(
  query: ProductQuery,
  locale: Locale,
): Promise<ProductFacets> {
  return serverApi.getProductFacets(query, { locale, next: catalogue });
}

/**
 * The live banners of the home page (doc 17), asked for at every visit of
 * the page: a banner the admin switches on or off, or whose period starts
 * or ends, shows at once (the API answers from its own 60-second cache).
 * None when the API cannot be reached: the page then shows no carousel.
 */
export const getBanners = cache(async (locale: Locale): Promise<Banner[]> => {
  try {
    const { banners } = await serverApi.listBanners({
      locale,
      cache: "no-store",
    });
    return banners;
  } catch {
    return [];
  }
});
