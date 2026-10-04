import {
  ArrowRight,
  PackageCheck,
  ShieldCheck,
  Tag,
  Truck,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NextDeliveryCard } from "@/components/cargo/next-delivery-card";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { buttonStyles } from "@/components/ui/button";
import {
  getCargo,
  getCategories,
  getSettings,
  listProducts,
} from "@/features/catalogue/data";
import { Link } from "@/i18n/navigation";
import { localeOf } from "@/i18n/locale";
import type { Locale } from "@/i18n/routing";
import type { ProductSummary } from "@/lib/api/types";
import { formatMoney } from "@/lib/format/money";
import { alternates, sameHref } from "@/lib/seo/alternates";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";

export const revalidate = 300;

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

async function featuredProducts(locale: Locale): Promise<ProductSummary[]> {
  try {
    const page = await listProducts({ featured: true, limit: 8 }, locale);
    // Full rows only: four per row on wide screens, two on phones.
    return page.items.slice(0, page.items.length >= 8 ? 8 : 4);
  } catch {
    // The home page still explains the shop when the catalogue is away.
    return [];
  }
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await localeOf(params);
  const [t, tSite, tCargo, cargo, settings, categories, featured] =
    await Promise.all([
      getTranslations("home"),
      getTranslations("site"),
      getTranslations("cargo"),
      getCargo(locale),
      getSettings(),
      getCategories(locale),
      featuredProducts(locale),
    ]);
  const open = cargo?.acceptingOrders ?? false;
  const freeFrom = settings?.deliveryFee.freeFrom ?? null;

  const steps = [
    { title: t("step1Title"), text: t("step1Text") },
    { title: t("step2Title"), text: t("step2Text") },
    { title: t("step3Title"), text: t("step3Text") },
  ];

  return (
    <>
      <JsonLd
        data={[organizationJsonLd(tSite("tagline")), websiteJsonLd(locale)]}
      />

      <section className="hero-band text-white">
        <div className="container-page grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-[1.25fr_1fr] lg:gap-12 lg:py-20">
          <div>
            <p className="text-gold-300 flex items-center gap-2.5 text-[0.8125rem] font-bold tracking-wider uppercase">
              <span
                aria-hidden="true"
                className="bg-gold-300 ring-gold-300/25 size-2 rounded-full ring-4"
              />
              {open ? tCargo("open") : t("closedEyebrow")}
            </p>
            <h1 className="font-display mt-4 text-[2.6rem] leading-[1.02] sm:text-6xl lg:text-[4.25rem]">
              {t.rich("title", {
                em: (chunks) => (
                  <em className="text-gold-300 italic">{chunks}</em>
                ),
              })}
            </h1>
            <p className="mt-5 max-w-xl text-[1.0625rem] text-blue-200 sm:text-lg">
              {t("lead")}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/products"
                className={buttonStyles({ variant: "gold", size: "lg" })}
              >
                {open ? t("ctaShop") : t("ctaBrowse")}
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
          <NextDeliveryCard />
        </div>
      </section>

      <section aria-label={tSite("name")} className="border-line border-b">
        <ul className="container-page grid gap-x-8 gap-y-3 py-5 text-[0.9375rem] font-semibold sm:grid-cols-2 lg:grid-cols-4">
          <li className="flex items-center gap-2.5">
            <ShieldCheck aria-hidden="true" className="text-gold-500 size-5" />
            {t("trustPay")}
          </li>
          <li className="flex items-center gap-2.5">
            <Truck aria-hidden="true" className="text-gold-500 size-5" />
            {t("trustDelivery")}
          </li>
          {freeFrom !== null && (
            <li className="flex items-center gap-2.5">
              <PackageCheck
                aria-hidden="true"
                className="text-gold-500 size-5"
              />
              {t("trustFree", { amount: formatMoney(freeFrom, locale) })}
            </li>
          )}
          <li className="flex items-center gap-2.5">
            <Tag aria-hidden="true" className="text-gold-500 size-5" />
            {t("trustVat")}
          </li>
        </ul>
      </section>

      {categories.length > 0 && (
        <section
          aria-labelledby="home-categories"
          className="container-page pt-12 sm:pt-16"
        >
          <h2
            id="home-categories"
            className="font-display text-4xl text-blue-900 sm:text-5xl"
          >
            {t("categoriesTitle")}
          </h2>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={{
                    pathname: "/category/[slug]",
                    params: { slug: category.slug },
                  }}
                  className="group bg-mist flex h-full min-h-28 flex-col justify-between gap-3 rounded-lg p-4 transition-colors duration-150 hover:bg-blue-50 sm:p-5"
                >
                  <span>
                    <span className="font-display block text-2xl leading-tight text-blue-900 sm:text-[1.75rem]">
                      {category.name}
                    </span>
                    {category.tagline && (
                      <span className="text-ink-muted mt-1 block text-sm">
                        {category.tagline}
                      </span>
                    )}
                  </span>
                  <span className="text-ink-muted flex items-center justify-between text-sm font-semibold">
                    {t("productCount", { count: category.productCount })}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-5 text-blue-600 transition-transform duration-150 group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {featured.length > 0 && (
        <section
          aria-labelledby="home-featured"
          className="container-page pt-12 sm:pt-16"
        >
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <h2
              id="home-featured"
              className="font-display text-4xl text-blue-900 sm:text-5xl"
            >
              {t("featuredTitle")}
            </h2>
            <Link
              href="/products"
              className="flex items-center gap-1.5 rounded-xs font-bold text-blue-700 underline-offset-4 hover:underline"
            >
              {t("featuredAll")}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <ProductGrid products={featured} className="mt-6" />
        </section>
      )}

      <section
        id="how-it-works"
        aria-labelledby="home-steps"
        className="container-page scroll-mt-28 pt-12 sm:pt-16"
      >
        <h2
          id="home-steps"
          className="font-display text-4xl text-blue-900 sm:text-5xl"
        >
          {t("stepsTitle")}
        </h2>
        <ol className="mt-6 grid gap-3 sm:gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="bg-mist flex flex-col gap-2 rounded-lg p-5 sm:p-6"
            >
              <span
                aria-hidden="true"
                className="font-display text-5xl leading-none text-blue-600"
              >
                {index + 1}
              </span>
              <h3 className="text-lg font-bold">{step.title}</h3>
              <p className="text-ink-muted text-[0.9375rem]">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
      <section
        aria-labelledby="home-news"
        className="container-page pt-12 sm:pt-16"
      >
        <div className="bg-mist flex flex-wrap items-center justify-between gap-x-10 gap-y-5 rounded-xl p-6 sm:p-8">
          <div className="max-w-2xl space-y-2">
            <h2
              id="home-news"
              className="font-display text-3xl text-blue-900 sm:text-4xl"
            >
              {t("newsTitle")}
            </h2>
            <p className="text-ink-muted">{t("newsText")}</p>
          </div>
          <Link
            href="/account/profile"
            className={buttonStyles({ variant: "secondary" })}
          >
            {t("newsCta")}
          </Link>
        </div>
      </section>
    </>
  );
}
