import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type Locale } from "./routing";

/**
 * The language of a page or layout under `app/[locale]`. Call it first in
 * every one of them: it answers "not found" for anything that is not a
 * language of the shop (a request like `/favicon.ico` also lands in
 * `[locale]`), and it lets the page be rendered statically.
 *
 * Layouts and pages render at the same time, so the check in the layout
 * alone does not protect a page.
 */
export async function localeOf(
  params: Promise<{ locale: string }>,
): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}
