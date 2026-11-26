import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StockAlertConfirmView } from "@/components/public/stock-alert-links";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/stock-alerts/confirm">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("stockAlertLinks");
  return {
    title: t("confirmMetaTitle"),
    robots: { index: false, follow: false },
    // The address carries the token of the email: it goes to no other site.
    referrer: "no-referrer",
  };
}

/**
 * `/stock-alerts/confirm?token=…`, the page behind the link of the email
 * that asks a visitor to confirm the address for "Notify me" (doc 26). The
 * path is fixed by the email and the same in both languages; the proxy
 * adds the customer's language and keeps the query. Nothing is confirmed
 * while the server renders: the browser does it once the page is there.
 */
export default async function StockAlertConfirmPage({
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
        {t("confirmTitle")}
      </h1>
      <StockAlertConfirmView token={token} />
    </div>
  );
}
