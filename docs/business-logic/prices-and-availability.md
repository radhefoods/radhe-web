# Prices and availability

What the browser does when it shows a product: how it prints a price, a reduced price, a discount and a price per unit in each language, how it names a product and its pack size, what "can be ordered" means, when "Only N left" appears, and how a quantity is kept inside its limits. **The API decides every price, every discount, the VAT, the stock and the limits; the browser calculates none of them.** It prints amounts, words the API's reasons, compares two numbers the API sent, and clamps a quantity to limits the API sent. The rules of the API itself are in [store-api.md](../reference/backend/store-api.md), section 7.1; the cart and its bill are in [Cart and bill](cart-and-bill.md).

These rules apply wherever a product shows: the [product card](../features/product-card.md), the [product page](../features/product-page.md), the [search](../features/search.md) dropdown, the [catalogue](../features/catalogue.md) lists, the wishlist, the cart and the orders.

## Who decides what

| Fact | Field of the API | The browser |
| --- | --- | --- |
| The price to show and to charge, VAT included | `pricing.price` | Prints it |
| Whether a size is reduced, and its regular price | `pricing.onSale`, `pricing.regularPrice` | Prints the regular price struck through; colours the price red |
| The discount percentage | `pricing.discountPercent` | Prints it with a minus sign |
| The price per kilogram, litre or piece | `pricing.basePrice` | Prints it with the unit's word |
| VAT rate and amount | `pricing.vatPercent`, `pricing.vatAmount` | Shows neither on a product; says "Tax included." |
| Whether a size can be ordered, and why not | `ordering.canOrder`, `ordering.reason` | Words the reason |
| Units in stock | `ordering.remaining` | Compares with 10 for "Only N left" |
| Fewest and most units per order line | `ordering.minQuantity`, `ordering.maxQuantity` | Clamps the quantity; disables plus at the maximum |
| Name, pack size, brand | `name`, `packSize`, `brand` | Formats them (below) |

Money is whole cents everywhere and weights are whole grams. `src/lib/format/money.ts` states it at its head: nothing in the shop adds, multiplies or rounds prices.

## Money

Source: `formatMoney` in `src/lib/format/money.ts`; tests in `src/lib/format/money.test.ts`.

The cents are first written as an exact decimal string (`centsToDecimalString`: `1999` becomes `"19.99"`), so no floating-point number stands between the API's cents and the printed price; `Intl.NumberFormat` then prints it as euros. An amount that is not a whole number of cents throws.

| Language | Format of `Intl` | `1999` | `123456` | `-1299` | `0` |
| --- | --- | --- | --- | --- | --- |
| English | `en-DE` | €19.99 | €1,234.56 | -€12.99 | €0.00 |
| German | `de-DE` | 19,99 € | 1.234,56 € | -12,99 € | 0,00 € |

In German a no-break space stands between the number and the sign, so a price never wraps.

## A reduced price and the discount

Source: `Price` in `src/components/catalogue/price.tsx`; `formatDiscount` and `formatPercent` in `src/lib/format/money.ts`.

| `pricing.onSale` | The price block shows |
| --- | --- |
| `false` | The price in the ink colour; the price per unit under it |
| `true` | The price in red, then the regular price struck through; the price per unit under it. Screen readers hear "Price:" before the first and "Regular price:" before the second |

The discount is printed from `pricing.discountPercent` with a true minus sign: "−20%" in English, "−20 %" in German (with a no-break space). `formatPercent` prints at most one decimal.

| Where | Shown when |
| --- | --- |
| Red badge on a card's picture | `onSale`, and the size can be ordered |
| Red chip above the headline of the product page | `onSale` of the chosen size |
| Segment of the size picker | No percentage; the price per unit of a reduced size is red |

**Worked example.** The API answers `price: 1999, regularPrice: 2499, onSale: true, discountPercent: 20, basePrice: { amount: 400, per: "kg" }`. The English card shows the badge "−20%", "€19.99" in red, "€24.99" struck through and "€4.00 / kg"; the German one "−20 %", "19,99 €", "24,99 €" and "4,00 € / kg". The browser did not work out the 20: how the API rounds it is in its documentation.

## The price per unit

Source: `formatBasePrice` in `src/lib/format/money.ts`.

German law asks for the price per kilogram, litre or piece beside every price. The amount and the unit are the API's; the browser prints the amount as money, a slash and the unit's word:

| `basePrice.per` | English | German |
| --- | --- | --- |
| `kg` | kg | kg |
| `l` | l | l |
| `pcs` | pc | Stk. |

