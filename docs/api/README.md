# The API client

How the shop talks to the store API (`radhe-api`, at `api.radhefoods.de` in production). Every call the shop makes is defined once, in `src/lib/api/store-api.ts`, and is used through one of two entry points: one for the Next.js server, one for the browser. The API decides prices, VAT, stock, bills and fees; the client only carries the questions and the answers.

| Document | Holds |
| --- | --- |
| This document | The client, the session, the conventions of the data, caching, the main types, how to add a call |
| [endpoints.md](endpoints.md) | Every endpoint the shop calls |
| [error-handling.md](error-handling.md) | The error model, the texts for the customer, what pages and forms do with an error |
| [reference/backend/store-api.md](../reference/backend/store-api.md) | The backend's own reference of every call; "doc 7" or "(20)" in a code comment is its section 7 or 20 |

## 1. The files

| File | What it is |
| --- | --- |
| `src/lib/api/store-api.ts` | `createStoreApi`: one function per endpoint, 91 in all, and the two helpers for the paths of a PDF |
| `src/lib/api/http.ts` | `send` (one HTTP call), `buildUrl`, `toApiError`, `parseJson`, `createRequester` (a requester without a session) |
| `src/lib/api/session-transport.ts` | `createSessionTransport`: cookies with every call, one refresh on an expired access cookie |
| `src/lib/api/server.ts` | `serverApi`, the lifetimes `REVALIDATE`, the tags `TAGS`, `leaveToFirstVisitWhileBuilding` |
| `src/lib/api/browser.ts` | `api` and `session` for client components |
| `src/lib/api/types.ts` | The shapes of every request and answer |
| `src/lib/api/errors.ts`, `src/lib/api/error-text.ts` | `ApiError`, its codes and helpers; the sentence for the customer ([error-handling.md](error-handling.md)) |
| `src/lib/api/http.test.ts`, `src/lib/api/session-transport.test.ts` | Tests of the time limit, the URL, the error format and the refresh |

## 2. The base addresses

Both are read in `src/config/env.ts`, without a trailing slash and without `/v1` (the paths carry it). More in [architecture/configuration.md](../architecture/configuration.md).

| Variable | Read as | Used by | Without it |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `env.apiUrl` | The browser (`api`, `session`) | `http://localhost:3000`, the mock API |
| `API_INTERNAL_URL` | `env.apiInternalUrl` | The Next.js server (`serverApi`); never exposed to the browser | The value of `env.apiUrl` |

## 3. The two entry points

| | `serverApi` | `api` and `session` |
| --- | --- | --- |
| File | `src/lib/api/server.ts` | `src/lib/api/browser.ts` |
| Used in | Server components, `generateMetadata` and `src/app/sitemap.ts`, mostly through the readers of section 7 | Client components and hooks only |
| Requester | `createRequester` | `createSessionTransport` |
| Cookies | None: `credentials` is not set | `credentials: "include"` on every call |
| Reads | Public data: settings, legal texts, catalogue, banners, FAQ, blog, published reviews, the rules of the coins | Everything of a customer or a guest, and public data that must be of the moment: search suggestions, further pages of a row of the home page, stock and pictures on the product page, the legal versions at the checkout |
| Language when a call names none | None is sent; the API answers in its default | The `lang` of the `<html>` element, when it is `en` or `de` |
| Time limit | 10 seconds (`API_TIMEOUT_MS`) | None |
| Answers kept by | The Next.js data cache (section 7) | TanStack Query (section 8) |

Nothing of a customer is read on the server: the refresh cookie travels only to `/v1/store/auth/*` and never reaches the Next.js server ([store-api.md](../reference/backend/store-api.md), section 0.5). Account pages therefore render a frame on the server and load their content in the browser ([architecture/authentication-and-security.md](../architecture/authentication-and-security.md)).

## 4. How a request is built

```
api.setCartItem(variantId, 2)
  → request("/v1/store/cart/items/<variantId>", { method: "PUT", body: { quantity: 2 } })
  → send: address = base + path + query, headers, body
  → fetch
  → 2xx: parseJson (204 answers undefined) · anything else: ApiError
```

