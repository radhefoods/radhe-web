import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProductCard } from "@/components/catalogue/product-card";
import { CategoryRow } from "@/components/home/category-row";
import { DeliveryPromiseCard } from "@/components/home/delivery-promise-card";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { ProductRow, ProductRowItem } from "@/components/home/product-row";
import { buttonStyles } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import {
  getBanners,
  getCategories,
  getSettings,
  listProducts,
} from "@/features/catalogue/data";
import {
  ROW_SIZE,
  catalogueQuery,
  featuredQuery,
  popularProducts,
  rowQuery,
} from "@/features/catalogue/home";
import { Link } from "@/i18n/navigation";
import { localeOf } from "@/i18n/locale";
import type { Locale } from "@/i18n/routing";
import type { ProductList } from "@/lib/api/types";
import { alternates, sameHref } from "@/lib/seo/alternates";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";

// Rendered at every visit, like the category pages, from the same cached
// answers of the API (five minutes, `REVALIDATE.catalogue`). A page cached
// on top of cached data showed the admin's price changes long after the
// category pages (owner, 2026-10-18); now both lag by the same five minutes
// at most. The banners of the hero are asked for afresh at every visit.
export const revalidate = 0;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = await localeOf(params);
  const t = await getTranslations("home");
  return {
    title: { absolute: `Radhe Foods | ${t("metaTitle")}` },
    description: t("metaDescription"),
    alternates: alternates(locale, sameHref("/")),
  };
}

/** A list of products for the home page; `null` when the catalogue is away. */
async function products(
  query: Parameters<typeof listProducts>[0],
  locale: Locale,
): Promise<ProductList | null> {
  try {
    return await listProducts(query, locale);
  } catch {
    // The home page still explains the shop when the catalogue is away.
    return null;
  }
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await localeOf(params);
  const [t, tSite, settings, categories, featured, banners] = await Promise.all(
    [
      getTranslations("home"),
      getTranslations("site"),
      getSettings(),
      getCategories(locale),
      products(featuredQuery, locale).then((list) => list?.items ?? []),
      getBanners(locale),
    ],
  );
  // One row per main category that has products, in the order of the
  // admin, each with its pack sizes in rounds: the smallest size of every
  // product first, in the admin's order (owner, 2026-10-16 and
  // 2026-10-24). The server renders the first page of a row; the browser
  // fetches the following pages as the visitor turns towards its end
  // (`CategoryRow`). A category whose products do not arrive shows no row.
  // While the admin has marked nothing as featured, "Popular right now"
  // shows the first products of the whole catalogue (owner, 2026-10-18).
  const [catalogue, rows] = await Promise.all([
    featured.length > 0
      ? []
      : products(catalogueQuery, locale).then((list) => list?.items ?? []),
    Promise.all(
      categories
        .filter((category) => category.productCount > 0)
        .map(async (category) => {
          const list = await products(rowQuery(category.slug), locale);
          return {
            category,
            items: list?.items.slice(0, ROW_SIZE) ?? [],
            pages: list?.totalPages ?? 1,
          };
        }),
    ).then((all) => all.filter((row) => row.items.length > 0)),
  ]);
  const popular = popularProducts(featured, catalogue);
  const rowLabels = {
    back: t("rowBack"),
    forward: t("rowForward"),
    loading: t("rowLoading"),
  };
  // A card of a row: two and a sliver on phones, then three, four, five.
  const cardSizes =
    "(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 44vw";

  return (
    <>
      <JsonLd
        data={[organizationJsonLd(tSite("tagline")), websiteJsonLd(locale)]}
      />

      {/* The hero (owner, 2026-10-19): the carousel of the admin's banners.
          While no banner is live, the woven band with the promise of the
          shop and the ticket with delivery and payment at a glance stands
          in, so the page never opens empty. */}
      {banners.length > 0 ? (
        <div>
          <h1 className="sr-only">{t("metaTitle")}</h1>
          <HeroCarousel
            banners={banners}
            labels={{
              region: t("carousel.label"),
              slides: banners.map((_, index) =>
                t("carousel.slide", {
                  index: index + 1,
                  count: banners.length,
                }),
              ),
              goTo: banners.map((_, index) =>
                t("carousel.goTo", { index: index + 1 }),
              ),
            }}
          />
        </div>
      ) : (
        <section aria-labelledby="home-title" className="hero-band text-white">
          <div className="container-page grid items-center gap-10 py-10 sm:py-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14 lg:py-16">
            <div>
              <Eyebrow>{t("eyebrow")}</Eyebrow>
              <h1
                id="home-title"
                // No hyphens in the headline: "Lebensmittel" breaks whole.
                className="font-display headline-no-hyphens mt-4 max-w-[14ch] text-[2.25rem] leading-[1.04] sm:text-[2.75rem] lg:text-[3.5rem]"
              >
                {t.rich("title", {
                  em: (chunks) => (
                    <em className="text-wheat-400 not-italic">{chunks}</em>
                  ),
                })}
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed font-medium text-white/85">
                {t("lead")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className={buttonStyles({ variant: "wheat", size: "lg" })}
                >
                  {t("ctaShop")}
                  <ArrowRight aria-hidden="true" className="size-5" />
                </Link>
                <Link
                  href="/how-it-works"
                  className={buttonStyles({ variant: "ghost", size: "lg" })}
                >
                  {t("stepsTitle")}
                </Link>
              </div>
            </div>
            <DeliveryPromiseCard settings={settings} locale={locale} />
          </div>
        </section>
      )}

      <div className="container-page flex flex-col gap-10 py-6 lg:gap-12 lg:py-8">
        {popular.length > 0 && (
          <ProductRow
            id="home-featured"
            title={t("featuredTitle")}
            href="/products"
            link={t("seeAll")}
            linkLabel={t("featuredAll")}
            labels={rowLabels}
          >
            {popular.map((product, index) => (
              <ProductRowItem key={product.variantId}>
                <ProductCard
                  product={product}
                  imageSizes={cardSizes}
                  priority={index < 4}
                />
              </ProductRowItem>
            ))}
          </ProductRow>
        )}

        {rows.map(({ category, items, pages }) => (
          <CategoryRow
            key={category.id}
            id={`home-category-${category.id}`}
            title={category.name}
            tagline={category.tagline}
            href={{
              pathname: "/category/[slug]",
              params: { slug: category.slug },
            }}
            link={t("seeAll")}
            linkLabel={t("seeAllIn", { name: category.name })}
            labels={rowLabels}
            category={category.slug}
            locale={locale}
            pages={pages}
            shown={items.map((product) => product.variantId)}
            imageSizes={cardSizes}
          >
            {items.map((product) => (
              // Two cards of a row can be one product (doc 7); the size is unique.
              <ProductRowItem key={product.variantId}>
                <ProductCard product={product} imageSizes={cardSizes} />
              </ProductRowItem>
            ))}
          </CategoryRow>
        ))}
      </div>
    </>
  );
}
