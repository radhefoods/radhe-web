import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UnsubscribeView } from "@/components/public/unsubscribe-view";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/unsubscribe/[token]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("unsubscribe");
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function UnsubscribePage({ params }: Props) {
  await localeOf(params);
  const { token } = await params;
  const t = await getTranslations("unsubscribe");
  return (
    <div className="container-page max-w-xl space-y-6 py-10 sm:py-14">
      <h1 className="font-display text-4xl text-blue-900 sm:text-5xl">
        {t("title")}
      </h1>
      <UnsubscribeView token={token} />
    </div>
  );
}
