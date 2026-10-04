import type { Locale } from "@/i18n/routing";
import type { CalendarDay, IsoDateTime } from "@/lib/api/types";

// Dates of the API are UTC; the business lives in German time. Every
// date-time is printed in Europe/Berlin, whatever the device is set to, so a
// deadline reads the same for everyone. Calendar days (`YYYY-MM-DD`) are
// days, not moments: they are printed as written.
//
// The words (months, weekdays) and the punctuation come from the tables
// below, not from the browser: Intl spells them differently between engines
// and versions ("Sep" / "Sept", thin spaces around dashes), which would make
// the server and the browser disagree about the same page.

export const BUSINESS_TIME_ZONE = "Europe/Berlin";

const MONTHS: Record<Locale, { long: string[]; short: string[] }> = {
  en: {
    long: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    short: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
  },
  de: {
    long: [
      "Januar",
      "Februar",
      "März",
      "April",
      "Mai",
      "Juni",
      "Juli",
      "August",
      "September",
      "Oktober",
      "November",
      "Dezember",
    ],
    short: [
      "Jan.",
      "Feb.",
      "März",
      "Apr.",
      "Mai",
      "Juni",
      "Juli",
      "Aug.",
      "Sept.",
      "Okt.",
      "Nov.",
      "Dez.",
    ],
  },
};

// Index 0 is Sunday, as in `Date.prototype.getUTCDay`.
const WEEKDAYS: Record<Locale, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  de: ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."],
};

const EN_DASH = "–";
/** Invisible; forbids a line break where it stands (U+2060 WORD JOINER). */
const NO_BREAK = "\u2060";

interface DateParts {
  year: number;
  /** 0 to 11 */
  month: number;
  day: number;
  /** 0 is Sunday */
  weekday: number;
  hour: number;
  minute: number;
}

// Built when first needed: setting up a time zone costs the engine several
// milliseconds, which should not be spent while a page is starting.
let zoneFormatter: Intl.DateTimeFormat | undefined;
function businessZoneFormatter(): Intl.DateTimeFormat {
  zoneFormatter ??= new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  });
  return zoneFormatter;
}

/** The wall-clock parts of a moment in German time. */
function partsInBusinessZone(iso: IsoDateTime): DateParts {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Not a date-time: ${iso}`);
  }
  const values: Record<string, number> = {};
  for (const part of businessZoneFormatter().formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  const { year, month, day, hour, minute } = values;
  return {
    year,
    month: month - 1,
    day,
    hour,
    minute,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

function partsOfCalendarDay(day: CalendarDay): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new RangeError(`Not a calendar day: ${day}`);
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const dayOfMonth = Number(match[3]);
  return {
    year,
    month,
    day: dayOfMonth,
    hour: 0,
    minute: 0,
    weekday: new Date(Date.UTC(year, month, dayOfMonth)).getUTCDay(),
  };
}

function dayAndMonth(
  parts: DateParts,
  locale: Locale,
  month: "long" | "short",
): string {
  const name = MONTHS[locale][month][parts.month];
  return locale === "de" ? `${parts.day}. ${name}` : `${parts.day} ${name}`;
}

function clock(parts: DateParts): string {
  const hh = String(parts.hour).padStart(2, "0");
  const mm = String(parts.minute).padStart(2, "0");
  return `${hh}:${mm}`;
}

function withWeekday(parts: DateParts, locale: Locale, text: string): string {
  const weekday = WEEKDAYS[locale][parts.weekday];
  return locale === "de" ? `${weekday}, ${text}` : `${weekday} ${text}`;
}

/** "19 October 2026" / "19. Oktober 2026" */
export function formatDay(
  day: CalendarDay,
  locale: Locale,
  options: { year?: boolean; weekday?: boolean } = {},
): string {
  const parts = partsOfCalendarDay(day);
  let text = dayAndMonth(parts, locale, "long");
  if (options.year) text = `${text} ${parts.year}`;
  return options.weekday ? withWeekday(parts, locale, text) : text;
}

/**
 * A delivery window: "19–21 October" / "19.–21. Oktober"; across months
 * "30 September – 2 October"; a single day when start and end are the same.
 */
export function formatDayRange(
  start: CalendarDay,
  end: CalendarDay,
  locale: Locale,
): string {
  if (start === end) return formatDay(start, locale);
  const from = partsOfCalendarDay(start);
  const to = partsOfCalendarDay(end);
  if (from.year !== to.year) {
    return `${formatDay(start, locale, { year: true })} ${EN_DASH} ${formatDay(end, locale, { year: true })}`;
  }
  if (from.month !== to.month) {
    return `${formatDay(start, locale)} ${EN_DASH} ${formatDay(end, locale)}`;
  }
  const month = MONTHS[locale].long[to.month];
  // "17.–" at the end of a line and "19. Oktober" on the next reads badly:
  // the days stay together.
  return locale === "de"
    ? `${from.day}.${EN_DASH}${NO_BREAK}${to.day}. ${month}`
    : `${from.day}${EN_DASH}${NO_BREAK}${to.day} ${month}`;
}

/** An order deadline: "Fri 9 Oct, 23:59" / "Fr., 9. Okt., 23:59 Uhr". */
export function formatDeadline(iso: IsoDateTime, locale: Locale): string {
  const parts = partsInBusinessZone(iso);
  const day = withWeekday(parts, locale, dayAndMonth(parts, locale, "short"));
  return locale === "de"
    ? `${day}, ${clock(parts)} Uhr`
    : `${day}, ${clock(parts)}`;
}

/** "28 September 2026" / "28. September 2026", in German time. */
export function formatDate(iso: IsoDateTime, locale: Locale): string {
  const parts = partsInBusinessZone(iso);
  return `${dayAndMonth(parts, locale, "long")} ${parts.year}`;
}

/** "28 Sep 2026, 12:15" / "28. Sept. 2026, 12:15 Uhr", in German time. */
export function formatDateTime(iso: IsoDateTime, locale: Locale): string {
  const parts = partsInBusinessZone(iso);
  const text = `${dayAndMonth(parts, locale, "short")} ${parts.year}, ${clock(parts)}`;
  return locale === "de" ? `${text} Uhr` : text;
}

export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Splits a number of seconds for a countdown. Never negative. */
export function splitDuration(totalSeconds: number): DurationParts {
  const rest = Math.max(0, Math.floor(totalSeconds));
  return {
    days: Math.floor(rest / 86_400),
    hours: Math.floor((rest % 86_400) / 3_600),
    minutes: Math.floor((rest % 3_600) / 60),
    seconds: rest % 60,
  };
}

/**
 * Seconds left of a countdown the server started. The API gives
 * `closesInSeconds` computed on its clock; the browser only measures how
 * much time passed since that answer arrived, so a wrong device clock
 * cannot move the deadline.
 *
 * @param secondsAtReceipt `opensInSeconds` / `closesInSeconds` of the answer
 * @param receivedAt       the browser's monotonic time when it arrived (ms)
 * @param now              the browser's monotonic time now (ms)
 */
export function secondsLeft(
  secondsAtReceipt: number,
  receivedAt: number,
  now: number,
): number {
  const elapsed = Math.max(0, (now - receivedAt) / 1000);
  return Math.max(0, Math.floor(secondsAtReceipt - elapsed));
}
