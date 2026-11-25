# Box-based shipping: integration guide for the retail website

For the agent and the developers of `radhe-web`. The API can price the delivery of an order by the boxes it needs, with one free box every time the goods reach a threshold. The bill of a cart says everything the website needs to show it: the weight, the boxes, how full they are, which are free, what the others cost and how much is missing for the next free box. This guide has the fields, real answers, and texts in English and German.

The rule, the formulas and the limits are in `BOX_BASED_SHIPPING.md`. `CUSTOMER_WEB_API_DOCUMENTATION.md` is the reference of every call.

## 1. What the feature does

> Every time the goods of an order reach the free-delivery threshold again, the delivery of one more box is free. A box holds a limited weight. Every box beyond the free ones costs a fee.

With 39 € per free box, 25 kg per box and 4.99 € per paid box:

| Goods | Weight | Boxes | Free | Paid | Delivery |
| ----: | -----: | ----: | ---: | ---: | -------: |
|  20 € |  10 kg |     1 |    0 |    1 |   6.99 € |
|  30 € |  20 kg |     1 |    0 |    1 |   4.99 € |
|  39 € |  20 kg |     1 |    1 |    0 |   0.00 € |
|  59 € |  40 kg |     2 |    1 |    1 |   4.99 € |
|  78 € |  45 kg |     2 |    2 |    0 |   0.00 € |
| 100 € |  60 kg |     3 |    2 |    1 |   4.99 € |

All of these numbers are settings of the admin. **Never write a threshold, a weight or a fee into the website:** read them from the API.

**The feature can be off.** Then the shop charges the flat delivery fee as today, `shipping` of every bill is `null`, and the website must look exactly as it does now. Build the new parts so that they appear only when the API sends the data.

## 2. Rules for the website

1. **The server calculates. The website displays.** Do not count boxes, add weights or work out a fee in the browser. Every figure is in the bill.
2. **The bill is replaced as a whole.** Every call that changes the cart answers the full bill. Put that answer on the screen; do not patch single numbers.
3. **Amounts are whole cents with VAT included, weights whole grams.** Format them for display only: `Intl.NumberFormat` with the page's locale, euros with two decimals, kilograms with at most one decimal (`7.5 kg`, `7,5 kg`).
4. **Texts are the website's**, in English and German. The API sends numbers and flags, never sentences.
5. **`shipping === null` means the flat fee.** Keep today's display for that case.

## 3. The calls

| Call                                                 | For                                            | Answers                |
| ---------------------------------------------------- | ---------------------------------------------- | ---------------------- |
| `GET /v1/store/settings`                             | banners, product pages, "free delivery from …" | the rules, section 3.1 |
| `POST /v1/store/cart/preview`                        | the cart of a visitor                          | a bill                 |
| `GET /v1/store/cart`                                 | the cart of a customer                         | a bill                 |
| `PUT` / `DELETE /v1/store/cart/items/{variantId}`    | changing the cart                              | a bill                 |
| `POST /v1/store/cart/merge`, `DELETE /v1/store/cart` | taking over and emptying the cart              | a bill                 |
| `PUT` / `DELETE /v1/store/checkout/discount`         | a discount code                                | a bill                 |
| `PUT` / `DELETE /v1/store/checkout/rewards`          | loyalty coins                                  | a bill                 |
| `POST /v1/store/checkout`                            | placing the order                              | the order              |
| `POST /v1/store/guest/checkout`                      | placing the order as a guest                   | the order              |
| `GET /v1/store/orders/{orderNumber}`                 | the order page                                 | the order              |

No call is new. The answers have new fields.

### 3.1 The rules of the shop

`GET /v1/store/settings`, with box-based shipping on:

