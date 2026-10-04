import type { MetadataRoute } from "next";
import type { Locale } from "@/i18n/routing";
import { REVALIDATE, TAGS, serverApi } from "@/lib/api/server";
import type { Category } from "@/lib/api/types";
import {
  buildSitemap,
  joinProductSlugs,
  type SitemapProduct,
} from "@/lib/seo/sitemap";

// `/sitemap.xml`: every indexable address, in both languages, read from the
// API and renewed every hour.
export const revalidate = 3600;

const cache = { revalidate: REVALIDATE.catalogue, tags: [TAGS.catalogue] };

/** Every sellable pack size with its slug in one language, page by page. */
async function allProducts(locale: Locale) {
  const products: { id: string; slug: string }[] = [];
  for (let page = 1; page <= 500; page += 1) {
    const result = await serverApi.listProducts(
      { groupPackSizes: false, sort: "name", limit: 100, page },
      { locale, next: cache },
    );
    for (const { id, slug } of result.items) products.push({ id, slug });
    if (page >= result.totalPages) break;
  }
  return products;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let categories: Category[] = [];
  let products: SitemapProduct[] = [];
  try {
    const [tree, english, german] = await Promise.all([
      // The tree of one language carries the slugs of both.
      serverApi.listCategories({ locale: "en", next: cache }),
      allProducts("en"),
      allProducts("de"),
    ]);
    categories = tree.items;
    products = joinProductSlugs(english, german);
  } catch {
    // The API is away: the pages that do not need it are listed anyway.
  }
  return buildSitemap(categories, products);
}
