import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./dates";

describe("date-times in German time", () => {
  it("puts a late-evening UTC time on the right German day", () => {
    // 22:30 UTC on 30 June is 00:30 on 1 July in Berlin.
    expect(formatDate("2026-06-30T22:30:00.000Z", "en")).toBe("1 July 2026");
    expect(formatDate("2026-06-30T22:30:00.000Z", "de")).toBe("1. Juli 2026");
  });

  it("stays on the German day in winter time too", () => {
    // 22:59 UTC on 4 December is 23:59 in Berlin, still the same day.
    expect(formatDate("2026-12-04T22:59:00.000Z", "en")).toBe(
      "4 December 2026",
    );
    // 23:30 UTC is 00:30 the next day.
    expect(formatDate("2026-12-04T23:30:00.000Z", "de")).toBe(
      "5. Dezember 2026",
    );
  });

  it("prints date and time", () => {
    expect(formatDateTime("2026-09-28T10:15:00.000Z", "en")).toBe(
      "28 Sep 2026, 12:15",
    );
    expect(formatDateTime("2026-09-28T10:15:00.000Z", "de")).toBe(
      "28. Sept. 2026, 12:15 Uhr",
    );
  });

  it("refuses anything that is not a date-time", () => {
    expect(() => formatDate("not a date", "en")).toThrow(RangeError);
  });
});
