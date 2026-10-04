import { env } from "@/config/env";
import { locales, type Locale } from "@/i18n/routing";
import { createSessionTransport } from "./session-transport";
import { createStoreApi } from "./store-api";

// The API as the browser uses it: cookies included, refresh-and-retry on an
// expired access token. Import this from client components only.

function documentLocale(): Locale | undefined {
  if (typeof document === "undefined") return undefined;
  const lang = document.documentElement.lang;
  return (locales as readonly string[]).includes(lang)
    ? (lang as Locale)
    : undefined;
}

export const session = createSessionTransport({
  baseUrl: env.apiUrl,
  defaultLocale: documentLocale,
});

export const api = createStoreApi(session.request);
