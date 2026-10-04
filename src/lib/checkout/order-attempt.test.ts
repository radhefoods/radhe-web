import { describe, expect, it } from "vitest";
import type { LegalSummary } from "@/lib/api/types";
import {
  CHECKOUT_KEY_STORAGE,
  checkoutKey,
  clearCheckoutKey,
  consentVersions,
  missingLegalTypes,
  newIdempotencyKey,
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

describe("idempotency key", () => {
  it("has the format the API accepts", () => {
    expect(newIdempotencyKey()).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it("stays the same for every retry of one checkout", () => {
    const storage = memoryStorage();
    const first = checkoutKey(storage);
    expect(checkoutKey(storage)).toBe(first);
    expect(storage.data.get(CHECKOUT_KEY_STORAGE)).toBe(first);
  });

  it("survives a reload (the key comes back from storage)", () => {
    const storage = memoryStorage({ [CHECKOUT_KEY_STORAGE]: "abcdefgh-1234" });
    expect(checkoutKey(storage)).toBe("abcdefgh-1234");
  });

  it("is new after an order was answered", () => {
    const storage = memoryStorage();
    const first = checkoutKey(storage);
    clearCheckoutKey(storage);
    expect(checkoutKey(storage)).not.toBe(first);
  });

  it("replaces a stored value the API would refuse", () => {
    const storage = memoryStorage({ [CHECKOUT_KEY_STORAGE]: "bad key!" });
    expect(checkoutKey(storage)).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it("keeps one key in memory when storage is blocked", () => {
    clearCheckoutKey(null);
    const first = checkoutKey(null);
    expect(checkoutKey(null)).toBe(first);
    clearCheckoutKey(null);
    expect(checkoutKey(null)).not.toBe(first);
  });
});

describe("consent", () => {
  it("sends the versions of the published texts", () => {
    expect(consentVersions([legal("terms", 3), legal("privacy", 2)])).toEqual({
      terms: 3,
      privacy: 2,
    });
  });

  it("includes the pre-order terms when they are published", () => {
    expect(
      consentVersions([
        legal("terms", 3),
        legal("preorder_terms", 1),
        legal("privacy", 2),
      ]),
    ).toEqual({ terms: 3, preorder_terms: 1, privacy: 2 });
  });

  it("names the texts that must be published before ordering", () => {
    expect(missingLegalTypes([legal("terms", 1)])).toEqual(["privacy"]);
    expect(missingLegalTypes([])).toEqual(["terms", "privacy"]);
    expect(missingLegalTypes([legal("terms", 1), legal("privacy", 1)])).toEqual(
      [],
    );
  });
});