```json
{
  "currency": "EUR",
  "timezone": "Europe/Berlin",
  "deliveryFee": {
    "tiers": [
      { "minOrderValue": 0, "fee": 699 },
      { "minOrderValue": 2001, "fee": 499 },
      { "minOrderValue": 3900, "fee": 0 }
    ],
    "freeFrom": 3900
  },
  "shipping": {
    "boxBased": true,
    "countries": ["DE"],
    "freeThresholdPerBox": 3900,
    "maxBoxWeight": 25000,
    "boxCapacity": 25000,
    "feeTiers": [
      { "upTo": 2000, "fee": 699 },
      { "upTo": null, "fee": 499 }
    ]
  },
  "delivery": {
    "estimate": { "en": "2 to 4 working days", "de": "2 bis 4 Werktage" }
  },
  "returns": { "windowDays": 14, "issueWindowDays": 14 }
}
```

| Field                          | Meaning                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `shipping.boxBased`            | `true`: delivery is priced by the box. `false`: the flat fee; the four fields below are `null`.               |
| `shipping.countries`           | where the shop delivers                                                                                       |
| `shipping.freeThresholdPerBox` | cents of goods per free box; `null`: no box is free by value                                                  |
| `shipping.maxBoxWeight`        | grams one box may weigh                                                                                       |
| `shipping.boxCapacity`         | grams of goods one box holds (the box itself taken off)                                                       |
| `shipping.feeTiers`            | what one paid box costs: `upTo` is the highest value of goods of the tier, included; the last tier has `null` |
| `deliveryFee`                  | under the box rules: the same rules for an order of **one** box, in the form the website already reads        |

`deliveryFee.freeFrom` keeps working for a line like "Free delivery from 39 €". Under the box rules, say what it is: "Free delivery from 39 € per box (up to 25 kg)". With `boxBased: false` the answer is as it always was, plus `shipping` with `boxBased: false`.

## 4. The bill of a cart

Every bill has a new key `shipping` and every line a new key `weight`. Both are `null` while the flat fee is charged.

A cart of 39.50 € that needs two boxes (`GET /v1/store/cart`, shortened to what is new):

```json
{
  "canOrder": true,
  "lines": [
    {
      "variantId": "6740a2…",
      "quantity": 1,
      "unitPrice": 2950,
      "lineTotal": 2950,
      "weight": { "unit": 20000, "total": 20000, "estimated": false },
      "issue": null
    },
    {
      "variantId": "6740c2…",
      "quantity": 1,
      "unitPrice": 1000,
      "lineTotal": 1000,
      "weight": { "unit": 5100, "total": 5100, "estimated": false },
      "issue": null
    }
  ],
  "totals": {
    "currency": "EUR",
    "subtotal": 3950,
    "discount": 0,
    "rewards": 0,
    "deliveryFee": 499,
    "total": 4449
  },
  "delivery": { "fee": 499, "freeFrom": 7800, "missingForFree": 3850 },
  "shipping": {
    "orderValue": 3950,
    "weight": {
      "goods": 25100,
      "packaging": 0,
      "total": 25100,
      "estimated": false
    },
    "box": { "maxWeight": 25000, "tareWeight": 0, "capacity": 25000 },
    "boxes": [
      {
        "number": 1,
        "weight": 20000,
        "remaining": 5000,
        "utilization": 80,
        "separate": false,
        "overweight": false,
        "free": true,
        "fee": 0
      },
      {
        "number": 2,
        "weight": 5100,
        "remaining": 19900,
        "utilization": 20,
        "separate": false,
        "overweight": false,
        "free": false,
        "fee": 499
      }
    ],
    "requiredBoxes": 2,
    "unlockedFreeBoxes": 1,
    "freeBoxes": 1,
    "paidBoxes": 1,
    "freeThresholdPerBox": 3900,
    "missingForNextFreeBox": 3850,
    "missingForFreeDelivery": 3850,
    "feePerPaidBox": 499,
    "regularFee": 499,
    "fee": 499,
    "freeByCode": false,
    "currentBox": {
      "number": 2,
      "weight": 5100,
      "remaining": 19900,
      "utilization": 20
    }
  },
  "discount": null,
  "rewards": null
}
```

