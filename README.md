# Radhe Foods customer shop

The customer-facing web shop of Radhe Foods: Indian groceries in Germany, sold by pre-order and paid after delivery. It talks to the Radhe Foods API (`radhe-api`); it has no database and no secrets of its own.

- Next.js 16 (App Router, React 19, TypeScript strict), Tailwind CSS 4
- English and German with localized addresses (`/en/cart`, `/de/warenkorb`)
- Documentation of the business and the API: [`doc/`](doc/). The API documentation is the authority.
- Decisions and their reasons: [`DECISIONS.md`](DECISIONS.md)

## Status

Built so far:

- **Phase 1, foundation and design system:** project setup, languages and routes, the typed API client, price and date formatting, the mock API; design tokens, fonts and base components. The design system is on one page: `/en/styleguide`.
- **Phase 2, catalogue:** home page, all products with search, sorting and filters, category pages, product pages, add to cart from every product card.
- **Phase 3, cart and checkout:** the cart with the bill of the API, sign-in with an email code, the checkout (address, note, consent to the exact legal versions, binding button) and the confirmation page; the three legal texts of the API.
- **Phase 4, account:** overview, orders with a progress line, cancelling, payment, invoices and credit notes with PDF, returns, addresses, profile and news preference, sign-out; Google sign-in (shown when a client id is set).
- **Phase 5, public pages and SEO:** the payment link and the unsubscribe link from emails, "How pre-ordering works", "Delivery and payment", legal notice, right of withdrawal and cookie page as editable files, the cookie notice, footer links; sitemap, robots, web manifest, social picture, canonical and language links on every public page.

- **Phase 6, polish:** an automatic accessibility check of every kind of page (axe, WCAG 2.2 AA) and keyboard tests; lighter pages (fewer preloaded fonts, smaller icon and logo files, translations sent per area, the menu panel loaded on demand); the cookie notice painted with the page; a line at the top while the next page loads; a message where a product could not be added; the signed-in dot in the phone tab bar; a last-resort error page.

All six phases of the plan are built. What is left is listed under "Before launch" and in the open items of `DECISIONS.md`.

## Before launch

- **Fill in the legal templates.** `content/legal/imprint.*.md` and `content/legal/withdrawal.*.md` contain placeholders written as `[[...]]`. `npm run check:content` lists every one that is still open. The pages show a notice while placeholders remain. Have the texts and the wording of the order button reviewed by a lawyer.
- **Set the production environment** (see "Environment"), above all `NEXT_PUBLIC_SITE_URL`: it is part of every canonical address and of the sitemap.
- **Product photos** instead of the mock's placeholders, and a version of the logo for dark backgrounds if one is wanted.
- **The API must allow the `Idempotency-Key` header** in its CORS settings, or no order can be placed from the browser (see the open items in `DECISIONS.md`).
- **Try the real API, Stripe and Google sign-in** once they exist for development: until now the shop has only met the mock.
- **Measure the deployed shop** with PageSpeed Insights (see "Quality checks").

## Requirements

- Node.js 22.18 or newer (the mock API runs TypeScript directly with Node). The shop itself needs Node.js 20.9 or newer.
- npm

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

