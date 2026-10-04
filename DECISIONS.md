# Decisions

Design and technical decisions of the Radhe Foods customer shop, with their reasons. Newest decisions of the owner first, then by topic. Keep this file current.

## Decided by the owner (2026-10-03)

| Topic            | Decision                                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Languages        | English is the default and the fallback; German is the second language.                                                                                              |
| Domain           | `radhefoods.de` in production, configurable through environment variables.                                                                                           |
| Development data | No development database exists. The shop is developed against a mock API that mirrors the API documentation. `radhe-api` is not run against a real database for now. |
| Analytics        | None at launch. Only strictly necessary cookies and storage (sign-in, cart, language, security). Must be easy to add later.                                          |
| WhatsApp         | The feature is built but hidden behind `NEXT_PUBLIC_FEATURE_WHATSAPP` (off). Switching it on needs no rebuild of the feature.                                        |
| Design           | The logo changed to the blue wordmark; the first (purple) proposal is void. The second proposal was approved on 2026-10-04, see "Design".                            |

## Design (approved by the owner on 2026-10-04)

| Decision                                                                                                                                                                                                      | Reason                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| White pages; the blue of the wordmark for structure and actions; the gold of the feather for time and deadlines; its teal for good news (paid, delivered, nothing to pay today); chili red for reduced prices | Food photography carries the colour. Every colour has one meaning, so a customer learns them once.                                                                                           |
| The main blue is one step lighter than the logo: actions `#1A45CC`, dark bands `#0A1D5C`                                                                                                                      | Asked for by the owner at approval. All text pairs keep WCAG AA (white on the action blue 7.6:1, gold on the dark band 9:1).                                                                 |
| Instrument Serif for headlines, Instrument Sans for everything else, served from the shop's own address                                                                                                       | The serif is slim and high in contrast like the wordmark; the sans has tabular figures for prices and a narrow cut for long German labels. No request goes to Google when a customer visits. |
| Corners 8 to 24 px, 12 px on buttons; hairline borders; shadows only where something floats                                                                                                                   | Crisp and professional rather than playful.                                                                                                                                                  |
| Light theme only                                                                                                                                                                                              | One look to get right for launch; the tokens are named so that a dark theme could be added.                                                                                                  |
| The logo is used on white and mist only, never recoloured                                                                                                                                                     | Only one version exists (owner, 2026-10-04). The footer is therefore light. The site icon is the feather cut out of the logo, unchanged.                                                     |
| German addresses customers with the formal "Sie"                                                                                                                                                              | Owner, 2026-10-04.                                                                                                                                                                           |
| The default Tailwind palette is switched off                                                                                                                                                                  | Only the tokens of `src/app/globals.css` exist, so a colour outside the system cannot slip in.                                                                                               |
| The eye of the peacock feather marks the current step of an order                                                                                                                                             | The one ornament of the system, taken from the logo. Used with the order timeline (phase 4).                                                                                                 |

The proposal the owner approved: https://claude.ai/artifact/H81dQCWgRnF6n7wtUrjWE8 . The design system in code: `/en/styleguide`.

## Working rules

Taken from section 8 ("How to work") of the original prompt in `radhe-api/doc/PROMPT_CUSTOMER_WEB.md`, which the copy in this repository no longer contains:

- Build in phases: foundation and design system, catalogue, cart and checkout, account, public pages and SEO, polish. After each phase it runs, and lint, types and tests pass.
- Keep `README.md` and this file current.
- Do not commit to Git unless asked.
- Both languages are first-class; German is written the way a German speaker writes it.

## Stack

| Decision                                                                         | Reason                                                                                                                                                                                   |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js 16.3 (App Router), React 19.2, TypeScript 5 strict, Tailwind 4, ESLint 9 | The versions the official Next.js template installs and tests together. TypeScript 7 and ESLint 10 exist but are not what the framework ships with yet.                                  |
| npm                                                                              | Same as `radhe-api`; works on Vercel and Hostinger without extra setup.                                                                                                                  |
| next-intl 4 with localized pathnames                                             | `/de/warenkorb` instead of `/de/cart`: better for German search results and for customers. One table (`src/i18n/routing.ts`) holds every address.                                        |
| Caching without Cache Components                                                 | The classic model (`fetch` with `next.revalidate`) is stable and is what next-intl documents. Catalogue answers are reused for 5 minutes, the cargo for 1 minute.                        |
| TanStack Query for everything that belongs to a customer                         | Session, cart, orders live in the browser (see "Session" below).                                                                                                                         |
| Types of the API written by hand in `src/lib/api/types.ts`                       | The API documentation is precise and is the authority; one file mirrors it section by section. A generated client can replace it when the API's OpenAPI document describes every answer. |
| Vitest for unit and integration tests; Playwright for end-to-end tests           | The parts that lose money when wrong are tested first: prices, cart rules, the order attempt, the session refresh.                                                                       |
| No UI kit; Radix primitives where a component needs accessibility behaviour      | Follows the prompt. Added with the design system, not before.                                                                                                                            |

