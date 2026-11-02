import { ArrowRight, ShieldCheck, Truck } from "lucide-react";
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
  text,
  children,
}: {
  icon: ReactNode;
  title: string;
  text?: string | null;
  children?: ReactNode;
}) {
  return (
    <li className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
      <span
        aria-hidden="true"
        className="bg-leaf-50 text-leaf-700 ring-leaf-600/10 grid size-11 shrink-0 place-items-center rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.8)] ring-1"
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
        <p className="text-ink text-[0.9375rem] leading-snug font-semibold">
          {title}
        </p>
        {text && <p className="text-ink-muted text-sm leading-snug">{text}</p>}
        {children}
      </div>
    </li>
  );
}

/**
 * Delivery and payment at the point of decision (owner, 2026-10-19), since
 * 2026-11-02 one frosted container under the button with the two promises
 * one above the other (owner's brief of that day): free delivery across
 * Germany with the order value it is free from, and the secure payment at
 * checkout with the four accepted methods as marks; the way to the full
 * page as a slim row at its foot. (How long delivery takes stands under
 * the button with the stock, and the return policy on the full page, at
 * the owner's ask of 2026-10-22.) Every number comes from
 * `GET /v1/store/settings`: without a free-delivery threshold the row
 * falls back to "Delivery across Germany" with the fee per order, so
 * nothing is promised that the API does not say.
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
  const tiers = settings?.deliveryFee.tiers ?? [];
  // The fee of the lowest tier: what an order pays until a cheaper tier.
  const fee =
    tiers.find((tier) => tier.minOrderValue === 0)?.fee ??
    tiers[0]?.fee ??
    null;
  const freeFrom = settings?.deliveryFee.freeFrom ?? null;
  const free = freeFrom !== null || fee === 0;
  const deliveryTitle = free ? t("deliveryFree") : tHome("trustDelivery");
  const deliveryText =
    freeFrom !== null && freeFrom > 0
      ? t("freeFrom", { amount: formatMoney(freeFrom, locale) })
      : fee !== null && fee > 0
        ? t("fee", { fee: formatMoney(fee, locale) })
        : null;
  const icon = "size-5";

  return (
    <section
      aria-labelledby="purchase-info"
      className={cn("glass-strong rounded-3xl p-5 sm:p-6", className)}
    >
      <h2 id="purchase-info" className="sr-only">
        {t("title")}
      </h2>
      <ul className="divide-ink/8 divide-y">
        <Row
          icon={<Truck className={icon} />}
          title={deliveryTitle}
          text={deliveryText}
        />
        <Row
          icon={<ShieldCheck className={icon} />}
          title={tHome("trustPay")}
          text={t("paymentText")}
        >
          <PaymentMarks label={t("paymentMethods")} className="mt-2" />
        </Row>
      </ul>
      <Link
        href="/delivery-and-payment"
        className="border-ink/8 text-leaf-700 ease-glass hover:text-leaf-800 -mx-2 mt-4 flex items-center justify-between gap-3 rounded-2xl border-t px-2 pt-4 pb-1 text-[0.9375rem] leading-snug font-semibold transition-colors duration-200"
      >
        <span className="min-w-0">{t("more")}</span>
        <span
          aria-hidden="true"
          className="bg-leaf-50 text-leaf-700 grid size-9 shrink-0 place-items-center rounded-full"
        >
          <ArrowRight className="size-[18px]" />
        </span>
      </Link>
    </section>
  );
}
