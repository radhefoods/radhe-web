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
    <div className="container-page space-y-6 py-8 sm:py-10">
      <h1 className="font-display text-4xl text-blue-900 sm:text-5xl">
        {t("title")}
      </h1>
      <CheckoutView />
    </div>
  );
}
