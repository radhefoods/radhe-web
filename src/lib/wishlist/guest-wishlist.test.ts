import { describe, expect, it } from "vitest";
import {
  GUEST_WISHLIST_KEY,
  WISHLIST_MAX,
  loadGuestWishlist,
  removeProduct,
  sanitizeWishlist,
  saveGuestWishlist,
  saveProduct,
} from "./guest-wishlist";

const id = (n: number) => n.toString(16).padStart(24, "0");

describe("sanitizeWishlist", () => {
  it("keeps products with a valid id once, with a valid size only", () => {
    expect(
      sanitizeWishlist([
        { productId: id(1), variantId: id(11) },
        { productId: id(1), variantId: id(12) },
        { productId: id(2), variantId: "not-an-id" },
        { productId: "nope" },
        null,
        "text",
        { variantId: id(3) },
      ]),
    ).toEqual([{ productId: id(1), variantId: id(11) }, { productId: id(2) }]);
  });

  it("cuts the list at the maximum and answers nothing for rubbish", () => {
    const many = Array.from({ length: WISHLIST_MAX + 5 }, (_, n) => ({
      productId: id(n + 1),
    }));
    expect(sanitizeWishlist(many)).toHaveLength(WISHLIST_MAX);
    expect(sanitizeWishlist("[]")).toEqual([]);
    expect(sanitizeWishlist({ productId: id(1) })).toEqual([]);
  });
});

describe("saveProduct and removeProduct", () => {
  it("puts a new product first and changes the size of a saved one in place", () => {
    const first = saveProduct([], id(1), id(11));
    expect(first).toEqual({
      ok: true,
      list: [{ productId: id(1), variantId: id(11) }],
    });
    const second = saveProduct(first.ok ? first.list : [], id(2));
    expect(second.ok && second.list.map((e) => e.productId)).toEqual([
      id(2),
      id(1),
    ]);
    const resized = saveProduct(second.ok ? second.list : [], id(1), id(12));
    expect(resized.ok && resized.list).toEqual([
      { productId: id(2) },
      { productId: id(1), variantId: id(12) },
    ]);
    expect(removeProduct(resized.ok ? resized.list : [], id(2))).toEqual([
      { productId: id(1), variantId: id(12) },
    ]);
  });

  it("refuses a new product on a full list, as the API does", () => {
    const full = Array.from({ length: WISHLIST_MAX }, (_, n) => ({
      productId: id(n + 1),
    }));
    expect(saveProduct(full, id(999))).toEqual({
      ok: false,
      reason: "wishlist_full",
    });
    // A saved product may still change its size.
    expect(saveProduct(full, id(1), id(11)).ok).toBe(true);
  });
});

describe("storage", () => {
  function memoryStorage() {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
      data,
    };
  }

  it("stores and reads the list, and removes the key for an empty one", () => {
    const storage = memoryStorage();
    expect(saveGuestWishlist([{ productId: id(1) }], storage)).toBe(true);
    expect(loadGuestWishlist(storage)).toEqual([{ productId: id(1) }]);
    saveGuestWishlist([], storage);
    expect(storage.data.has(GUEST_WISHLIST_KEY)).toBe(false);
  });

  it("answers an empty list for broken or missing storage", () => {
    const storage = memoryStorage();
    storage.setItem(GUEST_WISHLIST_KEY, "{not json");
    expect(loadGuestWishlist(storage)).toEqual([]);
    expect(loadGuestWishlist(null)).toEqual([]);
    expect(saveGuestWishlist([{ productId: id(1) }], null)).toBe(false);
  });
});
