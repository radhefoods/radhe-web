# State management

The shop keeps no global store. What the API knows is held in TanStack Query's cache in the browser's memory; what a visitor owns before signing in (the cart, the wishlist, a referral code) is held in the browser's storage; what a list shows is held in the address. Two React contexts, the cart and the wishlist, hide where their data lives, so a component reads one cart whether it is a visitor's or a customer's. The server holds no state of a visitor at all.

## Where state lives

| State | Lives in | Owner |
| --- | --- | --- |
| Who is signed in | httpOnly cookies of the API; the answer of `GET /v1/store/me` in the query cache; a hint in `localStorage` | `src/features/session/session.ts` |
| A visitor's cart | `localStorage` | `src/lib/cart/guest-cart.ts` |
| A customer's cart and every bill | The API; the answer in the query cache | `src/features/cart/cart.tsx`, `src/features/cart/use-bill.ts` |
| A visitor's wishlist | `localStorage` | `src/lib/wishlist/guest-wishlist.ts` |
| A customer's wishlists | The API; the answers in the query cache | `src/features/wishlist/wishlist.tsx`, `src/features/wishlist/wishlists.ts` |
| Orders, addresses, invoices, returns, reports, reviews, coins, referrals | The API; the answers in the query cache | The account's components and `src/features/orders`, `src/features/issues`, `src/features/reviews`, `src/features/account` |
| Search, filters, sorting, the page of a list | The address | `src/features/catalogue/listing-state.ts`, `src/features/content/blog-state.ts`, `src/features/reviews/reviews.ts` |
| The chosen pack size of a product page | The address (the slug) and a context of the page | `src/components/catalogue/product-purchase.tsx` |
| The language | The address; the cookie `NEXT_LOCALE` for a request without a language | `src/proxy.ts` |
| The open order attempt, the token of a guest order | `sessionStorage` | `src/lib/checkout/order-attempt.ts`, `src/lib/orders/guest-token.ts` |
| A referral code from a link | `localStorage` | `src/lib/referral/referral-code.ts` |
| What is typed into a form, an open menu or sheet | The component (`useState`, `react-hook-form` for the address form) | The component |

## Providers and contexts

`Providers` in `src/features/providers.tsx` wraps every page, in this order: `QueryClientProvider`, `CartProvider`, `WishlistProvider`. The query client is created once, when `Providers` mounts.

| Context | Provider | Read with | Gives |
| --- | --- | --- | --- |
| Cart | `CartProvider` in `src/features/cart/cart.tsx` | `useCart` | `ready`, `mode` (`guest` or `customer`), `items`, `units`, `quantityOf`, `setQuantity`, `problem`, `clearProblem` |
| Wishlist | `WishlistProvider` in `src/features/wishlist/wishlist.tsx` | `useWishlist` | `ready`, `mode`, `entries`, `count`, `has`, `save`, `remove`, `clear`, `problem`, `clearProblem` |
| Addresses in the other language | `LocaleAlternatesProvider` in `src/components/shell/locale-switcher.tsx` | `LocaleSwitcher`; set by a page through `LocaleAlternates` | The address of the current page per language, where the slug differs ([routing](routing.md)) |
| The chosen pack size | `PackSizes` in `src/components/catalogue/product-purchase.tsx` (product page only) | The `PackSize…` parts and `ProductPurchase` | The product, the chosen size, its `ordering` and pictures as the API has them at this moment, `select` |
| Texts | `NextIntlClientProvider` in `src/app/[locale]/layout.tsx`, extended by `AreaMessages` | `useTranslations` | The namespaces a client component may use ([internationalisation](internationalization.md)) |

The session is not a context. `useSession` is a hook over the query cache and the hint, so every component that calls it shares one answer.

Both the cart and the wishlist read `localStorage` through `useSyncExternalStore`: the server's snapshot is empty, a change in this tab is announced by a window event (`rf:guest-cart`, `rf:guest-wishlist`), and a change in another tab arrives with the browser's `storage` event. `ready` is false on the first paint and while a customer's stored cart or list, or the hand-over after sign-in, is still on its way.

## The session

