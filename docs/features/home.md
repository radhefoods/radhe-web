# Home page

The first page of the shop for every visitor: the banners of the admin (or, while none is live, the promise of the shop), the categories, the popular products, one row of products per category and what customers say. Every product, price and picture on it comes from the API; the page arranges them.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | Phase 2 of the original plan, before 2026-10-11 (the log gives no day); in this make-up since 2026-11-02 |
| **Pages** | `/en` · `/de` |
| **Code** | `src/app/[locale]/(shop)/page.tsx`, `src/components/home`, `src/features/catalogue/home.ts`, `src/features/catalogue/categories.ts` |
| **API** | [Catalogue](../api/endpoints.md#catalogue), [Banners](../api/endpoints.md#banners), [Settings](../api/endpoints.md#settings-and-legal-texts), [Order reviews](../api/endpoints.md#order-reviews) |
| **State** | None of its own: the API, read on the server; the further cards of a row are kept in the row's component |
| **Texts** | `home`, `reviews`, `product`, `site` |
| **Tests** | `e2e/catalogue.spec.ts` ("the shop at a glance"), `src/features/catalogue/home.test.ts`, `src/features/catalogue/categories.test.ts`, `src/features/catalogue/delivery-promise.test.ts`, `src/lib/navigation/shop-link.test.ts` |
| **Backend reference** | [store-api.md](../reference/backend/store-api.md) (sections 7 and 17), [banners.md](../reference/backend/banners.md), [product-display-order.md](../reference/backend/product-display-order.md) |

## What the customer sees

The regions in reading order. A region without data is left out; the page never shows an empty heading.

| # | Region | Component | Data | Shown when |
| --- | --- | --- | --- | --- |
| 1 | Banner carousel | `HeroCarousel` in `src/components/home/hero-carousel.tsx` | `GET /v1/store/banners` | At least one banner is live |
| 1 | Hero band with the ticket | The page itself and `DeliveryPromiseCard` in `src/components/home/delivery-promise-card.tsx` | `GET /v1/store/settings` | No banner is live, or the banners could not be read |
| 2 | "Popular categories" | `CategoryTiles` in `src/components/catalogue/category-tiles.tsx` | `GET /v1/store/categories` | A parent category holds a product |
| 3 | "Popular right now" | `ProductRow` in `src/components/home/product-row.tsx` | `GET /v1/store/products` | The API answers a product |
| 4 | One row per category | `CategoryRow` in `src/components/home/category-row.tsx` | `GET /v1/store/products` per category | The category's first page holds a card |
| 5 | "What our customers say" | `CustomerReviews` in `src/components/home/customer-reviews.tsx` | `GET /v1/store/reviews` | A review is published |

The frame around the page (promise strip, header, footer, tab bar) is described in [Header, navigation and footer](header-navigation-footer.md). The home page has no trust items of its own: the three promises stand in the strip above the header.

### 1. The hero

**With banners.** One slide per live banner in the admin's order, each picture in a box of its own ratio and never cropped. On phones the carousel runs edge to edge; from `sm` it is a rounded tile inside the page. The page's `h1` is the text `home.metaTitle` ("Indian groceries, delivered across Germany"), for screen readers only. Dots on a dark glass pill over the foot of the picture turn the slides; a single banner shows no dots.

**Without banners.** The dark woven band (`hero-band` in `src/app/globals.css`): the eyebrow "Straight from India", the headline `home.title`, the lead `home.lead`, the buttons "Shop now" (to `/en/products` · `/de/produkte`) and "How it works", and beside them the ticket:

| Part of the ticket | Text | Source | Left out when |
| --- | --- | --- | --- |
| Label | "In stock now" | Fixed | Never |
| Headline | "{estimate} to your door." | `delivery.estimate` of the settings, in the page's language | Without an estimate it reads "Delivered across Germany." |
| Tile "Delivery" | The fee | `deliveryFee.tiers[0].fee` | No tier |
| Tile "Free from" | The amount | `deliveryFee.freeFrom` | `null` |
| Tile "{days} to return" | The number of days | `returns.windowDays` | `0` or missing |
| Line "Per box of up to {weight}" | The weight of a box | `shipping.boxCapacity` while `shipping.boxBased` | Flat delivery fee, or both delivery tiles missing |
| Facts | "Payment: Card or PayPal, at checkout", "Delivery area: All of Germany" | Fixed | Never |
| Seal | "Secure checkout" | Fixed | Never |

With the mock API the ticket reads "2 to 4 working days to your door.", €4.99, €50.00 and 14.

### 2. Popular categories

The parent categories that hold at least one product (`shopCategories`), in the admin's order, as a row of `CategoryCard`: picture, name, tagline, "N products". "See all" leads to `/en/categories` · `/de/kategorien` ([Catalogue](catalogue.md)). A category without a picture shows the picture of the first product of its row (`standInPictures`); without either, the ghosted Radhe mark.

### 3. Popular right now

Up to eight [product cards](product-card.md), one card per product. "See all" leads to the list of all products. The first four pictures load at once.

### 4. One row per category

For every parent category with products, in the admin's order: the category's name as the heading, its tagline, "See all" to the category page, and a row of cards with one card per pack size "in rounds" (the smallest size of every product first). The server renders the first eight cards; the browser fetches the following pages as the visitor turns towards the end.

### 5. What our customers say

The heading row with the average as stars and as the text `reviews.summary` ("{average} of 5 from {count} orders") and the pill "All reviews" (to `/en/reviews` · `/de/bewertungen`), then the three newest published reviews as cards. The rules of a review are in [Reviews](reviews.md).

### States

| State | What shows |
| --- | --- |
| The catalogue does not answer | Hero only (carousel or band); no categories, no rows. No error page: every list of the home page is read with a fallback |
| The settings do not answer | The ticket with "Delivered across Germany." and without tiles |
| The banners do not answer | The hero band |
| Nothing is marked featured | "Popular right now" shows the first eight products of the whole catalogue |
| A row's next page is on its way | Four grey cards at the end of the row; the first announces "Loading more products" |
| A row's next page fails | Nothing; the next scroll or turn asks again |

## Rules

| Case | What happens | Decided by |
| --- | --- | --- |
| Which banners are live, their order, links and periods | Shown as answered | The API ([banners.md](../reference/backend/banners.md)) |
| A banner's link | `isExternal`: new tab with `rel="noopener noreferrer"`. A path of the shop: turned into a link in the page's language by `shopHref` in `src/lib/navigation/shop-link.ts`; an unknown path is used as it is and the proxy adds the language. No `linkUrl`: the picture is not a link | The browser |
| Which products are popular | The featured ones; while none is featured, the first of the catalogue (`popularProducts`) | The API marks, the shop picks the fallback |
| Which categories get a row, and their order | Parent categories with `productCount > 0`, in the API's order | The API; the filter is `shopCategories` |
| The cards of a row and their order | `view=variants_by_size`, eight per page | The API ([product-display-order.md](../reference/backend/product-display-order.md)) |
| A card arrives twice | Shown once: a `variantId` the row already shows is dropped (`moreRowCards`) | The browser |
| Prices, discounts, stock on the cards | Shown as answered | The API ([Prices and availability](../business-logic/prices-and-availability.md)) |

**Worked example, a banner link.** `linkUrl: "/categories/rice"` on the German page becomes the link `/de/kategorie/rice`; the category page then moves to its German slug. `"/products/basmati-rice-1kg"` becomes `/de/produkte/basmati-rice-1kg`. `"/some/other/path"` is not known by name and stays as it is.

**Worked example, a row that loads on.** A category has 60 cards, so its query has 8 pages. The server renders cards 1 to 8 and hands `pages = 8` and their ids to `CategoryRow`. When the visitor scrolls within one screen width of the end, the browser asks for page 2; `nextRowPage({ page: 2, totalPages: 8 })` is `3`, and after page 8 it is `null`: the forward arrow dims at the end. If page 2 answers the cards `h` and `i` while the row already shows `h` (the admin reordered meanwhile), `moreRowCards` adds `i` alone.

## Data and API

All calls are made on the server while the page renders, in two rounds.

```
round 1 (parallel)   settings · categories · featured products · banners · reviews
round 2 (parallel)   first products of the catalogue (only when nothing is featured)
                     one request per parent category with products
later, in the browser   page 2, 3, … of a row, on scroll or on the forward arrow
```

| Call | Query | Cached | On failure |
| --- | --- | --- | --- |
| `GET /v1/store/settings` | – | 300 s, tag `settings` | `null`: the ticket loses its numbers |
| `GET /v1/store/categories` | `locale` | 300 s, tag `catalogue` | Empty list: no categories, no rows |
| `GET /v1/store/products` | `featured=true&limit=8` (`featuredQuery`) | 300 s, tag `catalogue` | Empty: the fallback below |
| `GET /v1/store/products` | `limit=8` (`catalogueQuery`), only without featured products | 300 s | No "Popular right now" |
| `GET /v1/store/products` | `category=<slug>&view=variants_by_size&limit=8` (`rowQuery`) | 300 s | That row is left out |
| `GET /v1/store/banners` | `locale` | Never (`no-store`) | Empty: the hero band |
| `GET /v1/store/reviews` | `limit=3` | See [Reviews](reviews.md) | No reviews section |
| `GET /v1/store/products` from the browser | `rowQuery(category, page)` | Not by the shop; the API answers from its own cache | The page stays due |

The page itself is rendered at every visit (`revalidate = 0`) from these cached answers, so a price on it is as old as on a category page, five minutes at most. The page of all categories sends the same row request and shares its cache entry. More in [Rendering and caching](../architecture/rendering-and-caching.md).

The page carries two blocks of structured data, `Organization` and `WebSite` with the search address; see [SEO](../architecture/seo.md).

## Behaviour

**The carousel.**

| What | How |
| --- | --- |
| Autoplay | Every 6 s; the dot of the shown slide fills meanwhile |
| Autoplay waits | While the pointer rests on it, something in it has the focus, a drag is under way or the tab is hidden |
| Autoplay stops for good | After the visitor swiped or pressed a dot (a way to stop moving content, WCAG 2.2.2) |
| Reduced motion | No autoplay; every change jumps |
| Drag | The track follows the finger or the mouse; a drag of a fifth of the width or a quick flick turns the slide; a vertical movement scrolls the page instead; a drag never opens the banner's link |
| Loop | Seamless: after the last slide the first follows, and the other way round |
| Screen reader | A region named "Offers and news", each slide a group "Slide 1 of 3", the dots buttons "Go to slide 1"; slides that are not shown cannot be reached |
| Pictures | The first loads at once with high priority, the others lazily; the browser picks one of the API's three widths |

**The rows.** Two cards and a sliver on phones, three from `sm`, four from `lg`, five from `xl`. A row snaps card by card and bleeds into the page gutter. From `md` two round arrows ("Scroll back", "Scroll forward") move one screen; they are hidden while everything fits and no further page exists. A turn asked for at the end while a page loads goes on when the cards arrive.

## Not built

- An offers section, "How it works" steps or a newsletter band on the home page ("How it works" is a page of its own, see [Help and support](help-and-support.md)).
- Arrows or a pause button on the carousel: dots and swipe only.
- Personal recommendations or "recently viewed": "Popular right now" is the same for everyone.
- A popularity ranking of categories: the order is the admin's; the API knows none.

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(shop)/page.tsx` | The page: reads everything, decides hero and regions, metadata and structured data |
| `src/components/home/hero-carousel.tsx` | The banner carousel: track, drag, dots, autoplay |
| `src/components/home/delivery-promise-card.tsx` | The ticket of the hero band |
| `src/components/home/product-row.tsx` | `ProductRow` and `ProductRowItem`: the scrolling row with heading, link and arrows, shared with the product page and the cart |
| `src/components/home/category-row.tsx` | A row that fetches its further pages in the browser |
| `src/components/home/customer-reviews.tsx` | The reviews section; `HOME_REVIEWS` is 3 |
| `src/components/catalogue/category-tiles.tsx` | The row of category cards |
| `src/components/catalogue/category-card.tsx` | One category as a card |
| `src/features/catalogue/home.ts` | `ROW_SIZE`, the three queries, `nextRowPage`, `moreRowCards`, `popularProducts` |
| `src/features/catalogue/categories.ts` | `shopCategories`, `standInPictures` |
| `src/features/catalogue/delivery-promise.ts` | `deliveryPromiseOf`: free-delivery amount and box capacity from the settings |
| `src/features/catalogue/data.ts` | The server's readers of the catalogue, with their caching and fallbacks |
| `src/lib/navigation/shop-link.ts` | A banner's path as a link of the shop |
