import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CartView } from "@/components/cart/cart-view";
import { getSettings } from "@/features/catalogue/data";
import { AreaMessages } from "@/i18n/area-messages";
import { localeOf } from "@/i18n/locale";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/cart">): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("cart");
  // The cart belongs to one visitor: nothing for a search engine.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function CartPage({
  params,
}: PageProps<"/[locale]/cart">) {
  await localeOf(params);
  // The settings the layout reads anyway: whether delivery is priced by the
  // box only sizes the placeholder of the summary; the bill itself says it.
  const [t, settings] = await Promise.all([
    getTranslations("cart"),
    getSettings(),
  ]);
  return (
    <div className="container-page space-y-5 py-6 sm:py-8">
      <h1 className="font-display text-ink text-3xl sm:text-4xl">
        {t("title")}
      </h1>
      {/* The texts of the boxes of a bill travel with this page, the
          checkout and the orders only, not with every page of the shop. */}
      <AreaMessages area="cart">
        <CartView boxBased={settings?.shipping?.boxBased ?? false} />
      </AreaMessages>
    </div>
  );
}
