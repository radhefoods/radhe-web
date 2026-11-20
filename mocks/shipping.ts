// Delivery by the box, for the mock API (doc/BOX_BASED_SHIPPING.md): what a
// pack weighs, how many boxes an order needs, how many of them are free and
// what the others cost.
//
// These are the rule functions of the real API, copied from
// `radhe-api/src/modules/shipping/shipping-rules.ts` as they stood on
// 2026-11-20, so that the mock answers the figures the API would. The shop
// never runs any of this: it prints what the API sends.

import type {
  BillShipping,
  BoxFeeTier,
  DeliveryFeeTier,
  ShippingBox,
} from "../src/lib/api/types.ts";

/** The setting `shipping` of the admin (doc/BOX_BASED_SHIPPING.md, 5). */
export interface ShippingRules {
  /** Off: the flat `deliveryFee` tiers are charged. */
  enabled: boolean;
  /** Cents of goods per free box; `null`: never free by value. */
  freeThresholdPerBox: number | null;
  /** Grams one box may weigh. */
  maxBoxWeight: number;
  /** Grams of the empty box. */
  boxTareWeight: number;
  feeTiers: BoxFeeTier[];
  /** Where orders are delivered; checked when an order is placed. */
  countries: string[];
  estimate: { packagingPercent: number; defaultWeight: number };
  /** What happens to a pack heavier than a box may be. */
  overweight: "own_parcel" | "not_orderable";
}

/** The defaults of the API: off until an admin switches it on. */
export const SHIPPING_DEFAULTS: ShippingRules = {
  enabled: false,
  freeThresholdPerBox: 3900,
  maxBoxWeight: 25000,
  boxTareWeight: 0,
  feeTiers: [
    { upTo: 2000, fee: 699 },
    { upTo: null, fee: 499 },
  ],
  countries: ["DE"],
  estimate: { packagingPercent: 5, defaultWeight: 500 },
  overweight: "own_parcel",
};

/** A tonne: no pack of the shop weighs more. */
export const MAX_SHIPPING_WEIGHT = 1_000_000;

/** Boxes an answer lists one by one. The counts cover every box. */
export const MAX_LISTED_BOXES = 50;

// ---- The weight of a pack ---------------------------------------------------

/** A pack size, as far as its weight is concerned. */
export interface WeighedPack {
  /** Grams of one pack as it is shipped, its own packaging included. */
  shippingWeight?: number | null;
  /** `baseQuantity` is grams, millilitres or pieces. */
  packSize: { unit: string; baseQuantity: number };
}

export interface PackWeight {
  /** Grams of one pack. */
  weight: number;
  /** The weight is not on record and was worked out from the pack size. */
  estimated: boolean;
}

/** Whether a number can be the shipping weight of a pack. */
export function isShippingWeight(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_SHIPPING_WEIGHT
  );
}

/**
 * What a pack size without a shipping weight is taken to weigh: its stated
 * quantity (a gram per millilitre for liquids) plus the allowance for its
 * packaging, rounded up to the gram. A pack sold by the piece says nothing
 * about its weight: it gets the default.
 */
export function estimatedWeightOf(
  packSize: WeighedPack["packSize"],
  estimate: ShippingRules["estimate"],
): number {
  const nominal = packSize.unit === "pcs" ? 0 : packSize.baseQuantity;
  if (!(nominal > 0)) return Math.max(1, Math.ceil(estimate.defaultWeight));
  // In hundredths of a percent, so that 5.25 % is exact.
  const factor = 10_000 + Math.round(estimate.packagingPercent * 100);
  return Math.max(1, Math.ceil((nominal * factor) / 10_000 - 1e-9));
}

/** The weight of one pack: the one on record, else the estimate. */
export function packWeightOf(
  pack: WeighedPack,
  estimate: ShippingRules["estimate"],
): PackWeight {
  if (isShippingWeight(pack.shippingWeight)) {
    return { weight: Math.ceil(pack.shippingWeight), estimated: false };
  }
  return {
    weight: estimatedWeightOf(pack.packSize, estimate),
    estimated: true,
  };
}

