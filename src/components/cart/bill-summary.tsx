import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { Bill, Totals } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney, formatPercent } from "@/lib/format/money";

/**
 * The bill in numbers: goods, delivery, the VAT inside the total per rate,
 * the total, and that nothing is due today. Every number comes from the
 * API; nothing is added up here.
 */
export function BillTotals({
  totals,
  showDueToday = true,
  className,
}: {
  totals: Totals;
  /** The line "Due today: 0.00". Off where it would mislead (a paid order). */
  showDueToday?: boolean;
  className?: string;
}) {
  const t = useTranslations("cart");
  const locale = useLocale() as Locale;
  const row = "flex items-baseline justify-between gap-4";
  return (
    <dl className={cn("flex flex-col gap-2 tabular-nums", className)}>
      <div className={row}>
        <dt>{t("subtotal")}</dt>
        <dd>{formatMoney(totals.subtotal, locale)}</dd>
      </div>
      <div className={row}>
        <dt>{t("delivery")}</dt>
        <dd
          className={cn(totals.deliveryFee === 0 && "font-bold text-teal-700")}
        >
          {totals.deliveryFee === 0
            ? t("deliveryFree")
            : formatMoney(totals.deliveryFee, locale)}
        </dd>
      </div>
      <div className={cn(row, "border-line mt-1 border-t pt-3")}>
        <dt className="flex flex-col">
          <span className="text-lg font-bold">{t("total")}</span>
          <span className="text-ink-muted text-sm">{t("totalNote")}</span>
        </dt>
        <dd className="text-xl font-bold">
          {formatMoney(totals.total, locale)}
        </dd>
      </div>
      {totals.vat.map((group) => (
        <div key={group.vatRate} className={cn(row, "text-ink-muted text-sm")}>
          <dt>
            {t("vatIncluded", {
              percent: formatPercent(group.vatRate / 100, locale),
            })}
          </dt>
          <dd>{formatMoney(group.vat, locale)}</dd>
        </div>
      ))}
      {showDueToday && (
        <div className={cn(row, "font-bold text-teal-700")}>
          <dt>{t("dueToday")}</dt>
          <dd>{formatMoney(0, locale)}</dd>
        </div>
      )}
    </dl>
  );
}

/**
 * How much is missing for free delivery, with a bar; or that it is reached.
 * Nothing when the shop has no free tier.
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
  return (
    <div className={cn("flex flex-col gap-1.5 text-sm", className)}>
      <p className={reached ? "font-bold text-teal-700" : "text-ink-muted"}>
        {reached
          ? t("freeReached")
          : t("freeMissing", { amount: formatMoney(missingForFree, locale) })}
      </p>
      <div
        className="bg-cloud h-2 overflow-hidden rounded-full"
        aria-hidden="true"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            reached ? "bg-teal-600" : "bg-gold-400",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
