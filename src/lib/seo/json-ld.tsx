import { env } from "@/config/env";
import type { Locale } from "@/i18n/routing";
import type {
  Breadcrumb,
  Ordering,
  ProductDetail,
  ProductSummary,
  ProductVariant,
} from "@/lib/api/types";
import { centsToDecimalString } from "@/lib/format/money";
import { absoluteUrl, pageUrl } from "./alternates";

// Structured data for search engines (schema.org as JSON-LD).

type JsonLdObject = Record<string, unknown>;

/** Renders one JSON-LD block. `<` is escaped so text cannot close the tag. */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

const ORGANIZATION_ID = `${env.siteUrl}/#organization`;

export function organizationJsonLd(description: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "Radhe Foods",
    url: env.siteUrl,
    logo: absoluteUrl("/brand/radhe-logo-480.webp"),
    description,
    areaServed: { "@type": "Country", name: "DE" },
    ...(env.supportEmail && { email: env.supportEmail }),
  };
}

export function websiteJsonLd(locale: Locale): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${env.siteUrl}/#website`,
    name: "Radhe Foods",
    url: pageUrl("/", locale),
    inLanguage: locale,
    publisher: { "@id": ORGANIZATION_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${pageUrl("/products", locale)}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(
  locale: Locale,
  homeName: string,
  categories: Breadcrumb[],
  last?: { name: string; url: string },
): JsonLdObject {
  const items = [
    { name: homeName, url: pageUrl("/", locale) },
    ...categories.map((category) => ({
      name: category.name,
      url: pageUrl(
        { pathname: "/category/[slug]", params: { slug: category.slug } },
        locale,
      ),
    })),
    ...(last ? [last] : []),
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function productUrl(slug: string, locale: Locale): string {
  return pageUrl({ pathname: "/products/[slug]", params: { slug } }, locale);
}

/**
 * The offer of a pack size: in stock when it can be ordered now, out of
 * stock otherwise (switched off, or sold out). From the ordering block
 * (doc 7.1).
 */
function availability(ordering: Ordering | null): string {
  return ordering?.canOrder
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";
}

/** The pack as schema.org knows it: a weight for grams and kilograms. */
function packOf(variant: ProductVariant): JsonLdObject {
  const { value, unit, label } = variant.packSize;
  if (unit === "g" || unit === "kg") {
    return {
      weight: {
        "@type": "QuantitativeValue",
        value,
        unitCode: unit === "g" ? "GRM" : "KGM",
      },
    };
  }
  return { size: label };
}

/**
 * A product with its pack sizes (doc 7) as a `ProductGroup` with one
 * `Product` per size, each with its own address, item number and offer.
 * The group carries what the sizes share. Only the size the page shows
 * comes with its GTIN; the API gives no other.
 */
export function productJsonLd(
  product: ProductDetail,
  locale: Locale,
): JsonLdObject {
  const url = productUrl(product.slug, locale);
  const variants: ProductVariant[] = product.variants.length
    ? product.variants
    : [
        {
          id: product.variantId,
          sku: product.sku,
          slug: product.slug,
          packSize: product.packSize,
          displayName: product.displayName,
          pricing: product.pricing,
          ordering: product.ordering,
          isDefault: true,
          isSelected: true,
        },
      ];
  return {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    "@id": `${url}#product`,
    productGroupID: product.id,
    name: product.name,
    url,
    ...(product.brand && {
      brand: { "@type": "Brand", name: product.brand },
    }),
    ...(product.category && { category: product.category.name }),
    description:
      product.seo.description ??
      product.shortDescription ??
      product.description ??
      product.name,
    image: product.images.map((image) => image.sizes.large.url),
    variesBy: "https://schema.org/size",
    hasVariant: variants.map((variant) => {
      const variantUrl = productUrl(variant.slug, locale);
      return {
        "@type": "Product",
        "@id": `${variantUrl}#size`,
        name: variant.displayName,
        url: variantUrl,
        sku: variant.sku,
        ...(variant.id === product.variantId &&
          product.gtin && { gtin: product.gtin }),
        ...packOf(variant),
        offers: {
          "@type": "Offer",
          url: variantUrl,
          priceCurrency: variant.pricing.currency,
          price: centsToDecimalString(variant.pricing.price),
          availability: availability(variant.ordering),
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@id": ORGANIZATION_ID },
          eligibleRegion: { "@type": "Country", name: "DE" },
        },
      };
    }),
  };
}

export function itemListJsonLd(
  name: string,
  products: ProductSummary[],
  locale: Locale,
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: product.displayName,
      url: productUrl(product.slug, locale),
    })),
  };
}
