# Error pages

What a visitor sees when something is wrong: an address that does not exist, a page that could not be loaded, an API that does not answer, and the moments in between while a page is on its way. It also covers the health route, the address that says whether the server of the shop runs.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | 2026-10; the health route since 2026-11-21 |
| **Pages** | Every address without a page (`/en/…` · `/de/…`); `/api/health` |
| **Code** | `src/app/[locale]/(shop)/[...rest]/page.tsx`, `src/app/[locale]/(shop)/not-found.tsx`, the three `error.tsx` files, `src/app/global-error.tsx`, `src/components/shell/page-error.tsx`, `src/components/shell/navigation-progress.tsx`, `src/components/ui/skeleton.tsx`, `src/app/api/health/route.ts` |
| **API** | None of its own; see [Error handling](../api/error-handling.md) |
| **State** | None |
| **Texts** | `notFound`; `common.errorTitle`, `common.errorText`, `common.retry`; `errors.reference`. The last-resort page carries its own two languages in the code |
| **Tests** | `e2e/catalogue.spec.ts` (404 in the language of the address), `e2e/public.spec.ts` (404 for drafts and unpublished legal pages), `scripts/smoke.mjs` (the health route). No test opens an `error.tsx` or the last-resort page |
| **Backend reference** | – |

## What the customer sees

### An address that does not exist

| Region | Content |
| --- | --- |
| The frame | The header and the footer of the shop, as on every page |
| A small pill | "404" |
| Heading | "Page not found" · "Seite nicht gefunden" |
| Text | "This page does not exist or has moved." |
| Button | "Back to the shop", to the home page of the language |

The answer has status 404. The page is `src/app/[locale]/(shop)/not-found.tsx`; its texts are the `notFound` namespace, so it speaks the language of the address.

| Case | How it gets there |
| --- | --- |
| An unknown address under a language (`/de/gibt-es-nicht`) | The catch-all `src/app/[locale]/(shop)/[...rest]/page.tsx` matches whatever no page answers and calls `notFound()` |
| An unknown address without a language (`/nothing-here`) | The proxy first sends it to the visitor's language (`/en/nothing-here`); then as above |
| A page that knows its content does not exist | It calls `notFound()` itself: an unknown product or category, a blog post that is a draft, a page number beyond the last, a legal page without a published text. Each feature document names its cases |
| A first segment that is not a language and that the proxy leaves alone (an address with a file extension, such as `/missing.png`) | `localeOf` in `src/i18n/locale.ts` calls `notFound()` in the outermost layout. No `not-found.tsx` stands above the `(shop)` group, so the plain 404 of Next.js answers, without the frame of the shop |

The checkout frame and the frame of the unsubscribe page have no "not found" page of their own: every unknown address under a language falls to the catch-all of the shop.

### A page that could not be loaded

Each of the three frames has an `error.tsx`, and all three are the same component, `PageError` in `src/components/shell/page-error.tsx`:

| File | Frame around the message |
| --- | --- |
| `src/app/[locale]/(shop)/error.tsx` | Header and footer of the shop |
| `src/app/[locale]/(checkout)/error.tsx` | The pill header of the checkout |
| `src/app/[locale]/(plain)/error.tsx` | The logo header of the unsubscribe page |

| Region | Content |
| --- | --- |
| Heading | "That did not work" |
| Text | "We could not load this page. Please try again in a moment." |
| Button | "Try again": renders the page again (`reset`) without leaving the address |
| Reference | "Reference for our support: {digest}", when Next.js gives the failure a digest; the same value is in the log of the server |

The page offers no other way on; the header around it still does. It shows no contact address (see [Help and support](help-and-support.md)).

### The frame itself fails

`src/app/global-error.tsx` is the last resort, for a failure of the outermost layout, where no translation and no style sheet can be relied on. It is a plain white page with inline styles: "Radhe Foods", the sentence "The shop could not be loaded. Please try again in a moment." in English and in German, one button "Try again / Erneut versuchen", and "Reference / Referenz: {digest}" when there is one. It is marked `noindex`. The data of the frame (categories, settings, published legal pages) never throws, so this page is for faults of the code or the server, not for an API that is away.

## Rules

### When the API is away

The server of the shop waits 10 seconds for an answer of the API (`API_TIMEOUT_MS` in `src/lib/api/server.ts`); after that a call counts as failed. What follows depends on what was asked for:

| Reader | On failure | Result for the visitor |
| --- | --- | --- |
| The frame of the shop: categories (`getCategories`) | An empty list | The header without the category bar, the footer's shop column with "All products" only |
| The frame: settings (`getSettings`) | `null` | No free-delivery line in the header; "Delivery and payment" shows its fallback sentences |
| The frame: published legal pages (`getPublishedLegal`) | `null` | The footer links terms, withdrawal, privacy, cookies and imprint |
| The chips of the blog (`getBlogCategories`, `getBlogTags`) | Empty lists | The blog without those rows |
| The coins programme on "How it works" | `null` | The page without the coins section |
| The content of a page: a product list, a product, a category, the FAQ, the blog list, a post, a legal text | The call throws | "That did not work" with "Try again", inside the frame |
| The sitemap | The request fails | An error for the crawler, which keeps the sitemap it read before |
| The cookie page, and the imprint or withdrawal from a file | Not asked of the API (the two from files only after the API said "not published") | The cookie page always shows |

