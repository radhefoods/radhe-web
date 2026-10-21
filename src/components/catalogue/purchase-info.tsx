import { ArrowRight, RotateCcw, ShieldCheck, Truck } from "lucide-react";
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
    <li className="flex gap-3.5 py-4">
      <span aria-hidden="true" className="text-leaf-700 mt-0.5 shrink-0">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[0.9375rem] leading-snug font-semibold">{title}</p>
        {children}
      </div>
    </li>
  );
}

/**
 * Delivery, returns and payment at the point of decision (owner,
 * 2026-10-19), set since 2026-10-22 the way the leading grocers set their
 * trust lines: three flat rows between hairlines under the button, no
 * panel, a small leaf icon each. Where the shop delivers, how long it
 * takes, what it costs and from which order value it is free; how many
 * days there are to return and how; that the customer pays securely at
 * checkout, with the four accepted methods as marks. Every number comes
 * from `GET /v1/store/settings`; a missing one leaves its line out, and
 * nothing here is promised that the API does not say. The link leads to
 * the full page.
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
  const note = "text-ink-muted text-sm leading-snug";

  return (
    <section
      aria-labelledby="purchase-info"
      className={cn("border-line border-t", className)}
    >
      <h2 id="purchase-info" className="sr-only">
        {t("title")}
      </h2>
      <ul className="divide-line divide-y">
        <Row icon={<Truck className={icon} />} title={tHome("trustDelivery")}>
          {estimate && <p className={note}>{estimate}</p>}
          {fee !== null && (
            <p className={note}>
              {fee === 0
                ? t("feeFree")
                : t("fee", { fee: formatMoney(fee, locale) })}
              {fee !== 0 && freeFrom !== null && (
                <>
                  {" · "}
                  {t("freeFrom", { amount: formatMoney(freeFrom, locale) })}
                </>
              )}
            </p>
          )}
        </Row>
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
          <PaymentMarks label={t("paymentMethods")} className="mt-1.5" />
        </Row>
      </ul>
      <p className="border-line border-t pt-3.5 text-sm">
        <Link
          href="/delivery-and-payment"
          className="text-leaf-700 hover:text-leaf-800 inline-flex items-center gap-1 rounded-xs font-semibold"
        >
          {t("more")}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </p>
    </section>
  );
}
