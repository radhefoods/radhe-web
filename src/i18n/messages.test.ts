import { describe, expect, it } from "vitest";
import de from "../../messages/de.json";
import en from "../../messages/en.json";
import { API_ERROR_CODES } from "@/lib/api/errors";

// Both languages are first-class: a text that exists in one must exist in
// the other, and every error code of the API needs a sentence in both.

function keysOf(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keysOf(child, prefix ? `${prefix}.${key}` : key),
  );
}

function placeholdersOf(text: string): string[] {
  // `{name}` and the name of `{name, plural, ...}`; not the `#` or the
  // branches inside a plural.
  const names = new Set<string>();
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "{") {
      depth += 1;
      if (depth === 1) current = "";
    } else if (char === "}") {
      if (depth === 1 && current) names.add(current.split(",")[0].trim());
      depth -= 1;
    } else if (depth === 1) {
      current += char;
    }
  }
  return [...names].sort();
}

function valueAt(source: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown> | undefined)?.[key],
      source,
    );
}

describe("translations", () => {
  it("has the same texts in English and German", () => {
    expect(keysOf(de).sort()).toEqual(keysOf(en).sort());
  });

  it("uses the same placeholders in both languages", () => {
    for (const key of keysOf(en)) {
      const english = valueAt(en, key);
      const german = valueAt(de, key);
      expect(placeholdersOf(String(german)), key).toEqual(
        placeholdersOf(String(english)),
      );
    }
  });

  it("leaves no text empty", () => {
    for (const source of [en, de]) {
      for (const key of keysOf(source)) {
        expect(String(valueAt(source, key)).trim(), key).not.toBe("");
      }
    }
  });

  it("has a sentence for every error code of the API", () => {
    const codes = [...API_ERROR_CODES, "NETWORK_ERROR", "UNEXPECTED_RESPONSE"];
    for (const code of codes) {
      expect(en.errors, code).toHaveProperty(code);
      expect(de.errors, code).toHaveProperty(code);
    }
  });
});