| Piece | Behaviour |
| --- | --- |
| `useSession()` | Answers `loading`, `guest` or `customer` with the customer. Without the hint it answers `guest` at once and asks nothing: a visitor who never signed in costs no failing request |
| `useSession({ force: true })` | Asks the API even without the hint: the account (`AccountShell`) and the checkout |
| The hint `rf.session.v1` | Set when `GET /v1/store/me` answers a customer or a sign-in succeeds; removed when the API answers `AUTH_TOKEN_INVALID` or `CUSTOMER_NOT_FOUND`, when the refresh is refused, at sign-out and when the account is deleted |
| `error` | The API could not be asked. The status is then `guest` with an error, and the account and the checkout offer "try again" instead of treating the visitor as signed out |
| `useSessionActions().signedIn(customer)` | After sign-in, sign-up and a saved profile: stores the customer in the cache and sets the hint. When the customer is another one than the one in memory, the rest of the cache is dropped first |
| The session ends (`session.onSessionEnded`) | `Providers` removes the hint, sets the session to `null` and drops everything else in the cache |
| Sign-out, account deleted | The home page is loaded afresh with `window.location.assign`, which empties the memory |

The query keys do not name the customer; `forgetCachedData` therefore removes every query but the session whenever the session changes hands. How the cookies travel and how an expired access cookie is renewed is in [authentication and security](authentication-and-security.md).

## TanStack Query

The client's defaults (`createQueryClient` in `src/features/providers.tsx`):

| Option | Value |
| --- | --- |
| `staleTime` | 30 s |
| `retry` of a query | Up to two more attempts, and only when asking again can help (`isRetryable` in `src/lib/api/errors.ts`: the network failed, `RATE_LIMITED`, status 502, 503 or 504) |
| `retryDelay` | 1 s, then 2 s (doubling, 8 s at most) |
| `retry` of a mutation | Never |

The code uses `useQuery` and `useInfiniteQuery` only. A write is a plain call of `api` (`src/lib/api/browser.ts`) whose answer is put into the cache with `setQueryData`, or followed by `invalidateQueries`.

### Query keys

A key carries the language where the answer holds translated text.

| Key | Answer | Stale after | Defined in |
| --- | --- | --- | --- |
| `["session"]` | The signed-in customer or `null` | 5 min | `src/features/session/session.ts` |
| `["cart", locale]` | A customer's cart as a bill | 30 s; at once on the checkout | `src/features/cart/cart.tsx` |
| `["bill", "guest", locale, items]` | The bill of a visitor's cart (`POST /v1/store/cart/preview`), asked 350 ms after the last change | 30 s | `src/features/cart/use-bill.ts` |
| `["cart", "preview", locale, items, code]` | The same for the guest checkout, with its discount code | At once | `src/components/checkout/checkout-view.tsx` |
| `["wishlist", locale]` | A customer's default list | 30 s | `src/features/wishlist/wishlist.tsx` |
| `["wishlist", "preview", locale, entries]` | A visitor's list with its products (`POST /v1/store/wishlist/preview`) | 30 s | `src/features/wishlist/wishlist.tsx` |
| `["wishlists"]`, `["wishlist", "named", id, locale]` | A customer's lists; one named list | 30 s | `src/features/wishlist/wishlists.ts` |
| `["account", "overview"]` | The counts and tiles of the account | 30 s | `src/features/account/overview.ts` |
| `["account", "rewards"]`, `["account", "rewards", "history"]` | The coins; their history, page by page | 30 s; at once | `src/features/account/rewards.ts`, `src/components/account/rewards-view.tsx` |
| `["account", "referral"]` | The referral code and the invitations | 30 s | `src/components/account/referral-view.tsx` |
| `["account", "reviews"]`, `["account", "reviewable"]`, `["orderReview", orderNumber, locale]` | The customer's reviews, the orders still to review, the review of one order | At once | `src/features/reviews/reviews.ts` |
| `["orders", locale]` | The orders, page by page | At once | `src/features/orders/orders.ts` |
| `["order", NUMBER, locale]`, `["guest-order", NUMBER, locale]` | One order, by the session or by a guest's token | At once | `src/features/orders/orders.ts` |
| `["order-payment", NUMBER]`, `["guest-order-payment", NUMBER]` | The payment of an order; asked again every few seconds while a payment completes | At once | `src/features/orders/orders.ts` |
| `["order-documents", NUMBER]`, `["guest-order-documents", NUMBER]` | The invoice and credit notes of an order | 30 s | `src/features/orders/orders.ts` |
| `["order-returns", NUMBER, locale]` | The returns of an order | 30 s; at once on the return page | `src/features/orders/orders.ts` |
| `["issues", locale]`, `["issue", NUMBER, locale]`, `["order-issues", NUMBER, locale]` | Problem reports: all, one, those of an order | At once (those of an order: 30 s on the order page) | `src/features/issues/issues.ts` |
| `["addresses"]` | The address book | 30 s | `src/features/orders/orders.ts` |
| `["invoices"]` | The invoices, page by page | At once | `src/features/orders/orders.ts` |
| `["legal", locale]` | The published legal texts with their versions, for the consent | At once | `src/components/checkout/checkout-view.tsx` |
| `["product-ordering", productId, locale]` | A product once more: stock and pictures of the product page | 30 s | `src/components/catalogue/product-purchase.tsx` |
| `["search-suggestions", locale, q]`, `["search-brands", locale, q]` | Products and brands for the words typed | 60 s, no retry | `src/components/shell/search-form.tsx` |
| `["search-recommended", locale]`, `["search-popular", locale]` | The suggestions of an empty search field | 5 min, no retry | `src/components/shell/search-form.tsx` |