The rule behind the table: the frame of a page must never take the page down, its content may. How long the server reuses an answer of the API is in [rendering and caching](../architecture/rendering-and-caching.md).

Everything that belongs to one visitor (the cart, the checkout, the account, the wishlist) is read in the browser. A failure there never reaches an `error.tsx`: the part that failed shows the sentence of the error code in place, with "Try again" where a retry makes sense and the reference of the request for an unexpected error (`ErrorAlert` in `src/components/ui/error-alert.tsx`). A change of the cart or the wishlist that failed is said in a message at the top of the window (`CartProblem`, `WishlistProblem`). The codes and their sentences are in [Error handling](../api/error-handling.md).

### While the build runs

A page built ahead of time that cannot load its content does not stop the build: `leaveToFirstVisitWhileBuilding` leaves it out, and it is rendered at its first visit. On a running shop the same failure goes to the error page.

## Loading

No route has a `loading.tsx`. Pages rendered by the server arrive complete, so two things fill the wait:

| Part | What it does |
| --- | --- |
| The line at the top (`NavigationProgress` in `src/components/shell/navigation-progress.tsx`) | A 3 px leaf-green line across the top of the window while the next page is on its way. It starts with a plain click on a link of the shop that leads to another path or query, appears after 150 ms (a quick change shows nothing), grows towards 92 % of the width over 8 seconds, and goes when the address has changed, or after 10 seconds at the latest. A click that opens a new tab, a download, a link to another site and a link to the address already shown do not start it. A change of page made by code (after a form, for example) does not start it either |
| Skeletons (`Skeleton` in `src/components/ui/skeleton.tsx`) | Soft grey blocks that shimmer, in the place of content the browser is still reading: the cart, the checkout, the wishlist, the account and its pages, the page of a guest order, and the cards of a home page row while its next page loads. They are hidden from screen readers |

The line is hidden from screen readers too. For visitors who asked for less motion the shimmer and the growth of the line are cut short by the global rule in `src/app/globals.css`; see [Motion](../design-system/motion.md).

## The health route

`GET /api/health` (`src/app/api/health/route.ts`) answers as soon as the server of the shop runs:

```
200
Cache-Control: no-store
X-Robots-Tag: noindex

{ "status": "ok" }
```

| Point | Behaviour |
| --- | --- |
| What it checks | That the process answers. It asks the API for nothing and renders no page, so it says "ok" while the API is away |
| Caching | Answered at every request (`force-dynamic`, `no-store`): a kept copy would say "ok" for a server that is down |
| The proxy | Leaves `/api` alone: the route has no language |
| Who asks | An uptime monitor, the timer that keeps the process awake on a host that stops idle apps, the check after a deployment, and `scripts/smoke.mjs`, which waits for it before its other checks. See [Deployment](../deployment/README.md) |

## Not built

- A "not found" page with a search field or suggested products: it offers the way home only.
- A support address, a phone number or a link to report the problem on any error page.
- A maintenance page or a banner that says the API is away: each page degrades as the table above says.
- Error reporting to an outside service: a failure is in the log of the server under its digest and nowhere else.
- A `loading.tsx` or a skeleton for a page the server renders.
- A health check that includes the API: the API has its own (`GET /health`, section 5 of [reference/backend/store-api.md](../reference/backend/store-api.md)), which the shop does not call.
- An offline page: the shop registers no service worker.

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(shop)/[...rest]/page.tsx` | The catch-all: calls `notFound()` for every address no page answers |
| `src/app/[locale]/(shop)/not-found.tsx` | The "not found" page in the frame of the shop |
| `src/app/[locale]/(shop)/error.tsx`, `src/app/[locale]/(checkout)/error.tsx`, `src/app/[locale]/(plain)/error.tsx` | The error page of each frame; each exports `PageError` |
| `src/components/shell/page-error.tsx` | The message, "Try again" and the reference |
| `src/app/global-error.tsx` | The last resort when the outermost layout fails |
| `src/components/shell/navigation-progress.tsx` | The line at the top while the next page loads |
| `src/components/ui/skeleton.tsx` | The shimmering stand-in for content on its way |
| `src/components/ui/error-alert.tsx` | An error of the API shown in place, in the browser |
| `src/lib/api/server.ts` | The time limit of the server's calls, `leaveToFirstVisitWhileBuilding` |
| `src/app/api/health/route.ts` | `GET /api/health` |
