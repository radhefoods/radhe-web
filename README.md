# Radhe Foods customer shop

The customer-facing web shop of Radhe Foods: Indian groceries in Germany, sold from stock and paid at checkout. It talks to the Radhe Foods API (`radhe-api`); it has no database and no secrets of its own.

- Next.js 16 (App Router, React 19, TypeScript strict), Tailwind CSS 4
- English and German with localized addresses (`/en/cart`, `/de/warenkorb`)
- Documentation of the business and the API: [`doc/`](doc/). The API documentation is the authority.
- Decisions and their reasons: [`DECISIONS.md`](DECISIONS.md)

## Status

Built so far:

- **Phase 1, foundation and design system:** project setup, languages and routes, the typed API client, price and date formatting, the mock API; design tokens, fonts and base components. The design system is on one page: `/en/styleguide`.
- **Phase 2, catalogue:** home page, all products with search, sorting and filters, category pages, product pages, add to cart from every product card.
- **Filter panel (2026-10-15):** the filters and the sorting of every product list were redesigned: a row of pills above the grid (brand, keep in, price, pack size, highlights, offers, orderable now, sort), each opening its values with live counts from the API's new facets endpoint; several values of one filter are "any of them"; applied filters as removable chips with "clear all"; a sheet with a live "Show N products" button on phones; only filters the list supports are shown, and they stay while narrowing; an empty list names the filter to drop. Addresses carry the API's own parameter names, so a filtered view can be shared; filtered views stay out of search engines. The mock API gained the repeatable parameters and the facets endpoint of the documentation (section 7). The decisions and their reasons are in `DECISIONS.md`, "The filter panel".
- **Phase 3, cart and checkout:** the cart with the bill of the API, sign-in with an email code, the checkout (address, note, consent to the exact legal versions, the order button); the legal texts of the API.
- **Phase 4, account:** overview, orders with a progress line, cancelling, payment, invoices and credit notes with PDF, returns, addresses, profile and news preference, sign-out; Google sign-in (shown when a client id is set).
- **Phase 5, public pages and SEO:** the unsubscribe link from emails, "How it works", "Delivery and payment", legal notice, right of withdrawal and cookie page as editable files, the cookie notice, footer links; sitemap, robots, web manifest, social picture, canonical and language links on every public page.