`NUMBER` is the order or report number in capitals; `orderReview` alone takes the order number as the address has it. A customer's order and a guest's order never share an entry. The further pages of a home page row (`src/components/home/category-row.tsx`) are component state, not queries.

### What a change refreshes

| Change | In the cache |
| --- | --- |
| A quantity in a customer's cart | Shown at once from a pending map; the answer (the whole bill) replaces `["cart", locale]` after reads on their way are cancelled; a failure invalidates the key |
| A discount code or coins on the checkout | The answered bill replaces `["cart", locale]`; a guest's code is part of the preview's key, so the bill is asked for again |
| Heart on or off (customer) | Shown at once; the answer replaces `["wishlist", locale]`; a failure invalidates it |
| A change of a customer's named lists (`useWishlistsRefresh`) | `["wishlists"]` and the overview invalidated, the touched lists too |
| An address saved | `["addresses"]` replaced by the answer; the overview invalidated |
| An order placed | The answered order stored under its key before the browser leaves for the payment page |
| The payment's status differs from the order on the page | The order, the list of orders and the order's documents invalidated |
| An order cancelled | The payment, the list of orders and the overview invalidated; the order replaced by the answer, or removed when it was unpaid, because the API deletes such an order |
| A return requested | The order and its returns invalidated |
| A problem reported, or a report changed | The report stored; the reports of the order, the list of reports and the overview invalidated |
| A review written | The order's review stored; the customer's reviews and the orders to review invalidated |

## Storage in the browser

Every read and write is wrapped in `try`: with storage blocked the shop works, and the state lasts for the page only. Whatever is read is checked before use; a cart or wishlist from storage is cut down to what the API accepts.

| Key | Storage | Holds | Written in | Removed |
| --- | --- | --- | --- | --- |
| `rf.cart.v2` | `localStorage` | A visitor's cart: pack sizes and quantities, never prices | `src/lib/cart/guest-cart.ts` | When the cart is emptied, handed over after sign-in, or a guest order was paid |
| `rf.wishlist.v1` | `localStorage` | A visitor's wishlist: products, each with the pack size it was saved from, newest first | `src/lib/wishlist/guest-wishlist.ts` | When the list is emptied or handed over after sign-in |
| `rf.session.v1` | `localStorage` | `1`: this browser signed in before | `src/features/session/session.ts` | See "The session" |
| `rf.referral.v1` | `localStorage` | The code of a referral link (`?ref=`) and when it expires, 30 days after the link | `src/lib/referral/referral-code.ts` | After 30 days, or when a sign-up went through |
| `rf.cookie-notice.v1` | `localStorage` | `1`: the cookie notice was read | `src/components/shell/cookie-notice.tsx` | Never by the shop |
| `rf.checkout.key.v1` | `sessionStorage` | The idempotency key of the order attempt | `src/lib/checkout/order-attempt.ts` | When an order answered, or with the tab |
| `rf.checkout.for.v1` | `sessionStorage` | A hash of the order the key was made for; no address and no email | `src/lib/checkout/order-attempt.ts` | With the key |
| `rf.guest-order.v1:` followed by the order number | `sessionStorage` | The token of a guest order, so its page opens without the query | `src/lib/orders/guest-token.ts` | When the API refuses the token, or with the tab |
| `rf.referral-notice.v1` | `sessionStorage` | The code whose invitation notice was closed | `src/components/shell/invitation-notice.tsx` | With the tab |

