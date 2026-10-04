"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCart } from "@/features/cart/cart";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

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

/** The cart in the header: icon, number of units, and a spoken label. */
export function CartLink() {
  const t = useTranslations("nav");
  const { units, ready } = useCart();
  return (
    <Link
      href="/cart"
      aria-label={t("cartWithCount", { count: ready ? units : 0 })}
      className="hover:bg-mist relative grid size-11 place-items-center rounded-sm"
    >
      <span className="relative">
        <ShoppingBag aria-hidden="true" className="size-6" />
        <CartBadge />
      </span>
    </Link>
  );
}
