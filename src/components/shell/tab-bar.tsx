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
          "flex h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-bold",
          active ? "text-leaf-700" : "text-ink-muted",
        )}
      >
        {/* The active tab sits in a leaf pill. */}
        <span
          data-cart-target={target ? "" : undefined}
          className={cn(
            "relative grid h-7 w-12 place-items-center rounded-full",
            active && "bg-leaf-50",
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
 * The everyday navigation on phones, within reach of the thumb. Hidden from
 * medium screens on, where the header carries the same links.
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
      className="border-line fixed inset-x-0 bottom-0 z-40 border-t bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
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
