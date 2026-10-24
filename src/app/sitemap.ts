import type { MetadataRoute } from "next";
import type { Locale } from "@/i18n/routing";
import { REVALIDATE, TAGS, serverApi } from "@/lib/api/server";
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

const cache = { revalidate: REVALIDATE.catalogue, tags: [TAGS.catalogue] };
const content = { revalidate: REVALIDATE.content, tags: [TAGS.content] };

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
  } catch {
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
  } catch {
    // The API is away: the pages that do not need it are listed anyway.
  }
  return buildSitemap(categories, products, await blogPages());
}