// ---- The boxes of an order --------------------------------------------------

/** A line of the cart, as the boxes see it. */
export interface ShippingLine {
  /** Packs. */
  quantity: number;
  /** Grams of one pack. */
  unitWeight: number;
  /** Every pack travels as a parcel of its own, not in a box with others. */
  separate?: boolean;
}

interface PackedBox {
  /** Grams of goods in it. */
  contents: number;
  /** A pack that travels alone: not a box that is filled with other goods. */
  separate: boolean;
  /** Heavier than a box may be. */
  overweight: boolean;
}

type BoxSize = Pick<ShippingRules, "maxBoxWeight" | "boxTareWeight">;

/** Grams of goods a box holds: what it may weigh, less the box itself. */
export function boxCapacityOf(rules: BoxSize): number {
  return Math.max(1, rules.maxBoxWeight - rules.boxTareWeight);
}

/**
 * Puts the packs of an order into boxes. Packs are never divided. The
 * heaviest packs go first, each into the first box that still has room for
 * it ("first fit decreasing"). A pack that is marked to travel alone, or
 * that does not fit into an empty box, is a parcel of its own. The shared
 * boxes come first in the answer, then the parcels.
 */
export function packBoxes(lines: ShippingLine[], rules: BoxSize): PackedBox[] {
  const capacity = boxCapacityOf(rules);
  const shared: number[] = [];
  const alone: PackedBox[] = [];
  const groups = lines
    .map((line, index) => ({ ...line, index }))
    .filter((line) => line.quantity > 0 && line.unitWeight > 0)
    .sort((a, b) => b.unitWeight - a.unitWeight || a.index - b.index);

  for (const group of groups) {
    if (group.separate || group.unitWeight > capacity) {
      for (let unit = 0; unit < group.quantity; unit += 1) {
        alone.push({
          contents: group.unitWeight,
          separate: true,
          overweight: group.unitWeight > rules.maxBoxWeight,
        });
      }
      continue;
    }
    // The packs of a line are alike: each box in turn takes as many as it
    // has room for, which is where "first fit" would put them one by one.
    let left = group.quantity;
    for (let box = 0; box < shared.length && left > 0; box += 1) {
      const fits = Math.min(
        left,
        Math.floor((capacity - shared[box]) / group.unitWeight),
      );
      if (fits > 0) {
        shared[box] += fits * group.unitWeight;
        left -= fits;
      }
    }
    const perBox = Math.floor(capacity / group.unitWeight);
    while (left > 0) {
      const packs = Math.min(left, perBox);
      shared.push(packs * group.unitWeight);
      left -= packs;
    }
  }
  return [
    ...shared.map((contents) => ({
      contents,
      separate: false,
      overweight: false,
    })),
    ...alone,
  ];
}

// ---- The fee ----------------------------------------------------------------

/** The tiers in rising order, the open one last. */
export function sortedFeeTiers(tiers: BoxFeeTier[]): BoxFeeTier[] {
  return [...tiers].sort(
    (a, b) =>
      (a.upTo ?? Number.POSITIVE_INFINITY) -
      (b.upTo ?? Number.POSITIVE_INFINITY),
  );
}

/** What one paid box costs for goods of a value: the first tier that reaches it. */
export function feePerBoxFor(orderValue: number, tiers: BoxFeeTier[]): number {
  const sorted = sortedFeeTiers(tiers);
  const tier =
    sorted.find((item) => item.upTo === null || orderValue <= item.upTo) ??
    sorted.at(-1);
  return tier?.fee ?? 0;
}

/**
 * The same rules for an order of one box, as tiers "from this value on":
 * what the shop shows where it says "delivery 4.99, free from 39 euros".
 */
