# Box-based shipping and free delivery per box

Since 2026-11-20 the API can price the delivery of an order by the boxes it needs. This is the technical document: the rule, the formulas, what is stored, the defaults, what stays compatible and what was tested. The two guides for the frontends are `BOX_BASED_SHIPPING_ADMIN_INTEGRATION.md` (admin panel) and `BOX_BASED_SHIPPING_WEB_INTEGRATION.md` (retail website).

**It is switched off until an admin switches it on.** While it is off, the shop charges the flat delivery fee (`deliveryFee` tiers) exactly as before, and nothing new is stored with an order.

## 1. The rule

> Every time the goods reach the free-delivery threshold again, the delivery of one more box is free. A box holds a limited weight. Boxes the order needs beyond the free ones cost a fee each.

With the owner's first settings (39 euros per free box, 25 kg per box, 6.99 euros per paid box up to 20 euros of goods and 4.99 euros above):

| Goods | Weight | Boxes needed | Free | Paid | Delivery |
| ----: | -----: | -----------: | ---: | ---: | -------: |
|  20 € |  10 kg |            1 |    0 |    1 |   6.99 € |
|  30 € |  20 kg |            1 |    0 |    1 |   4.99 € |
|  39 € |  20 kg |            1 |    1 |    0 |   0.00 € |
|  39 € |  30 kg |            2 |    1 |    1 |   4.99 € |
|  58 € |  30 kg |            2 |    1 |    1 |   4.99 € |
|  59 € |  40 kg |            2 |    1 |    1 |   4.99 € |
|  62 € |  45 kg |            2 |    1 |    1 |   4.99 € |
|  78 € |  45 kg |            2 |    2 |    0 |   0.00 € |
| 100 € |  60 kg |            3 |    2 |    1 |   4.99 € |
| 117 € |  60 kg |            3 |    3 |    0 |   0.00 € |

Every row of this table is a unit test (`shipping-rules.spec.ts`), and the 59 € → 78 € example runs through the real cart in `test/shipping.e2e-spec.ts`.

## 2. The formulas

All amounts are whole cents with VAT included, all weights whole grams. Nothing is a floating-point amount, so nothing is rounded.

```text
orderValue        = goods after the discount code and after redeemed coins,
                    VAT included, without the delivery   (of the lines that can be ordered)

requiredBoxes     = boxes the packs need                  (section 4)
unlockedFreeBoxes = floor(orderValue / freeThresholdPerBox)
freeBoxes         = min(requiredBoxes, unlockedFreeBoxes)
paidBoxes         = requiredBoxes - freeBoxes
feePerPaidBox     = fee of the first tier with orderValue <= upTo   (the last tier has no limit)
deliveryFee       = paidBoxes x feePerPaidBox

missingForNextFreeBox  = freeThresholdPerBox x (unlockedFreeBoxes + 1) - orderValue
missingForFreeDelivery = max(0, freeThresholdPerBox x requiredBoxes - orderValue)
```

- `orderValue` is the same figure the flat fee used to look at: what is really paid for the goods. A discount code or coins lower it, and can cost a free box.
- A fee tier includes its upper value: with `upTo: 2000`, goods of exactly 20.00 euros pay that tier, 20.01 euros the next.
- All paid boxes of an order cost the same: the fee depends on the value of the goods, not on the box.
- With a free-delivery discount code (section 6) every box is free: `freeBoxes = requiredBoxes`, `deliveryFee = 0`, and `regularFee` says what the delivery would have cost.
- `freeThresholdPerBox: null` means no box is ever free by value.

The code is `src/modules/shipping/shipping-rules.ts`: pure functions without a database, used by the cart, the checkout and the admin's calculator alike.

## 3. The weight of a pack

Every pack size (SKU) can have a **shipping weight** in grams: what one pack weighs as it is shipped, its own packaging included (`variants[].shippingWeight`, for example 5100 for a 5 kg bag of rice). It is set in the panel, in bulk, or through the catalogue spreadsheet.

A pack size **without** a shipping weight is not refused and not counted as weightless. Its weight is **estimated**, and every answer says so (`estimated: true`):

| Pack size stated in | Estimated weight                                                             |
| ------------------- | ---------------------------------------------------------------------------- |
| g, kg               | the stated quantity plus `estimate.packagingPercent`, rounded up to the gram |
| ml, l               | one gram per millilitre, plus `estimate.packagingPercent`, rounded up        |
| pieces              | `estimate.defaultWeight` per pack, whatever the count of pieces              |

