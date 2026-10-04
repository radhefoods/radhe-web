import { env } from "@/config/env";
import type { Locale } from "@/i18n/routing";
import type {
  Breadcrumb,
  ProductDetail,
  ProductSummary,
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
 * The offer of a product. A pre-order shop: what can be ordered now is
 * `PreOrder`, what is sold out for this delivery is `SoldOut`, everything
 * else is out of stock for the moment.
 */
function availability(product: ProductSummary): string {
  if (product.ordering?.canOrder) return "https://schema.org/PreOrder";
  if (product.ordering?.reason === "sold_out") {
    return "https://schema.org/SoldOut";
  }
  return "https://schema.org/OutOfStock";
}

export function productJsonLd(
  product: ProductDetail,
  locale: Locale,
): JsonLdObject {
  const url = productUrl(product.slug, locale);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: `${product.name}, ${product.packSize.label}`,
    url,
    sku: product.sku,
    ...(product.gtin && { gtin: product.gtin }),
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
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: product.pricing.currency,
      price: centsToDecimalString(product.pricing.price),
      availability: availability(product),
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": ORGANIZATION_ID },
      eligibleRegion: { "@type": "Country", name: "DE" },
    },
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
      name: product.name,
      url: productUrl(product.slug, locale),
    })),
  };
}
