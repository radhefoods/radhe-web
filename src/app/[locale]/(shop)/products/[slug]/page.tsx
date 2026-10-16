import { Check } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/catalogue/breadcrumbs";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { ProductImage } from "@/components/catalogue/product-image";
import {
  PackSizeDiscount,
  PackSizeHeadline,
  PackSizePicker,
  PackSizePrice,
  PackSizeSku,
  PackSizes,
  ProductPurchase,
} from "@/components/catalogue/product-purchase";
import { getProduct, listProducts } from "@/features/catalogue/data";
import { Link, permanentRedirect } from "@/i18n/navigation";
import { localeOf } from "@/i18n/locale";
import type { Locale } from "@/i18n/routing";
import type {
  LocalizedSlugs,
  ProductDetail,
  ProductSummary,
} from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { alternates, pageUrl } from "@/lib/seo/alternates";
import { JsonLd, breadcrumbJsonLd, productJsonLd } from "@/lib/seo/json-ld";

type Props = PageProps<"/[locale]/products/[slug]">;

export const revalidate = 300;

// No product page is built ahead of time; each one is rendered at its first
// visit and then served from the cache, refreshed every five minutes.
export function generateStaticParams() {
  return [];
}

const productHref = (slug: string) => ({
  pathname: "/products/[slug]" as const,
  params: { slug },
});

const hrefsOf = (slugs: LocalizedSlugs) => ({
  en: productHref(slugs.en),
  de: productHref(slugs.de),
});

const panel = "border-line rounded-xl border bg-white";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeOf(params);
  const { slug } = await params;
  const product = await getProduct(slug, locale);
  if (!product) return {};
  // The title names the pack size the address stands for.
  const title = product.seo.title ?? product.displayName;
  const description =
    product.seo.description ?? product.shortDescription ?? undefined;
  const image = product.images[0]?.sizes.large;
  return {
    title,
    description,
    alternates: alternates(locale, hrefsOf(product.slugs)),
    openGraph: {
      title,
      description,
      url: pageUrl(productHref(product.slug), locale),
      images: image
        ? [{ url: image.url, width: image.width, height: image.height }]
        : undefined,
    },
  };
}

/**
 * Other products near this one: from its own category, or, when that holds
 * nothing else, from the top-level category above it.
 */
async function relatedProducts(
  product: ProductDetail,
  locale: Locale,
): Promise<{ name: string; items: ProductSummary[] } | null> {
  const candidates = [product.breadcrumbs.at(-1), product.breadcrumbs[0]];
  const tried = new Set<string>();
  for (const category of candidates) {
    if (!category || tried.has(category.slug)) continue;
    tried.add(category.slug);
    try {
      const page = await listProducts(
        { category: category.slug, limit: 9 },
        locale,
      );
      const items = page.items
        .filter((other) => other.id !== product.id)
        .slice(0, 4);
      if (items.length > 0) return { name: category.name, items };
    } catch {
      return null;
    }
  }
  return null;
}

