# Rendering and caching

The server renders what is the same for everyone: the frame of the shop and the public content, from answers of the API it keeps for 300 seconds. The browser renders what belongs to one visitor: the session, the cart with its bill, the wishlist, the checkout and the account. A page from the server can therefore be up to a few minutes behind the admin panel; whatever decides an order (stock, the bill, the total) is asked for again in the browser, and the API has the last word at checkout.

## The caches

| Cache | Lives in | Holds | For how long |
| --- | --- | --- | --- |
| Data cache of Next.js | The shop's server | Answers of the API to `fetch` calls made with `next.revalidate` | 300 s; 3600 s for the sitemap's calls |
| Page cache of Next.js | The shop's server | The pages built ahead and the pages kept after their first visit | Until the page's interval has passed (300 s) |
| React `cache` | One render | The result of a reader, shared by layout, metadata and page | One request |
| TanStack Query | The browser's memory | Every answer the browser reads | 30 s by default ([state management](state-management.md)) |

The shop uses the caching model of `fetch` options and route segment config; `cacheComponents` is not set in `next.config.ts`, and no `"use cache"`, `unstable_cache`, `revalidateTag` or `revalidatePath` is in the code. Time-based renewal is stale-while-revalidate: after the interval, the next request still receives the kept copy and starts the renewal behind it. Under `next dev` pages are rendered at every request.

## How the server reads the API

`serverApi` in `src/lib/api/server.ts` is the API client of the server: `createStoreApi` over a plain requester, with the address `env.apiInternalUrl`, no cookies, and a limit of ten seconds per call (`API_TIMEOUT_MS`). A call that takes longer fails like an API that is away (`NETWORK_ERROR`); the request itself is not aborted, so a late answer still fills the cache.

The same file holds the lifetimes and the tags:

| Name | `REVALIDATE` | `TAGS` | For |
| --- | --- | --- | --- |
| `catalogue` | 300 | `catalogue` | Products, categories, facets |
| `settings` | 300 | `settings` | Delivery fees, delivery estimate, return window, box rules |
| `legal` | 300 | `legal` | Legal texts |
| `content` | 300 | `content` | FAQ and blog |
| `reviews` | 300 | `reviews` | Published reviews |

Pages do not call `serverApi` themselves (two exceptions below); they call a reader of a feature. Readers are of two kinds: the frame's readers never take a page down and answer `null` or an empty list on failure; a page's content throws, so the error page with "try again" shows.

| Reader | File | Kept | Tag | When the API fails |
| --- | --- | --- | --- | --- |
| `getSettings` | `src/features/catalogue/data.ts` | 300 s | `settings` | `null` |
| `getCategories` | `src/features/catalogue/data.ts` | 300 s | `catalogue` | `[]` |
| `loadCategories` | `src/features/catalogue/data.ts` | 300 s | `catalogue` | Throws |
| `getCategory`, `getProduct` | `src/features/catalogue/data.ts` | 300 s | `catalogue` | `null` for "not found"; else throws |
| `listProducts`, `getProductFacets` | `src/features/catalogue/data.ts` | 300 s | `catalogue` | Throws; the rows of the home page, the cart page and the product page catch it and leave the row out |
| `getBanners` | `src/features/catalogue/data.ts` | Not kept (`cache: "no-store"`) | – | `[]` |
| `getFaqs` | `src/features/content/data.ts` | 300 s | `content` | Throws |
| `listBlogPosts` | `src/features/content/data.ts` | 300 s | `content` | Throws |
| `getBlogPost` | `src/features/content/data.ts` | 300 s | `content` | `null` for "not found"; else throws |
| `loadBlogCategories` | `src/features/content/data.ts` | 300 s | `content` | Throws |
| `getBlogCategories`, `getBlogTags` | `src/features/content/data.ts` | 300 s | `content` | `[]` |
| `getPublishedLegal` | `src/features/legal/data.ts` | 300 s | `legal` | `null` |
| `getLegalDocument` | `src/features/legal/data.ts` | 300 s | `legal` | `null` when no text is published; else throws |
| `getReviews` | `src/features/reviews/data.ts` | 300 s; 0 under `next dev` | `reviews` | Throws; the home page catches it and leaves the section out |
| `programOf` (the rules of the coins) | `src/app/[locale]/(shop)/how-it-works/page.tsx` | 300 s | none | `null` |
| The calls of the sitemap | `src/app/sitemap.ts` | 3600 s | `catalogue`, `content`, `legal`, `reviews` | The request fails (500), so a search engine keeps the file it read before |
| `loadText` (a legal file of `content/legal`) | `src/components/legal/static-legal-page.tsx` | – (a file, read once per render) | – | – |