Two boxes although the goods weigh only 100 g more than one box holds: the 5.1 kg bag does not fit beside the 20 kg sack, and a bag is not cut in half.

### 4.1 `shipping`: the delivery

| Field                    | Type          | Meaning                                                                                                                    |
| ------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `orderValue`             | cents         | The goods the rules looked at: after the discount code and after redeemed coins, VAT included, without the delivery.       |
| `requiredBoxes`          | integer       | Boxes the order needs.                                                                                                     |
| `unlockedFreeBoxes`      | integer       | Boxes the value of the goods would make free: `floor(orderValue / freeThresholdPerBox)`. Can be more than the order needs. |
| `freeBoxes`              | integer       | Boxes of this order that are delivered free.                                                                               |
| `paidBoxes`              | integer       | `requiredBoxes − freeBoxes`.                                                                                               |
| `freeThresholdPerBox`    | cents or null | Goods per free box. `null`: no box is free by value.                                                                       |
| `missingForNextFreeBox`  | cents or null | Goods missing for one more free box. Show it only while `paidBoxes > 0`.                                                   |
| `missingForFreeDelivery` | cents or null | Goods missing until every box of this order is free. `0` when the delivery is free.                                        |
| `feePerPaidBox`          | cents         | What one paid box costs at this value of the goods.                                                                        |
| `fee`                    | cents         | The delivery fee: `paidBoxes × feePerPaidBox`. The same as `totals.deliveryFee`.                                           |
| `regularFee`             | cents         | What the delivery would cost without a free-delivery code. Equals `fee` without such a code.                               |
| `freeByCode`             | boolean       | A free-delivery code made every box free.                                                                                  |

### 4.2 `shipping.weight` and `shipping.box`: the weight

| Field              | Meaning                                                                          |
| ------------------ | -------------------------------------------------------------------------------- |
| `weight.goods`     | grams of all packs                                                               |
| `weight.packaging` | grams of the boxes themselves (0 unless the admin set a box weight)              |
| `weight.total`     | the total shipping weight of the order                                           |
| `weight.estimated` | `true` when at least one product has no exact weight on record and was estimated |
| `box.maxWeight`    | grams one box may weigh                                                          |
| `box.tareWeight`   | grams of the empty box                                                           |
| `box.capacity`     | grams of goods one box holds                                                     |

### 4.3 `shipping.boxes` and `shipping.currentBox`: the boxes

One entry per box, the first 50 of an order (`requiredBoxes` counts them all).

| Field         | Meaning                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `number`      | 1 for the first box                                                                             |
| `weight`      | grams: the goods in it and the box itself                                                       |
| `remaining`   | grams of goods that still fit; 0 for a parcel that travels alone                                |
| `utilization` | how full it is, in whole percent of `box.maxWeight`, at most 100. The value for a progress bar. |
| `free`        | delivered free                                                                                  |
| `fee`         | what its delivery costs; 0 when free                                                            |
| `separate`    | a pack that travels as a parcel of its own (a sack sent as it is), not a box that is filled     |
| `overweight`  | heavier than a box may be                                                                       |

The free boxes are the first ones: with one free box of two, box 1 is free and box 2 is paid.

`currentBox` is the box the next goods go into: the one with the most room. It is `null` for an empty cart and when every pack travels alone. "… kg of space is available in your box" is `currentBox.remaining`.

### 4.4 `lines[].weight`: the weight of a line

`{ "unit": 5100, "total": 10200, "estimated": false }`: grams of one pack, of all packs of the line, and whether the weight is an estimate. `null` under the flat fee and for a line whose product is gone. Showing it is optional ("10.2 kg").

### 4.5 `delivery`: what the website reads today

`delivery` keeps its three fields and stays right under the box rules, so nothing breaks before the new display is built:

| Field            | Under the box rules                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `fee`            | the delivery fee                                                                                       |
| `freeFrom`       | the value of goods at which **this cart** is delivered free: the threshold once for every box it needs |
| `missingForFree` | what is missing for that; the same as `shipping.missingForFreeDelivery`                                |

