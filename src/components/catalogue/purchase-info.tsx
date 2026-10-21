import { PackageCheck, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ShopSettings } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format/money";
import { PaymentMarks } from "./payment-marks";

function Row({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="bg-leaf-50 text-leaf-700 grid size-8 shrink-0 place-items-center rounded-full"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-[0.9375rem] leading-snug font-semibold">{title}</p>
        {children}
      </div>
    </li>
  );
}

/**
 * Delivery and payment at the point of decision (owner, 2026-10-19), as a
 * compact block under the buy box since 2026-10-21: four short rows with
 * a small icon each, two abreast where there is room. Where the shop
 * delivers and how long it takes, what delivery costs and from which
 * order value it is free, that the customer pays securely at checkout
 * with the four accepted methods as marks, and how many days there are to
 * return. Every number comes from `GET /v1/store/settings`; a missing one
 * leaves its row or line out, and nothing here is promised that the API
 * does not say. The link leads to the full page.
 */
export async function PurchaseInfo({
  settings,
  locale,
  className,
}: {
  settings: ShopSettings | null;
  locale: Locale;
  className?: string;
}) {
  const [t, tHome] = await Promise.all([
    getTranslations("product.info"),
    getTranslations("home"),
  ]);
  const estimate = settings?.delivery.estimate[locale] ?? null;
  const tiers = settings?.deliveryFee.tiers ?? [];
  // The fee of the lowest tier: what an order pays until a cheaper tier.
  const fee =
    tiers.find((tier) => tier.minOrderValue === 0)?.fee ??
    tiers[0]?.fee ??
    null;
  const freeFrom = settings?.deliveryFee.freeFrom ?? null;
  const returnDays = settings?.returns.windowDays ?? 0;
  const icon = "size-4";
  const note = "text-ink-muted mt-0.5 text-sm";

  return (
    <section
      aria-labelledby="purchase-info"
      className={cn("bg-mist rounded-xl p-4 sm:p-5", className)}
    >
      <h2 id="purchase-info" className="sr-only">
        {t("title")}
      </h2>
      <ul className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
        <Row icon={<Truck className={icon} />} title={tHome("trustDelivery")}>
          {estimate && <p className={note}>{estimate}</p>}
        </Row>
        {fee !== null && (
          <Row
            icon={<PackageCheck className={icon} />}
            title={
              fee === 0
                ? t("feeFree")
                : t("fee", { fee: formatMoney(fee, locale) })
            }
          >
            {fee !== 0 && freeFrom !== null && (
              <p className={note}>
                {t("freeFrom", { amount: formatMoney(freeFrom, locale) })}
              </p>
            )}
          </Row>
        )}
        {returnDays > 0 && (
          <Row
            icon={<RotateCcw className={icon} />}
            title={t("returns", { count: returnDays })}
          >
            <p className={note}>{t("returnsText")}</p>
          </Row>
        )}
        <Row icon={<ShieldCheck className={icon} />} title={tHome("trustPay")}>
          <p className={note}>{t("paymentText")}</p>
        </Row>
      </ul>
      <div className="border-line-strong/60 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed pt-4">
        <PaymentMarks label={t("paymentMethods")} />
        <Link
          href="/delivery-and-payment"
          className="text-leaf-700 rounded-xs text-sm font-semibold underline underline-offset-4"
        >
          {t("more")}
        </Link>
      </div>
    </section>
  );
}
