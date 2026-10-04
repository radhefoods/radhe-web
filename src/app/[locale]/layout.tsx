import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { Suspense } from "react";
import { getMessages, getTranslations } from "next-intl/server";
import {
  COOKIE_NOTICE_SCRIPT,
  CookieNotice,
} from "@/components/shell/cookie-notice";
import { LocaleAlternatesProvider } from "@/components/shell/locale-switcher";
import { NavigationProgress } from "@/components/shell/navigation-progress";
import { env } from "@/config/env";
import { getCargo } from "@/features/catalogue/data";
import { Providers } from "@/features/providers";
import { clientMessages } from "@/i18n/client-messages";
import { localeOf } from "@/i18n/locale";
import { routing } from "@/i18n/routing";
import { instrumentSans, instrumentSerif } from "../fonts";
import "../globals.css";

/** The logo on white, for links shared in chats and social networks. */
const SOCIAL_IMAGE = {
  url: "/brand/radhe-social-1200x630.jpg",
  width: 1200,
  height: 630,
  alt: "Radhe Foods",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "site" });
  return {
    metadataBase: new URL(env.siteUrl),
    title: { default: t("name"), template: `%s | ${t("name")}` },
    description: t("tagline"),
    applicationName: t("name"),
    formatDetection: { telephone: false, email: false, address: false },
    openGraph: {
      type: "website",
      siteName: t("name"),
      locale: locale === "de" ? "de_DE" : "en_GB",
      // Pages with their own picture (products) replace this one.
      images: [SOCIAL_IMAGE],
    },
    twitter: { card: "summary_large_image", images: [SOCIAL_IMAGE.url] },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const locale = await localeOf(params);
  const [messages, cargo, t] = await Promise.all([
    getMessages(),
    getCargo(locale),
    getTranslations("common"),
  ]);

  return (
    <html
      lang={locale}
      className={`${instrumentSans.variable} ${instrumentSerif.variable}`}
      // The script below marks <html> before React takes over the page.
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col">
        <script dangerouslySetInnerHTML={{ __html: COOKIE_NOTICE_SCRIPT }} />
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-blue-900 px-4 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider messages={clientMessages(messages)}>
          {/* Reads the query of the address, which only the browser knows. */}
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          <Providers cargo={cargo}>
            <LocaleAlternatesProvider>{children}</LocaleAlternatesProvider>
            <CookieNotice />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