### 4.6 A line that cannot be ordered: `too_heavy`

`lines[].issue` has a new value next to `product_not_found`, `product_unavailable`, `sold_out`, `quantity_below_minimum` and `quantity_above_maximum`:

- `too_heavy`: one pack is heavier than a box may be, and the shop does not send such packs. `canOrder` of the bill is `false` until the line is removed. Whether this can happen is a setting of the admin; most shops never see it.

## 5. The free-delivery progress

Show one message and one progress bar from `shipping`, on the cart page, in the cart drawer and in the summary of the checkout.

The bar runs to the next free box:

```text
progress = (orderValue mod freeThresholdPerBox) / freeThresholdPerBox        while paidBoxes > 0
progress = 1                                                                  when paidBoxes = 0
```

Which message, in this order:

| #   | When                                                  | English                                                                                                                                                                 | German                                                                                                                                                                                |
| --- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `requiredBoxes === 0`                                 | nothing                                                                                                                                                                 | nichts                                                                                                                                                                                |
| 2   | `freeByCode`                                          | Free delivery with code {code}. You save {regularFee}.                                                                                                                  | Kostenlose Lieferung mit dem Code {code}. Ersparnis: {regularFee}.                                                                                                                    |
| 3   | `paidBoxes === 0`, `requiredBoxes === 1`              | Great, this order ships free!                                                                                                                                           | Super, diese Bestellung wird kostenlos geliefert!                                                                                                                                     |
| 4   | `paidBoxes === 0`, `requiredBoxes > 1`                | Great, all {requiredBoxes} boxes ship free!                                                                                                                             | Super, alle {requiredBoxes} Boxen werden kostenlos geliefert!                                                                                                                         |
| 5   | `freeThresholdPerBox === null`                        | Delivery: {fee} ({paidBoxes} × {feePerPaidBox})                                                                                                                         | Lieferung: {fee} ({paidBoxes} × {feePerPaidBox})                                                                                                                                      |
| 6   | `requiredBoxes === 1`, `paidBoxes === 1`              | Add {missingForNextFreeBox} more and this order ships free.                                                                                                             | Noch {missingForNextFreeBox} bis zur kostenlosen Lieferung.                                                                                                                           |
| 7   | `requiredBoxes > 1`, `freeBoxes === 0`                | This order needs {requiredBoxes} boxes at {feePerPaidBox} each. Add {missingForNextFreeBox} more and the first box ships free.                                          | Diese Bestellung braucht {requiredBoxes} Boxen für je {feePerPaidBox}. Noch {missingForNextFreeBox}, dann ist die erste Box kostenlos.                                                |
| 8   | `requiredBoxes > 1`, `freeBoxes ≥ 1`, `paidBoxes ≥ 1` | This order needs {requiredBoxes} boxes: {freeBoxes} free, {paidBoxes} at {feePerPaidBox} each. Add {missingForNextFreeBox} more and box {freeBoxes + 1} ships free too. | Diese Bestellung braucht {requiredBoxes} Boxen: {freeBoxes} kostenlos, {paidBoxes} für je {feePerPaidBox}. Noch {missingForNextFreeBox}, dann ist auch Box {freeBoxes + 1} kostenlos. |

Notes for the texts:

- The German examples avoid "du" and "Sie" on purpose. Where the website addresses the customer, use the form it uses everywhere else.
- Use plural forms properly: "1 box" / "2 boxes", "1 Box" / "2 Boxen". Use the message catalogue of the website, not string concatenation.
- Amounts in the texts are formatted cents: `1900` is "19.00 €" in English pages and "19,00 €" in German ones, as the website formats every price.
- After message 3 or 4, an optional second line while `unlockedFreeBoxes === requiredBoxes`: "The next box would be free from {missingForNextFreeBox} more." Leave it out if it clutters.

