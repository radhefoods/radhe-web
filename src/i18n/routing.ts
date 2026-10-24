import { defineRouting } from "next-intl/routing";

export const locales = ["en", "de"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

/**
 * Every page of the shop, with its address per language. The keys are the
 * internal names used in code (`<Link href="/cart">`); customers see the
 * localized address (`/en/cart`, `/de/warenkorb`).
 *
 * Links in the emails of the API carry no language (`/unsubscribe/<token>`,
 * `/reset-password?token=<token>`, `/account/orders/<number>`,
 * `/products/<slug>`): the proxy sends them to the customer's language and
 * keeps path and query. The two pages that exist only for such a link have
 * one address in both languages, so the link in the email is the address.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  pathnames: {
    "/": "/",
    "/products": { en: "/products", de: "/produkte" },
    "/products/[slug]": { en: "/products/[slug]", de: "/produkte/[slug]" },
    "/category/[slug]": { en: "/category/[slug]", de: "/kategorie/[slug]" },
    "/categories": { en: "/categories", de: "/kategorien" },
    "/how-it-works": { en: "/how-it-works", de: "/so-funktionierts" },
    "/delivery-and-payment": {
      en: "/delivery-and-payment",
      de: "/lieferung-und-zahlung",
    },
    "/faq": "/faq",
    "/blog": "/blog",
    "/blog/[slug]": "/blog/[slug]",
    "/blog/category/[slug]": {
      en: "/blog/category/[slug]",
      de: "/blog/kategorie/[slug]",
    },
    "/blog/tag/[tag]": "/blog/tag/[tag]",
    "/cart": { en: "/cart", de: "/warenkorb" },
    "/checkout": { en: "/checkout", de: "/kasse" },
    "/sign-in": { en: "/sign-in", de: "/anmelden" },
    "/sign-up": { en: "/sign-up", de: "/registrieren" },
    "/forgot-password": { en: "/forgot-password", de: "/passwort-vergessen" },
    "/reset-password": "/reset-password",
    "/account": { en: "/account", de: "/konto" },
    "/account/orders": { en: "/account/orders", de: "/konto/bestellungen" },
    "/account/orders/[orderNumber]": {
      en: "/account/orders/[orderNumber]",
      de: "/konto/bestellungen/[orderNumber]",
    },
    "/account/orders/[orderNumber]/return": {
      en: "/account/orders/[orderNumber]/return",
      de: "/konto/bestellungen/[orderNumber]/ruecksendung",
    },
    "/account/invoices": { en: "/account/invoices", de: "/konto/rechnungen" },
    "/account/addresses": { en: "/account/addresses", de: "/konto/adressen" },
    "/account/profile": { en: "/account/profile", de: "/konto/profil" },
    "/wishlist": { en: "/wishlist", de: "/merkliste" },
    "/unsubscribe/[token]": "/unsubscribe/[token]",
    "/legal/terms": { en: "/legal/terms", de: "/rechtliches/agb" },
    "/legal/privacy": { en: "/legal/privacy", de: "/rechtliches/datenschutz" },
    "/legal/imprint": { en: "/legal/imprint", de: "/rechtliches/impressum" },
    "/legal/withdrawal": {
      en: "/legal/withdrawal",
      de: "/rechtliches/widerruf",
    },
    "/legal/cookies": { en: "/legal/cookies", de: "/rechtliches/cookies" },
  },
});

export type Pathname = keyof typeof routing.pathnames;
