import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { BlogListing } from "@/components/blog/blog-listing";
import { LocaleAlternates } from "@/components/shell/locale-switcher";
import {
  parseBlogState,
  toBlogQueryString,
} from "@/features/content/blog-state";
import { getBlogCategories, getBlogTags } from "@/features/content/data";
import { permanentRedirect } from "@/i18n/navigation";
import { localeOf } from "@/i18n/locale";
import type { Locale } from "@/i18n/routing";
import type { BlogCategory, LocalizedSlugs } from "@/lib/api/types";
import { alternates } from "@/lib/seo/alternates";

type Props = PageProps<"/[locale]/blog/category/[slug]">;

const categoryHref = (slug: string) => ({
  pathname: "/blog/category/[slug]" as const,
  params: { slug },
});

const hrefsOf = (slugs: LocalizedSlugs) => ({
  en: categoryHref(slugs.en),
  de: categoryHref(slugs.de),
});

/** The category behind a slug of either language, from the list (doc 19). */
async function findCategory(
  slug: string,
  locale: Locale,
): Promise<BlogCategory | null> {
  const categories = await getBlogCategories(locale);
  return (
    categories.find(
      (category) =>
        category.slug === slug ||
        category.alternates.en === slug ||
        category.alternates.de === slug,
    ) ?? null
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const locale = await localeOf(params);
  const { slug } = await params;
  const category = await findCategory(slug, locale);
  if (!category) return {};
  const t = await getTranslations("blog");
  const state = parseBlogState(await searchParams);
  const links = alternates(locale, hrefsOf(category.alternates));
  return {
    title: category.seo.title ?? category.name,
    description:
      category.seo.description ??
      category.description ??
      t("categoryDescription", { name: category.name }),
    robots: state.q ? { index: false, follow: true } : undefined,
    alternates:
      !state.q && state.page > 1
        ? { canonical: `${links.canonical}?${toBlogQueryString(state)}` }
        : links,
  };
}

/** The posts of one category of the blog, newest first. */
export default async function BlogCategoryPage({
  params,
  searchParams,
}: Props) {
  const locale = await localeOf(params);
  const { slug } = await params;
  const category = await findCategory(slug, locale);
  if (!category) notFound();
  // The address of either language finds the category; the page has one.
  if (category.slug !== slug) {
    permanentRedirect({ href: categoryHref(category.slug), locale });
  }
  const [t, state, categories, tags] = await Promise.all([
    getTranslations("blog"),
    searchParams.then(parseBlogState),
    getBlogCategories(locale),
    getBlogTags(locale),
  ]);

  return (
    <div className="container-page space-y-5 py-6 sm:py-8">
      <LocaleAlternates hrefs={hrefsOf(category.alternates)} />
      <header className="space-y-1.5">
        <p className="text-leaf-700 text-[0.6875rem] font-bold tracking-[0.1em] uppercase">
          {t("title")}
        </p>
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {category.name}
        </h1>
        {category.description && (
          <p className="text-ink-muted max-w-2xl">{category.description}</p>
        )}
      </header>
      <BlogListing
        locale={locale}
        base={categoryHref(category.slug)}
        scope={{ category: category.slug }}
        state={state}
        categories={categories}
        tags={tags}
        emptyText={t("emptyCategoryText")}
      />
    </div>
  );
}
