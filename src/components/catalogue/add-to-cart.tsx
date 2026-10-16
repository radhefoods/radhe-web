"use client";

import { Ban, Check, PackageX, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { orderingReason } from "@/features/catalogue/availability";
import { useCart } from "@/features/cart/cart";
import type { Id, Ordering } from "@/lib/api/types";
import { clampToOrdering } from "@/lib/cart/guest-cart";
import { cn } from "@/lib/cn";

/** How long the button shows "added" before the stepper takes its place. */
const ADDED_FOR_MS = 650;

/**
 * The one control that puts a pack size into the cart: a button first (a
 * full pill, or on a card the round "+"), then minus, number, plus. A tap
 * on the button shows a check for a moment, then the stepper unfolds in
 * its place and its number pops as it changes (owner, 2026-10-16: a
 * polished, subtle interaction). When the size cannot be ordered (sold
 * out, or switched off) a quiet pill with an icon says so, in the same
 * place and the same height, so the grid never jumps and nothing looks
 * like a button.
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
  // "Added" for a moment after the tap. The stepper that follows unfolds
  // only then, not when a page opens with the size already in the cart.
  const [added, setAdded] = useState(false);
  const [unfolds, setUnfolds] = useState(false);
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
          "border-line bg-mist text-ink-muted flex items-center justify-center gap-1.5 rounded-full border-[1.5px] px-4 py-2 text-center text-[0.8125rem] leading-tight font-semibold",
          look === "round" ? "min-h-11 w-full" : height,
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
  const add = () => {
    // A second tap while "added" shows counts one more, as the stepper would.
    cart.setQuantity(
      variantId,
      clampToOrdering(quantity === 0 ? min : quantity + 1, ordering),
    );
    setUnfolds(true);
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), ADDED_FOR_MS);
  };
  const status = (
    <span role="status" className="sr-only">
      {added ? t("added") : ""}
    </span>
  );

  if (quantity === 0 || added) {
    if (look === "round") {
      return (
        <>
          <button
            type="button"
            aria-label={t("addNamed", { name })}
            onClick={add}
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-full text-white shadow-[0_6px_14px_-6px_rgb(21_122_75_/_0.6)] transition-[background-color,box-shadow,transform] duration-150",
              added
                ? "bg-leaf-700 animate-added-pop"
                : "bg-leaf-600 hover:bg-leaf-700 hover:ring-leaf-100 hover:scale-105 hover:ring-4 active:scale-95",
              className,
            )}
          >
            {added ? (
              <Check aria-hidden="true" className="size-5" strokeWidth={3} />
            ) : (
              <Plus aria-hidden="true" className="size-5" strokeWidth={2.6} />
            )}
          </button>
          {status}
        </>
      );
    }
    return (
      <>
        <Button
          size={size}
          block
          className={cn(added && "bg-leaf-700", className)}
          aria-label={t("addNamed", { name })}
          onClick={add}
        >
          {added ? (
            <>
              <Check
                aria-hidden="true"
                className="animate-added-pop size-5"
                strokeWidth={3}
              />
              {t("added")}
            </>
          ) : (
            t("addToCart")
          )}
        </Button>
        {status}
      </>
    );
  }

  return (
    <QuantityStepper
      value={quantity}
      min={min}
      max={max}
      size={size === "sm" ? "sm" : "md"}
      className={cn(
        look === "round" ? "min-h-11 origin-right" : cn(height, "origin-left"),
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
  );
}
