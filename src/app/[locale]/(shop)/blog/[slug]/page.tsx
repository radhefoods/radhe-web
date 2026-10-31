import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { PostCard, postHref } from "@/components/blog/post-card";
import { PostImage } from "@/components/blog/post-image";
import { LegalText } from "@/components/legal/legal-text";
import { LocaleAlternates } from "@/components/shell/locale-switcher";
import { getBlogPost } from "@/features/content/data";
import { Link, permanentRedirect } from "@/i18n/navigation";
import { localeOf } from "@/i18n/locale";
import type { Locale } from "@/i18n/routing";
import type { LocalizedSlugs } from "@/lib/api/types";
import { formatDate } from "@/lib/format/dates";
import { alternates, pageUrl } from "@/lib/seo/alternates";
import { JsonLd, articleJsonLd } from "@/lib/seo/json-ld";

type Props = PageProps<"/[locale]/blog/[slug]">;

export const revalidate = 300;

// No article is built ahead of time; each one is rendered at its first
// visit and then served from the cache, refreshed every five minutes.
export function generateStaticParams() {
  return [];
}

const hrefsOf = (slugs: LocalizedSlugs) => ({
  en: postHref(slugs.en),
  de: postHref(slugs.de),
});

/** The picture that heads the article: as wide as the column. */
const HERO_SIZES = "(min-width: 48rem) 48rem, 100vw";

/** The post of the address, under its slug in this language. */
async function loadPost(slug: string, locale: Locale) {
  const post = await getBlogPost(slug, locale);
  if (!post) notFound();
  // The API answers to the slug of either language; the page has one address.
  if (post.slug !== slug) {
    permanentRedirect({ href: postHref(post.slug), locale });
  }
  return post;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeOf(params);
  const { slug } = await params;
  const post = await getBlogPost(slug, locale);
  if (!post) return {};
  const image = post.featuredImage?.sizes.medium;
  const description = post.seo.description ?? undefined;
  return {
    title: post.seo.title,
    description,
    alternates: alternates(locale, hrefsOf(post.alternates)),
    openGraph: {
      type: "article",
      title: post.seo.title,
      description,
      url: pageUrl(postHref(post.slug), locale),
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author],
      tags: post.tags,
      images: image
        ? [{ url: image.url, width: image.width, height: image.height }]
        : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary" },
  };
}

/**
 * An article of the blog (doc 19): where it sits (the blog, its category),
 * the title with the author, the date and the reading time, the featured
 * picture, the text as Markdown in the type of the shop, its topics, and
 * three more posts to read. The text is in the other language when this
 * one has none yet; the page says so.
 */
export default async function BlogPostPage({ params }: Props) {
  const locale = await localeOf(params);
  const { slug } = await params;
  const post = await loadPost(slug, locale);
  const [t, tLegal] = await Promise.all([
    getTranslations("blog"),
    getTranslations("legal"),
  ]);
  const otherLanguage =
    post.contentLocale !== null && post.contentLocale !== locale
      ? post.contentLocale
      : null;
  const separator = (
    <ChevronRight
      aria-hidden="true"
      className="text-ink-subtle size-4 shrink-0"
    />
  );

  return (
    <div className="container-page py-6 sm:py-10">
      <LocaleAlternates hrefs={hrefsOf(post.alternates)} />
      <JsonLd data={articleJsonLd(post, locale)} />

      <article className="mx-auto max-w-3xl space-y-8">
        <nav aria-label={t("breadcrumb")}>
          <ol className="text-ink-muted flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
            <li>
              <Link
                href="/blog"
                className="hover:text-ink rounded-xs hover:underline"
              >
                {t("title")}
              </Link>
            </li>
            {post.category && (
              <>
                <li aria-hidden="true">{separator}</li>
                <li>
                  <Link
                    href={{
                      pathname: "/blog/category/[slug]",
                      params: { slug: post.category.slug },
                    }}
                    className="hover:text-ink rounded-xs hover:underline"
                  >
                    {post.category.name}
                  </Link>
                </li>
              </>
            )}
          </ol>
        </nav>

        <header className="space-y-4">
          <h1 className="font-display text-ink text-3xl sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
            {post.title}
          </h1>
          {post.summary && (
            <p className="text-ink-muted max-w-2xl text-lg">{post.summary}</p>
          )}
          <p className="text-ink-subtle text-sm">
            {t("by", { author: post.author })}
            {" · "}
            <time dateTime={post.publishedAt}>
              {formatDate(post.publishedAt, locale)}
            </time>
            {" · "}
            {t("readingTime", { minutes: post.readingMinutes })}
          </p>
        </header>

        {post.featuredImage && (
          <figure className="bg-mist/60 shadow-card overflow-hidden rounded-3xl">
            <PostImage
              image={post.featuredImage}
              sizes={HERO_SIZES}
              priority
              className="h-auto w-full"
            />
          </figure>
        )}

        {otherLanguage && (
          <p className="bg-wheat-100/90 text-wheat-800 ring-wheat-800/12 rounded-xl px-4 py-3 text-sm font-semibold ring-1">
            {t(otherLanguage === "en" ? "onlyEnglish" : "onlyGerman")}
          </p>
        )}

        <div lang={otherLanguage ?? undefined} className="text-[1.0625rem]">
          <LegalText tableLabel={tLegal("table")} demoteHeadings>
            {post.content}
          </LegalText>
        </div>

        {post.tags.length > 0 && (
          <nav aria-label={t("tags")} className="border-ink/8 border-t pt-6">
            <ul className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <li key={tag}>
                  <Link
                    href={{ pathname: "/blog/tag/[tag]", params: { tag } }}
                    className="border-ink/10 text-ink-muted hover:border-ink/25 hover:text-ink flex min-h-9 items-center rounded-full border-[1.5px] px-3 text-sm font-semibold transition-colors duration-200 hover:bg-white/60"
                  >
                    #{tag}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </article>

      {post.related.length > 0 && (
        <section
          aria-labelledby="blog-related"
          className="mx-auto mt-14 max-w-5xl space-y-5"
        >
          <h2
            id="blog-related"
            className="font-display text-ink text-2xl sm:text-3xl"
          >
            {t("related")}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {post.related.map((item) => (
              <li key={item.id}>
                <PostCard post={item} locale={locale} headingLevel="h3" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
