# The cart and the bill

A cart is a list of pack sizes with a quantity each. A visitor's cart is kept in the browser, a customer's cart by the API. A bill is the API's answer to a cart: the lines with their prices, the delivery, the discounts and the total. **The browser adds nothing up that is charged**: every price, line total, fee, discount, VAT figure and total on a page is a field of the bill, printed as it came. The few things the browser does compute are listed in [What the browser computes](#what-the-browser-computes), each with its formula and an example. The rules behind the figures are the API's: [reference/backend/store-api.md](../reference/backend/store-api.md), section 8.

The pages that show a bill: [the cart](../features/cart.md), [the checkout](../features/checkout.md) and, for an order, [the order page](../features/orders.md).

## The guest cart

`src/lib/cart/guest-cart.ts` keeps the cart of a visitor who is not signed in.

| | |
| --- | --- |
| Where | `localStorage`, key `rf.cart.v2` (`GUEST_CART_KEY`) |
| Shape | A JSON array of `{ "variantId": "<24 hex characters>", "quantity": <whole number> }` |
| Never stored | Prices, names, pictures: `POST /v1/store/cart/preview` answers them |
| Limits | 100 lines (`CART_MAX_LINES`), 1 to 10000 units per line (`CART_MAX_QUANTITY`); they mirror the API's |
| Empty cart | The key is removed |
| Storage blocked | The cart reads as empty and a change is not kept; nothing is thrown |

What is read from storage is never trusted. `sanitizeCart` drops everything that is not an array, every entry whose `variantId` is not 24 hexadecimal characters or whose `quantity` is not a whole number from 1 to 10000, keeps the first of two entries with the same `variantId`, and cuts the list at 100 lines.

`setQuantity` of the same file is the one way a visitor's cart changes:

| Wanted quantity | Result |
| --- | --- |
| `0`, negative or not a number | The line is removed |
| A fraction | Cut to the whole number below (`Math.trunc`) |
| More than 10000 | 10000 |
| A pack size that is not in the cart, with 100 lines in it | Refused with `cart_full`; the shop says "Your cart is full. Remove a product to add another." |

Every change is written at once and announced with the window event `rf:guest-cart`; the `storage` event carries it to the other tabs of the browser (`src/features/cart/cart.tsx`).

### The first quantity: `clampToOrdering`

The add button (`AddToCart` in `src/components/catalogue/add-to-cart.tsx`) puts a pack size into the cart with `clampToOrdering(minQuantity, ordering)`:

```
min = max(1, ordering.minQuantity)
max = min(10000, ordering.maxQuantity)
max < min  →  min
otherwise  →  the wanted quantity, cut to a whole number, kept between min and max
```

| `minQuantity` | `maxQuantity` | Wanted | In the cart |
| --- | --- | --- | --- |
| 1 | 12 | 1 | 1 |
| 2 | 5 | 2 | 2 |
| 3 | 2 (the stock is below the minimum) | 3 | 3; the API then reports the line's issue |
| no `ordering` | – | 1 | 1 |

`minQuantity` and `maxQuantity` are the API's (`Ordering` in `src/lib/api/types.ts`); see [prices and availability](prices-and-availability.md).

## The customer's cart

A signed-in customer's cart is stored by the API. The shop reads it with `GET /v1/store/cart`, whose answer is the bill; the lines of that bill are the cart. The answer is cached under the query key `["cart", locale]` for 30 seconds (`cartQueryKey`), and every later answer of a cart endpoint replaces it.

`CartProvider` gives both carts one face (`useCart`): `ready`, `mode` (`guest` or `customer`), `items`, `units` (the sum of all quantities), `quantityOf`, `setQuantity`, and `problem`, the last change that failed. `ready` is `false` until the browser's cart is read, the session is known, a customer's first bill has arrived and a waiting hand-over is done; a page shows its placeholder until then.

## Signing in and signing out

| Moment | What happens | Decided by |
| --- | --- | --- |
| A visitor with products signs in or signs up | Once per page load the browser's cart is sent with `POST /v1/store/cart/merge`. The answered bill becomes the cached cart, the key `rf.cart.v2` is removed, and every open cart is told | The browser sends; the API merges (for a pack size in both carts the larger quantity wins) |
| The hand-over fails | The browser's cart stays where it is and is sent again at the next page load; the customer goes on with the stored cart, and the error shows as the cart's `problem` | The browser |
| Another customer signs in on the same browser | Everything cached but the session is dropped (`forgetCachedData` in `src/features/session/session.ts`) | The browser |
| The customer signs out | The page is loaded afresh (`src/components/account/sign-out.tsx`). Nothing writes to `rf.cart.v2`: the stored cart stays with the account, and the visitor starts with whatever the browser holds, which is nothing after a hand-over that went through | The browser |
| A guest order is paid | The guest order page empties `rf.cart.v2` when it is opened with `?payment=success` and the order is paid (`forgetGuestCart`) | The browser |
| A customer's order is paid | The API empties the stored cart | The API |

