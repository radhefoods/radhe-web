# Migration brief: Radhe Foods customer web (`radhe-web`)

You are the engineer of the existing Next.js shop in this folder. Its backend, `radhe-api`, changed on 2026-10-16 from a pre-order platform to a standard online shop: products are sold from stock and paid at checkout. Your job is to adapt the shop to the new backend. The owner (Vrushabh) decides; when something is unclear, ask him before you build. Never assume what the API does: read it in the API documentation or ask.

---

## 1. The rule above all others: the design stays

Do not change the theme, colours, fonts, typography, spacing, layouts, components, animations or the visual identity of the shop. Reuse the existing components, tokens and patterns for everything new: a new status uses the existing badge, a new notice uses the existing notice, a new form field uses the existing field. What you change is functionality, business logic, API integration and the minimal UI adjustments the new flow forces:

- elements that only existed for the old model are removed (the cargo strip, the countdown, the pay-later notes, the pay-link page);
- texts that describe the old model are rewritten in the same place with the same components;
- states the shop did not have (an order waiting for its payment, a sold-out product, a payment that failed) are shown with existing components.

When a page's content must change for the new flow (checkout, order detail), its look stays.

---

## 2. What changed

| | Until now (pre-order) | Now (shop) |
|---|---|---|
| Buying | Orders were collected for a cargo (an ordering cycle) with a deadline; the shop was closed between cargos | The customer buys at any time from stock; a product with no stock is sold out |
| Paying | After delivery: pay link, Stripe page or cash, with a deadline, reminders and a block for overdue customers | At checkout, on a Stripe page (card or PayPal). The payment confirms the order. Nothing is charged before, nothing is paid later |
| Order statuses | `confirmed`, `preparing`, `dispatched`, `delivered`, `delivery_failed`, `returned`, `cancelled` | `pending_payment`, `confirmed`, `processing`, `dispatched`, `delivered`, `returned`, `cancelled` |
| Payment statuses | `not_enabled`, `due`, `overdue`, `paid`, `waived`, `refunded` | `pending`, `authorized`, `paid`, `failed`, `refunded` |
| Legal texts | `terms`, `preorder_terms`, `privacy` | `terms`, `privacy` |
| Delivery | A promised window per cargo | A delivery estimate from the settings; the carrier is chosen by Radhe Foods |
| Invoice | Issued when the payment was activated after delivery | Issued the moment the payment is captured; the PDF comes with the confirmation email |
| Stock | Per cargo | Per pack size: `ordering` on every product entry and on every entry of its `variants` says whether and how many can be bought |
| Products | One article per product | One product with one or more pack sizes (`variants`): each size has its own id, URL, price and stock; the cart, the orders and the returns name the size (`variantId`). Section 6 |

Unchanged in principle: the catalogue and the cart (guest cart in local storage, server cart after sign-in), though both are now keyed by pack size (section 6); sign-in with email code or Google, the account with profile, communication preferences and addresses, invoices and credit notes with PDF, returns, cancellation by the customer, the unsubscribe page, the legal pages from the API, the static legal pages (imprint, withdrawal, cookies), SEO, both languages.

---

## 3. Files to read, in this order

| File | What to read |
|---|---|
| This brief | All of it |
| `ARCHITECTURE.md` | Sections 1, 2, 6 (status models), 7 (key flows), 8 (authentication), 9 (localization) |
| `CUSTOMER_WEB_API_DOCUMENTATION.md` | **The authority.** Section 0 (conventions) and sections 6 to 15 completely; sections 1 to 5 as a check that nothing changed there |

Both files come from `radhe-api/doc/` and replace the copies under `doc/` of this repository, which describe the old API. Delete `doc/Radhe_Foods_Preorder.md`, `doc/Radhe_Foods_Preorder_Core_Concept.md` and the old `doc/PROMPT_CUSTOMER_WEB.md`; put this brief in their place.

Rule: **where any other text (this brief, README, DECISIONS, code comments) and the API documentation differ, the API documentation is right.** Do not invent endpoints, fields, statuses or error codes. Where the API lacks something you need, say so and ask the owner; do not work around it silently.

---

## 4. API changes

### 4.1 Endpoints

Removed. Delete their client functions, types, mocks, tests and every caller:

