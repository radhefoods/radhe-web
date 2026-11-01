import { describe, expect, it } from "vitest";
import {
  forgetGuestToken,
  isGuestToken,
  rememberGuestToken,
  resolveGuestToken,
  storedGuestToken,
} from "./guest-token";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    keys: () => [...map.keys()],
  };
}

const TOKEN = "k7Q3xM9p_abcDEF-0123456789";

describe("the token of a guest order", () => {
  it("accepts what a URL-safe token looks like and nothing else", () => {
    expect(isGuestToken(TOKEN)).toBe(true);
    expect(isGuestToken("short")).toBe(false);
    expect(isGuestToken("has space in it")).toBe(false);
    expect(isGuestToken("with/slash/and+plus=")).toBe(false);
    expect(isGuestToken(null)).toBe(false);
    expect(isGuestToken(42)).toBe(false);
  });

  it("is kept per order, whatever the case of the number", () => {
    const storage = memoryStorage();
    rememberGuestToken("rf-1085", TOKEN, storage);
    expect(storedGuestToken("RF-1085", storage)).toBe(TOKEN);
    expect(storedGuestToken("RF-1086", storage)).toBeNull();
    expect(storage.keys()).toEqual(["rf.guest-order.v1:RF-1085"]);
    forgetGuestToken("RF-1085", storage);
    expect(storedGuestToken("RF-1085", storage)).toBeNull();
  });

  it("never keeps something that is not a token", () => {
    const storage = memoryStorage();
    rememberGuestToken("RF-1085", "nope", storage);
    storage.setItem("rf.guest-order.v1:RF-1086", "bad value!");
    expect(storedGuestToken("RF-1085", storage)).toBeNull();
    expect(storedGuestToken("RF-1086", storage)).toBeNull();
  });

  it("prefers the token of the address and falls back to the kept one", () => {
    const storage = memoryStorage();
    rememberGuestToken("RF-1085", TOKEN, storage);
    expect(resolveGuestToken("RF-1085", "other_token_0123", storage)).toBe(
      "other_token_0123",
    );
    expect(resolveGuestToken("RF-1085", null, storage)).toBe(TOKEN);
    expect(resolveGuestToken("RF-1085", "?", storage)).toBe(TOKEN);
    expect(resolveGuestToken("RF-1099", undefined, storage)).toBeNull();
  });

  it("works without storage", () => {
    expect(() => rememberGuestToken("RF-1085", TOKEN, null)).not.toThrow();
    expect(storedGuestToken("RF-1085", null)).toBeNull();
    expect(resolveGuestToken("RF-1085", TOKEN, null)).toBe(TOKEN);
  });
});
