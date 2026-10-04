import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OrderDetailView } from "@/components/account/order-detail";
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
  await localeOf(params);
  const { orderNumber } = await params;
  // Stripe sends the customer back here with `?payment=success|cancelled`.
  const { payment } = await searchParams;
  return (
    <OrderDetailView
      orderNumber={orderNumber}
      paymentReturn={
        payment === "success" || payment === "cancelled" ? payment : null
      }
    />
  );
}
