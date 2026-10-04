"use client";

import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCart } from "@/features/cart/cart";
import { useBill } from "@/features/cart/use-bill";
import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/format/money";

/** Pages that have their own bar or their own summary. */
function hasOwnSummary(pathname: string): boolean {
  return (
    pathname === "/cart" ||
    pathname === "/sign-in" ||
    pathname.startsWith("/checkout") ||
    // The product page keeps its add-to-cart bar in this place.
    pathname === "/products/[slug]"
  );
}

/**
 * On phones: the cart in one line above the tab bar, as soon as something
 * is in it. Units and the total of the API, one tap to the cart.
 */
export function CartSummaryBar() {
  const t = useTranslations("cart");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const cart = useCart();
  const visible = cart.ready && cart.units > 0 && !hasOwnSummary(pathname);
  const { bill, updating } = useBill({ enabled: visible });

  if (!visible) return null;
  return (
    <aside aria-label={t("title")} className="md:hidden">
      <Link
        href="/cart"
        className="shadow-float fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex min-h-12 items-center justify-between gap-3 rounded-md bg-blue-600 px-4 text-[0.9375rem] font-bold text-white"
      >
        <span className="tabular-nums">
          {t("barItems", { count: cart.units })}
          {bill && !updating && (
            <> · {formatMoney(bill.totals.total, locale)}</>
          )}
        </span>
        <span className="flex items-center gap-1">
          {t("barView")}
          <ChevronRight aria-hidden="true" className="size-5" />
        </span>
      </Link>
    </aside>
  );
}
