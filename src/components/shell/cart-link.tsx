"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tooltip } from "@/components/ui/tooltip";
import { useCart } from "@/features/cart/cart";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { iconControl } from "./icon-control";

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
 * The cart in the header: the icon alone with the number of units in a
 * wheat bubble at its corner, as on the tab bar. The spoken label carries
 * the count. It is where a product lands when added (fly-to-cart).
 */
export function CartLink({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const { units, ready } = useCart();
  const count = ready ? units : 0;
  return (
    <Tooltip label={t("cart")}>
      <Link
        href="/cart"
        aria-label={t("cartWithCount", { count })}
        data-cart-target=""
        className={cn(iconControl, className)}
      >
        <span className="relative">
          <ShoppingBag aria-hidden="true" className="size-6" />
          <CartBadge className="-top-2 -right-2.5" />
        </span>
      </Link>
    </Tooltip>
  );
}
