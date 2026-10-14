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
import { Eyebrow } from "@/components/ui/eyebrow";
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
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <h2 id={id} className="font-display text-ink text-[1.75rem] sm:text-3xl">
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="bg-leaf-50 text-leaf-700 hover:text-ink inline-flex min-h-10 items-center gap-1 rounded-full px-4 text-[0.9375rem] font-bold whitespace-nowrap transition-colors duration-150 hover:bg-lime-400"
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
  const [
    t,
    tSite,
    tCargo,
    tCart,
    tNav,
    cargo,
    settings,
    categories,
    popular,
    offers,
  ] = await Promise.all([
    getTranslations("home"),
    getTranslations("site"),
    getTranslations("cargo"),
    getTranslations("cart"),
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

  const bandTitle = "font-display mt-3 text-[1.75rem] sm:text-3xl";
  const bandText = "mt-2.5 max-w-md text-white/80";

  return (
    <>
      <JsonLd
        data={[organizationJsonLd(tSite("tagline")), websiteJsonLd(locale)]}
      />

      {/* The hero: the woven band with the promise of the shop, and next to
          it the countdown card. The pre-order at a glance. */}
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
                  <em className="text-lime-400 not-italic">{chunks}</em>
                ),
              })}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed font-medium text-white/85">
              {t("lead")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/products"
                className={buttonStyles({ variant: "lime", size: "lg" })}
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
          <NextDeliveryCard freeFrom={freeFrom} />
        </div>
      </section>

      <div className="container-page flex flex-col gap-10 py-6 lg:gap-12 lg:py-8">
        <ul
          aria-label={tSite("name")}
          className="grid grid-cols-2 gap-2.5 lg:grid-cols-4"
        >
          {promises.map(([Icon, text]) => (
            <li
              key={text}
              className="bg-mist flex items-center gap-3 rounded-lg px-3.5 py-3 text-[0.8125rem] leading-snug font-semibold sm:text-[0.9375rem]"
            >
              <span className="text-leaf-600 grid size-8 shrink-0 place-items-center rounded-full bg-white">
                <Icon aria-hidden="true" className="size-4.5" />
              </span>
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
                    className="group bg-mist hover:bg-cloud flex h-full flex-col items-center gap-3 rounded-lg px-3 py-5 text-center transition-[background-color,transform] duration-150 hover:-translate-y-0.5"
                  >
                    <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-white">
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
                          className="font-display text-leaf-600 text-2xl"
                        >
                          {category.name.charAt(0)}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="font-display group-hover:text-leaf-700 block text-base leading-tight">
                        {category.name}
                      </span>
                      <span className="text-ink-subtle mt-1 block text-xs font-semibold">
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
                className="bg-mist flex flex-col gap-3 rounded-lg p-6"
              >
                <span
                  aria-hidden="true"
                  className="font-display text-ink grid size-10 place-items-center rounded-full bg-lime-400 text-lg"
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
            <Eyebrow>{tCart("dueToday")}</Eyebrow>
            <h2 id="home-pay" className={bandTitle}>
              {tCargo("payLaterTitle")}
            </h2>
            <p className={bandText}>{tCargo("payLaterText")}</p>
          </div>
          <div>
            <Eyebrow>{tCargo("nextDelivery")}</Eyebrow>
            <h2 className={bandTitle}>{t("newsTitle")}</h2>
            <p className={bandText}>{t("newsText")}</p>
            <Link
              href="/account/profile"
              className={buttonStyles({ variant: "lime", className: "mt-5" })}
            >
              {t("newsCta")}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
