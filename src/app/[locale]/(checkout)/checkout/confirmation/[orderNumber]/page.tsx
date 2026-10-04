import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConfirmationView } from "@/components/checkout/confirmation-view";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/checkout/confirmation/[orderNumber]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("checkout.confirmation");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function ConfirmationPage({ params }: Props) {
  await localeOf(params);
  const { orderNumber } = await params;
  return (
    <div className="container-page max-w-5xl py-8 sm:py-12">
      <ConfirmationView orderNumber={orderNumber} />
    </div>
  );
}
