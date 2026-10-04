"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ExternalLink, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { BillTotals } from "@/components/cart/bill-summary";
import { Alert } from "@/components/ui/alert";
import { Button, buttonStyles } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ErrorAlert } from "@/components/ui/error-alert";
import { controlStyles } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RETURN_STATUS_TONE,
  buildTimeline,
  orderDocumentsQueryKey,
  orderQueryKey,
  orderReturnsQueryKey,
  ordersQueryKey,
  type TimelineStep,
} from "@/features/orders/orders";
import { isSafePaymentUrl } from "@/features/orders/payment-url";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/errors";
import type {
  CancellationReason,
  OrderDetail,
  PaymentBlock,
  ReturnRequest,
} from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate, formatDayRange } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
import { AddressBlock, DocumentRow, OrderStatusChips } from "./order-bits";

const sectionTitle = "font-display text-3xl text-blue-900";
const panel = "border-line rounded-xl border bg-white p-5";

// --- Progress ----------------------------------------------------------------

function Timeline({ order }: { order: OrderDetail }) {
  const t = useTranslations("orders");
  const locale = useLocale() as Locale;
  const steps = buildTimeline(order);

  const textOf = (step: TimelineStep): string | null => {
    const { delivery, payment } = order;
    switch (step.key) {
      case "preparing":
        return step.state === "current" ? t("timeline.preparingText") : null;
      case "dispatched":
        return step.state === "todo" ? null : t(`method.${delivery.method}`);
      case "delivery_failed":
        return t("timeline.deliveryFailedText");
      case "delivered":
        return step.state === "todo"
          ? `${t("estimated")}: ${formatDayRange(delivery.promisedStart, delivery.promisedEnd, locale)}`
          : null;
      case "cancelled":
        return order.cancellation
          ? t(`cancelledBy.${order.cancellation.by}`)
          : null;
      case "payment":
        if (step.state === "done") return t("timeline.paymentDone");
        if (payment.deadline && step.state === "problem") {
          return t("timeline.paymentOverdue", {
            date: formatDate(payment.deadline, locale),
          });
        }
        if (payment.deadline && payment.status === "due") {
          return t("timeline.paymentDue", {
            date: formatDate(payment.deadline, locale),
          });
        }
        return t("timeline.paymentWaiting");
      default:
        return null;
    }
  };

  return (
    <ol>
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        const text = textOf(step);
        return (
          <li
            key={step.key}
            className="relative grid grid-cols-[1.75rem_1fr] gap-3 pb-5 last:pb-0"
          >
            {!last && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-7 bottom-0 left-[0.8125rem] w-0.5",
                  step.state === "done" ? "bg-blue-600" : "bg-line-strong",
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "z-10 grid size-7 place-items-center rounded-full",
                step.state === "done" && "bg-blue-600 text-white",
                // The current step wears the eye of the peacock feather.
                step.state === "current" &&
                  "feather-eye ring-gold-400/25 ring-4",
                step.state === "todo" && "border-line-strong border-2 bg-white",
                step.state === "problem" && "bg-red-600 text-white",
              )}
            >
              {step.state === "done" && (
                <Check className="size-4" strokeWidth={3} />
              )}
              {step.state === "problem" && (
                <X className="size-4" strokeWidth={3} />
              )}
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  "leading-snug",
                  step.state === "todo"
                    ? "text-ink-muted font-semibold"
                    : "font-bold",
                  step.state === "problem" && "text-red-600",
                )}
                aria-current={step.state === "current" ? "step" : undefined}
              >
                {t(`timeline.${step.key}`)}
                {step.at && (
                  <span className="text-ink-muted font-normal">
                    {" · "}
                    {formatDate(step.at, locale)}
                  </span>
                )}
              </p>
              {text && <p className="text-ink-muted text-sm">{text}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// --- Payment -----------------------------------------------------------------

function PaymentPanel({
  orderNumber,
  payment,
}: {
  orderNumber: string;
  payment: PaymentBlock;
}) {
  const t = useTranslations("payment");
  const locale = useLocale() as Locale;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const owing = payment.status === "due" || payment.status === "overdue";
  const overdue = payment.status === "overdue" || payment.isOverdue === true;

  async function payNow() {
    setStarting(true);
    setError(null);
    try {
      const { url } = await api.createOrderCheckout(orderNumber);
      if (!isSafePaymentUrl(url)) {
        throw new ApiError({
          status: 502,
          code: "PAYMENT_PROVIDER_ERROR",
          message: "The payment page has an address that is not accepted.",
        });
      }
      // Leaves the shop for the payment page; Stripe brings the customer
      // back to this order with `?payment=success` or `?payment=cancelled`.
      window.location.assign(url);
    } catch (caught) {
      setError(caught);
      setStarting(false);
    }
  }

  return (
    <section
      aria-labelledby="order-payment"
      className={cn(
        panel,
        "flex flex-col gap-3",
        // The one thing the customer has to do comes first on small screens.
        owing && "max-xl:order-first",
        overdue && owing && "border-red-200 bg-red-50",
      )}
    >
      <h2 id="order-payment" className={sectionTitle}>
        {t("title")}
      </h2>

      {payment.status === "not_enabled" && (
        <p className="text-ink-muted">{t("notEnabled")}</p>
      )}

      {owing && (
        <>
          <p className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="font-bold">{t("amountDue")}</span>
            <span className="text-3xl font-bold tabular-nums">
              {formatMoney(payment.amountDue, locale)}
            </span>
          </p>
          {payment.deadline && (
            <p className={cn(overdue && "font-semibold text-red-800")}>
              {t(overdue ? "wasDue" : "payBy", {
                date: formatDate(payment.deadline, locale),
              })}
            </p>
          )}
          {payment.canPayOnline ? (
            <>
              <Button
                variant="pay"
                size="lg"
                block
                loading={starting}
                onClick={() => void payNow()}
              >
                {t("payNow", {
                  amount: formatMoney(payment.amountDue, locale),
                })}
              </Button>
              <p className="text-ink-muted text-center text-sm">
                {t("payMethods")}
              </p>
            </>
          ) : (
            !payment.cashPossible && <Alert tone="info">{t("noOnline")}</Alert>
          )}
          {payment.cashPossible && (
            <p className="rounded-md bg-white/70 text-[0.9375rem]">
              {t("cashHint")}
            </p>
          )}
          {error !== null && <ErrorAlert error={error} />}
        </>
      )}

      {payment.status === "paid" && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold text-teal-700">
          <Check aria-hidden="true" className="size-5" strokeWidth={3} />
          {payment.paidAt &&
            t("paidOn", { date: formatDate(payment.paidAt, locale) })}
          <span className="font-normal">
            {t(
              `method.${payment.method === "stripe" ? (payment.paymentType ?? "stripe") : (payment.method ?? "stripe")}`,
            )}
          </span>
        </p>
      )}
      {payment.status === "waived" && <p>{t("waived")}</p>}

      {(payment.creditedAmount ?? 0) > 0 && (
        <p className="text-ink-muted text-sm">
          {t("credited", {
            amount: formatMoney(payment.creditedAmount ?? 0, locale),
          })}
        </p>
      )}
      {(payment.refundedAmount ?? 0) > 0 && (
        <p className="text-ink-muted text-sm">
          {t("refunded", {
            amount: formatMoney(payment.refundedAmount ?? 0, locale),
          })}
        </p>
      )}
      {payment.receiptUrl && (
        <a
          href={payment.receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 self-start rounded-xs font-semibold text-blue-700 underline underline-offset-4"
        >
          {t("receipt")}
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      )}
    </section>
  );
}

/** How many times the payment is asked for after the return from Stripe. */
const PAYMENT_CHECKS = 6;

/**
 * After the return from the payment page (`?payment=success`): the API is
 * asked about the payment, which makes it ask Stripe, so the order can show
 * "paid" before Stripe's own notification arrives. Slow payment methods are
 * asked for a few more times.
 */
function PaymentReturn({
  orderNumber,
  result,
}: {
  orderNumber: string;
  result: "success" | "cancelled";
}) {
  const t = useTranslations("payment");
  const locale = useLocale();
  const client = useQueryClient();
  const [checks, setChecks] = useState(0);
  const check = useQuery({
    queryKey: ["order-payment", orderNumber.toUpperCase()],
    queryFn: async () => {
      const answer = await api.getOrderPayment(orderNumber);
      setChecks((count) => count + 1);
      return answer;
    },
    enabled: result === "success",
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.payment.status;
      const open = status === "due" || status === "overdue";
      return open && query.state.dataUpdateCount < PAYMENT_CHECKS
        ? 3000
        : false;
    },
  });
  const status = check.data?.payment.status;

  // The order on this page follows what the check found.
  useEffect(() => {
    if (!status) return;
    void client.invalidateQueries({
      queryKey: orderQueryKey(orderNumber, locale),
    });
    void client.invalidateQueries({
      queryKey: orderDocumentsQueryKey(orderNumber),
    });
    void client.invalidateQueries({ queryKey: ordersQueryKey(locale) });
  }, [status, client, orderNumber, locale]);

  if (result === "cancelled") {
    return (
      <Alert tone="info" title={t("cancelledTitle")}>
        {t("cancelledText")}
      </Alert>
    );
  }
  if (check.error && !check.data) return <ErrorAlert error={check.error} />;
  if (!status) return <Alert tone="info">{t("checking")}</Alert>;
  if (status === "due" || status === "overdue") {
    return check.isFetching || checks < PAYMENT_CHECKS ? (
      <Alert tone="info">{t("checking")}</Alert>
    ) : (
      <Alert tone="warn" title={t("pendingTitle")}>
        {t("pendingText")}
      </Alert>
    );
  }
  return (
    <Alert tone="good" title={t("successTitle")}>
      {t("successText")}
    </Alert>
  );
}

