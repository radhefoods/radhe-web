import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccountOverview } from "@/components/account/overview";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/account">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("account");
  return { title: t("metaTitle") };
}

export default async function Page({ params }: Props) {
  await localeOf(params);
  return <AccountOverview />;
}
