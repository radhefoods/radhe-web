import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PayLinkView } from "@/components/public/pay-link-view";
import { Alert } from "@/components/ui/alert";
import { buttonStyles } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { localeOf } from "@/i18n/locale";
import type { Locale } from "@/i18n/routing";
import { hasErrorCode } from "@/lib/api/errors";
import { serverApi } from "@/lib/api/server";
import type { PayLink } from "@/lib/api/types";

type Props = PageProps<"/[locale]/pay/[token]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("payLink");
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
    // The token in the address must not travel on to other sites.
    referrer: "no-referrer",
  };
}

/** What the link pays, asked for afresh each time; `null` for a link that is not valid. */
async function loadPayLink(
  token: string,
  locale: Locale,
): Promise<PayLink | null> {
  try {
    return await serverApi.getPayLink(token, { locale, cache: "no-store" });
  } catch (error) {
    if (
      hasErrorCode(error, "PAY_LINK_INVALID") ||
      hasErrorCode(error, "NOT_FOUND")
    ) {
      return null;
    }
    throw error;
  }
}

export default async function PayPage({ params }: Props) {
  const locale = await localeOf(params);
  const { token } = await params;
  const t = await getTranslations("payLink");
  const payLink = await loadPayLink(token, locale);

  // The page speaks the language of the order, whatever the browser prefers.
  if (payLink && payLink.language !== locale) {
    redirect({
      href: { pathname: "/pay/[token]", params: { token } },
      locale: payLink.language,
    });
  }

  return (
    <div className="container-page max-w-xl space-y-6 py-10 sm:py-14">
      <h1 className="font-display text-4xl text-blue-900 sm:text-5xl">
        {payLink ? t("title") : t("invalidTitle")}
      </h1>
      {payLink ? (
        <PayLinkView token={token} payLink={payLink} />
      ) : (
        <>
          <Alert tone="warn">{t("invalidText")}</Alert>
          <Link href="/account/orders" className={buttonStyles()}>
            {t("toOrders")}
          </Link>
        </>
      )}
    </div>
  );
}
