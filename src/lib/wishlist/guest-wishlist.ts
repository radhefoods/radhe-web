import type { Id, WishlistEntryInput } from "@/lib/api/types";

// The wishlist of a visitor who is not signed in (doc 16): the products and,
// as a preference, the pack size each was saved from, newest first, in
// local storage. Never prices or names: `POST /v1/store/wishlist/preview`
// renders it, and after sign-in `POST /v1/store/wishlist/merge` hands it to
// the server. The limit mirrors the API: 200 products.

export const WISHLIST_MAX = 200;
export const GUEST_WISHLIST_KEY = "rf.wishlist.v1";

export type GuestWishlist = readonly WishlistEntryInput[];

const OBJECT_ID = /^[0-9a-f]{24}$/i;

/**
 * Makes a trustworthy list out of whatever is in storage: unknown shapes
 * and bad ids are dropped, a size that is not an id is forgotten, a
 * product counts once, the list is cut at the maximum.
 */
export function sanitizeWishlist(value: unknown): WishlistEntryInput[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const entries: WishlistEntryInput[] = [];
  for (const entry of value) {
    if (entries.length >= WISHLIST_MAX) break;
    if (!entry || typeof entry !== "object") continue;
    const { productId, variantId } = entry as Record<string, unknown>;
    if (typeof productId !== "string" || !OBJECT_ID.test(productId)) continue;
    if (seen.has(productId)) continue;
    seen.add(productId);
    entries.push(
      typeof variantId === "string" && OBJECT_ID.test(variantId)
        ? { productId, variantId }
        : { productId },
    );
  }
  return entries;
}

export function hasProduct(list: GuestWishlist, productId: Id): boolean {
  return list.some((entry) => entry.productId === productId);
}

export type WishlistChange =
  | { ok: true; list: WishlistEntryInput[] }
  | { ok: false; reason: "wishlist_full" };

/**
 * Saves a product at the front of the list (newest first) with the size
 * it was saved from, or, when it is on the list already, changes the
 * remembered size and keeps its place. A full list refuses a new product,
 * as the API does with `WISHLIST_FULL`.
 */
export function saveProduct(
  list: GuestWishlist,
  productId: Id,
  variantId?: Id,
): WishlistChange {
  const entry: WishlistEntryInput = variantId
    ? { productId, variantId }
    : { productId };
  if (hasProduct(list, productId)) {
    return {
      ok: true,
      list: list.map((item) => (item.productId === productId ? entry : item)),
    };
  }
  if (list.length >= WISHLIST_MAX) {
    return { ok: false, reason: "wishlist_full" };
  }
  return { ok: true, list: [entry, ...list] };
}

export function removeProduct(
  list: GuestWishlist,
  productId: Id,
): WishlistEntryInput[] {
  return list.filter((entry) => entry.productId !== productId);
}

// --- Storage ----------------------------------------------------------------

type ListStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): ListStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Storage can be blocked (private mode, site data switched off).
    return null;
  }
}

/** The stored list, or an empty one when nothing usable is stored. */
export function loadGuestWishlist(
  storage: ListStorage | null = browserStorage(),
): WishlistEntryInput[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(GUEST_WISHLIST_KEY);
    return raw ? sanitizeWishlist(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

/** Stores the list. Returns false when the browser refused (full, blocked). */
export function saveGuestWishlist(
  list: GuestWishlist,
  storage: ListStorage | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    if (list.length === 0) storage.removeItem(GUEST_WISHLIST_KEY);
    else storage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function clearGuestWishlist(
  storage: ListStorage | null = browserStorage(),
): void {
  try {
    storage?.removeItem(GUEST_WISHLIST_KEY);
  } catch {
    // Nothing to clear when storage is not available.
  }
}
