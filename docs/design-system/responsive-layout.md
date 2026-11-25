# Responsive layout

Every page is written for a phone first and widens in four steps. One utility, `container-page`, gives every section the same width and side gutter. Product lists step from two to five columns; a product card decides its own inner layout by its own width (a container query), because it stands in grids and rows of every width. On phones the everyday navigation moves to a tab bar at the foot of the screen, and the one action of a page floats above it. The values are in `src/app/globals.css` and in the components named below.

## Breakpoints

| Prefix | From | What changes there |
| --- | --- | --- |
| (none) | 0 | Phones: one column, the tab bar, floating bars, sheets from the bottom |
| `sm` | 40 rem | The gutter grows to 1.5 rem; sheets come from the right; toasts and the cookie notice move to a corner; the cart list becomes a grid with aligned columns; rows show three cards; the hero is a rounded tile inside the page |
| `md` | 48 rem | The header sticks to the top; account and cart appear in the header and the tab bar goes; the phone bars of cart and product page go; filters are a row of pills instead of a sheet; rows get their arrows; the product page has two columns |
| `lg` | 64 rem | The gutter grows to 2 rem; the promise strip and the category bar appear and the menu button goes; the search stands in the header bar; cart and checkout have two columns with a summary that stays in view; the checkout's floating pill goes; the account navigation is a column |
| `xl` | 80 rem | Rows and wide lists show five cards; every group of the category bar has its own item (below, the last ones share "More") |
| `min-[90rem]` | 90 rem | The items of the category bar are a size larger (`src/components/shell/category-nav.tsx`) |

`--breakpoint-xs` (26 rem) is defined in `@theme`; no class uses `xs:`. `2xl:` is not used. `src/components/cart/cart-summary-bar.tsx` asks the browser for `(max-width: 47.99rem)`, the same line as `md`, so that it does not fetch a bill on screens where it is hidden.

## The page container

| Utility or value | What it sets | Used by |
| --- | --- | --- |
| `container-page` | `width: 100%`, `max-width: 84rem`, centred; `padding-inline` 1 rem, 1.5 rem from 40 rem, 2 rem from 64 rem | Every section of the shop frame: the header bar, the category bar, pages, the footer |
| `max-w-[72.5rem]` | A narrower page | The checkout: its pill header and its page |
| `lg:max-w-[80rem]` | The dark band as a rounded tile | The home page while no banner is live |
| `sm:container-page` | Edge to edge on phones, inside the page from `sm` | The hero carousel |
| `max-w-md`, `max-w-xl` | A single card in the middle | The sign-in pages (`AuthPage`); the choice between sign-in and guest at the checkout |

The body is a column of at least the height of the window (`flex min-h-dvh flex-col`), and `main` takes the room that is left (`flex-1`), so the footer stays at the foot of a short page.

## Lists of products

| List | Phones | `sm` | `md` | `lg` | `xl` | File |
| --- | --- | --- | --- | --- | --- | --- |
| `ProductGrid` | 2 columns, gap 12 px | 2, gap 16 px | 3 | 4 | 4; 5 when `wide` | `src/components/catalogue/product-grid.tsx` |
| Product lists and search (`wide`) | 2 | 2 | 3 | 4 | 5 | `src/components/catalogue/product-listing.tsx` |
| The wishlist | 2 | 2 | 3 | 4 | 5 | `src/components/wishlist/wishlist-view.tsx` |
| A row (`ProductRowItem`) | 44% of the row each: two and a sliver of the third | 3 | 3 | 4 | 5 | `src/components/home/product-row.tsx` |
| The row under the cart | 44% | 3 | 3 | 3 | 4 | `src/app/[locale]/(shop)/cart/page.tsx` |
| All categories | 2 | 3 | 3 | 4 | 4 | `src/app/[locale]/(shop)/categories/page.tsx` |
| The blog | 1 | 2 | 2 | 3 | 3 | `src/components/blog/blog-listing.tsx` |

A row bleeds into the gutter of the page on either side (`-mx-4 px-4`, `sm:-mx-6`, `lg:-mx-8`) so that a swipe on a phone runs edge to edge, snaps card by card (`snap-x snap-mandatory`, `scroll-px-*` equal to the gutter) and hides its scrollbar (`no-scrollbar`). The arrows show from `md`, and only while the row holds more than fits.