**A hint for a cheaper box** (optional): when `paidBoxes > 0` and `shipping.feeTiers` of the settings has a tier above `orderValue` with a lower fee, the customer can be told. With the tier `upTo` that `orderValue` falls in: "Add {upTo + 1 − orderValue} more and delivery drops to {next tier's fee} per box." / "Noch {…}, dann kostet die Lieferung nur {…} pro Box." Show at most one hint beside the main message, and prefer the free-box message when both apply.

## 6. The box capacity

A second, smaller indicator: how full the boxes are.

- **One box** (`requiredBoxes === 1`, not `separate`): a bar at `currentBox.utilization` percent with "{weight.total} of {box.maxWeight}" and:
  - English: "{currentBox.remaining} of room left in your box."
  - German: "In der Box ist noch Platz für {currentBox.remaining}."
- **Several boxes:** one small bar per entry of `boxes`, labelled "Box 1", "Box 2", with its weight and a badge "Free" / "Kostenlos" or the fee. Beneath: "Box {currentBox.number} has {currentBox.remaining} of room left." / "In Box {currentBox.number} ist noch Platz für {currentBox.remaining}."
- **A full box** (`currentBox.remaining` below about 500 g): "Your box is full. The next item starts a new box." / "Die Box ist voll. Der nächste Artikel kommt in eine neue Box." This is a display choice of the website; the API does not send a "full" flag.
- **A parcel that travels alone** (`separate: true`): show it as "Separate parcel" / "Eigenes Paket" with its weight and no bar. With `overweight: true` nothing more is needed: it is sent like any other parcel.
- **More than 50 boxes:** show the listed ones and "… and {requiredBoxes − 50} more".
- **`weight.estimated === true`:** an optional small note, "Weight is approximate." / "Gewicht ungefähr."

Weights are grams: show "7.5 kg" from `7500`. Below one kilogram "850 g" reads better than "0.9 kg".

The room in a box is a guide, not a promise: a pack that is heavier than the room left starts a new box, even if a lighter one would still fit. The bill after the change is what counts.

## 7. Cart integration

1. Read the bill (`GET /v1/store/cart`, or `POST /v1/store/cart/preview` for a visitor) and render the lines as today.
2. If `shipping` is not `null`, render the free-delivery progress (section 5) and the box capacity (section 6) above or beside the summary. If it is `null`, render today's "add … for free delivery" hint from `delivery`.
3. The summary shows the delivery as today from `totals.deliveryFee`: "Delivery 4.99 €" or "Delivery free". With several boxes a second line helps: "2 boxes: 1 free, 1 paid".
4. After every change of a quantity, an added or a removed item, replace the bill with the answer of that call. The progress follows by itself: it is all in the answer.
5. On product pages and in lists, "free delivery" promises come from `GET /v1/store/settings`, never from a constant.

**Adding to the cart from a product page:** the answer of `PUT /v1/store/cart/items/{variantId}` is the full bill. A toast such as "Added. 12.50 € more and your box ships free." can be built from it without another call.

## 8. Checkout integration

- The summary of the checkout shows the same progress and the same boxes as the cart, from the same bill.
- `POST /v1/store/checkout` and `POST /v1/store/guest/checkout` are called as today, with `expectedTotal` = `totals.total` of the bill on the screen.
- The order in the answer has the delivery it was placed with (section 10).

| Refusal                           | When                                                                                   | What to do                                                                                                                                                                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `409 ORDER_TOTAL_CHANGED`         | the bill is another one than the customer saw: the cart, a weight or the rules changed | Known today. `error.details.totals` has the new totals. Reload the bill, show "The total has changed. Please check your order." and let the customer confirm again.                                                                       |
| `409 ORDER_ITEMS_NOT_ORDERABLE`   | a line has an issue; new among them: `too_heavy`                                       | Known today. `error.details.lines[].issue` says which. For `too_heavy`: "This item is too heavy to be shipped. Please remove it or contact us." / "Dieser Artikel ist für den Versand zu schwer. Bitte entfernen oder Kontakt aufnehmen." |
| `409 DELIVERY_COUNTRY_NOT_SERVED` | the delivery address is in a country the shop does not deliver to                      | New. `error.details.countries` lists where it does. "We do not deliver to this country yet." / "In dieses Land liefern wir noch nicht." Cannot happen while addresses are German only; handle it all the same.                            |

