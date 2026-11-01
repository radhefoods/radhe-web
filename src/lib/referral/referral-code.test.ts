import { describe, expect, it } from "vitest";
import {
  REFERRAL_KEEP_MS,
  REFERRAL_STORAGE_KEY,
  forgetReferralCode,
  isReferralCode,
  rememberReferralCode,
  storedReferralCode,
} from "./referral-code";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const NOW = Date.parse("2026-11-01T12:00:00Z");

describe("the code of a referral link", () => {
  it("accepts 6 to 12 letters or digits", () => {
    expect(isReferralCode("K7Q3XM9P")).toBe(true);
    expect(isReferralCode("abc123")).toBe(true);
    expect(isReferralCode("short")).toBe(false);
    expect(isReferralCode("far-too-long-code")).toBe(false);
    expect(isReferralCode("with-dash")).toBe(false);
    expect(isReferralCode(null)).toBe(false);
  });

  it("is kept in capitals for 30 days, then forgotten", () => {
    const storage = memoryStorage();
    rememberReferralCode("k7q3xm9p", storage, NOW);
    expect(storedReferralCode(storage, NOW)).toBe("K7Q3XM9P");
    expect(storedReferralCode(storage, NOW + REFERRAL_KEEP_MS - 1)).toBe(
      "K7Q3XM9P",
    );
    expect(storedReferralCode(storage, NOW + REFERRAL_KEEP_MS)).toBeNull();
    // Once expired it is removed, so an older date does not bring it back.
    expect(storedReferralCode(storage, NOW)).toBeNull();
  });

  it("is replaced by a newer link and goes after the sign-up", () => {
    const storage = memoryStorage();
    rememberReferralCode("FIRST01", storage, NOW);
    rememberReferralCode("SECOND02", storage, NOW + 1000);
    expect(storedReferralCode(storage, NOW + 2000)).toBe("SECOND02");
    forgetReferralCode(storage);
    expect(storedReferralCode(storage, NOW + 2000)).toBeNull();
  });

  it("ignores what is not a code, in the address or in storage", () => {
    const storage = memoryStorage();
    rememberReferralCode("<script>", storage, NOW);
    expect(storedReferralCode(storage, NOW)).toBeNull();
    storage.setItem(REFERRAL_STORAGE_KEY, "not json");
    expect(storedReferralCode(storage, NOW)).toBeNull();
    storage.setItem(
      REFERRAL_STORAGE_KEY,
      JSON.stringify({ code: "bad code", expiresAt: NOW + 1 }),
    );
    expect(storedReferralCode(storage, NOW)).toBeNull();
  });

  it("works without storage", () => {
    expect(() => rememberReferralCode("K7Q3XM9P", null)).not.toThrow();
    expect(storedReferralCode(null)).toBeNull();
    expect(() => forgetReferralCode(null)).not.toThrow();
  });
});