Readers that several parts of one render ask for are wrapped in React's `cache`; `listProducts`, `getProductFacets`, `listBlogPosts` and `getReviews` are plain functions and rely on Next.js answering an identical `GET` once per render. An answer is kept per address, so each language, category, filter combination and page of a list is an entry of its own. Two requests that are written the same share one: the row of a category on the home page and the stand-in picture on the page of all categories both use `rowQuery` of `src/features/catalogue/home.ts`.

The tags are set for on-demand renewal; nothing calls it (see "Not built").

## How each page is rendered

Three things decide: a `revalidate` of 0 or reading `searchParams` makes a page render at every request; a page with a placeholder in its address is not built ahead; everything else is built once per language, because the root layout's `generateStaticParams` names `en` and `de` and `localeOf` sets the language for static rendering. A built page is renewed at the shortest interval of its own `revalidate` and of the `fetch` calls of its layouts and itself: 300 s for every page of the shop. Pages are named below by their internal names of `src/i18n/routing.ts`; both languages of a page behave alike.

| Page | In the file | Rendered | Reads on the server |
| --- | --- | --- | --- |
| Home `/` | `revalidate = 0` | At every request | Settings, categories, the featured or first products, one list per category, the newest reviews (each kept 300 s); the banners afresh |
| `/products`, `/category/[slug]` | Reads `searchParams` | At every request | The list and its facets for the state of the address (kept 300 s per state) |
| `/reviews` | Reads `searchParams` | At every request | One page of reviews |
| `/blog`, `/blog/category/[slug]`, `/blog/tag/[tag]` | Reads `searchParams` | At every request | Posts, categories, tags |
| `/products/[slug]` | `revalidate = 300`; `generateStaticParams` returns `[]` | At its first visit, then kept and renewed after 300 s | The product, the related row, the popular row, settings, categories |
| `/blog/[slug]` | `revalidate = 300`; `generateStaticParams` returns `[]` | At its first visit, then kept and renewed after 300 s | The post |
| `/categories`, `/faq`, `/delivery-and-payment` | `revalidate = 300` | Built per language, renewed after 300 s | Categories and first products; the FAQ; the settings |
| `/legal/terms`, `/legal/privacy`, `/legal/imprint`, `/legal/withdrawal`, `/legal/shipping`, `/legal/refund-policy` | `revalidate = 300` | Built per language, renewed after 300 s | The published text, or the shop's file for the imprint and the withdrawal |
| `/how-it-works`, `/legal/cookies` | – | Built per language, renewed after 300 s | The rules of the coins; a file |
| `/cart` | – | Built per language, renewed after 300 s | Settings and the popular row; the cart itself is the browser's |
| `/checkout` | – | Built per language, renewed after 300 s | Settings (the delivery estimate, whether delivery is by the box) |
| `/wishlist`, `/forgot-password`, `/account`, `/account/orders`, `/account/invoices`, `/account/addresses`, `/account/profile`, `/account/referrals`, `/account/reviews`, `/account/coins`, `/account/reports` | – | Built per language: the frame and an empty shell | Nothing of their own |
| `/sign-in`, `/sign-up`, `/reset-password` | Reads `searchParams` | At every request | Nothing of their own |
| `/account/orders/[orderNumber]`, `/guest/orders/[orderNumber]` | Reads `searchParams` | At every request | Settings (the delivery estimate) |
| `/account/orders/[orderNumber]/return`, `/account/orders/[orderNumber]/report`, `/account/reports/[issueNumber]`, `/unsubscribe/[token]` | – (a placeholder without `generateStaticParams`) | When asked for | Nothing of their own |
| `/styleguide` | – | Built per language, renewed after 300 s | A list of products for the sample cards |

Every page inside the shop frame also carries what `src/app/[locale]/(shop)/layout.tsx` reads: categories, settings and the published legal pages. Addresses and files are in [routing](routing.md).

The home page is rendered at every request on purpose: a page kept on top of kept data showed a price change later than the category pages did; rendered each time, both lag by the same 300 s at most ([decision log](../decisions/decision-log.md), "Home page, second look").

| File | `dynamic` | Behaviour |
| --- | --- | --- |
| `src/app/api/health/route.ts` | `force-dynamic` | Answered at every request with `Cache-Control: no-store` |
| `src/app/sitemap.ts` | `force-dynamic` | Written at every request from answers kept for an hour: a renewal pages through the whole catalogue in both languages, and a crawler that asks often costs the API no call |
| `src/app/robots.ts`, `src/app/manifest.ts` | – | Written at build time |

### Building without the API

`next build` must not depend on the API. The frame's readers answer `null` or `[]`, so a page is built with an empty frame and renewed later. A content reader that fails calls `leaveToFirstVisitWhileBuilding` of `src/lib/api/server.ts` before it throws: during the build it awaits `connection()`, which leaves the page out of the build to be rendered at its first visit; on a running shop it does nothing and the error reaches the error page. `loadCategories`, `getFaqs`, `getBlogPost`, `loadBlogCategories` and `getLegalDocument` do this.

## What the browser renders, and why

