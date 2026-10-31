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
  toQueryString,
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
            canonical: `${links.canonical}?${toQueryString(state)}`,
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
    <div className="container-page space-y-5 py-5 sm:py-6">
      <LocaleAlternates hrefs={hrefsOf(category.slugs)} />
      <JsonLd
        data={breadcrumbJsonLd(locale, tNav("home"), category.breadcrumbs)}
      />
      <Breadcrumbs categories={category.breadcrumbs} />

      <header className="space-y-1.5">
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
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
                  className="glass-soft ease-glass hover:text-leaf-700 flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-[background-color,color,transform] duration-200 hover:bg-white/90 active:scale-[0.98]"
                >
                  {child.name}
                  <span className="text-ink-subtle text-xs tabular-nums">
                    {child.productCount}
                  </span>
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
