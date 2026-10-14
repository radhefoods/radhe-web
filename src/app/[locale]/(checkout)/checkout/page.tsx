import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/checkout">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("checkout");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function CheckoutPage({ params }: Props) {
  await localeOf(params);
  const t = await getTranslations("checkout");
  return (
    <div className="container-page space-y-5 py-6 sm:py-8">
      <h1 className="font-display text-ink text-3xl sm:text-4xl">
        {t("title")}
      </h1>
      <CheckoutView />
    </div>
  );
}
