// Discount codes on the checkout page (doc/DISCOUNT_CODES.md, sections 1 to
// 3 and 5): the rules of a code, the proportional split over the lines, and
// the uses that are reserved at checkout, counted at payment and released
// when an order is given up.

import type {
  BillDiscount,
  BillLine,
  DiscountReason,
} from "../src/lib/api/types.ts";
import { discounts, type DiscountRecord } from "./data/discounts.ts";
import { db, type CustomerRecord, type OrderRecord } from "./state.ts";

export function findDiscount(code: string): DiscountRecord | undefined {
  const wanted = code.trim().toUpperCase();
  return discounts.find((record) => record.code === wanted);
}

/** The derived state of a code, in the order the documentation gives (section 2). */
export function stateOf(
  record: DiscountRecord,
  now = Date.now(),
): "inactive" | "scheduled" | "expired" | "exhausted" | "active" {
  if (!record.isActive) return "inactive";
  if (record.startsAt && Date.parse(record.startsAt) > now) return "scheduled";
  if (record.expiresAt && Date.parse(record.expiresAt) <= now) return "expired";
  if (
    record.maxUses !== null &&
    record.usedCount + record.reservedCount >= record.maxUses
  ) {
    return "exhausted";
  }
  return "active";
}

/** Orderable lines, before any share is taken off. */
function orderableLines(lines: BillLine[]): BillLine[] {
  return lines.filter((line) => line.issue === null);
}

/** The lines a code applies to: all orderable ones, or those not reduced. */
function eligibleLines(record: DiscountRecord, lines: BillLine[]): BillLine[] {
  return orderableLines(lines).filter(
    (line) =>
      record.appliesToSaleItems ||
      line.product === null ||
      line.unitPrice >= line.product.pricing.regularPrice,
  );
}

/** The goods a line is worth before the discount. */
const goodsOf = (line: BillLine) => line.lineTotal + line.discountAmount;

/**
 * Why a code cannot be applied to these lines for this customer, or `null`
 * when it can. The checks run in the order of the documented reasons.
 */
export function checkDiscount(
  record: DiscountRecord,
  lines: BillLine[],
  customer: CustomerRecord,
): DiscountReason | null {
  switch (stateOf(record)) {
    case "inactive":
      return "inactive";
    case "scheduled":
      return "not_started";
    case "expired":
      return "expired";
    case "exhausted":
      return "exhausted";
  }
  if (record.oncePerCustomer) {
    const paidWithIt = [...db.orders.values()].some(
      (order) =>
        order.customerId === customer.id &&
        order.discount?.code === record.code &&
        order.discount.state === "used",
    );
    if (paidWithIt) return "already_used";
  }
  const goods = orderableLines(lines).reduce(
    (sum, line) => sum + goodsOf(line),
    0,
  );
  if (record.minOrderValue !== null && goods < record.minOrderValue) {
    return "below_minimum";
  }
  if (eligibleLines(record, lines).length === 0) return "nothing_eligible";
  return null;
}

/**
 * The amount of the code and its split over the eligible lines (section 3):
 * `round(goods × percent / 100)` or `min(fixed, goods)`, each line's share
 * rounded down and the cents that rounding leaves over given to the lines
 * with the largest remainders, so the shares add up exactly. By `variantId`.
 */
export function shareOut(
  record: DiscountRecord,
  lines: BillLine[],
): Map<string, number> {
  const eligible = eligibleLines(record, lines);
  const goods = eligible.reduce((sum, line) => sum + goodsOf(line), 0);
  const amount =
    record.type === "percent"
      ? Math.round((goods * record.value) / 100)
      : Math.min(record.value, goods);
  const shares = new Map<string, number>();
  if (goods === 0 || amount === 0) return shares;
  const remainders: { variantId: string; remainder: number }[] = [];
  let given = 0;
  for (const line of eligible) {
    const exact = (amount * goodsOf(line)) / goods;
    const share = Math.floor(exact);
    shares.set(line.variantId, share);
    remainders.push({ variantId: line.variantId, remainder: exact - share });
    given += share;
  }
  remainders.sort((a, b) => b.remainder - a.remainder);
  for (let left = amount - given, i = 0; left > 0; left -= 1, i += 1) {
    const { variantId } = remainders[i % remainders.length];
    shares.set(variantId, shares.get(variantId)! + 1);
  }
  return shares;
}

/** The `discount` block of the bill (doc 9.6). */
export function discountView(
  record: DiscountRecord,
  amount: number,
  reason: DiscountReason | null,
): BillDiscount {
  return {
    code: record.code,
    type: record.type,
    value: record.value,
    amount,
    applied: reason === null,
    reason,
  };
}

// --- Uses: reserved at checkout, counted when paid, released when given up --

/** One use is reserved for the order that waits for its payment. */
export function reserveDiscount(record: DiscountRecord): void {
  record.reservedCount += 1;
}

/** The order was paid: the use is counted. */
export function countDiscount(order: OrderRecord): void {
  if (order.discount?.state !== "reserved") return;
  const record = findDiscount(order.discount.code);
  if (record) {
    record.reservedCount = Math.max(0, record.reservedCount - 1);
    record.usedCount += 1;
  }
  order.discount.state = "used";
}

/** The order was never paid and is given up: the use is given back. */
export function releaseDiscount(order: OrderRecord): void {
  if (order.discount?.state !== "reserved") return;
  const record = findDiscount(order.discount.code);
  if (record) record.reservedCount = Math.max(0, record.reservedCount - 1);
  order.discount.state = "released";
}

// --- Fixtures ----------------------------------------------------------------

const initialUses = new Map(
  discounts.map((record) => [
    record.code,
    [record.usedCount, record.reservedCount] as const,
  ]),
);

/** The uses as they were at start (`POST /__mock/reset`). */
export function resetDiscounts(): void {
  for (const record of discounts) {
    const [used, reserved] = initialUses.get(record.code)!;
    record.usedCount = used;
    record.reservedCount = reserved;
    record.isActive = record.code !== "PAUSED";
  }
}