- **Phase 6, polish:** an automatic accessibility check of every kind of page (axe, WCAG 2.2 AA) and keyboard tests; lighter pages (fewer preloaded fonts, smaller icon and logo files, translations sent per area, the menu panel loaded on demand); the cookie notice painted with the page; a line at the top while the next page loads; a message where a product could not be added; the signed-in dot in the phone tab bar; a last-resort error page.
- **Redesign (2026-10-11):** the visual system was replaced at the owner's request, with every function and rule kept: Plus Jakarta Sans and DM Sans, a grey canvas with white cards, royal blue actions with saffron, green and red signals, a three-tier store header with a large search and the cart total, a home page that opens with the store (banner, next delivery, categories, offers, popular products), filter column and four-card grid on the lists, a buy box on the product page.
- **Redesign (2026-10-14):** after comparing ten design directions, the owner chose a fresh grocer-app look in leaf green and wheat with a woven dark hero band and a ticket card, the fonts kept and the wordmark of the logo recoloured green. Done: phase 1, the tokens (`src/app/globals.css`) and the base components (pill buttons, chips, stepper, messages), with every colour class in the code renamed; phase 2, the shell: the white header with the pill search, the account and cart pills and the category chips, the menu panel, the tab bar, the mist footer, and the green logo files (`public/brand`, source `logo/radhe-logo-green.png`) with the social picture; phase 3, the home page: the full-width woven hero band with the eyebrow, headline, lead and two pill buttons, the ticket card (dashed inner border, tiles, facts under a dashed rule, the rotated seal), mist promise and category tiles, wheat step numbers, and a panel on a dark band; phase 4, the catalogue: product cards with the picture on a mist tile, the price first, pill pack sizes and the round "+" (the stepper fills the row once a product is in the cart), one toolbar with the count, the filters as pills and the sorting (the filter column is gone, the grid takes the full width), pill pagination, the product page with the picture on mist, pill pack sizes and the buy box, mist subcategory chips; phase 5, the remaining pages: cart lines as mist tiles and the summary as a mist panel, the checkout summary on mist, the account navigation as leaf pills, empty states on mist, the steps of "How it works" with wheat numbers, the checkout and email-link frames with the header shadow and a pill back link; phase 6, quality: the end-to-end tests follow the new home page, every page passes the axe check again (the coral and two small texts were deepened for contrast), the search field keeps the standard focus ring, and the decisions are recorded. The decisions and their reasons are in `DECISIONS.md`, "Design". Refined the same evening: the owner found the lime highlight too loud and, from five accent options and ten theme variations built on the real pages, chose "Moss". The highlight token is now wheat (`#EBD9B4`, text `#6E5630`), the greys are a touch warmer, and the dark band runs from deep leaf through moss to a warm olive edge under a wheat glow; every `lime` class became `wheat`.
- **Sold from stock, paid at checkout (2026-10-16):** the backend moved from pre-orders to a standard shop (`doc/PROMPT_CUSTOMER_WEB.md` is the brief, `doc/CUSTOMER_WEB_API_DOCUMENTATION.md` the authority). The shop followed in seven phases, the design kept: the types and the API client follow the new documentation and the mock API sells from stock with a stand-in Stripe page; the checkout calls `POST /v1/store/checkout` with the idempotency key and sends the browser to the payment page ("Buy now"); the order page is where the customer lands afterwards and shows paid, confirming, left, failed, or cancelled because a product sold out, with "Pay now" while the order waits; orders carry the new statuses with the payment as the first step of the progress line; availability comes from the stock (sold out, "only N left"); the cargo strip, the countdown, the pay-later notes, the pay-link page and the pre-order terms are gone, the copy of every page says what the shop does now, and the hero's ticket card carries the promise of the shop from the settings; the browser tests follow the new flow. The decisions and their reasons are in `DECISIONS.md`, "The shop sells from stock".
- **Pack sizes as variants (2026-10-16, later the same day):** a product holds its pack sizes as variants (section 7 of the API documentation, with 8, 12 and 13; section 6 of the brief). Lists show one entry per product, as its smallest size in stock, named "Basmati Rice (1 kg)" (the sizes switched on the card until the evening of the same day, see the next item). The product page is one page for every size: the server renders the size its address names (`/en/products/basmati-rice-1kg`, `/de/produkte/basmati-reis-1kg`; the base slug `basmati-rice` opens the default size), and choosing another size changes the headline, the price, the stock, the item number, the tab title and the address in place, without a request; back and forward and the language switch keep the size. The cart is kept by `variantId`, the visitor's cart under the new storage key `rf.cart.v2`; returns name their items by size. A reduced size shows its regular price crossed out next to the unit price in the cart, the checkout summary and the order items; the price per kilogram, litre or piece stands next to the price. Structured data is a `ProductGroup` with one `Product` per size; the sitemap lists every size's address. The mock folds its fixtures into products with sizes and takes `variantId` in its controls. The decisions and their reasons are in `DECISIONS.md`, "Pack sizes as variants".
- **Product cards, the add button, the picture fallback (2026-10-16, evening):** a card shows one size of a product and nothing but its name (the link to the page of that size), its price with the regular price crossed out when reduced, the price per unit under it, and the round "+"; the brand line, the size pills and the "in stock" line went, since the sizes are chosen on the product page. A sold-out or switched-off size shows a quiet pill with an icon where the button was, its picture greyed. A product without a picture shows the Radhe mark ghosted on the tile with "coming soon". On a tap the picture flies into the cart pill (a ghost of the tile arcs across the page and drops in, and the pill bobs), while the stepper unfolds in the button's place and its number pops as it changes. The mock keeps one product without a picture. The decisions and their reasons are in `DECISIONS.md`, "Product cards".
- **Header (2026-10-16, night):** the four promise tiles under the hero are gone (the wheat strip and the ticket card say the same); account and cart are icons only, with the green signed-in dot, the wheat badge for the units, a hover tint and a tooltip (Radix) on hover and focus. The category chips became a category bar: the parent categories of the API, a leaf underline for the current one, and for a parent with sub-categories a panel that opens on hover or through its chevron (keyboard, touch), with the sub-categories and their product counts; on phones the menu sheet folds the sub-categories out under their parent. Nothing but categories is in either: "All categories", "Offers" and "How it works" left the bar, "All products" the phone menu. The decisions and their reasons are in `DECISIONS.md`, "Header and navigation".
- **Home page product rows (2026-10-16, night):** under the hero, "Popular right now" (the products marked featured in the admin) and then one section per main category with products, in the admin's order, each a row of the existing product cards that scrolls sideways and snaps card by card (two and a sliver on phones, up to five on wide screens; arrows from medium screens on), with the category's tagline and "See all". The category tiles and the "Offers" section are gone. One cached request per category on the server. The decisions and their reasons are in `DECISIONS.md`, "Home page product rows".

