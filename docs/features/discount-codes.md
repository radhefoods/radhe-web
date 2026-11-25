# Discount codes

A customer who has a promotional code enters it at the checkout. The API checks the code against the cart and answers the bill with the discount; the shop shows what the code does and places the order with the total on the screen. One code per order. Customers and guests can both use one; what a code is worth, whom it is for and when it stops applying is decided by the API.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | 2026-10-27. A guest's code: 2026-11-01. Free-delivery codes: 2026-11-20. The field behind "Add a discount code": 2026-11-24 |
| **Pages** | `/en/checkout` · `/de/kasse`; the row of an applied code also on `/en/cart` · `/de/warenkorb` and on the order pages |
| **Code** | `src/components/checkout/discount-code.tsx`, `src/components/checkout/checkout-view.tsx`, `src/components/cart/bill-summary.tsx`, `src/features/cart/shipping.ts` |
| **API** | [Orders and checkout](../api/endpoints.md#orders-and-checkout), [Cart](../api/endpoints.md#cart) |
| **State** | A customer's code: the API, with the stored cart. A guest's code: the checkout page (it is gone after a reload) |
| **Texts** | `checkout.discount`, `cart.discountCode`, `shipping` (`withCode`, `summaryWithCode`, `regularFee`, `lostByCode`, `statusByCode`, `nextByCode`) |
| **Tests** | `e2e/checkout.spec.ts` ("discount codes on the checkout page"), `e2e/shipping.spec.ts` (scenarios 7 and 8), `src/features/cart/shipping.test.ts`, `mocks/discounts.test.ts` |
| **Backend reference** | [reference/backend/store-api.md](../reference/backend/store-api.md), section 9.6; for free-delivery codes [reference/backend/box-based-shipping-web-integration.md](../reference/backend/box-based-shipping-web-integration.md), section 9. The backend's own document on discount codes, which holds the rules and the arithmetic, was never copied into this repository |

## What the customer sees

The code has one place: the summary "Your order" of the checkout, between the delivery estimate and the coins. The cart page has no field.

### The field

| State | What shows |
| --- | --- |
| No code, at first | One quiet line with a ticket icon: "Add a discount code" |
| The line was tapped | The label "Discount code", a field that takes the focus, and "Apply". The field shows capitals and takes up to 40 characters; "Apply" is switched off while the field is empty |
| The code is on its way | "Apply" shows that it is busy |
| The code is refused | The reason in red under the field (the table below); the field is marked invalid. Typing clears the message |
| Another error (the network, too many attempts) | The error's text under the field |
| A code is applied | A white tile: the ticket icon in green, "Code {code} applied", what it does, and "Remove" |
| A code is kept with the cart and stopped applying | The same tile in a warning tone: "Code {code} no longer applies" with the reason, and "Remove" |

What an applied code does, in the second line of the tile:

| `discount.type` | Line |
| --- | --- |
| `percent`, `fixed` | "You save {amount}.", the amount being `discount.amount` |
| `free_delivery` | "Free delivery.", and after it "You save {amount}." when the bill says what the delivery would have cost (`shipping.regularFee`, under the box rules) |
| A type the shop does not know | "You save {amount}." when `discount.amount` is above 0; otherwise the code alone |

### The reasons

The API names why a code cannot be applied or stopped applying (`DiscountReason`); the shop has a sentence for each:

| `reason` | Sentence |
| --- | --- |
| `not_found` | "This code does not exist." |
| `inactive` | "This code is no longer valid." |
| `not_started` | "This code is not valid yet." |
| `expired` | "This code is no longer valid." |
| `exhausted` | "This code has been used up." |
| `already_used` | "You have already used this code." |
| `below_minimum` | "Add more to your cart to use this code." |
| `nothing_eligible` | "This code does not apply to products on sale." |

### On the bill

| Code | Rows of the totals |
| --- | --- |
| Takes something off the goods | "Discount code {code}" with minus `totals.discount`, between the goods and the delivery; the total is the API's |
| Frees the delivery | No row of its own. The row "Delivery" reads "Free", with "with code {code}" under it (or "{count} boxes, free with code {code}"), and under the box rules the regular fee struck through before it |

The row shows wherever the bill is printed: at the checkout, on the cart page of a customer (the code stays with the stored cart), and on the order ([orders](orders.md)). The lines of the order keep their prices per pack; the API's line totals carry each line's share of the discount.

### When the order is placed

| Case | What the customer sees |
| --- | --- |
| The code still applies | The order is placed with it |
| The code stopped applying since the page loaded (`409 DISCOUNT_NOT_APPLICABLE`) | A warning in the summary: "Your discount code {code} was removed", the reason, and "You can place the order without it or try another code." The bill is read again without the code, and "Buy now" places the order at the new total |

## Rules

| Case | What happens | Decided by |
| --- | --- | --- |
| Whether a code exists, is valid, fits the cart and the customer | Answered as a bill or as a reason | The API |
| What the code takes off, and off which lines | `totals.discount`, `lines[].discountAmount`, `lines[].lineTotal` | The API |
| One code per order | A second code replaces the first | The API |
| How the code is sent | As typed, trimmed; the API puts it in capitals. The capitals in the field are only how it is shown | The browser (`src/components/checkout/discount-code.tsx`) |
| An empty field | Nothing is sent | The browser |
| Which line the tile shows | By `discount.type`, as in the table above | The browser |
| The row "Discount code" | Shows while `totals.discount` is above 0, so never for a free-delivery code | The browser (`src/components/cart/bill-summary.tsx`) |
| Which code frees the delivery | `freeDeliveryCodeOf`: the applied code whose `type` is `free_delivery` | The browser, from the bill |

The browser computes nothing here: no percentage, no share, no total.

### A customer's code and a guest's code

| | A customer | A guest |
| --- | --- | --- |
| Applying | `PUT /v1/store/checkout/discount` with `{ code }`; the answer is the bill with the discount | `POST /v1/store/cart/preview` with the browser's cart and `discountCode`; the answer is the bill |
| A refusal | `400 DISCOUNT_NOT_APPLICABLE` with `details.reason` | The preview answers a bill whose `discount` has `applied: false` and a `reason`; the page treats it as the same refusal (`refusedDiscount` in `src/components/checkout/checkout-view.tsx`) and keeps no code |
| Where the code lives | With the stored cart, in the API: it is on every bill until the order is paid or the code is removed | In the checkout page. Every preview of that page carries it; the cart page and a reload do not |
| Removing | `DELETE /v1/store/checkout/discount`; the answer is the bill without it | The page forgets the code and asks the preview without it |
| At the order | Nothing is sent: the API uses the code of the cart | `discountCode` travels with `POST /v1/store/guest/checkout` |
| Stopped applying at the order | The API takes it off the cart | The page forgets it |

In both cases the bill the API answers replaces the one on the page, so the row and the total change at once. For a customer the answer is written into the cached cart; for a guest the page asks the preview again under the code it keeps.

### With coins

| Case | What shows | Decided by |
| --- | --- | --- |
| The shop's rules do not allow coins beside a code | Under the code, instead of the coins: "Coins cannot be combined with a discount code." (`rewards.reason` is `code_applied`) | The API ([rewards](rewards.md)) |
| Both are allowed | Both tiles, and both rows on the bill | The API |
| A guest | No coins at all | The browser renders the coins for customers only |

### With free boxes

Under delivery by the box a code is taken off the goods before the boxes are counted.

| Case | What shows |
| --- | --- |
| Applying a code turns a free box into a paid one | Above the totals: "With this discount one box is no longer free. Add {amount} more to get it free again." (with several: "… {count} boxes are no longer free. Add {amount} more to get one of them free again."), the amount being the bill's `missingForNextFreeBox`. The count is `lostFreeBoxes` of the bill before and the bill after |
| The code is removed | The note goes |
| A free-delivery code | The card of the boxes says "Your order ships free with code {code}" and its second meter "With code {code}" |

The detail is in [shipping](shipping.md). Worked example of the count, from the backend's scenario: goods of 78.00 € free two boxes (`paidBoxes` 0); with a code of 10 % the goods count 70.20 € and the API answers `paidBoxes` 1; `1 − 0 = 1` box is no longer free.

## Data and API

```
"Apply"  →  customer: PUT /v1/store/checkout/discount      guest: POST /v1/store/cart/preview { items, discountCode }
         →  200 with the bill  →  the bill replaces the one on the page; the field empties
         →  refused            →  the reason under the field; nothing is kept
"Remove" →  customer: DELETE /v1/store/checkout/discount   guest: POST /v1/store/cart/preview { items }
"Buy now"→  customer: POST /v1/store/checkout              guest: POST /v1/store/guest/checkout { …, discountCode }
         →  409 DISCOUNT_NOT_APPLICABLE  →  the warning; the bill is read again
```

Nothing is cached apart from the bill itself. The API limits how often a code can be tried; the answer to too many attempts shows as the general error under the field ([error handling](../api/error-handling.md)). The mock API knows codes in every state (`mocks/data/discounts.ts`, `mocks/discounts.ts`; see [mock API](../development/mock-api.md)).

## Behaviour

- **The field opens on a tap** and takes the focus it was opened for. It is a size smaller than the fields of a form; on phones its text stays 16 px, since a smaller one makes iOS zoom.
- **Keyboard and screen reader.** Enter in the field applies. A refusal is an alert tied to the field (`aria-describedby`, `aria-invalid`). "Remove" is announced as "Remove the code {code}".
- **While a call is on its way** "Apply" and "Remove" do not act twice.

## Not built

| Not in the shop | Note |
| --- | --- |
| A code field on the cart page | The API takes a code at the checkout only; a visitor's code lives with the checkout page |
| Several codes on one order | One code per order |
| A code in a link (`?code=…`) or one that applies by itself | – |
| A list of the customer's codes, or of codes on offer | – |
| A guest's code kept across a reload or carried into an account | It is page state |
| A percentage or an amount worked out in the browser | The API's figures are printed |

## Code map

| File | What it is |
| --- | --- |
| `src/components/checkout/discount-code.tsx` | `DiscountCode`: the line, the field, the tile, the reasons; `compactInput`, shared with the coins |
| `src/components/checkout/checkout-view.tsx` | Where the field stands; `applyGuestCode`, `removeGuestCode`, `refusedDiscount`; the warning after `409 DISCOUNT_NOT_APPLICABLE`; the note on a lost free box |
| `src/components/cart/bill-summary.tsx` | The row "Discount code {code}" and the line under "Delivery" |
| `src/features/cart/shipping.ts` | `freeDeliveryCodeOf`, `lostFreeBoxes` |
| `src/lib/api/store-api.ts` | `applyDiscount`, `removeDiscount`, `previewCart` with `discountCode` |
| `src/lib/api/types.ts` | `BillDiscount`, `DiscountReason`, `DiscountType`, `OrderDiscount` |
| `mocks/discounts.ts` | The mock's rules for codes |
