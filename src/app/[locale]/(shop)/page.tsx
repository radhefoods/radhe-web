import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ComponentProps, ReactNode } from "react";
import { ProductCard } from "@/components/catalogue/product-card";
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
  featuredQuery,
  popularProducts,
  rowQuery,
} from "@/features/catalogue/home";
import { Link } from "@/i18n/navigation";
import { localeOf } from "@/i18n/locale";
import type { Locale } from "@/i18n/routing";
import type { ProductSummary } from "@/lib/api/types";
import { alternates, sameHref } from "@/lib/seo/alternates";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";

type Href = ComponentProps<typeof Link>["href"];

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

/** A row of products for the home page; none when the catalogue is away. */
async function products(
  query: Parameters<typeof listProducts>[0],
  locale: Locale,
): Promise<ProductSummary[]> {
  try {
    return (await listProducts(query, locale)).items;
  } catch {
    // The home page still explains the shop when the catalogue is away.
    return [];
  }
}

/** The title of a section of the home page, with the way to the full list. */
function SectionHeader({
  id,
  title,
  href,
  link,
}: {
  id: string;
  title: string;
  href?: Href;
  link?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <h2 id={id} className="font-display text-ink text-[1.75rem] sm:text-3xl">
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="bg-leaf-50 text-leaf-700 hover:text-ink hover:bg-wheat-400 inline-flex min-h-10 items-center gap-1 rounded-full px-4 text-[0.9375rem] font-bold whitespace-nowrap transition-colors duration-150"
        >
          {link}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await localeOf(params);
  const [t, tSite, settings, categories, featured, banners] = await Promise.all(
    [
      getTranslations("home"),
      getTranslations("site"),
      getSettings(),
      getCategories(locale),
      products(featuredQuery, locale),
      getBanners(locale),
    ],
  );
  // One row per main category that has products, in the order of the
  // admin, each with its first products in the recommended order (owner,
  // 2026-10-16). A category whose products do not arrive shows no row.
  // While the admin has marked nothing as featured, "Popular right now"
  // shows the first products of the whole catalogue (owner, 2026-10-18).
  const [catalogue, rows] = await Promise.all([
    featured.length > 0 ? [] : products(rowQuery(), locale),
    Promise.all(
      categories
        .filter((category) => category.productCount > 0)
        .map(async (category) => ({
          category,
          items: (await products(rowQuery(category.slug), locale)).slice(
            0,
            ROW_SIZE,
          ),
        })),
    ).then((all) => all.filter((row) => row.items.length > 0)),
  ]);
  const popular = popularProducts(featured, catalogue);
  const rowLabels = { back: t("rowBack"), forward: t("rowForward") };
  // A card of a row: two and a sliver on phones, then three, four, five.
  const cardSizes =
    "(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 44vw";

  const steps = [
    { title: t("step1Title"), text: t("step1Text") },
    { title: t("step2Title"), text: t("step2Text") },
    { title: t("step3Title"), text: t("step3Text") },
  ];

  const bandTitle = "font-display mt-3 text-[1.75rem] sm:text-3xl";
  const bandText = "mt-2.5 max-w-md text-white/80";

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
        <div className="container-page pt-3 sm:pt-5 lg:pt-6">
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
                <a
                  href="#how-it-works"
                  className={buttonStyles({ variant: "ghost", size: "lg" })}
                >
                  {t("stepsTitle")}
                </a>
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
              <ProductRowItem key={product.id}>
                <ProductCard
                  product={product}
                  imageSizes={cardSizes}
                  priority={index < 4}
                />
              </ProductRowItem>
            ))}
          </ProductRow>
        )}

        {rows.map(({ category, items }) => (
          <ProductRow
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
          >
            {items.map((product) => (
              <ProductRowItem key={product.id}>
                <ProductCard product={product} imageSizes={cardSizes} />
              </ProductRowItem>
            ))}
          </ProductRow>
        ))}

        <section
          id="how-it-works"
          aria-labelledby="home-steps"
          className="scroll-mt-28"
        >
          <SectionHeader id="home-steps" title={t("stepsTitle")} />
          <ol className="mt-5 grid gap-3 md:grid-cols-3">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="bg-mist flex flex-col gap-3 rounded-lg p-6"
              >
                <span
                  aria-hidden="true"
                  className="font-display text-ink bg-wheat-400 grid size-10 place-items-center rounded-full text-lg"
                >
                  {index + 1}
                </span>
                <h3 className="font-display text-xl">{step.title}</h3>
                <p className="text-ink-muted text-[0.9375rem]">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* The promise and the news, on an echo of the hero's weave. */}
        <section
          aria-labelledby="home-pay"
          className="hero-band grid gap-8 rounded-xl p-7 text-white sm:p-10 md:grid-cols-2 md:gap-10"
        >
          <div>
            <Eyebrow>{t("payEyebrow")}</Eyebrow>
            <h2 id="home-pay" className={bandTitle}>
              {t("payTitle")}
            </h2>
            <p className={bandText}>{t("payText")}</p>
          </div>
          <div>
            <Eyebrow>{t("newsEyebrow")}</Eyebrow>
            <h2 className={bandTitle}>{t("newsTitle")}</h2>
            <p className={bandText}>{t("newsText")}</p>
            <Link
              href="/account/profile"
              className={buttonStyles({ variant: "wheat", className: "mt-5" })}
            >
              {t("newsCta")}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