`{ amount: 400, per: "kg" }` reads "€4.00 / kg" and "4,00 € / kg"; `{ amount: 25, per: "pcs" }` reads "0,25 € / Stk." in German. It stands under every price of a card and a search entry, on each segment of the size picker and after the price of the product page, there followed by " · Tax included." (`common.priceNote`, a link to "Delivery and payment"). The footer of every page says "All prices include tax.".

## Names and pack sizes

Source: `src/lib/format/product-name.ts`; tests in `src/lib/format/product-name.test.ts`. The API's ready-made `displayName` is never printed; the title is always built from `name` and `packSize`.

| Function | Rule | Example |
| --- | --- | --- |
| `formatProductName` | An alternative name the admin wrote in brackets follows a slash; spacing is tidied; empty brackets vanish | "Guava (Jamfal)" → "Guava / Jamfal"; "Chana Dal (Split) (Organic)" → "Chana Dal / Split / Organic"; "Guava ()" → "Guava" |
| `formatPackSize` | The API's localised label, without the space before a unit of weight or volume, with it before pieces | "500 g" → "500g"; "0,5 kg" → "0,5kg"; "1 pcs" → "1 pcs"; "6 Stk." → "6 Stk." |
| `productTitle` | The name, then the size in brackets | "Guava / Jamfal (500g)"; "Mango / Keri (1 pcs)"; "Basmati Rice (1kg)" |
| `brandOf` | The brand trimmed, or none when the field is empty or a placeholder: `n/a`, `na`, `n.a.`, `-`, `–`, `—`, `none`, `null`, `unknown`, `keine`, `ohne` (any case) | "  MDH " → "MDH"; "N/A" → no brand line |

A card prints the size in a quieter tone than the name; the spoken labels of its controls use the whole title ("Add to cart: Guava / Jamfal (500g)"). The title of a product page's tab adds the rules of `productPageTitle` in `src/lib/seo/title.ts` ([SEO](../architecture/seo.md)).

## What "can be ordered" means

Source: `orderingReason` in `src/features/catalogue/availability.ts`; tests in `src/features/catalogue/availability.test.ts`.

A pack size can be ordered when its `ordering.canOrder` is true. The API sets it: the product and the size are switched on and the stock covers the smallest order. Nothing is reserved before a payment goes through, so the answer can change until then. An entry without an `ordering` block counts as orderable.

| `ordering` | Text (`product.reason`) | On a card | On the product page |
| --- | --- | --- | --- |
| `canOrder: true` | – | The basket, or the stepper | "Add to cart", or the stepper; "In stock" under it |
| `reason: "sold_out"` | "Sold out" | The picture grey at 40 %, a pill with a crossed-out parcel on the tile, no basket, no discount badge | The pill in the button's place; no stock line; the segment of the size says "Sold out" |
| `reason: "product_unavailable"` | "Currently not available" | The same, with a "no entry" icon | The same, with that text |

The pill is plain text, not a disabled button. A list can be narrowed to what can be ordered with the switch "Orderable now" (`orderable=1`), which the API applies.

What the cart does with a line that can no longer be ordered, and the refusals at the checkout (`409`), are in [Cart and bill](cart-and-bill.md) and [Error handling](../api/error-handling.md).

## "Only N left"

Source: `fewLeft` and `FEW_LEFT` in `src/features/catalogue/availability.ts`.

| Condition | Result |
| --- | --- |
| `canOrder` is true and `remaining` is 10 or fewer | "Only {remaining} left": a wheat badge on a card's picture, the wheat stock line on the product page |
| `canOrder` is true and `remaining` is above 10 | Nothing on a card; "In stock" on the product page |
| `canOrder` is false | Nothing: the pill says why |

The threshold of 10 is the shop's (`FEW_LEFT`); the number shown is the API's `remaining`, the stock, not the most that may be ordered.

**Worked example.** `remaining: 37` shows no badge; `remaining: 10` shows "Only 10 left"; `remaining: 3` shows "Only 3 left"; a sold-out size with `remaining: 0` shows "Sold out" and no badge.

## Quantity limits

Sources: `clampToOrdering` in `src/lib/cart/guest-cart.ts`, `AddToCart` in `src/components/catalogue/add-to-cart.tsx`, `QuantityStepper` in `src/components/ui/quantity-stepper.tsx`, `cappedByLimit` in `src/features/catalogue/availability.ts`; tests in `src/lib/cart/guest-cart.test.ts`.

The API states the limits of a size in its `ordering` block: `minQuantity` (the product's least per order line) and `maxQuantity` (the product's most per order, capped by the stock; `0` when sold out).

