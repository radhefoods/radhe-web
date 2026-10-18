import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WishlistView } from "@/components/wishlist/wishlist-view";
import { AreaMessages } from "@/i18n/area-messages";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/wishlist">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("wishlist");
  // The list belongs to one visitor: nothing for a search engine.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/**
 * The wishlist (doc 16), for visitors and customers alike: a visitor's list
 * is read from the browser and rendered by the API, a customer's comes from
 * the account. Everything is read in the browser.
 */
export default async function WishlistPage({ params }: Props) {
  await localeOf(params);
  const t = await getTranslations("wishlist");
  return (
    <div className="container-page space-y-5 py-6 sm:py-8">
      <h1 className="font-display text-ink text-3xl sm:text-4xl">
        {t("title")}
      </h1>
      <AreaMessages area="wishlist">
        <WishlistView />
      </AreaMessages>
    </div>
  );
}
