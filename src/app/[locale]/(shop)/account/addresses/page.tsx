import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AddressBook } from "@/components/account/address-book";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/account/addresses">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("addressBook");
  return { title: t("metaTitle") };
}

export default async function Page({ params }: Props) {
  await localeOf(params);
  return <AddressBook />;
}