`createStoreApi(request)` takes a `Requester` (`<T>(path, options) => Promise<T>`) and returns the object with all calls. Each call takes its own parameters and, last, an optional `CallOptions` (`locale`, `signal`, `next`, `cache`). Path parameters are passed through `encodeURIComponent`.

| Option of `RequestOptions` | Effect |
| --- | --- |
| `method` | `GET` unless set |
| `query` | Added to the address. `undefined`, `null` and `""` are left out; a list is sent as a repeated parameter (`brand=a&brand=b`) |
| `body` | Sent as JSON with `Content-Type: application/json` |
| `formData` | Sent as `multipart/form-data`; the browser sets the content type (the photos of a problem report) |
| `headers` | Extra headers, after `Accept: application/json` |
| `signal` | An `AbortSignal`. An aborted call rejects with the `AbortError` itself, not with an `ApiError` |
| `locale` | The language of the answer; else the default of the entry point |
| `localeAs` | `"query"` (the default): `?locale=en`. `"header"`: `Accept-Language: en` |
| `next` | `{ revalidate, tags }` for the Next.js data cache; server only |
| `cache` | A `RequestCache`, for example `"no-store"` |

**The language.** Inside `createStoreApi` two requesters exist. `request` sends the language as `?locale=`; 55 calls use it. `localized` is `request` with `localeAs: "header"`; 36 calls use it, because the validation of their routes refuses a query field it does not list: the two steps after the sign-up form, the account overview, deleting the account, the coins, the guest order, the named wishlists, the referrals, the order reviews and the problem reports. [endpoints.md](endpoints.md) says for each section which way it travels. Some bodies carry a language of their own besides: `locale` in `SignUpInput`, in the body of `forgotPassword`, in `UpdateProfileInput`, `CreateReturnInput`, `WriteReviewInput` and `CreateIssueInput`; `language` in `CheckoutInput` and `GuestCheckoutInput`.

**Idempotency keys.** `checkout` and `guestCheckout` take the key as their second parameter and send it as the header `Idempotency-Key`. The key comes from `checkoutKey` in `src/lib/checkout/order-attempt.ts`: one key per order (a fingerprint of the request and the lines of the bill), kept in `sessionStorage` under `rf.checkout.key.v1` until an order answers, so a retry after a lost answer finds the first order instead of making a second one. See [features/checkout.md](../features/checkout.md). No other call sends a key.

**Other headers.** The client sends no `X-Request-Id`; it reads the `x-request-id` of an answer that is an error. A guest's order token travels as `?token=`, never as a header.

## 5. The session

The session lives in two `httpOnly` cookies the shop cannot read. `createSessionTransport` gives `request` (JSON), `raw` (the plain `Response`, used for the invoice PDF), `refresh` and `onSessionEnded`.

```
call → 401 AUTH_TOKEN_INVALID
  → POST /v1/store/auth/refresh        (one request, shared by every call that failed meanwhile)
      → 2xx                            → the call is sent once more; its outcome stands
      → AUTH_REFRESH_INVALID or
        CUSTOMER_BLOCKED               → the session is over: listeners run, the call fails with its 401
      → anything else (network, 503)   → the call fails with that error; the session is kept
```

| Rule | Detail |
| --- | --- |
| Which calls refresh | Any call outside `/v1/store/auth/`, and `POST /v1/store/auth/logout-all`, the one auth route that needs a session |
| Single flight | Refresh tokens rotate, so parallel calls must not each refresh: while a refresh is on its way, every caller awaits the same promise |
| One attempt | A call that fails with `AUTH_TOKEN_INVALID` again after the refresh is not refreshed a second time |
| The session ends | `Providers` in `src/features/providers.tsx` listens with `session.onSessionEnded`: the hint `rf.session.v1` is removed, the session query is set to `null` and every other cached answer is dropped (`forgetCachedData`) |

Whether anyone is signed in is the answer of `GET /v1/store/me`. `useSession` in `src/features/session/session.ts` asks only when the browser holds the hint `rf.session.v1` in `localStorage`, or when a page needs an account (`force`). The rest is in [architecture/authentication-and-security.md](../architecture/authentication-and-security.md) and [features/authentication.md](../features/authentication.md).

## 6. The conventions of the data

The types state them once, at the top of `src/lib/api/types.ts`; the backend's wording is section 0.7 and 0.8 of [store-api.md](../reference/backend/store-api.md).

