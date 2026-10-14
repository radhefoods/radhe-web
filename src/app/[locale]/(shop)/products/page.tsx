import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProductListing } from "@/components/catalogue/product-listing";
import {
  isFiltered,
  parseListingState,
  toQueryString,
} from "@/features/catalogue/listing-state";
import { localeOf } from "@/i18n/locale";
import { alternates, sameHref } from "@/lib/seo/alternates";

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/[locale]/products">): Promise<Metadata> {
  const locale = await localeOf(params);
  const t = await getTranslations("catalogue");
  const state = parseListingState(await searchParams);
  const filtered = isFiltered(state);
  const links = alternates(locale, sameHref("/products"));
  return {
    title: state.q ? t("searchTitle", { query: state.q }) : t("allTitle"),
    description: t("allDescription"),
    // Searches, sorted and filtered views are views of the same list: only
    // the plain list (and its further pages) belongs in a search engine.
    robots: filtered ? { index: false, follow: true } : undefined,
    alternates:
      !filtered && state.page > 1
        ? {
            canonical: `${links.canonical}?${toQueryString(state)}`,
          }
        : links,
  };
}

export default async function ProductsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/products">) {
  const locale = await localeOf(params);
  const t = await getTranslations("catalogue");
  const state = parseListingState(await searchParams);

  return (
    <div className="container-page space-y-5 py-6 sm:py-8">
      <header className="space-y-1.5">
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {state.q ? t("searchTitle", { query: state.q }) : t("allTitle")}
        </h1>
        {!state.q && (
          <p className="text-ink-muted max-w-2xl">{t("allIntro")}</p>
        )}
      </header>
      <ProductListing
        locale={locale}
        base="/products"
        state={state}
        listName={t("allTitle")}
        emptyText={t("emptyText")}
      />
    </div>
  );
}
