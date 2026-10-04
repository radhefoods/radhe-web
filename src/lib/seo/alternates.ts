import type { Metadata } from "next";
import { env } from "@/config/env";
import { getPathname } from "@/i18n/navigation";
import { defaultLocale, locales, type Locale } from "@/i18n/routing";

type Href = Parameters<typeof getPathname>[0]["href"];

/** The public address of a path of the shop. */
export function absoluteUrl(path: string): string {
  return `${env.siteUrl}${path === "/" ? "" : path}`;
}

/** The public address of a page in one language. */
export function pageUrl(href: Href, locale: Locale): string {
  return absoluteUrl(getPathname({ href, locale }));
}

/**
 * Canonical address and the same page in the other language, for
 * `<link rel="canonical">` and `hreflang`. `x-default` is English, the
 * language of the shop when nothing else is known.
 *
 * @param hrefs the page per language; pages with translated slugs (products,
 *              categories) differ, all others pass the same href twice
 */
export function alternates(
  locale: Locale,
  hrefs: Record<Locale, Href>,
): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const other of locales) languages[other] = pageUrl(hrefs[other], other);
  languages["x-default"] = pageUrl(hrefs[defaultLocale], defaultLocale);
  return { canonical: pageUrl(hrefs[locale], locale), languages };
}

/** The same page in every language. */
export function sameHref(href: Href): Record<Locale, Href> {
  return Object.fromEntries(locales.map((l) => [l, href])) as Record<
    Locale,
    Href
  >;
}
