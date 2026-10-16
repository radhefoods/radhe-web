"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { orderingReason } from "@/features/catalogue/availability";
import { useCart } from "@/features/cart/cart";
import type { Id, Ordering } from "@/lib/api/types";
import { clampToOrdering } from "@/lib/cart/guest-cart";
import { cn } from "@/lib/cn";

/**
 * The one control that puts a pack size into the cart: a button first (a
 * full pill, or on a card the round "+"), then minus, number, plus. When
 * the size cannot be ordered (switched off, or sold out) it says why, in
 * the same place and the same height, so the grid never jumps.
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
  /** `round`: the "+" of a product card; the stepper then fills the row. */
  look?: "button" | "round";
  className?: string;
}) {
  const t = useTranslations("product");
  const cart = useCart();
  const reason = orderingReason(ordering);
  const height = size === "sm" ? "min-h-11" : "min-h-12";

  if (reason) {
    return (
      <p
        className={cn(
          "bg-cloud text-ink-muted flex items-center justify-center rounded-full px-3.5 py-2 text-center text-xs leading-tight font-semibold",
          look === "round" ? "min-h-10" : height,
          className,
        )}
      >
        {t(`reason.${reason}`)}
      </p>
    );
  }

  const quantity = cart.quantityOf(variantId);
  const min = ordering?.minQuantity ?? 1;
  const max = ordering?.canOrder ? ordering.maxQuantity : null;
  const add = () => cart.setQuantity(variantId, clampToOrdering(min, ordering));

  if (quantity === 0 && look === "round") {
    return (
      <button
        type="button"
        aria-label={t("addNamed", { name })}
        onClick={add}
        className={cn(
          "bg-leaf-600 hover:bg-leaf-700 grid size-11 shrink-0 place-items-center rounded-full text-white shadow-[0_6px_14px_-6px_rgb(21_122_75_/_0.6)] transition-[background-color,transform] duration-150 hover:scale-105 active:scale-95",
          className,
        )}
      >
        <Plus aria-hidden="true" className="size-5" strokeWidth={2.6} />
      </button>
    );
  }

  if (quantity === 0) {
    return (
      <Button
        size={size}
        block
        className={className}
        aria-label={t("addNamed", { name })}
        onClick={add}
      >
        {t("addToCart")}
      </Button>
    );
  }

  return (
    <QuantityStepper
      value={quantity}
      min={min}
      max={max}
      size={size === "sm" ? "sm" : "md"}
      className={cn(look === "round" ? "min-h-11" : height, className)}
      onChange={(next) => cart.setQuantity(variantId, next)}
      labels={{
        quantity: t("quantityNamed", { name }),
        increase: t("increase"),
        decrease: t("decrease"),
        remove: t("remove"),
      }}
    />
  );
}
