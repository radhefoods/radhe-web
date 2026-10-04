import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/catalogue/breadcrumbs";
import { ProductListing } from "@/components/catalogue/product-listing";
import { LocaleAlternates } from "@/components/shell/locale-switcher";
import { getCategory } from "@/features/catalogue/data";
import {
  isFiltered,
  parseListingState,
  toSearchParams,
} from "@/features/catalogue/listing-state";
import { Link, permanentRedirect } from "@/i18n/navigation";
import { localeOf } from "@/i18n/locale";
import type { Locale } from "@/i18n/routing";
import type { LocalizedSlugs } from "@/lib/api/types";
import { alternates } from "@/lib/seo/alternates";
import { JsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";

type Props = PageProps<"/[locale]/category/[slug]">;

const categoryHref = (slug: string) => ({
  pathname: "/category/[slug]" as const,
  params: { slug },
});

const hrefsOf = (slugs: LocalizedSlugs) => ({
  en: categoryHref(slugs.en),
  de: categoryHref(slugs.de),
});

/** The category of the address, under its slug in this language. */
async function loadCategory(slug: string, locale: Locale) {
  const category = await getCategory(slug, locale);
  if (!category) notFound();
  // The API answers to the slug of either language; the page has one address.
  if (category.slug !== slug) {
    permanentRedirect({ href: categoryHref(category.slug), locale });
  }
  return category;
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const locale = await localeOf(params);
  const { slug } = await params;
  const category = await getCategory(slug, locale);
  if (!category) return {};
  const t = await getTranslations("catalogue");
  const state = parseListingState(await searchParams);
  const filtered = isFiltered(state);
  const links = alternates(locale, hrefsOf(category.slugs));
  return {
    title: category.seo.title ?? category.name,
    description:
      category.seo.description ??
      category.description ??
      t("categoryDescription", { name: category.name }),
    robots: filtered ? { index: false, follow: true } : undefined,
    alternates:
      !filtered && state.page > 1
        ? {
            canonical: `${links.canonical}?${new URLSearchParams(
              toSearchParams(state),
            )}`,
          }
        : links,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const locale = await localeOf(params);
  const { slug } = await params;
  const category = await loadCategory(slug, locale);
  const [t, tNav] = await Promise.all([
    getTranslations("catalogue"),
    getTranslations("nav"),
  ]);
  const state = parseListingState(await searchParams);

  return (
    <div className="container-page space-y-6 py-6 sm:py-8">
      <LocaleAlternates hrefs={hrefsOf(category.slugs)} />
      <JsonLd
        data={breadcrumbJsonLd(locale, tNav("home"), category.breadcrumbs)}
      />
      <Breadcrumbs categories={category.breadcrumbs} />

      <header className="space-y-2">
        <h1 className="font-display text-4xl text-blue-900 sm:text-5xl">
          {category.name}
        </h1>
        {(category.description ?? category.tagline) && (
          <p className="text-ink-muted max-w-2xl">
            {category.description ?? category.tagline}
          </p>
        )}
      </header>

      {category.children.length > 0 && (
        <nav aria-label={t("subcategories")}>
          <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {category.children.map((child) => (
              <li key={child.id}>
                <Link
                  href={categoryHref(child.slug)}
                  className="bg-mist flex min-h-11 items-center rounded-full px-4 text-[0.9375rem] font-semibold whitespace-nowrap hover:bg-blue-50 hover:text-blue-800"
                >
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <ProductListing
        locale={locale}
        base={categoryHref(category.slug)}
        category={category.slug}
        state={state}
        listName={category.name}
        emptyText={t("emptyCategoryText")}
      />
    </div>
  );
}