## How a quantity change is sent

The number the customer chose shows at once on every control; the prices follow from the API.

**A visitor.** The change is written to `localStorage` straight away. `useBill` (`src/features/cart/use-bill.ts`) waits 350 ms after the last change (`PREVIEW_DELAY_MS`) and then asks `POST /v1/store/cart/preview` for the bill of the whole cart. The bill on the page stays until the next one is there (`keepPreviousData`); an answer is reused for 30 seconds for the same cart.

**A customer.**

```
tap  →  the wanted quantity is kept as "pending" and shown at once
     →  a timer of 300 ms per pack size starts again (DEBOUNCE_MS)
     →  the timer runs out: PUT /v1/store/cart/items/{variantId} with the last quantity (0 removes)
     →  the answer is the whole bill and replaces the cached one
```

| Case | What the code does |
| --- | --- |
| Quick taps on one pack size | They are collected: one request with the last quantity |
| Changes of several pack sizes | Their requests go out one after the other, in the order of the taps (one promise chain), so an older bill never overwrites a newer one |
| A read of the cart is on its way when an answer arrives | The read is cancelled; the answer of the change is newer |
| The request fails | The error becomes the cart's `problem`, and the cart is read again from the API, so the number falls back to what is stored |
| The customer changed the quantity again while a request travelled | The newer choice stays on the screen and is sent next |

While the bill on the page is not the bill of the cart on the page (a line more or less, or another quantity) or a request is on its way, `useBill` reports `updating`: the totals dim, the region is `aria-busy`, a screen reader hears "Updating prices …", and the way to the checkout is switched off. A line the customer removed leaves the list at once.

## The bill

`Bill` in `src/lib/api/types.ts` is the answer of every cart endpoint:

| Field | Holds |
| --- | --- |
| `canOrder` | Whether the cart can be ordered as it is |
| `lines[]` | One per pack size: `variantId`, `quantity`, `unitPrice`, `lineTotal`, `issue`, `ordering`, `product` (the list entry with this size, `null` when it is gone) and the line's shares of the discounts |
| `totals` | `subtotal`, `discount`, `rewards`, `deliveryFee`, `total`, and the VAT figures |
| `delivery` | Under the flat fee: `fee`, `freeFrom`, `missingForFree` |
| `shipping` | Delivery by the box; `null` or absent under the flat fee ([shipping](../features/shipping.md)) |
| `discount` | The discount code kept with the cart, or `null` ([discount codes](../features/discount-codes.md)) |
| `rewards` | The customer's coins on this bill; `null` for a visitor ([rewards](../features/rewards.md)) |

### The rows of the totals

`BillTotals` in `src/components/cart/bill-summary.tsx` prints the same rows on the cart page, at the checkout and on an order:

| Row | Text | Shown | Amount |
| --- | --- | --- | --- |
| Goods | "Subtotal" | Always | `totals.subtotal` plus the saving of the sale prices |
| Sale prices | "Discount" | While the saving is above 0 | Minus the saving (`saleSavingsOf`) |
| Code | "Discount code {code}" | While `totals.discount` is above 0 | Minus `totals.discount`; the code is `discount.code` of an applied code |
| Coins | "Coins redeemed ({coins})" | While `totals.rewards` is above 0 | Minus `totals.rewards`; the count is `rewards.coins` |
| Delivery | "Delivery" | Always | `totals.deliveryFee`, or "Free" in green when it is 0. The line under it and the struck-through fee of a free-delivery code are in [shipping](../features/shipping.md) |
| Total | "Total", with "Tax included." under it | Always | `totals.total`, the one large number |

The VAT figures of the bill (`netTotal`, `vatTotal`, `vat[]`) are not printed on a bill; the invoice carries them.

## What the browser computes

Nothing in this list reaches the API or changes what is charged.

| What | Where | Formula |
| --- | --- | --- |
| The saving of the sale prices | `saleSavingsOf` in `src/features/cart/savings.ts` | The sum over the lines of `max(0, regularPrice − unitPrice) × quantity`; a line whose product is gone counts 0 |
| The length of the free-delivery bar | `FreeDeliveryProgress` in `src/components/cart/bill-summary.tsx` | `min(100, round(value ÷ freeFrom × 100))` percent, with `value = totals.subtotal − totals.discount`; 100 when `missingForFree` is 0 |
| The length of the two meters of the box card | `src/features/cart/shipping.ts`, `src/components/cart/box-shipping.tsx` | See [shipping](../features/shipping.md) |
| Boxes that stopped being free | `lostFreeBoxes` in `src/features/cart/shipping.ts` | `max(0, paidBoxes after − paidBoxes before)` |
| Counts | `useCart`, `CartCount`, the checkout's head | The number of lines and the sum of the quantities |

