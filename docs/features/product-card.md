# Product card

The card that stands for one pack size of a product in every list and row of the shop: picture, badges, brand, name with the size, price, and the basket that puts the size into the cart. It shows what the API answers for that size and adds nothing of its own.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | 2026-10-16 (one card per pack size); the basket that opens since 2026-11-25 |
| **Pages** | The product lists, the rows of the home page and of the product page, the wishlist, "Popular right now" on the cart page |
| **Code** | `src/components/catalogue/product-card.tsx`, `src/components/catalogue/add-to-cart.tsx`, `src/components/catalogue/price.tsx`, `src/components/catalogue/product-image.tsx`, `src/features/cart/fly-to-cart.ts` |
| **API** | [Catalogue](../api/endpoints.md#catalogue) for the data; [Cart](../api/endpoints.md#cart) and [Wishlist](../api/endpoints.md#wishlist) for its two controls |
| **State** | None of its own: the quantity comes from the cart store, the heart from the wishlist store |
| **Texts** | `product` |
| **Tests** | `e2e/catalogue.spec.ts` ("the basket of a product card", "the cart of a visitor"), `e2e/polish.spec.ts`, `src/features/catalogue/availability.test.ts`, `src/lib/format/product-name.test.ts`, `src/lib/format/money.test.ts`, `src/lib/catalogue/pictures.test.ts` |
| **Backend reference** | [store-api.md](../reference/backend/store-api.md) (section 7.1), [variant-images.md](../reference/backend/variant-images.md) |

## What the customer sees

A solid white card with soft corners. Its parts from top to bottom:

| # | Part | Content | Shown when |
| --- | --- | --- | --- |
| 1 | Picture tile | The main picture of the pack size on white, square; a link to the product page of that size | Always; without a picture the Radhe mark with "coming soon" |
| 2 | Badges, top left of the tile | The discount ("−20%") in red; "Only N left" in wheat, one under the other | See the rules |
| 3 | Heart, top right of the tile | Saves the product to the wishlist | Always |
| 4 | Pill, bottom right of the tile | "Sold out" or "Currently not available" with an icon | The size cannot be ordered |
| 5 | Brand | A small tracked line in capitals | The product has a brand |
| 6 | Name | The product's name and, in a quieter tone, the pack size in brackets: "Guava / Jamfal (500g)". A link to the product page. Two lines, kept even when one would do | Always |
| 7 | Price row | The price, the regular price struck through when reduced, the price per unit under it; at the right end the basket, or the stepper in its place | The basket and stepper only when the size can be ordered |

Nothing else is on a card: other pack sizes, the description and the delivery promise are on the [product page](product-page.md).

### The basket and the stepper

| Moment | What stands at the end of the price row |
| --- | --- |
| The size is not in the cart | A round leaf button, 40 px, with a basket icon |
| The pointer rests on it, or the keyboard's focus is on it | The button opens to the left and shows "Add" (German: "In den Korb"), where the whole label has room |
| It is pressed | The picture flies into the cart, "Added" is spoken, and the stepper unfolds in the button's place |
| The size is in the cart | A leaf pill with minus, the number and plus, 80 px wide (84 px from `sm`) |
| The quantity is at its minimum | Minus is a bin; pressing it takes the size out of the cart and the basket returns |
| The quantity is at its maximum | Plus is disabled |

A page that opens with the size already in the cart shows the stepper at once, without the unfolding.

### States

| State | The card |
| --- | --- |
| Can be ordered | Parts 1 to 3 and 5 to 7 |
| Few left | The wheat badge, and the same words for screen readers |
| Sold out, or switched off | The picture at 40 % and grey, the pill on the tile, no discount badge, no basket; price and name stay |
| No picture, or its file cannot be loaded | The Radhe mark ghosted on the tile with "coming soon" |
| Adding fails (cart full, the API refuses) | A red message at the top of the window; see [Cart](cart.md) |

## Rules

| Case | What happens | Decided by |
| --- | --- | --- |
| Which pack size a card shows, and its place in the list | As answered | The API ([Catalogue](catalogue.md)) |
| Price, regular price, discount percentage, price per unit | Printed as answered | The API ([Prices and availability](../business-logic/prices-and-availability.md)) |
| Discount badge | `pricing.onSale` and the size can be ordered | The API gives the facts; the browser hides the badge on a size that cannot be ordered |
| "Only N left" | The size can be ordered and `ordering.remaining` is 10 or fewer (`fewLeft`) | The API counts; the threshold is the shop's |
| The pill | `ordering.canOrder` is false; the text follows `ordering.reason` | The API |
| Brand line | The API's `brand`, unless it is empty or a placeholder such as "N/A" or "-" (`brandOf`) | The browser |
| Name | `formatProductName` and `formatPackSize` in `src/lib/format/product-name.ts`; the API's `displayName` is never printed | The browser |
| The quantity of the first press | The smallest quantity the size may be ordered in (`clampToOrdering` of `minQuantity`) | The API sets the limits; the browser applies them |
| Whether the basket may open | Only where the open button fits the slot; see below | The browser (`measureRoom`) |
| What the heart saves | The product; see [Wishlist](wishlist.md) | – |

### The layout of the price row

The card is a container (`@container`) and decides by its own width, as it stands in grids and rows of every width.

| Card width | Price row |
| --- | --- |
| 14 rem or wider | The price at the left, as wide as its figures; a slot at the right takes the rest of the row, never less than 80 px (84 px from `sm`), 40 px high. The basket and the stepper stand at the slot's right end |
| Narrower than 14 rem | The price on a line of its own; the slot under it, the full width, its content at the right |

The slot is as large with the basket in it as with the stepper, so the price neither moves nor wraps differently when the stepper opens.

### When the basket opens

The opening is done in CSS (`basket-orb` in `src/app/globals.css`): the label is a `span` folded to nothing, and it unfolds while the button is hovered (only on devices that can hover) or has the keyboard's focus, and only when the button carries `data-roomy="true"`. `measureRoom` in `src/components/catalogue/add-to-cart.tsx` sets that attribute when the pointer or the focus arrives:

```
roomy  =  50 px + width of the label  ≤  width of the slot
```

The 50 px are the circle (40) and the label's two margins (7 and 3).

**Worked example.** "Add" is 27 px wide: the open button needs 77 px and fits every slot, since a slot is at least 80 px. "In den Korb" is 77 px wide: the open button needs 127 px. On a wide German card with an ordinary price the slot is wider than that and the button opens; beside a reduced price, where the price and the struck-through price fill the row, the slot shrinks towards its least (84 px from `sm`), 127 is more than that, and the button stays a circle. A label is whole or absent, and never lies on the price. A touch screen has no pointer to rest on the button and keeps the circle; a tap adds at once.

**Worked example, the first press.** A size with `minQuantity: 2` and `maxQuantity: 12`: the press puts 2 into the cart, the stepper shows 2, minus is the bin, and plus stops at 12.

## Data and API

The card makes no request to show itself: it renders the entry of the list (`ProductSummary`) it is given. Its controls call the stores:

| Control | Store | Leads to |
| --- | --- | --- |
| Basket, stepper | `useCart` in `src/features/cart/cart.tsx` (`setQuantity`) | The visitor's cart in the browser, or the API for a signed-in customer; see [Cart](cart.md) |
| Heart | `useWishlist` in `src/features/wishlist/wishlist.tsx` | The browser's list or the API; see [Wishlist](wishlist.md) |

Both links of a card (the tile and the name) are `IntentLink`: the product page behind them is prefetched when the pointer, a finger or the focus arrives, not when the card scrolls into view. The picture comes in the API's three widths (320, 800, 1600 px); the browser picks one.

## Behaviour

**The flight into the cart** (`flyToCart`). On the press a copy of the picture tile lifts off, travels on a bent path to the cart icon and shrinks to about 28 px over 720 ms; the icon bobs as it lands. The target is the cart icon of the header from `md` and the cart tab of the tab bar on phones (the first visible element with `data-cart-target`). When the tile is off screen the flight starts at the button as a leaf dot. With the reduced-motion preference there is no flight. The count of the cart has changed before the flight begins.

**Motion.** The card lifts 4 px and its shadow grows under the pointer; the picture grows by 5 % (not with reduced motion). The stepper unfolds from the right; its number pops on every change. The basket's label unfolds in 300 ms and shrinks to 96 % when pressed.

**Keyboard and screen reader.**

| Element | How it is announced |
| --- | --- |
| The card | An `article`; its name is a heading (`h3` unless told otherwise, `h2` in the product lists) |
| The picture link | Hidden from the tab order and from screen readers; the name links to the same page |
| The basket | "Add to cart: {name with size}" |
| After the press | "Added", through a status region, for 1.5 s |
| The stepper | A group "Quantity of {name}" with "One less", "One more" and, at the minimum, "Remove from cart"; the number is announced as it changes |
| The heart | A toggle "Save to wishlist: {name}" or "Remove from wishlist: {name}"; "Saved to your wishlist" is spoken |
| The pill | Plain text, not a button |

**Many cards.** A list holds seventy and more controls. Each reads only its own number from the cart and its own answer from the wishlist and renders again only when that changes (`memo`).

**Phones.** The grid has two cards in a row and the rows show two and a sliver, so most cards are narrower than 14 rem and stack the price over the slot.

## Not built

- A choice of pack size on the card: each size is a card of its own, or is chosen on the product page.
- Stars or a rating: reviews are about orders ([Reviews](reviews.md)).
- A "notify me" control on a sold-out card.
- A quick view, a comparison, or a second picture on hover.
- Storage badges ("Chilled", "Frozen") or tag badges ("New", "Bestseller") on the card; storage and tags are filters of the lists.
- A quantity field to type into: the stepper moves one by one.

## Code map

| File | What it is |
| --- | --- |
| `src/components/catalogue/product-card.tsx` | `ProductCard`: the layout, the badges, the name, the price row with its slot |
| `src/components/catalogue/add-to-cart.tsx` | `AddToCart`: the basket (`look="card"`), the full button of the product page, the stepper, the pill; `measureRoom` |
| `src/components/catalogue/price.tsx` | `Price`: price, regular price, price per unit |
| `src/components/catalogue/product-image.tsx` | `ProductImage`: the picture in three widths, and the mark for none or a broken one |
| `src/components/catalogue/wishlist-button.tsx` | `WishlistButton`: the heart |
| `src/components/catalogue/intent-link.tsx` | `IntentLink`: a link prefetched on intent |
| `src/components/catalogue/product-grid.tsx` | `ProductGrid`: the cards of a list |
| `src/components/ui/quantity-stepper.tsx` | `QuantityStepper`, size `card` |
| `src/features/cart/fly-to-cart.ts` | `flyToCart`: the flight, and its markup contract (`data-fly-scope`, `data-fly-source`, `data-cart-target`) |
| `src/features/catalogue/availability.ts` | `orderingReason`, `fewLeft`, `FEW_LEFT` |
| `src/lib/format/product-name.ts` | `formatProductName`, `formatPackSize`, `productTitle`, `brandOf` |
| `src/lib/cart/guest-cart.ts` | `clampToOrdering` |
| `src/app/globals.css` | `basket-orb`, `surface`, the animations |
