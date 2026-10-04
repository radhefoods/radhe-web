import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OrderList } from "@/components/account/order-list";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/account/orders">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("orders");
  return { title: t("metaTitle") };
}

export default async function Page({ params }: Props) {
  await localeOf(params);
  return <OrderList />;
}
