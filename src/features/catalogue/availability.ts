import type { Ordering, OrderingReason } from "@/lib/api/types";

// What the catalogue says about buying a product right now, read from its
// ordering block (doc 7.1). The API decides; the shop only words it. Nothing
// is reserved before a payment, so what the block says can change until the
// payment goes through.

/** Up to this many units in stock, the shop says "only N left" (owner, 2026-10-16). */
export const FEW_LEFT = 10;

/** Why a product cannot be ordered right now, or `null` when it can. */
export function orderingReason(
  ordering: Ordering | null,
): OrderingReason | null {
  if (!ordering || ordering.canOrder) return null;
  return ordering.reason;
}

/** The units left when they are few, else `null`. */
export function fewLeft(ordering: Ordering | null): number | null {
  if (!ordering?.canOrder) return null;
  return ordering.remaining <= FEW_LEFT ? ordering.remaining : null;
}

/** Whether the product's own limit per order caps the quantity, not the stock. */
export function cappedByLimit(ordering: Ordering): boolean {
  return ordering.canOrder && ordering.maxQuantity < ordering.remaining;
}