| Kind | Type | Meaning |
| --- | --- | --- |
| Money | `Cents` | Whole cents in EUR, VAT included (`1999`, 19.99 €). The shop formats, it never calculates a price |
| Id | `Id` | A string of 24 hex characters. A cart line and an order item are named by `variantId`, a wishlist entry by `productId` |
| Numbers for people | `string` | Order, return, report and invoice numbers; the query keys of the browser upper-case them |
| Date and time | `IsoDateTime` | ISO 8601 in UTC |
| VAT rate | `VatRate` | Hundredths of a percent: `700` is 7 % |
| Weight | `Grams` | Whole grams |
| Pages by number | `Page<T>` | `items`, `page`, `limit`, `total`, `totalPages`: products, blog posts, reviews, the history of the coins |
| Pages by cursor | `CursorPage<T>` | `items`, `nextCursor` (`null` on the last page): orders, invoices |
| Lists without pages | `{ items: T[] }` | Categories, addresses, legal texts, named wishlists, reports, the customer's reviews |
| Not set | `null` | A field marked optional (`?`) is one an older API leaves out; the comment at the field says since when |

## 7. Caching on the server

`serverApi` passes `next: { revalidate, tags }` to `fetch`. The readers below are wrapped in `cache` of React where a page and its metadata ask the same thing, so one request asks once. The tags are set on every cached answer; nothing in the shop calls `revalidateTag`, so the lifetime is the only way an answer expires. How pages themselves are rendered and kept is in [architecture/rendering-and-caching.md](../architecture/rendering-and-caching.md).

| Reader | File | Endpoint | Kept for | Tag |
| --- | --- | --- | --- | --- |
| `getSettings` | `src/features/catalogue/data.ts` | `GET /v1/store/settings` | 300 s | `settings` |
| `getCategories`, `loadCategories` | same | `GET /v1/store/categories` | 300 s | `catalogue` |
| `getCategory` | same | `GET /v1/store/categories/{slug}` | 300 s | `catalogue` |
| `listProducts` | same | `GET /v1/store/products` | 300 s | `catalogue` |
| `getProductFacets` | same | `GET /v1/store/products/facets` | 300 s | `catalogue` |
| `getProduct` | same | `GET /v1/store/products/{slug}` | 300 s | `catalogue` |
| `getBanners` | same | `GET /v1/store/banners` | Not kept (`cache: "no-store"`) | – |
| `getFaqs` | `src/features/content/data.ts` | `GET /v1/store/faqs` | 300 s | `content` |
| `listBlogPosts`, `getBlogPost` | same | `GET /v1/store/blog/posts`, `…/posts/{slug}` | 300 s | `content` |
| `getBlogCategories`, `loadBlogCategories`, `getBlogTags` | same | `GET /v1/store/blog/categories`, `…/tags` | 300 s | `content` |
| `getPublishedLegal` | `src/features/legal/data.ts` | `GET /v1/store/legal`, always asked in English | 300 s | `legal` |
| `getLegalDocument` | same | `GET /v1/store/legal/{type}` | 300 s | `legal` |
| `getReviews` | `src/features/reviews/data.ts` | `GET /v1/store/reviews` | 300 s; 0 in development | `reviews` |
| `programOf` | `src/app/[locale]/(shop)/how-it-works/page.tsx` | `GET /v1/store/rewards/program` | 300 s | none |
| The sitemap | `src/app/sitemap.ts` | Categories, every page of products and blog posts in both languages, blog categories, legal texts, FAQ, one review | 3600 s | `catalogue`, `content`, `legal`, `reviews` |

The lifetimes are the constants of `REVALIDATE` (`catalogue`, `settings`, `legal`, `content`, `reviews`, each 300). A list is cached per query: the row of a category on the home page (`rowQuery` in `src/features/catalogue/home.ts`) and the category page are two entries. The facets leave `page`, `limit`, `sort` and `view` out of their query, so every page of a list shares one entry.

## 8. Caching in the browser

One `QueryClient` per tab, made in `src/features/providers.tsx`.

| Default | Value |
| --- | --- |
| `staleTime` | 30 seconds |
| `retry` of a query | Up to two more attempts, only when `isRetryable` says so (network, 429, 502 to 504) |
| `retryDelay` | `min(1000 × 2^attempt, 8000)` milliseconds |
| `retry` of a mutation | Never |

