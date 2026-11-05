import { describe, expect, it } from "vitest";
import type { LegalSummary } from "@/lib/api/types";
import {
  CHECKOUT_KEY_STORAGE,
  CHECKOUT_ORDER_STORAGE,
  checkoutKey,
  clearCheckoutKey,
  consentVersions,
  missingLegalTypes,
  newIdempotencyKey,
  orderFingerprint,
} from "./order-attempt";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const legal = (type: LegalSummary["type"], version: number): LegalSummary => ({
  type,
  version,
  title: type,
  publishedAt: "2026-09-01T08:00:00.000Z",
});

/** What a customer orders: the request and the lines of the bill. */
const ORDER = {
  request: { addressId: "a1", expectedTotal: 3097, language: "en" },
  lines: [["v1", 2]],
};

describe("idempotency key", () => {
  it("has the format the API accepts", () => {
    expect(newIdempotencyKey()).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it("stays the same for every retry of one order", () => {
    const storage = memoryStorage();
    const first = checkoutKey(ORDER, storage);
    expect(checkoutKey({ ...ORDER }, storage)).toBe(first);
    expect(storage.data.get(CHECKOUT_KEY_STORAGE)).toBe(first);
  });

  it("survives a reload (the key comes back from storage)", () => {
    const storage = memoryStorage({
      [CHECKOUT_KEY_STORAGE]: "abcdefgh-1234",
      [CHECKOUT_ORDER_STORAGE]: orderFingerprint(ORDER),
    });
    expect(checkoutKey(ORDER, storage)).toBe("abcdefgh-1234");
  });

  it("is new after an order was answered", () => {
    const storage = memoryStorage();
    const first = checkoutKey(ORDER, storage);
    clearCheckoutKey(storage);
    expect(storage.data.size).toBe(0);
    expect(checkoutKey(ORDER, storage)).not.toBe(first);
  });

  it("is new for an order that is not the one the key was made for", () => {
    // The answer of the first attempt was lost; the customer then changed
    // the address, a quantity or the total: the old key would answer with
    // the order from before the change.
    const storage = memoryStorage();
    const first = checkoutKey(ORDER, storage);
    for (const changed of [
      { ...ORDER, request: { ...ORDER.request, addressId: "a2" } },
      { ...ORDER, request: { ...ORDER.request, expectedTotal: 3098 } },
      { ...ORDER, lines: [["v1", 3]] },
    ]) {
      const key = checkoutKey(changed, storage);
      expect(key).not.toBe(first);
      expect(checkoutKey(changed, storage)).toBe(key);
    }
  });

  it("replaces a key stored without the order it was made for", () => {
    const storage = memoryStorage({ [CHECKOUT_KEY_STORAGE]: "abcdefgh-1234" });
    expect(checkoutKey(ORDER, storage)).not.toBe("abcdefgh-1234");
  });

  it("replaces a stored value the API would refuse", () => {
    const storage = memoryStorage({
      [CHECKOUT_KEY_STORAGE]: "bad key!",
      [CHECKOUT_ORDER_STORAGE]: orderFingerprint(ORDER),
    });
    expect(checkoutKey(ORDER, storage)).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it("keeps one key in memory when storage is blocked", () => {
    clearCheckoutKey(null);
    const first = checkoutKey(ORDER, null);
    expect(checkoutKey(ORDER, null)).toBe(first);
    expect(checkoutKey({ ...ORDER, lines: [] }, null)).not.toBe(first);
    clearCheckoutKey(null);
    expect(checkoutKey(ORDER, null)).not.toBe(first);
  });

  it("names an order without keeping what it says", () => {
    const print = orderFingerprint({ email: "anna@example.com" });
    expect(print).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    expect(print).not.toContain("anna");
    expect(orderFingerprint({ email: "anna@example.com" })).toBe(print);
  });
});

describe("consent", () => {
  it("sends the versions of the published texts", () => {
    expect(consentVersions([legal("terms", 3), legal("privacy", 2)])).toEqual({
      terms: 3,
      privacy: 2,
    });
  });

  it("names the texts that must be published before ordering", () => {
    expect(missingLegalTypes([legal("terms", 1)])).toEqual(["privacy"]);
    expect(missingLegalTypes([])).toEqual(["terms", "privacy"]);
    expect(missingLegalTypes([legal("terms", 1), legal("privacy", 1)])).toEqual(
      [],
    );
  });
});
