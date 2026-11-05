"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { forgetGuestCart } from "@/features/cart/cart";
import { Alert } from "@/components/ui/alert";
import { buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { orderCalls, type OrderAccess } from "@/features/orders/order-access";
import { orderQueryKey } from "@/features/orders/orders";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { hasErrorCode, isRetryable } from "@/lib/api/errors";
import {
  forgetGuestToken,
  rememberGuestToken,
  resolveGuestToken,
} from "@/lib/orders/guest-token";
import { OrderBody } from "./order-detail";
import type { PaymentReturn } from "./order-payment";

/**
 * The API refused the token: the documented `403`, or the `400` it answers
 * for a token that is not even shaped like one.
 */
function tokenRefused(error: unknown): boolean {
  return (
    hasErrorCode(error, "ORDER_TOKEN_INVALID") ||
    hasErrorCode(error, "VALIDATION_FAILED")
  );
}

/**
 * The order of a guest (doc 20), opened by the token of the link: the
 * same page as an account's order, read from the guest endpoint, without
 * returns and without the account around it. The way back from Stripe
 * lands here with `?payment=success|cancelled`, the emails with the
 * token alone. A missing or wrong token says that the link is not valid;
 * an order that was given up unpaid says that it is gone.
 */
export function GuestOrderView({
  orderNumber,
  token: tokenFromUrl,
  paymentReturn,
  payAtOnce,
  deliveryEstimate,
}: {
  orderNumber: string;
  /** `?token=` of the address, or `null`. */
  token: string | null;
  paymentReturn: PaymentReturn;
  payAtOnce: boolean;
  deliveryEstimate: string | null;
}) {
  const t = useTranslations("orders");
  const tAccount = useTranslations("account");
  const locale = useLocale() as Locale;
  // The token of the address, else the one this tab kept for the order.
  const token = useMemo(
    () => resolveGuestToken(orderNumber, tokenFromUrl),
    [orderNumber, tokenFromUrl],
  );
  const access = useMemo<OrderAccess | null>(
    () => (token ? { kind: "guest", token } : null),
    [token],
  );
  useEffect(() => {
    if (token) rememberGuestToken(orderNumber, token);
  }, [orderNumber, token]);

  const orderQuery = useQuery({
    queryKey: orderQueryKey(orderNumber, locale, "guest"),
    queryFn: () => orderCalls(access!).getOrder(orderNumber),
    enabled: access !== null,
    staleTime: 0,
    // Network, 429, 502 to 504: asking again can help. A refused token or
    // an order that is gone stays what it is.
    retry: (failures, error) => failures < 2 && isRetryable(error),
  });
  const order = orderQuery.data;
  const invalid = access === null || tokenRefused(orderQuery.error);
  useEffect(() => {
    // A token the API refused is not kept: the next link brings the right one.
    if (tokenRefused(orderQuery.error)) {
      forgetGuestToken(orderNumber);
    }
  }, [orderQuery.error, orderNumber]);
  // Back from the payment page with the order paid: the browser's cart,
  // which the order was made from, has done its work.
  const paid = order?.paymentStatus === "paid";
  useEffect(() => {
    if (paymentReturn === "success" && paid) forgetGuestCart();
  }, [paymentReturn, paid]);

  const toShop = (
    <Link
      href="/"
      className={buttonStyles({ variant: "secondary", size: "sm" })}
    >
      {t("guest.backToShop")}
    </Link>
  );

  if (invalid) {
    return (
      <div className="space-y-4">
        <Alert tone="warn" title={t("guest.invalidTitle")}>
          {t("guest.invalidText")}
        </Alert>
        {toShop}
      </div>
    );
  }
  if (orderQuery.error && !order) {
    return (
      <div className="space-y-4">
        {hasErrorCode(orderQuery.error, "ORDER_NOT_FOUND") ? (
          <Alert tone="info" title={t("guest.goneTitle")}>
            {t("guest.goneText")}
          </Alert>
        ) : (
          <ErrorAlert
            error={orderQuery.error}
            title={tAccount("loadError")}
            onRetry={() => void orderQuery.refetch()}
          />
        )}
        {toShop}
      </div>
    );
  }
  if (!order || !access) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  return (
    <OrderBody
      order={order}
      access={access}
      paymentReturn={paymentReturn}
      payAtOnce={payAtOnce}
      deliveryEstimate={deliveryEstimate}
      refetch={() => void orderQuery.refetch()}
    />
  );
}