## The container query of the product card

`ProductCard` (`src/components/catalogue/product-card.tsx`) is a `@container`. Its last row decides by the card's own width, not by the window's:

| Card width | The last row |
| --- | --- |
| Below 14 rem (two columns on a phone, rows on small tablets) | The price has a line of its own; the slot for the basket and the stepper stands under it, at the right, as wide as the card |
| From 14 rem (`@min-[14rem]:`) | Price and slot side by side on one baseline; the slot takes the room the price leaves (`flex-1`) |

The slot is 40 px high and never narrower than the stepper (`min-w-20`, `sm:min-w-21`), so the price neither moves nor wraps differently when the stepper takes the basket's place. The stepper is 80 px wide and 32 px high on phones, 84 by 36 px from `sm`. The name always keeps two lines (`line-clamp-2 min-h-10`), so prices and baskets of a row line up. This is the only container query in the shop.

## Phones

### The header

Below `md` the header is not sticky: it scrolls away with the page. The logo, the language switch, the wishlist heart and the menu button share the first line; the search field takes a line of its own under them (`order-last w-full`). Account and cart are in the tab bar. Below `lg` the promise strip and the category bar are hidden, and the menu button opens the categories.

### The tab bar

`TabBar` (`src/components/shell/tab-bar.tsx`) is fixed to the foot of the window below `md`: `glass-strong`, `rounded-t-3xl`, four tabs of 56 px height (Shop, Search, Cart, Account), the active one with its icon on a white thumb. It pads itself by `env(safe-area-inset-bottom)`. The cart tab is where a product lands when it is added ([motion.md](motion.md)). The checkout and the plain frame have no tab bar.

### What floats above it

| Bar | Shown | Position | File |
| --- | --- | --- | --- |
| Cart bar: units and total, one tap to the cart | Below `md`, once something is in the cart; not on the cart, the checkout, the sign-in and the product page | `inset-x-4`, `bottom: calc(4.75rem + env(safe-area-inset-bottom))`, at least 44 px high | `src/components/cart/cart-summary-bar.tsx` |
| Cart pill: total and "Checkout" | Below `md`, on the cart page | `inset-x-2.5`, `bottom: calc(4.25rem + env(safe-area-inset-bottom))` | `src/components/cart/cart-view.tsx` |
| Product bar: name, price, add to cart | Below `md`, on the product page | Full width, `rounded-t-2xl`, `bottom: calc(3.75rem + env(safe-area-inset-bottom))` | `src/components/catalogue/product-purchase.tsx` |
| Checkout pill: total and "Buy now" | Below `lg`, on the checkout | `inset-x-2.5`, `bottom: calc(0.75rem + env(safe-area-inset-bottom))` (no tab bar there) | `src/components/checkout/checkout-view.tsx` |
| Cookie notice | Until read | Below `sm`: `inset-x-3`, `bottom: calc(4.75rem + env(safe-area-inset-bottom))`; from `sm`: bottom left corner, at most `max-w-sm` | `src/components/shell/cookie-notice.tsx` |

Pages keep room for them: the footer ends with `pb-40` below `md` (`md:pb-8`), the checkout's `main` with `pb-28` (`lg:pb-16`), and the product page adds a spacer of 48 px below `md`.

### The folding menu

The menu button (44 px, `lg:hidden`) opens a `Sheet` with the categories in the groups of the category bar; a tap folds one group open at a time, and the group of the page the customer is on is open when the menu opens. The panel and the dialog code behind it are fetched when the button is first touched (`src/components/shell/mobile-menu.tsx`, `src/components/shell/mobile-menu-panel.tsx`). See [features/header-navigation-footer.md](../features/header-navigation-footer.md).

### Other changes on phones

