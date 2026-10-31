import { ArrowRight, ShieldCheck, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ShopSettings } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format/money";
import { PaymentMarks } from "./payment-marks";

function Tile({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <li className="glass-soft flex flex-col gap-2.5 rounded-2xl p-4">
      <span
        aria-hidden="true"
        className="bg-leaf-50 text-leaf-700 grid size-9 shrink-0 place-items-center rounded-full"
      >
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
 * Delivery and payment at the point of decision (owner, 2026-10-19), set
 * since 2026-10-31 after the owner's layout reference as a row of small
 * glass tiles under the button, a leaf icon on each: where the shop
 * delivers, what it costs and from which order value it is free; that the
 * customer pays securely at checkout, with the four accepted methods as
 * marks; and the way to the full page as a slim row under the two. (How long
 * delivery takes stands under the button with the stock, and the return
 * policy on the full page, at the owner's ask of 2026-10-22.) Every
 * number comes from `GET /v1/store/settings`; a missing one leaves its
 * line out, and nothing here is promised that the API does not say.
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
  const icon = "size-[18px]";
  const note = "text-ink-muted text-sm leading-snug";

  return (
    <section aria-labelledby="purchase-info" className={className}>
      <h2 id="purchase-info" className="sr-only">
        {t("title")}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        <Tile icon={<Truck className={icon} />} title={tHome("trustDelivery")}>
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
        </Tile>
        <Tile icon={<ShieldCheck className={icon} />} title={tHome("trustPay")}>
          <p className={note}>{t("paymentText")}</p>
          <PaymentMarks label={t("paymentMethods")} className="mt-1.5" />
        </Tile>
        <li className="flex sm:col-span-2">
          <Link
            href="/delivery-and-payment"
            className={cn(
              "glass-soft ease-glass hover:shadow-lift flex w-full items-center gap-3 rounded-2xl px-4 py-3 transition-[background-color,box-shadow,transform] duration-200 hover:bg-white/85 active:scale-[0.99]",
            )}
          >
            <span className="text-leaf-700 min-w-0 flex-1 text-[0.9375rem] leading-snug font-semibold">
              {t("more")}
            </span>
            <span
              aria-hidden="true"
              className="bg-leaf-50 text-leaf-700 grid size-9 shrink-0 place-items-center rounded-full"
            >
              <ArrowRight className={icon} />
            </span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
