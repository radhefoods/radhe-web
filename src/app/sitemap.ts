import type { MetadataRoute } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import type { Locale } from "@/i18n/routing";
import { isApiError } from "@/lib/api/errors";
import { TAGS, serverApi } from "@/lib/api/server";
import type { Category } from "@/lib/api/types";
import {
  buildSitemap,
  joinProductSlugs,
  sitemapImage,
  type SitemapBlog,
  type SitemapExtras,
  type SitemapLegal,
  type SitemapProduct,
} from "@/lib/seo/sitemap";

// `/sitemap.xml`: every indexable address, in both languages, read from the
// API and renewed every hour: a product, a category or a post that is new
// or gone is in or out of the file within the hour, without a deployment.
export const revalidate = 3600;

// The reads are kept as long as the sitemap itself: a shorter time here
// would shorten the sitemap's, and every renewal pages through the whole
// catalogue and the whole blog, twice.
const cache = { revalidate, tags: [TAGS.catalogue] };
const content = { revalidate, tags: [TAGS.content] };
const legal = { revalidate, tags: [TAGS.legal] };

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

/** A page of a list as the sitemap reads it: its slug in one language. */
type Listed = { id: string; slug: string } & SitemapExtras;

/**
 * Every pack size on sale with its slug in one language, page by page. A
 * list entry is one product with all its sizes; each size has an address
 * and its own picture. The date is the product's, the same for its sizes.
 */
async function allProducts(locale: Locale) {
  const sizes: Listed[] = [];
  for (let page = 1; page <= 500; page += 1) {
    const result = await serverApi.listProducts(
      { sort: "name", limit: 100, page },
      { locale, next: cache },
    );
    for (const product of result.items) {
      for (const { id, slug, image } of product.variants) {
        sizes.push({
          id,
          slug,
          image: sitemapImage(image),
          lastModified: product.updatedAt,
        });
      }
    }
    if (page >= result.totalPages) break;
  }
  return sizes;
}

/** Every published post with its slug in one language, page by page (doc 19). */
async function allPosts(locale: Locale) {
  const posts: Listed[] = [];
  for (let page = 1; page <= 500; page += 1) {
    const result = await serverApi.listBlogPosts(
      { limit: 100, page },
      { locale, next: content },
    );
    for (const post of result.items) {
      posts.push({
        id: post.id,
        slug: post.slug,
        image: sitemapImage(post.featuredImage),
        // The last edit when the list names it, else the day of publication.
        lastModified: post.updatedAt ?? post.publishedAt,
      });
    }
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

/**
 * The legal pages the admin has published (doc 6), with the day of their
 * current version. One language is enough: the addresses are fixed.
 */
async function legalPages(): Promise<SitemapLegal[]> {
  try {
    const { items } = await serverApi.listLegal({ locale: "en", next: legal });
    return items.map(({ type, publishedAt }) => ({ type, publishedAt }));
  } catch (error) {
    unlessBuilding(error);
    return [];
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
  const [blog, legalList] = await Promise.all([blogPages(), legalPages()]);
  return buildSitemap(categories, products, blog, legalList);
}
