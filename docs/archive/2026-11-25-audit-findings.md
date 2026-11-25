# Audit findings of 2026-11-25

What the audit of the documentation against the code found in the code itself: possible bugs, texts that disagree with what the shop does, unused code, and places where a comment or a file still names something that moved. **Nothing here was changed**: the task was documentation only. Each item names its file; the items marked ✔ were read a second time in the code after they were found, the others were found once by reading and were not tried in a browser.

This is a record of one day. An item that is fixed is not struck out here; the feature documents say what the shop does.

## 1. Possible bugs

| # | Where | What | ✔ |
| --- | --- | --- | --- |
| 1 | `src/components/checkout/checkout-view.tsx`, `place()` | The key that keeps an order from being placed twice is cleared as soon as the API answers, before the address of the payment page is checked (`isSafePaymentUrl`). If that address is refused, the order exists already and the page shows "payment unavailable"; after a reload the next "Buy now" carries a fresh key and would make a second order. It needs the API to answer an address the shop does not accept, so it is unlikely | ✔ |
| 2 | `src/components/checkout/checkout-view.tsx` | `unavailable` and `keyUsed` are never set back: after one such error "Buy now" stays off until the page is loaded again | |
| 3 | `src/components/cart/cart-view.tsx` | The free-delivery bar is given `totals.subtotal − totals.discount` and leaves out redeemed coins (`totals.rewards`), so with coins on the bill the bar's length may not match the amount the API says is missing. The amount in the sentence is the API's and is right | ✔ |
| 4 | `src/components/cart/box-shipping.tsx` | With a threshold set, a paid box and `missingForNextFreeBox` `null`, the second meter says "Reached" | |
| 5 | `src/components/account/profile-view.tsx` | An empty phone number is left out of the request, so a saved number cannot be removed | ✔ |
| 6 | `src/components/account/profile-view.tsx` | A field error of the API on a field the form does not show (for example `locale`) shows nothing; messages do not clear while typing | |
| 7 | `src/components/account/report-problem-view.tsx`, `issue-view.tsx`, `photo-picker.tsx` | A photo whose upload failed cannot be added later: the report page has no picker, and the `already` prop of the picker is unused though its comment promises it | |
| 8 | `src/components/account/account-shell.tsx`, `src/lib/navigation/return-to.ts` | A signed-out visitor who opens `/account/reports/<number>` lands on `/account` after the sign-in: the report page is not an accepted target | |
| 9 | `src/components/shell/locale-switcher.tsx` | The language switch drops the query: filters, `?q=` and `?page=` of a list are lost | ✔ |
| 10 | `src/components/shell/search-form.tsx` | `defaultValue` is never passed, so the field of the header is empty on a results page. A brand suggestion links to `?brand=…` and drops the typed words; the brands offered are the first three of the facets, whatever was typed | |
| 11 | `src/components/wishlist/wishlist-view.tsx` | "Remove all" on the default list calls `refresh()` without waiting for `clear()` | |
| 12 | `src/components/checkout/checkout-view.tsx`, guest's code | Applying a code previews the cart, and the changed query key previews it again: two calls to a rate-limited endpoint | |
| 13 | `src/features/reviews/reviews.ts` | `orderReviewQueryKey` does not upper-case the order number; every other key of an order does | ✔ |
| 14 | `src/components/catalogue/product-purchase.tsx` | The discount chip of a pack size shows on a size that cannot be ordered; the product card hides its badge in that case | |
| 15 | `src/components/account/address-book.tsx` | An address is deleted without a question | |
| 16 | Legal pages (`src/components/legal/`) | The admin's text is rendered without demoting its headings, so a `#` in it becomes a second `h1` of the page | |
| 17 | `src/components/auth/sign-up-form.tsx` | The link to `/legal/privacy` is always shown; the page does not exist while the privacy policy is not published | ✔ |
| 18 | `src/components/cart/cart-view.tsx` | The summary sticks at `lg:top-28` (7 rem) while the header with the category bar is about 8 rem from `lg`; it may slide under the header. Not looked at in a browser | |

## 2. Search engines

