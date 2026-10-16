"use client";

import { ShoppingBag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCart } from "@/features/cart/cart";
import { useBill } from "@/features/cart/use-bill";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format/money";

/** A small wheat number on the cart icon. Nothing while the cart is empty. */
export function CartBadge({ className }: { className?: string }) {
  const { units, ready } = useCart();
  if (!ready || units === 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "text-ink bg-wheat-400 absolute -top-1 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[0.6875rem] leading-none font-bold tabular-nums ring-2 ring-white",
        className,
      )}
    >
      {units > 99 ? "99+" : units}
    </span>
  );
}

/**
 * The cart in the header: a leaf pill with the icon, on wide screens the
 * total of the cart, and the number of units in a wheat bubble at its end,
 * as the stores people know show it. The spoken label carries the count.
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
      data-cart-target=""

      className={cn(
        "bg-leaf-600 hover:bg-leaf-700 min-h-12 items-center gap-3 rounded-full py-1 pr-1.5 pl-4 text-white transition-colors duration-150",
        className,
      )}
    >
      <ShoppingBag aria-hidden="true" className="size-5" />
      <span className="hidden flex-col text-left leading-tight lg:flex">
        <span className="text-sm font-bold">{t("cart")}</span>
        <span className="text-leaf-50 text-xs font-medium tabular-nums">
          {total}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="text-ink bg-wheat-400 grid h-9 min-w-9 place-items-center rounded-full px-2 text-sm font-bold tabular-nums"
      >
        {count > 99 ? "99+" : count}
      </span>
    </Link>
  );
}
