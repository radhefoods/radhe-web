# Orders

Where a customer follows what they ordered: the list of their orders, the page of one order with its progress, payment, bill and documents, the invoices page, and the page a guest opens with the link of an email. The API decides every status, amount and permission; the shop words and arranges them.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | 2026-10-16 (orders paid at the checkout); the guest's order page 2026-11-01; the boxes line 2026-11-20 |
| **Pages** | `/en/account/orders` · `/de/konto/bestellungen`, `/en/account/orders/RF-1084` · `/de/konto/bestellungen/RF-1084`, `/en/account/invoices` · `/de/konto/rechnungen`, `/en/guest/orders/RF-1084?token=…` · `/de/guest/orders/RF-1084?token=…` |
| **Code** | `src/components/account` (`order-list.tsx`, `order-detail.tsx`, `order-payment.tsx`, `order-bits.tsx`, `invoice-list.tsx`, `guest-order.tsx`), `src/features/orders`, `src/lib/orders` |
| **API** | [Orders and checkout](../api/endpoints.md#orders-and-checkout), [Payments](../api/endpoints.md#payments), [Invoices](../api/endpoints.md#invoices) |
| **State** | The API. TanStack Query entries `["orders", locale]`, `["order", number, locale]`, `["order-payment", number]`, `["order-documents", number]`, `["invoices"]` (a guest's with a `guest-` prefix); `sessionStorage` `rf.guest-order.v1:<number>`; `payment`, `pay` and `token` in the address bar |
| **Texts** | `orders`, `payment`, `documents`, `account`, `shipping`, `cart` (the bill rows) |
| **Tests** | `e2e/account.spec.ts`, `e2e/guest.spec.ts`, `src/features/orders/orders.test.ts`, `src/features/orders/payment-url.test.ts`, `src/lib/orders/guest-token.test.ts`, `mocks/orders.test.ts` |
| **Backend reference** | [reference/backend/store-api.md](../reference/backend/store-api.md) (sections 9 to 11, 20), [reference/backend/customer-accounts.md](../reference/backend/customer-accounts.md) (sections 2 and 5) |

Returns, problem reports and the review of an order are sections of the order page with documents of their own: [returns-and-reports.md](returns-and-reports.md), [reviews.md](reviews.md). The payment itself, with the way to Stripe and back, is in [payments.md](payments.md).

## What the customer sees

### The list

"Your orders": one card per order, newest first, 25 at a time; "Show older orders" loads the next 25. A card (`OrderCard`) is one link and shows "Order RF-1084", "Placed on 12 November 2026", the status chips, small product pictures, "3 items" (with the delivery method while the order is on its way) and the total. Without orders: "No orders yet" and "Browse the range".

### The page of an order

`OrderBody` in `src/components/account/order-detail.tsx`, in this order:

| Block | Content |
| --- | --- |
| Head | "All orders" (back), "Order RF-1084", the status chips, "Placed on …" |
| Outcome | One alert when the customer comes back from the payment page, when the last attempt failed, or when the API cancelled the order because a product sold out; "Your order is cancelled." after cancelling here |
| "Progress" | The timeline (below); "Track parcel" (opens the carrier's page in a new tab) when the order has `delivery.trackingUrl`; "Tracking number: …" when it has one |
| "Payment" | Beside the progress from `xl`; first on smaller screens while the order waits for its payment |
| "Items" | Per pack size: picture, name, size · quantity × unit price (the regular price struck through beside a reduced one), "2 of 3 delivered" when less arrived, "1 returned", and the line total (the final one once delivered). Under them "Corrections by Radhe Foods" when the order has adjustments |
| "Bill" | The rows of `BillTotals` ([cart-and-bill.md](../business-logic/cart-and-bill.md)); when the final total differs or there are adjustments, the final bill under "Final bill after delivery" with "Agreed at your order" and the first total below; the boxes line |
| "Delivery address" | The address as ordered, "Your note: …" when the order has one, "You accepted our terms on …" |
| "Invoices and credit notes" | One row per document with its PDF, once the order has an invoice |
| "Returns", "Problems", "Your review" | For a signed-in customer; see their documents |
| "Cancel order" | A red button while the API allows it |

While the order loads, three grey blocks stand in its place. When the API has no such order (`ORDER_NOT_FOUND`) the page says "This order is gone." with "An order that was not paid is removed once it is cancelled." and "All orders". Any other failure shows "We could not load this page." with "Try again" (network failures, `429` and `502` to `504` are retried twice first).

### The timeline

Built in the browser by `buildTimeline` (`src/features/orders/orders.ts`) from the status, the payment and the three times the order carries; the API gives customers no history.

A step is done (a green tick), current (a halo, `aria-current="step"`), open (an empty ring) or a problem (red, with a cross).

| Step | Shown as | Line under it |
| --- | --- | --- |
| "Payment" | Done when paid or refunded; red when the last attempt failed; current while the order waits | "Paid." · "The last attempt did not go through." · "Pay now to confirm your order." · "Not paid." on a cancelled order |
| "Order confirmed" | With the day of the payment | "We have your order and get it ready soon." while current |
| "Being prepared" | – | "We are getting your order ready." while current |
| "On its way" | With the day of dispatch | The delivery method, once reached |
| "Delivered" | With the day of delivery | "Estimated delivery: …" with `delivery.estimate` of the settings, while not reached |
| "Everything returned" | Only for the status `returned` | – |
| "Cancelled" | Red; replaces every step after "Payment" | "A product sold out before the payment was captured. Nothing was charged." · "No payment arrived. Nothing was charged." · else who cancelled |

Example: status `dispatched`, payment `paid` on 12 November, dispatched on 13 November with DHL.

```
Payment          done      · 12 November 2026   "Paid."
Order confirmed  done      · 12 November 2026
Being prepared   done
On its way       current   · 13 November 2026   "Parcel with DHL"
Delivered        open                           "Estimated delivery: …"
```

### Paying an unpaid order

While the status is `pending_payment` the "Payment" panel shows "Amount" with the sum, a sentence that the order waits for its payment, the button "Pay €23.45 now" and "By card or PayPal, on the secure page of Stripe." The button opens the order's open payment page, or asks the API for one. Without online payment (`payment.canPayOnline` false) the panel says "Online payment is not available at the moment. Please try again later." A link with `?pay=1` (the payment-failed email) opens the payment page at once. The alerts after the way back from Stripe are in [payments.md](payments.md).

A paid order shows "Paid on …" with "by card" or "with PayPal", "Credited: …" and "Refunded: …" when there are such amounts, "Invoice …" (jumps to the documents) and "Receipt" (Stripe's page, new tab). A cancelled order that cost nothing says "Nothing was charged for this order."

### Cancelling

"Cancel order" opens a sheet "Cancel order RF-1084". Its introduction depends on the payment: "This order is not paid yet. If you cancel it, nothing is charged; your cart is still there for a new order." or "A placed order cannot be changed. You can cancel it here and order again; Radhe Foods refunds what you paid and tells you by email." Then "Why do you cancel?" with five reasons ("I changed my mind", "I ordered by mistake", "I chose the wrong products", "The delivery is too late for me", "Another reason"), an optional text, "Cancel the order now" and "Keep the order".

### Invoices

"Invoices and credit notes" lists every document of the customer, newest first, 25 at a time ("Show older documents"). A row (`DocumentRow`): "Invoice" or "Credit note" with its number, "Issued on …", for a credit note "for invoice …" and "Return" or "Correction", a link to the order, the amount (a credit note with a minus) and the button "PDF". Without documents: "You have no invoices yet. An invoice is issued with every paid order."

### A guest's order

`/guest/orders/RF-1084?token=…` is where the emails about a guest order and the way back from Stripe lead. The address is the same in both languages, is not indexed and sends no referrer. The page is the order page outside the account frame: "Back to the shop" in place of "All orders", no returns, problems or review, and at the foot "All your orders in one place" with "Create an account".

Without a usable token, or when the API refuses it (`ORDER_TOKEN_INVALID`, `VALIDATION_FAILED`), the page says "This link is not valid." with "Open the link from our email about this order again: it carries the key that opens the order." For `ORDER_NOT_FOUND` it says "This order no longer exists." with "An order that was not paid is removed once it is given up."

## Rules

### Statuses

| Order `status` | English wording | Chip | Payment `paymentStatus` | English wording | Chip |
| --- | --- | --- | --- | --- | --- |
| `pending_payment` | Waiting for payment | `wheat` | `pending` | Not paid yet | `wheat` |
| `confirmed` | Confirmed | `leaf` | `authorized` | Payment being confirmed | `wheat` |
| `processing` | Being prepared | `leaf` | `paid` | Paid | `green` |
| `dispatched` | On its way | `forest` | `failed` | Payment failed | `red` |
| `delivered` | Delivered | `green` | `refunded` | Refunded | `mute` |
| `returned` | Returned | `mute` | | | |
| `cancelled` | Cancelled | `mute` | | | |

The chip tones are set in `ORDER_STATUS_TONE` and `PAYMENT_STATUS_TONE`; `mute` is grey. Delivery methods: `radhe_delivery` "Delivered by Radhe Foods", `dhl` "Parcel with DHL", `hermes` "Parcel with Hermes".

| Case | What happens | Decided by |
| --- | --- | --- |
| The payment chip beside the status chip | Not while `pending_payment`; on a cancelled order only for `paid` and `refunded`; otherwise always (`showsPaymentChip`) | The browser |
| Whether "Cancel order" is offered | `order.canCancel`, and the order not cancelled meanwhile | The API |
| Which introduction the sheet shows | The paid one when `payment.paidAmount` is above zero | The browser |
| After cancelling an unpaid order of an account | The customer lands on the list (the API hides the order) | The browser |
| After cancelling a paid order, or any guest order | The page stays, with the cancelled order and "Your order is cancelled." | The browser |
| Which bill is shown | The final totals when `finalTotals.total` differs from `totals.total` or adjustments exist | The browser; the amounts are the API's |
| Whether "Pay now" is offered | Status `pending_payment`; the button only with `payment.canPayOnline` | The API |
| Where "Pay now" may lead | Only `https`, or `http` on the local machine (`isSafePaymentUrl`) | The browser |
| Which token opens a guest order | The one in the address when it is 8 to 256 letters, digits, `_` or `-`; else the one this tab kept | The browser; the API checks it |

For an order placed with delivery by the box (`order.shipping`, with at least one box) one line stands under the bill: "Delivery: {count} boxes, {weight} — " followed by "free with code {code}" (free by a code), "free" (no box paid), "{paid} × {perBox}" (no box free) or "{free} free, {paid} × {perBox}". Every figure is the order's own; see [shipping.md](shipping.md).

## Data and API

```
list         GET  /v1/store/orders?limit=25&cursor=…          read again at every visit
order        GET  /v1/store/orders/{n}                        read again at every visit
             GET  /v1/store/orders/{n}/payment                while waiting, or back from the payment page
             GET  /v1/store/invoices?orderNumber={n}&limit=100   once the order has an invoice
             GET  /v1/store/orders/{n}/returns | /issues | /review   once delivered
pay          POST /v1/store/orders/{n}/pay                    -> the address of the payment page
cancel       POST /v1/store/orders/{n}/cancel                 { reason, text? }
invoices     GET  /v1/store/invoices?limit=25&cursor=…
PDF          GET  /v1/store/invoices/{number}/pdf             with the session
guest        GET  /v1/store/guest/orders/{n}?token=…          order, payment and documents in one answer
             POST /v1/store/guest/orders/{n}/pay?token=… | /cancel?token=…
             GET  /v1/store/guest/orders/{n}/invoices/{number}/pdf?token=…
```

- `orderCalls` in `src/features/orders/order-access.ts` gives the page the same six calls for an account and for a guest; a guest's three reads share one request.
- The token travels in the query, never in a header. It is kept per order in `sessionStorage` when the page opens (and by the guest checkout), and forgotten when the API refuses it.
- A PDF is fetched by the browser with the session, turned into a file and saved as `<number>.pdf`; a failure shows under the row.
- When the payment call answers a status other than the order's, the order, the list and the documents are read again. Cancelling invalidates the list, the payment and the account's overview.
- A guest who comes back with `?payment=success` to a paid order has the browser's cart emptied.
- The server reads only `delivery.estimate` from the settings; everything else is read in the browser.

## Behaviour

- The cancel form is a `Sheet`: from the bottom on phones, from the right on larger screens ([design-system/components.md](../design-system/components.md)).
- The two columns of progress and payment fold into one below `xl`, the bill and the address below `md`.

## Not built

- Ordering the same again, and changing an order after it was placed.
- Tracking inside the shop: the page links to the carrier.
- A history of status changes with their times: the API gives customers none.
- Searching or filtering the orders; reading an invoice in the page (documents are downloaded).
- The coins an order earned: the coins page lists them ([rewards.md](rewards.md)).

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(shop)/account/orders/page.tsx`, `src/app/[locale]/(shop)/account/invoices/page.tsx` | The list page and the invoices page |
| `src/app/[locale]/(shop)/account/orders/[orderNumber]/page.tsx` | The order page: reads `payment`, `pay` and the delivery estimate |
| `src/app/[locale]/(shop)/guest/orders/[orderNumber]/page.tsx` | The guest's order page: also reads `token` |
| `src/components/account/order-list.tsx` | `useOrders`, the list, the empty state |
| `src/components/account/order-detail.tsx` | The order page: timeline, items, bill, address, documents, cancelling |
| `src/components/account/order-payment.tsx` | The payment panel, the outcome alerts, "Pay now" |
| `src/components/account/order-bits.tsx` | Status chips, the address block, the order card, a document row with its download |
| `src/components/account/invoice-list.tsx` | The invoices page |
| `src/components/account/guest-order.tsx` | The guest's page: the token, its states |
| `src/features/orders/orders.ts` | Cache keys, chip colours, `showsPaymentChip`, `buildTimeline` |
| `src/features/orders/order-access.ts` | The calls of the order page by access (account or guest) |
| `src/features/orders/payment-url.ts` | `isSafePaymentUrl` |
| `src/lib/orders/guest-token.ts` | Keeping, reading and forgetting a guest's token |
