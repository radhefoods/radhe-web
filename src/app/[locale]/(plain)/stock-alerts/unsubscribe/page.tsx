import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StockAlertUnsubscribeView } from "@/components/public/stock-alert-links";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/stock-alerts/unsubscribe">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("stockAlertLinks");
  return {
    title: t("unsubscribeMetaTitle"),
    robots: { index: false, follow: false },
    // The address carries the token of the email: it goes to no other site.
    referrer: "no-referrer",
  };
}

/**
 * `/stock-alerts/unsubscribe?token=…`, the page behind the unsubscribe
 * link of the email that says a pack size is back (doc 26). The path is
 * fixed by the email and the same in both languages. Opening the page
 * changes nothing: the request is taken back by its button.
 */
export default async function StockAlertUnsubscribePage({
  params,
  searchParams,
}: Props) {
  await localeOf(params);
  const t = await getTranslations("stockAlertLinks");
  const raw = (await searchParams).token;
  const token = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  return (
    <div className="container-page max-w-xl space-y-6 py-10 sm:py-14">
      <h1 className="font-display text-ink text-3xl sm:text-4xl">
        {t("unsubscribeTitle")}
      </h1>
      <StockAlertUnsubscribeView token={token} />
    </div>
  );
}
