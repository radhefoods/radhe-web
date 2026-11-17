import type { MetadataRoute } from "next";
import type { Locale } from "@/i18n/routing";
import { isApiError } from "@/lib/api/errors";
import { TAGS, serverApi } from "@/lib/api/server";
import {
  buildSitemap,
  joinProductSlugs,
  sitemapImage,
  type SitemapBlog,
  type SitemapExtras,
  type SitemapLegal,
  type SitemapPage,
} from "@/lib/seo/sitemap";

// `/sitemap.xml`: every indexable address, in both languages, read from the
// API: a product, a category or a post that is new or gone is in or out of
// the file within about an hour, without a deployment.
//
// The file is written at each request, from answers of the API that are
// kept for an hour (below). It was a file renewed on a timer
// (`revalidate = 3600`) until 2026-11-17: on the host that timer never ran
// for this file, and the sitemap stayed as the last deployment had built it
// (measured: 25 hours old, while pages on the same timer were renewed).
// Nothing is built ahead, so the build does not ask the API for it either.
export const dynamic = "force-dynamic";

// An hour, whoever asks and however often: one renewal pages through the
// whole catalogue twice (about forty calls), and the API counts the calls
// of the shop's server. A crawler that asks every minute costs no call.
const HOUR = 3600;
const cache = { revalidate: HOUR, tags: [TAGS.catalogue] };
const content = { revalidate: HOUR, tags: [TAGS.content] };
const legal = { revalidate: HOUR, tags: [TAGS.legal] };
const reviews = { revalidate: HOUR, tags: [TAGS.reviews] };

// When the API does not answer and nothing is kept, the call throws and the
// request fails (500): a search engine keeps the sitemap it read before and
// asks again, where a sitemap without products would tell it they are gone.

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

/** The posts and the categories of the blog. */
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
    if (isApiError(error) && error.status === 404) {
      return { posts: [], categories: [] };
    }
    throw error;
  }
}

/**
 * The legal pages the admin has published (doc 6), with the day of their
 * current version. One language is enough: the addresses are fixed.
 */
async function legalPages(): Promise<SitemapLegal[]> {
  const { items } = await serverApi.listLegal({ locale: "en", next: legal });
  return items.map(({ type, publishedAt }) => ({ type, publishedAt }));
}

/**
 * The pages that have nothing to show yet: the FAQ without a published
 * question (doc 18), the reviews without a published review. They say
 * `noindex` themselves until then. A page whose state the API does not
 * tell stays listed: this decides about one line, not about the file.
 */
async function emptyPages(): Promise<SitemapPage[]> {
  const [faqs, published] = await Promise.allSettled([
    serverApi.listFaqs({ locale: "en", next: content }),
    serverApi.listReviews({ limit: 1 }, { locale: "en", next: reviews }),
  ]);
  const empty: SitemapPage[] = [];
  if (
    faqs.status === "fulfilled" &&
    !faqs.value.groups.some((group) => group.items.length > 0)
  ) {
    empty.push("/faq");
  }
  if (published.status === "fulfilled" && published.value.summary.count === 0) {
    empty.push("/reviews");
  }
  return empty;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tree, english, german, blog, legalList, empty] = await Promise.all([
    // The tree of one language carries the slugs of both.
    serverApi.listCategories({ locale: "en", next: cache }),
    allProducts("en"),
    allProducts("de"),
    blogPages(),
    legalPages(),
    emptyPages(),
  ]);
  return buildSitemap(
    tree.items,
    joinProductSlugs(english, german),
    blog,
    legalList,
    empty,
  );
}
