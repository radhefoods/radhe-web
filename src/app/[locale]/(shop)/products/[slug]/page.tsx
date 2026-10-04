import { Check } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { PayLaterNote } from "@/components/cargo/pay-later-note";
import { Breadcrumbs } from "@/components/catalogue/breadcrumbs";
import { Price } from "@/components/catalogue/price";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { ProductImage } from "@/components/catalogue/product-image";
import { ProductPurchase } from "@/components/catalogue/product-purchase";
import { LocaleAlternates } from "@/components/shell/locale-switcher";
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
import { formatDiscount } from "@/lib/format/money";
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeOf(params);
  const { slug } = await params;
  const product = await getProduct(slug, locale);
  if (!product) return {};
  const title =
    product.seo.title ?? `${product.name}, ${product.packSize.label}`;
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
 * nothing else (a category of one product in several sizes), from the
 * top-level category above it.
 */
async function relatedProducts(
  product: ProductDetail,
  locale: Locale,
): Promise<{ name: string; items: ProductSummary[] } | null> {
  const ownSizes = new Set(product.packSizes.map((size) => size.id));
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
        .filter((other) => !ownSizes.has(other.id))
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
  // The API answers to the slug of either language; the page has one address.
  if (product.slug !== slug) {
    permanentRedirect({ href: productHref(product.slug), locale });
  }

  const [t, tNav, tCommon, related] = await Promise.all([
    getTranslations("product"),
    getTranslations("nav"),
    getTranslations("common"),
    relatedProducts(product, locale),
  ]);
  const fullName = `${product.name}, ${product.packSize.label}`;

  const facts: [string, string | null][] = [
    [t("ingredients"), product.food.ingredients],
    [t("allergens"), product.food.allergens],
    [t("nutrition"), product.food.nutrition],
    [t("storage"), product.food.storageInstructions],
    [t("origin"), product.food.origin],
    [t("manufacturer"), product.food.manufacturer ?? product.brand],
    [t("sku"), product.sku],
  ];

  return (
    <div className="container-page space-y-8 py-6 sm:py-8">
      <LocaleAlternates hrefs={hrefsOf(product.slugs)} />
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

      <div className="grid gap-8 md:grid-cols-2 lg:gap-14">
        {/* Pictures: swipe on phones; the first one is the page's main picture. */}
        <ul className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto md:sticky md:top-36 md:self-start">
          {(product.images.length ? product.images : [null]).map(
            (image, index) => (
              <li
                key={image?.id ?? "none"}
                className="bg-mist relative aspect-square w-full shrink-0 snap-center overflow-hidden rounded-xl"
              >
                <ProductImage
                  image={image}
                  sizes="(min-width: 768px) 46vw, 92vw"
                  priority={index === 0}
                  fallbackLabel={t("noPicture")}
                />
                {index === 0 && product.pricing.onSale && (
                  <span className="bg-chili absolute top-3 left-3 rounded-xs px-2.5 py-1 text-sm font-bold text-white tabular-nums">
                    {formatDiscount(product.pricing.discountPercent, locale)}
                  </span>
                )}
              </li>
            ),
          )}
        </ul>

        <div className="flex flex-col gap-5">
          <header className="flex flex-col gap-1.5">
            {product.brand && (
              <p className="text-ink-muted text-xs font-bold tracking-wider uppercase">
                {product.brand}
              </p>
            )}
            <h1 className="font-display text-4xl leading-[1.05] text-blue-900 sm:text-5xl">
              {product.name}
            </h1>
            {(product.subtitle ?? product.shortDescription) && (
              <p className="text-ink-muted text-lg">
                {product.subtitle ?? product.shortDescription}
              </p>
            )}
          </header>

          {/* Every pack size is a product of its own, with its own page. */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold">{t("packSize")}</p>
            <ul className="flex flex-wrap gap-2">
              {product.packSizes.map((size) => (
                <li key={size.id}>
                  <Link
                    href={productHref(size.slug)}
                    aria-current={size.isSelected ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center rounded-sm border-[1.5px] px-4 font-semibold",
                      size.isSelected
                        ? "border-blue-600 bg-blue-50 text-blue-800"
                        : "border-line-strong hover:border-ink-subtle",
                    )}
                  >
                    {size.packSize.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <Price pricing={product.pricing} size="lg" />
            <p className="text-ink-muted mt-1 text-sm">
              <Link
                href="/delivery-and-payment"
                className="hover:text-ink rounded-xs underline underline-offset-4"
              >
                {tCommon("priceNote")}
              </Link>
            </p>
          </div>

          <ProductPurchase
            productId={product.id}
            slug={product.slug}
            name={fullName}
            pricing={product.pricing}
            ordering={product.ordering}
          />

          <PayLaterNote />

          {product.highlights.length > 0 && (
            <section aria-labelledby="product-highlights">
              <h2 id="product-highlights" className="sr-only">
                {t("highlights")}
              </h2>
              <ul className="flex flex-col gap-1.5">
                {product.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2.5">
                    <Check
                      aria-hidden="true"
                      className="mt-1 size-4 shrink-0 text-teal-600"
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

      <div className="border-line grid gap-8 border-t pt-8 md:grid-cols-2 lg:gap-14">
        <div className="space-y-6">
          {product.description && (
            <section aria-labelledby="product-description">
              <h2
                id="product-description"
                className="font-display text-3xl text-blue-900"
              >
                {t("description")}
              </h2>
              <p className="mt-3 max-w-prose whitespace-pre-line">
                {product.description}
              </p>
            </section>
          )}
          {product.uses.length > 0 && (
            <section aria-labelledby="product-uses">
              <h2 id="product-uses" className="text-sm font-bold">
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
        <section aria-labelledby="product-details">
          <h2
            id="product-details"
            className="font-display text-3xl text-blue-900"
          >
            {t("details")}
          </h2>
          <dl className="divide-line border-line mt-3 divide-y border-y text-[0.9375rem]">
            {facts.map(
              ([label, value]) =>
                value && (
                  <div
                    key={label}
                    className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4"
                  >
                    <dt className="font-bold">{label}</dt>
                    <dd className="text-ink-muted whitespace-pre-line">
                      {value}
                    </dd>
                  </div>
                ),
            )}
          </dl>
        </section>
      </div>

      {related && (
        <section
          aria-labelledby="product-related"
          className="border-line border-t pt-8"
        >
          <h2
            id="product-related"
            className="font-display text-3xl text-blue-900 sm:text-4xl"
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
