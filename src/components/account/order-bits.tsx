"use client";

import { Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ErrorAlert } from "@/components/ui/error-alert";
import {
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_TONE,
} from "@/features/orders/orders";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { session } from "@/lib/api/browser";
import { invoicePdfPath } from "@/lib/api/store-api";
import type {
  InvoiceSummary,
  OrderAddress,
  OrderStatus,
  OrderSummary,
  PaymentStatus,
} from "@/lib/api/types";
import { formatDate, formatDayRange } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";

// Small parts the account pages share.

export function OrderStatusChips({
  status,
  paymentStatus,
}: {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
}) {
  const t = useTranslations("orders");
  return (
    <span className="flex flex-wrap gap-1.5">
      <Chip tone={ORDER_STATUS_TONE[status]}>{t(`status.${status}`)}</Chip>
      {/* A cancelled order has nothing to pay: one chip says it all. */}
      {status !== "cancelled" && (
        <Chip tone={PAYMENT_STATUS_TONE[paymentStatus]}>
          {t(`paymentStatus.${paymentStatus}`)}
        </Chip>
      )}
    </span>
  );
}

/** An address as stored (optional fields `null`) or as on an order (absent). */
type AddressLike = Pick<
  OrderAddress,
  "firstName" | "lastName" | "street" | "houseNumber" | "postalCode" | "city"
> & {
  company?: string | null;
  additionalLine?: string | null;
  phone?: string | null;
};

export function AddressBlock({ address }: { address: AddressLike }) {
  return (
    <address className="flex flex-col not-italic">
      <span className="font-bold">
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
      {address.phone && <span>{address.phone}</span>}
    </address>
  );
}

/**
 * An order in a list: number, date, statuses, a few pictures, the total.
 * @param heading the level that follows the headline above the list
 */
export function OrderCard({
  order,
  heading: Heading = "h3",
}: {
  order: OrderSummary;
  heading?: "h2" | "h3";
}) {
  const t = useTranslations("orders");
  const locale = useLocale() as Locale;
  return (
    <article className="border-line hover:shadow-card relative flex flex-col gap-3 rounded-lg border bg-white p-4 transition-shadow sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <Heading className="text-lg font-bold">
            <Link
              href={{
                pathname: "/account/orders/[orderNumber]",
                params: { orderNumber: order.orderNumber },
              }}
              aria-label={t("viewNamed", { orderNumber: order.orderNumber })}
              // The whole card is the link.
              className="rounded-xs after:absolute after:inset-0"
            >
              {t("orderNumber", { orderNumber: order.orderNumber })}
            </Link>
          </Heading>
          <p className="text-ink-muted text-sm">
            {t("placedOn", { date: formatDate(order.placedAt, locale) })}
          </p>
        </div>
        <OrderStatusChips
          status={order.status}
          paymentStatus={order.paymentStatus}
        />
      </header>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <ul className="flex -space-x-2" aria-hidden="true">
            {order.preview.map(
              (item, index) =>
                item.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={index}
                    src={item.imageUrl}
                    alt=""
                    width={44}
                    height={44}
                    loading="lazy"
                    className="bg-mist size-11 rounded-sm border-2 border-white object-cover"
                  />
                ),
            )}
          </ul>
          <p className="text-ink-muted text-sm">
            {t("itemCount", { count: order.itemCount })}
            {order.status !== "cancelled" && !order.delivery.deliveredAt && (
              <>
                {" · "}
                {t("estimated")}{" "}
                {formatDayRange(
                  order.delivery.promisedStart,
                  order.delivery.promisedEnd,
                  locale,
                )}
              </>
            )}
          </p>
        </div>
        <p className="text-lg font-bold tabular-nums">
          {formatMoney(order.finalTotal, locale)}
        </p>
      </div>
    </article>
  );
}

/** Fetches the PDF with the session and hands it to the browser as a file. */
async function downloadPdf(number: string): Promise<void> {
  const response = await session.raw(invoicePdfPath(number));
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `${number}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** An invoice or a credit note in a list, with its PDF. */
export function DocumentRow({
  document: entry,
  showOrder = false,
}: {
  document: InvoiceSummary;
  /** Name the order, where documents of several orders are listed. */
  showOrder?: boolean;
}) {
  const t = useTranslations("documents");
  const locale = useLocale() as Locale;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const credit = entry.type === "credit_note";

  return (
    <li className="border-line flex flex-col gap-2 border-b py-3.5 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-bold">
            {t(entry.type)} {entry.number}
          </p>
          <p className="text-ink-muted text-sm">
            {t("issuedOn", { date: formatDate(entry.issuedAt, locale) })}
            {credit && entry.invoiceNumber && (
              <> · {t("forInvoice", { number: entry.invoiceNumber })}</>
            )}
            {credit && entry.creditReason && (
              <> · {t(`creditReason.${entry.creditReason}`)}</>
            )}
            {showOrder && (
              <>
                {" · "}
                <Link
                  href={{
                    pathname: "/account/orders/[orderNumber]",
                    params: { orderNumber: entry.orderNumber },
                  }}
                  className="rounded-xs font-semibold text-blue-700 underline underline-offset-4"
                >
                  {t("order", { orderNumber: entry.orderNumber })}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <p className="font-bold tabular-nums">
            {formatMoney(credit ? -entry.total : entry.total, locale)}
          </p>
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            aria-label={t("downloadNamed", { number: entry.number })}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await downloadPdf(entry.number);
              } catch (caught) {
                setError(caught);
              } finally {
                setBusy(false);
              }
            }}
          >
            {!busy && <Download aria-hidden="true" className="size-4" />}
            {t("download")}
          </Button>
        </div>
      </div>
      {error !== null && <ErrorAlert error={error} />}
    </li>
  );
}
