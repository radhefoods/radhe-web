"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import {
  orderDocumentsQueryKey,
  orderQueryKey,
  ordersQueryKey,
} from "@/features/orders/orders";
import { isSafePaymentUrl } from "@/features/orders/payment-url";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { ApiError, hasErrorCode } from "@/lib/api/errors";
import type { OrderDetail, OrderStatus, PaymentBlock } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";

// The payment of an order, and the way back from Stripe (doc 10). Stripe
// sends the customer to the order page with `?payment=success` or
// `?payment=cancelled`; the payment-failed email with `?pay=1`. The page asks
// `GET …/payment`, which asks Stripe about an open page first, so the answer
// is right the moment the customer comes back.

/** What the address of the order page says about the way back. */
export type PaymentReturn = "success" | "cancelled" | null;

const panel = "border-line rounded-xl border bg-white p-5";
const sectionTitle = "font-display text-xl text-ink";
const link =
  "text-leaf-700 flex items-center gap-1.5 self-start rounded-xs font-semibold underline underline-offset-4";

/** After `?payment=success`: asked every few seconds, then more slowly. */
const QUICK_MS = 3_000;
/** Quick checks before the page slows down: two minutes at three seconds. */
const QUICK_CHECKS = 40;
const SLOW_MS = 10_000;

/** Leaves the shop for the payment page; Stripe brings the customer back. */
function goToPaymentPage(url: string): void {
  if (!isSafePaymentUrl(url)) {
    throw new ApiError({
      status: 502,
      code: "PAYMENT_PROVIDER_ERROR",
      message: "The payment page has an address that is not accepted.",
    });
  }
  window.location.assign(url);
}

export interface PaymentState {
  /** The order status, as fresh as the API's last word. */
  status: OrderStatus;
  payment: PaymentBlock;
  /** The API is being asked right now. */
  checking: boolean;
  /** Asking again stopped: the payment is taking longer than usual. */
  slow: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * The freshest word on the payment. While the order waits for its payment,
 * or when the customer comes back from Stripe, the page asks `GET …/payment`;
 * a completed payment is then settled on the spot, an expired page is
 * forgotten. After `?payment=success` with a page still completing (PayPal
 * can take a moment) it asks again every few seconds. Whatever it finds, the
 * order on the page follows.
 */
export function usePaymentState(
  order: OrderDetail,
  paymentReturn: PaymentReturn,
): PaymentState {
  const locale = useLocale();
  const client = useQueryClient();
  // How often the API was asked on this page: the pace slows down after a while.
  const [checks, setChecks] = useState(0);
  const ask = paymentReturn !== null || order.status === "pending_payment";
  const query = useQuery({
    queryKey: ["order-payment", order.orderNumber.toUpperCase()],
    queryFn: async () => {
      const answer = await api.getOrderPayment(order.orderNumber);
      setChecks((count) => count + 1);
      return answer;
    },
    enabled: ask,
    staleTime: 0,
    refetchInterval: (current) => {
      const answer = current.state.data;
      if (!answer || paymentReturn !== "success") return false;
      const completing =
        answer.status === "pending_payment" &&
        answer.payment.status !== "failed" &&
        answer.payment.checkout !== null;
      if (!completing) return false;
      return current.state.dataUpdateCount < QUICK_CHECKS ? QUICK_MS : SLOW_MS;
    },
  });
  const answer = query.data;

  useEffect(() => {
    if (!answer) return;
    if (
      answer.status !== order.status ||
      answer.payment.status !== order.paymentStatus
    ) {
      void client.invalidateQueries({
        queryKey: orderQueryKey(order.orderNumber, locale),
      });
      void client.invalidateQueries({ queryKey: ordersQueryKey(locale) });
      void client.invalidateQueries({
        queryKey: orderDocumentsQueryKey(order.orderNumber),
      });
    }
  }, [
    answer,
    order.status,
    order.paymentStatus,
    order.orderNumber,
    client,
    locale,
  ]);

  const { refetch: refetchQuery } = query;
  const refetch = useCallback(() => void refetchQuery(), [refetchQuery]);
  return {
    status: answer?.status ?? order.status,
    payment: answer?.payment ?? order.payment,
    checking: query.isFetching,
    slow: checks >= QUICK_CHECKS,
    error: query.error,
    refetch,
  };
}

/**
 * "Pay now": the open page of the order when there is one, else a new page
 * from `POST …/pay`. Only offered while `payment.canPayOnline`.
 */
function usePayNow(orderNumber: string, state: PaymentState) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const openUrl = state.payment.checkout?.url ?? null;
  const { refetch } = state;
  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const url = openUrl ?? (await api.createPaymentPage(orderNumber)).url;
      goToPaymentPage(url);
    } catch (caught) {
      // Paid or cancelled meanwhile: the page shows the real state.
      if (hasErrorCode(caught, "ORDER_NOT_PAYABLE")) refetch();
      setError(caught);
      setStarting(false);
    }
  }, [openUrl, orderNumber, refetch]);
  return { start, starting, error };
}

