# Architecture overview

The shop is a Next.js application with the App Router. Its server renders the public pages (catalogue, blog, FAQ, legal texts) from answers of the API that it keeps for a few minutes; everything that belongs to one visitor (who is signed in, the cart, the wishlist, the checkout, the account) is read and changed in the browser, which talks to the API directly with the session cookies. The shop has no database and no secrets: prices, VAT, stock, bills and every rule of an order are the API's, and the shop displays them.

## Stack

Versions are those of `package.json`.

| Part | Package | Version | Used for |
| --- | --- | --- | --- |
| Framework | `next` | 16.4.5 | App Router, server components, `src/proxy.ts`; caching by `fetch` with `next.revalidate` (`cacheComponents` is not switched on in `next.config.ts`) |
| UI | `react`, `react-dom` | 19.2.8 | Server and client components |
| Language | `typescript` | ^5 | `strict`; the alias `@/` is `src/` (`tsconfig.json`) |
| Languages of the shop | `next-intl` | ^4.14.9 | English and German, localised addresses, typed texts |
| Styles | `tailwindcss`, `@tailwindcss/postcss` | ^4 | Utilities and the tokens of `src/app/globals.css` |
| Data in the browser | `@tanstack/react-query` | ^5.104.1 | Cache of every answer of the API the browser reads |
| Forms | `react-hook-form`, `@hookform/resolvers`, `zod` | ^7.89.0, ^5.9.1, ^4.6.7 | The address form and its schema |
| Primitives | `radix-ui` | ^1.6.7 | Accessible behaviour of sheets and tooltips |
| Icons | `lucide-react` | ^1.52.0 | Every icon |
| Markdown | `react-markdown`, `remark-gfm` | ^10.1.0, ^4.0.1 | Legal texts, FAQ answers, blog posts |
| Class names | `clsx`, `tailwind-merge` | ^2.1.1, ^3.7.0 | `cn` in `src/lib/cn.ts` |
| Unit tests | `vitest` | ^5.0.3 | `*.test.ts` beside the code, and the tests of the mock API |
| Browser tests | `@playwright/test`, `@axe-core/playwright` | ^1.63.0, ^4.13.0 | `e2e/` |
| Lint and format | `eslint`, `eslint-config-next`, `prettier`, `prettier-plugin-tailwindcss` | ^9, 16.4.5, ^3.9.9, ^0.8.1 | `npm run check` |
| Runtime | Node.js | 24 or newer (`engines`) | Both hosts |

`npm run build` is `next build`; `npm run build:webpack` is `next build --webpack`, the build Hostinger is given ([deployment](../deployment/README.md)).

## The repository

| Folder | Holds |
| --- | --- |
| `src/app` | The routes: layouts, pages, error pages, the sitemap, `robots.txt`, the web manifest, the icons, the health check, `src/app/globals.css` and `src/app/fonts.ts` |
| `src/components` | React components, one folder per area of the shop |
| `src/features` | What a feature knows without drawing it: server readers, state in the browser, query keys, rules |
| `src/lib` | Helpers no feature owns: the API client, formatting, addresses and search engines, storage in the browser |
| `src/i18n` | Languages, the table of addresses, navigation helpers, which texts travel to the browser |
| `src/config` | `src/config/env.ts`: the environment, read once ([configuration](configuration.md)) |
| `src/proxy.ts` | Sends a request to its language and maps a localised address to its page ([routing](routing.md)) |
| `messages/en.json`, `messages/de.json` | Every text of the interface, by namespace ([internationalisation](internationalization.md)) |
| `mocks/` | A stand-in for the API for development and tests: `mocks/server.ts`, fixtures in `mocks/data`, its own tests ([mock API](../development/mock-api.md)) |
| `e2e/` | Browser tests with Playwright ([testing](../development/testing.md)) |
| `scripts/` | `scripts/smoke.mjs` (starts the built shop and asks for pages), `scripts/check-content.mjs` (open placeholders of the legal files), `scripts/make-icons.mjs` (draws the icons) |
| `content/legal` | The cookie page, and the imprint and the right of withdrawal until the admin publishes them, as Markdown per language |
| `public/brand` | The logo in web sizes, the icons of the manifest, the picture for shared links |
| `docs/` | This documentation; `docs/tools/check-docs.mjs` checks it against the code |

### `src/components`

