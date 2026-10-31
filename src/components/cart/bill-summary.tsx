import { PackageCheck, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { Bill, Totals } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format/money";

/**
 * The bill in numbers (owner, 2026-10-28): the goods at their regular
 * prices, what the sale prices take off ("Discount"), what the discount
 * code takes off (named by the code, doc 9.6), the delivery, and the
 * total with "Tax included." under it; no VAT lines. The total, the
 * delivery and the code's amount are the API's; the saving is the
 * caller's sum of the regular prices over the paid ones (`savings.ts`),
 * added to the subtotal and taken off again, so nothing is counted twice.
 * The total is the one big number of the panel (owner, 2026-10-19).
 */
export function BillTotals({
  totals,
  savings = 0,
  discountCode = null,
  className,
}: {
  totals: Totals;
  /** What the sale prices save; the subtotal shows the regular prices. */
  savings?: number;
  /** Names the code's row; the row shows while `totals.discount` is above zero. */
  discountCode?: string | null;
  className?: string;
}) {
  const t = useTranslations("cart");
  const locale = useLocale() as Locale;
  const row = "flex items-baseline justify-between gap-4";
  const saving = "text-leaf-700 font-semibold";
  return (
    <dl className={cn("flex flex-col gap-2.5 tabular-nums", className)}>
      <div className={row}>
        <dt className="text-ink-muted">{t("subtotal")}</dt>
        <dd className="font-semibold">
          {formatMoney(totals.subtotal + savings, locale)}
        </dd>
      </div>
      {savings > 0 && (
        <div className={row}>
          <dt className="text-ink-muted">{t("discount")}</dt>
          <dd className={saving}>−{formatMoney(savings, locale)}</dd>
        </div>
      )}
      {totals.discount > 0 && (
        <div className={row}>
          <dt className="text-ink-muted">
            {t("discountCode", { code: discountCode ?? "" })}
          </dt>
          <dd className={saving}>−{formatMoney(totals.discount, locale)}</dd>
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
      <div className={cn(row, "border-ink/8 mt-1 border-t pt-3.5")}>
        <dt className="flex flex-col">
          <span className="text-lg font-bold">{t("total")}</span>
          <span className="text-ink-muted text-sm">{t("totalNote")}</span>
        </dt>
        <dd className="font-display text-ink text-[1.75rem] leading-none">
          {formatMoney(totals.total, locale)}
        </dd>
      </div>
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
        "rounded-xl p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.7)] ring-1",
        reached
          ? "bg-leaf-50/90 ring-leaf-600/12"
          : "bg-wheat-100/90 ring-wheat-800/12",
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
        className="ring-ink/8 mt-3 h-3 overflow-hidden rounded-full bg-white ring-1 ring-inset"
        aria-hidden="true"
      >
        <div
          className="leaf-gradient ease-glass h-full rounded-full shadow-[0_0_8px_rgb(21_122_75/0.35)] transition-[width] duration-500"
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
