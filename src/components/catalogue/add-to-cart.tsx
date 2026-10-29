"use client";

import { Ban, PackageX, ShoppingBasket } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { orderingReason } from "@/features/catalogue/availability";
import { useCart } from "@/features/cart/cart";
import { flyToCart } from "@/features/cart/fly-to-cart";
import type { Id, Ordering } from "@/lib/api/types";
import { clampToOrdering } from "@/lib/cart/guest-cart";
import { cn } from "@/lib/cn";

/** How long the spoken "Added" stays for screen readers. */
const ANNOUNCED_FOR_MS = 1500;

/**
 * The one control that puts a pack size into the cart: a button first (a
 * full pill, or on a card the round basket at the end of the price row),
 * then minus, number, plus. On the tap the picture flies into the cart
 * (`flyToCart`), the stepper unfolds in the button's place (on a card to
 * the left, beside the price) and its number pops as it changes (owner,
 * 2026-10-16). When the size cannot be ordered (sold out, or switched
 * off) a quiet pill with an icon says so instead, so nothing looks like a
 * button. The round basket is 40 px, lit from above with a soft green
 * shadow and no white ring (owner, 2026-10-19); it stands in the card's
 * bottom right corner, level with the price, whatever the length of the
 * name (owner, 2026-10-28, evening: off the picture, a basket instead of
 * the "+"). The stepper that unfolds in its place is the leaf pill, 32 px
 * high (36 from `sm`), filling the slot the card keeps for the two of
 * them, so the price beside it stays where it was (owner, 2026-10-29).
 */
export function AddToCart({
  variantId,
  name,
  ordering,
  size = "md",
  look = "button",
  className,
}: {
  /** The pack size: the cart is kept by it (doc 8). */
  variantId: Id;
  /** The name with the size, for the spoken labels. */
  name: string;
  ordering: Ordering | null;
  size?: "sm" | "md";
  /** `card`: the round basket in the price row of a product card. */
  look?: "button" | "card";
  className?: string;
}) {
  const t = useTranslations("product");
  const cart = useCart();
  const reason = orderingReason(ordering);
  const height = size === "sm" ? "min-h-11" : "min-h-12";
  // The stepper unfolds when it follows a tap here, not when a page opens
  // with the size already in the cart.
  const [unfolds, setUnfolds] = useState(false);
  // "Added", spoken once per tap: the button the reader was on is gone.
  const [announced, setAnnounced] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (reason) {
    const Icon = reason === "sold_out" ? PackageX : Ban;
    return (
      <p
        className={cn(
          "border-line text-ink-muted flex items-center justify-center gap-1.5 rounded-full border-[1.5px] px-4 py-2 text-center text-[0.8125rem] leading-tight font-semibold",
          look === "card"
            ? "shadow-card min-h-10 bg-white px-3 text-xs"
            : cn("bg-mist", height),
          className,
        )}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        {t(`reason.${reason}`)}
      </p>
    );
  }

  const quantity = cart.quantityOf(variantId);
  const min = ordering?.minQuantity ?? 1;
  const max = ordering?.canOrder ? ordering.maxQuantity : null;
  const add = (event: MouseEvent<HTMLButtonElement>) => {
    cart.setQuantity(variantId, clampToOrdering(min, ordering));
    setUnfolds(true);
    flyToCart(event.currentTarget);
    setAnnounced(t("added"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAnnounced(""), ANNOUNCED_FOR_MS);
  };
  // Always in the tree, so that the change of its text is read out.
  const status = (
    <span role="status" className="sr-only">
      {announced}
    </span>
  );

  if (quantity === 0 && look === "card") {
    return (
      <>
        <button
          type="button"
          aria-label={t("addNamed", { name })}
          onClick={add}
          className={cn(
            "from-leaf-500 to-leaf-600 hover:from-leaf-600 hover:to-leaf-700 grid size-10 shrink-0 place-items-center rounded-full bg-linear-to-b text-white shadow-[0_4px_12px_-3px_rgb(21_122_75_/_0.55)] transition-[background-image,box-shadow,transform] duration-150 hover:scale-105 hover:shadow-[0_8px_18px_-4px_rgb(21_122_75_/_0.6)] active:scale-95",
            className,
          )}
        >
          <ShoppingBasket
            aria-hidden="true"
            className="size-5"
            strokeWidth={2.25}
          />
        </button>
        {status}
      </>
    );
  }

  if (quantity === 0) {
    return (
      <>
        <Button
          size={size}
          block
          className={className}
          aria-label={t("addNamed", { name })}
          onClick={add}
        >
          {t("addToCart")}
        </Button>
        {status}
      </>
    );
  }

  return (
    <>
      <QuantityStepper
        value={quantity}
        min={min}
        max={max}
        size={look === "card" ? "card" : size === "sm" ? "sm" : "md"}
        className={cn(
          look === "card"
            ? "h-8 w-full origin-right sm:h-9"
            : cn(height, "origin-left"),
          unfolds && "animate-stepper-in",
          className,
        )}
        onChange={(next) => cart.setQuantity(variantId, next)}
        labels={{
          quantity: t("quantityNamed", { name }),
          increase: t("increase"),
          decrease: t("decrease"),
          remove: t("remove"),
        }}
      />
      {status}
    </>
  );
}