- `GET /v1/store/cargo`
- `GET /v1/store/me/ordering`
- `POST /v1/store/orders` (placing a pre-order)
- `POST /v1/store/orders/{orderNumber}/checkout`
- `GET /v1/pay/{token}` and `POST /v1/pay/{token}/checkout` (pay links)

New:

- `POST /v1/store/checkout` (section 9): the cart becomes an order and the answer carries the Stripe page.
- `POST /v1/store/orders/{orderNumber}/pay` (section 10): a new payment page for a pending order.

Changed answers. Re-read these sections and update `src/lib/api/types.ts` to match them exactly: products with their pack sizes (`variants`, `variantId`, `displayName`) and `ordering` (7), cart and bill keyed by `variantId` (8), orders with `payment`, `cancellation`, `returns` and `canCancel` (9), payment (10), settings and legal (6), invoices (11), returns (12), the status reference (13), the error codes (0.4 and per endpoint).

### 4.2 Error codes

Gone, with their translations: `ORDERING_BLOCKED`, `ORDERING_CLOSED`, `PAYMENT_OVERDUE`, `CARGO_PRODUCT_*`, `PAYMENT_NOT_ACTIVATED`, `PAYMENT_NOT_POSSIBLE`, `PAYMENT_NOTHING_DUE`, `PAY_LINK_INVALID`.

Checkout answers these, in the order the API checks them: `400 VALIDATION_FAILED`, `400 IDEMPOTENCY_KEY_REQUIRED`, `503 PAYMENTS_NOT_CONFIGURED`, `409 COMPANY_DETAILS_MISSING`, `403 CUSTOMER_BLOCKED`, `404 ADDRESS_NOT_FOUND`, `409 LEGAL_DOCUMENTS_MISSING`, `409 LEGAL_VERSION_CHANGED`, `409 CART_EMPTY`, `409 ORDER_ITEMS_NOT_ORDERABLE`, `409 ORDER_TOTAL_CHANGED`, `409 ORDER_NOT_PAYABLE`, `502 PAYMENT_PROVIDER_ERROR`, `429 RATE_LIMITED`. Each has a documented `details` shape and a documented reaction (section 9). `POST …/pay` answers `409 ORDER_NOT_PAYABLE` when the order can no longer be paid.

---

## 5. The new flow, and what to do with the existing code

### 5.1 Checkout

Keep the checkout page and the address form as they look. Replace the call: `POST /v1/store/checkout` with the `Idempotency-Key` header (8 to 64 characters; keep the existing key per attempt in session storage and reuse it on retries, as section 9 describes), body `addressId`, `expectedTotal` (the `totals.total` the customer saw), `consent { accepted: true, versions: { terms, privacy } }` from `GET /v1/store/legal`, and the optional fields the documentation lists. The answer is `{ created, order, checkout: { url, expiresAt } }`; redirect the browser to `checkout.url` (keep the existing URL safety check). A repeated key answers the first order with `200` and `created: false`.

Remove from the page: the ordering permission (`/me/ordering`), the overdue list and blocked reasons, the delivery window, the pre-order consent and the "binding pre-order" wording. The consent checkbox stays, for `terms` and `privacy` only, with links to the exact versions. The final button must say that the customer pays now ("Zahlungspflichtig bestellen" / "Buy now") and the total with VAT and delivery fee stays visible next to it; the button keeps its style.

### 5.2 The way back from Stripe

Stripe sends the customer to `/account/orders/{orderNumber}?payment=success` or `?payment=cancelled` (section 10 gives the exact URLs and the table of states). The emails link to `/account/orders/{orderNumber}` and, after a failed payment, to `/account/orders/{orderNumber}?pay=1`, which must open the payment page straight away.

So the order detail page is where the customer lands after paying. It calls `GET /v1/store/orders/{orderNumber}/payment`, which asks Stripe about an open page, and shows the real state: paid (confirmation), still pending after `?payment=success` (poll every few seconds, as documented), cancelled page or failed attempt ("Pay now"), order cancelled with `cancellation.reason = sold_out` (say so plainly, nothing was charged, offer the cart). The existing polling on the order page is close to this; change the endpoint shapes and states rather than rebuilding the page.

The route `checkout/confirmation/[orderNumber]` is no longer where a customer arrives after checkout. Propose in your plan whether to remove it or to reuse its "thank you" content inside the order page for a paid order; choose the smaller change.

### 5.3 Pay now

