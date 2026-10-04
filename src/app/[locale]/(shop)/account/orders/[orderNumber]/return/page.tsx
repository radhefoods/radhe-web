import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReturnRequestView } from "@/components/account/return-request";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/account/orders/[orderNumber]/return">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("returns");
  return { title: t("metaTitle") };
}

export default async function ReturnPage({ params }: Props) {
  await localeOf(params);
  const { orderNumber } = await params;
  return <ReturnRequestView orderNumber={orderNumber} />;
}