| What            | How                                                                                                                                                                                                                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sign in         | Any email address; the login code is always `123456` (also printed in the mock's terminal). `blocked@example.com` answers "account blocked".                                                                                                                                                                                                                                   |
| Demo account    | Sign in as `demo@radhefoods.de`: a profile, an address and five orders (confirmed, cancelled, on its way, delivered and to pay, paid with a return request).                                                                                                                                                                                                                   |
| Built so far    | Every endpoint of the API documentation: settings, legal texts, cargo, catalogue, cart, sign-in, profile, addresses, orders, payments, invoices with PDF, returns, the payment link and the unsubscribe link.                                                                                                                                                                  |
| Test controls   | `POST /__mock/reset`, `/__mock/cargo`, `/__mock/price`, `/__mock/legal/republish`, `/__mock/customer`, `/__mock/order` (prepare, dispatch, deliver, activate payment, pay in cash, overdue), `/__mock/return` (approve, reject, complete), `/__mock/stripe` (online payment on or off), `GET /__mock/tokens?email=` (the tokens of the links in emails): see `mocks/server.ts` |
| Payment page    | "Pay now" leads to a page of the mock that stands in for Stripe Checkout and sends back to the order. `MOCK_STRIPE=off npm run dev:mock` shows the shop without online payment.                                                                                                                                                                                                |
| Cargo state     | `MOCK_CARGO=closed npm run dev:mock` (ordering closed, next cargo scheduled) or `MOCK_CARGO=none`. While running: `POST /__mock/cargo {"mode":"closed"}`                                                                                                                                                                                                                       |
| Slow network    | `MOCK_LATENCY_MS=800 npm run dev:mock`                                                                                                                                                                                                                                                                                                                                         |
| Short sessions  | `MOCK_ACCESS_TTL_SECONDS=20 npm run dev:mock` to see the refresh happen                                                                                                                                                                                                                                                                                                        |
| Sample products | One on sale with two pack sizes, one sold out, one not in the cargo, one unavailable, one with a minimum quantity, one at 19 % VAT                                                                                                                                                                                                                                             |
| Pictures        | Generated placeholders labelled "mock picture"                                                                                                                                                                                                                                                                                                                                 |

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
| Browser tests                   | `npm run test:e2e`: ordering, account, public pages, on a wide screen and on a phone                                                                                                                                                                                                           |
| Accessibility                   | Part of the browser tests (`e2e/accessibility.spec.ts`): axe checks every kind of page against WCAG 2.2 A and AA, plus keyboard and reduced-motion tests. An automatic check does not replace trying the shop with a screen reader.                                                            |
| Performance                     | Lighthouse against the production build: `npm run build && npm run start`, then `npx lighthouse http://localhost:3001/en --view`. The numbers measured at the end of phase 6 are in `DECISIONS.md`. Measure again on the real domain: a local run has no CDN, no HTTP/2 and no product photos. |
| Legal placeholders              | `npm run check:content`                                                                                                                                                                                                                                                                        |

## Structure

```text
doc/                 business concept, architecture, API documentation
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
    styleguide/      the design system on one page
  components/ui/     base components: button, chip, alert, field, stepper, sheet
  components/shell/  header, footer, tab bar, language switch, search
  components/cargo/  the pre-order strip, countdown, pay-later note
  components/catalogue/  product card, price, add to cart, list with filters
  features/          what lives in the browser: session, cart, live cargo;
                     and what the server reads for the catalogue
  config/env.ts      configuration and feature switches
  i18n/              languages, localized routes, navigation helpers
  lib/api/           types of the API, error codes, HTTP client, endpoints
  lib/format/        money, dates, countdown
  lib/cart/          the guest cart kept in the browser
  lib/checkout/      idempotency key and consent for placing an order
  lib/seo/           canonical and hreflang addresses, structured data
  proxy.ts           sends requests to the right language
```

How the API is called:

- **In the browser** import `api` from `@/lib/api/browser`. Cookies travel with every call; an expired access token is refreshed once and the call repeated; `session.onSessionEnded` tells when the session is over.
- **On the server** import `serverApi` from `@/lib/api/server`. Public data only (catalogue, cargo, settings, legal texts), cached by Next.js.
- Errors are `ApiError` with a `code`. Translate the code with the `errors` messages; never show the API's English `message`.

## Adding a text

Add the key to `messages/en.json` **and** `messages/de.json`. A test fails when one language lacks a key or uses different placeholders. Texts used by components that run in the browser need their namespace listed in `src/i18n/client-messages.ts`.

## Deployment

The build is standard Next.js with no platform-specific service, so it runs on Vercel and on a Node.js host (Hostinger) alike.

1. Set the environment variables of the table above. On Vercel: Project → Settings → Environment Variables, before the build, because the `NEXT_PUBLIC_` values are built into the scripts. Without `NEXT_PUBLIC_API_URL` the shop looks for the API on `localhost:3000`, which does not exist there.
2. `npm ci && npm run build`, then `npm run start` (or let Vercel do both). The build does not need the API: pages that cannot load their content while building are rendered at their first visit. The running shop does need it; without an API the catalogue is empty and pages with content show the error page.
3. The shop and the API must share a parent domain (`radhefoods.de` and `api.radhefoods.de`): the session cookies are set for `.radhefoods.de`. The API's `CORS_ORIGINS` must contain the shop's address, and its `SHOP_URL` must be the shop's address.

Sign-in does not work on addresses outside that domain (for example Vercel preview addresses), because the cookies do not travel there.
