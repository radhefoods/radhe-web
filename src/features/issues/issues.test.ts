import { describe, expect, it } from "vitest";
import { daysLeft, issueValue } from "./issues";

describe("problem reports", () => {
  it("counts the whole days left to report, never below zero", () => {
    const now = Date.parse("2026-11-01T10:00:00Z");
    expect(daysLeft("2026-11-13T10:00:00Z", now)).toBe(12);
    expect(daysLeft("2026-11-01T18:00:00Z", now)).toBe(1);
    expect(daysLeft("2026-11-01T10:00:00Z", now)).toBe(0);
    expect(daysLeft("2026-10-30T10:00:00Z", now)).toBe(0);
  });

  it("adds up what the named units are worth", () => {
    expect(issueValue([])).toBe(0);
    expect(
      issueValue([
        { quantity: 1, unitPrice: 239 },
        { quantity: 2, unitPrice: 100 },
      ]),
    ).toBe(439);
  });
});