All six phases of the original plan, the six phases of the redesign, the move to a shop that sells from stock and the pack sizes as variants are built. What is left is listed under "Before launch" and in the open items of `DECISIONS.md`.

## Before launch

- **Fill in the legal templates.** `content/legal/imprint.*.md` and `content/legal/withdrawal.*.md` contain placeholders written as `[[...]]`. `npm run check:content` lists every one that is still open. The pages show a notice while placeholders remain. Have the texts and the wording of the order button reviewed by a lawyer.
- **Set the production environment** (see "Environment"), above all `NEXT_PUBLIC_SITE_URL`: it is part of every canonical address and of the sitemap.
- **Product photos** instead of the mock's placeholders. A light version of the wordmark for dark grounds can be made the way the green one was (see `DECISIONS.md`, "Design") if one is wanted.
- **The API must allow the `Idempotency-Key` header** in its CORS settings, or no order can be placed from the browser; the owner is adding it on the backend (see the open items in `DECISIONS.md`).
- **Try the real API, Stripe and Google sign-in** once they exist for development: until now the shop has only met the mock.
- **Run the browser tests** (`npm run test:e2e`) after the move to the shop that sells from stock, the pack sizes and the product cards: they were rewritten for the new flow but could not run on the development machine for lack of memory.
- **Measure the deployed shop** with PageSpeed Insights (see "Quality checks").

## Requirements

- Node.js 24 (the current LTS). `.nvmrc` names it, so `nvm use` or `fnm use` picks it, and `engines` in `package.json` tells npm and Vercel the same. Next.js itself accepts 20.9 or newer and the mock API needs 22.18 or newer (it runs TypeScript directly with Node), but 24 is the version everything is tested with.
- npm (the one that comes with Node)

## Setup

```bash
npm install
cp .env.example .env.local   # then adjust if needed
```

## Running it locally

The shop needs an API. Until the real one has development data, use the mock API. Two terminals:

```bash
npm run dev:mock   # mock API on http://localhost:3000
npm run dev        # shop on http://localhost:3001
```

Open <http://localhost:3001>. To use the real API instead, start `radhe-api` on port 3000 (its `CORS_ORIGINS` must contain `http://localhost:3001`) and do not start the mock.

### The mock API

`mocks/` is a stand-in for `radhe-api`. It answers in the shapes and with the error codes of `doc/CUSTOMER_WEB_API_DOCUMENTATION.md`, from fixtures in memory (a restart forgets everything).

