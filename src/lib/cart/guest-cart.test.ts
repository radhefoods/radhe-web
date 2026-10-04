import { describe, expect, it } from "vitest";
import {
  CART_MAX_LINES,
  CART_MAX_QUANTITY,
  GUEST_CART_KEY,
  addQuantity,
  clampToOrdering,
  clearGuestCart,
  loadGuestCart,
  quantityOf,
  removeItem,
  sanitizeCart,
  saveGuestCart,
  setQuantity,
  totalUnits,
} from "./guest-cart";

const A = "66e9f0a1b2c3d4e5f6a7b8c9";
const B = "66e9f0a1b2c3d4e5f6a7b8ca";
const C = "66e9f0a1b2c3d4e5f6a7b8cb";

function id(n: number): string {
  return n.toString(16).padStart(24, "0");
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("sanitizeCart", () => {
  it("keeps valid lines", () => {
    expect(sanitizeCart([{ productId: A, quantity: 2 }])).toEqual([
      { productId: A, quantity: 2 },
    ]);
  });

  it("drops what the API would reject", () => {
    expect(
      sanitizeCart([
        { productId: "not-an-id", quantity: 1 },
        { productId: A, quantity: 0 },
        { productId: B, quantity: 1.5 },
        { productId: C, quantity: CART_MAX_QUANTITY + 1 },
        { productId: A, quantity: "2" },
        null,
        "text",
      ]),
    ).toEqual([]);
  });

  it("keeps the first of duplicate products", () => {
    expect(
      sanitizeCart([
        { productId: A, quantity: 2 },
        { productId: A, quantity: 5 },
      ]),
    ).toEqual([{ productId: A, quantity: 2 }]);
  });

  it("strips fields the API does not know", () => {
    expect(sanitizeCart([{ productId: A, quantity: 1, price: 1 }])).toEqual([
      { productId: A, quantity: 1 },
    ]);
  });

  it("cuts the cart at the maximum number of lines", () => {
    const many = Array.from({ length: CART_MAX_LINES + 20 }, (_, i) => ({
      productId: id(i + 1),
      quantity: 1,
    }));
    expect(sanitizeCart(many)).toHaveLength(CART_MAX_LINES);
  });

  it("answers an empty cart for anything that is not a list", () => {
    expect(sanitizeCart(undefined)).toEqual([]);
    expect(sanitizeCart({ items: [] })).toEqual([]);
  });
});

describe("changing quantities", () => {
  it("adds a new product", () => {
    expect(setQuantity([], A, 2)).toEqual({
      ok: true,
      cart: [{ productId: A, quantity: 2 }],
    });
  });

  it("replaces the quantity of a product in the cart", () => {
    const cart = [
      { productId: A, quantity: 2 },
      { productId: B, quantity: 1 },
    ];
    expect(setQuantity(cart, A, 5)).toEqual({
      ok: true,
      cart: [
        { productId: A, quantity: 5 },
        { productId: B, quantity: 1 },
      ],
    });
  });

  it("removes a product at quantity zero or below", () => {
    const cart = [{ productId: A, quantity: 2 }];
    expect(setQuantity(cart, A, 0)).toEqual({ ok: true, cart: [] });
    expect(setQuantity(cart, A, -3)).toEqual({ ok: true, cart: [] });
  });

  it("cuts the quantity at the maximum of the API", () => {
    expect(setQuantity([], A, 99_999)).toEqual({
      ok: true,
      cart: [{ productId: A, quantity: CART_MAX_QUANTITY }],
    });
  });

  it("refuses a new line in a full cart, but still changes existing ones", () => {
    const full = Array.from({ length: CART_MAX_LINES }, (_, i) => ({
      productId: id(i + 1),
      quantity: 1,
    }));
    expect(setQuantity(full, A, 1)).toEqual({ ok: false, reason: "cart_full" });
    const changed = setQuantity(full, id(1), 3);
    expect(changed.ok && changed.cart[0]).toEqual({
      productId: id(1),
      quantity: 3,
    });
  });

  it("does not change the cart it was given", () => {
    const cart = Object.freeze([Object.freeze({ productId: A, quantity: 2 })]);
    setQuantity(cart, A, 3);
    addQuantity(cart, B, 1);
    removeItem(cart, A);
    expect(cart).toEqual([{ productId: A, quantity: 2 }]);
  });

  it("adds to what is there", () => {
    const first = addQuantity([], A, 1);
    const second = first.ok ? addQuantity(first.cart, A, 2) : first;
    expect(second).toEqual({ ok: true, cart: [{ productId: A, quantity: 3 }] });
  });

  it("counts units and reads quantities", () => {
    const cart = [
      { productId: A, quantity: 2 },
      { productId: B, quantity: 3 },
    ];
    expect(totalUnits(cart)).toBe(5);
    expect(quantityOf(cart, B)).toBe(3);
    expect(quantityOf(cart, C)).toBe(0);
    expect(removeItem(cart, A)).toEqual([{ productId: B, quantity: 3 }]);
  });
});

describe("clampToOrdering", () => {
  it("keeps the quantity inside the limits of the product", () => {
    expect(clampToOrdering(0, { minQuantity: 1, maxQuantity: 10 })).toBe(1);
    expect(clampToOrdering(50, { minQuantity: 1, maxQuantity: 10 })).toBe(10);
    expect(clampToOrdering(4, { minQuantity: 2, maxQuantity: null })).toBe(4);
    expect(clampToOrdering(1, { minQuantity: 2, maxQuantity: null })).toBe(2);
  });

  it("falls back to the limits of the cart", () => {
    expect(clampToOrdering(5, null)).toBe(5);
    expect(clampToOrdering(99_999, null)).toBe(CART_MAX_QUANTITY);
  });

  it("answers the minimum when fewer units are left than the minimum", () => {
    expect(clampToOrdering(3, { minQuantity: 2, maxQuantity: 1 })).toBe(2);
  });
});

describe("storage", () => {
  it("stores and loads the cart", () => {
    const storage = memoryStorage();
    expect(saveGuestCart([{ productId: A, quantity: 2 }], storage)).toBe(true);
    expect(loadGuestCart(storage)).toEqual([{ productId: A, quantity: 2 }]);
  });

  it("removes the entry when the cart is empty", () => {
    const storage = memoryStorage({ [GUEST_CART_KEY]: "[]" });
    saveGuestCart([], storage);
    expect(storage.data.has(GUEST_CART_KEY)).toBe(false);
  });

  it("survives broken or foreign content", () => {
    const broken = memoryStorage({ [GUEST_CART_KEY]: "{oops" });
    const foreign = memoryStorage({ [GUEST_CART_KEY]: '{"a":1}' });
    expect(loadGuestCart(broken)).toEqual([]);
    expect(loadGuestCart(foreign)).toEqual([]);
  });

  it("works without storage (blocked, or on the server)", () => {
    expect(loadGuestCart(null)).toEqual([]);
    expect(saveGuestCart([{ productId: A, quantity: 1 }], null)).toBe(false);
    expect(() => clearGuestCart(null)).not.toThrow();
  });

  it("reports a refused write instead of throwing", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    expect(saveGuestCart([{ productId: A, quantity: 1 }], storage)).toBe(false);
  });

  it("clears the cart", () => {
    const storage = memoryStorage();
    saveGuestCart([{ productId: A, quantity: 1 }], storage);
    clearGuestCart(storage);
    expect(loadGuestCart(storage)).toEqual([]);
  });
});
