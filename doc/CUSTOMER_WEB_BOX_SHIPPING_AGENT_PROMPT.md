# Prompt for the retail web agent: box-based shipping

Copy everything below the line into the agent that works on the shop (`radhe-web`, radhefoods.de).

---

You are working on the Radhe Foods shop (`radhe-web`, Next.js). The API has a new way to price delivery: **by the boxes an order needs, with one free box every time the goods reach a threshold** (for example: every 39 € of goods make the delivery of one box of up to 25 kg free; every other box costs 4.99 €). The bill of a cart now says how many boxes an order needs, how full they are, which are free, what the others cost and how much is missing for the next free box. Show that in the cart and at checkout.

**Read first:** `doc/BOX_BASED_SHIPPING_WEB_INTEGRATION.md` in the `radhe-api` repository (the sibling folder `../radhe-api`), all of it. It has every field with a real answer, the messages in English and German with their conditions, the error cases and ten scenarios to test. This prompt is the summary; where they differ, the document is right. If you cannot read that repository, ask for the file. All calls are ones the shop already makes; only their answers have new fields.

**Do not change the theme, colours, fonts, typography or any unrelated functionality.** Reuse the existing bill (`src/components/cart/bill-summary.tsx`), the delivery hints (`src/components/home/delivery-promise-card.tsx`, `src/components/catalogue/purchase-info.tsx`, the header), the price formatting and the message catalogues in `src/i18n`.

## The three rules

1. **The server calculates, the shop displays.** Never count boxes, add weights or work out a fee in the browser, and never write a threshold, a weight or a fee into the code. Every number comes from the API.
2. **The feature can be off.** Then `shipping` of every bill is `null` and the shop must look exactly as it does today. Render the new parts only when `shipping` is not `null`.
3. **Amounts are whole cents, weights whole grams.** Format for display only.

## What the API sends

- **`GET /v1/store/settings`** → `shipping { boxBased, countries, freeThresholdPerBox, maxBoxWeight, boxCapacity, feeTiers }`. With `boxBased: true`, `deliveryFee` states the same rules for an order of one box, so today's "free delivery from …" keeps working; say "per box (up to … kg)" there.
- **Every bill** (`GET /v1/store/cart`, `POST /v1/store/cart/preview`, the cart item calls, the checkout discount and rewards calls) → a new `shipping`:
  - `orderValue`: the goods after a code and coins, the figure the thresholds look at
  - `requiredBoxes`, `freeBoxes`, `paidBoxes`, `unlockedFreeBoxes`
  - `freeThresholdPerBox`, `missingForNextFreeBox`, `missingForFreeDelivery`
  - `feePerPaidBox`, `fee` (the same as `totals.deliveryFee`), `regularFee`, `freeByCode`
  - `weight { goods, packaging, total, estimated }`, `box { maxWeight, tareWeight, capacity }`
  - `boxes[] { number, weight, remaining, utilization, free, fee, separate, overweight }`
  - `currentBox { number, weight, remaining, utilization }`: the box the next goods go into
  - and on every line `weight { unit, total, estimated }`
- `delivery { fee, freeFrom, missingForFree }` stays and stays right.
- **Orders** (`GET /v1/store/orders/{orderNumber}`, the answers of both checkouts) → `shipping` with the boxes the order was placed with, or `null`.

## What to build

1. **Types.** Add the new fields to `src/lib/api/types.ts`: `shipping` on the bill, the settings and the order; `weight` on a cart line; the line issue `too_heavy`; the discount type `free_delivery`.
2. **Free-delivery progress** (cart page, cart drawer, checkout summary): one message and one bar from `shipping`. The message table of section 5 of the document has eight cases with their conditions, in both languages. Examples: "Add 19.00 € more and box 2 ships free too." / "Great, all 2 boxes ship free!"
3. **Box capacity:** how full the boxes are, from `boxes[].utilization` and `currentBox.remaining`: "7.5 kg of room left in your box." One bar for one box, a small bar per box for several, "Separate parcel" for `separate: true`.
4. **Summary:** the delivery row as today from `totals.deliveryFee`; with several boxes a second line, "2 boxes: 1 free, 1 paid".
5. **Discount codes and coins** are taken off the goods before the boxes are counted, so a discount can cost a free box: show the new delivery line clearly when a code or coins are applied. A code of the new type `free_delivery` takes nothing off the goods (`amount: 0`): **show no "Discount −0.00 €" row**; show "Delivery ~~4.99 €~~ free with code FREESHIP" from `shipping.regularFee` instead.
6. **Checkout errors:** `409 ORDER_TOTAL_CHANGED` and `409 ORDER_ITEMS_NOT_ORDERABLE` are handled today; add the line issue `too_heavy` to the texts. New: `409 DELIVERY_COUNTRY_NOT_SERVED` ("We do not deliver to this country yet."). An unknown code must fall back to a general message.
7. **Order page and confirmation:** one line from the order's `shipping`, "Delivery: 2 boxes, 41.1 kg — 1 free, 1 × 4.99 €". Nothing for `shipping: null`.
8. **Banners and product pages:** every "free delivery from …" reads `GET /v1/store/settings`.

## Details

- Replace the whole bill with the answer of every cart call; do not patch single numbers. Ignore an answer that is older than the latest request, so the bar does not jump back.
- Texts in English and German through the message catalogues, with proper plurals ("1 box" / "2 boxes", "1 Box" / "2 Boxen") and the shop's own form of address in German.
- Kilograms with at most one decimal, in the number format of the page's language; below a kilogram show grams.
- Loading: placeholders of the final size; while a change is sent, dim the summary and keep the last bill.

## How to work

Write your plan first (components, where each existing file changes, states, the texts in both languages) and wait for my go before coding. Then implement, run the shop's lint and type checks, test the ten scenarios of section 12 of the document with the feature on and once with it off, and report what you built, what you left out and anything in the document that did not match the API.
