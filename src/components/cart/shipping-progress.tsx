import { PackageCheck, TicketPercent, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  shippingMessageOf,
  shippingProgressOf,
} from "@/features/cart/shipping";
import type { Locale } from "@/i18n/routing";
import type { BillShipping } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format/money";

/**
 * The free-delivery progress of a cart whose delivery is priced by the box
 * (doc/BOX_BASED_SHIPPING_WEB_INTEGRATION.md, 5): one sentence and one bar
 * that runs to the next free box. It wears the panel of the flat fee's
 * hint (`FreeDeliveryProgress`), wheat while something is to be paid and
 * leaf once nothing is, so the cart looks the same under either rule.
 *
 * Every number is the API's (`bill.shipping`); only the length of the bar
 * is worked out here, by the document's formula. Nothing while there is
 * nothing to deliver.
 */
export function ShippingProgress({
  shipping,
  code,
  className,
}: {
  shipping: BillShipping;
  /** The free-delivery code of the bill, to name it; `null` without one. */
  code: string | null;
  className?: string;
}) {
  const t = useTranslations("shipping");
  const locale = useLocale() as Locale;
  const message = shippingMessageOf(shipping, code);
  if (message.kind === "none") return null;

  const money = (cents: number) => formatMoney(cents, locale);
  const strong = (chunks: ReactNode) => (
    <strong className="font-display text-[1.0625rem]">{chunks}</strong>
  );
  // Nothing left to pay for the delivery.
  const reached = message.kind === "free" || message.kind === "freeByCode";

  let headline: ReactNode;
  /** Says how the boxes of the order come about, under the headline. */
  let note: string | null = null;
  switch (message.kind) {
    case "freeByCode":
      headline =
        message.saving > 0
          ? t("freeByCode", {
              code: message.code,
              amount: money(message.saving),
            })
          : t("freeByCodeOnly", { code: message.code });
      break;
    case "free":
      headline =
        message.boxes > 1
          ? t("freeAll", { count: message.boxes })
          : t("freeOne");
      break;
    case "noThreshold":
      headline = t("noThreshold", {
        count: message.paidBoxes,
        fee: money(message.fee),
        perBox: money(message.feePerPaidBox),
      });
      break;
    case "oneBox":
      headline = t.rich("oneBox", { amount: money(message.missing), strong });
      break;
    case "noneFree":
      headline = t.rich("noneFree", { amount: money(message.missing), strong });
      note = t("noneFreeNote", {
        count: message.boxes,
        perBox: money(message.feePerPaidBox),
      });
      break;
    case "someFree":
      headline = t.rich("someFree", {
        amount: money(message.missing),
        number: message.nextBox,
        strong,
      });
      note = t("someFreeNote", {
        count: message.boxes,
        free: message.freeBoxes,
        paid: message.paidBoxes,
        perBox: money(message.feePerPaidBox),
      });
      break;
  }

  const progress = shippingProgressOf(shipping);
  const threshold = shipping.freeThresholdPerBox;
  const Icon =
    message.kind === "freeByCode"
      ? TicketPercent
      : reached
        ? PackageCheck
        : Truck;
  return (
    <div
      className={cn(
        "rounded-xl p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.7)] ring-1",
        reached
          ? "bg-leaf-50/90 ring-leaf-600/12"
          : "bg-wheat-100/90 ring-wheat-800/12",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon
          aria-hidden="true"
          className={cn(
            "mt-0.5 size-5 shrink-0",
            reached ? "text-leaf-700" : "text-wheat-800",
          )}
        />
        <div className="min-w-0">
          <p
            className={cn(
              "text-[0.9375rem] leading-snug font-semibold",
              reached ? "text-leaf-700" : "text-ink",
            )}
          >
            {headline}
          </p>
          {note && (
            <p className="text-ink-muted mt-1 text-sm leading-snug">{note}</p>
          )}
        </div>
      </div>
      {progress !== null && (
        <>
          <div
            className="ring-ink/8 mt-3 h-3 overflow-hidden rounded-full bg-white ring-1 ring-inset"
            aria-hidden="true"
          >
            <div
              className="leaf-gradient ease-glass h-full rounded-full shadow-[0_0_8px_rgb(21_122_75/0.35)] transition-[width] duration-500"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          {/* The goods the rules looked at, and what one free box takes. A
              code that frees the delivery has nothing to do with either. */}
          {threshold !== null && message.kind !== "freeByCode" && (
            <p
              aria-hidden="true"
              className="text-ink-muted mt-1.5 flex justify-between gap-3 text-xs font-semibold tabular-nums"
            >
              <span>{money(shipping.orderValue)}</span>
              <span>{t("perFreeBox", { amount: money(threshold) })}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
