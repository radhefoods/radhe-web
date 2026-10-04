"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { BillTotals } from "@/components/cart/bill-summary";
import { buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { orderQueryKey } from "@/features/orders/orders";
import { useSession } from "@/features/session/session";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { formatDayRange } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";

/**
 * The page after a placed pre-order: the order number, the agreed total,
 * that nothing was paid, when it will be delivered, and what happens next.
 */
export function ConfirmationView({ orderNumber }: { orderNumber: string }) {
  const t = useTranslations("checkout.confirmation");
  const tCheckout = useTranslations("checkout");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const session = useSession({ force: true });

  useEffect(() => {
    if (session.status === "guest") {
      router.replace({ pathname: "/sign-in", query: { returnTo: "/" } });
    }
  }, [session.status, router]);

  const query = useQuery({
    queryKey: orderQueryKey(orderNumber, locale),
    queryFn: async () => (await api.getOrder(orderNumber)).order,
    enabled: session.status === "customer",
    // Right after placing, the order is already here.
    staleTime: 60_000,
  });
  const order = query.data;

  if (query.error && !order) {
    return (
      <ErrorAlert
        error={query.error}
        title={t("notFound")}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!order) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  const address = order.deliveryAddress;
  const fact = "flex flex-col gap-0.5";
  const label = "text-ink-muted text-sm";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="flex items-center gap-2 font-bold text-teal-700">
          <CircleCheck aria-hidden="true" className="size-6" />
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-4xl text-blue-900 sm:text-5xl">
          {t("title")}
        </h1>
        {session.customer && (
          <p className="text-ink-muted">
            {t("text", { email: session.customer.email })}
          </p>
        )}
      </header>

      <dl className="bg-mist grid gap-5 rounded-xl p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
        <div className={fact}>
          <dt className={label}>{t("orderNumber")}</dt>
          <dd className="text-xl font-bold">{order.orderNumber}</dd>
        </div>
        <div className={fact}>
          <dt className={label}>{t("total")}</dt>
          <dd className="text-xl font-bold tabular-nums">
            {formatMoney(order.total, locale)}
          </dd>
        </div>
        <div className={fact}>
          <dt className={label}>{t("paidNow")}</dt>
          <dd className="text-xl font-bold text-teal-700 tabular-nums">
            {formatMoney(0, locale)}
          </dd>
        </div>
        <div className={fact}>
          <dt className={label}>{t("delivery")}</dt>
          <dd className="text-xl font-bold">
            {formatDayRange(
              order.delivery.promisedStart,
              order.delivery.promisedEnd,
              locale,
            )}
          </dd>
        </div>
      </dl>

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="confirmation-next" className="space-y-3">
          <h2
            id="confirmation-next"
            className="font-display text-3xl text-blue-900"
          >
            {t("nextTitle")}
          </h2>
          <ol className="space-y-3">
            {[t("next1"), t("next2"), t("next3")].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="font-display text-3xl leading-none text-blue-600"
                >
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <h2 className="pt-3 text-lg font-bold">{t("address")}</h2>
          <address className="text-ink-muted flex flex-col not-italic">
            <span>
              {address.firstName} {address.lastName}
            </span>
            {address.company && <span>{address.company}</span>}
            <span>
              {address.street} {address.houseNumber}
            </span>
            {address.additionalLine && <span>{address.additionalLine}</span>}
            <span>
              {address.postalCode} {address.city}
            </span>
          </address>
        </section>

        <section
          aria-labelledby="confirmation-items"
          className="border-line flex flex-col gap-4 rounded-xl border p-5"
        >
          <h2
            id="confirmation-items"
            className="font-display text-3xl text-blue-900"
          >
            {t("items")}
          </h2>
          <ul className="divide-line divide-y text-[0.9375rem]">
            {order.items.map((item) => (
              <li
                key={item.productId}
                className="flex items-baseline justify-between gap-4 py-2 first:pt-0"
              >
                <span className="min-w-0">
                  <span className="text-ink-muted tabular-nums">
                    {tCheckout("quantityTimes", { quantity: item.quantity })}
                  </span>{" "}
                  {item.name}, {item.packSize.label}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatMoney(item.lineTotal, locale)}
                </span>
              </li>
            ))}
          </ul>
          <BillTotals totals={order.totals} />
        </section>
      </div>

      <div>
        <Link
          href="/products"
          className={buttonStyles({ variant: "secondary" })}
        >
          {t("continue")}
        </Link>
      </div>
    </div>
  );
}