export function singleBoxTiers(
  rules: Pick<ShippingRules, "feeTiers" | "freeThresholdPerBox">,
): DeliveryFeeTier[] {
  const free = rules.freeThresholdPerBox;
  const tiers: DeliveryFeeTier[] = [];
  let from = 0;
  for (const tier of sortedFeeTiers(rules.feeTiers)) {
    if (free === null || from < free) {
      tiers.push({ minOrderValue: from, fee: tier.fee });
    }
    if (tier.upTo === null) break;
    from = tier.upTo + 1;
  }
  if (free !== null) tiers.push({ minOrderValue: free, fee: 0 });
  return tiers;
}

// ---- The delivery of an order -------------------------------------------------

export interface ShippingInput {
  lines: (ShippingLine & { estimated?: boolean })[];
  /**
   * What is paid for the goods, VAT included: after the discount code and
   * the redeemed coins, without the delivery. Cents.
   */
  orderValue: number;
  /** A discount code that makes the delivery free was applied. */
  freeByCode?: boolean;
}

/**
 * The delivery of an order under the box rules: its boxes, which of them
 * are free, and the fee.
 *
 *   required  = the boxes the packs need
 *   unlocked  = floor(value of the goods / threshold per box)
 *   free      = min(required, unlocked)
 *   paid      = required - free
 *   fee       = paid x fee of the tier the value falls in
 */
export function shippingOf(
  input: ShippingInput,
  rules: ShippingRules,
): BillShipping {
  const orderValue = Math.max(0, input.orderValue);
  const capacity = boxCapacityOf(rules);
  const tare = rules.boxTareWeight;
  const packed = packBoxes(input.lines, rules);
  const required = packed.length;

  const threshold = rules.freeThresholdPerBox;
  const unlocked =
    threshold !== null && threshold > 0
      ? Math.floor(orderValue / threshold)
      : 0;
  const freeByValue = Math.min(required, unlocked);
  const freeByCode = Boolean(input.freeByCode) && required > 0;
  const free = freeByCode ? required : freeByValue;
  const feePerPaidBox = feePerBoxFor(orderValue, rules.feeTiers);

  const boxes: ShippingBox[] = packed.map((box, index) => {
    const weight = box.contents + (box.separate ? 0 : tare);
    const isFree = index < free;
    return {
      number: index + 1,
      weight,
      remaining: box.separate ? 0 : Math.max(0, capacity - box.contents),
      utilization: Math.min(
        100,
        Math.round((weight * 100) / rules.maxBoxWeight),
      ),
      separate: box.separate,
      overweight: box.overweight,
      free: isFree,
      fee: isFree ? 0 : feePerPaidBox,
    };
  });

  const goods = packed.reduce((sum, box) => sum + box.contents, 0);
  const packaging = packed.filter((box) => !box.separate).length * tare;
  const current = boxes
    .filter((box) => !box.separate)
    .reduce<ShippingBox | null>(
      (best, box) => (best && best.remaining > box.remaining ? best : box),
      null,
    );
  return {
    orderValue,
    weight: {
      goods,
      packaging,
      total: goods + packaging,
      estimated: input.lines.some(
        (line) => line.estimated === true && line.quantity > 0,
      ),
    },
    box: { maxWeight: rules.maxBoxWeight, tareWeight: tare, capacity },
    boxes: boxes.slice(0, MAX_LISTED_BOXES),
    requiredBoxes: required,
    unlockedFreeBoxes: unlocked,
    freeBoxes: free,
    paidBoxes: required - free,
    freeThresholdPerBox: threshold,
    missingForNextFreeBox:
      threshold !== null && threshold > 0
        ? threshold * (unlocked + 1) - orderValue
        : null,
    missingForFreeDelivery:
      threshold !== null && threshold > 0
        ? freeByCode
          ? 0
          : Math.max(0, threshold * required - orderValue)
        : freeByCode || required === 0
          ? 0
          : null,
    feePerPaidBox,
    regularFee: (required - freeByValue) * feePerPaidBox,
    fee: (required - free) * feePerPaidBox,
    freeByCode,
    currentBox: current
      ? {
          number: current.number,
          weight: current.weight,
          remaining: current.remaining,
          utilization: current.utilization,
        }
      : null,
  };
}
