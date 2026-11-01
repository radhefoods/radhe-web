import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GuestOrderView } from "@/components/account/guest-order";
import { getSettings } from "@/features/catalogue/data";
import { AreaMessages } from "@/i18n/area-messages";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/guest/orders/[orderNumber]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const { orderNumber } = await params;
  const t = await getTranslations("orders");
  return {
    title: t("orderNumber", { orderNumber: orderNumber.toUpperCase() }),
    // The page belongs to one person and its address carries a key.
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

/**
 * The order of a guest (doc 20): `/guest/orders/<number>?token=<token>`,
 * where the emails about the order and the way back from Stripe lead.
 * Everything is read in the browser with the token; the page stays in the
 * shop's frame, outside the account.
 */
export default async function GuestOrderPage({ params, searchParams }: Props) {
  const locale = await localeOf(params);
  const { orderNumber } = await params;
  const [{ token, payment, pay }, settings] = await Promise.all([
    searchParams,
    getSettings(),
  ]);
  return (
    <div className="container-page py-6 sm:py-8">
      <AreaMessages area="account">
        <GuestOrderView
          orderNumber={orderNumber}
          token={typeof token === "string" ? token : null}
          paymentReturn={
            payment === "success" || payment === "cancelled" ? payment : null
          }
          payAtOnce={pay === "1"}
          deliveryEstimate={settings?.delivery.estimate[locale] ?? null}
        />
      </AreaMessages>
    </div>
  );
}
