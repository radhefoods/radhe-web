import {
  ArrowRight,
  PackageCheck,
  ShieldCheck,
  Tag,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ComponentProps, ReactNode } from "react";
import { NextDeliveryCard } from "@/components/cargo/next-delivery-card";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { ProductImage } from "@/components/catalogue/product-image";
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

type Href = ComponentProps<typeof Link>["href"];

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
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h2 id={id} className="font-display text-2xl text-blue-900 sm:text-3xl">
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-1 rounded-xs text-[0.9375rem] font-bold text-blue-700 hover:underline"
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
  const [t, tSite, tCargo, tNav, cargo, settings, categories, popular, offers] =
    await Promise.all([
      getTranslations("home"),
      getTranslations("site"),
      getTranslations("cargo"),
      getTranslations("nav"),
      getCargo(locale),
      getSettings(),
      getCategories(locale),
      products({ featured: true, limit: 8 }, locale),
      products({ onSale: true, limit: 4 }, locale),
    ]);
  const open = cargo?.acceptingOrders ?? false;
  const freeFrom = settings?.deliveryFee.freeFrom ?? null;
  // Full rows only: four per row on wide screens, two on phones.
  const featured = popular.slice(0, popular.length >= 8 ? 8 : 4);

  const promises: [LucideIcon, string][] = [
    [ShieldCheck, t("trustPay")],
    [Truck, t("trustDelivery")],
    [Tag, t("trustVat")],
  ];
  if (freeFrom !== null) {
    promises.splice(2, 0, [
      PackageCheck,
      t("trustFree", { amount: formatMoney(freeFrom, locale) }),
    ]);
  }

  const steps = [
    { title: t("step1Title"), text: t("step1Text") },
    { title: t("step2Title"), text: t("step2Text") },
    { title: t("step3Title"), text: t("step3Text") },
  ];

  return (
    <div className="container-page flex flex-col gap-10 py-5 sm:py-6 lg:gap-12">
      <JsonLd
        data={[organizationJsonLd(tSite("tagline")), websiteJsonLd(locale)]}
      />

      {/* The banner and the next delivery: the pre-order at a glance. */}
      <section
        aria-labelledby="home-title"
        className="grid gap-4 lg:grid-cols-[1.6fr_1fr]"
      >
        <div className="hero-band flex min-h-72 flex-col justify-center gap-4 overflow-hidden rounded-xl px-6 py-8 text-white sm:px-10 sm:py-10">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 py-1 pr-3 pl-2 text-[0.8125rem] font-semibold">
            <span
              aria-hidden="true"
              className="bg-saffron-400 ring-saffron-400/30 size-2 rounded-full ring-4"
            />
            {open ? tCargo("open") : t("closedEyebrow")}
          </p>
          <h1
            id="home-title"
            className="font-display max-w-[20ch] text-[2rem] leading-[1.1] sm:text-[2.5rem] lg:text-[2.75rem]"
          >
            {t.rich("title", {
              em: (chunks) => (
                <em className="text-saffron-300 not-italic">{chunks}</em>
              ),
            })}
          </h1>
          <p className="max-w-lg text-[0.9375rem] text-blue-100 sm:text-base">
            {t("lead")}
          </p>
          <div className="mt-1 flex flex-wrap gap-2.5">
            <Link
              href="/products"
              className={buttonStyles({ variant: "saffron", size: "lg" })}
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
      </section>

      <ul
        aria-label={tSite("name")}
        className="grid grid-cols-2 gap-2.5 lg:grid-cols-4"
      >
        {promises.map(([Icon, text]) => (
          <li
            key={text}
            className="border-line flex items-center gap-2.5 rounded-lg border bg-white px-3.5 py-3 text-[0.8125rem] leading-snug font-semibold sm:text-sm"
          >
            <Icon
              aria-hidden="true"
              className="size-5 shrink-0 text-green-600"
            />
            {text}
          </li>
        ))}
      </ul>

      {categories.length > 0 && (
        <section aria-labelledby="home-categories">
          <SectionHeader
            id="home-categories"
            title={t("categoriesTitle")}
            href="/products"
            link={tNav("allCategories")}
          />
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={{
                    pathname: "/category/[slug]",
                    params: { slug: category.slug },
                  }}
                  className="group border-line hover:border-line-strong hover:shadow-card flex h-full flex-col items-center gap-3 rounded-lg border bg-white px-3 py-4 text-center transition-[box-shadow,border-color] duration-150"
                >
                  <span className="bg-mist grid size-16 shrink-0 place-items-center overflow-hidden rounded-full">
                    {category.image ? (
                      <ProductImage
                        image={category.image}
                        alt=""
                        sizes="64px"
                        fallbackLabel=""
                        className="object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="font-display text-2xl text-blue-600"
                      >
                        {category.name.charAt(0)}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm leading-tight font-bold group-hover:text-blue-700">
                      {category.name}
                    </span>
                    <span className="text-ink-subtle mt-1 block text-xs">
                      {t("productCount", { count: category.productCount })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {offers.length > 0 && (
        <section aria-labelledby="home-offers">
          <SectionHeader
            id="home-offers"
            title={t("offersTitle")}
            href={{ pathname: "/products", query: { onSale: "1" } }}
            link={t("offersAll")}
          />
          <ProductGrid products={offers.slice(0, 4)} className="mt-5" />
        </section>
      )}

      {featured.length > 0 && (
        <section aria-labelledby="home-featured">
          <SectionHeader
            id="home-featured"
            title={t("featuredTitle")}
            href="/products"
            link={t("featuredAll")}
          />
          <ProductGrid products={featured} className="mt-5" />
        </section>
      )}

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
              className="border-line flex flex-col gap-2 rounded-lg border bg-white p-5"
            >
              <span
                aria-hidden="true"
                className="font-display grid size-9 place-items-center rounded-md bg-blue-50 text-lg text-blue-600"
              >
                {index + 1}
              </span>
              <h3 className="font-display mt-1 text-lg">{step.title}</h3>
              <p className="text-ink-muted text-[0.9375rem]">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="home-news"
        className="border-line flex flex-wrap items-center justify-between gap-x-10 gap-y-5 rounded-xl border bg-white p-6 sm:p-8"
      >
        <div className="max-w-2xl space-y-2">
          <h2 id="home-news" className="font-display text-2xl text-blue-900">
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
      </section>
    </div>
  );
}
