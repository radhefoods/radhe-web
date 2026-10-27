import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/catalogue/breadcrumbs";
import { CategoryTiles } from "@/components/catalogue/category-tiles";
import { ProductCard } from "@/components/catalogue/product-card";
import { ProductGallery } from "@/components/catalogue/product-gallery";
import {
  PackSizeHeadline,
  PackSizePicker,
  PackSizePrice,
  PackSizeSku,
  PackSizes,
  ProductPurchase,
} from "@/components/catalogue/product-purchase";
import { PurchaseInfo } from "@/components/catalogue/purchase-info";
import { ProductRow, ProductRowItem } from "@/components/home/product-row";
import { Disclosure } from "@/components/ui/disclosure";
import {
  getCategories,
  getProduct,
  getSettings,
  listProducts,
} from "@/features/catalogue/data";
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
import {
  brandOf,
  formatProductName,
  productTitle,
} from "@/lib/format/product-name";

type Props = PageProps<"/[locale]/products/[slug]">;

export const revalidate = 300;

// No product page is built ahead of time; each one is rendered at its first
// visit and then served from the cache, refreshed every five minutes.
export function generateStaticParams() {
  return [];
}

/** How many related products the row under the product holds at most. */
const RELATED_SIZE = 12;

const productHref = (slug: string) => ({
  pathname: "/products/[slug]" as const,
  params: { slug },
});

const hrefsOf = (slugs: LocalizedSlugs) => ({
  en: productHref(slugs.en),
  de: productHref(slugs.de),
});

/** A card of a row: two and a sliver on phones, then three, four, five. */
const cardSizes =
  "(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 44vw";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeOf(params);
  const { slug } = await params;
  const product = await getProduct(slug, locale);
  if (!product) return {};
  // The title names the pack size the address stands for.
  const title =
    product.seo.title ?? productTitle(product.name, product.packSize);
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
 * nothing else, from the top-level category above it. Up to `RELATED_SIZE`
 * for the row; the category itself is the way to all of them. One card per
 * product with the size chooser (`view=product`), whatever the category's
 * own listing view (doc PRODUCT_DISPLAY_ORDER, section 8).
 */
