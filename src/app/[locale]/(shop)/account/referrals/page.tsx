import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReferralView } from "@/components/account/referral-view";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/account/referrals">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("referral");
  return { title: t("metaTitle") };
}

export default async function Page({ params }: Props) {
  await localeOf(params);
  return <ReferralView />;
}