| # | Where | What | ✔ |
| --- | --- | --- | --- |
| 19 | `src/app/robots.ts` | `/*/guest/` is closed but not `/guest/`, though the emails link to `/guest/orders/<number>?token=…` without a language. The unsubscribe and reset-password addresses are closed in both forms | ✔ |
| 20 | List pages beyond page 1 (`products`, `category/[slug]`, the blog lists, `reviews`) | They set a canonical address only and lose their `hreflang` links | |
| 21 | `src/app/[locale]/(shop)/products/[slug]/page.tsx` | `twitter` has a card and no picture: a product without a picture has no picture for X of its own | |
| 22 | `src/app/manifest.ts` | The name and description are English in both languages | |
| 23 | `src/config/env.ts` | Without `NEXT_PUBLIC_SITE_URL` the canonical addresses, `robots.txt` and the sitemap name `http://localhost:3001`; the build does not fail | |

## 3. Texts that disagree with what the shop does

| # | Where | What | ✔ |
| --- | --- | --- | --- |
| 24 | `content/legal/cookies.en.md`, `cookies.de.md` | The table of "what the shop really stores" lacks keys the code writes: `rf.wishlist.v1`, `rf.referral.v1` (local storage), `rf.checkout.for.v1`, `rf.referral-notice.v1`, `rf.guest-order.v1:<number>` (session storage). A legal text: worth a look by whoever reviews the legal pages | ✔ |
| 25 | `messages/en.json`, `help.howItWorks.a1` | Says that ordering needs a sign-in or an account; guests can order since 2026-11-01 | ✔ |
| 26 | Several texts (`cart.issue.too_heavy`, `help.delivery.returnsOff`, `errors.CUSTOMER_BLOCKED`, `errors.ORDER_CANNOT_BE_CANCELLED`, `profile.delete.blockedText`) | Say "contact us"; no page shows an address, a number or a form | |
| 27 | `.env.example`, `NEXT_PUBLIC_SUPPORT_EMAIL` | Described as shown "in the footer and on error pages". The code uses it in one place: the `email` of the organisation in the structured data of the home page (`src/lib/seo/json-ld.tsx`) | ✔ |
| 28 | `messages/en.json` | Limits of the API are written into texts: 20 for a wishlist (`WISHLIST_LIMIT_REACHED`), 10 addresses, 60 minutes for the reset link, "up to five times" for reports | |
| 29 | `src/components/checkout/checkout-view.tsx`, `src/components/account/address-book.tsx` | The limit of ten addresses is written twice (`ADDRESS_LIMIT`, and a literal `10`). At the checkout "Add an address" disappears at ten without a word | ✔ |
| 30 | `src/components/account/rewards-view.tsx` | The balance has thousands separators; the earned, redeemed and held totals have none | |

## 4. Defined and not used

| # | Where | What |
| --- | --- | --- |
| 31 | `src/lib/api/store-api.ts` | `removeCartItem`, `clearCart`, `getInvoice`, `getReturn`, `saveWishlistItemTo`: no page calls them |
| 32 | `src/lib/cart/`, `src/features/` | `addQuantity`, `removeItem`, `missingLegalTypes`: not called |
| 33 | `messages/en.json`, `messages/de.json` | Texts no component reads: `legal.notPublished`, `catalogue.resultCount`, `checkout.guest.emailTaken`, `checkout.guest.emailTakenSignIn`, `cart.remove`, `auth.codeTitle`, `account.signedInAs`, `account.signOut` |
| 34 | `src/components/catalogue/price.tsx` | Size `xl` is described as the price of the product page; the page uses `lg` and nothing uses `xl` |
| 35 | `src/app/globals.css` | `--color-glass-edge` is never read; `--breakpoint-xs` has no `xs:` class; `glass-leaf` and the colours `leaf-100`, `leaf-200`, `leaf-400`, `wheat-50`, `red-200` are used by the styleguide only |
| 36 | `src/lib/api/server.ts` | Every cached answer carries a tag (`TAGS`), and nothing calls `revalidateTag` |
| 37 | `logo/` | `radhe-logo-white.*` and `radhe-logo.svg` are used by no code |

## 5. The design system, not followed

