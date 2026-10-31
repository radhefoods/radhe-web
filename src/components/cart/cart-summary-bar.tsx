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
 * On phones: the cart in one slim line above the tab bar, as soon as
 * something is in it (owner, 2026-10-28: slimmer, so that it covers less
 * of the products). Units and the total of the API, one tap to the cart.
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
        className="leaf-gradient fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex min-h-11 items-center justify-between gap-3 rounded-full py-1 pr-3.5 pl-4 text-sm font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_10px_24px_-8px_rgb(21_122_75/0.6)] active:scale-[0.98]"
      >
        <span className="tabular-nums">
          {t("barItems", { count: cart.units })}
          {bill && !updating && (
            <> · {formatMoney(bill.totals.total, locale)}</>
          )}
        </span>
        <span className="flex items-center gap-0.5">
          {t("barView")}
          <ChevronRight aria-hidden="true" className="size-4" />
        </span>
      </Link>
    </aside>
  );
}
