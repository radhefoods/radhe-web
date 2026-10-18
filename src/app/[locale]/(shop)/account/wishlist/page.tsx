import { Heart } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/account/wishlist">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("account");
  return { title: t("wishlistTitle") };
}

/**
 * Where saved products will live. The heart in the header leads here for
 * signed-in customers (owner, 2026-10-19); the API has no wishlist yet
 * ("I will provide the APIs and functionality later"), so until it does
 * the page says so and leads to the range.
 */
export default async function WishlistPage({ params }: Props) {
  await localeOf(params);
  const t = await getTranslations("account");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-ink text-3xl sm:text-4xl">
        {t("wishlistTitle")}
      </h1>
      <div className="bg-mist flex flex-col items-center gap-4 rounded-xl px-6 py-16 text-center">
        <Heart aria-hidden="true" className="text-ink-subtle size-10" />
        <h2 className="font-display text-ink text-xl">
          {t("wishlistEmptyTitle")}
        </h2>
        <p className="text-ink-muted max-w-md">{t("wishlistEmptyText")}</p>
        <Link href="/products" className={buttonStyles()}>
          {t("noOrdersCta")}
        </Link>
      </div>
    </div>
  );
}
