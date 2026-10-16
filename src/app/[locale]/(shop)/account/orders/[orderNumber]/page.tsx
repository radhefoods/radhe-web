import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OrderDetailView } from "@/components/account/order-detail";
import { getSettings } from "@/features/catalogue/data";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/account/orders/[orderNumber]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const { orderNumber } = await params;
  const t = await getTranslations("orders");
  return {
    title: t("orderNumber", { orderNumber: orderNumber.toUpperCase() }),
  };
}

export default async function OrderPage({ params, searchParams }: Props) {
  const locale = await localeOf(params);
  const { orderNumber } = await params;
  // Stripe sends the customer back here with `?payment=success|cancelled`;
  // the payment-failed email links here with `?pay=1` (doc 10.4, 10.5).
  const [{ payment, pay }, settings] = await Promise.all([
    searchParams,
    getSettings(),
  ]);
  return (
    <OrderDetailView
      orderNumber={orderNumber}
      paymentReturn={
        payment === "success" || payment === "cancelled" ? payment : null
      }
      payAtOnce={pay === "1"}
      deliveryEstimate={settings?.delivery.estimate[locale] ?? null}
    />
  );
}
