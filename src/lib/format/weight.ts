import type { Locale } from "@/i18n/routing";
import type { Grams } from "@/lib/api/types";

// Weights are whole grams everywhere. The API weighs the packs, packs the
// boxes and says how much room is left; nothing in the shop adds weights
// up. This module only prints them.

/**
 * The number format of a weight: "7.5" on English pages, "7,5" on German
 * ones. Not the `en-DE` of the prices: that one prints plain numbers with a
 * decimal comma, and a weight would read differently from the price next
 * to it.
 */
const NUMBER_LOCALE: Record<Locale, string> = { en: "en-GB", de: "de-DE" };

/** Keeps the number and its unit on one line. */
const NBSP = " ";

const formatters = new Map<Locale, Intl.NumberFormat>();

function formatter(locale: Locale): Intl.NumberFormat {
  let instance = formatters.get(locale);
  if (!instance) {
    instance = new Intl.NumberFormat(NUMBER_LOCALE[locale], {
      maximumFractionDigits: 1,
    });
    formatters.set(locale, instance);
  }
  return instance;
}

/**
 * `7500` → "7.5 kg" (en) or "7,5 kg" (de): kilograms with at most one
 * decimal, and grams below a kilogram ("850 g").
 *
 * `round: "down"` is for the room that is left in a box: it never says
 * more than there is.
 */
export function formatWeight(
  grams: Grams,
  locale: Locale,
  { round = "nearest" }: { round?: "nearest" | "down" } = {},
): string {
  const whole = Number.isFinite(grams) ? Math.max(0, Math.trunc(grams)) : 0;
  if (whole < 1000) return `${whole}${NBSP}g`;
  // Tenths of a kilogram as a whole number first, so that no binary
  // fraction decides the last digit (41,050 g is "41.1 kg").
  const tenths =
    round === "down" ? Math.floor(whole / 100) : Math.round(whole / 100);
  return `${formatter(locale).format(tenths / 10)}${NBSP}kg`;
}
