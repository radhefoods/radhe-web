import { PackageCheck, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ShopSettings } from "@/lib/api/types";
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
    <li className="flex gap-3.5 py-3.5 first:pt-0 last:pb-0">
      <span
        aria-hidden="true"
        className="bg-leaf-50 text-leaf-700 grid size-10 shrink-0 place-items-center rounded-full"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 pt-1.5">
        <p className="leading-snug font-semibold">{title}</p>
        {children}
      </div>
    </li>
  );
}

/**
 * Delivery and payment at the point of decision (owner, 2026-10-19): under
 * the buy box of the product page, four short rows with an icon each.
 * Where the shop delivers and how long it takes, what delivery costs and
 * from which order value it is free, that the customer pays securely at
 * checkout with the four accepted methods as marks, and how many days
 * there are to return. Every number comes from `GET /v1/store/settings`;
 * a missing one leaves its row or line out, and nothing here is promised
 * that the API does not say. The link leads to the full page.
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
  const icon = "size-5";
  const note = "text-ink-muted mt-0.5 text-sm";

  return (
    <section
      aria-labelledby="purchase-info"
      className={`border-line rounded-xl border bg-white p-5 sm:p-6 ${className ?? ""}`}
    >
      <h2
        id="purchase-info"
        className="text-ink-subtle text-xs font-bold tracking-[0.1em] uppercase"
      >
        {t("title")}
      </h2>
      <ul className="divide-line mt-4 divide-y">
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
        <Row icon={<ShieldCheck className={icon} />} title={tHome("trustPay")}>
          <p className={note}>{t("paymentText")}</p>
          <PaymentMarks label={t("paymentMethods")} className="mt-3" />
        </Row>
        {returnDays > 0 && (
          <Row
            icon={<RotateCcw className={icon} />}
            title={t("returns", { count: returnDays })}
          >
            <p className={note}>{t("returnsText")}</p>
          </Row>
        )}
      </ul>
      <Link
        href="/delivery-and-payment"
        className="text-leaf-700 mt-4 inline-block rounded-xs text-sm font-semibold underline underline-offset-4"
      >
        {t("more")}
      </Link>
    </section>
  );
}
