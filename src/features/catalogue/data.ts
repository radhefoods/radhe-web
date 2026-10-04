import { cache } from "react";
import type { Locale } from "@/i18n/routing";
import { hasErrorCode } from "@/lib/api/errors";
import { REVALIDATE, TAGS, serverApi } from "@/lib/api/server";
import type {
  CargoStatus,
  Category,
  CategoryDetail,
  Page,
  ProductDetail,
  ProductQuery,
  ProductSummary,
  ShopSettings,
} from "@/lib/api/types";

// What the server reads from the API to render public pages. Every answer
// is cached by Next.js for a few minutes (`REVALIDATE`) and shared by the
// components of one request (`cache`).
//
// Two kinds of readers:
// - the frame of the shop (cargo, settings, categories) must never take a
//   page down: on failure they answer `null` / an empty list;
// - the content of a page throws, so the error page with "try again" shows.

const catalogue = { revalidate: REVALIDATE.catalogue, tags: [TAGS.catalogue] };

export const getCargo = cache(
  async (locale: Locale): Promise<CargoStatus | null> => {
    try {
      return await serverApi.getCargo({
        locale,
        next: { revalidate: REVALIDATE.cargo, tags: [TAGS.cargo] },
      });
    } catch {
      return null;
    }
  },
);

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
