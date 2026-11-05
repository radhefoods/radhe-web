import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";

/** The logo on white, for links shared in chats and social networks. */
export const SOCIAL_IMAGE = {
  url: "/brand/radhe-social-1200x630.jpg",
  width: 1200,
  height: 630,
  alt: "Radhe Foods",
};

/**
 * What the Open Graph block of every page carries: the name of the shop,
 * the language, and the logo picture for a page without one of its own.
 * Next.js merges metadata one level deep, so a page that sets `openGraph`
 * replaces the layout's block as a whole: it spreads this in first.
 */
export async function sharedOpenGraph(locale: Locale) {
  const t = await getTranslations({ locale, namespace: "site" });
  return {
    siteName: t("name"),
    locale: locale === "de" ? "de_DE" : "en_GB",
    images: [SOCIAL_IMAGE],
  };
}