## Architecture

**Session.** The API's refresh cookie only travels to `/v1/store/auth/*` on the API, so the Next.js server can never refresh a session. Therefore everything that belongs to a customer (account, cart, checkout) is rendered in the browser, and the server renders only public data. `src/lib/api/session-transport.ts` implements the documented flow: on `401 AUTH_TOKEN_INVALID` refresh once and repeat; calls that fail at the same time share one refresh (refresh tokens rotate); a refused refresh ends the session; a refresh that fails for another reason (network, 503) does not.

**One definition of every endpoint.** `createStoreApi(requester)` in `src/lib/api/store-api.ts` is used by the browser (with the session transport) and by the server (plain, cached).

**Errors.** `ApiError` carries the `code`, typed `details` per code, and the `requestId`. The interface translates the code (`messages/*.json`, namespace `errors`); a test makes sure every documented code has a sentence in both languages. A code the shop does not know is shown as a general error and kept in `rawCode`.

**Money.** Integer cents end to end. The shop never adds, multiplies or rounds prices; it prints what the API gives. `formatMoney` passes an exact decimal string to `Intl.NumberFormat`, so no float is involved.

**Dates.** Date-times are printed in `Europe/Berlin` whatever the device is set to; calendar days are printed as written. Month and weekday names and the punctuation come from tables in `src/lib/format/dates.ts`, not from `Intl`: engines spell them differently ("Sep"/"Sept", thin spaces around dashes), which would make the server and the browser disagree about the same page.

**Countdown.** Uses `closesInSeconds` of the API and measures only the time passed since the answer arrived, so a wrong device clock cannot move the deadline.

**Ordering state on cached pages.** Catalogue pages are cached, but whether ordering is open is not allowed to be stale: the cargo and the ordering state are refreshed in the browser on top of the cached page.

**Images.** Product pictures are rendered with a plain `srcset` from the API's three WebP sizes instead of the Next.js image optimizer: they are already optimized and immutable, the API says never to build image URLs, and it behaves the same on Vercel and Hostinger.

**Guest cart.** Product ids and quantities in `localStorage` (`rf.cart.v1`), never prices. Whatever is read from storage is sanitized to what the API accepts. Prices come from `POST /cart/preview`; after sign-in the cart is handed over with `POST /cart/merge`.

**Idempotency key.** One key per checkout, kept in `sessionStorage` until an order answers. It is not renewed after a refusal or a network error: if the answer of a successful attempt was lost, the same key returns that order instead of placing a second one.

**Translations sent to the browser.** Only the namespaces listed in `src/i18n/client-messages.ts`; everything else stays on the server, so pages do not carry the whole dictionary.

**Language of links in emails.** The API's emails link to `/pay/<token>`, `/unsubscribe/<token>`, `/account/orders/<number>` and `/products/<slug>` without a language. The proxy sends them to the customer's language and keeps path and query. Unsubscribe tokens contain a dot, which the usual "skip files" rule would exclude, so `src/proxy.ts` names these paths explicitly.

**Every page checks its language.** `localeOf(params)` from `src/i18n/locale.ts` is the first line of every page and layout. Requests like `/favicon.ico` also land in `[locale]`, and pages render at the same time as the layout, so the layout's check alone does not protect a page.

**Who is signed in.** The session is in httpOnly cookies the shop cannot read; only `GET /me` knows. To spare every visitor two failing requests per page, the browser keeps a hint that it signed in before (`rf.session.v1`); without the hint the shop does not ask, except on pages that need an account.

**One cart for components.** `useCart()` gives quantities and one `setQuantity`, whether the cart lives in the browser (visitor) or in the API (customer). Quick taps on plus and minus are collected into one request per product. After sign-in the visitor's cart is merged once.