**The saving, worked.** A bill with three lines:

| Line | `unitPrice` | `pricing.regularPrice` | `quantity` | Saving |
| --- | --- | --- | --- | --- |
| A | `219` | `249` | 1 | `30` |
| B | `449` | `499` | 6 | `300` |
| C | `1299` | `1299` | 2 | `0` |

The saving is `330`. The API's `totals.subtotal` is at the prices paid, `5511`. The page prints "Subtotal" 58.41 € (`5511 + 330`) and "Discount" −3.30 €: the saving is added in the first row and taken off in the second, so the rows still lead to the API's total. The total itself is `totals.total`, untouched.

**The bar, worked.** With a threshold of 50.00 € (`freeFrom` `5000`) and goods of 32.50 € after the code (`3250`): `round(3250 ÷ 5000 × 100)` = 65 percent. The sentence beside it prints the API's `missingForFree` (17.50 €); it is not `5000 − 3250` worked out in the browser.

## Line issues

The API marks a line that cannot be ordered as it is with `issue` (`CartLineIssue`). The cart page prints the text of the code under the line and dims its picture; the summary says "Please sort out the marked products first."

| `issue` | Text | What the shop offers |
| --- | --- | --- |
| `product_not_found` | "This product is no longer available. Please remove it." | The bin; the line has no stepper and no link |
| `quantity_below_minimum` | "The minimum order for this product is {min}." | "Set to {min}", one tap |
| `quantity_above_maximum` | "Only {max} can be ordered right now." | "Set to {max}", one tap, while `max` is above 0 |
| `product_unavailable` | "Currently not available. Please remove it to order the rest." | The bin |
| `sold_out` | "Sold out. Please remove it to order the rest." | The bin |
| `too_heavy` | "This item is too heavy to be shipped. Please remove it or contact us." | The bin |

`{min}` and `{max}` are `ordering.minQuantity` and `ordering.maxQuantity` of the line. The stepper of a line stops at `maxQuantity` and goes down to 1, also below `minQuantity`: the API then reports `quantity_below_minimum`.

## `canOrder`

`canOrder` is the API's word on whether the cart can be ordered: `true` only for a cart that is not empty and has no line with an issue.

| Page | Rule in the browser |
| --- | --- |
| Cart | "Go to checkout" is a link while `canOrder` is `true` and the bill is not `updating`; otherwise a switched-off button |
| Checkout | "Buy now" is switched off while `canOrder` is `false`, while the bill is being read again, after the API said the shop cannot sell, and after it said the order was placed already |

## A bill that is refused at the checkout

The checkout asks for the bill afresh every time it opens (`staleTime` 0) and sends `totals.total` of the bill on the screen as `expectedTotal`. When the API refuses the order, the page says why and reads the bill again:

| Answer | The page | The bill |
| --- | --- | --- |
| `409 ORDER_TOTAL_CHANGED` | "The total has changed", with the two totals from the error's details | Read again |
| `409 ORDER_ITEMS_NOT_ORDERABLE` | The refused lines by name, and the way to the cart | Read again |
| `409 DISCOUNT_NOT_APPLICABLE` | "Your discount code {code} was removed", with the reason | Read again; a guest's code is dropped first |
| `409 REWARDS_NOT_APPLICABLE` | "Your coins were not redeemed", with the reason | Read again |
| `409 LEGAL_VERSION_CHANGED` | "Our terms were updated"; the consent is unticked | Kept; the legal versions are read again |
| Any other error | The text of the error | Read again; the addresses too after `ADDRESS_NOT_FOUND` |

The customer then presses "Buy now" again with the bill that is on the screen. Applying or removing a code or coins needs no second read: the API answers the whole bill, and the page takes it over. The whole order of events is in [checkout](../features/checkout.md).

## Code map

| File | What it is |
| --- | --- |
| `src/lib/cart/guest-cart.ts` | The visitor's cart: storage, limits, `sanitizeCart`, `setQuantity`, `clampToOrdering` |
| `src/lib/cart/guest-cart.test.ts` | Its unit tests |
| `src/features/cart/cart.tsx` | `CartProvider` and `useCart`: both carts, the hand-over on sign-in, the sending of changes |
| `src/features/cart/use-bill.ts` | `useBill`: the bill of the cart, `loading`, `updating` |
| `src/features/cart/savings.ts` | `saleSavingsOf` and, for orders, `orderSavingsOf` |
| `src/features/cart/savings.test.ts` | Their unit tests |
| `src/components/cart/bill-summary.tsx` | `BillTotals` and `FreeDeliveryProgress` |
| `src/lib/api/types.ts` | `Bill`, `BillLine`, `Totals`, `CartLineIssue`, `Ordering` |
| `src/lib/format/money.ts` | `formatMoney`: cents to "€19.99" or "19,99 €", without a float between |
