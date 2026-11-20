import { describe, expect, it } from "vitest";
import { formatWeight } from "./weight";

// The number and its unit stay on one line.
const NBSP = " ";

describe("formatWeight", () => {
  it("prints kilograms with at most one decimal", () => {
    expect(formatWeight(7500, "en")).toBe(`7.5${NBSP}kg`);
    expect(formatWeight(25000, "en")).toBe(`25${NBSP}kg`);
    expect(formatWeight(1000, "en")).toBe(`1${NBSP}kg`);
    expect(formatWeight(19900, "en")).toBe(`19.9${NBSP}kg`);
  });

  it("uses the number format of the page's language", () => {
    expect(formatWeight(7500, "de")).toBe(`7,5${NBSP}kg`);
    expect(formatWeight(41050, "de")).toBe(`41,1${NBSP}kg`);
    expect(formatWeight(1234500, "en")).toBe(`1,234.5${NBSP}kg`);
    expect(formatWeight(1234500, "de")).toBe(`1.234,5${NBSP}kg`);
  });

  it("rounds a half up without a float deciding it", () => {
    // 41.05 is not exact as a binary fraction.
    expect(formatWeight(41050, "en")).toBe(`41.1${NBSP}kg`);
    expect(formatWeight(2149, "en")).toBe(`2.1${NBSP}kg`);
    expect(formatWeight(2150, "en")).toBe(`2.2${NBSP}kg`);
  });

  it("prints grams below a kilogram", () => {
    expect(formatWeight(850, "en")).toBe(`850${NBSP}g`);
    expect(formatWeight(850, "de")).toBe(`850${NBSP}g`);
    expect(formatWeight(999, "en")).toBe(`999${NBSP}g`);
    expect(formatWeight(0, "en")).toBe(`0${NBSP}g`);
  });

  it("never says more room than there is when asked to round down", () => {
    expect(formatWeight(7560, "en", { round: "down" })).toBe(`7.5${NBSP}kg`);
    expect(formatWeight(7560, "en")).toBe(`7.6${NBSP}kg`);
    expect(formatWeight(19999, "de", { round: "down" })).toBe(`19,9${NBSP}kg`);
    expect(formatWeight(450, "en", { round: "down" })).toBe(`450${NBSP}g`);
  });

  it("prints nothing odd for a weight that cannot be one", () => {
    expect(formatWeight(-5, "en")).toBe(`0${NBSP}g`);
    expect(formatWeight(Number.NaN, "en")).toBe(`0${NBSP}g`);
  });
});