| Folder | Holds |
| --- | --- |
| `src/components/ui` | Base components that know nothing of the shop's data: button, chip, alert, field, stepper, sheet, disclosure, pagination, skeleton, tooltip |
| `src/components/shell` | The frame: header, category bar, search, language switch, footer, tab bar, phone menu, cookie notice, invitation notice, toasts, the line of a page on its way, the error page |
| `src/components/home` | Hero carousel, product rows, the row of a category, the delivery promise, customer reviews |
| `src/components/catalogue` | Product card, picture, price, add to cart, wishlist heart, the product page's parts, category cards, the product list with `src/components/catalogue/filters` |
| `src/components/cart` | The cart page, the bill, the boxes of an order, the cart bar of phones |
| `src/components/checkout` | The checkout page, the address form, the discount code, the coins |
| `src/components/wishlist` | The wishlist page and its lists |
| `src/components/auth` | Sign-in, sign-up, forgot and reset password |
| `src/components/account` | The account frame, overview, orders, payment, invoices, returns, reports, reviews, addresses, profile, referrals, coins, the guest order |
| `src/components/blog` | Post card, post picture, the list of posts |
| `src/components/legal` | Legal texts from the API and from the files, the Markdown renderer |
| `src/components/reviews` | Stars, review card, the summary of all reviews |
| `src/components/rewards` | The rules of the coins in words |
| `src/components/public` | The unsubscribe page |

### `src/features`

| Folder | Holds |
| --- | --- |
| `src/features/session` | Who is signed in: `useSession`, the hint, the session's query key |
| `src/features/cart` | `CartProvider`, `useCart`, `useBill`, the savings and the boxes of a bill, the fly-to-cart animation |
| `src/features/wishlist` | `WishlistProvider`, `useWishlist`, the named lists of a customer |
| `src/features/stock-alerts` | "Notify me": `StockAlertsProvider`, `useNotifyMe`, what a refusal of the API means |
| `src/features/catalogue` | Server readers of the catalogue, the state of a list in the address, facets, availability, the home page's queries, the groups of the navigation, the delivery promise |
| `src/features/content` | Server readers of the FAQ and the blog, the state of a blog list |
| `src/features/legal` | Server readers of the legal pages |
| `src/features/reviews` | Server reader of the published reviews, query keys, the state of the public list |
| `src/features/orders` | Query keys, status tones, the progress line, how an order is reached (account or guest token) |
| `src/features/issues` | Query keys and rules of problem reports |
| `src/features/account` | The overview and the coins of a customer as hooks |
| `src/features/auth` | Checks of email, password and names |
| `src/features/checkout` | The schema of the address form |

`src/features/providers.tsx` puts the query client, the cart and the wishlist around every page.

### `src/lib`

| Folder | Holds |
| --- | --- |
| `src/lib/api` | Types of the API, error codes, the HTTP transport, the session transport, every endpoint (`createStoreApi`), `serverApi` and `api` ([API](../api/README.md)) |
| `src/lib/format` | Money, dates, weights, phone numbers, product names, Markdown as plain words |
| `src/lib/seo` | Canonical and `hreflang` addresses, titles, Open Graph, structured data, the sitemap ([SEO](seo.md)) |
| `src/lib/navigation` | The checked way back after sign-in (`returnTo`), paths of the API as links of the shop |
| `src/lib/cart` | The visitor's cart in the browser |
| `src/lib/wishlist` | The visitor's wishlist in the browser |
| `src/lib/checkout` | The idempotency key of an order, the consent versions |
| `src/lib/orders` | The token of a guest order, kept for the tab |
| `src/lib/referral` | The code of a referral link, kept for 30 days |
| `src/lib/legal` | The legal pages: types, addresses, which have a file |
| `src/lib/catalogue` | Which pictures a pack size shows |

## Where code goes

| Code | Goes to | As the code shows |
| --- | --- | --- |
| A route | `src/app` | A `page.tsx` calls `localeOf` first, builds its metadata, loads server data through a reader of `src/features`, and composes components |
| Something that draws | `src/components` | Server components unless they need the browser; a file that does starts with `"use client"` |
| What the server reads from the API | `data.ts` of a feature (`src/features/catalogue/data.ts`, `src/features/content/data.ts`, `src/features/legal/data.ts`, `src/features/reviews/data.ts`) | Wrapped in React's `cache`, with the lifetime and tag of `src/lib/api/server.ts` |
| State in the browser and its hooks | `src/features` | `src/features/cart/cart.tsx`, `src/features/wishlist/wishlist.tsx`, `src/features/session/session.ts` |
| Query keys | The feature that owns the data | `src/features/orders/orders.ts`, `src/features/issues/issues.ts`, `src/features/reviews/reviews.ts`; a few keys used by one component sit in that component |
| A rule of one feature, as a pure function | `src/features` | `src/features/catalogue/listing-state.ts`, `src/features/cart/savings.ts`, `src/features/cart/shipping.ts` |
| A helper without a feature, or storage in the browser | `src/lib` | Nothing in `src/lib` imports from `src/features` or `src/components` |
| A test | Beside the file, as `*.test.ts` | `src/lib/cart/guest-cart.test.ts` |