With the defaults (5 % and 500 g): 1 kg → 1050 g, 5 kg → 5250 g, 250 ml → 263 g, a pack of 20 pieces → 500 g. The estimate leans to the heavy side on purpose, so that a missing weight does not undercharge the delivery. On 2026-11-20 the catalogue had 4,792 pack sizes, 4,733 of them stated in g, kg, ml or l and 59 in pieces; none had a shipping weight yet.

A stored weight that cannot be one (zero, negative, not a number, above a tonne) is not believed: the estimate stands in. The API refuses such values on every way in (`400`), so this only guards against a direct edit of the database.

## 4. The boxes

A box holds `maxBoxWeight - boxTareWeight` grams of goods. `boxTareWeight` is the empty carton with its filling; it is 0 until the admin sets it.

**Packs are never divided.** Three packs of 13 kg need three boxes of 25 kg, although together they weigh 39 kg, which "39 / 25" would call two. The count of boxes is therefore not `total weight / capacity`, but the result of really packing the packs:

- The heaviest packs go first, each into the first box that still has room for it ("first fit decreasing").
- The result is always a packing that can be done, so it never counts **fewer** boxes than are physically needed: the delivery is not undercharged.
- For groceries, with many small packs that fill the gaps, it is the best possible packing nearly always. A rare mix of awkward sizes can come out one box above the best possible packing. In a test with 30,000 packs of three awkward weights the result was within 0.5 % of the count the weight alone would call for.
- It is deterministic: the same cart always gives the same boxes, on the cart page, at checkout and in the calculator.
- Volume is not looked at, only weight. For a bulky or fragile pack there is the mark below.

Two kinds of packs get a parcel of their own and share no box:

1. **Marked by the admin** (`variants[].shipsSeparately: true`): every pack travels alone, a sack that is shipped as it is, for example.
2. **Too heavy for a box with others**: a pack heavier than what a box holds.

A parcel that travels alone counts as one box in every formula: it can be one of the free ones, or costs the fee of a paid box. It has no carton, so the tare weight is not added to it.

**A pack heavier than a box may be at all** (`> maxBoxWeight`) is flagged `overweight`. What happens to it is the admin's choice (`overweight`):

- `own_parcel` (default): it is sent as a parcel of its own and counts as one box.
- `not_orderable`: its line of the cart gets the issue `too_heavy`, the cart cannot be ordered until it is removed, and checkout answers `409 ORDER_ITEMS_NOT_ORDERABLE`.

Either way it is never packed into a box it does not fit. The admin's list of weights can show these pack sizes (`state=overweight`).

The first 50 boxes of an order are listed one by one; the counts (`requiredBoxes`, `freeBoxes`, `paidBoxes`) and the fee always cover all of them.

## 5. The settings

One setting, `shipping`, stored like every other business rule (collection `settings`, key `shipping`). Nothing of the rule is in the code but the defaults below, which apply until the admin saves the setting.

| Field                       | Default                                                | Meaning                                                                           |
| --------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `enabled`                   | `false`                                                | Box-based shipping on or off. Off: the flat `deliveryFee` tiers are charged.      |
| `freeThresholdPerBox`       | `3900`                                                 | Cents of goods per free box. `null`: never free by value.                         |
| `maxBoxWeight`              | `25000`                                                | Grams one box may weigh.                                                          |
| `boxTareWeight`             | `0`                                                    | Grams of the empty box. Must be below `maxBoxWeight`.                             |
| `feeTiers`                  | `[{ upTo: 2000, fee: 699 }, { upTo: null, fee: 499 }]` | Fee of one paid box by the value of the goods. Exactly one tier has `upTo: null`. |
| `countries`                 | `["DE"]`                                               | Where orders are delivered. Checked when an order is placed.                      |
| `estimate.packagingPercent` | `5`                                                    | Percent added to a pack size without a shipping weight.                           |
| `estimate.defaultWeight`    | `500`                                                  | Grams of a pack sold by the piece without a shipping weight.                      |
| `overweight`                | `own_parcel`                                           | What happens to a pack heavier than a box may be.                                 |

Validation (`PUT /v1/admin/settings/shipping`, `400 VALIDATION_FAILED`): whole numbers in range; 1 to 10 tiers; exactly one tier without an upper limit and no two tiers ending at the same value, so the tiers can neither leave a gap nor overlap; the empty box lighter than a full one; countries from the list the shop can deliver to.

