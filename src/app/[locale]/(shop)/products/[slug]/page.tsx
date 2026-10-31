import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/catalogue/breadcrumbs";
import { CategoryTiles } from "@/components/catalogue/category-tiles";
import { ProductCard } from "@/components/catalogue/product-card";
import { ProductGallery } from "@/components/catalogue/product-gallery";
import {
  PackSizeDiscount,
  PackSizeHeadline,
  PackSizePicker,
  PackSizePrice,
  PackSizeSku,
  PackSizeWishlist,
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
import {
  catalogueQuery,
  featuredQuery,
  popularProducts,
} from "@/features/catalogue/home";
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

/** A small glass chip above the headline: the category, the brand. */
const chip =
  "glass-soft inline-flex min-h-8 items-center rounded-full px-3 text-[0.8125rem] font-semibold";

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
 * "Popular right now", as on the home page: the products the admin marked
 * featured, or, while none is, the first of the catalogue; without the
 * product of this page. Empty when the catalogue does not answer: the page
 * stands without the row.
 */
async function popular(
  product: ProductDetail,
  locale: Locale,
): Promise<ProductSummary[]> {
  try {
    const featured = (await listProducts(featuredQuery, locale)).items;
    const catalogue =
      featured.length > 0
        ? []
        : (await listProducts(catalogueQuery, locale)).items;
    return popularProducts(featured, catalogue).filter(
      (other) => other.id !== product.id,
    );
  } catch {
    return [];
  }
}

/**
 * The product page (redesigned 2026-10-19, set after the look of the
 * leading grocers on 2026-10-21 and 22, and laid out after the owner's
 * reference picture on 2026-10-31): the pictures on the left as a large
 * white tile with the heart of the wishlist in its corner and the
 * thumbnails under it, kept in view while the right column scrolls; on
 * the right, read top to bottom, a row of chips (the category, the brand,
 * the discount of the chosen size), the name with the chosen size, large,
 * the subtitle; the price with the regular price, the price per unit and
 * "Tax included." (owner, 2026-10-28); the pack sizes as one segmented
 * bar; the add-to-cart button, full width, with the stock and the
 * delivery estimate under it; then delivery and payment as three small
 * tiles. Under both columns the two texts of the product as glass cards
 * that fold open, closed at first (owner, 2026-10-22; the highlights are
 * not shown any more, owner, 2026-10-28). Under all that the products of
 * the same category as a row, the popular products as a second row and
 * the categories of the shop as tiles, each row with a large heading and
 * a pill that leads to the full list.
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

  const [t, tNav, tCommon, tHome, related, popularItems, settings, categories] =
    await Promise.all([
      getTranslations("product"),
      getTranslations("nav"),
      getTranslations("common"),
      getTranslations("home"),
      relatedProducts(product, locale),
      popular(product, locale),
      getSettings(),
      getCategories(locale),
    ]);
  const brand = brandOf(product.brand);
  const category = product.breadcrumbs.at(-1) ?? null;
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
          className="mt-5 grid gap-8 md:grid-cols-2 md:gap-8 lg:grid-cols-[minmax(0,11fr)_minmax(0,10fr)] lg:gap-12"
        >
          <ProductGallery
            images={product.images}
            fallbackLabel={t("noPicture")}
            corner={<PackSizeWishlist className="size-11 sm:size-12" />}
            className="md:sticky md:top-40 md:self-start"
          />

          {/* The column of the decision: the chips, the name, the price,
              the sizes, the button, then the trust tiles. */}
          <div className="flex flex-col">
            <header className="flex flex-col gap-3">
              <ul className="flex flex-wrap items-center gap-2">
                {category && (
                  <li>
                    <Link
                      href={{
                        pathname: "/category/[slug]",
                        params: { slug: category.slug },
                      }}
                      className={cn(
                        chip,
                        "text-ink hover:text-leaf-700 transition-colors duration-200 hover:bg-white/85",
                      )}
                    >
                      {category.name}
                    </Link>
                  </li>
                )}
                {brand && (
                  <li
                    className={cn(
                      chip,
                      "text-leaf-700 text-xs tracking-[0.1em] uppercase",
                    )}
                  >
                    {brand}
                  </li>
                )}
                <PackSizeDiscount
                  as="li"
                  className="inline-flex min-h-8 items-center rounded-full bg-red-50 px-3 text-[0.8125rem] font-bold text-red-700 tabular-nums ring-1 ring-red-600/15"
                />
              </ul>
              <PackSizeHeadline className="font-display text-ink text-[2.25rem] leading-[1.02] sm:text-[2.75rem] lg:text-[3.25rem]" />
              {(product.subtitle ?? product.shortDescription) && (
                <p className="text-ink-muted max-w-prose text-[1.0625rem] leading-relaxed">
                  {product.subtitle ?? product.shortDescription}
                </p>
              )}
            </header>

            <PackSizePrice
              className="mt-6"
              note={
                <Link
                  href="/delivery-and-payment"
                  className="hover:text-ink rounded-xs underline underline-offset-4"
                >
                  {tCommon("priceNote")}
                </Link>
              }
            />

            <PackSizePicker className="mt-7" />

            <ProductPurchase
              deliveryEstimate={settings?.delivery.estimate[locale] ?? null}
              className="mt-7"
            />

            <PurchaseInfo
              settings={settings}
              locale={locale}
              className="mt-7"
            />
          </div>
        </div>

        {/* The texts of the product as glass cards that fold open, both
            closed when the page opens (owner, 2026-10-22), in a row under
            the picture and the column. */}
        <div className="mt-10 grid items-start gap-4 md:grid-cols-2 lg:mt-12">
          {hasAbout && (
            <Disclosure id="product-about" title={t("description")}>
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
                        className="glass-soft rounded-full px-3 py-1 text-sm font-semibold"
                      >
                        {use}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Disclosure>
          )}
          <Disclosure id="product-details" title={t("details")}>
            <dl className="divide-ink/8 divide-y text-[0.9375rem]">
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
      </PackSizes>

      {related && (
        <div className="mt-14 lg:mt-20">
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
            heading="lg"
            linkLook="pill"
          >
            {related.items.map((item) => (
              <ProductRowItem key={item.variantId}>
                <ProductCard product={item} imageSizes={cardSizes} />
              </ProductRowItem>
            ))}
          </ProductRow>
        </div>
      )}

      {popularItems.length > 0 && (
        <div className="mt-14 lg:mt-20">
          <ProductRow
            id="product-popular"
            title={tHome("featuredTitle")}
            href="/products"
            link={tCommon("viewAll")}
            linkLabel={tHome("featuredAll")}
            labels={rowLabels}
            heading="lg"
            linkLook="pill"
          >
            {popularItems.map((item) => (
              <ProductRowItem key={item.variantId}>
                <ProductCard product={item} imageSizes={cardSizes} />
              </ProductRowItem>
            ))}
          </ProductRow>
        </div>
      )}

      {shopCategories.length > 0 && (
        <div className="mt-14 lg:mt-20">
          <CategoryTiles
            id="product-categories"
            title={t("categoriesTitle")}
            categories={shopCategories}
            link={tNav("allProducts")}
            linkLabel={tHome("featuredAll")}
            labels={rowLabels}
            heading="lg"
            linkLook="pill"
          />
        </div>
      )}

      {/* Room for the add-to-cart bar that is fixed above the tab bar. */}
      <div aria-hidden="true" className="h-12 md:hidden" />
    </div>
  );
}