The order page shows "Pay now" while `payment.canPayOnline` is `true`: open `payment.checkout.url` when a page is still open, else call `POST /v1/store/orders/{orderNumber}/pay` and redirect to the `url` it answers. `payment.lastFailure` is for developers; show a generic message. The existing "Pay now" button does nearly this with the old endpoint.

### 5.4 Order list and detail

- Statuses: `preparing` becomes `processing`, `delivery_failed` disappears, `pending_payment` is new and comes first ("waiting for payment"). Update labels, tones and the timeline builder in `features/orders`; the timeline's payment step follows the new payment block.
- The payment panel loses `not_enabled`, `due`, `overdue`, deadline, cash and waived. It shows the payment status, method and type, `receiptUrl`, `refundedAmount`, the invoice link (`payment.invoice`) and the "Pay now" state of 5.3. Fields: section 9 and 10.
- `canCancel` decides the cancel button; the reasons are the customer's list in section 13.
- The returns block stays; check its fields against section 12. Items are named by `variantId`, in the request and in `returnable`.

### 5.5 Catalogue and cart

- Availability comes from `ordering` on every pack size (`canOrder`, `reason` = `sold_out` or `product_unavailable`, `remaining`, `minQuantity`, `maxQuantity`; on the product entry for the size it shows, and on every entry of `variants`) and from `lines[].issue` in the cart and the bill's `canOrder`. Remove `useOrderingOpen`, the cargo reasons, the cargo promise line and the guest-cart clamp to the cargo; clamp to the `ordering` of the chosen pack size instead.
- Show sold out and "few left" (when `remaining` is small) with the existing badge styles, per pack size. The add-to-cart button and the quantity chooser follow the chosen size's `ordering`.
- The cart loses the countdown, the closed state and "Due today". Its bill is the API's bill; the checkout button follows `canOrder`. Lines are pack sizes (section 6).
- JSON-LD: `Offer.availability` is `InStock` or `OutOfStock` from `ordering`, no longer `PreOrder`; one offer per pack size (section 6).

### 5.6 Pages to remove, pages whose copy changes

Remove: `/pay/[token]` with its view and its entries in `robots.ts` and `proxy.ts`; `/legal/preorder-terms` and its footer link; the `components/cargo` folder (strip, countdown, next-delivery card, pay-later note); the `CargoProvider` and its hooks; the server `getCargo` fetch with its revalidation tag; the `cargo` message namespace; the pay-later band and chips in the styleguide.

Rewrite the copy, in the same components and layouts: home (the call to action no longer depends on an open cargo; the three steps are choose, pay, delivered; the delivery promise comes from `GET /v1/store/settings`: `deliveryFee.tiers`, `freeFrom`, `delivery.estimate`, `returns.windowDays`), how-it-works, delivery-and-payment (fee tiers, estimate, payment at checkout by card or PayPal, cancellation until dispatch, the return window), the product page (no pay-later note), the cart, the sign-in note before checkout, the site tagline, the footer.

### 5.7 Messages

Remove the message keys of the old model (the `cargo` namespace and the keys about pay-later, deadlines, overdue, cash, waived, pay links, `delivery_failed`, the old payment statuses and the old error codes). Every new key goes into `en.json` and `de.json` (a test enforces it); German in the formal "Sie", written the way a German speaker writes it. Error codes are translated; the API's English `message` is never shown.

### 5.8 Mocks and tests

`mocks/`: remove the cargo, ordering, pay-link, activation, cash and overdue parts; add `POST /v1/store/checkout` (answering a checkout URL that the mock serves itself), `GET …/orders/{n}/payment` in its states, `POST …/orders/{n}/pay`, and controls that let a test make a payment succeed, be cancelled, expire, fail, or make an item sell out before settlement. Update the unit tests and the Playwright specs that cover the old flow (catalogue, checkout, account, public links, accessibility, polish); the new e2e flow is cart → checkout → Stripe page (mocked) → order page in each state.

### 5.9 Documentation of this repository

Update `README.md` and `DECISIONS.md`: remove the pre-order decisions (countdown, live ordering, checkout wording, payment after delivery, email links) and record the new ones.

---

## 6. Pack sizes