function PayNowButton({
  orderNumber,
  state,
  pay,
}: {
  orderNumber: string;
  state: PaymentState;
  pay: ReturnType<typeof usePayNow>;
}) {
  const t = useTranslations("payment");
  const locale = useLocale() as Locale;
  if (!state.payment.canPayOnline) {
    return <Alert tone="info">{t("notConfigured")}</Alert>;
  }
  return (
    <>
      <Button
        variant="pay"
        size="lg"
        block
        loading={pay.starting}
        onClick={() => void pay.start()}
        aria-describedby={`pay-methods-${orderNumber}`}
      >
        {t("payNow", { amount: formatMoney(state.payment.amount, locale) })}
      </Button>
      <p
        id={`pay-methods-${orderNumber}`}
        className="text-ink-muted text-center text-sm"
      >
        {t("payMethods")}
      </p>
      {pay.error !== null && <ErrorAlert error={pay.error} />}
    </>
  );
}

/**
 * What the customer must know first, at the top of the order page: the
 * outcome of the payment they come back from (10.4), a failed attempt, or an
 * order the API cancelled because a product sold out. With `?pay=1` the
 * payment page opens straight away.
 */
export function PaymentOutcome({
  order,
  state,
  paymentReturn,
  payAtOnce,
  email,
}: {
  order: OrderDetail;
  state: PaymentState;
  paymentReturn: PaymentReturn;
  /** `?pay=1` from the payment-failed email. */
  payAtOnce: boolean;
  email: string | null;
}) {
  const t = useTranslations("payment");
  const pay = usePayNow(order.orderNumber, state);
  const { status, payment } = state;
  const waiting = status === "pending_payment";

  const started = useRef(false);
  useEffect(() => {
    if (payAtOnce && waiting && payment.canPayOnline && !started.current) {
      started.current = true;
      void pay.start();
    }
  }, [payAtOnce, waiting, payment.canPayOnline, pay]);

  if (pay.starting) return <Alert tone="info">{t("opening")}</Alert>;

  if (status === "cancelled" && order.cancellation?.reason === "sold_out") {
    return (
      <Alert tone="bad" title={t("soldOutTitle")}>
        <p>{t("soldOutText")}</p>
        <Link
          href="/cart"
          className={buttonStyles({
            variant: "secondary",
            size: "sm",
            className: "mt-2",
          })}
        >
          {t("toCart")}
        </Link>
      </Alert>
    );
  }

  if (payment.status === "paid" && paymentReturn === "success") {
    return (
      <Alert tone="good" title={t("successTitle")}>
        {email ? t("successText", { email }) : t("successTextPlain")}
      </Alert>
    );
  }

  if (!waiting) return null;

  if (payment.status === "failed") {
    return (
      <Alert tone="warn" title={t("failedTitle")}>
        <p>{t("failedText")}</p>
        <div className="mt-2 max-w-sm">
          <PayNowButton
            orderNumber={order.orderNumber}
            state={state}
            pay={pay}
          />
        </div>
      </Alert>
    );
  }

  if (paymentReturn === "success" && payment.checkout !== null) {
    if (state.error && !state.checking) {
      return <ErrorAlert error={state.error} onRetry={state.refetch} />;
    }
    return state.slow ? (
      <Alert tone="info" title={t("pendingTitle")}>
        <p>{t("pendingText")}</p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          loading={state.checking}
          onClick={state.refetch}
        >
          {t("checkAgain")}
        </Button>
      </Alert>
    ) : (
      <Alert tone="info" title={t("confirmingTitle")}>
        {t("confirmingText")}
      </Alert>
    );
  }

  if (paymentReturn !== null) {
    // The page was left, or it expired and nothing came of it.
    return (
      <Alert tone="info" title={t("cancelledTitle")}>
        <p>{t("cancelledText")}</p>
        <div className="mt-2 max-w-sm">
          <PayNowButton
            orderNumber={order.orderNumber}
            state={state}
            pay={pay}
          />
        </div>
      </Alert>
    );
  }
  return null;
}

