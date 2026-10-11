"use client";

import { ShoppingBag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCart } from "@/features/cart/cart";
import { useBill } from "@/features/cart/use-bill";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format/money";

/** A small number on the cart icon. Nothing while the cart is empty. */
export function CartBadge({ className }: { className?: string }) {
  const { units, ready } = useCart();
  if (!ready || units === 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute -top-1 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-blue-600 px-1 text-[0.6875rem] leading-none font-bold text-white tabular-nums",
        className,
      )}
    >
      {units > 99 ? "99+" : units}
    </span>
  );
}

/**
 * The cart in the header: a blue button with the icon, the number of
 * units, and on wide screens the total of the cart, as the stores people
 * know show it. The spoken label carries the count.
 */
export function CartLink({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const { units, ready } = useCart();
  const count = ready ? units : 0;
  const { bill, updating } = useBill({ enabled: count > 0 });
  const total =
    count > 0 && bill && !updating
      ? formatMoney(bill.totals.total, locale)
      : t("items", { count });

  return (
    <Link
      href="/cart"
      aria-label={t("cartWithCount", { count })}
      className={cn(
        "min-h-11 items-center gap-2.5 rounded-md bg-blue-600 px-3 text-white transition-colors duration-150 hover:bg-blue-700 lg:px-3.5",
        className,
      )}
    >
      <span className="relative">
        <ShoppingBag aria-hidden="true" className="size-5" />
        <CartBadge className="bg-saffron-400 -top-2 -right-2.5 text-blue-900 ring-2 ring-blue-600" />
      </span>
      <span className="hidden flex-col text-left leading-tight lg:flex">
        <span className="text-sm font-bold">{t("cart")}</span>
        <span className="text-xs font-medium text-blue-100 tabular-nums">
          {total}
        </span>
      </span>
    </Link>
  );
}
