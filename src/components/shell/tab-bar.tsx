"use client";

import { Search, ShoppingBag, Store, User } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";
import { useCart } from "@/features/cart/cart";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { AccountDot } from "./account-link";
import { CartBadge } from "./cart-link";

type Href = ComponentProps<typeof Link>["href"];

function Tab({
  href,
  active,
  label,
  ariaLabel,
  target = false,
  children,
}: {
  href: Href;
  active: boolean;
  label: string;
  ariaLabel?: string;
  /** The icon pill is where a product lands when added (fly-to-cart). */
  target?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={ariaLabel}
        className={cn(
          "flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[0.6875rem] font-semibold transition-colors duration-200",
          active ? "text-leaf-700" : "text-ink-muted",
        )}
      >
        {/* The active tab sits on a white thumb with a soft shadow. */}
        <span
          data-cart-target={target ? "" : undefined}
          className={cn(
            "ease-glass relative grid h-7 w-12 place-items-center rounded-full transition-[background-color,box-shadow] duration-200",
            active &&
              "bg-white shadow-[0_1px_2px_rgb(23_33_27/0.08),0_4px_12px_-4px_rgb(23_33_27/0.18)]",
          )}
        >
          {children}
        </span>
        {label}
      </Link>
    </li>
  );
}

/**
 * The everyday navigation on phones, within reach of the thumb: a glass
 * bar that floats over the foot of the page (2026-10-31), with the active
 * tab on a white thumb. Hidden from medium screens on, where the header
 * carries the same links.
 */
export function TabBar() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const { units, ready } = useCart();
  const icon = "size-6";
  const inShop =
    pathname === "/" ||
    pathname.startsWith("/category") ||
    (pathname.startsWith("/products") && pathname !== "/products");

  return (
    <nav
      aria-label={t("tabBar")}
      className="glass-strong shadow-float fixed inset-x-0 bottom-0 z-40 rounded-t-3xl pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex px-2 pt-1">
        <Tab href="/" active={inShop} label={t("shop")}>
          <Store aria-hidden="true" className={icon} />
        </Tab>
        <Tab
          href="/products"
          active={pathname === "/products"}
          label={tCommon("search")}
        >
          <Search aria-hidden="true" className={icon} />
        </Tab>
        <Tab
          href="/cart"
          active={pathname === "/cart"}
          label={t("cart")}
          ariaLabel={t("cartWithCount", { count: ready ? units : 0 })}
          target
        >
          <ShoppingBag aria-hidden="true" className={icon} />
          <CartBadge className="-top-1.5 right-0.5" />
        </Tab>
        <Tab
          href="/account"
          active={pathname.startsWith("/account")}
          label={t("account")}
        >
          <User aria-hidden="true" className={icon} />
          <AccountDot className="top-0.5 right-2" />
        </Tab>
      </ul>
    </nav>
  );
}
