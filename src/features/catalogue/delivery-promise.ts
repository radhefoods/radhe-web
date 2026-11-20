import type { Cents, Grams, ShopSettings } from "@/lib/api/types";

// What the shop says about delivery before there is a cart: in the strip
// above the header, on a product page, on the home page. Every number is
// read from `GET /v1/store/settings`, never written into the shop
// (doc/BOX_BASED_SHIPPING_WEB_INTEGRATION.md 3.1 and 7).

export interface DeliveryPromise {
  /**
   * The value of goods from which delivery is free: of an order under the
   * flat fee, of every box under the box rules. `null`: never free by value.
   */
  freeFrom: Cents | null;
  /**
   * Under the box rules: the goods one box holds, for "per box (up to
   * 25 kg)". `null` under the flat fee, and from an API that does not know
   * the boxes yet.
   */
  boxCapacity: Grams | null;
}

/**
 * The free-delivery promise of the settings. Under the box rules the API
 * states `deliveryFee` for an order of one box, so `freeFrom` stays right;
 * the promise then has to say "per box", which `boxCapacity` asks for.
 */
export function deliveryPromiseOf(
  settings: ShopSettings | null,
): DeliveryPromise {
  const shipping = settings?.shipping;
  return {
    freeFrom: settings?.deliveryFee.freeFrom ?? null,
    boxCapacity: shipping?.boxBased ? (shipping.boxCapacity ?? null) : null,
  };
}
