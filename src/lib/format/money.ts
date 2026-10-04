import type { Locale } from "@/i18n/routing";
import type { BasePriceUnit, Cents } from "@/lib/api/types";

// Money is integer cents everywhere. Nothing in the shop adds, multiplies or
// rounds prices: the API gives every total. This module only prints them.

const INTL_LOCALE: Record<Locale, string> = {
  // English for customers in Germany: "€19.99", dates day first.
  en: "en-DE",
  de: "de-DE",
};

const formatters = new Map<Locale, Intl.NumberFormat>();

function formatter(locale: Locale): Intl.NumberFormat {
  let instance = formatters.get(locale);
  if (!instance) {
    instance = new Intl.NumberFormat(INTL_LOCALE[locale], {
      style: "currency",
      currency: "EUR",
    });
    formatters.set(locale, instance);
  }
  return instance;
}

/**
 * The amount as an exact decimal string ("19.99"), so that no float is
 * involved between the cents of the API and the printed price.
 */
export function centsToDecimalString(cents: Cents): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Not an amount in whole cents: ${cents}`);
  }
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const euros = Math.trunc(absolute / 100);
  const rest = String(absolute % 100).padStart(2, "0");
  return `${sign}${euros}.${rest}`;
}

/** `1999` → "€19.99" (en) or "19,99 €" (de). */
export function formatMoney(cents: Cents, locale: Locale): string {
  const decimal = centsToDecimalString(cents);
  // Intl accepts decimal strings exactly (ES2023); older engines convert the
  // string to a number first, which prints the same for two decimals.
  return formatter(locale).format(decimal as unknown as number);
}

const BASE_UNIT_LABEL: Record<Locale, Record<BasePriceUnit, string>> = {
  en: { kg: "kg", l: "l", pcs: "pc" },
  de: { kg: "kg", l: "l", pcs: "Stk." },
};

/** The price per kilogram, litre or piece: "€4.00 / kg", "4,00 € / kg". */
export function formatBasePrice(
  basePrice: { amount: Cents; per: BasePriceUnit },
  locale: Locale,
): string {
  return `${formatMoney(basePrice.amount, locale)} / ${BASE_UNIT_LABEL[locale][basePrice.per]}`;
}

/** `7` → "7%" (en) or "7 %" (de, with a no-break space). */
export function formatPercent(percent: number, locale: Locale): string {
  const number = new Intl.NumberFormat(INTL_LOCALE[locale], {
    maximumFractionDigits: 1,
  }).format(percent);
  return locale === "de" ? `${number} %` : `${number}%`;
}

/** The badge of a reduced product: "−20%" / "−20 %". */
export function formatDiscount(percent: number, locale: Locale): string {
  return `−${formatPercent(percent, locale)}`;
}
