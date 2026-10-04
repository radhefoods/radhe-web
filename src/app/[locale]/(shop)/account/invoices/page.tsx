import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InvoiceList } from "@/components/account/invoice-list";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/account/invoices">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("documents");
  return { title: t("metaTitle") };
}

export default async function Page({ params }: Props) {
  await localeOf(params);
  return <InvoiceList />;
}
