import type { MetadataRoute } from "next";
import { defaultLocale, locales, type Locale } from "@/i18n/routing";
import type { Category, LocalizedSlugs } from "@/lib/api/types";
import { pageUrl } from "./alternates";

type Href = Parameters<typeof pageUrl>[0];

/** Pages that exist without the API, the same in every language. */
export const STATIC_PAGES: { href: Href; priority: number }[] = [
  { href: "/", priority: 1 },
  { href: "/products", priority: 0.9 },
  { href: "/how-it-works", priority: 0.6 },
  { href: "/delivery-and-payment", priority: 0.6 },
  { href: "/faq", priority: 0.5 },
  { href: "/blog", priority: 0.6 },
  { href: "/legal/terms", priority: 0.2 },
  { href: "/legal/privacy", priority: 0.2 },
  { href: "/legal/imprint", priority: 0.2 },
  { href: "/legal/withdrawal", priority: 0.2 },
  { href: "/legal/cookies", priority: 0.1 },
];

/** A pack size as the sitemap needs it: its slug in each language. */
export interface SitemapProduct {
  /** The id of the size (`variantId`). */
  id: string;
  slugs: LocalizedSlugs;
}

/** The blog as the sitemap needs it: the slugs of the posts and categories. */
export interface SitemapBlog {
  posts: { id: string; slugs: LocalizedSlugs }[];
  categories: { id: string; slugs: LocalizedSlugs }[];
}

const NO_BLOG: SitemapBlog = { posts: [], categories: [] };

/**
 * One page of the shop in every language: an entry per language, each
 * naming all the others (`hreflang`), with English as `x-default`.
 */
function localized(
  hrefOf: (locale: Locale) => Href,
  options: Pick<MetadataRoute.Sitemap[number], "priority" | "changeFrequency">,
): MetadataRoute.Sitemap {
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    languages[locale] = pageUrl(hrefOf(locale), locale);
  }
  languages["x-default"] = languages[defaultLocale];
  return locales.map((locale) => ({
    url: languages[locale],
    alternates: { languages },
    ...options,
  }));
}

function flatten(categories: Category[]): Category[] {
  return categories.flatMap((category) => [
    category,
    ...flatten(category.children),
  ]);
}

/**
 * Joins the pack sizes of the two languages by id. The list of the API
 * carries the slug of one language only, so the catalogue is read once per
 * language; a size missing in one list is left out.
 */
export function joinProductSlugs(
  english: { id: string; slug: string }[],
  german: { id: string; slug: string }[],
): SitemapProduct[] {
  const germanSlug = new Map(
    german.map((product) => [product.id, product.slug]),
  );
  return english.flatMap((product) => {
    const de = germanSlug.get(product.id);
    return de ? [{ id: product.id, slugs: { en: product.slug, de } }] : [];
  });
}

/**
 * Every indexable address of the shop: static pages, categories, products,
 * the posts and categories of the blog (doc 19; the tag pages are views
 * of the list and stay out).
 */
export function buildSitemap(
  categories: Category[],
  products: SitemapProduct[],
  blog: SitemapBlog = NO_BLOG,
): MetadataRoute.Sitemap {
  return [
    ...STATIC_PAGES.flatMap(({ href, priority }) =>
      localized(() => href, {
        priority,
        changeFrequency: priority >= 0.9 ? "daily" : "monthly",
      }),
    ),
    ...flatten(categories).flatMap((category) =>
      localized(
        (locale) => ({
          pathname: "/category/[slug]",
          params: { slug: category.slugs[locale] },
        }),
        { priority: 0.8, changeFrequency: "daily" },
      ),
    ),
    ...products.flatMap((product) =>
      localized(
        (locale) => ({
          pathname: "/products/[slug]",
          params: { slug: product.slugs[locale] },
        }),
        { priority: 0.7, changeFrequency: "daily" },
      ),
    ),
    ...blog.categories.flatMap((category) =>
      localized(
        (locale) => ({
          pathname: "/blog/category/[slug]",
          params: { slug: category.slugs[locale] },
        }),
        { priority: 0.5, changeFrequency: "weekly" },
      ),
    ),
    ...blog.posts.flatMap((post) =>
      localized(
        (locale) => ({
          pathname: "/blog/[slug]",
          params: { slug: post.slugs[locale] },
        }),
        { priority: 0.6, changeFrequency: "monthly" },
      ),
    ),
  ];
}
