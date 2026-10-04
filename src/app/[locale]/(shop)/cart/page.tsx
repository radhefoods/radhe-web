import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CartView } from "@/components/cart/cart-view";
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
  const t = await getTranslations("cart");
  return (
    <div className="container-page space-y-6 py-8 sm:py-10">
      <h1 className="font-display text-4xl text-blue-900 sm:text-5xl">
        {t("title")}
      </h1>
      <CartView />
    </div>
  );
}