Imports point one way: `src/app` uses components and features, components use features and `src/lib`, features use `src/lib`. The one import against it is a type: three features take `ChipTone` from `src/components/ui/chip.tsx`. `src/i18n` and `src/config` are used everywhere. More in [conventions](../development/conventions.md).

## How a request becomes a page

```text
GET /de/warenkorb
  │
  ├─ next.config.ts      headers (security, cache of /brand), then redirects
  │                      (bare domain → www, retired addresses)
  ├─ src/proxy.ts        no language in the address → redirect to /en… or /de…
  │                      localised address → the page: /de/warenkorb → [locale]/(shop)/cart
  ▼
src/app/[locale]/layout.tsx          localeOf(params): the language or "not found"
  │                                  <html lang>, base texts, Providers, cookie notice
  ▼
src/app/[locale]/(shop)/layout.tsx   categories, settings, published legal pages
  │                                  (serverApi, kept 300 s) → Header, Footer, TabBar
  ▼
src/app/[locale]/(shop)/cart/page.tsx
  │                                  server data of the page through src/features/*/data.ts
  │                                  → serverApi: public data, no cookies
  ▼
HTML with the frame and the public content
  │
  ▼
client components hydrate            useSession → GET /v1/store/me (only when this browser
                                     signed in before, or the page needs an account)
                                     useCart, useBill, useWishlist → api, with the cookies
```

The server never sees a session: the refresh cookie travels to the API's own auth routes only, so `serverApi` reads public data and the browser reads the rest ([authentication and security](authentication-and-security.md), [rendering and caching](rendering-and-caching.md)). One definition of the endpoints, `createStoreApi` in `src/lib/api/store-api.ts`, serves both sides: `serverApi` in `src/lib/api/server.ts` and `api` in `src/lib/api/browser.ts`.

## Around every page

`src/app` has no root `layout.tsx`: the layout of `[locale]` is the root layout and writes `<html>` and `<body>`. Listed from the outside in.

| Layer | File | What it gives |
| --- | --- | --- |
| Document | `src/app/[locale]/layout.tsx` | `<html lang>`, the font variable of Inter, the skip link, the script that hides a cookie notice already read, `preconnect` to the API, the default metadata |
| `NextIntlClientProvider` | `src/app/[locale]/layout.tsx` | The base texts for client components: `errors`, `language`, `common`, `nav`, `product`, `cart`, `cookieNotice`, `invitation` (`src/i18n/client-messages.ts`) |
| `NavigationProgress`, `ReferralCapture` | `src/components/shell/navigation-progress.tsx`, `src/components/shell/referral-capture.tsx` | The line while the next page loads; keeps `?ref=` of any address. Inside `Suspense`, because they read the query of the address |
| `Providers` | `src/features/providers.tsx` | `QueryClientProvider`, then `CartProvider`, then `WishlistProvider`; ends the session in memory when the refresh is refused |
| `LocaleAlternatesProvider` | `src/components/shell/locale-switcher.tsx` | Lets a page tell the language switch its address in the other language |
| `CookieNotice` | `src/components/shell/cookie-notice.tsx` | The notice, drawn with the page until it was read |
| Shop frame | `src/app/[locale]/(shop)/layout.tsx` | `StockAlertsProvider` (whether "Notify me" is offered, from the settings) around `Header`, `InvitationNotice`, `<main id="main">`, `Footer`, `CartProblem`, `WishlistProblem`, `StockAlertNotice`, `CartSummaryBar`, `TabBar` |
| Account frame | `src/app/[locale]/(shop)/account/layout.tsx` | Inside the shop frame: the texts of the account, `AccountShell` (navigation, and the way to sign-in for a visitor), `noindex` |
| Checkout frame | `src/app/[locale]/(checkout)/layout.tsx` | A header pill with the logo, "secure checkout", back to the cart and the language switch; the texts of the checkout |
| Plain frame | `src/app/[locale]/(plain)/layout.tsx` | The logo and the page; the texts of the email links |
| `AreaMessages` | `src/i18n/area-messages.tsx` | Adds the texts of one area to the base ones: `catalogue`, `signIn`, `cart`, `checkout`, `account`, `emailLinks`, `wishlist` |

A page that fails is caught by the `error.tsx` of its route group; a failure of the frame itself by `src/app/global-error.tsx` ([error pages](../features/error-pages.md)).

## Related

| Topic | Document |
| --- | --- |
| Every route and its addresses | [routing.md](routing.md) |
| What is rendered where, and how fresh | [rendering-and-caching.md](rendering-and-caching.md) |
| State in the browser | [state-management.md](state-management.md) |
| The API client and its endpoints | [api/README.md](../api/README.md), [api/endpoints.md](../api/endpoints.md) |
| Why it is built this way | [decision log](../decisions/decision-log.md) |
