import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RewardsView } from "@/components/account/rewards-view";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/account/coins">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("rewards");
  return { title: t("metaTitle") };
}

export default async function Page({ params }: Props) {
  await localeOf(params);
  return <RewardsView />;
}
