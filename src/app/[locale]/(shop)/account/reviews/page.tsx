import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ReviewsView } from "@/components/account/reviews-view";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/account/reviews">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("reviews");
  return { title: t("metaTitle") };
}

export default async function Page({ params }: Props) {
  await localeOf(params);
  // The view reads `?product=` of the address, which only the browser knows.
  return (
    <Suspense fallback={null}>
      <ReviewsView />
    </Suspense>
  );
}