**Lists live in the address.** Search, sorting, filters and the page of a product list are query parameters, checked against what the API accepts before they are sent on. Filters work as a plain form without scripts and apply at once with scripts. Searches and filtered or sorted views are not indexed; the plain list and its further pages are.

**One address per product and language.** The API answers to the slug of either language; the page redirects permanently to the slug of its language, so `/de/produkte/<english slug>` (as in the API's emails) ends on the German address.

**Pack sizes.** On a product card the sizes switch in place (price, picture, add to cart); on the product page each size is a link to its own page, because each size is its own product with its own address.

**Live ordering on cached pages.** The pre-order strip, the countdown and every add-to-cart control use a cargo the browser fetched itself. The live answer wins in both directions: a closed shop offers nothing on a page cached while it was open, and an open shop does not repeat a cached "closed". The product page also asks the API again for the product's own ordering state.

**Checkout on one page, in its own frame.** Address, note, consent and the bill are on one page with a quiet header (logo, back to the cart, language): nothing leads away from confirming. The order summary with the total, the VAT inside it and the delivery fee stands directly above the button; the consent checkbox stands before the summary, so nothing sits between the essential information and the button. The button reads "Zahlungspflichtig vorbestellen" / "Place binding pre-order", and the page says in two places that nothing is charged now. The wording still needs the lawyer's review.

**The checkout asks again.** When it opens, the bill, the legal versions and the ordering permission are fetched fresh, whatever is cached. The order sends the total the customer sees; the documented refusals are handled in place: a changed total shows old and new and asks to confirm again; republished legal texts untick the consent and show the new versions; an overdue payment, a blocked account, closed ordering and lines that cannot be ordered are explained above the button, which is then disabled.

**Sign-in.** One field for the six digits (not six boxes): it works with paste and with the code suggestion of phones, and submits by itself when complete. A cooldown answer of the API (`OTP_COOLDOWN`) is not an error for the customer: a code is on its way, so the form goes on to the code step. The way back after sign-in (`returnTo`) only accepts pages of a fixed list.

**Cart hand-over after sign-in.** The visitor's cart is merged once; until the merge has answered, the cart counts as not ready, so the checkout never shows the cart from before the merge. A read of the stored cart that is still on its way is cancelled when the merge answers.

**Legal texts.** The three texts of the API are rendered as Markdown without HTML (`skipHtml`): whatever an admin pastes cannot run in the customer's browser.

**Forms.** react-hook-form with zod schemas that mirror the API's rules; the messages are translation keys. What the API still refuses (`VALIDATION_FAILED`) is shown at the field it names.

**The account is read in the browser.** Every account page sits in one frame (`AccountShell`) that asks who is signed in; a visitor without a session is sent to sign in and comes back to the same page, also to one order (`/account/orders/RF-1084`). Nothing of the account is rendered on the server, and nothing of it is indexed.

**The progress of an order** is built from its status and the three times the API gives (placed, dispatched, delivered), because customers get no status history. The step the order is at wears the eye of the feather; a passed step counts as done even when its time is unknown; a failed delivery and a cancellation are shown as their own red steps. Payment is the last step of the line.

**Payment.** "Pay now" appears only when the API says `canPayOnline`; the cash hint only when it says `cashPossible`; when neither is possible the page says that Radhe Foods will get in touch. Before the browser is sent to the payment page, its address is checked (https; plain http only on the local machine, for the mock). After the return from Stripe (`?payment=success`) the payment is asked for, which makes the API ask Stripe, a few times with three seconds between for slow payment methods; then the page says "received" or "on its way". On phones the payment panel of an order that is to pay comes before everything else.

**PDFs** are fetched with the session and handed to the browser as a download (`fetch` and a Blob), because a plain link would not carry the session's refresh.

**Returns** are requested on a page of their own: units per product up to what the API says is returnable, a reason for each chosen product. The page promises nothing: Radhe Foods decides.

**Preferences are separate consents.** The news switch is stored the moment it is toggled (and moves back when the API refuses); the wording says what it means and how to withdraw. WhatsApp number and opt-in are built and render only when `NEXT_PUBLIC_FEATURE_WHATSAPP=true`.

**Google sign-in.** The button is rendered by Google Identity Services, whose script is loaded on the sign-in page only and only when a client id is configured. It disappears when the API answers `GOOGLE_NOT_CONFIGURED` or the script is blocked. It could not be tried against real Google here: no client id exists yet.

**Signing out** first leaves the account pages, then forgets the customer (the session cache and everything read with it).

**Links from emails.** `/pay/<token>` and `/unsubscribe/<token>` need no sign-in and sit in a frame with nothing but the logo. The payment page is rendered in the language of the order (the API says which), whatever the browser prefers. Both pages are closed to search engines (`robots.txt` and `noindex`) and send no referrer, because their address carries a personal token.

**Unsubscribing takes one tap, not zero.** The page shows what will happen and a button; it does not unsubscribe by itself when it opens. Mail programs and security scanners open the links of an email on their own, and nobody should lose their news that way.

**Legal texts outside the API.** The legal notice (Impressum), the right of withdrawal and the cookie page are Markdown files per language in `content/legal/`. Parts still to be filled in are written as `[[...]]`, shown marked on the page together with a notice, and listed by `npm run check:content`. The cookie page has no placeholders: it lists what the shop really stores.

**A cookie notice, not a consent banner.** The shop stores only what it needs to work (sign-in, cart, language, the order key), for which German law asks no consent. The notice says so once, links to the details and stays away after "OK". No analytics exist; if they are added, this becomes a real choice and the cookie page changes with it.

**Search engines.** `robots.txt` lets everything be read except the token pages; the pages of one visitor (cart, checkout, account, sign-in) carry `noindex` themselves, which only works when they may be read. `sitemap.xml` is built from the API every hour: static pages, every category and every pack size, each address in both languages with `hreflang` and English as `x-default`. The product list of the API carries one language's slug only, so the catalogue is read once per language and joined by id. Every public page has a canonical address and the address of the other language; searches and filtered lists are not indexed. Structured data: organisation and website (home), breadcrumbs, product with offer (availability `PreOrder`, `SoldOut` or `OutOfStock` from the ordering state), item lists, and the questions of "How pre-ordering works".

**The social picture** is the logo, unchanged, centred on white (1200 x 630); product pages use the product picture instead.

**What every page carries.** Measured, then trimmed (phase 6):

- Fonts: only the Latin files are loaded ahead of the page (three instead of six); the extended Latin files stay in the style sheet and load when a page shows such a letter.
- Translations: the basic namespaces travel with every page, those of the account, the checkout, the sign-in and the email links only with their area (`src/i18n/client-messages.ts`). A test reads the source and fails when a client component uses a namespace its area does not send.
- The menu panel of small screens and the dialog code behind it are fetched when the menu button is first touched.
- The icon is 96 px (9 KB instead of 175 KB); the logo has a 160 px file and the browser picks by screen.

**The cookie notice is drawn with the page.** It is part of the HTML the server sends, so a first visit paints it together with everything else. Before, it appeared after the scripts had run, and on short pages it was the largest thing painted, which is what browsers and search engines time. For a visitor who has read it, a few lines of script before the first paint mark the page and the style sheet hides the notice; a browser test watches every frame to make sure it never flashes.

**A line at the top while the next page loads** (`NavigationProgress`). It starts with a click on a link of the shop, waits 150 ms (quick changes show nothing) and ends when the address has changed.

**A failed change of the cart is said where it happened** (`CartProblem`): a message at the top of the window on product lists, product pages and the home page, for eight seconds or until closed. The cart page keeps its own message.

**The spoken name of "Add to cart" starts with the words on the button** ("Add to cart: Basmati Rice, 5 kg"), so that people who use voice control can say what they see (WCAG 2.5.3).

**A delivery window never breaks at its dash.** `formatDayRange` puts an invisible "no break here" character (U+2060) after the dash, so "17.–19. Oktober" is not split into "17.–" and "19. Oktober" over two lines. Tests that compare such a text must include the character.

**When a page does not exist.** The answer has status 404 and `noindex`. Next.js sends an empty body for a page that calls `notFound()` and draws the localized "not found" page in the browser; this is how the framework handles it, not a fault of the shop's structure. A visitor without scripts sees an empty page; search engines see the 404.

**When the frame of the shop itself fails**, `src/app/global-error.tsx` shows a plain page in both languages with one button. Errors of a single page are caught earlier (`error.tsx`), and the frame's own data (cargo, settings, categories) never throws.

**Accessibility is tested, not assumed.** `e2e/accessibility.spec.ts` runs axe (WCAG 2.2 A and AA and the best-practice rules) on every kind of page, signed out and signed in, on a wide screen and on a phone, and checks the skip link, the visible focus outline, adding to the cart with the keyboard and that nothing keeps moving for people who asked for less motion. What it found and what was fixed: heading levels in the order list, a scrolling table without keyboard access, the cart line on phones outside any landmark.

**Performance, measured.** Lighthouse 13, mobile preset, production build on this machine against the mock API, two runs per page (lowest to highest):

| Page                   | Performance  | Accessibility | Best practices | SEO |
| ---------------------- | ------------ | ------------- | -------------- | --- |
| Home                   | 80 to 90     | 100           | 100            | 100 |
| All products           | 86 to 89     | 100           | 100            | 100 |
| Product                | 79 to 85     | 100           | 100            | 100 |
| Category               | 83 to 88     | 100           | 100            | 100 |
| Cart                   | 88 to 92     | 100           | 100            | 66  |
| How pre-ordering works | 84 to 86     | 100           | 100            | 100 |
| Sign-in                | 86 (one run) | 100           | 100            | 66  |

SEO is 66 on the cart and the sign-in page because they are `noindex` on purpose. The performance number of a local run is a lower bound that moves by several points from run to run: everything arrives at once from the same machine, so Lighthouse counts all scripts as standing before the largest paint. About 115 KB of the scripts are the framework itself (React and Next.js). The real number has to be measured on the deployed shop, with a CDN and with product photos.

## What the API cannot do, and what the shop does instead

| Missing in the API                                                             | In the shop                                                                        |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Status history of an order for customers                                       | The timeline is built from the status and the times placed, dispatched, delivered. |
| Newsletter sign-up without an account                                          | The teaser leads to sign-in and the preferences.                                   |
| A list of brands or tags                                                       | Filters: category, on sale, orderable now, price, sort, search.                    |
| Related products                                                               | Products of the same category.                                                     |
| A list of all returns of a customer                                            | Returns are shown with their order.                                                |
| A choice of delivery method at checkout (the prompt mentions one)              | None: Radhe Foods chooses the method.                                              |
| Account deletion and data export                                               | The privacy page names a contact address.                                          |
| The cancellation rule in the public settings (the documentation, 9.6, says so) | `canCancel` of each order.                                                         |
| Slugs in both languages on product lists                                       | The sitemap reads the catalogue in both languages and joins by id.                 |
| Impressum and Widerrufsbelehrung                                               | Static content files with marked placeholders.                                     |

## Open items

| Item                                                                                                                                                                                                                                                                                                                                                              | Needed before                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **API: `Idempotency-Key` is not an allowed CORS header.** `radhe-api/src/app.setup.ts` allows `Content-Type, Authorization, X-Request-Id`. A browser on another origin (the shop) cannot send `POST /v1/store/orders` with the required `Idempotency-Key` header: the preflight fails. Add the header to `allowedHeaders` in the API. The mock already allows it. | Checkout against the real API |
| A version of the logo for dark backgrounds (the wordmark is navy and disappears on navy). The logo files are a picture inside an SVG, not vector paths.                                                                                                                                                                                                           | Footer and dark areas         |
| Product photography.                                                                                                                                                                                                                                                                                                                                              | Launch                        |
| Legal review: button wording, Impressum, Widerrufsbelehrung, cookie notice.                                                                                                                                                                                                                                                                                       | Launch                        |
| `npm audit` reports a finding in `braces`, a dependency of the linter (`eslint-config-next`). It is a development tool and not part of the shop; the fix npm proposes would downgrade the linter.                                                                                                                                                                 | Watch for an update           |
| Google sign-in is written but untried against real Google: it needs the Google client id (`NEXT_PUBLIC_GOOGLE_CLIENT_ID` here, `GOOGLE_CLIENT_ID` on the API).                                                                                                                                                                                                    | When the client id exists     |
| The shop has only met the mock API. Before launch: one full order against `radhe-api` with development data, and one payment against Stripe's test mode.                                                                                                                                                                                                          | Launch                        |
| Performance on the real domain (PageSpeed Insights), with product photos. Local runs reach 79 to 92 on phones; the budget is 90.                                                                                                                                                                                                                                  | After the first deployment    |
| A content security policy. It needs a nonce per request, which would end the static rendering of the catalogue; the other security headers are set.                                                                                                                                                                                                               | Decide after launch           |
| A check with a screen reader (NVDA or VoiceOver) by a person. The automatic check finds about half of all barriers.                                                                                                                                                                                                                                               | Launch                        |
