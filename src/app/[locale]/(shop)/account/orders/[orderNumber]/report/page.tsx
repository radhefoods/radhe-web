import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReportProblemView } from "@/components/account/report-problem-view";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/account/orders/[orderNumber]/report">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("issues");
  return { title: t("reportMetaTitle") };
}

export default async function ReportPage({ params }: Props) {
  await localeOf(params);
  const { orderNumber } = await params;
  return <ReportProblemView orderNumber={orderNumber} />;
}
