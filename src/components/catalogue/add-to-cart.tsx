"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { useOrderingOpen } from "@/features/cargo/cargo";
import { useCart } from "@/features/cart/cart";
import type { Id, Ordering, OrderingReason } from "@/lib/api/types";
import { clampToOrdering } from "@/lib/cart/guest-cart";
import { cn } from "@/lib/cn";

/**
 * Why a product cannot be ordered right now, or `null` when it can.
 *
 * The product's own answer comes from a page that may be a few minutes old;
 * whether ordering is open at all is known live. The live answer wins in
 * both directions: a closed shop offers nothing, and an open shop does not
 * repeat a stale "ordering is closed".
 */
export function orderingReason(
  ordering: Ordering | null,
  open: "open" | "closed" | "unknown",
): OrderingReason | null {
  if (open === "closed") return "ordering_closed";
  if (!ordering || ordering.canOrder) return null;
  if (ordering.reason === "ordering_closed" && open === "open") return null;
  return ordering.reason;
}

/**
 * The one control that puts a product into the cart: a button first, then
 * minus, number, plus. When the product cannot be ordered it says why, in
 * the same place and the same height, so the grid never jumps.
 */
export function AddToCart({
  productId,
  name,
  ordering,
  size = "md",
  className,
}: {
  productId: Id;
  /** For the spoken labels: "Add Basmati Rice 5 kg to cart". */
  name: string;
  ordering: Ordering | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useTranslations("product");
  const cart = useCart();
  const open = useOrderingOpen();
  const reason = orderingReason(ordering, open);
  const height = size === "sm" ? "min-h-11" : "min-h-12";

  if (reason) {
    return (
      <p
        className={cn(
          "bg-mist text-ink-muted flex items-center justify-center rounded-md px-3 py-2 text-center text-[0.8125rem] leading-tight font-semibold",
          height,
          className,
        )}
      >
        {t(`reason.${reason}`)}
      </p>
    );
  }

  const quantity = cart.quantityOf(productId);
  const min = ordering?.minQuantity ?? 1;
  const max = ordering?.canOrder ? ordering.maxQuantity : null;

  if (quantity === 0) {
    return (
      <Button
        size={size}
        block
        className={cn("font-narrow", className)}
        aria-label={t("addNamed", { name })}
        onClick={() =>
          cart.setQuantity(productId, clampToOrdering(min, ordering))
        }
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
      className={cn(height, className)}
      onChange={(next) => cart.setQuantity(productId, next)}
      labels={{
        quantity: t("quantityNamed", { name }),
        increase: t("increase"),
        decrease: t("decrease"),
        remove: t("remove"),
      }}
    />
  );
}
