import type { MetadataRoute } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import type { Locale } from "@/i18n/routing";
import { isApiError } from "@/lib/api/errors";
import { TAGS, serverApi } from "@/lib/api/server";
import type { Category } from "@/lib/api/types";
import {
  buildSitemap,
  joinProductSlugs,
  type SitemapBlog,
  type SitemapProduct,
} from "@/lib/seo/sitemap";

// `/sitemap.xml`: every indexable address, in both languages, read from the
// API and renewed every hour.
export const revalidate = 3600;

// The reads are kept as long as the sitemap itself: a shorter time here
// would shorten the sitemap's, and every renewal pages through the whole
// catalogue and the whole blog, twice.
const cache = { revalidate, tags: [TAGS.catalogue] };
const content = { revalidate, tags: [TAGS.content] };

/**
 * What to do when the API did not answer. While building, the pages that
 * do not need the API are listed and the first renewal brings the rest:
 * the build must not depend on the API. On a running shop the failure is
 * thrown: Next.js then keeps the last good sitemap and tries again at the
 * next request, instead of keeping a sitemap without products for an hour.
 */
function unlessBuilding(error: unknown): void {
  if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) throw error;
}

/**
 * Every pack size on sale with its slug in one language, page by page. A
 * list entry is one product with all its sizes; each size has an address.
 */
async function allProducts(locale: Locale) {
  const sizes: { id: string; slug: string }[] = [];
  for (let page = 1; page <= 500; page += 1) {
    const result = await serverApi.listProducts(
      { sort: "name", limit: 100, page },
      { locale, next: cache },
    );
    for (const product of result.items) {
      for (const { id, slug } of product.variants) sizes.push({ id, slug });
    }
    if (page >= result.totalPages) break;
  }
  return sizes;
}

/** Every published post with its slug in one language, page by page (doc 19). */
async function allPosts(locale: Locale) {
  const posts: { id: string; slug: string }[] = [];
  for (let page = 1; page <= 500; page += 1) {
    const result = await serverApi.listBlogPosts(
      { limit: 100, page },
      { locale, next: content },
    );
    for (const { id, slug } of result.items) posts.push({ id, slug });
    if (page >= result.totalPages) break;
  }
  return posts;
}

/** The posts and the categories of the blog; none when the API is away. */
async function blogPages(): Promise<SitemapBlog> {
  try {
    const [english, german, categories] = await Promise.all([
      allPosts("en"),
      allPosts("de"),
      serverApi.listBlogCategories({ locale: "en", next: content }),
    ]);
    return {
      posts: joinProductSlugs(english, german),
      categories: categories.items
        .filter((category) => category.postCount > 0)
        .map(({ id, alternates }) => ({ id, slugs: alternates })),
    };
  } catch (error) {
    // An API without the blog (404) has no blog pages to list.
    if (!(isApiError(error) && error.status === 404)) unlessBuilding(error);
    return { posts: [], categories: [] };
  }
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
  } catch (error) {
    unlessBuilding(error);
  }
  return buildSitemap(categories, products, await blogPages());
}