| Moment | Rule |
| --- | --- |
| The first press of the basket or of "Add to cart" | The quantity becomes `clampToOrdering(minQuantity, ordering)`: the minimum |
| Plus | One more, disabled once the quantity reaches `maxQuantity` |
| Minus above the minimum | One less |
| Minus at the minimum | A bin: the size leaves the cart (quantity 0). The quantity never rests between 0 and the minimum |
| The product page's hints | "Minimum order: {count}" when `minQuantity` is above 1; "At most {count} per order" when `maxQuantity` is below `remaining`, that is, when the product's own limit and not the stock caps the quantity |

`clampToOrdering(quantity, ordering)` works like this:

```
min    = the larger of 1 and minQuantity (1 without an ordering block)
max    = the smaller of 10 000 and maxQuantity (10 000 without an ordering block)
result = min                              when max is below min
         quantity cut to whole units,
         raised to min, lowered to max    otherwise
```

| Call | Result | Why |
| --- | --- | --- |
| `clampToOrdering(0, { minQuantity: 1, maxQuantity: 10 })` | 1 | Raised to the minimum |
| `clampToOrdering(50, { minQuantity: 1, maxQuantity: 10 })` | 10 | Lowered to the maximum |
| `clampToOrdering(4, { minQuantity: 2, maxQuantity: 10 })` | 4 | Inside the limits |
| `clampToOrdering(1, { minQuantity: 2, maxQuantity: 10 })` | 2 | Raised to the minimum |
| `clampToOrdering(3, { minQuantity: 2, maxQuantity: 1 })` | 2 | Fewer left than the minimum: the minimum stands |
| `clampToOrdering(99999, null)` | 10000 | The limit of a cart line |

**Worked example.** A size answers `minQuantity: 2, maxQuantity: 12, remaining: 37`. Its product page says "Minimum order: 2" and "At most 12 per order". The first press puts 2 into the cart; plus goes to 12 and stops; minus at 2 is the bin.

The cart itself has limits that mirror the API's: 100 lines and 10 000 units per line (`CART_MAX_LINES`, `CART_MAX_QUANTITY`). A new line in a full cart is refused with "Your cart is full. Remove a product to add another.". The browser's limits only keep the controls sensible; the API checks every quantity again when the cart is priced and when the order is placed ([Cart and bill](cart-and-bill.md)).

## How current a shown price or stock is

| Place | Source | Oldest it can be |
| --- | --- | --- |
| Cards of lists and rows, the search results page | The server's cached answer | 300 seconds |
| Further cards of a home-page row, the search dropdown | The browser asks the API | The API's own cache |
| Product page: name, texts, prices | The cached page | 300 seconds |
| Product page: button, stock line, limits, pictures | The browser asks the API when the page opens | Fresh for 30 seconds in the tab |
| Cart, checkout | The API prices every time | See [Cart and bill](cart-and-bill.md) |

A price on a product page can therefore lag the admin's change by five minutes while its stock is current; the amount charged is always the API's at the checkout. More in [Rendering and caching](../architecture/rendering-and-caching.md).

## Weights

Source: `formatWeight` in `src/lib/format/weight.ts`. Used where a delivery promise names what a box holds ([Shipping](../features/shipping.md)): grams below a kilogram ("850 g"), else kilograms with at most one decimal, "7.5 kg" in English and "7,5 kg" in German. The other modules of `src/lib/format` print dates, phone numbers and Markdown and are described with the features that use them.

## Code map

| File | What it is |
| --- | --- |
| `src/lib/format/money.ts` | `centsToDecimalString`, `formatMoney`, `formatBasePrice`, `formatPercent`, `formatDiscount` |
| `src/lib/format/product-name.ts` | `formatProductName`, `formatPackSize`, `productTitle`, `brandOf` |
| `src/lib/format/weight.ts` | `formatWeight` |
| `src/components/catalogue/price.tsx` | `Price`: the price block of cards and the product page |
| `src/features/catalogue/availability.ts` | `orderingReason`, `fewLeft`, `FEW_LEFT`, `cappedByLimit` |
| `src/lib/cart/guest-cart.ts` | `clampToOrdering`, `CART_MAX_LINES`, `CART_MAX_QUANTITY` |
| `src/components/catalogue/add-to-cart.tsx` | The control that applies the limits |
| `src/components/ui/quantity-stepper.tsx` | Minus, number, plus |
| `src/lib/api/types.ts` | `PriceView`, `PackSize`, `Ordering` as the shop reads them |
