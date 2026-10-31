"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ExternalLink, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { BillTotals } from "@/components/cart/bill-summary";
import { orderSavingsOf } from "@/features/cart/savings";
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
import { useSession } from "@/features/session/session";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import type {
  CustomerCancellationReason,
  OrderDetail,
  ReturnRequest,
} from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
import { AddressBlock, DocumentRow, OrderStatusChips } from "./order-bits";
import {
  formatPackSize,
  formatProductName,
  productTitle,
} from "@/lib/format/product-name";
import {
  PaymentOutcome,
  PaymentPanel,
  usePaymentState,
  type PaymentReturn,
} from "./order-payment";

const sectionTitle = "font-display text-xl text-ink";
const panel = "glass-strong rounded-2xl p-5";

// --- Progress ----------------------------------------------------------------

function Timeline({
  order,
  deliveryEstimate,
}: {
  order: OrderDetail;
  deliveryEstimate: string | null;
}) {
  const t = useTranslations("orders");
  const locale = useLocale() as Locale;
  const steps = buildTimeline(order);

  const textOf = (step: TimelineStep): string | null => {
    const { delivery, cancellation } = order;
    switch (step.key) {
      case "payment":
        if (step.state === "done") return t("timeline.paymentDone");
        if (step.state === "problem") return t("timeline.paymentFailed");
        if (step.state === "current") return t("timeline.paymentWaiting");
        return order.status === "cancelled" ? t("timeline.paymentNone") : null;
      case "confirmed":
        return step.state === "current" ? t("timeline.confirmedText") : null;
      case "processing":
        return step.state === "current" ? t("timeline.processingText") : null;
      case "dispatched":
        return step.state === "todo" ? null : t(`method.${delivery.method}`);
      case "delivered":
        return step.state === "todo" && deliveryEstimate
          ? `${t("estimated")}: ${deliveryEstimate}`
          : null;
      case "cancelled":
        if (!cancellation) return null;
        if (
          cancellation.reason === "sold_out" ||
          cancellation.reason === "payment_not_completed"
        ) {
          return t(`cancelledReason.${cancellation.reason}`);
        }
        return t(`cancelledBy.${cancellation.by}`);
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
                  step.state === "done" ? "bg-leaf-600" : "bg-ink/10",
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "z-10 grid size-7 place-items-center rounded-full",
                step.state === "done" && "leaf-gradient text-white",
                // The current step is the one with the halo.
                step.state === "current" &&
                  "leaf-gradient ring-leaf-600/20 shadow-leaf ring-4",
                step.state === "todo" && "border-ink/15 border-2 bg-white",
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

// --- Cancelling --------------------------------------------------------------

const CANCEL_REASONS: CustomerCancellationReason[] = [
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
  const [reason, setReason] =
    useState<CustomerCancellationReason>("changed_mind");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const paid = order.payment.paidAmount > 0;

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
        <p className="text-ink-muted">
          {paid ? t("introPaid") : t("introUnpaid")}
        </p>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-bold">{t("reason")}</legend>
          {CANCEL_REASONS.map((value) => (
            <label key={value} className="flex min-h-11 items-center gap-3">
              <input
                type="radio"
                name="cancel-reason"
                className="accent-leaf-600 size-5"
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
    <li className="border-ink/8 flex flex-col gap-2 border-b py-4 first:pt-0 last:border-b-0 last:pb-0">
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
          <li key={item.variantId}>
            {t("itemLine", {
              quantity: item.quantity,
              name: productTitle(item.name, item.packSize),
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
        <p className="ring-ink/6 rounded-xl bg-white/70 px-3.5 py-2.5 text-[0.9375rem] ring-1">
          <span className="font-bold">{t("answer")}:</span> {request.answer}
        </p>
      )}
      {request.creditAmount !== null && (
        <p className="text-leaf-700 font-bold">
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
 * is, the payment, the documents, returns, and the bill as agreed and as
 * it finally is. After the payment page, this is where the customer lands.
 */
export function OrderDetailView({
  orderNumber,
  paymentReturn,
  payAtOnce,
  deliveryEstimate,
}: {
  orderNumber: string;
  /** Set when the customer comes back from the payment page. */
  paymentReturn: PaymentReturn;
  /** `?pay=1`: open the payment page straight away. */
  payAtOnce: boolean;
  /** `delivery.estimate` of the settings in the page's language, or `null`. */
  deliveryEstimate: string | null;
}) {
  const t = useTranslations("orders");
  const tAccount = useTranslations("account");
  const locale = useLocale() as Locale;
  const orderQuery = useQuery({
    queryKey: orderQueryKey(orderNumber, locale),
    queryFn: async () => (await api.getOrder(orderNumber)).order,
    staleTime: 0,
  });
  const order = orderQuery.data;

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
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  return (
    <OrderBody
      order={order}
      paymentReturn={paymentReturn}
      payAtOnce={payAtOnce}
      deliveryEstimate={deliveryEstimate}
      refetch={() => void orderQuery.refetch()}
    />
  );
}

function OrderBody({
  order,
  paymentReturn,
  payAtOnce,
  deliveryEstimate,
  refetch,
}: {
  order: OrderDetail;
  paymentReturn: PaymentReturn;
  payAtOnce: boolean;
  deliveryEstimate: string | null;
  refetch: () => void;
}) {
  const t = useTranslations("orders");
  const tDocuments = useTranslations("documents");
  const tProduct = useTranslations("product");
  const tReturns = useTranslations("returns");
  const locale = useLocale() as Locale;
  const client = useQueryClient();
  const session = useSession();
  const [justCancelled, setJustCancelled] = useState(false);
  const { orderNumber } = order;

  const paymentState = usePaymentState(order, paymentReturn);
  const invoiced = Boolean(order.payment.invoice);
  const delivered = Boolean(order.delivery.deliveredAt);

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
          className="hover:text-ink text-ink-muted -ml-2 flex min-h-10 items-center gap-1 self-start rounded-full py-1 pr-3 pl-1.5 text-[0.9375rem] font-semibold transition-colors duration-200 hover:bg-white/60"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-ink text-3xl sm:text-4xl">
            {t("orderNumber", { orderNumber: order.orderNumber })}
          </h1>
          <OrderStatusChips
            status={paymentState.status}
            paymentStatus={paymentState.payment.status}
          />
        </div>
        <p className="text-ink-muted">
          {t("placedOn", { date: formatDate(order.placedAt, locale) })}
        </p>
      </header>

      <PaymentOutcome
        order={order}
        state={paymentState}
        paymentReturn={paymentReturn}
        payAtOnce={payAtOnce}
        email={session.customer?.email ?? null}
      />
      {justCancelled && <Alert tone="good">{t("cancel.done")}</Alert>}

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_22rem]">
        <section aria-labelledby="order-progress" className={panel}>
          <h2 id="order-progress" className={cn(sectionTitle, "mb-4")}>
            {t("timeline.title")}
          </h2>
          <Timeline order={order} deliveryEstimate={deliveryEstimate} />
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

        <PaymentPanel order={order} state={paymentState} />
      </div>

      <section aria-labelledby="order-items" className={panel}>
        <h2 id="order-items" className={cn(sectionTitle, "mb-2")}>
          {t("itemsTitle")}
        </h2>
        <ul className="divide-ink/8 divide-y">
          {order.items.map((item) => (
            <li key={item.variantId} className="flex gap-4 py-3.5">
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  width={64}
                  height={64}
                  loading="lazy"
                  className="ring-ink/6 size-16 shrink-0 rounded-lg bg-white object-contain p-1 ring-1"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold">{formatProductName(item.name)}</p>
                <p className="text-ink-muted text-sm tabular-nums">
                  {formatPackSize(item.packSize)} · {item.quantity} ×{" "}
                  {formatMoney(item.unitPrice, locale)}
                  {/* A size that was reduced: the regular price next to it. */}
                  {item.regularUnitPrice !== null && (
                    <>
                      {" "}
                      <span className="sr-only">
                        {tProduct("regularPrice")}:
                      </span>
                      <s className="text-ink-subtle">
                        {formatMoney(item.regularUnitPrice, locale)}
                      </s>
                    </>
                  )}
                </p>
                {delivered && item.deliveredQuantity !== item.quantity && (
                  <p className="text-wheat-800 text-sm font-semibold">
                    {t("deliveredQuantity", {
                      delivered: item.deliveredQuantity,
                      ordered: item.quantity,
                    })}
                  </p>
                )}
                {item.returnedQuantity > 0 && (
                  <p className="text-wheat-800 text-sm font-semibold">
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
          <div className="ring-ink/6 mt-2 rounded-xl bg-white/70 px-3.5 py-3 text-sm ring-1">
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
            savings={orderSavingsOf(order.items, changed)}
            discountCode={order.discount?.code ?? null}
          />
          {changed && (
            <p className="text-ink-muted border-ink/8 mt-3 flex justify-between gap-4 border-t pt-3 text-sm tabular-nums">
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
        <section
          id="order-documents"
          aria-labelledby="order-documents-title"
          className={cn(panel, "scroll-mt-28")}
        >
          <h2 id="order-documents-title" className={cn(sectionTitle, "mb-1")}>
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
                    refetch();
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

      {order.canCancel && paymentState.status !== "cancelled" && (
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
              void client.invalidateQueries({
                queryKey: ["order-payment", orderNumber.toUpperCase()],
              });
              setJustCancelled(true);
            }}
          />
        </div>
      )}
    </div>
  );
}
