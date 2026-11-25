# Shipping

How the shop shows what delivery costs. The API knows two ways of pricing it: a flat fee per order that falls away from a value of goods, and delivery by the box, where every box has a fee and the value of the goods frees one box after the other. The shop shows whichever the bill carries. **Every weight, every count of boxes, every fee and every missing amount is the API's**; the shop picks the sentence that fits, formats the figures and draws three bars.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | The flat fee with its hint: October 2026 (phase 3 of the first build). Delivery by the box: 2026-11-20. The card of the boxes: 2026-11-24 |
| **Pages** | `/en/cart` · `/de/warenkorb`, `/en/checkout` · `/de/kasse`, the order pages, and the delivery promises in the header, on the home page and on the product page |
| **Code** | `src/features/cart/shipping.ts`, `src/components/cart/box-shipping.tsx`, `src/components/cart/bill-summary.tsx`, `src/features/catalogue/delivery-promise.ts`, `src/lib/format/weight.ts` |
| **API** | [Cart](../api/endpoints.md#cart), [Settings and legal texts](../api/endpoints.md#settings-and-legal-texts) |
| **State** | None of its own: `shipping` and `delivery` of the bill, `shipping` and `deliveryFee` of the settings. The note on a lost free box is kept in the checkout page |
| **Texts** | `shipping`; `cart` (`freeMissing`, `freeReached`, `freeFromLabel`, `delivery`, `deliveryFree`, `issue.too_heavy`); `home` (`trustFree`, `trustFreeBox`, `card.perBox`); `product.info`; `orders.boxes` |
| **Tests** | `e2e/shipping.spec.ts`, `e2e/checkout.spec.ts`, `src/features/cart/shipping.test.ts`, `src/i18n/shipping-messages.test.ts`, `src/lib/format/weight.test.ts`, `mocks/shipping.test.ts` |
| **Backend reference** | [reference/backend/box-based-shipping-web-integration.md](../reference/backend/box-based-shipping-web-integration.md), [reference/backend/box-based-shipping.md](../reference/backend/box-based-shipping.md) |

## What the customer sees

### Which of the two

| The bill | The cart and the checkout show |
| --- | --- |
| `shipping` is `null` or absent | The flat fee: the hint on free delivery in the cart's summary, and the row "Delivery" |
| `shipping` is set, with at least one box | The card of the boxes under the button, the row "Delivery" with a line under it, and no hint |
| `shipping` is set, `requiredBoxes` is 0 | The row "Delivery" alone |

The bill decides, not the settings. `shipping.boxBased` of the settings is read for two things only: the delivery promises (below), and whether the placeholder of a loading page holds room for the card.

### The flat fee: the hint on free delivery

`FreeDeliveryProgress` opens the cart's summary. It shows nothing while the shop has no free tier (`delivery.freeFrom` or `delivery.missingForFree` is `null`).

| `delivery.missingForFree` | Sentence | Bar |
| --- | --- | --- |
| Above 0 | "Add **{amount}** more for free delivery", the amount being `missingForFree` | Part of the way; under its ends the value of the goods and "Free from {amount}" |
| 0 | "Delivery is free for this order" | Full, also when a code and not the goods reached it |

### Delivery by the box: the card

`BoxShipping` is a quiet card under "Go to checkout" on the cart page and under "Buy now" at the checkout. A screen reader finds it as the region "Your box" or "Your boxes". Its parts:

1. **The status**: one line that says what the boxes cost.
2. **Two meters** side by side: the room in the box the next goods go into, and the way to the next free box.
3. **The closing line**: how many boxes the order uses, and what the paid ones cost.
4. **"Box by box"**: for an order of several boxes, a fold with every box.

`shippingMessageOf` in `src/features/cart/shipping.ts` picks the case of a bill, in this order:

| Kind | When | Status | Closing line |
| --- | --- | --- | --- |
| `none` | `requiredBoxes` is 0 | No card | – |
| `freeByCode` | `freeByCode`, and the bill names a free-delivery code | "Your order ships free with code {code}" | One box: as `oneBox`. Several: "Your order uses {count} boxes." |
| `free` | `paidBoxes` is 0 | One box: "Your box ships free". Two: "Both boxes ship free". More: "All {count} boxes ship free" | One box: as `oneBox`. Several: "Your order uses {count} boxes, both free." or "… all free." |
| `noThreshold` | A box is paid, and `freeThresholdPerBox` or `missingForNextFreeBox` is `null` | As `oneBox` or `noneFree`, by the count | The same |
| `oneBox` | One box, and it is paid | "Your box ships for {fee}" | "Your order fits in one box: {weight} of {max}." |
| `noneFree` | Several boxes, `freeBoxes` is 0 | "Your {count} boxes ship for {perBox} each" | "Your order uses {count} boxes, {perBox} each." |
| `someFree` | Several boxes, some free and some paid | "Your 1st box ships free", or "Your first {free} boxes ship free" | "Your order uses {count} boxes: {free} free, {paid} chargeable." and then "The 2nd box costs {fee}." for one paid box, or "{paid} boxes cost {perBox} each." |

`{fee}` and `{perBox}` are `feePerPaidBox` (in "The 2nd box costs {fee}." the `fee` and the `number` of that box), `{weight}` is `weight.total`, `{max}` is `box.maxWeight`. An order of one pack that travels alone closes with "Your order ships as a parcel of its own." instead of "… fits in one box …". "Weight is approximate." follows the closing line while `weight.estimated` is `true`.

**The two meters.**

| Meter | Shown | Label | Length | Text under it |
| --- | --- | --- | --- | --- |
| Room | While `currentBox` is set | "Space in your box", or with several boxes "Space in the 2nd box" (the number of `currentBox`) | `currentBox.utilization` percent | "**{room}** available", the room being `currentBox.remaining` rounded down; under 500 g: "**Full.** The next item starts a new box." |
| Next free box | While `shippingProgressOf` gives a length | "Next free box" for several boxes with one paid; otherwise "Free shipping" | `shippingProgressOf` | "**{amount}** to go" with `missingForNextFreeBox`; "Reached" when nothing is paid; "With code {code}" for a free-delivery code |

**"Box by box"** shows for several boxes and for a parcel that travels alone. Its head carries "{weight} in total". Each row: "Box {number}" with a small meter of its `utilization`, or "Separate parcel" without one for a box with `separate`; its `weight`; and "Free" or its `fee`. More than five rows scroll inside the list, which the keyboard reaches. The API lists the first 50 boxes: "… and {count} more" stands under the list when `requiredBoxes` is larger.

### The row "Delivery" in the totals

`BillTotals` prints `totals.deliveryFee`, or "Free" in green when it is 0. Under it, a line:

| Case | Line |
| --- | --- |
| A free-delivery code made the delivery free, one box or the flat fee | "with code {code}" |
| The same, several boxes | "{count} boxes, free with code {code}" |
| Fewer than two boxes, or the flat fee | None |
| Several boxes, none paid | "{count} boxes, all free" |
| Several boxes, none free | "{count} boxes at {perBox} each" |
| Several boxes, some of each | "{count} boxes: {free} free, {paid} chargeable" |

With a free-delivery code under the box rules, what the delivery would have cost (`shipping.regularFee`) stands struck through before "Free".

### A code or coins that cost a free box

A discount code and coins are taken off the goods before the API counts the boxes, so applying one can turn a free box into a paid one. At the checkout, above the totals: "With this discount one box is no longer free. Add {amount} more to get it free again." (or "With these coins …"), the amount being the bill's `missingForNextFreeBox`. The note shows while the code or the coins are on the bill and a box is paid; removing them takes it away. The count of lost boxes is kept in the page, so a reload forgets the note.

### Packs that are too heavy, parcels that travel alone

| Case | What shows | Decided by |
| --- | --- | --- |
| A pack heavier than a box may be, which the shop does not send | The line's issue `too_heavy`: "This item is too heavy to be shipped. Please remove it or contact us."; the cart cannot be ordered; a checkout refused for it names the product with the same sentence | The API |
| A pack that travels as a parcel of its own (`separate`) | "Separate parcel" in the list; no room meter when every pack travels alone (`currentBox` is `null`) | The API |
| A product without an exact weight on record | "Weight is approximate." | The API (`weight.estimated`) |

### The delivery promises before there is a cart

`deliveryPromiseOf` in `src/features/catalogue/delivery-promise.ts` reads two figures from `GET /v1/store/settings`: `freeFrom` (`deliveryFee.freeFrom`) and, only while `shipping.boxBased` is `true`, `boxCapacity` (`shipping.boxCapacity`).

| Place | Flat fee | By the box |
| --- | --- | --- |
| The strip above the header, from `lg` (`src/components/shell/header.tsx`) | "Free delivery from {amount}" | "Free delivery from {amount} per box (up to {weight})" |
| The ticket card of the home page's hero (`src/components/home/delivery-promise-card.tsx`) | The tiles "Delivery" and "Free from" | The same tiles, and under them "Per box of up to {weight}" |
| "Delivery and payment" on the product page (`src/components/catalogue/purchase-info.tsx`) | "Free from {amount}", or without a free tier "Delivery {fee} per order" | "Free from {amount} per box (up to {weight})", or "Delivery {fee} per box (up to {weight})" |

Without `freeFrom` the strip leaves its third promise out. No threshold, weight or fee is written into the shop.

The page "Delivery and payment" (`/en/delivery-and-payment` · `/de/lieferung-und-zahlung`, `src/app/[locale]/(shop)/delivery-and-payment/page.tsx`) lists the fees in full from the same settings: the steps of the flat fee, or, while `shipping.boxBased` is `true` and the box rules are complete, what a box holds, from which value of goods a box is free, and the fee per box by value. That page is described in [help and support](help-and-support.md).

### An order

The order page prints one line of what the order was placed with, from `order.shipping`: "Delivery: 2 boxes, {weight} — 1 free, 1 × {perBox}", or "— free", "— {paid} × {perBox}", "— free with code {code}". An order that paid the flat fee has no such line. The code is in `src/components/account/order-detail.tsx`; the page itself is described in [orders](orders.md).

## Rules

| Case | What happens | Decided by |
| --- | --- | --- |
| Which pricing applies, the boxes, the weights, the fees, the missing amounts | Read from the bill | The API ([box-based-shipping.md](../reference/backend/box-based-shipping.md)) |
| Which sentence a bill gets | `shippingMessageOf` | The browser, from the API's counts |
| The length of the bars | See below | The browser |
| When a box is called full | `isBoxFull`: `currentBox.remaining` under `FULL_BOX_GRAMS`, 500 g. The API sends no "full" flag | The browser |
| Which code is named | `freeDeliveryCodeOf`: `discount.code` while `discount.applied` and `discount.type` is `free_delivery`; otherwise none | The browser, from the bill |
| How many boxes a code or coins cost | `lostFreeBoxes(before, after)`: `max(0, after.paidBoxes − before.paidBoxes)`; 0 when either bill has no `shipping` | The browser, from two bills |
| How a weight is written | `formatWeight`: grams under a kilogram ("850 g"), otherwise kilograms with at most one decimal ("7.5 kg", "7,5 kg" in German). The room in a box is rounded down, so it never says more than there is | The browser |

### The bars, worked

**The next free box** (`shippingProgressOf`):

```
requiredBoxes = 0                         →  no bar
paidBoxes = 0                             →  1 (full)
freeThresholdPerBox is null or 0          →  no bar
otherwise                                 →  (orderValue mod freeThresholdPerBox) ÷ freeThresholdPerBox
```

The meter is drawn at that part, rounded to a whole percent. With the figures of the tests (39.00 € of goods per free box):

| `orderValue` | `freeThresholdPerBox` | `paidBoxes` | Calculation | Meter | The API's `missingForNextFreeBox` |
| --- | --- | --- | --- | --- | --- |
| `1000` | `3900` | 1 | `1000 mod 3900 = 1000`; `1000 ÷ 3900 = 0.256` | 26 % | `2900`: "€29.00 to go" |
| `5900` | `3900` | 1 | `5900 mod 3900 = 2000`; `2000 ÷ 3900 = 0.513` | 51 % | `1900`: "€19.00 to go" |
| `7800` | `3900` | 0 | No box is paid | 100 % | "Reached" |

The amount beside the bar is always the API's; the browser never subtracts it.

**The room in a box**: the meter is `currentBox.utilization` percent, as sent. A box with `remaining` `19900` reads "19.9 kg available"; one with `remaining` `499` reads "Full. The next item starts a new box."

**The flat fee's bar**: `min(100, round((totals.subtotal − totals.discount) ÷ delivery.freeFrom × 100))` percent, and 100 when `missingForFree` is 0. With `freeFrom` `5000` and goods of `3250`: 65 %.

**Lost boxes**: goods of 78.00 € free two boxes, so `paidBoxes` is 0; after a code of 10 % the API answers `paidBoxes` 1. `lostFreeBoxes` gives `1 − 0 = 1`, and the note speaks of one box.

## Data and API

| Figure | From |
| --- | --- |
| The card, the row "Delivery", the hint | The bill: `GET /v1/store/cart` for a customer, `POST /v1/store/cart/preview` for a visitor, and the answer of every change, code and coin |
| The promises | `GET /v1/store/settings`, read on the server with the page |
| The line of an order | `shipping` of the order |

Nothing about delivery is sent by the shop: the order is placed with `expectedTotal`, and a bill that changed with the rules is refused with `409 ORDER_TOTAL_CHANGED` and shown again ([checkout](checkout.md)). The mock API runs a copy of the rules and switches them with `POST /__mock/shipping` ([mock API](../development/mock-api.md)).

## Behaviour

- **Layout.** The two meters stand side by side; one alone takes the width. The list of boxes is a grid, so numbers, weights and fees stand under each other.
- **While a change is on its way** the card dims with the totals and keeps the last figures.
- **Screen reader.** The bars are decoration (`aria-hidden`); the text under each says the same in numbers. The struck-through fee is announced as "Regular delivery fee".
- **Motion.** The bars run to their length; the fold of the boxes glides ([motion](../design-system/motion.md)).
- **Texts.** The `shipping` namespace travels with the cart page, the checkout and the account only (`src/i18n/client-messages.ts`).

## Not built

| Not in the shop | Note |
| --- | --- |
| Working out a fee, a weight or a count of boxes in the browser | The API's, always |
| The hint for a cheaper box ("Add … more and delivery drops to … per box") | The backend's document offers it as an option |
| A toast after adding a product ("… more and your box ships free") | The same |
| The boxes in the slim cart bar on phones | The bar shows the count and the total |
| A choice of carrier, delivery date or pick-up | – |
| Delivery outside Germany | Addresses are German; the text for `DELIVERY_COUNTRY_NOT_SERVED` exists for an API that answers it |
| The weight of a line in the cart | `lines[].weight` is in the bill and not printed |

## Code map

| File | What it is |
| --- | --- |
| `src/features/cart/shipping.ts` | `shippingMessageOf`, `shippingProgressOf`, `FULL_BOX_GRAMS`, `isBoxFull`, `freeDeliveryCodeOf`, `lostFreeBoxes` |
| `src/components/cart/box-shipping.tsx` | `BoxShipping`: the card, its meters and the list of boxes |
| `src/components/cart/bill-summary.tsx` | `BillTotals` (the row "Delivery" and its line) and `FreeDeliveryProgress` |
| `src/components/checkout/checkout-view.tsx` | The notes on a lost free box |
| `src/features/catalogue/delivery-promise.ts` | `deliveryPromiseOf` |
| `src/components/shell/header.tsx` | The strip of promises |
| `src/components/home/delivery-promise-card.tsx` | The ticket card of the home page |
| `src/components/catalogue/purchase-info.tsx` | "Delivery and payment" on the product page |
| `src/components/account/order-detail.tsx` | The line of boxes on an order |
| `src/lib/format/weight.ts` | `formatWeight` |
| `src/i18n/shipping-messages.test.ts` | Every text of the `shipping` namespace in both languages, with plurals and ordinals |
| `mocks/shipping.ts` | The mock's copy of the rules |
