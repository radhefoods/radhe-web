# Catalogue

The lists a visitor browses: all products, the page of a category, and the page of all categories. Each list has filters, a sorting and pages, and its whole state is in the address, so every view can be linked, shared and reached with the back button. The cards are described in [Product card](product-card.md), the search in [Search](search.md).

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | Phase 2 of the original plan, before 2026-10-11 (the log gives no day); the filter panel 2026-10-15, the views 2026-10-24, the page of all categories 2026-10-25 |
| **Pages** | `/en/products` · `/de/produkte`, `/en/category/[slug]` · `/de/kategorie/[slug]`, `/en/categories` · `/de/kategorien` |
| **Code** | `src/app/[locale]/(shop)/products/page.tsx`, `src/app/[locale]/(shop)/category`, `src/app/[locale]/(shop)/categories`, `src/components/catalogue`, `src/features/catalogue` |
| **API** | [Catalogue](../api/endpoints.md#catalogue) |
| **State** | The address bar; nothing is stored |
| **Texts** | `catalogue`, `filters`, `product`, `nav` |
| **Tests** | `e2e/catalogue.spec.ts` ("finding products"), `src/features/catalogue/listing-state.test.ts`, `src/features/catalogue/facets.test.ts`, `src/features/catalogue/categories.test.ts` |
| **Backend reference** | [store-api.md](../reference/backend/store-api.md) (section 7), [product-display-order.md](../reference/backend/product-display-order.md) |

## What the customer sees

### All products

The heading "All products", the line "Everything Radhe Foods has in stock, straight from India.", then the list (`ProductListing` in `src/components/catalogue/product-listing.tsx`).

### A category page

Breadcrumbs ("Home", the categories above, the category itself, not a link), the category's name as the heading, its description (or, without one, its tagline), its sub-categories as chips with their product counts, then the list. The list holds the products of the category and of its sub-categories.

### The list

| Region | Content |
| --- | --- |
| Controls | Wide screens: one pill per filter, the two switches, "N products" and the sorting at the right. Phones: the buttons "Filters" (with the number of applied values) and "Sort", and "N products" |
| Applied filters | One wheat chip per applied value, each a link that takes that value off, and "Clear all filters" |
| Grid | Two cards in a row on phones, three from `md`, four from `lg`, five from `xl`; the first four pictures load at once |
| Pages | Round numbers with an arrow at either end, only when there is more than one page |

### The page of all categories

The heading "All categories" and every parent category that holds a product, in the admin's order, as a grid of cards (two, three from `sm`, four from `lg`): picture, name, tagline, "N products". Under each card its sub-categories with products as chips. A category without a picture shows the picture of the first product of its home-page row, else the Radhe mark.

### States

| State | What shows |
| --- | --- |
| A change is on its way | The chosen value shows at once; the grid dims to 60 % and is marked busy |
| The list is empty without filters | "Nothing found" with "This category has no products yet." (a category) or the search's text, and the button "Show all products"; on "All products" itself the text `catalogue.emptyText` without a button |
| The filters leave nothing | "No products match", "Try removing a filter, or clear them all.", the button "Remove “{name}” to see N products" for the one filter whose removal brings back the most, and "Clear all filters" |
| A page number beyond the last | The 404 page |
| An unknown or hidden category | The 404 page |
| The API does not answer | The error page with "Try again" ([Error pages](error-pages.md)) |
| No category holds a product | "No categories to show right now. Please try again later." |

## Rules

### One card per product, or per pack size

| List | The shop asks for | One card is | Decided by |
| --- | --- | --- | --- |
| All products, a search | `view=variants_by_product` | A pack size; the sizes of a product stand together, smallest first | The shop (`listingView`) |
| A category page | No `view` | What the admin set for the category (`listingView` of the category; `variants_by_size` unless changed) | The admin, through the API |
| Rows of the home page | `view=variants_by_size` | A pack size, in rounds | The shop ([Home page](home.md)) |
| "More from …" on a product page, the search dropdown | `view=product` | A product, as its default size | The shop |

The order of the cards is the admin's unless a sorting is chosen. The rules of the views are in [product-display-order.md](../reference/backend/product-display-order.md).

### Filters

A filter with several values means "any of them"; different filters narrow each other. The values and their counts come from `GET /v1/store/products/facets`; a count says how many products choosing the value would leave.

| Filter | Label | In the address | Values | Shown when |
| --- | --- | --- | --- | --- |
| Brand | "Brand" | `brand`, repeated | The brands of the list | At least 2 brands have products |
| Storage | "Keep in" | `storageType`, repeated | `ambient` "Pantry", `chilled` "Chilled", `frozen` "Frozen" | At least 2 have products |
| Price | "Price" | `minPrice` and `maxPrice` in cents | The API's price bands, one at a time, or "Any price" | At least 2 bands have products |
| Pack size | "Pack size" | `packSize`, repeated (`500g`, `1kg`, `0.5l`, `6pcs`) | The sizes of the list | At least 2 sizes have products |
| Labels | "Highlights" | `tag`, repeated | The tags of the list; `bestseller`, `new` and `seasonal` are translated, any other shows with a capital letter | At least 1 tag has products |
| Reduced | "Offers" (switch) | `onSale=1` | – | Some products are reduced and some are not |
| In stock | "Orderable now" (switch) | `orderable=1` | – | Some can be ordered and some cannot |

A filter in use is always shown, so it can be taken off. While the list is narrowed, the panel keeps every value of the unfiltered list (`mergeFacets`): a value the other filters leave nothing for shows the count 0, is dimmed and cannot be chosen. A long list of values shows the first 8 (6 in the sheet) and the chosen ones, with "Show all {count}".

### Sorting, pages and counts

| Thing | Rule | Decided by |
| --- | --- | --- |
| Sorting | `sort`: "Recommended" (the default, not written in the address), `newest` "Newest first", `price_asc` "Price: low to high", `price_desc` "Price: high to low", `discount` "Biggest saving", `name` "Name A–Z" | The API orders |
| Page size | 24 cards (`PAGE_SIZE`) | The shop |
| Page | `page`, left out for page 1; every filter or sorting change goes back to page 1 | The shop |
| "N products" | The facets' `total`, which counts products | The API |
| Number of pages | The list's `totalPages`, which counts cards | The API |
| Page numbers shown | The first, the last, the current and its two neighbours; gaps as "…" (`pageWindow`) | The shop |

**Worked example, counts.** A category holds 4 products with 6 pack sizes and lists one card per size. The page shows six cards under "4 products".

**Worked example, page numbers.** Page 5 of 10 shows `1 … 4 5 6 … 10`; page 1 of 3 shows `1 2 3`.

**Worked example, a price band.** The API answers the bands 0 to 199, 200 to 499 and 5000 upwards (cents, both ends inclusive). They read "Under €2.00", "€2.00 to €4.99" and "€50.00 and over" (`filterLabels`); choosing the second writes `?minPrice=200&maxPrice=499`.

### The address

A full example: `/en/products?q=dal&brand=MDH&brand=Amul&storageType=chilled&minPrice=500&maxPrice=999&onSale=1&sort=price_asc&page=2`. The parameters are the API's own names; defaults are left out, so the plain list has no query. Whatever arrives is checked before it is sent on (`parseListingState`), so a hand-edited address never produces an error:

| Parameter | Accepted | Otherwise |
| --- | --- | --- |
| `q` | 2 to 80 characters after trimming | Shorter: ignored. Longer: cut |
| `sort` | One of the six values | "Recommended" |
| `page` | A whole number from 1 to 500 | Page 1 |
| `brand`, `tag` | Up to 20 different values of at most 80 characters | The rest is dropped |
| `storageType` | `ambient`, `chilled`, `frozen` | Dropped |
| `packSize` | A number and a unit without a space (`g`, `kg`, `ml`, `l`, `pcs`) | Dropped |
| `minPrice`, `maxPrice` | Whole cents from 0; `maxPrice` not below `minPrice` | The price filter is dropped |
| `onSale`, `orderable` | `1` | Off |
| `priceBand` | `200-499` or `5000-`, sent by the form without scripts | Dropped |

### Other rules

| Case | What happens | Decided by |
| --- | --- | --- |
| The address names a category by the slug of the other language | A permanent redirect to the slug of the page's language | The shop's server; the API answers to either slug |
| Search engines | Searched, sorted and filtered views and a category without products say `noindex, follow`; page 2 and later of the plain list name themselves as canonical | The shop ([SEO](../architecture/seo.md)) |
| Which categories the page of all categories shows | Those with `productCount > 0` (`shopCategories`), parents and children alike | The shop |

Prices, discounts and stock on the cards are the API's ([Prices and availability](../business-logic/prices-and-availability.md)).

### Brands

A brand is a text on a product. The shop has: the brand filter of every list (`?brand=`), the brand entries of the search dropdown, which lead to `/en/products?brand=<brand>`, the brand line on a card and the brand chip on a product page (not a link). There are no brand pages and no list of all brands.

## Data and API

All calls are made on the server while the page renders.

```
category page    GET /v1/store/categories/{slug}        → 404, redirect, or the page
every list       GET /v1/store/products                  the cards of this page
                 GET /v1/store/products/facets           counts under the current filters
                 GET /v1/store/products/facets           counts without filters (only while narrowed)
empty + filters  GET /v1/store/products/facets           once per applied value, without it
all categories   GET /v1/store/categories
                 GET /v1/store/products                  per category without a picture (the home page's row request)
```

Every answer is cached for 300 seconds under the tag `catalogue`. The list pages are rendered per request (they read the query of the address); the page of all categories is kept for 300 seconds. A failure of the list, the facets or the categories of the page of all categories leads to the error page; a failed count for the "remove this filter" suggestion counts as 0. More in [Rendering and caching](../architecture/rendering-and-caching.md).

A non-empty list carries an `ItemList` block of structured data, a category page a `BreadcrumbList`.

## Behaviour

- **Changes apply at once.** Choosing a value replaces the address (`router.replace`, no scroll, no entry in the history per click) and the server renders the list again. Chips and "Clear all filters" are links.
- **Without scripts** the same form works: the pills open as plain `details`, and an "Apply" button sends the form.
- **Wide screens.** A pill opens a panel under it; one panel at a time; Escape or a press outside closes it. A pill with chosen values turns leaf and counts them; "Clear" inside empties that filter.
- **Phones.** "Filters" and "Sort" open one sheet titled "Filters": the sorting, then every filter as a section that is open and can be folded, then the switches. Its foot holds "Clear all filters" and "Show N products", which counts as the customer chooses and closes the sheet. Focus returns to the button that opened it.
- **Screen reader.** "N products" is a status and is announced when it changes; the applied filters are a list named "Applied filters"; each chip is named "Remove filter: {name}"; the pages are a navigation "Pages" with "Page 2 of 5" on every number.
- **Sub-category chips** scroll sideways on phones and wrap from `sm`.

## Not built

- "Load more" or endless scrolling on the lists: they have numbered pages. (The rows of the home page load on, see [Home page](home.md).)
- Brand pages, a brand index, a logo per brand.
- A free price range (slider or two fields): the price filter offers the API's bands.
- A choice of cards per page, or a switch between grid and list.
- Filters by `available` or `featured`, which the API accepts and the shop does not offer.

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(shop)/products/page.tsx` | "All products" and the search results |
| `src/app/[locale]/(shop)/category/[slug]/page.tsx` | A category page: breadcrumbs, heading, sub-categories, the list |
| `src/app/[locale]/(shop)/categories/page.tsx` | The page of all categories |
| `src/components/catalogue/product-listing.tsx` | The list: reads products and facets, empty states, pages |
| `src/components/catalogue/filters/listing-controls.tsx` | The controls: pills, switches, sorting, chips, the sheet |
| `src/components/catalogue/filters/facet-popover.tsx` | A pill with its panel |
| `src/components/catalogue/filters/facet-options.tsx` | The values of a filter with their counts |
| `src/components/catalogue/product-grid.tsx` | The grid of cards |
| `src/components/catalogue/breadcrumbs.tsx` | The breadcrumbs |
| `src/components/catalogue/category-card.tsx` | A category as a card |
| `src/components/ui/pagination.tsx` | The page numbers, shared with the blog |
| `src/features/catalogue/listing-state.ts` | The state of a list: parsing the address, the API query, the address of a state, applied filters, `pageWindow` |
| `src/features/catalogue/facets.ts` | `visibleFacets`, `mergeFacets` |
| `src/features/catalogue/filter-labels.ts` | The words of the filter values |
| `src/features/catalogue/categories.ts` | `shopCategories`, `standInPictures` |
| `src/features/catalogue/data.ts` | The server's readers with their caching |