**Delivery countries.** The list can only hold Germany today. That is deliberate: delivering to another country needs more than a setting (the VAT rules for cross-border sales to consumers, address formats, carrier prices per country). The setting, its check at checkout (`409 DELIVERY_COUNTRY_NOT_SERVED`) and the field in the shop's settings are in place, so a second country is a change in one list once those points are solved.

## 6. Free-delivery discount codes

Discount codes have a third type: **`free_delivery`**. Such a code takes nothing off the goods (`value` is 0, `amount` is 0) and makes the delivery of the order free, whatever it weighs. Everything else a code can do applies unchanged: a period, a limit of uses, once per customer, a minimum order value, the reserve / count / release of uses.

- Under the box rules every box is free; the bill says `freeByCode: true` and `regularFee` (what the delivery would have cost).
- Under the flat fee the delivery fee is 0.
- The code counts as "a discount code" for the coins rule `combinableWithDiscountCodes`.
- A code cannot be both: a percentage off **and** free delivery needs two codes, and an order takes one.

There is no automatic free-delivery period without a code, and no product that is excluded from the free-delivery value. Both are noted in section 11.

## 7. What changed in the API

**Admin**

| Call                                       | Change                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| `GET /v1/admin/settings`                   | new key `shipping`                                                                |
| `PUT /v1/admin/settings/shipping`          | new: the rules (`settings.manage`)                                                |
| `GET /v1/admin/shipping/weights`           | new: every pack size with its weight (`catalog.read`)                             |
| `PUT /v1/admin/shipping/weights`           | new: set the weight of up to 500 pack sizes (`catalog.manage`)                    |
| `POST /v1/admin/shipping/preview`          | new: the calculator (`settings.read`)                                             |
| products: create, add / change a pack size | new fields `shippingWeight`, `shipsSeparately`; the pack size answers them        |
| catalogue import and export                | new columns `shipping_weight_kg`, `ships_separately`                              |
| discount codes                             | new type `free_delivery`; `value` may be 0 for it                                 |
| `GET /v1/admin/orders/{id}`                | new `shipping` (boxes, rules) and `items[].unitWeight`, `items[].weightEstimated` |

**Shop**

| Call                                                                             | Change                                                                                |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `GET /v1/store/settings`                                                         | new `shipping`; under the box rules `deliveryFee` states them for an order of one box |
| every answer that is a bill (cart, preview, checkout discount, checkout rewards) | new `shipping` and `lines[].weight`; line issue `too_heavy`                           |
| `POST /v1/store/checkout`, `POST /v1/store/guest/checkout`                       | new refusal `409 DELIVERY_COUNTRY_NOT_SERVED`                                         |
| orders of the customer                                                           | new `shipping`, `items[].unitWeight`, `items[].weightEstimated`                       |

No new permission. No existing field was removed, renamed or changed in meaning.

## 8. What is stored

All additions are optional fields; no existing document has to be changed and no migration or new index is needed.

**`products.variants[]`**

| Field             | Type    | Meaning                                              |
| ----------------- | ------- | ---------------------------------------------------- |
| `shippingWeight`  | Number  | Grams of one pack as shipped. Absent: estimated.     |
| `shipsSeparately` | Boolean | Present and true: every pack is a parcel of its own. |

**`orders`** (only on orders placed while box-based shipping was on)