A script in the root layout reads `rf.cookie-notice.v1` before the first paint and marks `<html data-cookie-notice="read">`, so a returning visitor never sees the notice. With storage blocked, the idempotency key lives in the memory of the page.

## Cookies

The shop's code sets and reads no cookie: there is no `document.cookie` and no `cookies()` in `src`.

| Cookie | Set by | Meaning |
| --- | --- | --- |
| `rf_customer_access` | The API, httpOnly | The session; travels with every call of `api` (`credentials: "include"`) |
| `rf_customer_refresh` | The API, httpOnly | Renews the session; travels to the API's auth routes only |
| `NEXT_LOCALE` | `next-intl` in `src/proxy.ts` | The visitor's language where it differs from the one the browser asks for; read for a request without a language. A session cookie (`src/i18n/routing.ts` sets no `localeCookie` option) |

Their lifetimes are the API's: [customer authentication](../reference/backend/customer-auth.md).

## State in the address

A view that can be linked, shared and reached with the back button keeps its state in the query of the address. Whatever arrives is checked against what the API accepts before it is sent on, so a hand-edited address cannot cause an error.

| Page | Parameters | Parsed by |
| --- | --- | --- |
| `/en/products` · `/de/produkte`, `/en/category/[slug]` · `/de/kategorie/[slug]` | `q`, `sort`, `page`, `brand`, `tag`, `storageType`, `packSize` (each repeatable), `minPrice`, `maxPrice`, `onSale`, `orderable`; `priceBand` from the form without scripts | `parseListingState` in `src/features/catalogue/listing-state.ts` |
| Blog lists | `q`, `page` | `parseBlogState` in `src/features/content/blog-state.ts` |
| `/en/reviews` · `/de/bewertungen` | `rating`, `page` | `parseReviewsState` in `src/features/reviews/reviews.ts` |
| Sign-in, sign-up | `returnTo` (a fixed list of pages), `email` on sign-in, `ref` on sign-up | `parseReturnTo` in `src/lib/navigation/return-to.ts` |
| Any page | `ref`: a referral code, kept for 30 days | `ReferralCapture` in `src/components/shell/referral-capture.tsx` |
| `/en/reset-password` | `token` | The page |
| An order's page | `payment` (`success` or `cancelled`), `pay=1` | The page |
| A guest order's page | `token`, `payment`, `pay=1` | The page and `src/lib/orders/guest-token.ts` |
| A report's page | `photos=failed` | `IssueView` |

Defaults are left out of the address (`toSearchParams`), a filter change replaces the entry in the history instead of adding one, and filtered or sorted views are kept out of search engines ([catalogue](../features/catalogue.md), [SEO](seo.md)). On the product page the chosen pack size is the last part of the path: choosing a size calls `history.pushState`, and back and forward move between the sizes.

## The visitor's cart and the customer's cart

```text
visitor                                         customer
rf.cart.v2 in localStorage                      the cart stored by the API
  │  setQuantity writes storage at once           │  setQuantity: shown at once, sent 300 ms
  │                                               │  after the last tap, one request after the other
  ▼                                               ▼
POST /v1/store/cart/preview  → the bill         every answer is the whole bill → ["cart", locale]

sign-in or sign-up
  └─ CartProvider sees a customer and a cart in storage
       → POST /v1/store/cart/merge, once
       → the answer becomes ["cart", locale]; rf.cart.v2 is removed
       → until then `ready` is false, so no page shows the cart from before the hand-over
```

Components see neither side: `useCart` gives quantities and one `setQuantity`, `useBill` gives the bill with `loading` and `updating`. The browser never calculates a price or a total. A hand-over that fails leaves the visitor's cart in storage and is tried again at the next visit; the customer goes on with the stored cart. The wishlist follows the same pattern with `POST /v1/store/wishlist/merge`. The rules (limits, which quantity wins, what a bill contains) are in [cart and bill](../business-logic/cart-and-bill.md); the calls are in the [endpoints](../api/endpoints.md#cart).

## Not kept

| Missing | Meaning |
| --- | --- |
| A persisted query cache | A reload asks the API again; nothing of a customer is written to storage |
| A draft of the checkout | The guest's email address, the typed address and the choice of the guest checkout are component state: a reload starts the page over |
| A global store | No Redux, Zustand or similar; the two contexts and the query cache are all there is |