| What            | How                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign in         | Any email address; the login code is always `123456` (also printed in the mock's terminal). `blocked@example.com` answers "account blocked".                                                                                                                                                                                                                                                                           |
| Demo account    | Sign in as `demo@radhefoods.de`: a profile, an address and six orders (waiting for its payment with the page open, paid and confirmed, on its way, cancelled and refunded, delivered with a return request, cancelled because a product sold out before the capture).                                                                                                                                                  |
| Built so far    | Every endpoint of the API documentation: settings, legal texts, catalogue with its stock, cart, sign-in, profile, addresses, checkout, orders, payments, invoices with PDF, returns, the unsubscribe link.                                                                                                                                                                                                             |
| Test controls   | `POST /__mock/reset`, `/__mock/stock` and `/__mock/price` (by `variantId`), `/__mock/legal/republish`, `/__mock/customer` (blocked), `/__mock/order` (process, dispatch, deliver, refund), `/__mock/payment` (settle, fail, expire), `/__mock/return` (approve, reject, complete), `/__mock/stripe` (online payment on or off), `GET /__mock/tokens?email=` (the token of the unsubscribe link): see `mocks/server.ts` |
| Payment page    | "Buy now" and "Pay now" lead to a page of the mock that stands in for Stripe Checkout: card pays at once, PayPal a few seconds after the return, cancel leads back to the order. Paying takes the stock, issues the invoice and empties the cart; a product that sold out meanwhile cancels the order. `MOCK_STRIPE=off npm run dev:mock` shows the shop without online payment.                                       |
| Slow network    | `MOCK_LATENCY_MS=800 npm run dev:mock`                                                                                                                                                                                                                                                                                                                                                                                 |
| Short sessions  | `MOCK_ACCESS_TTL_SECONDS=20 npm run dev:mock` to see the refresh happen                                                                                                                                                                                                                                                                                                                                                |
| Sample products | Seven products in two pack sizes (the 5 kg of the basmati on sale), one sold out, one with eight units left, one unavailable, one with a minimum quantity, one at 19 % VAT, one without a picture                                                                                                                                                                                                                      |
| Pictures        | Generated placeholders labelled "mock picture"                                                                                                                                                                                                                                                                                                                                                                         |

## Environment

All variables are public (`NEXT_PUBLIC_…` values are visible in the browser). See [`.env.example`](.env.example).

| Variable                       | Meaning                                                                    | Production                     |
| ------------------------------ | -------------------------------------------------------------------------- | ------------------------------ |
| `NEXT_PUBLIC_SITE_URL`         | Public address of the shop, no trailing slash                              | `https://radhefoods.de`        |
| `NEXT_PUBLIC_API_URL`          | Address of the API, no trailing slash, no `/v1`                            | `https://api.radhefoods.de`    |
| `API_INTERNAL_URL`             | Optional: how the Next.js server reaches the API. Default: the value above | usually empty                  |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google sign-in client id. Empty hides the Google button                    | when Google sign-in is set up  |
| `NEXT_PUBLIC_FEATURE_WHATSAPP` | `true` shows the WhatsApp opt-in in the account                            | `false` until WhatsApp is live |
| `NEXT_PUBLIC_SUPPORT_EMAIL`    | Contact address in the footer and on error pages                           | the support mailbox            |

`NEXT_PUBLIC_` variables are fixed at build time: change them, then build again.

## Scripts

| Script                  | Does                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Shop in development mode on port 3001                                                                                                                    |
| `npm run dev:mock`      | Mock API on port 3000                                                                                                                                    |
| `npm run build`         | Production build                                                                                                                                         |
| `npm run start`         | Serves the production build on port 3001                                                                                                                 |
| `npm run check`         | Types, lint, formatting and tests in one go                                                                                                              |
| `npm run typecheck`     | Generates route types, then `tsc`                                                                                                                        |
| `npm run lint`          | ESLint                                                                                                                                                   |
| `npm run test`          | Unit and integration tests (Vitest)                                                                                                                      |
| `npm run test:e2e`      | Browser tests (Playwright) against the built shop and the mock API; starts both when they are not running. First time: `npx playwright install chromium` |
| `npm run check:content` | Lists the placeholders still open in `content/` (legal notice, withdrawal)                                                                               |
| `npm run format`        | Prettier                                                                                                                                                 |

## Quality checks

| Check                           | How                                                                                                                                                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types, lint, format, unit tests | `npm run check`                                                                                                                                                                                                                                                                                |
| Browser tests                   | `npm run test:e2e`: ordering and paying, the account, public pages, on a wide screen and on a phone                                                                                                                                                                                            |
| Accessibility                   | Part of the browser tests (`e2e/accessibility.spec.ts`): axe checks every kind of page against WCAG 2.2 A and AA, plus keyboard and reduced-motion tests. An automatic check does not replace trying the shop with a screen reader.                                                            |
| Performance                     | Lighthouse against the production build: `npm run build && npm run start`, then `npx lighthouse http://localhost:3001/en --view`. The numbers measured at the end of phase 6 are in `DECISIONS.md`. Measure again on the real domain: a local run has no CDN, no HTTP/2 and no product photos. |
| Legal placeholders              | `npm run check:content`                                                                                                                                                                                                                                                                        |

## Structure

```text
doc/                 migration brief, architecture, API documentation
content/legal/       legal notice, withdrawal and cookie page as Markdown, per language
scripts/             small helpers (`check:content`)
logo/                the brand mark as delivered
messages/            en.json, de.json: every text of the interface
mocks/               the mock API (server, fixtures, views, tests)
e2e/                 browser tests (Playwright)
public/brand/        the logo in web sizes
src/
  app/globals.css    the design tokens (colours, type, radius, shadows)
  app/[locale]/      pages; the language is the first part of every address
    (shop)/          pages inside the shop frame (header, footer, tab bar)
    (checkout)/      the checkout in its own quiet frame
    (plain)/         the unsubscribe page behind the link in emails
    styleguide/      the design system on one page
  components/ui/     base components: button, chip, alert, field, stepper, sheet
  components/shell/  header, footer, tab bar, language switch, search
  components/home/   the ticket of the home page
  components/catalogue/  product card, picture (with its fallback), price,
                     add to cart, the pack sizes of a product page, the list
                     and its filter panel (filters/)
  components/cart/   cart lines, the bill, the cart bar on phones
  components/checkout/   the checkout page and the address form
  components/account/    orders, the payment of an order, invoices, returns,
                     addresses, profile
  features/          what lives in the browser: session, cart; the order
                     statuses and progress line; what the server reads for
                     the catalogue, and what the ordering block means
  config/env.ts      configuration and feature switches
  i18n/              languages, localized routes, navigation helpers
  lib/api/           types of the API, error codes, HTTP client, endpoints
  lib/format/        money, dates
  lib/cart/          the guest cart kept in the browser
  lib/checkout/      idempotency key and consent for the checkout
  lib/seo/           canonical and hreflang addresses, structured data
  proxy.ts           sends requests to the right language
```

How the API is called:

- **In the browser** import `api` from `@/lib/api/browser`. Cookies travel with every call; an expired access token is refreshed once and the call repeated; `session.onSessionEnded` tells when the session is over.
- **On the server** import `serverApi` from `@/lib/api/server`. Public data only (catalogue, settings, legal texts), cached by Next.js.
- Errors are `ApiError` with a `code`. Translate the code with the `errors` messages; never show the API's English `message`.

## Adding a text

Add the key to `messages/en.json` **and** `messages/de.json`. A test fails when one language lacks a key or uses different placeholders. Texts used by components that run in the browser need their namespace listed in `src/i18n/client-messages.ts`.

## Deployment

The build is standard Next.js with no platform-specific service, so it runs on Vercel and on a Node.js host (Hostinger) alike.

1. Set the environment variables of the table above. On Vercel: Project → Settings → Environment Variables, before the build, because the `NEXT_PUBLIC_` values are built into the scripts. Without `NEXT_PUBLIC_API_URL` the shop looks for the API on `localhost:3000`, which does not exist there.
2. `npm ci && npm run build`, then `npm run start` (or let Vercel do both). Both run on Node.js 24; Vercel takes the version from `engines` in `package.json`, so there is nothing to set in the project settings. The build does not need the API: pages that cannot load their content while building are rendered at their first visit. The running shop does need it; without an API the catalogue is empty and pages with content show the error page.
3. The shop and the API must share a parent domain (`radhefoods.de` and `api.radhefoods.de`): the session cookies are set for `.radhefoods.de`. The API's `CORS_ORIGINS` must contain the shop's address, and its `SHOP_URL` must be the shop's address: Stripe sends the customer back to `SHOP_URL/account/orders/<number>`.

Sign-in does not work on addresses outside that domain (for example Vercel preview addresses), because the cookies do not travel there.