| Field                     | Meaning                                                                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items[].unitWeight`      | Grams of one pack when the order was placed.                                                                                                                                                          |
| `items[].weightEstimated` | Whether that weight was an estimate.                                                                                                                                                                  |
| `shipping.rules`          | The rules the fee was calculated with: `freeThresholdPerBox`, `maxBoxWeight`, `boxTareWeight`, `feeTiers`, `packagingPercent`, `defaultWeight`, `overweight`.                                         |
| `shipping.*`              | `orderValue`, `goodsWeight`, `packagingWeight`, `totalWeight`, `weightEstimated`, `requiredBoxes`, `unlockedFreeBoxes`, `freeBoxes`, `paidBoxes`, `feePerPaidBox`, `regularFee`, `fee`, `freeByCode`. |
| `shipping.boxes[]`        | The first 50 boxes: `number`, `weight`, `separate`, `overweight`, `free`, `fee`.                                                                                                                      |

`totals.deliveryFee` stays the fee the customer was charged; `shipping.fee` repeats it.

**`discountCodes.type`** and **`orders.discount.type`** can be `free_delivery`.

**`settings`**: a new document with the key `shipping`, written the first time the admin saves the rules.

## 9. How it fits the rest

- **One calculation.** The cart page, the preview for visitors, the checkout and the guest checkout call the same quote. The order is created from that quote on the server; nothing a browser sends about weights, boxes or fees is read.
- **The customer agrees to a total.** Checkout takes `expectedTotal`. If the bill is another one by then (the rules changed, a weight changed, the cart changed), the order is refused with `409 ORDER_TOTAL_CHANGED` and the new bill, as before.
- **Stripe** is asked for `totals.total` of the order, delivery included. The payment page is created from the order, never from the cart, so a change of the cart or of the rules after the order was placed cannot change what is charged.
- **Snapshots.** The order keeps the fee, the boxes, the weights and the rules. A later change of the settings or of a weight counts for carts and new orders only. Tested: an order placed under 39 € / 25 kg stays as it was after the rules were set to 99 € / 30 kg and its product got another weight.
- **Idempotency.** The same `Idempotency-Key` answers the first order, also when it arrives twice at the same moment and also when the rules changed in between. Webhook events of Stripe act on the stored order and never calculate shipping again.
- **VAT.** Unchanged: the delivery fee is shared among the VAT rates of the goods in proportion to their net value (`shareDeliveryFee`), so delivery is taxed like the goods it belongs to. Invoices and credit notes take the fee from the order as before.
- **Corrections, returns, cancellation.** Unchanged rules of `order-final.ts`: the delivery fee that was agreed stays whatever the goods are worth after a correction or a partial return; only when nothing is kept (everything returned, or the order cancelled) there is no fee and the customer gets it back. The boxes of the order are not counted again after a correction.
- **Profit of an order (Model B).** The calculation in `order-profit.ts` is untouched. _Delivery revenue_ is the delivery fee the customer paid, without its VAT: 0 for a free delivery. _Delivery cost_ is the shop's own cost, copied into the order when it is placed. One thing is new there: **under the box rules the delivery cost and the packaging cost of the settings count per box**, because every box is a parcel to pay for and a carton to fill. An order of two boxes with `deliveryCost` 6.50 € is recorded with a delivery cost of 13.00 €, also when the customer paid nothing for the delivery. `otherCost` stays per order. Under the flat fee both count once per order, as before.
- **Discount codes and coins** are taken off the goods first; the box rules look at what is left. A 10 % code on 78 € of goods leaves 70.20 €, which unlocks one box instead of two.
- **Emails and invoices** show the delivery fee of the order as before.
- **Analytics** sums `totals.deliveryFee` as before.

## 10. Tests

Run on 2026-11-20: `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (unit) and the end-to-end suite on an in-memory MongoDB with a fake Stripe.

**Unit, `src/modules/shipping/shipping-rules.spec.ts` (43 tests):** the weight of a pack (on record, estimated for g / kg / ml / l, default for pieces, settings of the estimate, weights that cannot be); packing (empty cart, filling a box before the next, packs that cannot share a box, light packs filling the gaps of heavy ones, tare weight, marked parcels, overweight parcels, 30,000 packs within a second); fee tiers (both sides of the 20 € boundary, tiers in any order, gaps and overlaps refused, the single-box view for the shop); the ten rows of the owner's table; one more free box at every threshold; never more free boxes than needed; two paid boxes; the 59 € and 78 € orders; weights and room per box; changed settings (49 € / 30 kg / one fee); no threshold; a free-delivery code; a parcel that travels alone; an empty cart; an order of 80 boxes.