| Query key | Call | Stale after | Set in |
| --- | --- | --- | --- |
| `["session"]` | `getMe` | 5 min | `src/features/session/session.ts` |
| `["cart", locale]` | `getCart` | 30 s; 0 on the checkout page | `src/features/cart/cart.tsx`, `src/features/cart/use-bill.ts`, `src/components/checkout/checkout-view.tsx` |
| `["bill", "guest", locale, items]` | `previewCart` | 30 s | `src/features/cart/use-bill.ts` |
| `["cart", "preview", locale, items, code]` | `previewCart` with a code | 0 | `src/components/checkout/checkout-view.tsx` |
| `["addresses"]` | `listAddresses` | 30 s | `src/features/orders/orders.ts` (key) |
| `["legal", locale]` | `listLegal` | 0 | `src/components/checkout/checkout-view.tsx` |
| `["wishlist", locale]` | `getWishlist` | 30 s | `src/features/wishlist/wishlist.tsx` |
| `["wishlist", "preview", locale, entries]` | `previewWishlist` | 30 s | same |
| `["wishlists"]`, `["wishlist", "named", id, locale]` | `listWishlists`, `getWishlistById` | 30 s | `src/features/wishlist/wishlists.ts` |
| `["account", "overview"]` | `getOverview` | 30 s | `src/features/account/overview.ts` |
| `["account", "rewards"]` | `getMyRewards` | 30 s | `src/features/account/rewards.ts` |
| `["account", "rewards", "history"]` | `listRewardTransactions`, page by page | 0 | `src/components/account/rewards-view.tsx` |
| `["account", "referral"]` | `getReferral` | 30 s | `src/components/account/referral-view.tsx` |
| `["account", "reviews"]`, `["account", "reviewable"]` | `listMyReviews`, `listReviewable` | 0 | `src/features/reviews/reviews.ts` (keys) |
| `["orderReview", orderNumber, locale]` | `getOrderReview` | 0 | same |
| `["orders", locale]` | `listOrders`, by cursor | 0 | `src/features/orders/orders.ts` (keys) |
| `["order", NUMBER, locale]`, `["guest-order", NUMBER, locale]` | `getOrder`, `getGuestOrder` | 0 | same |
| `["order-payment", NUMBER]`, `["guest-order-payment", NUMBER]` | `getOrderPayment`, `getGuestOrder` | 0; asked again every 3 s, later every 10 s, while a payment completes | same |
| `["order-documents", NUMBER]`, `["guest-order-documents", NUMBER]` | `listInvoices`, `getGuestOrder` | 30 s | same |
| `["order-returns", NUMBER, locale]` | `getOrderReturns` | 30 s on the order page, 0 on the return form | same |
| `["invoices"]` | `listInvoices`, by cursor | 0 | same |
| `["issues", locale]`, `["issue", NUMBER, locale]` | `listIssues`, `getIssue` | 0 | `src/features/issues/issues.ts` (keys) |
| `["order-issues", NUMBER, locale]` | `getOrderIssues` | 30 s on the order page, 0 on the report form | same |
| `["product-ordering", productId, locale]` | `getProduct` | 30 s | `src/components/catalogue/product-purchase.tsx` |
| `["search-suggestions", locale, q]`, `["search-brands", locale, q]` | `listProducts`, `getProductFacets` | 60 s, no retry | `src/components/shell/search-form.tsx` |
| `["search-recommended", locale]`, `["search-popular", locale]` | `listProducts` | 5 min, no retry | same |

The keys do not name the customer. When the session ends, or another customer signs in, `forgetCachedData` removes everything but `["session"]`; signing out loads the page afresh. A call that changes something writes the answer into the cache where the API answers the whole object (the bill, the wishlist, the address list) and invalidates the keys that depend on it, `["account", "overview"]` among them. The rules of the state are in [architecture/state-management.md](../architecture/state-management.md).

## 9. Main types

All in `src/lib/api/types.ts`. The field-by-field reference is the backend's ([store-api.md](../reference/backend/store-api.md)); the comments in the file name its sections.

