# Checkout

The checkout turns a cart into an order. On one page the customer says who orders and where the delivery goes, sees the order with its bill, accepts the terms and presses "Buy now"; the shop creates the order through the API and hands the browser to the payment page. A signed-in customer orders the cart stored by the API; a visitor may order as a guest with an email address alone.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | October 2026 (the day is not recorded). The guest checkout: 2026-11-01. The page as it is: 2026-11-24 |
| **Pages** | `/en/checkout` · `/de/kasse`; the guest order page `/en/guest/orders/{orderNumber}` · `/de/guest/orders/{orderNumber}` (the same path in both languages) |
| **Code** | `src/app/[locale]/(checkout)`, `src/app/[locale]/(shop)/guest/orders/[orderNumber]/page.tsx`, `src/components/checkout`, `src/features/checkout`, `src/lib/checkout`, `src/components/account/guest-order.tsx` |
| **API** | [Orders and checkout](../api/endpoints.md#orders-and-checkout), [Cart](../api/endpoints.md#cart), [Addresses](../api/endpoints.md#addresses), [Settings and legal texts](../api/endpoints.md#settings-and-legal-texts) |
| **State** | The API; `sessionStorage` `rf.checkout.key.v1` and `rf.checkout.for.v1` (the idempotency key and its order), `rf.guest-order.v1:{ORDERNUMBER}` (a guest order's token); a guest's cart in `localStorage` `rf.cart.v2`; what a guest types stays in the page |
| **Texts** | `checkout`, `address`, `cart` (the totals), `shipping`, `product` (prices, "Accepted payment methods"); the guest order page: `orders`, `payment` |
| **Tests** | `e2e/checkout.spec.ts`, `e2e/guest.spec.ts`, `e2e/shipping.spec.ts`, `e2e/rewards.spec.ts`, `src/lib/checkout/order-attempt.test.ts`, `src/features/checkout/address-schema.test.ts`, `src/lib/orders/guest-token.test.ts` |
| **Backend reference** | [reference/backend/store-api.md](../reference/backend/store-api.md), sections 9 and 20; [reference/backend/customer-accounts.md](../reference/backend/customer-accounts.md) for the guest checkout |

## What the customer sees

### The frame

The checkout has a layout of its own (`src/app/[locale]/(checkout)/layout.tsx`): a pill of glass at the head of the page with the logo, a lock with "Secure checkout", "Back to the cart" and the language switch. No navigation, no search, no footer, no tab bar. The page's `h1`, "Checkout", is for screen readers and the tab; the page is not for search engines.

### Who can check out

`CheckoutView` asks the API who is here even when the browser has no sign of a session (`useSession({ force: true })`).

| Who | What shows |
| --- | --- |
| Not known yet | Grey placeholders |
| The API could not say | "We could not load your checkout." with a retry; the guest checkout is not offered to someone who may be signed in |
| A visitor | The chooser: "How would you like to order?", a sentence on what an account keeps, the buttons "Sign in" (to the sign-in page, which returns here) and "Continue as guest", and "New here? Create an account" |
| A visitor who chose "Continue as guest" | The page, with the browser's cart |
| A customer | The page, with the stored cart |

The choice of a guest is kept in the page only; a reload shows the chooser again.

### The page

Two columns from `lg`: on the left who orders and where it goes, on the right the order, which stays in view.

**Who orders.** A customer sees "Your account": the initials, the name, the email address and "Signed in", all from the session. A guest sees "Your email address": the field "Email address" with "The confirmation, the invoice and every update about your order go to this address.", and "Already have an account? Sign in".

**Delivery address**, with "Germany" beside the title.

| | A customer | A guest |
| --- | --- | --- |
| What shows | The saved addresses as cards to choose from: the label, the name, the company, street and house number, the second line, postcode and city, "Standard" on the standard one, and "Edit" on each | The form itself |
| Chosen at first | The standard address, else the first | – |
| Adding | "Add an address", while fewer than ten are saved; with no address the form shows at once | – |
| The form | Label (optional), first name, last name, street, house number, address line 2, postcode, city, phone (optional), "Add a company", "Use as my standard address" (not for the first address), "Save address", "Cancel" | First name, last name, street, house number, address line 2, postcode, city, phone (optional), "Add a company". No label, no standard address, no "Save address" |
| Where it goes | Saved with the account through the API; the new address is chosen | Nowhere until "Buy now": it travels with the order alone |

At the checkout the labels rest inside the fields and rise when a field has the focus or a value; the country is not a field. The rules of the fields are in [forms and validation](../business-logic/forms-and-validation.md).

**Your order**, with the number of items beside the title:

| Order | Part | Content |
| --- | --- | --- |
| 1 | The lines | Per pack size: the picture with the quantity on its corner, the name with the size, the price per pack (a reduced one with the regular price struck through and the percent), the line total. About five lines show; more scroll inside, with "Scroll to see more items" under the list until the customer scrolls |
| 2 | Delivery estimate | "Delivery: …" with `delivery.estimate` of the settings; left out when there is none |
| 3 | Discount code | "Add a discount code" opens the field ([discount codes](discount-codes.md)) |
| 4 | Coins | For customers ([rewards](rewards.md)) |
| 5 | Notes on free boxes | When a code or coins cost a free box ([shipping](shipping.md)) |
| 6 | The totals | [The rows of the bill](../business-logic/cart-and-bill.md#the-rows-of-the-totals); under them "You will earn {coins} coins with this order." while `rewards.earn` is above 0 |
| 7 | Alerts | Whatever stops or changed the order (the tables below) |
| 8 | Consent | A checkbox: "I have read and accept the Terms and Conditions, and I have read the Privacy Policy.", the two names as links that open in a new tab |
| 9 | "Buy now" | With a lock; below `lg` it is in the pill at the foot of the screen instead |
| 10 | Payment marks | Visa, Mastercard, American Express, PayPal ([payments](payments.md)) |

Under the card stands the card of the boxes when the bill is priced by the box.

### Loading, empty and error states

| State | What shows |
| --- | --- |
| The bill, the addresses or the legal versions are on their way | Grey placeholders in the shape of the page |
| One of them could not be read | "We could not load your checkout." with the error's text and a retry of all three |
| Nothing to order (no lines, or a guest with an empty cart) | "There is nothing to order", "Your cart is empty.", "Back to the shop" |
| The bill is being read again | The totals, the pill's total and the box card dim; "Buy now" is switched off |

## Rules

### What "Buy now" checks

`place()` in `src/components/checkout/checkout-view.tsx` runs these checks in order and stops at the first that fails. What stops the order takes the focus or comes into view, because on a phone the button floats far from the field it complains about.

| Order | Check | When it fails |
| --- | --- | --- |
| 1 | Guest: the address form (`AddressFormHandle.validate`, the rules of `src/features/checkout/address-schema.ts`) and the email address (`checkEmail`) | The refused fields show their messages; "Please enter a valid email address." at the email field; "Please fill in the marked fields." above the consent. The focus goes to the email field when that is refused, else to the first refused field of the address |
| 1 | Customer: an address is chosen and no address form is open | "Please choose or add a delivery address."; the address panel scrolls into view |
| 2 | The consent is ticked | "Please accept the terms to place your order."; the focus goes to the checkbox |

The button itself is switched off while `bill.canOrder` is `false`, while the bill is being read, after the API said the shop cannot sell, and after it said this order was placed already.

### What is sent

| | A customer | A guest |
| --- | --- | --- |
| Call | `POST /v1/store/checkout` | `POST /v1/store/guest/checkout` |
| The goods | The cart stored by the API; nothing is sent | `items`: the browser's cart, `{ variantId, quantity }` each |
| Who | The session | `email`, trimmed and in lower case |
| Where | `addressId` of the chosen address | `address`: the typed fields with `countryCode` `"DE"`; empty optional fields as `null`; the phone number normalised |
| Code | Kept with the cart by the API | `discountCode`, only when one is applied |
| `expectedTotal` | `totals.total` of the bill on the screen | The same, of the preview on the screen |
| `consent` | `{ accepted: true, versions }` | The same |
| `language` | The language of the page | The same |
| Header | `Idempotency-Key` | The same |

`versions` are the versions of the legal texts the API marks with `requiresConsent` (the terms and the privacy policy), read from `GET /v1/store/legal` when the page opened (`consentVersions` in `src/lib/checkout/order-attempt.ts`). The API's optional `note` is never sent.

Whether the total, the stock, the address, the code, the coins and the versions still hold is decided by the API ([store-api.md](../reference/backend/store-api.md), section 9).

### The idempotency key

`checkoutKey` in `src/lib/checkout/order-attempt.ts` makes the key when the customer orders, not when the page opens.

| Case | Key |
| --- | --- |
| First press | A fresh UUID (`crypto.randomUUID`, or 32 hexadecimal characters where that is missing), kept in `sessionStorage` with a fingerprint of the order |
| The same order again (the answer was lost, the customer pressed again, the tab was reloaded) | The same key: the API answers the first order and its payment page instead of a second order |
| Anything of the order changed (the address, a line, a quantity, the total, the code, the versions, a guest's email) | A key of its own: the API answers a key it knows with the first order, whatever is sent with it |
| An order was answered, or the API said `ORDER_NOT_PAYABLE` | The key is dropped (`clearCheckoutKey`) |
| `sessionStorage` is blocked | The key lives in memory for the page |

The fingerprint is a 32-bit FNV-1a hash of the request and the lines of the bill, with the length of the text: no address and no email address is stored beside the key.

### What the API can answer, and what the customer sees

| Answer | The customer sees | The page |
| --- | --- | --- |
| The order | "Taking you to the payment page …" on the button, then the payment page | See "After the order is created" |
| `409 CUSTOMER_EMAIL_TAKEN` (guest) | The sign-in page with the email address filled in | Navigates to `/sign-in` with `returnTo=/checkout`; the cart stays in the browser and is handed over after the sign-in |
| `409 ORDER_TOTAL_CHANGED` | "The total has changed", with the total before and after from the error's details | Reads the bill again |
| `409 LEGAL_VERSION_CHANGED` | "Our terms were updated": "Please read the current version and accept it again." | Unticks the consent and reads the versions again |
| `409 ORDER_ITEMS_NOT_ORDERABLE` | "Some products cannot be ordered right now.", the refused products by name (a pack that is too heavy says so), and "To the cart" | Reads the bill again |
| `409 DISCOUNT_NOT_APPLICABLE` | "Your discount code {code} was removed", with the reason | Drops a guest's code and reads the bill again |
| `409 REWARDS_NOT_APPLICABLE` | "Your coins were not redeemed", with the reason | Reads the bill again |
| `503 PAYMENTS_NOT_CONFIGURED` | "Checkout is not available right now": online payment is not set up; the cart stays saved | "Buy now" stays switched off until the page is loaded again |
| `409 COMPANY_DETAILS_MISSING`, `409 LEGAL_DOCUMENTS_MISSING` | "Ordering is not possible yet": the shop is still being completed; the cart stays saved | The same |
| `409 ORDER_NOT_PAYABLE` | "This order was already placed": the earlier attempt went through. A customer gets "To my orders"; a guest is pointed to the email about the order | Drops the key; "Buy now" stays switched off |
| An order whose payment page has an address `isSafePaymentUrl` refuses | The text of `PAYMENT_PROVIDER_ERROR`, with a retry | Does not leave the shop |
| Anything else (the network, `429`, `502 PAYMENT_PROVIDER_ERROR`, `404 ADDRESS_NOT_FOUND`, `409 CART_EMPTY`, `403 CUSTOMER_BLOCKED`, …) | The text of the error ([error handling](../api/error-handling.md)); a retry button for `PAYMENT_PROVIDER_ERROR` | Reads the bill again, and the addresses after `ADDRESS_NOT_FOUND` |

The same alert shows without a refusal while `bill.canOrder` is `false`: "Some products cannot be ordered right now." with the way to the cart, where each line says what is wrong.

### After the order is created

```
the API answers { created, order, checkout: { url, expiresAt } }   (a guest also gets token)
  →  the key of this attempt is dropped
  →  a guest's token is kept for the tab (sessionStorage), the order is cached
  →  the address of the payment page is checked (https; http for localhost only)
  →  window.location.assign(checkout.url)
```

From there on: [payments.md](payments.md).

## Data and API

| When | Call | Notes |
| --- | --- | --- |
| The page is rendered | `GET /v1/store/settings` on the server | The delivery estimate; the size of the placeholder |
| The page opens | `GET /v1/store/me` | Who is here |
| A customer | `GET /v1/store/cart`, `GET /v1/store/me/addresses`, `GET /v1/store/legal` | The bill and the legal versions are always asked afresh |
| A guest | `POST /v1/store/cart/preview` with the browser's cart and the code, `GET /v1/store/legal` | Asked again when the cart or the code changes |
| An address is saved | `POST /v1/store/me/addresses` or `PATCH /v1/store/me/addresses/{id}` | The answered list replaces the cached one |
| "Buy now" | `POST /v1/store/checkout` or `POST /v1/store/guest/checkout` | With `Idempotency-Key` |

## The guest order page

The emails about a guest order and the way back from the payment page lead to `/guest/orders/{orderNumber}?token={token}`. The page stands in the shop's frame, outside the account; it is not for search engines and sends no referrer.

| Case | What shows |
| --- | --- |
| A token in the address, or one kept for this tab | The order, read with `GET /v1/store/guest/orders/{orderNumber}` and the token as the query parameter `token` |
| No token, or the API refuses it | "This link is not valid.", with the advice to open the link of the email again, and "Back to the shop". A refused token is forgotten |
| The order is gone | "This order no longer exists.": "An order that was not paid is removed once it is given up." |
| Another error | The error's text with a retry; the network, `429` and `502` to `504` are tried twice more first |

The order itself is the page of an account's order (`OrderBody`, see [orders](orders.md)) without returns, problem reports and the review, and with a card "All your orders in one place" that leads to the sign-up. Opened with `?payment=success` for a paid order, the page empties the browser's cart.

## Behaviour

- **Layout.** 1160 px wide at most, like the header pill. Below `lg` one column: who orders, the address, the order, the boxes.
- **The pill.** Below `lg` "Total, tax included", the total and "Buy now" are fixed at the foot of the screen. One of the two buttons is on the screen at a time; the other is `display: none`, so assistive technology meets one.
- **Keyboard and screen reader.** The list of lines can be focused, since it scrolls. The messages of a failed check are alerts; the consent's message is tied to the checkbox. The quantity on a picture is hidden from screen readers, which hear "2 ×" before the name instead.

## Not built

| Not in the shop | Note |
| --- | --- |
| A note for the delivery | The API takes `note`; the page has no field and sends none |
| A billing address apart from the delivery address | – |
| Delivery outside Germany, a choice of country | `countryCode` is always `"DE"` |
| A choice of delivery method, date or time | The estimate of the settings is all that is shown |
| Card fields or a payment form | The payment happens on Stripe's page ([payments](payments.md)) |
| Saving a guest's address or email address for the next visit | – |
| Coins for a guest | `RedeemCoins` is rendered for customers only |
| A confirmation page of the checkout, or steps on separate pages | One page; the order page is where the customer lands |

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(checkout)/layout.tsx` | The frame: the header pill, the texts of the area |
| `src/app/[locale]/(checkout)/checkout/page.tsx` | The page: the title, the settings handed to the view |
| `src/app/[locale]/(checkout)/error.tsx` | The error page of the area |
| `src/components/checkout/checkout-view.tsx` | `CheckoutView`: the chooser, the panels, the summary, `place()`, every alert, the pill |
| `src/components/checkout/address-form.tsx` | `AddressForm` in its two uses, `saved` and `order`, and `AddressFormHandle` |
| `src/components/checkout/discount-code.tsx`, `src/components/checkout/redeem-coins.tsx` | The discount code and the coins |
| `src/features/checkout/address-schema.ts` | The rules of an address, `toAddressInput`, `toGuestAddressInput` |
| `src/lib/checkout/order-attempt.ts` | The idempotency key, `consentVersions`, `requiresConsent` |
| `src/features/orders/payment-url.ts` | `isSafePaymentUrl` |
| `src/lib/orders/guest-token.ts` | The token of a guest order in `sessionStorage` |
| `src/app/[locale]/(shop)/guest/orders/[orderNumber]/page.tsx` | The guest order page |
| `src/components/account/guest-order.tsx` | `GuestOrderView`: the token, the states, the order |
| `src/features/orders/order-access.ts` | The calls of an order page, by account or by token |
