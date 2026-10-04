import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileView } from "@/components/account/profile-view";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/account/profile">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("profile");
  return { title: t("metaTitle") };
}

export default async function Page({ params }: Props) {
  await localeOf(params);
  return <ProfileView />;
}
