"use client";

import { Ban, PackageX, Plus } from "lucide-react";
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
 * full pill, or on a card the round "+" on the corner of the tile), then
 * minus, number, plus. On the tap the picture flies into the cart
 * (`flyToCart`), the stepper unfolds in the button's place (on a card to
 * the left, over the tile) and its number pops as it changes (owner,
 * 2026-10-16). When the size cannot be ordered (sold out, or switched
 * off) a quiet pill with an icon says so in the same place, so nothing
 * jumps and nothing looks like a button.
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
  /** `round`: the "+" on the tile of a product card, a white ring around it. */
  look?: "button" | "round";
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
          look === "round"
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

  if (quantity === 0 && look === "round") {
    return (
      <>
        <button
          type="button"
          aria-label={t("addNamed", { name })}
          onClick={add}
          className={cn(
            "bg-leaf-600 hover:bg-leaf-700 hover:ring-leaf-100 grid size-11 shrink-0 place-items-center rounded-full text-white shadow-[0_6px_14px_-6px_rgb(21_122_75_/_0.6)] ring-2 ring-white transition-[background-color,box-shadow,transform] duration-150 hover:scale-105 hover:ring-4 active:scale-95",
            className,
          )}
        >
          <Plus aria-hidden="true" className="size-5" strokeWidth={2.6} />
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
        size={size === "sm" ? "sm" : "md"}
        className={cn(
          look === "round"
            ? "shadow-float min-h-11 w-auto origin-right ring-2 ring-white"
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