| Type | What it is |
| --- | --- |
| `Customer` | The signed-in person: name, email, language, `Communication`, `kind` (`registered` or `guest`) |
| `SessionResult` | The answer of sign-in and refresh: the customer and the seconds the access cookie lasts |
| `Address`, `AddressInput` | A saved delivery address, and what the form sends |
| `ShopSettings` | Delivery fee steps, `ShopShipping` (delivery by the box), the delivery estimate, the windows for returns and reports |
| `LegalSummary`, `LegalDocument` | A published legal page with its `version`; with its text |
| `Category`, `CategoryDetail` | A node of the category tree with its `listingView`; with breadcrumbs |
| `ProductSummary` | A product shown as one of its pack sizes: the entry of every list, cart line and wishlist |
| `ProductDetail` | The product page: the list entry plus texts, gallery, food details |
| `ProductVariant` | One pack size: its id (the `variantId` of cart and orders), price, stock, pictures |
| `PriceView` | Price, regular and sale price, discount, VAT, base price per unit |
| `Ordering` | Whether a pack size can be ordered at this moment, and the quantity limits |
| `ProductQuery`, `ProductList`, `ProductFacets` | The filters of a list, a page of it with its `view`, the counts behind the filters |
| `Bill` | The answer of every cart call: lines, totals, delivery, the code, the coins, `canOrder` |
| `BillLine`, `Totals` | One pack size on the bill with its `issue`; the sums and the VAT groups |
| `BillShipping`, `ShippingBox` | Delivery by the box: the boxes, which are free, what is missing for the next free one |
| `BillDiscount`, `BillRewards` | The discount code and the coins on a bill, with the reason when they do not apply |
| `CheckoutInput`, `CheckoutResult` | What placing an order sends; the order with its payment page |
| `GuestCheckoutInput`, `GuestCheckoutResult`, `GuestOrder` | The same for a guest, with the token; the guest order with payment and documents in one |
| `OrderSummary`, `OrderDetail` | An order in a list; the whole order with items, totals, address, `PaymentBlock` |
| `PaymentBlock`, `OrderPayment`, `CheckoutSession` | The state of a payment; with the documents; a payment page |
| `InvoiceSummary`, `InvoiceDetail` | An invoice or a credit note |
| `ReturnRequest`, `OrderReturns` | A return; the returns of an order and what can still be returned |
| `Wishlist`, `WishlistSummary` | A list with its products; a list as an entry of the lists |
| `Issue`, `OrderIssues` | A problem report; the reports of an order and what can be reported |
| `Review`, `ReviewPage`, `MyReview` | A published review; a page with the summary; the customer's own review with its status |
| `RewardsProgram`, `MyRewards`, `RewardTransaction` | The rules of the coins; the customer's balance; one movement |
| `Banner`, `Faqs`, `BlogPostSummary`, `BlogPost` | The content the admin keeps |

## 10. Adding a call

1. **The types.** Add the request and answer shapes to `src/lib/api/types.ts`, in the section of the backend document, with the section number in the comment. Write only fields the backend documents.
2. **The call.** Add one function to `createStoreApi` in `src/lib/api/store-api.ts`, in the block of its section: own parameters first, `o?: CallOptions` last, the path with `seg(…)` around every parameter. Use `request`, or `localized` when the route refuses `?locale=`.
3. **The errors.** A code the route can answer goes into `API_ERROR_CODES` in `src/lib/api/errors.ts`, its `details` into `ErrorDetails`, and its sentence into the `errors` namespace of `messages/en.json` and `messages/de.json` ([error-handling.md](error-handling.md)).
4. **The reader.** Public data for a server page: a function in the `data.ts` of its area (as in `src/features/catalogue/data.ts`) that calls `serverApi` with a `REVALIDATE` lifetime and a tag of `TAGS`, wrapped in `cache`, and that decides between a fallback and throwing. Data of a customer: `useQuery` with `api`, a key exported beside the other keys of the area, and the invalidations of what it changes.
5. **The mock.** The route in `mocks/server.ts` with the same shapes and codes, and a test in `mocks/` that calls it through the client ([development/mock-api.md](../development/mock-api.md)).
6. **The documents.** A row in [endpoints.md](endpoints.md), and the feature document's "Data and API" ([documentation standard](../development/documentation-standard.md)).
