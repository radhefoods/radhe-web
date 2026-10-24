// The FAQ and the blog of the mock API (doc 18 and 19, doc/FAQ.md and
// doc/BLOG.md): the fixture records as the store endpoints answer them.

import type {
  ApiImage,
  BlogCategory,
  BlogPost,
  BlogPostSummary,
  BlogQuery,
  BlogTag,
  FaqGroup,
  Faqs,
  Page,
} from "../src/lib/api/types.ts";
import {
  blogCategories,
  blogPosts,
  type BlogCategoryRecord,
  type BlogImageRecord,
  type BlogPostRecord,
} from "./data/blog.ts";
import type { Translated } from "./data/catalogue.ts";
import { faqGroups, faqs } from "./data/faq.ts";
import type { Locale } from "./state.ts";
import { getMediaBase } from "./views.ts";

const pick = (value: Translated, locale: Locale): string =>
  value[locale] || value.en;
const pickOrNull = (value: Translated | null, locale: Locale): string | null =>
  value ? pick(value, locale) || null : null;

// --- FAQ (doc 18) -----------------------------------------------------------

/** Visible groups with their published questions, the ungrouped ones last. */
export function faqsView(locale: Locale): Faqs {
  const published = faqs.filter((f) => f.isPublished);
  const items = (groupId: string | null) =>
    published
      .filter((f) => f.groupId === groupId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((f) => ({
        id: f.id,
        question: pick(f.question, locale),
        answer: pick(f.answer, locale),
      }));
  const groups: FaqGroup[] = [...faqGroups]
    .filter((g) => g.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((g) => ({ id: g.id, name: pick(g.name, locale), items: items(g.id) }))
    .filter((g) => g.items.length > 0);
  const ungrouped = items(null);
  if (ungrouped.length > 0) {
    groups.push({ id: null, name: null, items: ungrouped });
  }
  return { groups };
}

// --- Blog (doc 19) ----------------------------------------------------------

const categoryById = new Map(blogCategories.map((c) => [c.id, c]));

/** Published posts whose date has come, newest first. */
function visiblePosts(now = Date.now()): BlogPostRecord[] {
  return blogPosts
    .filter((p) => p.status === "published" && Date.parse(p.publishedAt) <= now)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

/** The three stored widths of a featured picture: 480, 1024 and 1920. */
function imageWidths(
  image: BlogImageRecord,
): Record<"small" | "medium" | "large", number> {
  return {
    small: Math.min(480, image.width),
    medium: Math.min(1024, image.width),
    large: Math.min(1920, image.width),
  };
}

function featuredImage(p: BlogPostRecord, locale: Locale): ApiImage | null {
  const image = p.featuredImage;
  if (!image) return null;
  const widths = imageWidths(image);
  const size = (name: "small" | "medium" | "large") => ({
    url: `${getMediaBase()}/media/blog/${p.id}/${name}.svg`,
    width: widths[name],
    height: Math.round((widths[name] * image.height) / image.width),
  });
  const large = size("large");
  return {
    id: `${p.id.slice(0, 20)}0img`,
    // The description falls back to the title (doc 19).
    alt: pickOrNull(image.alt, locale) ?? pick(p.title, locale),
    isPrimary: false,
    url: large.url,
    sizes: { small: size("small"), medium: size("medium"), large },
  };
}

/** About 200 words a minute, at least one minute. */
function readingMinutes(p: BlogPostRecord): number {
  const words = (p.content.en || p.content.de).split(/\s+/).filter(Boolean);
  return Math.max(1, Math.ceil(words.length / 200));
}

function categoryRef(p: BlogPostRecord, locale: Locale) {
  const category = p.categoryId ? categoryById.get(p.categoryId) : undefined;
  return category
    ? {
        id: category.id,
        slug: pick(category.slug, locale),
        name: pick(category.name, locale),
      }
    : null;
}

export function blogPostSummary(
  p: BlogPostRecord,
  locale: Locale,
): BlogPostSummary {
  return {
    id: p.id,
    slug: pick(p.slug, locale),
    title: pick(p.title, locale),
    summary: pickOrNull(p.summary, locale),
    featuredImage: featuredImage(p, locale),
    author: p.authorName,
    publishedAt: p.publishedAt,
    readingMinutes: readingMinutes(p),
    category: categoryRef(p, locale),
    tags: p.tags,
  };
}

/** Whether a word of the title, the summary or the tags starts with each word of `q`. */
function matches(p: BlogPostRecord, q: string): boolean {
  const haystack = [
    p.title.en,
    p.title.de,
    p.summary?.en ?? "",
    p.summary?.de ?? "",
    ...p.tags,
  ]
    .join(" ")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.some((token) => token.startsWith(word)));
}

/** The category behind a slug of either language. */
export function blogCategoryBySlug(
  slug: string,
): BlogCategoryRecord | undefined {
  return blogCategories.find((c) => c.slug.en === slug || c.slug.de === slug);
}

export function listBlogPosts(
  query: BlogQuery,
  locale: Locale,
): Page<BlogPostSummary> {
  let posts = visiblePosts();
  if (query.category !== undefined) {
    // An unknown category answers an empty page (doc 19).
    const category = blogCategoryBySlug(query.category);
    posts = category ? posts.filter((p) => p.categoryId === category.id) : [];
  }
  if (query.tag !== undefined) {
    const tag = query.tag.toLowerCase();
    posts = posts.filter((p) => p.tags.includes(tag));
  }
  if (query.q) posts = posts.filter((p) => matches(p, query.q ?? ""));
  const limit = query.limit ?? 24;
  const page = query.page ?? 1;
  const total = posts.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    items: posts
      .slice((page - 1) * limit, page * limit)
      .map((p) => blogPostSummary(p, locale)),
    page,
    limit,
    total,
    totalPages,
  };
}

/** A published post by the slug of either language; `null` otherwise. */
export function blogPostView(slug: string, locale: Locale): BlogPost | null {
  const p = visiblePosts().find(
    (record) => record.slug.en === slug || record.slug.de === slug,
  );
  if (!p) return null;
  const summary = blogPostSummary(p, locale);
  const other: Locale = locale === "en" ? "de" : "en";
  const contentLocale: Locale | null = p.content[locale]
    ? locale
    : p.content[other]
      ? other
      : null;
  const content = contentLocale ? p.content[contentLocale] : "";
  const sameCategory = visiblePosts().filter(
    (r) =>
      r.id !== p.id && p.categoryId !== null && r.categoryId === p.categoryId,
  );
  const rest = visiblePosts().filter(
    (r) => r.id !== p.id && !sameCategory.includes(r),
  );
  return {
    ...summary,
    // The pictures of the text are pasted as addresses of the API.
    content: content.replace(/\]\(\/media\//g, `](${getMediaBase()}/media/`),
    contentLocale,
    seo: {
      title: pickOrNull(p.seo.title, locale) ?? summary.title,
      description: pickOrNull(p.seo.description, locale) ?? summary.summary,
    },
    alternates: { en: p.slug.en, de: p.slug.de },
    updatedAt: p.updatedAt,
    related: [...sameCategory, ...rest]
      .slice(0, 3)
      .map((r) => blogPostSummary(r, locale)),
  };
}

export function blogCategoriesView(locale: Locale): { items: BlogCategory[] } {
  const posts = visiblePosts();
  return {
    items: [...blogCategories]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({
        id: c.id,
        slug: pick(c.slug, locale),
        name: pick(c.name, locale),
        description: pickOrNull(c.description, locale),
        postCount: posts.filter((p) => p.categoryId === c.id).length,
        seo: {
          title: pickOrNull(c.seo.title, locale),
          description: pickOrNull(c.seo.description, locale),
        },
        alternates: { en: c.slug.en, de: c.slug.de },
      })),
  };
}

/** The tags of the published posts, most used first, then by name. */
export function blogTagsView(): { items: BlogTag[] } {
  const counts = new Map<string, number>();
  for (const p of visiblePosts()) {
    for (const tag of p.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return {
    items: [...counts]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
  };
}

/** The placeholder picture of a post in one of its widths, or `null`. */
export function blogImageSvg(postId: string, file: string): string | null {
  const p = blogPosts.find((record) => record.id === postId);
  const name = file.replace(/\.svg$/, "") as "small" | "medium" | "large";
  const image = p?.featuredImage;
  if (!p || !image || !["small", "medium", "large"].includes(name)) return null;
  const width = imageWidths(image)[name];
  const height = Math.round((width * image.height) / image.width);
  const [from, to] = image.tint;
  const fontSize = Math.round(image.height / 12);
  const text = `${p.title.en} · mock picture`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${image.width} ${image.height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="${image.width}" height="${image.height}" fill="url(#g)"/><text x="${image.width / 2}" y="${Math.round(image.height / 2 + fontSize / 3)}" font-family="Georgia, serif" font-size="${fontSize}" text-anchor="middle" fill="#ffffff">${text}</text></svg>`;
}