// --- Cancelling --------------------------------------------------------------

const CANCEL_REASONS: CancellationReason[] = [
  "changed_mind",
  "ordered_by_mistake",
  "wrong_items",
  "delivery_too_late",
  "other",
];

function CancelOrder({
  order,
  onCancelled,
}: {
  order: OrderDetail;
  onCancelled: (order: OrderDetail) => void;
}) {
  const t = useTranslations("orders.cancel");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CancellationReason>("changed_mind");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.cancelOrder(order.orderNumber, {
        reason,
        text: text.trim() || undefined,
      });
      setOpen(false);
      onCancelled(result.order);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={t("title", { orderNumber: order.orderNumber })}
      closeLabel={tCommon("close")}
      trigger={<Button variant="danger">{t("button")}</Button>}
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <p className="text-ink-muted">{t("intro")}</p>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-bold">{t("reason")}</legend>
          {CANCEL_REASONS.map((value) => (
            <label key={value} className="flex min-h-11 items-center gap-3">
              <input
                type="radio"
                name="cancel-reason"
                className="size-5 accent-blue-600"
                checked={reason === value}
                onChange={() => setReason(value)}
              />
              {t(`reasons.${value}`)}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cancel-text" className="text-sm font-bold">
            {t("text")}
          </label>
          <textarea
            id="cancel-text"
            rows={3}
            maxLength={1000}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className={cn(controlStyles, "py-3")}
          />
        </div>
        {error !== null && <ErrorAlert error={error} />}
        <div className="flex flex-col gap-3">
          <Button type="submit" variant="danger" block loading={busy}>
            {t("confirm")}
          </Button>
          <Button
            variant="secondary"
            block
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            {t("keep")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

// --- Returns -----------------------------------------------------------------

function ReturnCard({
  request,
  onChanged,
}: {
  request: ReturnRequest;
  onChanged: () => void;
}) {
  const t = useTranslations("returns");
  const locale = useLocale() as Locale;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  return (
    <li className="border-line flex flex-col gap-2 border-b py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">
          {t("number", { returnNumber: request.returnNumber })}
        </p>
        <Chip tone={RETURN_STATUS_TONE[request.status]}>
          {t(`status.${request.status}`)}
        </Chip>
      </div>
      <p className="text-ink-muted text-sm">
        {t("requestedOn", { date: formatDate(request.requestedAt, locale) })}
      </p>
      <ul className="text-[0.9375rem]">
        {request.items.map((item) => (
          <li key={item.productId}>
            {t("itemLine", {
              quantity: item.quantity,
              name: `${item.name}, ${item.packSize.label}`,
            })}
            <span className="text-ink-muted">
              {" · "}
              {t(`reason.${item.reason}`)}
              {item.approvedQuantity !== null &&
                item.approvedQuantity !== item.quantity && (
                  <>
                    {" · "}
                    {t("approvedOf", {
                      approved: item.approvedQuantity,
                      quantity: item.quantity,
                    })}
                  </>
                )}
            </span>
          </li>
        ))}
      </ul>
      {request.answer && (
        <p className="bg-mist rounded-md px-3.5 py-2.5 text-[0.9375rem]">
          <span className="font-bold">{t("answer")}:</span> {request.answer}
        </p>
      )}
      {request.creditAmount !== null && (
        <p className="font-bold text-teal-700">
          {t("credit", { amount: formatMoney(request.creditAmount, locale) })}
        </p>
      )}
      {request.canCancel && (
        <Button
          variant="quiet"
          size="sm"
          className="self-start"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await api.cancelReturn(request.returnNumber);
              onChanged();
            } catch (caught) {
              setError(caught);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("withdraw")}
        </Button>
      )}
      {error !== null && <ErrorAlert error={error} />}
    </li>
  );
}

// --- The page ----------------------------------------------------------------

/**
 * One order with everything a customer wants to know about it: where it
 * is, what is to pay, the documents, returns, and the bill as agreed and as
 * it finally is.
 */
export function OrderDetailView({
  orderNumber,
  paymentReturn,
}: {
  orderNumber: string;
  /** Set when the customer comes back from the payment page. */
  paymentReturn: "success" | "cancelled" | null;
}) {
  const t = useTranslations("orders");
  const tAccount = useTranslations("account");
  const tDocuments = useTranslations("documents");
  const tReturns = useTranslations("returns");
  const locale = useLocale() as Locale;
  const client = useQueryClient();
  const [justCancelled, setJustCancelled] = useState(false);

  const orderQuery = useQuery({
    queryKey: orderQueryKey(orderNumber, locale),
    queryFn: async () => (await api.getOrder(orderNumber)).order,
    staleTime: 0,
  });
  const order = orderQuery.data;
  const invoiced = Boolean(order?.payment.invoice);
  const delivered = Boolean(order?.delivery.deliveredAt);

  const documentsQuery = useQuery({
    queryKey: orderDocumentsQueryKey(orderNumber),
    queryFn: () => api.listInvoices({ orderNumber, limit: 100 }),
    enabled: invoiced,
  });
  const returnsQuery = useQuery({
    queryKey: orderReturnsQueryKey(orderNumber, locale),
    queryFn: () => api.getOrderReturns(orderNumber),
    enabled: delivered,
  });

  if (orderQuery.error && !order) {
    return (
      <div className="space-y-4">
        <ErrorAlert
          error={orderQuery.error}
          title={tAccount("loadError")}
          onRetry={() => void orderQuery.refetch()}
        />
        <Link href="/account/orders" className={buttonStyles({ size: "sm" })}>
          {t("back")}
        </Link>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const changed =
    order.finalTotals.total !== order.totals.total ||
    order.adjustments.length > 0;
  const documents = documentsQuery.data?.items ?? [];
  const returns = returnsQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          href="/account/orders"
          className="hover:text-ink text-ink-muted -ml-1 flex min-h-11 items-center gap-1 self-start rounded-sm text-[0.9375rem] font-semibold"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-4xl text-blue-900 sm:text-5xl">
            {t("orderNumber", { orderNumber: order.orderNumber })}
          </h1>
          <OrderStatusChips
            status={order.status}
            paymentStatus={order.paymentStatus}
          />
        </div>
        <p className="text-ink-muted">
          {t("placedOn", { date: formatDate(order.placedAt, locale) })}
        </p>
      </header>

      {paymentReturn && (
        <PaymentReturn orderNumber={order.orderNumber} result={paymentReturn} />
      )}
      {justCancelled && <Alert tone="good">{t("cancel.done")}</Alert>}

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_22rem]">
        <section aria-labelledby="order-progress" className={panel}>
          <h2 id="order-progress" className={cn(sectionTitle, "mb-4")}>
            {t("timeline.title")}
          </h2>
          <Timeline order={order} />
          {order.delivery.trackingUrl && (
            <a
              href={order.delivery.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonStyles({ variant: "secondary", size: "sm" }),
                "mt-4",
              )}
            >
              {t("track")}
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          )}
          {order.delivery.trackingNumber && (
            <p className="text-ink-muted mt-2 text-sm">
              {t("trackingNumber")}: {order.delivery.trackingNumber}
            </p>
          )}
        </section>

        {order.status !== "cancelled" && (
          <PaymentPanel
            orderNumber={order.orderNumber}
            payment={order.payment}
          />
        )}
      </div>

      <section aria-labelledby="order-items" className={panel}>
        <h2 id="order-items" className={cn(sectionTitle, "mb-2")}>
          {t("itemsTitle")}
        </h2>
        <ul className="divide-line divide-y">
          {order.items.map((item) => (
            <li key={item.productId} className="flex gap-4 py-3.5">
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  width={64}
                  height={64}
                  loading="lazy"
                  className="bg-mist size-16 shrink-0 rounded-md object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold">{item.name}</p>
                <p className="text-ink-muted text-sm tabular-nums">
                  {item.packSize.label} · {item.quantity} ×{" "}
                  {formatMoney(item.unitPrice, locale)}
                </p>
                {delivered && item.deliveredQuantity !== item.quantity && (
                  <p className="text-gold-700 text-sm font-semibold">
                    {t("deliveredQuantity", {
                      delivered: item.deliveredQuantity,
                      ordered: item.quantity,
                    })}
                  </p>
                )}
                {item.returnedQuantity > 0 && (
                  <p className="text-gold-700 text-sm font-semibold">
                    {t("returnedQuantity", { count: item.returnedQuantity })}
                  </p>
                )}
              </div>
              <p className="shrink-0 font-bold tabular-nums">
                {formatMoney(
                  delivered ? item.finalLineTotal : item.lineTotal,
                  locale,
                )}
              </p>
            </li>
          ))}
        </ul>
        {order.adjustments.length > 0 && (
          <div className="bg-mist mt-2 rounded-md px-3.5 py-3 text-sm">
            <p className="font-bold">{t("adjustmentsTitle")}</p>
            <ul>
              {order.adjustments.map((adjustment, index) => (
                <li key={index}>
                  {t("adjustment", {
                    sku: adjustment.sku,
                    from: adjustment.to,
                    to: adjustment.from,
                  })}{" "}
                  ({t(`adjustmentReason.${adjustment.reason}`)})
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="grid items-start gap-6 md:grid-cols-2">
        <section aria-labelledby="order-bill" className={panel}>
          <h2 id="order-bill" className={cn(sectionTitle, "mb-3")}>
            {t("billTitle")}
          </h2>
          {changed && (
            <p className="text-ink-muted mb-1 text-sm font-bold">
              {t("billFinal")}
            </p>
          )}
          <BillTotals
            totals={changed ? order.finalTotals : order.totals}
            showDueToday={false}
          />
          {changed && (
            <p className="text-ink-muted border-line mt-3 flex justify-between gap-4 border-t pt-3 text-sm tabular-nums">
              <span>{t("billAgreed")}</span>
              <span>{formatMoney(order.totals.total, locale)}</span>
            </p>
          )}
        </section>

        <section aria-labelledby="order-address" className={panel}>
          <h2 id="order-address" className={cn(sectionTitle, "mb-3")}>
            {t("addressTitle")}
          </h2>
          <AddressBlock address={order.deliveryAddress} />
          {order.note && (
            <p className="mt-3">
              <span className="font-bold">{t("noteTitle")}:</span> {order.note}
            </p>
          )}
          <p className="text-ink-muted mt-3 text-sm">
            {t("acceptedTerms", {
              date: formatDate(order.acceptedTerms.at, locale),
            })}
          </p>
        </section>
      </div>

      {documents.length > 0 && (
        <section aria-labelledby="order-documents" className={panel}>
          <h2 id="order-documents" className={cn(sectionTitle, "mb-1")}>
            {tDocuments("title")}
          </h2>
          <ul>
            {documents.map((document) => (
              <DocumentRow key={document.id} document={document} />
            ))}
          </ul>
        </section>
      )}

      {(order.returns.possible || returns.length > 0) && (
        <section aria-labelledby="order-returns" className={panel}>
          <h2 id="order-returns" className={cn(sectionTitle, "mb-3")}>
            {tReturns("title")}
          </h2>
          {returns.length > 0 && (
            <ul className="mb-4">
              {returns.map((request) => (
                <ReturnCard
                  key={request.returnNumber}
                  request={request}
                  onChanged={() => {
                    void returnsQuery.refetch();
                    void orderQuery.refetch();
                  }}
                />
              ))}
            </ul>
          )}
          {order.returns.possible && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link
                href={{
                  pathname: "/account/orders/[orderNumber]/return",
                  params: { orderNumber: order.orderNumber },
                }}
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                {tReturns("request")}
              </Link>
              {order.returns.until && (
                <p className="text-ink-muted text-sm">
                  {tReturns("possibleUntil", {
                    date: formatDate(order.returns.until, locale),
                  })}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {order.canCancel && (
        <div>
          <CancelOrder
            order={order}
            onCancelled={(cancelled) => {
              client.setQueryData(
                orderQueryKey(orderNumber, locale),
                cancelled,
              );
              void client.invalidateQueries({
                queryKey: ordersQueryKey(locale),
              });
              setJustCancelled(true);
            }}
          />
        </div>
      )}
    </div>
  );
}
