import type { Locale } from "@/i18n/routing";
import type { IsoDateTime } from "@/lib/api/types";

// Dates of the API are UTC; the business lives in German time. Every
// date-time is printed in Europe/Berlin, whatever the device is set to, so
// the same moment reads the same for everyone.
//
// The words (months) and the punctuation come from the table below, not
// from the browser: Intl spells them differently between engines and
// versions ("Sep" / "Sept", thin spaces), which would make the server and
// the browser disagree about the same page.

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

interface DateParts {
  year: number;
  /** 0 to 11 */
  month: number;
  day: number;
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
  return { year, month: month - 1, day, hour, minute };
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