| # | Where | What |
| --- | --- | --- |
| 38 | `src/app/[locale]/(shop)/products/[slug]/page.tsx` | The discount chip uses `text-red-700`; the palette has no `red-700` ✔ |
| 39 | `src/components/shell/header.tsx`, `src/app/[locale]/(plain)/layout.tsx`, `src/components/shell/search-form.tsx` | Glass written by hand instead of the glass utilities |
| 40 | Tab bar, language switch, account shell, cart picture, checkout tiles, `cart-summary-bar.tsx` | One-off `shadow-[…]` values instead of the shadow tokens |
| 41 | `facet-popover.tsx`, `listing-controls.tsx` | The badge of the filter count has two looks (`bg-leaf-600`, `leaf-gradient`) |
| 42 | `src/app/global-error.tsx` | The ink colour is written out as `#15231c`; the token is `#17211b` |
| 43 | `return-request.tsx`, `report-problem-view.tsx` | Error texts in `text-red-600` where fields use `text-red-800`; a load error has no "Try again" |
| 44 | `src/app/[locale]/styleguide/page.tsx` | Leaves out `Sheet`, `Tooltip`, `Disclosure`, `Pagination`, `PasswordField`, `Eyebrow` |
| 45 | `src/components/shell/footer.tsx` | The "Shop" column lists every parent category, empty ones too; `/categories` hides empty ones |

## 6. Comments and files that name what moved or changed

| # | Where | What |
| --- | --- | --- |
| 46 | About 170 comments in `src/`, `mocks/`, `e2e/` | Name the backend's documents as "doc N" or by a path under `doc/`. They still lead somewhere: [the map](../reference/backend/README.md#2-what-the-comments-in-the-code-call-them). A sweep that only rewrites comments would end the detour |
| 47 | `.github/workflows/ci.yml`, `.env.example`, `next.config.ts`, `src/app/api/health/route.ts` | Name `doc/DEPLOYMENT.md`; it is `docs/deployment/README.md` |
| 48 | `tsconfig.json` | `exclude` names `doc`; the folder is `docs` (it holds no TypeScript, so nothing changes) ✔ |
| 49 | `src/features/orders/order-access.ts` | The comment says the guest's token travels as a header; `store-api.ts` sends it in the query (the API's CORS allows no such header) |
| 50 | `src/lib/api/store-api.ts`, `src/lib/checkout/order-attempt.ts` | One comment says the key of an order attempt is made on reaching the checkout, the other makes it at "Buy now" |
| 51 | `src/app/[locale]/(shop)/products/[slug]/page.tsx`, `src/components/catalogue/wishlist-button.tsx`, `src/components/shell/search-form.tsx` | Comments of an earlier layout ("three small tiles", the heart "beside Add to cart", the search form "on the list") |
| 52 | `playwright.config.ts` | The comment speaks of "cargo open or closed", from the time of pre-orders |
| 53 | `src/app/[locale]/(shop)/how-it-works/page.tsx` | Reads the rewards program with a lifetime and no tag, beside the readers of `src/features/`; writes its `FAQPage` block by hand instead of using `faqPageJsonLd` |

## 7. The backend's documents and the code

| # | What |
| --- | --- |
| 54 | The store reference (0.6) says `?locale=` works on every store endpoint. The client sends `Accept-Language` on 36 routes, because their validation refuses `?locale=` |
| 55 | The store reference (20) allows the header `X-Order-Token` for a guest's order. The client sends `?token=` only: the API's CORS allows no such header |
| 56 | The store reference (0.5) lists the allowed headers as `Content-Type`, `Authorization`, `X-Request-Id`; the shop sends `Idempotency-Key` with both checkout calls. An open item of the decision log |
| 57 | `customer-accounts.md`, section 8 (product reviews, order feedback) is replaced by `order-reviews.md` |
| 58 | The decision log of 2026-11-24 names `POST /v1/store/checkout/guest`; the code and the store reference say `POST /v1/store/guest/checkout` |

## 8. Not determined

- Whether the query client, the cart and the wishlist survive a change of language, and with them several query keys that carry no language (`["addresses"]`, `["invoices"]`, `["account","overview"]`, `["wishlists"]`).
- Whether Next.js keeps the English and the German answer of a cached call apart when the language travels as a header.
- Whether `/de/styleguide` resolves; the lifetime of the `NEXT_LOCALE` cookie; the status code of the redirect from `/` to a language.
- Contrast of text on glass over the page's gradients: the axe test asserts violations only, and a machine cannot measure text over a gradient.
- Which of the "Before launch" items of the old README are still open ([the list](2026-11-readme-status-log.md)).
- No test covers an `error.tsx` or `global-error.tsx`, and none guards the `data-fly-*` markup the flight into the cart relies on.
