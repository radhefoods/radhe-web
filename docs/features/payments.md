# Payments

An order is paid on Stripe's hosted payment page, by card or with PayPal. The shop creates the order through the API, receives the address of the payment page, sends the browser there, and shows the outcome when the customer comes back to the order page. The shop holds no card data, loads no script of Stripe and has no key of Stripe; the API creates the payment page, hears from Stripe and confirms the order.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | 2026-10-16. For guest orders: 2026-11-01 |
| **Pages** | The order page `/en/account/orders/{orderNumber}` · `/de/konto/bestellungen/{orderNumber}`; the guest order page `/en/guest/orders/{orderNumber}` · `/de/guest/orders/{orderNumber}`; "Buy now" on `/en/checkout` · `/de/kasse` |
| **Code** | `src/components/account/order-payment.tsx`, `src/features/orders`, `src/components/catalogue/payment-marks.tsx`, `src/components/checkout/checkout-view.tsx` |
| **API** | [Payments](../api/endpoints.md#payments), [Orders and checkout](../api/endpoints.md#orders-and-checkout) |
| **State** | The API. The address of the order page carries the outcome of the way back (`?payment=success`, `?payment=cancelled`, `?pay=1`); a guest's token is in the address and in `sessionStorage` |
| **Texts** | `payment`; `checkout` (`place`, `placing`, `notAvailableTitle`, `notAvailableText`); `product.info` (`paymentText`, `paymentMethods`); `cart.payNote`; `orders.paymentStatus` |
| **Tests** | `e2e/checkout.spec.ts`, `e2e/guest.spec.ts`, `e2e/account.spec.ts`, `src/features/orders/payment-url.test.ts`, `src/features/orders/orders.test.ts`, `mocks/orders.test.ts` |
| **Backend reference** | [reference/backend/store-api.md](../reference/backend/store-api.md), section 10 (and section 20 for guest orders) |

## What the customer sees

### From "Buy now" to the payment page

```
"Buy now"  →  POST /v1/store/checkout  (a guest: POST /v1/store/guest/checkout)
           →  { created, order, checkout: { url, expiresAt } }   (a guest also: token)
           →  the browser leaves the shop for checkout.url
           →  Stripe's page: card or PayPal
           →  back to the order page with ?payment=success or ?payment=cancelled
```

While the browser is on its way, the button reads "Taking you to the payment page …". What "Buy now" checks and sends is in [checkout](checkout.md).

### Back on the order page

Stripe sends the browser to the order page: for an account to `/account/orders/{orderNumber}?payment=…`, for a guest to `/guest/orders/{orderNumber}?token=…&payment=…`. Both addresses are the API's, built from its setting of where the shop lives. The page reads `payment` only when it is `success` or `cancelled`.

At the top of the page stands the outcome (`PaymentOutcome`), the first case that fits:

| Order | Case | What shows |
| --- | --- | --- |
| 1 | "Pay now" was pressed and the page is opening | "Opening the payment page …" |
| 2 | The order is cancelled with the reason `sold_out` | In red: "A product sold out before your payment was captured": "Nothing was charged and this order was cancelled. Your cart is still there: check it and order again.", with "To the cart" |
| 3 | The payment is `paid` and the address says `payment=success` | In green: "Thank you, your order is paid": "The confirmation with your invoice is on its way to {email}." (a guest: "… is on its way by email.") |
| 4 | The order does not wait for its payment | Nothing |
| 5 | The payment is `failed` | "The payment did not go through": "Nothing was charged. Please try again, with another card or with PayPal if you like.", with "Pay now" |
| 6 | `payment=success`, the order still waits, and its payment page is still open | "Thank you. We are confirming your payment …": "This can take a moment with PayPal. The page updates by itself; you do not need to pay again." After a while: "Your payment is still being confirmed" with "Check again". When asking failed: the error with a retry |
| 7 | Any other return (`payment=cancelled`, or `success` with no open page) | "Payment not completed": "Nothing was charged. Your order waits for its payment; you can pay whenever you like.", with "Pay now" |
| 8 | No return in the address | Nothing; the payment panel says what is open |

### The payment panel of an order

`PaymentPanel` is part of every order page ([orders](orders.md)); while the order waits for its payment it comes first on screens below `xl`.

| State | What shows |
| --- | --- |
| The order waits for its payment | "Amount" with `payment.amount`; "Your order is placed and waits for the payment. It is confirmed as soon as the payment goes through; nothing is reserved until then." (after a failed attempt the sentence of case 5); "Pay {amount} now" with "By card or PayPal, on the secure page of Stripe." |
| Online payment is not available (`payment.canPayOnline` is `false`) | Instead of the button: "Online payment is not available at the moment. Please try again later." |
| Paid or refunded | A check mark, "Paid on {date}", and "by card" or "with PayPal" |
| Cancelled and nothing was paid | "Nothing was charged for this order." |
| Credit notes, refunds | "Credited: {amount}", "Refunded: {amount}" |
| An invoice exists | "Invoice {number}", a link to the documents of the page |
| Stripe has a receipt | "Receipt", a link to `payment.receiptUrl` in a new tab |

### Paying an unpaid order again

"Pay now" (`usePayNow`) is offered while the order waits and `canPayOnline` is `true`:

| Case | What happens |
| --- | --- |
| The order has an open payment page (`payment.checkout`) | The browser goes to its `url` |
| It has none | `POST /v1/store/orders/{orderNumber}/pay` (a guest: `POST /v1/store/guest/orders/{orderNumber}/pay` with the token) answers a page, and the browser goes there |
| The address of the order page carries `?pay=1` (the link of the payment-failed email) | The same starts by itself, once, as soon as the page knows the order waits and can be paid |
| The API answers `409 ORDER_NOT_PAYABLE` (paid or cancelled meanwhile) | The payment is asked again, so the page shows the real state; the error's text stands under the button |
| Another error | Its text under the button |

### The payment marks

`PaymentMarks` in `src/components/catalogue/payment-marks.tsx` shows four small white chips: Visa, Mastercard, American Express and PayPal. They are drawn in the component as SVG in the brands' colours, each an image named for screen readers; no file of a card scheme is hosted. **The list is written in the shop, not read from the API or from Stripe.**

| Where | With |
| --- | --- |
| The checkout's summary, under "Buy now" | The spoken name "Accepted payment methods" |
| "Delivery and payment" on the product page (`src/components/catalogue/purchase-info.tsx`) | "Secure payment at checkout" and "Card or PayPal on the secure page of Stripe" |

Other places say the same in words: the cart ("You pay in the next step, by card or PayPal."), the strip above the header ("Secure payment at checkout"), the ticket card of the home page ("Card or PayPal, at checkout").

## Rules

| Case | What happens | Decided by |
| --- | --- | --- |
| The amount, the methods on offer, approval, capture, the invoice, confirming the order, emptying the cart | Nothing of it happens in the shop | The API and Stripe ([store-api.md](../reference/backend/store-api.md), section 10) |
| Where the browser may be sent | `isSafePaymentUrl` (`src/features/orders/payment-url.ts`): an address with `https`; plain `http` only for `localhost` and `127.0.0.1`, where the mock plays the payment page. Anything else is treated as `PAYMENT_PROVIDER_ERROR` and the browser stays | The browser |
| How the browser leaves | `window.location.assign(url)`: a full navigation, no pop-up, no frame | The browser |
| When the page asks for the payment | On every return from Stripe and while the order waits for its payment: `GET /v1/store/orders/{orderNumber}/payment`, never from a cache. The API asks Stripe about an open page first, so the answer is right the moment the customer comes back | The browser asks; the API answers |
| When it keeps asking | Only after `payment=success` while the order waits, the payment has not failed and a payment page is open: every 3 seconds for the first 40 answers (two minutes), then every 10 seconds | The browser (`usePaymentState`) |
| "Still being confirmed" | After 40 answers the calm message with "Check again" replaces "We are confirming …" | The browser |
| The order on the page after the payment changed | The order, the list of orders and the documents are read again as soon as the payment's answer differs from the order on the page | The browser |
| Whether "Pay now" is offered | `payment.canPayOnline` | The API |
| A guest's cart after paying | Emptied in the browser when the guest order page opens with `payment=success` and the order is paid | The browser ([cart-and-bill.md](../business-logic/cart-and-bill.md#signing-in-and-signing-out)) |

The browser computes nothing about a payment. The amounts are `payment.amount`, `payment.creditedAmount` and `payment.refundedAmount` of the API, printed.

### No card data, no script of Stripe

| Fact | Where it shows |
| --- | --- |
| No package of Stripe is installed | `package.json` names none |
| No script of Stripe is loaded and none could be | The `Content-Security-Policy` of `next.config.ts` allows scripts from the shop itself only (and, on preview deployments, Vercel's toolbar), no frames in production, and forms that post to the shop only |
| No field for a card number, an expiry date or a security code | The checkout has an email address (guests), an address and a checkbox |
| No key of Stripe | The shop has no secrets; see [configuration](../architecture/configuration.md) |

The only things of Stripe the shop handles are two addresses the API hands it: the payment page (`checkout.url`) and the receipt (`payment.receiptUrl`).

## Data and API

| When | Call | Answer used for |
| --- | --- | --- |
| "Buy now" | `POST /v1/store/checkout`, `POST /v1/store/guest/checkout` | `checkout.url`; the order is cached for the order page |
| The order page opens after a return, or the order waits | `GET /v1/store/orders/{orderNumber}/payment` | `status`, `payment`, `documents` |
| The same for a guest | `GET /v1/store/guest/orders/{orderNumber}` with the token | The order, its payment and its documents in one answer; reads that start together share one request (`src/features/orders/order-access.ts`) |
| "Pay now" without an open page | `POST /v1/store/orders/{orderNumber}/pay`, `POST /v1/store/guest/orders/{orderNumber}/pay` | `url` |

Errors: a failed read of the payment while "confirming" shows the error with a retry; the order itself stays on the page. `503 PAYMENTS_NOT_CONFIGURED` at the checkout shows "Checkout is not available right now" and switches "Buy now" off ([checkout](checkout.md)).

## In development: the mock

The mock API stands in for Stripe ([mock API](../development/mock-api.md)).

| What | How |
| --- | --- |
| The payment page | `checkout.url` points at the mock's own page, `/__mock/stripe/{orderNumber}`: "Mock payment page", with "Pay by card", "Pay with PayPal" and "Cancel". Nothing is charged |
| Card | Settles the order at once and returns with `payment=success` |
| PayPal | Returns with `payment=success` and settles four seconds later, when the payment is asked for: this plays "We are confirming your payment …" |
| Cancel, or a page that is no longer open | Returns with `payment=cancelled` |
| The way back | To `/account/orders/{orderNumber}` or, for a guest order, to `/guest/orders/{orderNumber}` with its token |
| `MOCK_STRIPE=off` | Set when the mock is started (`MOCK_STRIPE=off npm run dev:mock`): online payment counts as not set up. The checkout answers `503 PAYMENTS_NOT_CONFIGURED`, and an unpaid order has `canPayOnline: false` |
| `POST /__mock/stripe` | `{ "enabled": true }` or `false` switches the same while the mock runs; `POST /__mock/reset` goes back to what `MOCK_STRIPE` says |
| `POST /__mock/payment` | Settles, fails or expires the payment of an order, for the tests |

## Behaviour

- **The outcome comes first.** It stands above everything else on the order page, and the payment panel moves to the top on small screens while something is to pay.
- **Screen reader.** "Pay {amount} now" is described by the line on the methods under it.
- **No waiting screen in the shop.** Between "Buy now" and Stripe's page only the button changes.

## Not built

| Not in the shop | Note |
| --- | --- |
| A payment form in the shop (Stripe Elements, a card field, a PayPal button) | The payment is on Stripe's page |
| A choice of payment method in the shop | Made on Stripe's page |
| Saved cards, one-click payment | – |
| Paying on delivery, by invoice or by bank transfer | – |
| A countdown to the end of the payment page | `checkout.expiresAt` is not shown |
| The reason of a failed payment in words | `payment.lastFailure` is for developers; the shop shows a general sentence |
| The payment marks from the API | They are fixed in `src/components/catalogue/payment-marks.tsx` |
| A webhook endpoint in the shop | Stripe talks to the API |

## Code map

| File | What it is |
| --- | --- |
| `src/components/account/order-payment.tsx` | `usePaymentState`, `PaymentOutcome`, `PaymentPanel`, "Pay now" |
| `src/features/orders/payment-url.ts` | `isSafePaymentUrl` |
| `src/features/orders/order-access.ts` | The calls of an order page for an account and for a guest's token |
| `src/features/orders/orders.ts` | The query keys of an order, its payment and its documents |
| `src/components/checkout/checkout-view.tsx` | "Buy now" and the hand-over to the payment page |
| `src/components/catalogue/payment-marks.tsx` | The four marks |
| `src/app/[locale]/(shop)/account/orders/[orderNumber]/page.tsx` | Reads `payment` and `pay` from the address for an account's order |
| `src/app/[locale]/(shop)/guest/orders/[orderNumber]/page.tsx` | The same for a guest order, with `token` |
| `mocks/payments.ts` | The mock's payment page, settlement and `MOCK_STRIPE` |
