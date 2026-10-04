import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatDay,
  formatDayRange,
  formatDeadline,
  secondsLeft,
  splitDuration,
} from "./dates";

describe("calendar days", () => {
  it("prints a day as written, whatever the device time zone", () => {
    expect(formatDay("2026-10-05", "en")).toBe("5 October");
    expect(formatDay("2026-10-05", "de")).toBe("5. Oktober");
    expect(formatDay("2026-10-05", "en", { year: true })).toBe(
      "5 October 2026",
    );
    expect(formatDay("2026-01-01", "de", { year: true })).toBe(
      "1. Januar 2026",
    );
  });

  it("prints a delivery window in one month", () => {
    expect(formatDayRange("2026-10-19", "2026-10-21", "en")).toBe(
      "19–\u206021 October",
    );
    expect(formatDayRange("2026-10-19", "2026-10-21", "de")).toBe(
      "19.–\u206021. Oktober",
    );
  });

  it("prints a delivery window across months", () => {
    expect(formatDayRange("2026-09-30", "2026-10-02", "en")).toBe(
      "30 September – 2 October",
    );
    expect(formatDayRange("2026-09-30", "2026-10-02", "de")).toBe(
      "30. September – 2. Oktober",
    );
  });

  it("prints both years when the window crosses the new year", () => {
    expect(formatDayRange("2026-12-30", "2027-01-02", "de")).toBe(
      "30. Dezember 2026 – 2. Januar 2027",
    );
  });

  it("can add the weekday", () => {
    expect(formatDay("2026-10-05", "en", { weekday: true })).toBe(
      "Mon 5 October",
    );
    expect(formatDay("2026-10-05", "de", { weekday: true })).toBe(
      "Mo., 5. Oktober",
    );
  });

  it("prints one day when the window is a single day", () => {
    expect(formatDayRange("2026-10-19", "2026-10-19", "en")).toBe("19 October");
  });

  it("refuses anything that is not a calendar day", () => {
    expect(() => formatDay("2026-10-05T10:00:00Z", "en")).toThrow(RangeError);
  });
});

describe("date-times in German time", () => {
  it("prints the order deadline in Europe/Berlin (summer time)", () => {
    // 21:59 UTC is 23:59 in Berlin in September.
    expect(formatDeadline("2026-09-26T21:59:00.000Z", "en")).toBe(
      "Sat 26 Sep, 23:59",
    );
    expect(formatDeadline("2026-09-26T21:59:00.000Z", "de")).toBe(
      "Sa., 26. Sept., 23:59 Uhr",
    );
  });

  it("prints the order deadline in Europe/Berlin (winter time)", () => {
    // 22:59 UTC is 23:59 in Berlin in December.
    expect(formatDeadline("2026-12-04T22:59:00.000Z", "en")).toBe(
      "Fri 4 Dec, 23:59",
    );
  });

  it("puts a late-evening UTC time on the right German day", () => {
    // 22:30 UTC on 30 June is 00:30 on 1 July in Berlin.
    expect(formatDate("2026-06-30T22:30:00.000Z", "en")).toBe("1 July 2026");
    expect(formatDate("2026-06-30T22:30:00.000Z", "de")).toBe("1. Juli 2026");
  });

  it("prints date and time", () => {
    expect(formatDateTime("2026-09-28T10:15:00.000Z", "en")).toBe(
      "28 Sep 2026, 12:15",
    );
    expect(formatDateTime("2026-09-28T10:15:00.000Z", "de")).toBe(
      "28. Sept. 2026, 12:15 Uhr",
    );
  });
});

describe("countdown", () => {
  it("splits seconds into days, hours, minutes, seconds", () => {
    expect(splitDuration(172_740)).toEqual({
      days: 1,
      hours: 23,
      minutes: 59,
      seconds: 0,
    });
    expect(splitDuration(59)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 59,
    });
    expect(splitDuration(-5)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });

  it("counts down from the server's number, not the device clock", () => {
    expect(secondsLeft(600, 1_000, 1_000)).toBe(600);
    expect(secondsLeft(600, 1_000, 61_000)).toBe(540);
    expect(secondsLeft(600, 1_000, 601_500)).toBe(0);
    expect(secondsLeft(600, 1_000, 9_999_999)).toBe(0);
  });

  it("never gains time when the clock jumps back", () => {
    expect(secondsLeft(600, 5_000, 1_000)).toBe(600);
  });
});
