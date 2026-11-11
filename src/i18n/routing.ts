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
 * `/guest/orders/<number>?token=<token>`, `/products/<slug>`): the proxy
 * sends them to the customer's language and keeps path and query. The
 * pages that exist only for such a link have one address in both
 * languages, so the link in the email is the address.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  // The pages and the sitemap name their other language themselves
  // (`alternates()`), with the slug of that language. The `Link` header of
  // next-intl would add a second set built from the address pattern: the
  // slug of this language under the other language's path, and an
  // `x-default` without a language, both of which only redirect.
  alternateLinks: false,
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
    "/reviews": { en: "/reviews", de: "/bewertungen" },
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
    "/account/orders/[orderNumber]/report": {
      en: "/account/orders/[orderNumber]/report",
      de: "/konto/bestellungen/[orderNumber]/problem-melden",
    },
    "/account/invoices": { en: "/account/invoices", de: "/konto/rechnungen" },
    "/account/addresses": { en: "/account/addresses", de: "/konto/adressen" },
    "/account/profile": { en: "/account/profile", de: "/konto/profil" },
    "/account/referrals": {
      en: "/account/referrals",
      de: "/konto/empfehlungen",
    },
    "/account/reviews": { en: "/account/reviews", de: "/konto/bewertungen" },
    "/account/coins": { en: "/account/coins", de: "/konto/coins" },
    "/account/reports": { en: "/account/reports", de: "/konto/meldungen" },
    "/account/reports/[issueNumber]": {
      en: "/account/reports/[issueNumber]",
      de: "/konto/meldungen/[issueNumber]",
    },
    "/wishlist": { en: "/wishlist", de: "/merkliste" },
    "/unsubscribe/[token]": "/unsubscribe/[token]",
    // The way back from Stripe and the links of the emails about a guest
    // order (doc 20) carry no language: one address in both.
    "/guest/orders/[orderNumber]": "/guest/orders/[orderNumber]",
    "/legal/terms": { en: "/legal/terms", de: "/rechtliches/agb" },
    "/legal/privacy": { en: "/legal/privacy", de: "/rechtliches/datenschutz" },
    "/legal/imprint": { en: "/legal/imprint", de: "/rechtliches/impressum" },
    "/legal/withdrawal": {
      en: "/legal/withdrawal",
      de: "/rechtliches/widerruf",
    },
    // The addresses of the six legal pages are the default ones of the
    // API (`doc/LEGAL_PAGES.md`); the cookie page is a page of the shop.
    "/legal/shipping": { en: "/legal/shipping", de: "/rechtliches/versand" },
    "/legal/refund-policy": {
      en: "/legal/refund-policy",
      de: "/rechtliches/rueckerstattung",
    },
    "/legal/cookies": { en: "/legal/cookies", de: "/rechtliches/cookies" },
  },
});

export type Pathname = keyof typeof routing.pathnames;