A product comes in one or more pack sizes. The product holds the name, texts, images, category, VAT rate and the quantity limits; each pack size (`variants[]`) has its own `id`, article number (`sku`), URL (`slug`), `packSize`, `pricing`, stock and `ordering`. One size is the **default** (`isDefault`): the smallest enabled size in stock. Section 7 of the API documentation has the shapes; section 7.1 the pack size entry.

- **Listing.** `GET /v1/store/products` answers one entry per product, shown as its default size or, with the `packSize` filter, as the smallest size asked for. The entry's `variantId`, `sku`, `slug`, `packSize`, `pricing` and `ordering` belong to that size. `displayName` ("Basmati Rice (1 kg)") is the title of the card; `name` is the product name without the size. `variants[]` lists every enabled size, smallest first, with the same fields each.
- **Product page.** The URL of a product page is the URL of a pack size: `/products/basmati-rice-1kg`. `GET /v1/store/products/{slug}` also takes the base slug (`basmati-rice`) and answers the default size. The answer carries every enabled size in `variants` (the selected one has `isSelected: true`), so the size chooser switches without a request: render the chosen size from the same answer (its `slug`, `displayName`, `pricing`, `ordering`; images and texts are shared) and change the URL to its `slug` with the history API (`history.pushState`). `slugs` is the selected size's URL in both languages, for the language switch and `hreflang`. The URL of a disabled size answers 404.
- **SEO.** Every variant URL is canonical to itself (each size is an offer of its own, with its own price and stock). The base URL redirects permanently to the default size's URL (fetch the base slug, redirect to `product.slug`). The sitemap lists the variant URLs. JSON-LD is a `ProductGroup` with `hasVariant` holding one `Product` per entry of `variants` (`url`, `sku`, `offers` with `price` and `availability` from its `ordering`, the pack size as `weight` or `size`). The page title and `og:title` are the `displayName`.
- **Cart.** Lines are keyed by pack size: `PUT` and `DELETE /v1/store/cart/items/{variantId}`, and `preview` and `merge` take `items: [{ variantId, quantity }]`. `variantId` is `variants[].id` of the chosen size. The guest cart in local storage stores `variantId` and `quantity` per line; every line of the bill carries `variantId` and `productId`, and `lines[].product` is the list entry with that size selected. Order items, `adjustments` and return items carry `variantId`; a return request names items by `variantId` (section 12).
- **Price per unit.** German price law requires the price per kilogram, litre or piece next to every price. Show `pricing.basePrice` (`amount` in cents, `per` = `kg`, `l` or `pcs`) wherever a price is shown: list cards, the product page for the chosen size, the cart lines. The API computes it; the shop never does.

---

## 7. API facts you must respect

- Base URL `<NEXT_PUBLIC_API_URL>/v1`, JSON, errors as `{ error: { code, message, details? }, requestId }`. Translate the `code`; show the `requestId` on unexpected errors.
- Cookie authentication with `credentials: 'include'`; on `401 AUTH_TOKEN_INVALID` refresh once through `POST /v1/store/auth/refresh` and retry. The existing transport does this; keep it.
- `?locale=en|de` on every store call. Money is integer cents; the shop never adds, multiplies or rounds prices; every total comes from the API.
- Unknown fields in a request body are rejected (`400 VALIDATION_FAILED`). Send only documented fields.
- Nothing is reserved before the payment. A product can sell out between the cart and the payment; the API then cancels the order with `sold_out` and charges nothing. The shop shows this; it cannot prevent it.
- Checkout needs a signed-in customer; there is no guest checkout. The customer never chooses a carrier, a delivery window or a payment deadline.
- Online payment, Google sign-in and WhatsApp may be switched off on the server; section 14 says how each shows and what the shop does.

---

## 8. How to work

1. Read the files of section 3 completely. Then write a short **plan**: every file you will remove, change or add, with the reason, the new type definitions, open questions, and anything the API cannot do. **Wait for the owner's go before editing.**
2. Build in phases, each ending with lint, type check and tests green and a short note of what was done and decided: types and API client → checkout and the way back from Stripe → order list and detail with "Pay now" → catalogue with pack sizes, cart by pack size and availability → removals, copy and messages → mocks and tests → README and DECISIONS.
3. Do not commit to Git unless asked. No secrets in the shop; it has none.
4. When the owner gives an instruction, follow it. When you believe it harms the result, say so once with a better alternative, then do what he decides.
5. The design does not change. If a change you think necessary would alter the look, ask first.