async function relatedProducts(
  product: ProductDetail,
  locale: Locale,
): Promise<{ name: string; slug: string; items: ProductSummary[] } | null> {
  const candidates = [product.breadcrumbs.at(-1), product.breadcrumbs[0]];
  const tried = new Set<string>();
  for (const category of candidates) {
    if (!category || tried.has(category.slug)) continue;
    tried.add(category.slug);
    try {
      const page = await listProducts(
        { category: category.slug, view: "product", limit: RELATED_SIZE + 1 },
        locale,
      );
      const items = page.items
        .filter((other) => other.id !== product.id)
        .slice(0, RELATED_SIZE);
      if (items.length > 0) {
        return { name: category.name, slug: category.slug, items };
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * The product page (redesigned 2026-10-19, set after the look of the
 * leading grocers on 2026-10-21 and again on 2026-10-22): the pictures on
 * the left, kept in view while the right column scrolls; on the right one
 * column without panels, read top to bottom: the brand, the name with the
 * chosen size and the subtitle; the price with the regular price, the
 * price per unit and "Tax included." (owner, 2026-10-28; the delivery fee
 * stands in the delivery row below); the pack sizes as tiles with their
 * prices; add to cart with the heart, the stock and the delivery estimate
 * under it; then, between hairlines, delivery and payment as two rows and
 * the two texts of the product as rows that fold open, closed at first
 * (the highlights are not shown any more, owner, 2026-10-28). Under all
 * that the products of the same category as a row and the categories of
 * the shop as tiles.
 */
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

  const [t, tNav, tCommon, tHome, related, settings, categories] =
    await Promise.all([
      getTranslations("product"),
      getTranslations("nav"),
      getTranslations("common"),
      getTranslations("home"),
      relatedProducts(product, locale),
      getSettings(),
      getCategories(locale),
    ]);
  const brand = brandOf(product.brand);
  const shopCategories = categories.filter(
    (category) => category.productCount > 0,
  );
  const rowLabels = { back: tHome("rowBack"), forward: tHome("rowForward") };

  // The item number belongs to the chosen size and follows it.
  const facts: [string, ReactNode][] = [
    [t("ingredients"), product.food.ingredients],
    [t("allergens"), product.food.allergens],
    [t("nutrition"), product.food.nutrition],
    [t("storage"), product.food.storageInstructions],
    [t("origin"), product.food.origin],
    [t("manufacturer"), brandOf(product.food.manufacturer) ?? brand],
    [t("sku"), <PackSizeSku key="sku" />],
  ];
  const hasAbout = Boolean(product.description) || product.uses.length > 0;

  return (
    <div className="container-page py-5 sm:py-6">
      <JsonLd
        data={[
          productJsonLd(product, locale),
          breadcrumbJsonLd(locale, tNav("home"), product.breadcrumbs, {
            name: product.name,
            url: pageUrl(productHref(product.slug), locale),
          }),
        ]}
      />
      <Breadcrumbs
        categories={product.breadcrumbs}
        current={formatProductName(product.name)}
      />

      <PackSizes product={product}>
        <div
          data-fly-scope=""
          className="mt-5 grid gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-[minmax(0,11fr)_minmax(0,10fr)] lg:gap-12"
        >
          <ProductGallery
            images={product.images}
            fallbackLabel={t("noPicture")}
            className="md:sticky md:top-36 md:self-start"
          />

          {/* The column of the decision, as the leading grocers set it:
              the name, the price, the sizes, the button, then the trust
              lines and the texts, every block parted from the next by one
              hairline and nothing boxed (owner, 2026-10-21 and 22). */}
          <div className="flex flex-col">
            <header className="flex flex-col gap-2">
              {brand && (
                <p className="text-leaf-700 text-xs font-bold tracking-[0.14em] uppercase">
                  {brand}
                </p>
              )}
              <PackSizeHeadline className="font-display text-ink text-[1.625rem] leading-[1.12] sm:text-[2rem]" />
              {(product.subtitle ?? product.shortDescription) && (
                <p className="text-ink-muted">
                  {product.subtitle ?? product.shortDescription}
                </p>
              )}
            </header>

            <PackSizePrice
              className="mt-5"
              note={
                <Link
                  href="/delivery-and-payment"
                  className="hover:text-ink rounded-xs underline underline-offset-4"
                >
                  {tCommon("priceNote")}
                </Link>
              }
            />

            <PackSizePicker className="mt-6" />

            <ProductPurchase
              deliveryEstimate={settings?.delivery.estimate[locale] ?? null}
              className="mt-6"
            />

            <PurchaseInfo
              settings={settings}
              locale={locale}
              className="mt-7"
            />

            {/* The texts of the product as flat rows that fold open, both
                closed when the page opens (owner, 2026-10-22). */}
            <div className="mt-5">
              {hasAbout && (
                <Disclosure
                  id="product-about"
                  title={t("description")}
                  look="row"
                >
                  {product.description && (
                    <p className="text-ink-muted max-w-prose whitespace-pre-line">
                      {product.description}
                    </p>
                  )}
                  {product.uses.length > 0 && (
                    <div className={cn(product.description && "mt-4")}>
                      <h3 className="text-ink-subtle text-xs font-bold tracking-[0.1em] uppercase">
                        {t("uses")}
                      </h3>
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
                    </div>
                  )}
                </Disclosure>
              )}
              <Disclosure id="product-details" title={t("details")} look="row">
                <dl className="divide-line divide-y text-[0.9375rem]">
                  {facts.map(
                    ([label, value]) =>
                      value && (
                        <div
                          key={label}
                          className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[9rem_1fr] sm:gap-4"
                        >
                          <dt className="font-semibold">{label}</dt>
                          <dd className="text-ink-muted whitespace-pre-line">
                            {value}
                          </dd>
                        </div>
                      ),
                  )}
                </dl>
              </Disclosure>
            </div>
          </div>
        </div>
      </PackSizes>

      {related && (
        <div className="mt-12 lg:mt-16">
          <ProductRow
            id="product-related"
            title={t("related", { category: related.name })}
            href={{
              pathname: "/category/[slug]",
              params: { slug: related.slug },
            }}
            link={tCommon("viewAll")}
            linkLabel={t("relatedAll", { category: related.name })}
            labels={rowLabels}
          >
            {related.items.map((item) => (
              <ProductRowItem key={item.variantId}>
                <ProductCard product={item} imageSizes={cardSizes} />
              </ProductRowItem>
            ))}
          </ProductRow>
        </div>
      )}

      {shopCategories.length > 0 && (
        <div className="mt-12 lg:mt-16">
          <CategoryTiles
            id="product-categories"
            title={t("categoriesTitle")}
            categories={shopCategories}
            link={tNav("allProducts")}
            linkLabel={tHome("featuredAll")}
            labels={rowLabels}
          />
        </div>
      )}

      {/* Room for the add-to-cart bar that is fixed above the tab bar. */}
      <div aria-hidden="true" className="h-12 md:hidden" />
    </div>
  );
}
