import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CartCount, CartView, UnlessInCart } from "@/components/cart/cart-view";
import { ProductCard } from "@/components/catalogue/product-card";
import { ProductRow, ProductRowItem } from "@/components/home/product-row";
import { getSettings, listProducts } from "@/features/catalogue/data";
import {
  catalogueQuery,
  featuredQuery,
  popularProducts,
} from "@/features/catalogue/home";
import { AreaMessages } from "@/i18n/area-messages";
import { localeOf } from "@/i18n/locale";
import type { Locale } from "@/i18n/routing";
import type { ProductSummary } from "@/lib/api/types";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/cart">): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("cart");
  // The cart belongs to one visitor: nothing for a search engine.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/**
 * "Popular right now", as on the home page and from the same cached
 * answers of the API: what the admin marked as featured, or the first
 * products of the catalogue while nothing is marked. None when the
 * catalogue is away: the cart itself does not depend on it.
 */
async function popular(locale: Locale): Promise<ProductSummary[]> {
  try {
    const featured = (await listProducts(featuredQuery, locale)).items;
    const catalogue =
      featured.length > 0
        ? []
        : (await listProducts(catalogueQuery, locale)).items;
    return popularProducts(featured, catalogue);
  } catch {
    return [];
  }
}

export default async function CartPage({
  params,
}: PageProps<"/[locale]/cart">) {
  const locale = await localeOf(params);
  // The settings the layout reads anyway: whether delivery is priced by the
  // box only sizes the placeholder of the summary; the bill itself says it.
  const [t, tHome, settings, products] = await Promise.all([
    getTranslations("cart"),
    getTranslations("home"),
    getSettings(),
    popular(locale),
  ]);
  return (
    <div className="container-page space-y-5 py-6 sm:py-8">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {t("title")}
        </h1>
        <CartCount />
      </div>
      {/* The texts of the boxes of a bill travel with this page, the
          checkout and the orders only, not with every page of the shop. */}
      <AreaMessages area="cart">
        <CartView boxBased={settings?.shipping?.boxBased ?? false}>
          {/* Under the list, in a frosted panel of its own (the cart
              design of the lab keeps suggestions in this place). */}
          {products.length > 0 && (
            // Without a card left to show (all of them are in the cart),
            // the panel is not shown either.
            <div className="glass animate-rise hidden rounded-2xl p-4 [animation-delay:120ms] has-[li]:block sm:p-[1.375rem]">
              <ProductRow
                id="cart-popular"
                title={tHome("featuredTitle")}
                href="/products"
                link={tHome("seeAll")}
                linkLabel={tHome("featuredAll")}
                labels={{
                  back: tHome("rowBack"),
                  forward: tHome("rowForward"),
                }}
              >
                {products.map((product) => (
                  // What is in the cart already is not suggested again.
                  <UnlessInCart
                    key={product.variantId}
                    variantId={product.variantId}
                  >
                    <ProductRowItem
                      // The column beside the summary is narrower than the
                      // home page: three cards across, four on wide screens.
                      className="lg:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-3rem)/4)]"
                    >
                      <ProductCard
                        product={product}
                        imageSizes="(min-width: 1280px) 190px, (min-width: 640px) 30vw, 44vw"
                      />
                    </ProductRowItem>
                  </UnlessInCart>
                ))}
              </ProductRow>
            </div>
          )}
        </CartView>
      </AreaMessages>
    </div>
  );
}
