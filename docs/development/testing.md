# Testing

What checks the shop, how to run each check, and what each one does not see. Every check runs against the [mock API](mock-api.md); nothing here reaches the real API or the live shop.

## 1. The checks

| Check | Command | Covers |
| --- | --- | --- |
| Types | `npm run typecheck` | `next typegen` writes the types of the routes, `tsc --noEmit` checks the code against them and against the API types of `src/lib/api/types.ts` |
| Lint | `npm run lint` | ESLint with `eslint-config-next` (core web vitals and TypeScript), set in `eslint.config.mjs` |
| Formatting | `npm run format:check` | Prettier, with the Tailwind plugin that orders class names |
| Unit and integration tests | `npm run test` | Vitest: `src/**/*.test.ts(x)` and `mocks/**/*.test.ts`, in Node, without a browser |
| All four | `npm run check` | The check before every commit |
| Browser tests | `npm run test:e2e` | Playwright: a real Chromium against the shop and the mock |
| A build fit for a host | `npm run build && npm run smoke` | Starts the built shop and asks it for a handful of pages ([deployment](../deployment/README.md)) |
| Both hosts | The build check on GitHub (`.github/workflows/ci.yml`) | At every push to `main`, `production/vercel` and `feature/**`: `npm run check`, then the build of each host, started and asked for its pages |
| Documentation | `node docs/tools/check-docs.mjs` | The documents against the code ([standard](documentation-standard.md)) |
| Legal placeholders | `npm run check:content` | The `[[…]]` still open in `content/legal/` |

## 2. Unit and integration tests

Tests stand beside what they test (`shipping.ts`, `shipping.test.ts`). Three kinds carry most of the weight:

| Kind | Where | What it holds |
| --- | --- | --- |
| Rules of the browser | `src/features/**`, `src/lib/**` | Formatting, the guest cart, the case a bill falls into, addresses, availability |
| Texts | `src/i18n/messages.test.ts`, `src/i18n/client-messages.test.ts`, `src/i18n/shipping-messages.test.ts` | Both languages have the same keys and placeholders; every text a browser component uses is sent to it; the sentences of the boxes read right with every count |
| The contract with the API | `mocks/*.test.ts` | The shop's own API client (`src/lib/api`) run against the mock, flow by flow, through the helpers of `mocks/testing.ts` |

## 3. Browser tests

`playwright.config.ts` runs the specs of `e2e/` one at a time (they change the state of the mock) in two projects: `desktop` (Chrome, 1280 × 800) and `phone` (Pixel 7, with touch). A test starts with `POST /__mock/reset`.

| Spec | Covers |
| --- | --- |
| `e2e/public.spec.ts` | The unsubscribe link, the help and legal pages, all categories, the FAQ, the blog, the cookie notice, what search engines are given |
| `e2e/catalogue.spec.ts` | Navigation, lists, filters, the product card and its basket, the product page, the visitor's cart |
| `e2e/checkout.spec.ts` | Ordering and paying as a customer, discount codes, addresses, what stops an order |
| `e2e/guest.spec.ts` | Ordering as a guest, the guest's order page |
| `e2e/shipping.spec.ts` | Delivery by the box in the cart, at the checkout and on the order page |
| `e2e/rewards.spec.ts` · `e2e/referral.spec.ts` | Coins; the referral code |
| `e2e/account.spec.ts` | Sign-up, sign-in, the account, orders, returns, invoices |
| `e2e/issues.spec.ts` · `e2e/reviews.spec.ts` | Problem reports; order reviews |
| `e2e/wishlists.spec.ts` | Wishlists |
| `e2e/stock-alerts.spec.ts` | "Notify me": switched off, a visitor and a customer on the product page and on a card, the account's list, the two link pages, what the API refuses. Run it against `next dev`, which reads the settings afresh for a page asked for with `Cache-Control: no-cache` (the spec opens its pages that way); the built shop keeps the settings, and with them the switch, for five minutes |
| `e2e/accessibility.spec.ts` | axe on every kind of page against WCAG 2.2 A and AA, the keyboard, reduced motion ([accessibility](../design-system/accessibility.md)) |
| `e2e/polish.spec.ts` | Details of the interface: a change of the cart that fails, the loading line, the cookie notice, the menu and the tab bar on a phone, the steps of the delivery fee |
| `e2e/helpers.ts` | `createAccount`, `signupCode`, `discountCode` (opens the folded code field), `cartLines`, `settled` (waits for finite animations before axe measures colours) |

### Running them

`npm run test:e2e` builds the shop and starts both servers when they are not running. On a computer with little memory, start the servers yourself and run a part:

```bash
npm run dev:mock                       # terminal 1
npm run dev                            # terminal 2 (or: npm run build && npm run start)
npx playwright test e2e/shipping.spec.ts --workers=1 --reporter=line
npx playwright test e2e/catalogue.spec.ts -g "the basket of a product card"
```

Playwright reuses servers that already answer on ports 3000 and 3001 (not in the build check). Never run two Playwright runs at once: they share the mock and its state.

| Against | Mind |
| --- | --- |
| `next dev` | The first visit of each page compiles it and can run into a timeout; the whole suite is too slow this way. Fine for one spec |
| `next build && next start` | Pages cached for minutes keep the answer of an earlier test, so a test that changes the mock's catalogue can see the old one on a list page |

## 4. What no check sees

- Browsers other than Chromium, and real phones.
- A screen reader: axe finds what a machine can find.
- The real API, real Stripe, real emails. The mock follows the backend's documents, not the backend.
- Speed on the real domain. Measure the deployed shop with Lighthouse or PageSpeed Insights; a local run has no CDN and no product photos.

## 5. When a test fails

A test that fails before a change is said so, with its name, in the commit and to the owner; it is not "fixed" by weakening it. Known on 2026-11-25, in `next dev`, unrelated to each other: the axe check of the not-found page, "a resolved report shows" in `e2e/issues.spec.ts`, "a line at the top shows" in `e2e/polish.spec.ts`, and "a sold-out product says so and cannot be added" in `e2e/catalogue.spec.ts` (the mock serves the Alphonso Mango as orderable).