export default async function ProductPage({ params }: Props) {
  const locale = await localeOf(params);
  const { slug } = await params;
  const product = await getProduct(slug, locale);
  if (!product) notFound();
  // The API answers to the slug of either language and to the base slug of
  // the product; the page of a size has one address.
  if (product.slug !== slug) {
    permanentRedirect({ href: productHref(product.slug), locale });
  }

  const [t, tNav, tCommon, related] = await Promise.all([
    getTranslations("product"),
    getTranslations("nav"),
    getTranslations("common"),
    relatedProducts(product, locale),
  ]);

  // The item number belongs to the chosen size and follows it.
  const facts: [string, ReactNode][] = [
    [t("ingredients"), product.food.ingredients],
    [t("allergens"), product.food.allergens],
    [t("nutrition"), product.food.nutrition],
    [t("storage"), product.food.storageInstructions],
    [t("origin"), product.food.origin],
    [t("manufacturer"), product.food.manufacturer ?? product.brand],
    [t("sku"), <PackSizeSku key="sku" />],
  ];

  return (
    <div className="container-page space-y-6 py-5 sm:py-6 lg:space-y-8">
      <JsonLd
        data={[
          productJsonLd(product, locale),
          breadcrumbJsonLd(locale, tNav("home"), product.breadcrumbs, {
            name: product.name,
            url: pageUrl(productHref(product.slug), locale),
          }),
        ]}
      />
      <Breadcrumbs categories={product.breadcrumbs} current={product.name} />

      <PackSizes product={product}>
        <div
          data-fly-scope=""
          className="grid gap-6 md:grid-cols-[1.1fr_1fr] lg:gap-10"
        >
          {/* Pictures: swipe on phones; the first one is the page's main picture. */}
          <ul className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto md:sticky md:top-36 md:self-start">
            {(product.images.length ? product.images : [null]).map(
              (image, index) => (
                <li
                  key={image?.id ?? "none"}
                  data-fly-source={index === 0 ? "" : undefined}
                  className="bg-mist relative aspect-square w-full shrink-0 snap-center overflow-hidden rounded-xl p-6 sm:p-10"
                >
                  <ProductImage
                    image={image}
                    sizes="(min-width: 768px) 46vw, 92vw"
                    priority={index === 0}
                    fallbackLabel={t("noPicture")}
                  />
                  {index === 0 && (
                    <PackSizeDiscount className="absolute top-3 left-3 rounded-full bg-red-600 px-3 py-1.5 text-sm font-bold text-white tabular-nums" />
                  )}
                </li>
              ),
            )}
          </ul>

          <div className="flex flex-col gap-5">
            <header className="flex flex-col gap-1.5">
              {product.brand && (
                <p className="text-ink-subtle text-xs font-bold tracking-wider uppercase">
                  {product.brand}
                </p>
              )}
              <PackSizeHeadline className="font-display text-ink text-[1.75rem] leading-[1.15] sm:text-[2rem]" />
              {(product.subtitle ?? product.shortDescription) && (
                <p className="text-ink-muted text-[1.0625rem]">
                  {product.subtitle ?? product.shortDescription}
                </p>
              )}
            </header>

            {/* The buy box: everything a decision needs, in one card. */}
            <div
              className={cn(
                panel,
                "shadow-card flex flex-col gap-5 p-5 sm:p-6",
              )}
            >
              <div>
                <PackSizePrice />
                <p className="text-ink-muted mt-1.5 text-sm">
                  <Link
                    href="/delivery-and-payment"
                    className="hover:text-ink rounded-xs underline underline-offset-4"
                  >
                    {tCommon("priceNote")}
                  </Link>
                </p>
              </div>

              <PackSizePicker />

              <ProductPurchase />
            </div>

            {product.highlights.length > 0 && (
              <section aria-labelledby="product-highlights">
                <h2 id="product-highlights" className="sr-only">
                  {t("highlights")}
                </h2>
                <ul className="flex flex-col gap-1.5 text-[0.9375rem]">
                  {product.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-2.5">
                      <Check
                        aria-hidden="true"
                        className="text-leaf-600 mt-1 size-4 shrink-0"
                        strokeWidth={3}
                      />
                      {highlight}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:gap-6">
          <div className={cn(panel, "space-y-6 p-5 sm:p-6")}>
            {product.description && (
              <section aria-labelledby="product-description">
                <h2
                  id="product-description"
                  className="font-display text-ink text-xl"
                >
                  {t("description")}
                </h2>
                <p className="text-ink-muted mt-3 max-w-prose whitespace-pre-line">
                  {product.description}
                </p>
              </section>
            )}
            {product.uses.length > 0 && (
              <section aria-labelledby="product-uses">
                <h2
                  id="product-uses"
                  className="text-ink-subtle text-xs font-bold tracking-wider uppercase"
                >
                  {t("uses")}
                </h2>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {product.uses.map((use) => (
                    <li
                      key={use}
                      className="bg-mist rounded-full px-3 py-1 text-sm font-semibold"
                    >
                      {use}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <section
            aria-labelledby="product-details"
            className={cn(panel, "p-5 sm:p-6")}
          >
            <h2 id="product-details" className="font-display text-ink text-xl">
              {t("details")}
            </h2>
            <dl className="divide-line mt-3 divide-y text-[0.9375rem]">
              {facts.map(
                ([label, value]) =>
                  value && (
                    <div
                      key={label}
                      className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4"
                    >
                      <dt className="font-semibold">{label}</dt>
                      <dd className="text-ink-muted whitespace-pre-line">
                        {value}
                      </dd>
                    </div>
                  ),
              )}
            </dl>
          </section>
        </div>
      </PackSizes>

      {related && (
        <section aria-labelledby="product-related">
          <h2
            id="product-related"
            className="font-display text-ink text-2xl sm:text-3xl"
          >
            {t("related", { category: related.name })}
          </h2>
          <ProductGrid products={related.items} className="mt-5" />
        </section>
      )}

      {/* Room for the add-to-cart bar that is fixed above the tab bar. */}
      <div aria-hidden="true" className="h-12 md:hidden" />
    </div>
  );
}