Give every new code a text of its own. A code the website does not know should fall back to a general message, never to a blank page.

The payment page is opened for the total of the order. Nothing about shipping is sent to it or read from it.

## 9. Discount codes and loyalty coins

Both are taken off the goods **before** the boxes are counted. `shipping.orderValue` is what is left, and it is the figure every threshold looks at.

- A code or coins can **cost a free box**: 78.00 € of goods unlock two boxes; with 10 % off, 70.20 € unlock one, and the second box costs 4.99 €. The bill after applying the code says so. Show the new delivery line clearly next to the discount, so that the customer sees both effects at once.
- A good message for that moment, when the answer of applying a code or coins has `paidBoxes` above what it was before: "With this discount one box is no longer free. Add {missingForNextFreeBox} more to get it free again." / "Mit diesem Rabatt ist eine Box nicht mehr kostenlos. Noch {missingForNextFreeBox}, dann ist sie es wieder."

**Free-delivery codes.** A discount code can have the new type `free_delivery`:

```json
"discount": { "code": "FREESHIP", "type": "free_delivery", "value": 0, "amount": 0, "applied": true, "reason": null }
```

- It takes nothing off the goods: `amount` is 0 and `totals.discount` is 0. **Do not render a "Discount −0.00 €" row for it.**
- The delivery is free: `totals.deliveryFee` is 0. Under the box rules `shipping.freeByCode` is `true`, every box has `free: true`, and `shipping.regularFee` is what the delivery would have cost.
- Show it at the delivery line: "Delivery ~~4.99 €~~ free with code FREESHIP" / "Lieferung ~~4,99 €~~ kostenlos mit Code FREESHIP".
- It works under the flat fee too (`shipping` is `null` there; the saving is not sent).
- It is applied and removed like every other code (`PUT` / `DELETE /v1/store/checkout/discount`), and refused with the same reasons.

The types of a code are now `percent`, `fixed` and `free_delivery`. Wherever the website switches on the type, add the third case; an unknown type should show the code without an amount rather than break.

## 10. The order

`GET /v1/store/orders/{orderNumber}`, and the order in the answer of both checkouts, have a new key `shipping`. It is `null` for an order that paid the flat fee.

```json
{
  "orderNumber": "RF-1084",
  "totals": {
    "subtotal": 6400,
    "discount": 0,
    "rewards": 0,
    "deliveryFee": 499,
    "total": 6899
  },
  "shipping": {
    "orderValue": 6400,
    "weight": {
      "goods": 41050,
      "packaging": 0,
      "total": 41050,
      "estimated": true
    },
    "requiredBoxes": 2,
    "freeBoxes": 1,
    "paidBoxes": 1,
    "feePerPaidBox": 499,
    "regularFee": 499,
    "fee": 499,
    "freeByCode": false,
    "boxes": [
      {
        "number": 1,
        "weight": 21050,
        "separate": false,
        "overweight": false,
        "free": true,
        "fee": 0
      },
      {
        "number": 2,
        "weight": 20000,
        "separate": false,
        "overweight": false,
        "free": false,
        "fee": 499
      }
    ]
  },
  "items": [
    {
      "sku": "RF-00042",
      "quantity": 2,
      "unitWeight": 20000,
      "weightEstimated": false
    },
    {
      "sku": "RF-00077",
      "quantity": 1,
      "unitWeight": 1050,
      "weightEstimated": true
    }
  ]
}
```

