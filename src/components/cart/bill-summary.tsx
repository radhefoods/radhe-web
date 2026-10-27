import { PackageCheck, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { Bill, Totals } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney, formatPercent } from "@/lib/format/money";

/**
 * The bill in numbers: goods, the discount code when one applies, delivery,
 * the total, and the VAT inside it per rate. Every number comes from the
 * API; nothing is added up here. The total is the one big number of the
 * panel (owner, 2026-10-19).
 */
export function BillTotals({
  totals,
  discountCode = null,
  className,
}: {
  totals: Totals;
  /** Names the discount row (doc 9.6); the row shows while `totals.discount` is above zero. */
  discountCode?: string | null;
  className?: string;
}) {
  const t = useTranslations("cart");
  const locale = useLocale() as Locale;
  const row = "flex items-baseline justify-between gap-4";
  return (
    <dl className={cn("flex flex-col gap-2.5 tabular-nums", className)}>
      <div className={row}>
        <dt className="text-ink-muted">{t("subtotal")}</dt>
        <dd className="font-semibold">
          {formatMoney(totals.subtotal, locale)}
        </dd>
      </div>
      {totals.discount > 0 && (
        <div className={row}>
          <dt className="text-ink-muted">
            {discountCode
              ? t("discountCode", { code: discountCode })
              : t("discount")}
          </dt>
          <dd className="text-leaf-700 font-semibold">
            −{formatMoney(totals.discount, locale)}
          </dd>
        </div>
      )}
      <div className={row}>
        <dt className="text-ink-muted">{t("delivery")}</dt>
        <dd
          className={cn(
            "font-semibold",
            totals.deliveryFee === 0 && "text-leaf-700 font-bold",
          )}
        >
          {totals.deliveryFee === 0
            ? t("deliveryFree")
            : formatMoney(totals.deliveryFee, locale)}
        </dd>
      </div>
      <div className={cn(row, "border-line mt-1 border-t pt-3.5")}>
        <dt className="flex flex-col">
          <span className="text-lg font-bold">{t("total")}</span>
          <span className="text-ink-muted text-sm">{t("totalNote")}</span>
        </dt>
        <dd className="font-display text-ink text-[1.75rem] leading-none">
          {formatMoney(totals.total, locale)}
        </dd>
      </div>
      {totals.vat.map((group) => (
        <div key={group.vatRate} className={cn(row, "text-ink-subtle text-sm")}>
          <dt>
            {t("vatIncluded", {
              percent: formatPercent(group.vatRate / 100, locale),
            })}
          </dt>
          <dd>{formatMoney(group.vat, locale)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * How much is missing for free delivery, with a bar; or that it is reached.
 * A wheat panel with the amount in bold and a dark leaf bar on a white
 * track, the order value and the free-delivery threshold under its ends
 * (owner, 2026-10-19: clearer and darker). Nothing when the shop has no
 * free tier.
 */
export function FreeDeliveryProgress({
  delivery,
  subtotal,
  className,
}: {
  delivery: Bill["delivery"];
  subtotal: number;
  className?: string;
}) {
  const t = useTranslations("cart");
  const locale = useLocale() as Locale;
  const { freeFrom, missingForFree } = delivery;
  if (freeFrom === null || missingForFree === null || freeFrom <= 0)
    return null;
  const reached = missingForFree === 0;
  // Only how full the bar is; no amount is derived from this.
  const percent = Math.min(100, Math.round((subtotal / freeFrom) * 100));
  const Icon = reached ? PackageCheck : Truck;
  return (
    <div
      className={cn(
        "rounded-lg p-4",
        reached ? "bg-leaf-50" : "bg-wheat-100",
        className,
      )}
    >
      <p
        className={cn(
          "flex items-start gap-2.5 text-[0.9375rem] leading-snug font-semibold",
          reached ? "text-leaf-700" : "text-ink",
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn("mt-0.5 size-5 shrink-0", !reached && "text-wheat-800")}
        />
        <span>
          {reached
            ? t("freeReached")
            : t.rich("freeMissing", {
                amount: formatMoney(missingForFree, locale),
                strong: (chunks) => (
                  <strong className="font-display text-[1.0625rem]">
                    {chunks}
                  </strong>
                ),
              })}
        </span>
      </p>
      <div
        className="ring-ink/10 mt-3 h-3 overflow-hidden rounded-full bg-white ring-1 ring-inset"
        aria-hidden="true"
      >
        <div
          className="bg-leaf-600 h-full rounded-full transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p
        aria-hidden="true"
        className="text-ink-muted mt-1.5 flex justify-between text-xs font-semibold tabular-nums"
      >
        <span>{formatMoney(subtotal, locale)}</span>
        <span>
          {t("freeFromLabel", { amount: formatMoney(freeFrom, locale) })}
        </span>
      </p>
    </div>
  );
}
