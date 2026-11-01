import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { IssuesList } from "@/components/account/issues-list";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/account/reports">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("issues");
  return { title: t("metaTitle") };
}

export default async function Page({ params }: Props) {
  await localeOf(params);
  return <IssuesList />;
}