**End to end, `test/shipping.e2e-spec.ts` (41 tests):** defaults and "off means as before" (cart, shop settings, a paid order without any shipping record); validation and permissions of the rules; the calculator; the weight on a pack size (set, refused values, removed), the list with filters and counts, the bulk update (all or none, refused values, the product's `updatedAt` untouched), permissions, the spreadsheet round trip, the copy of a product; the cart at 10 €, 20 €, 25 €, 39 €, 39.50 € in two boxes, 59 € → 78 € → back, a visitor's preview, goods at two VAT rates; a percentage code that costs a free box; a free-delivery code; the value rules of the code types; coins that cost a free box; an order with its snapshot, the amount sent to Stripe, the costs per box and the profit figures; a free order that earns no delivery revenue and still costs two parcels; an order under a free-delivery code; rules and weights changed after the order; `ORDER_TOTAL_CHANGED`; one order for one key sent three times; two customers at the same moment; a partial return that keeps the fee; a cancellation that gives it back; overweight packs as parcels, as not orderable, marked parcels, tare weight; the delivery country; switched off again with a free-delivery code under the flat fee.

**Existing tests:** all unit tests and all end-to-end tests of the project pass. Two existing end-to-end tests compare a whole answer field by field and were given the new fields (`shipping`, `weight`); no existing expectation about a value had to change.

## 11. Limits and open decisions

1. **Weights are estimates until they are entered.** The estimate is on the safe side, but only real shipping weights make the box count exact. The list `GET /v1/admin/shipping/weights?state=missing` is the to-do list.
2. **Weight only, no volume.** A light and bulky pack fills more of a box than its weight says. `shipsSeparately` covers single packs; a full volume model would need the dimensions of every pack and of the box.
3. **Calculated boxes, not shipped boxes.** The order records the boxes the calculation found. If the packer uses another number of parcels, the delivery cost in the profit of that order is not corrected. A field "parcels actually shipped" on the order would close this.
4. **Delivery cost per box** (section 9) is my reading of "the actual shipping expense". If the owner's `deliveryCost` is meant per order whatever the boxes, it is one line to change.
5. **Free delivery by promotion** exists as a discount code. Not built: free delivery for everybody in a period without a code, a free-delivery code limited to a number of boxes, products that do not count towards the free-delivery value, products that never ship free.
6. **Other delivery countries** need the work named in section 5.
7. **No limit on the size of an order.** A cart of 40 boxes is priced correctly and can be ordered. A maximum of boxes per online order would be a small addition if wanted.
8. **The frontends.** Until the website shows the boxes, a customer whose cart needs a second box sees a correct total and a correct delivery fee, but no explanation of it. The website should be updated before the rules are switched on.

## 12. Switching it on

1. Deploy the API. Nothing changes: the rules are off.
2. Enter shipping weights, at least for the heavy pack sizes (panel or spreadsheet).
3. Update the admin panel (settings page, weights) and the website (cart and checkout).
4. Set the rules and try them in the calculator.
5. Set `enabled: true`. Carts are priced by the box from the next request; orders placed before keep their fee.
6. To go back, set `enabled: false`: the flat tiers are charged again at once, and the rules stay saved.

## 13. Files

| File                                                | What                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| `src/modules/shipping/shipping-rules.ts` (+ spec)   | weights, packing, tiers, the delivery of an order: pure functions   |
| `src/modules/shipping/shipping.service.ts`          | the admin's list of weights, the bulk update, the calculator        |
| `src/modules/shipping/admin-shipping.controller.ts` | `/v1/admin/shipping/...`                                            |
| `src/modules/shipping/dto/shipping.dto.ts`          | requests of those                                                   |
| `src/modules/shipping/shipping.module.ts`           | the module, registered in `app.module.ts`                           |
| `src/modules/settings/settings.ts`                  | `ShippingSettings`, the defaults, `shippingSettingsOf`              |
| `src/modules/settings/dto/shipping-settings.dto.ts` | the request of the rules                                            |
| `src/modules/settings/shipping-settings.ts`         | the rules checked as a whole                                        |
| `src/modules/settings/settings.controller.ts`       | `PUT /admin/settings/shipping`, `shipping` in both settings answers |
| `src/modules/cart/quote.service.ts`                 | the fee by the box, weights per line, the issue `too_heavy`         |
| `src/modules/cart/cart-view.service.ts`             | `shipping` and `lines[].weight` in the bill                         |
| `src/modules/orders/order.schema.ts`                | `shipping`, `items[].unitWeight`, `items[].weightEstimated`         |
| `src/modules/orders/orders.service.ts`              | the snapshot, the costs per box, the delivery country               |
| `src/modules/orders/order-view.service.ts`          | `shipping` in the order answers                                     |
| `src/modules/catalog/products/*`                    | `shippingWeight`, `shipsSeparately` on a pack size                  |
| `src/modules/catalog/import-export/*`               | the two spreadsheet columns                                         |
| `src/modules/discounts/*`                           | the code type `free_delivery`                                       |
| `src/common/errors/error-codes.ts`                  | `DELIVERY_COUNTRY_NOT_SERVED`                                       |
| `test/shipping.e2e-spec.ts`                         | the end-to-end tests                                                |
