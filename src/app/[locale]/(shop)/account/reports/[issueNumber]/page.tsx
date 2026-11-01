import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { IssueView } from "@/components/account/issue-view";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/account/reports/[issueNumber]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const { issueNumber } = await params;
  const t = await getTranslations("issues");
  return { title: t("number", { issueNumber: issueNumber.toUpperCase() }) };
}

export default async function IssuePage({ params }: Props) {
  await localeOf(params);
  const { issueNumber } = await params;
  // The view reads `?photos=failed` of the address, which only the browser knows.
  return (
    <Suspense fallback={null}>
      <IssueView issueNumber={issueNumber} />
    </Suspense>
  );
}