| Element | On phones | Wider |
| --- | --- | --- |
| `Sheet` | From the bottom, at most `88dvh` high, with a grab handle | From the right, 26 rem wide, from `sm` |
| Filters | Two buttons ("Filters", "Sort") that open one sheet | A row of pills with panels, from `md` |
| Cart line | Picture and texts in the first row; stepper, total and the two buttons share the second | One row, every column aligned across lines (`grid-cols-subgrid`), from `sm` |
| Account navigation | A segmented control that scrolls sideways | A column of 13 rem, from `lg` |
| Hero | Edge to edge | A rounded tile, from `sm` |
| Checkout header | "Secure checkout" and "Back" as icons only | With their words, from `sm` |
| Toasts | Across the top (`inset-x-3`) | Top right corner, at most `max-w-sm`, from `sm` |

## Sticky and fixed elements

| Element | Position | Layer |
| --- | --- | --- |
| The line of `NavigationProgress` | Fixed, top of the window, 3 px | `z-[60]` |
| The skip link, when focused | Fixed, `top-3 left-3` | `z-50` |
| `Sheet` and its dim; `Tooltip`; toasts; the cookie notice | Fixed (toasts: `top-3`) | `z-50` |
| The search form and its dropdown | The form is `relative z-50`, so it stays above its own dim | `z-50` |
| The panel of the category bar | Absolute, under the bar, as wide as the page | `z-50` |
| The ghost of the flight into the cart | Fixed | `z-index: 50` |
| The header of the shop | `md:sticky md:top-0` | `z-40` |
| The header of the checkout | `sticky top-3`, a pill 12 px from the edges | `z-40` |
| The tab bar | Fixed, bottom | `z-40` |
| The phone bars (cart bar, cart pill, product bar, checkout pill) | Fixed, see above | `z-30` |
| The dims of the search and of the category bar; the panel of a filter pill | Fixed; absolute | `z-30` |
| The gallery of the product page | `md:sticky md:top-40` | – |
| The summary of the cart | `lg:sticky lg:top-28` | – |
| The summary of the checkout | `lg:sticky lg:top-[5.5rem]` | – |
| The side column of the report page | `lg:sticky lg:top-24` | – |

The sticky columns set their `top` for the header of their frame: 10 rem for the gallery, 7 rem for the cart's summary and 6 rem for the report page under the header of the shop (its bar is 5 rem high from `lg`, the category bar under it 3 rem), 5.5 rem under the pill of the checkout. For the same reason `html` sets `scroll-padding-top: 7rem`, and the panels of the checkout `scroll-mt-24`, so that an anchor or a field brought into view is not hidden under the header.

An element with `backdrop-filter` holds its fixed children; what must be fixed to the window from inside a frosted panel renders on `document.body` ([liquid-glass.md](liquid-glass.md)).

## Safe areas and small screens

| Rule | Where |
| --- | --- |
| `viewportFit: "cover"`, `width: "device-width"`, `initialScale: 1` | The `viewport` of `src/app/[locale]/layout.tsx` |
| `env(safe-area-inset-bottom)` added to the padding or the offset | The tab bar, the four phone bars, the cookie notice, the body and the footer of a `Sheet` |
| Heights in `dvh`, so the browser's own bars are counted | `min-h-dvh` on the body, `max-h-[88dvh]` on a sheet, the search dropdown (`min(70dvh, 38rem)`), the panel of the category bar (`calc(100dvh - 12rem)`) |
| 16 px text in every field | `controlStyles`: iOS does not zoom into the field |
| `-webkit-text-size-adjust: 100%` | `html` |
| Nothing wider than the window | The category bar clips sideways only (`overflow-x-clip`); wide tables of a legal text scroll inside their own box; long German words in headlines may break (`hyphens: auto` in `font-display`) |

## Rules for a layout

1. Write the phone layout first; add `sm:`, `md:`, `lg:`, `xl:` only where the table of breakpoints says something changes.
2. A section of a page is a `container-page`; do not set a page width by hand.
3. A list of cards uses `ProductGrid` or `ProductRow`; a card is never given a fixed width in pixels.
4. Something fixed to the foot of a phone adds `env(safe-area-inset-bottom)`, stands above the tab bar where there is one, and the page keeps room for it.
5. A sticky column sets its `top` to clear the header of its frame.
6. A component that appears in places of different widths decides by its own width (`@container`), not by the window's.
