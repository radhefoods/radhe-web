import { PackageCheck, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { Bill, BillShipping, Cents, Totals } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format/money";

/**
 * The bill in numbers (owner, 2026-10-28): the goods at their regular
 * prices, what the sale prices take off ("Discount"), what the discount
 * code takes off (named by the code, doc 9.6), what the redeemed coins
 * take off (named by their count, REWARDS 8), the delivery, and the
 * total with "Tax included." under it; no VAT lines. The total, the
 * delivery, the code's and the coins' amounts are the API's; the saving is the
 * caller's sum of the regular prices over the paid ones (`savings.ts`),
 * added to the subtotal and taken off again, so nothing is counted twice.
 * The total is the one big number of the panel (owner, 2026-10-19).
 *
 * Delivery by the box (doc/BOX_BASED_SHIPPING_WEB_INTEGRATION.md 7 and 9,
 * 2026-11-20): an order of several boxes says under the delivery how many
 * of them are free ("2 boxes: 1 free, 1 paid"), and a free-delivery code
 * is named there, with what the delivery would have cost struck through;
 * such a code takes nothing off the goods and has no row of its own.
 * Without `boxes` and without such a code the row is the one of before.
 */
export function BillTotals({
  totals,
  savings = 0,
  discountCode = null,
  coins = null,
  boxes = null,
  freeDeliveryCode = null,
  regularDeliveryFee = 0,
  className,
}: {
  totals: Totals;
  /** What the sale prices save; the subtotal shows the regular prices. */
  savings?: number;
  /** Names the code's row; the row shows while `totals.discount` is above zero. */
  discountCode?: string | null;
  /** Names the coins' row; the row shows while `totals.rewards` is above zero. */
  coins?: number | null;
  /** The boxes of the bill (`bill.shipping`); `null` under the flat fee. */
  boxes?: Pick<
    BillShipping,
    "requiredBoxes" | "freeBoxes" | "paidBoxes" | "feePerPaidBox"
  > | null;
  /** The applied code that makes the delivery free, to name it. */
  freeDeliveryCode?: string | null;
  /** With that code: what the delivery would have cost; `0` when not known. */
  regularDeliveryFee?: Cents;
  className?: string;
}) {
  const t = useTranslations("cart");
  const locale = useLocale() as Locale;
  const row = "flex items-baseline justify-between gap-4";
  const saving = "text-leaf-700 font-semibold";
  // Free with a code: the code is named, and the fee it saves is shown.
  const byCode = freeDeliveryCode !== null && totals.deliveryFee === 0;
  const count = boxes?.requiredBoxes ?? 0;
  const deliveryNote = byCode
    ? count > 1
      ? t("shipping.summaryWithCode", { count, code: freeDeliveryCode })
      : t("shipping.withCode", { code: freeDeliveryCode })
    : boxes === null || count < 2
      ? null
      : boxes.paidBoxes === 0
        ? t("shipping.summaryAllFree", { count })
        : boxes.freeBoxes === 0
          ? t("shipping.summaryNoneFree", {
              count,
              perBox: formatMoney(boxes.feePerPaidBox, locale),
            })
          : t("shipping.summary", {
              count,
              free: boxes.freeBoxes,
              paid: boxes.paidBoxes,
            });
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
      {(totals.rewards ?? 0) > 0 && (
        <div className={row}>
          <dt className="text-ink-muted">
            {t("coinsRedeemed", { coins: coins ?? 0 })}
          </dt>
          <dd className={saving}>
            −{formatMoney(totals.rewards ?? 0, locale)}
          </dd>
        </div>
      )}
      <div className={cn(row, deliveryNote && "flex-wrap gap-y-0.5")}>
        <dt className="text-ink-muted">{t("delivery")}</dt>
        <dd
          className={cn(
            "font-semibold",
            totals.deliveryFee === 0 && "text-leaf-700 font-bold",
          )}
        >
          {byCode && regularDeliveryFee > 0 && (
            <>
              <span className="sr-only">{t("shipping.regularFee")}: </span>
              <s className="text-ink-subtle font-normal">
                {formatMoney(regularDeliveryFee, locale)}
              </s>{" "}
            </>
          )}
          {totals.deliveryFee === 0
            ? t("deliveryFree")
            : formatMoney(totals.deliveryFee, locale)}
        </dd>
        {deliveryNote && (
          <dd className="text-ink-muted basis-full text-sm">{deliveryNote}</dd>
        )}
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
  // Only how full the bar is; no amount is derived from this. Reached is
  // full, also where a free-delivery code reached it and not the goods.
  const percent = reached
    ? 100
    : Math.min(100, Math.round((subtotal / freeFrom) * 100));
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
