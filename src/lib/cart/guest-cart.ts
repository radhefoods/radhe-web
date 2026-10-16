import type { CartItemInput, Id, Ordering } from "@/lib/api/types";

// The cart of a visitor who is not signed in. It holds pack sizes
// (`variantId`) and quantities only, never prices: `POST /v1/store/cart/preview`
// prices it, and after sign-in `POST /v1/store/cart/merge` hands it to the
// server. The limits mirror the API (8): at most 100 lines, 1 to 10000 units
// each. The key changed to `v2` when the shop moved to pack sizes
// (2026-10-16): carts keyed by the old product ids are left where they are.

export const CART_MAX_LINES = 100;
export const CART_MAX_QUANTITY = 10_000;
export const GUEST_CART_KEY = "rf.cart.v2";

export type GuestCart = readonly CartItemInput[];

const OBJECT_ID = /^[0-9a-f]{24}$/i;

function isValidQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= CART_MAX_QUANTITY
  );
}

/**
 * Makes a trustworthy cart out of whatever is in storage: unknown shapes,
 * bad ids and quantities are dropped, duplicates keep the first entry, the
 * list is cut at the maximum number of lines.
 */
export function sanitizeCart(value: unknown): CartItemInput[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: CartItemInput[] = [];
  for (const entry of value) {
    if (items.length >= CART_MAX_LINES) break;
    if (!entry || typeof entry !== "object") continue;
    const { variantId, quantity } = entry as Record<string, unknown>;
    if (typeof variantId !== "string" || !OBJECT_ID.test(variantId)) continue;
    if (!isValidQuantity(quantity) || seen.has(variantId)) continue;
    seen.add(variantId);
    items.push({ variantId, quantity });
  }
  return items;
}

export function quantityOf(cart: GuestCart, variantId: Id): number {
  return cart.find((item) => item.variantId === variantId)?.quantity ?? 0;
}

/** The sum of all units, for the badge on the cart icon. */
export function totalUnits(cart: GuestCart): number {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

export type CartChange =
  { ok: true; cart: CartItemInput[] } | { ok: false; reason: "cart_full" };

/**
 * Sets the quantity of a product. `0` (or less) removes it; more than the
 * maximum is cut to the maximum. A new line in a full cart is refused, as
 * the API does with `CART_FULL`.
 */
export function setQuantity(
  cart: GuestCart,
  variantId: Id,
  quantity: number,
): CartChange {
  const wanted = Math.min(Math.trunc(quantity), CART_MAX_QUANTITY);
  if (!Number.isFinite(wanted) || wanted <= 0) {
    return { ok: true, cart: cart.filter((i) => i.variantId !== variantId) };
  }
  const exists = cart.some((item) => item.variantId === variantId);
  if (exists) {
    return {
      ok: true,
      cart: cart.map((item) =>
        item.variantId === variantId ? { variantId, quantity: wanted } : item,
      ),
    };
  }
  if (cart.length >= CART_MAX_LINES) return { ok: false, reason: "cart_full" };
  return { ok: true, cart: [...cart, { variantId, quantity: wanted }] };
}

export function addQuantity(
  cart: GuestCart,
  variantId: Id,
  amount: number,
): CartChange {
  return setQuantity(cart, variantId, quantityOf(cart, variantId) + amount);
}

export function removeItem(cart: GuestCart, variantId: Id): CartItemInput[] {
  return cart.filter((item) => item.variantId !== variantId);
}

/**
 * The quantity the customer may choose for a product, from its ordering
 * block: at least `minQuantity`, at most `maxQuantity` (product limit and
 * units in stock combined), never more than the cart allows.
 */
export function clampToOrdering(
  quantity: number,
  ordering: Pick<Ordering, "minQuantity" | "maxQuantity"> | null,
): number {
  const min = Math.max(1, ordering?.minQuantity ?? 1);
  const max = Math.min(
    CART_MAX_QUANTITY,
    ordering?.maxQuantity ?? CART_MAX_QUANTITY,
  );
  if (max < min) return min;
  return Math.min(Math.max(Math.trunc(quantity), min), max);
}

// --- Storage ----------------------------------------------------------------

type CartStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): CartStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Storage can be blocked (private mode, site data switched off).
    return null;
  }
}

/** The stored cart, or an empty one when nothing usable is stored. */
export function loadGuestCart(
  storage: CartStorage | null = browserStorage(),
): CartItemInput[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(GUEST_CART_KEY);
    return raw ? sanitizeCart(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

/** Stores the cart. Returns false when the browser refused (full, blocked). */
export function saveGuestCart(
  cart: GuestCart,
  storage: CartStorage | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    if (cart.length === 0) storage.removeItem(GUEST_CART_KEY);
    else storage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
    return true;
  } catch {
    return false;
  }
}

export function clearGuestCart(
  storage: CartStorage | null = browserStorage(),
): void {
  try {
    storage?.removeItem(GUEST_CART_KEY);
  } catch {
    // Nothing to clear when storage is not available.
  }
}
