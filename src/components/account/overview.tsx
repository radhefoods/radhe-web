"use client";

import { useLocale, useTranslations } from "next-intl";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/session/session";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/format/money";
import { OrderCard } from "./order-bits";
import { NoOrders, useOrders } from "./order-list";
import { SignOutButton } from "./sign-out";

/**
 * The first page of the account: what is to pay (first, because it is the
 * one thing the customer has to do), then the latest orders.
 */
export function AccountOverview() {
  const t = useTranslations("account");
  const locale = useLocale() as Locale;
  const { customer } = useSession({ force: true });
  const query = useOrders();
  const orders = query.data?.pages[0]?.items ?? [];
  const toPay = orders.filter(
    (order) =>
      order.paymentStatus === "due" || order.paymentStatus === "overdue",
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-blue-900 sm:text-5xl">
            {customer?.firstName
              ? t("greeting", { name: customer.firstName })
              : t("greetingPlain")}
          </h1>
          {customer && (
            <p className="text-ink-muted">
              {t("signedInAs", { email: customer.email })}
            </p>
          )}
        </div>
        <SignOutButton />
      </header>

      {toPay.length > 0 && (
        <section
          aria-labelledby="account-to-pay"
          className="border-gold-200 bg-gold-100 rounded-xl border p-5"
        >
          <h2 id="account-to-pay" className="text-gold-800 text-lg font-bold">
            {t("toPayTitle")}
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {toPay.map((order) => (
              <li key={order.orderNumber}>
                <Link
                  href={{
                    pathname: "/account/orders/[orderNumber]",
                    params: { orderNumber: order.orderNumber },
                  }}
                  className="text-gold-800 flex min-h-11 items-center rounded-xs font-semibold underline underline-offset-4"
                >
                  {t("toPayItem", {
                    orderNumber: order.orderNumber,
                    amount: formatMoney(order.finalTotal, locale),
                  })}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="account-recent" className="flex flex-col gap-4">
        {query.error && orders.length === 0 ? (
          <ErrorAlert
            error={query.error}
            title={t("loadError")}
            onRetry={() => void query.refetch()}
          />
        ) : query.isPending ? (
          <div className="space-y-3" aria-hidden="true">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        ) : orders.length === 0 ? (
          <NoOrders />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2
                id="account-recent"
                className="font-display text-3xl text-blue-900"
              >
                {t("recentOrders")}
              </h2>
              <Link
                href="/account/orders"
                className="rounded-xs font-bold text-blue-700 underline underline-offset-4"
              >
                {t("allOrders")}
              </Link>
            </div>
            <ul className="flex flex-col gap-3">
              {orders.slice(0, 3).map((order) => (
                <li key={order.orderNumber}>
                  <OrderCard order={order} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