/** The payment panel of the order page: status, method, documents, "Pay now". */
export function PaymentPanel({
  order,
  state,
}: {
  order: OrderDetail;
  state: PaymentState;
}) {
  const t = useTranslations("payment");
  const locale = useLocale() as Locale;
  const pay = usePayNow(order.orderNumber, state);
  const { status, payment } = state;
  const waiting = status === "pending_payment";
  const paid = payment.status === "paid" || payment.status === "refunded";

  return (
    <section
      aria-labelledby="order-payment"
      className={cn(
        panel,
        "flex flex-col gap-3",
        // The one thing the customer has to do comes first on small screens.
        waiting && "max-xl:order-first",
      )}
    >
      <h2 id="order-payment" className={sectionTitle}>
        {t("title")}
      </h2>

      {waiting && (
        <>
          <p className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="font-bold">{t("amount")}</span>
            <span className="text-3xl font-bold tabular-nums">
              {formatMoney(payment.amount, locale)}
            </span>
          </p>
          <p className="text-ink-muted text-[0.9375rem]">
            {payment.status === "failed" ? t("failedText") : t("waitingText")}
          </p>
          <PayNowButton
            orderNumber={order.orderNumber}
            state={state}
            pay={pay}
          />
        </>
      )}

      {paid && (
        <p className="text-leaf-700 flex flex-wrap items-center gap-x-2 gap-y-1 font-bold">
          <Check aria-hidden="true" className="size-5" strokeWidth={3} />
          {payment.paidAt &&
            t("paidOn", { date: formatDate(payment.paidAt, locale) })}
          {payment.method && (
            <span className="font-normal">{t(`method.${payment.method}`)}</span>
          )}
        </p>
      )}

      {status === "cancelled" && payment.paidAmount === 0 && (
        <p className="text-ink-muted">{t("nothingCharged")}</p>
      )}

      {payment.creditedAmount > 0 && (
        <p className="text-ink-muted text-sm">
          {t("credited", {
            amount: formatMoney(payment.creditedAmount, locale),
          })}
        </p>
      )}
      {payment.refundedAmount > 0 && (
        <p className="text-ink-muted text-sm">
          {t("refunded", {
            amount: formatMoney(payment.refundedAmount, locale),
          })}
        </p>
      )}
      {payment.invoice && (
        <a href="#order-documents" className={link}>
          {t("invoice", { number: payment.invoice.number })}
        </a>
      )}
      {payment.receiptUrl && (
        <a
          href={payment.receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={link}
        >
          {t("receipt")}
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      )}
    </section>
  );
}
