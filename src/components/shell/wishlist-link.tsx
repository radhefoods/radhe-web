"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tooltip } from "@/components/ui/tooltip";
import { useWishlist } from "@/features/wishlist/wishlist";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { iconControl } from "./icon-control";

/** A small wheat number on the heart: the saved products. Nothing while none is. */
export function WishlistBadge({ className }: { className?: string }) {
  const { count, ready } = useWishlist();
  if (!ready || count === 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "text-ink bg-wheat-400 absolute -top-1 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[0.6875rem] leading-none font-bold tabular-nums ring-2 ring-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * The wishlist in the header: the heart with the number of saved products
 * in a wheat bubble at its corner, as the cart has, for everyone (doc 16:
 * a visitor keeps a list in the browser, a customer on the server). The
 * spoken label carries the count. It leads to the wishlist page.
 */
export function WishlistLink({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const { count, ready } = useWishlist();
  return (
    <Tooltip label={t("wishlist")}>
      <Link
        href="/wishlist"
        aria-label={t("wishlistWithCount", { count: ready ? count : 0 })}
        className={cn(iconControl, className)}
      >
        <span className="relative">
          <Heart aria-hidden="true" className="size-6" />
          <WishlistBadge className="-top-2 -right-2.5" />
        </span>
      </Link>
    </Tooltip>
  );
}
