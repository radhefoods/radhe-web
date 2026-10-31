"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useWishlist } from "@/features/wishlist/wishlist";
import type { Id } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/** How long the spoken "Saved" stays for screen readers. */
const ANNOUNCED_FOR_MS = 1500;

/**
 * The heart that saves a product to the wishlist (doc 16): on the top
 * corner of a card's tile (`tile`), or beside "Add to cart" on the product
 * page (`box`), where it also remembers the pack size that is open. The
 * heart fills red when the product is saved; a tap toggles it at once, and
 * the store talks to the API (or to local storage) and turns it back when
 * the call fails. The change is spoken once.
 */
export function WishlistButton({
  productId,
  variantId,
  name,
  look = "tile",
  className,
}: {
  productId: Id;
  /** The pack size the customer has open: remembered with the product. */
  variantId?: Id;
  /** The name with the size, for the spoken labels. */
  name: string;
  look?: "tile" | "box";
  className?: string;
}) {
  const t = useTranslations("product");
  const { has, save, remove } = useWishlist();
  const saved = has(productId);
  // "Saved" or "Removed", spoken once per tap.
  const [announced, setAnnounced] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const toggle = () => {
    if (saved) remove(productId);
    else save(productId, variantId);
    setAnnounced(saved ? t("wishlistRemoved") : t("wishlistSaved"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAnnounced(""), ANNOUNCED_FOR_MS);
  };

  return (
    <>
      <button
        type="button"
        aria-pressed={saved}
        aria-label={
          saved ? t("wishlistRemove", { name }) : t("wishlistSave", { name })
        }
        onClick={toggle}
        className={cn(
          "text-ink ease-glass grid shrink-0 place-items-center rounded-full transition-[color,box-shadow,background-color,transform] duration-200 hover:text-red-600 active:scale-90",
          look === "tile"
            ? "glass-soft hover:shadow-lift size-9 hover:bg-white"
            : "glass size-12 hover:bg-white/90 sm:size-13",
          saved && "text-red-600",
          className,
        )}
      >
        <Heart
          aria-hidden="true"
          // Mounted afresh when it fills, so the heart pops once.
          key={saved ? "saved" : "plain"}
          className={cn(
            look === "tile" ? "size-[18px]" : "size-5",
            saved && "animate-count-pop fill-current",
          )}
          strokeWidth={2.25}
        />
      </button>
      {/* Always in the tree, so that the change of its text is read out. */}
      <span role="status" className="sr-only">
        {announced}
      </span>
    </>
  );
}
