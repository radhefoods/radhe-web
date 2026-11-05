import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { Suspense } from "react";
import { preconnect } from "react-dom";
import { getMessages, getTranslations } from "next-intl/server";
import {
  COOKIE_NOTICE_SCRIPT,
  CookieNotice,
} from "@/components/shell/cookie-notice";
import { LocaleAlternatesProvider } from "@/components/shell/locale-switcher";
import { NavigationProgress } from "@/components/shell/navigation-progress";
import { ReferralCapture } from "@/components/shell/referral-capture";
import { env } from "@/config/env";
import { Providers } from "@/features/providers";
import { clientMessages } from "@/i18n/client-messages";
import { localeOf } from "@/i18n/locale";
import { routing } from "@/i18n/routing";
import { SOCIAL_IMAGE, sharedOpenGraph } from "@/lib/seo/open-graph";
import { inter } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#f1f6f1",
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
    // Pages with their own picture (products, posts) replace the logo.
    openGraph: { type: "website", ...(await sharedOpenGraph(locale)) },
    twitter: { card: "summary_large_image", images: [SOCIAL_IMAGE.url] },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const locale = await localeOf(params);
  // The browser's first calls (who is here, the cart) find the connection
  // to the API open: with the cookies, as those calls are made.
  preconnect(env.apiUrl, { crossOrigin: "use-credentials" });
  const [messages, t] = await Promise.all([
    getMessages(),
    getTranslations("common"),
  ]);

  return (
    <html
      lang={locale}
      className={inter.variable}
      // The script below marks <html> before React takes over the page.
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col">
        <script dangerouslySetInnerHTML={{ __html: COOKIE_NOTICE_SCRIPT }} />
        <a
          href="#main"
          className="bg-leaf-900 sr-only z-50 rounded-full px-4 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider messages={clientMessages(messages)}>
          {/* Reads the query of the address, which only the browser knows. */}
          <Suspense fallback={null}>
            <NavigationProgress />
            <ReferralCapture />
          </Suspense>
          <Providers>
            <LocaleAlternatesProvider>{children}</LocaleAlternatesProvider>
            <CookieNotice />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
