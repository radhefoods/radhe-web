import { describe, expect, it } from "vitest";
import {
  centsToDecimalString,
  formatBasePrice,
  formatDiscount,
  formatMoney,
  formatPercent,
} from "./money";

// Intl separates number and currency with a no-break space in German.
const NBSP = "\u00a0";

describe("centsToDecimalString", () => {
  it("writes cents as an exact decimal", () => {
    expect(centsToDecimalString(1999)).toBe("19.99");
    expect(centsToDecimalString(5)).toBe("0.05");
    expect(centsToDecimalString(0)).toBe("0.00");
    expect(centsToDecimalString(100)).toBe("1.00");
    expect(centsToDecimalString(-250)).toBe("-2.50");
    expect(centsToDecimalString(1_000_000_000)).toBe("10000000.00");
  });

  it("refuses amounts that are not whole cents", () => {
    expect(() => centsToDecimalString(19.99)).toThrow(RangeError);
    expect(() => centsToDecimalString(Number.NaN)).toThrow(RangeError);
  });
});

describe("formatMoney", () => {
  it("prints English prices with the sign in front", () => {
    expect(formatMoney(1999, "en")).toBe("€19.99");
    expect(formatMoney(0, "en")).toBe("€0.00");
    expect(formatMoney(499, "en")).toBe("€4.99");
    expect(formatMoney(123456, "en")).toBe("€1,234.56");
  });

  it("prints German prices with a comma and the sign behind", () => {
    expect(formatMoney(1999, "de")).toBe(`19,99${NBSP}€`);
    expect(formatMoney(0, "de")).toBe(`0,00${NBSP}€`);
    expect(formatMoney(123456, "de")).toBe(`1.234,56${NBSP}€`);
  });

  it("does not lose a cent on amounts floats get wrong", () => {
    // 0.1 + 0.2 territory: these must print exactly as given.
    expect(formatMoney(1005, "en")).toBe("€10.05");
    expect(formatMoney(2995, "de")).toBe(`29,95${NBSP}€`);
    expect(formatMoney(100_000_001, "en")).toBe("€1,000,000.01");
  });

  it("prints credits with a minus", () => {
    expect(formatMoney(-1299, "en")).toBe("-€12.99");
    expect(formatMoney(-1299, "de")).toBe(`-12,99${NBSP}€`);
  });
});

describe("formatBasePrice", () => {
  it("names the unit per language", () => {
    expect(formatBasePrice({ amount: 400, per: "kg" }, "en")).toBe(
      "€4.00 / kg",
    );
    expect(formatBasePrice({ amount: 400, per: "kg" }, "de")).toBe(
      `4,00${NBSP}€ / kg`,
    );
    expect(formatBasePrice({ amount: 25, per: "pcs" }, "de")).toBe(
      `0,25${NBSP}€ / Stk.`,
    );
    expect(formatBasePrice({ amount: 199, per: "l" }, "en")).toBe("€1.99 / l");
  });
});

describe("formatPercent and formatDiscount", () => {
  it("follows the conventions of each language", () => {
    expect(formatPercent(7, "en")).toBe("7%");
    expect(formatPercent(19, "de")).toBe(`19${NBSP}%`);
    expect(formatDiscount(20, "en")).toBe("\u221220%");
    expect(formatDiscount(20, "de")).toBe(`\u221220${NBSP}%`);
  });
});
