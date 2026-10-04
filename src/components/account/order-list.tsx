"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { PackageOpen } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ordersQueryKey } from "@/features/orders/orders";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/browser";
import { OrderCard } from "./order-bits";

/** The orders of the customer, newest first, 25 at a time (doc 0.8). */
export function useOrders() {
  const locale = useLocale();
  return useInfiniteQuery({
    queryKey: ordersQueryKey(locale),
    queryFn: ({ pageParam }) =>
      api.listOrders({ limit: 25, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    staleTime: 0,
  });
}

export function NoOrders() {
  const t = useTranslations("account");
  return (
    <div className="bg-mist flex flex-col items-center gap-3 rounded-xl px-6 py-14 text-center">
      <PackageOpen aria-hidden="true" className="text-ink-subtle size-10" />
      <h2 className="font-display text-3xl text-blue-900">
        {t("noOrdersTitle")}
      </h2>
      <p className="text-ink-muted max-w-md">{t("noOrdersText")}</p>
      <Link href="/products" className={buttonStyles()}>
        {t("noOrdersCta")}
      </Link>
    </div>
  );
}

export function OrderList() {
  const t = useTranslations("orders");
  const tAccount = useTranslations("account");
  const query = useOrders();
  const orders = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-4xl text-blue-900 sm:text-5xl">
        {t("title")}
      </h1>
      {query.error && orders.length === 0 ? (
        <ErrorAlert
          error={query.error}
          title={tAccount("loadError")}
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
          <ul className="flex flex-col gap-3">
            {orders.map((order) => (
              <li key={order.orderNumber}>
                <OrderCard order={order} heading="h2" />
              </li>
            ))}
          </ul>
          {query.hasNextPage && (
            <Button
              variant="secondary"
              className="self-center"
              loading={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {t("loadMore")}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