The session lives in httpOnly cookies of the API, and the refresh cookie travels to the API's auth routes only: the shop's server could never renew a session. `serverApi` therefore sends no cookies, and nothing that belongs to a customer is rendered on the server: the browser asks the API directly through `api` of `src/lib/api/browser.ts` ([authentication and security](authentication-and-security.md)).

| What | Where | Reads |
| --- | --- | --- |
| Who is signed in | `useSession` in `src/features/session/session.ts` | `GET /v1/store/me`, only when this browser signed in before or the page needs an account |
| The quantities on every card, the cart badge | `useCart` in `src/features/cart/cart.tsx` | The browser's storage for a visitor, the API for a customer |
| The bill of the cart | `useBill` in `src/features/cart/use-bill.ts` | Always the API |
| Hearts, the wishlist count and page | `src/features/wishlist/wishlist.tsx` | The browser's storage and the API |
| The checkout | `src/components/checkout/checkout-view.tsx` | The bill, the addresses and the legal versions, asked for again when the page opens |
| The account and the guest order | `src/components/account` | Everything, with the session or the order's token |
| The unsubscribe page | `src/components/public/unsubscribe-view.tsx` | One call with the token of the address |
| Suggestions of the search | `src/components/shell/search-form.tsx` | Products and brands as the visitor types |
| The further cards of a home page row | `src/components/home/category-row.tsx` | The next page of the row's query, as the visitor nears its end |
| Stock and pictures of a product page | `PackSizes` in `src/components/catalogue/product-purchase.tsx` | The product once more, when the page opens |

The server's HTML has no cart, no wishlist and no session in it. The providers read storage through `useSyncExternalStore` with an empty server snapshot, so the first paint in the browser matches the server's; `ready` of the cart and the wishlist turns true once storage and, for a customer, the API were read.

A change of filters, sorting or page on a list is not a call from the browser: `ListingControls` in `src/components/catalogue/filters/listing-controls.tsx` changes the address with `router.replace`, and the server renders the list again.

## Loading states

`src/app` has no `loading.tsx`. A page from the server arrives whole; while the next one is on its way, `NavigationProgress` draws a thin line at the top of the window.

| Where | What shows while waiting |
| --- | --- |
| A link to another page | The line of `src/components/shell/navigation-progress.tsx`, after a short delay |
| A change of filters on a list | The choice at once (`useTransition` with the state just chosen), the list dimmed until the next one arrives |
| Cart page, checkout, wishlist page | `Skeleton` blocks of `src/components/ui/skeleton.tsx` in the shape of the page |
| Account pages, the guest order | `Skeleton` blocks; the account shows them until the API said who is here |
| A row of the home page | Four grey cards at the end of the row while its next page loads |
| Cart badge, wishlist count | No number until `ready`; a card shows its basket button until the quantities are read |

`Suspense` appears twice, both with an empty fallback and for one reason, `useSearchParams` in a page that is built ahead: around `NavigationProgress` and `ReferralCapture` in `src/app/[locale]/layout.tsx`, and around `IssueView` in `src/app/[locale]/(shop)/account/reports/[issueNumber]/page.tsx`. The states of each feature (empty, error, try again) are in its feature document.

## Stock and prices on a kept page

The API decides prices and stock ([prices and availability](../business-logic/prices-and-availability.md)); a kept page shows what the API said up to 300 s before the page was rendered. What the shop does about it:

| Place | Price | Whether it can be ordered |
| --- | --- | --- |
| A card on a list or a row from the server | From the server's answer; not asked for again | From the server's answer; not asked for again. A card can be a few minutes behind |
| The further cards of a home page row | The API's at the moment the browser asked | The same |
| The search dropdown | The API's, kept 60 s in the browser (300 s for the suggestions of an empty field) | – |
| The product page | Those of the kept page | Asked for again when the page opens: the `ordering` of every pack size and the pictures come from that answer (query `product-ordering`, kept 30 s) |
| The cart | Always the API's bill | The bill names the lines that cannot be ordered |
| The checkout | The bill asked for again when the page opens; the order is sent with the total the customer sees | The API refuses an order whose total, lines or legal versions changed, and the page says which ([checkout](../features/checkout.md)) |

Nothing is reserved before a payment, so the checkout and the payment tell the truth in the end ([cart and bill](../business-logic/cart-and-bill.md)).

## Not built

| Missing | Meaning |
| --- | --- |
| On-demand renewal | The tags of `TAGS` are on every kept answer, but the shop has no route that calls `revalidateTag`, and the API does not notify the shop. A change in the admin panel shows after the interval ([decision log](../decisions/decision-log.md), "Open items") |
| `loading.tsx` and streaming | No page streams parts of itself; client components show their own skeletons |
| Cache Components | `"use cache"`, `cacheLife` and `cacheTag` are not used |

How the hosts and the browser cache files (the `Cache-Control` of `/brand`, pictures of the API's CDN) is in [performance](performance.md).