This is what was agreed when the order was placed. It does not change when the shop changes its rules. On the order page and in the confirmation a line such as "Delivery: 2 boxes, 41.1 kg — 1 free, 1 × 4.99 €" / "Lieferung: 2 Boxen, 41,1 kg — 1 kostenlos, 1 × 4,99 €" is enough. The delivery fee of the order is `totals.deliveryFee` as before; after a partial return it stays, and it is refunded when the whole order is cancelled or returned.

## 11. Loading and error states

- **First load:** a placeholder for the progress and the capacity blocks of the size they will have, so the page does not jump.
- **While a change is sent:** keep the last bill on the screen, dim the summary and the two blocks, disable the quantity buttons of that line. Replace everything when the answer arrives.
- **A change failed:** put the quantity back, show the error of the call, keep the last bill.
- **Fast clicks:** send the latest quantity only and ignore an answer that is older than the last request; otherwise the bar jumps back and forth.
- **`shipping` is `null`:** the flat fee. Render today's delivery hint; render none of the new blocks.
- **`canOrder` is `false`:** as today; the lines with an `issue` say why. The bill, the boxes and the fee are those of the lines that can be ordered.
- **Empty cart:** `shipping.requiredBoxes` is 0 and `currentBox` is `null`. Show neither block.

## 12. Example scenarios

All with the rules of section 1. Use them as test cases.

| #   | Cart                                             | What the customer sees                                                                    |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 1   | 10.00 €, 2.1 kg                                  | Delivery 6.99 €. "Add 29.00 € more and this order ships free." Bar at 26 %. Box 8 % full. |
| 2   | 25.00 €, 5.3 kg                                  | Delivery 4.99 €. "Add 14.00 € more and this order ships free."                            |
| 3   | 39.00 €, 11.2 kg                                 | Delivery free. "Great, this order ships free!" Bar full.                                  |
| 4   | 39.50 €, 25.1 kg (a 20 kg sack and a 5.1 kg bag) | Two boxes: box 1 free, box 2 for 4.99 €. "Add 38.50 € more and box 2 ships free too."     |
| 5   | 59.00 €, 40 kg                                   | Two boxes, one free, one 4.99 €. "Add 19.00 € more and box 2 ships free too."             |
| 6   | the same plus 19.00 € and 1 kg                   | 78.00 €, still two boxes. "Great, all 2 boxes ship free!" Delivery free.                  |
| 7   | 78.00 € with a 10 % code                         | Goods 70.20 €. One box free, one 4.99 €. "Add 7.80 € more and box 2 ships free too."      |
| 8   | 59.00 €, 40 kg with a free-delivery code         | "Free delivery with code FREESHIP. You save 4.99 €." Delivery free. No discount row.      |
| 9   | 39.00 € with coins worth 1.95 €                  | Goods 37.05 €. Delivery 4.99 €. "Add 1.95 € more and this order ships free."              |
| 10  | flat fee (feature off)                           | Exactly today's cart.                                                                     |

## 13. Testing

1. **Feature off:** the cart and the checkout look and behave as before. No new block appears.
2. **Feature on, one box:** scenarios 1 to 3. Change the quantity up and down across 20.00 € and 39.00 €; the fee and the message change at the right cent (20.00 € pays 6.99 €, 20.01 € pays 4.99 €; 38.99 € pays, 39.00 € is free).
3. **Two boxes:** scenarios 4 to 6, including removing the item again.
4. **Codes and coins:** scenarios 7 to 9; remove the code and the coins again.
5. **Visitor and guest:** the same cart through `POST /v1/store/cart/preview` shows the same figures; the guest checkout places the order with them.
6. **Both languages:** every message of section 5 and 6, with singular and plural, with German number formats.
7. **The total changed:** open the checkout, let the admin change a fee, press "Pay": the website shows the new bill and asks again.
8. **Order page:** the delivery line of an order placed under the box rules, and of an older order (`shipping: null`).
9. **Small screens:** the progress and the boxes on a phone, with three and more boxes.
10. **Never calculated in the browser:** search the code for the numbers 39, 25, 4.99 and 6.99. None may be there.
