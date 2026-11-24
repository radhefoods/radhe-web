import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { getSettings } from "@/features/catalogue/data";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/checkout">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("checkout");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function CheckoutPage({ params }: Props) {
  const locale = await localeOf(params);
  const [t, settings] = await Promise.all([
    getTranslations("checkout"),
    getSettings(),
  ]);
  return (
    // As wide as the pill of the header above it. The page's title is for
    // screen readers and the tab: the header says where the customer is.
    <div className="mx-auto w-full max-w-[72.5rem] px-3 pt-5 sm:px-6 sm:pt-6">
      <h1 className="sr-only">{t("title")}</h1>
      <CheckoutView
        deliveryEstimate={settings?.delivery.estimate[locale] ?? null}
        boxBased={settings?.shipping?.boxBased ?? false}
      />
    </div>
  );
}
