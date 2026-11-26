# Performance

What the shop does to be fast, each with the file that does it. The pattern is the same throughout: public pages are rendered on the server from answers of the API that are kept for minutes; only the parts that react to a customer run in the browser; pictures come ready-made from the API's CDN in three widths; and nothing is fetched for a page nobody opens. How long which answer is kept is in [rendering-and-caching.md](rendering-and-caching.md) and is not repeated here.

## Pictures

The image optimiser of Next.js is not used: `next/image` appears nowhere, and `next.config.ts` has no `images` key and no remote pattern. The API's CDN delivers every picture as three WebP files (320, 800 and 1600 px wide at most) with their dimensions, their content never changes, and a plain `<img>` behaves the same on both hosts.

| Measure | Detail | Source |
| --- | --- | --- |
| `srcset` of the three files | The addresses are used exactly as the API gives them; the browser picks one | `srcSetOf` in `src/lib/catalogue/pictures.ts`; `src/components/catalogue/product-image.tsx` |
| `sizes` names the real width | The page stops growing at 84 rem, so the value ends in a fixed pixel width (a card `228px` or `268px`, the product page's picture `566px`): on a wide screen a `vw` value would ask for the next larger file | `imageSizes` of `src/components/catalogue/product-card.tsx`; `GALLERY_SIZES` in `src/components/catalogue/product-gallery.tsx` |
| `width` and `height` on every picture | The place is kept before the file arrives; nothing shifts | The same files |
| `loading="lazy"` and `decoding="async"` by default | A picture below the fold is fetched when it comes near | `ProductImage` |
| The first pictures at once | `priority` loads eagerly with `fetchPriority="high"`: the first four cards of a list or of the wishlist, the first three posts of the blog, the first picture of the product gallery, the featured picture of an article | `src/components/catalogue/product-grid.tsx`, `src/components/blog/blog-listing.tsx`, `src/components/blog/post-image.tsx` |
| At once, but not first | `priority="eager"` loads eagerly without the high priority: the first four cards of "Popular right now" on the home page, where the banner heads the page | `src/app/[locale]/(shop)/page.tsx` |
| The first banner | Eager and `fetchPriority="high"`; the other slides are lazy. The slide keeps the ratio of its picture | `src/components/home/hero-carousel.tsx` |
| The pictures of the other pack sizes | Fetched once the page has loaded and the browser is idle, at low priority, with the `srcset` and `sizes` of the gallery, so a change of size shows its picture at once. Not on a connection that asks to save data or reports 2G | `usePicturesAhead` in `src/components/catalogue/product-gallery.tsx` |
| A picture whose file is gone | The Radhe mark stands in, instead of a second request or a broken picture | `ProductImage`, `isBroken` |
| The logo and the icons | Small files in the sizes they are shown at (160, 240 and 480 px), with a `srcset` | `src/components/shell/logo.tsx`; the files of `public/brand` |
| The files of `public/brand` in the browser's cache | `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` | `headers` in `next.config.ts` |

## The font

`src/app/fonts.ts` loads Inter with `next/font/google`. The family is downloaded when the shop is built and served from the shop's own address, so no request goes to Google when a customer visits.

| Setting | Effect |
| --- | --- |
| One family for everything | Body text, controls, headlines and prices |
| A variable font with the axis `opsz` | Every weight comes from one file |
| `subsets: ["latin"]` | The file that is loaded ahead covers English and German; the extended Latin files stay in the style sheet and are fetched only when a page shows such a letter |
| `display: "swap"` | Text is shown at once in the fallback font |
| `variable: "--font-inter"` | Set on `<html>`; the design tokens of `src/app/globals.css` use it |

## Server components and small client islands

Pages, layouts and most components are server components: their code and their texts never reach the browser. A client component is the smallest part that needs the browser.

| Server component | Its client islands |
| --- | --- |
| The product card (`src/components/catalogue/product-card.tsx`) | The link (`IntentLink`), the picture (for the fallback of a broken file), the heart, the add-to-cart control |
| The header (`src/components/shell/header.tsx`) | Search, category navigation, account, wishlist and cart icons, the language switch, the menu button |
| The product page | `PackSizes` and the parts that follow the chosen pack size |
| A list of products (`src/components/catalogue/product-listing.tsx`) | The controls of the filters |
| A row of the home page | The row's scrolling; `CategoryRow` fetches further pages only as the visitor turns towards its end (`src/components/home/category-row.tsx`) |

| Measure | Detail | Source |
| --- | --- | --- |
| Texts by area | Only the namespaces a client component of the area uses are sent with a page | `src/i18n/client-messages.ts`; [internationalization.md](internationalization.md) |
| No validation library on the sign-in pages | The pattern of an email address is written out: importing zod for one pattern costs 90 KB (gzip) on each of those pages. A test holds the pattern against zod's | `src/features/auth/validation.ts` |
| A phone number without zod | `normalizePhone` lives in a module of its own | `src/lib/format/phone.ts` |
| Formatters are built once | `Intl.NumberFormat` per language is kept; the time-zone formatter is built when first needed, not while a page starts | `src/lib/format/money.ts`, `src/lib/format/weight.ts`, `src/lib/format/dates.ts` |

## Code loaded on demand

| What | How | Source |
| --- | --- | --- |
| The panel of the phone menu, with the dialog code behind it | A dynamic `import()` when the menu button is first touched, focused or pointed at; the tap that follows usually finds it ready. A failed download is tried again with the next tap | `src/components/shell/mobile-menu.tsx`, `src/components/shell/mobile-menu-panel.tsx` |
| The panel a product card opens for a visitor who taps "Notify me", with its form and the dialog code | The same way, when a bell is first touched, focused or pointed at. A card carries the bell alone; a signed-in customer asks with the tap and never fetches the panel | `src/components/catalogue/notify-me.tsx`, `src/components/catalogue/notify-me-sheet.tsx` |

These are the only splits made by hand. `next/dynamic` and `React.lazy` are not used; beyond this, Next.js splits the code by route.

## Prefetching

| Link | Behaviour | Source |
| --- | --- | --- |
| Product cards and category cards | `IntentLink`: prefetched when the visitor points at, touches or focuses the link, not when it scrolls into view. A list has twenty and more cards, and each prefetch would render a full page on the server with its own calls to the API | `src/components/catalogue/intent-link.tsx` |
| The pack sizes of a product page | `prefetch={false}`: a click switches the size in place | `PackSizePicker` in `src/components/catalogue/product-purchase.tsx` |
| Every other link | The default of Next.js | `Link` of `src/i18n/navigation.ts` |
| The connection to the API | Opened by the root layout with the credentials mode of the calls that follow (`preconnect`, `crossOrigin: "use-credentials"`), so "who is here" and the cart find it open | `src/app/[locale]/layout.tsx` |

`NavigationProgress` (`src/components/shell/navigation-progress.tsx`) draws a thin line at the top while the next page is on its way. It waits a moment before it appears, so a quick page change shows nothing.

## Fewer requests

| Measure | Detail | Source |
| --- | --- | --- |
| Cached answers, shared within a request | [rendering-and-caching.md](rendering-and-caching.md) | `src/lib/api/server.ts`, `src/features/catalogue/data.ts` |
| A time limit for the server's calls | Ten seconds, as a race and not an abort: a signal would switch off the request de-duplication of React and Next.js, and a late answer still fills the cache | `API_TIMEOUT_MS` in `src/lib/api/server.ts`; `within` in `src/lib/api/http.ts` |
| No "who is here" for a visitor | Without the sign-in hint the browser does not ask `GET /v1/store/me` | `src/features/session/session.ts` |
| The cart with the session | A browser that signed in before asks for the cart together with the session, not one round trip later; calls that find the access cookie lapsed share one refresh | `src/features/cart/cart.tsx`, `src/lib/api/session-transport.ts` |
| Quick taps as one request | Plus and minus are collected for 300 ms per pack size | `DEBOUNCE_MS` in `src/features/cart/cart.tsx` |
| The search waits for a pause | 250 ms without typing before the API is asked; an answer is fresh for a minute, the suggestions of the empty field for five | `src/components/shell/search-form.tsx` |
| Defaults of the browser's cache | An answer is fresh for 30 seconds; a failed query is asked again twice at most, and only when asking again can help | `createQueryClient` in `src/features/providers.tsx` |

## Fewer renders

| Measure | Detail | Source |
| --- | --- | --- |
| The add-to-cart control | The cart tells every control on the page about every change, and a page of products has seventy and more of them. `AddToCart` reads the one quantity that is its own and hands it to `AddToCartControl`, wrapped in `memo`, which renders again only when that number changed | `src/components/catalogue/add-to-cart.tsx` |
| The heart of the wishlist | The same pattern: `WishlistButton` reads its one answer, `WishlistHeart` is the `memo` component | `src/components/catalogue/wishlist-button.tsx` |
| The visitor's cart as a stable snapshot | The same stored text gives the same array, so React sees no change | `readGuestSnapshot` in `src/features/cart/cart.tsx` |
| Filters as a transition | Changing a filter navigates inside `useTransition`: the list of before stays until the next one is there | `src/components/catalogue/filters/listing-controls.tsx` |

## First paint

| Measure | Detail | Source |
| --- | --- | --- |
| The cookie notice is part of the server's page | A first visit paints it with everything else; for a returning visitor an inline script marks `<html>` before the first paint and a style rule hides it, so nothing appears and disappears | `src/components/shell/cookie-notice.tsx`, `src/app/globals.css` |
| No state of a customer in the server's page | The session, the cart and the wishlist read as "guest" and "empty" during hydration (`useSyncExternalStore` with a server snapshot), so a prerendered page fits every visitor | `src/features/session/session.ts`, `src/features/cart/cart.tsx`, `src/features/wishlist/wishlist.tsx` |
| The frame never waits for the API beyond its limit | Settings and categories answer `null` or an empty list on failure; the page still renders | `getSettings` and `getCategories` in `src/features/catalogue/data.ts` |

## The health route and the smoke script

| Tool | What it does | Source |
| --- | --- | --- |
| `GET /api/health` | Answers `{ "status": "ok" }` as soon as the server runs. It asks the API for nothing and renders no page, and is never cached (`force-dynamic`, `Cache-Control: no-store`). It is the address for an uptime monitor, for the timer that keeps the process awake on a host that stops idle apps, and for the check after a deployment | `src/app/api/health/route.ts` |
| `npm run smoke` | Starts the built shop and the mock API on ports of their own and asks for thirteen things, among them: a built style sheet is served as `immutable`, a file of `public` is served, a product page is rendered once and then kept (`x-nextjs-cache` `HIT` or `STALE`, `s-maxage=300`), the security headers are sent, the bare domain redirects | `scripts/smoke.mjs` |

## Build settings

| Setting | Detail | Source |
| --- | --- | --- |
| Two bundlers | `npm run build` is `next build` (Turbopack) and is what Vercel runs; `npm run build:webpack` is `next build --webpack` and is the build script of Hostinger, whose build servers need webpack. The build check builds both, so a difference shows before a deployment | `package.json`, `.github/workflows/ci.yml` |
| The standalone server | `NEXT_OUTPUT=standalone` builds the server that runs without `node_modules`. Hostinger sets that output itself; the variable is for building the same thing elsewhere | `output` in `next.config.ts` |
| Four build processes at most | `experimental.cpus` is `buildWorkers()`: one fewer than the processors, capped at four. On a shared build server with 56 processors the default asked for more threads than the account may start. `NEXT_BUILD_WORKERS` sets another number | `next.config.ts` |
| The build does not need the API | A page that cannot load its content while building is left to its first visit (`leaveToFirstVisitWhileBuilding`); no product page and no article is built ahead (`generateStaticParams` answers an empty list) | `src/lib/api/server.ts`, `src/app/[locale]/(shop)/products/[slug]/page.tsx`, `src/app/[locale]/(shop)/blog/[slug]/page.tsx` |
| The legal files travel with the server | `outputFileTracingIncludes` names the files of `content/legal` | `next.config.ts` |

The hosts and their settings are in [deployment](../deployment/README.md); every variable is in [configuration.md](configuration.md).

## Not done

| What a reader might expect | State |
| --- | --- |
| The image optimiser of Next.js, or a loader | Not used; the files of the CDN are final |
| A cache handler, or a cache shared between servers | None: one process with a disk |
| On-demand revalidation | The tags exist (`TAGS` in `src/lib/api/server.ts`); no route calls them |
| Measurement in the field (analytics, Web Vitals reporting) | None: the shop loads no script of a third party |
