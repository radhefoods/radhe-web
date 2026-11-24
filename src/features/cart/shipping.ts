import type { Bill, BillShipping, Cents } from "@/lib/api/types";

// Delivery by the box (doc/BOX_BASED_SHIPPING_WEB_INTEGRATION.md). The API
// weighs the packs, counts the boxes, says which are free and what the
// others cost. Nothing of that is worked out here: this module only picks
// the case a bill is in (section 5 of the document) and says how full
// its bar is drawn, by the formula the document gives for the bar.

/**
 * The case the delivery of a bill is in, in the order of the document's
 * table; the card under the checkout button (`BoxShipping`) words it.
 * Every number in it is one the API sent.
 */
export type ShippingMessage =
  /** Nothing to deliver: no block at all. */
  | { kind: "none" }
  /** A free-delivery code. `saving` is 0 when the order ships free anyway. */
  | { kind: "freeByCode"; code: string; saving: Cents }
  /** Every box is free by the value of the goods. */
  | { kind: "free"; boxes: number }
  /** No box is ever free by value: the fee, and how it comes about. */
  | { kind: "noThreshold"; fee: Cents; paidBoxes: number; feePerPaidBox: Cents }
  /** One box, and it is paid. */
  | { kind: "oneBox"; missing: Cents; feePerPaidBox: Cents }
  /** Several boxes, none of them free yet. */
  | {
      kind: "noneFree";
      boxes: number;
      feePerPaidBox: Cents;
      missing: Cents;
    }
  /** Several boxes, some free and some paid. */
  | {
      kind: "someFree";
      boxes: number;
      freeBoxes: number;
      paidBoxes: number;
      feePerPaidBox: Cents;
      missing: Cents;
      /** The number of the box that would be free next. */
      nextBox: number;
    };

/**
 * Which sentence the delivery of this bill gets.
 *
 * @param code the free-delivery code of the bill, to name it; `null` without one
 */
export function shippingMessageOf(
  shipping: BillShipping,
  code: string | null,
): ShippingMessage {
  if (shipping.requiredBoxes === 0) return { kind: "none" };
  if (shipping.freeByCode && code) {
    return { kind: "freeByCode", code, saving: shipping.regularFee };
  }
  if (shipping.paidBoxes === 0) {
    return { kind: "free", boxes: shipping.requiredBoxes };
  }
  const missing = shipping.missingForNextFreeBox;
  if (shipping.freeThresholdPerBox === null || missing === null) {
    return {
      kind: "noThreshold",
      fee: shipping.fee,
      paidBoxes: shipping.paidBoxes,
      feePerPaidBox: shipping.feePerPaidBox,
    };
  }
  if (shipping.requiredBoxes === 1) {
    return {
      kind: "oneBox",
      missing,
      feePerPaidBox: shipping.feePerPaidBox,
    };
  }
  if (shipping.freeBoxes === 0) {
    return {
      kind: "noneFree",
      boxes: shipping.requiredBoxes,
      feePerPaidBox: shipping.feePerPaidBox,
      missing,
    };
  }
  return {
    kind: "someFree",
    boxes: shipping.requiredBoxes,
    freeBoxes: shipping.freeBoxes,
    paidBoxes: shipping.paidBoxes,
    feePerPaidBox: shipping.feePerPaidBox,
    missing,
    nextBox: shipping.freeBoxes + 1,
  };
}

/**
 * How full the bar is, from 0 to 1: it runs to the next free box, and is
 * full when no box is paid. `null`: no bar (no box is ever free by value,
 * or there is nothing to deliver).
 *
 * Only the length of a bar; no amount is derived from this.
 */
export function shippingProgressOf(shipping: BillShipping): number | null {
  if (shipping.requiredBoxes === 0) return null;
  if (shipping.paidBoxes === 0) return 1;
  const threshold = shipping.freeThresholdPerBox;
  if (threshold === null || threshold <= 0) return null;
  return (shipping.orderValue % threshold) / threshold;
}

/**
 * Under this much room a box is called full. The API sends no "full"
 * flag: where the shop says "full" is its own choice (section 6 of the
 * document: "below about 500 g").
 */
export const FULL_BOX_GRAMS = 500;

/** Whether the box the next goods go into has no room worth naming. */
export function isBoxFull(
  currentBox: NonNullable<BillShipping["currentBox"]>,
): boolean {
  return currentBox.remaining < FULL_BOX_GRAMS;
}

/** The code that makes the delivery of this bill free, or `null`. */
export function freeDeliveryCodeOf(
  bill: Pick<Bill, "discount">,
): string | null {
  const discount = bill.discount;
  return discount?.applied && discount.type === "free_delivery"
    ? discount.code
    : null;
}

/**
 * How many boxes stopped being free between two bills of the same cart:
 * what a discount code or coins cost, since both are taken off the goods
 * before the boxes are counted (section 9). `0` when none did, and under
 * the flat fee.
 */
export function lostFreeBoxes(
  before: Pick<Bill, "shipping"> | null | undefined,
  after: Pick<Bill, "shipping">,
): number {
  if (!before?.shipping || !after.shipping) return 0;
  return Math.max(0, after.shipping.paidBoxes - before.shipping.paidBoxes);
}
