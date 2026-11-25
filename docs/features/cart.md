# Cart

The cart collects the pack sizes a customer wants to order, lets them change the quantities, shows the bill the API works out for them, and leads to the checkout. Every visitor has one: a visitor's cart is kept in the browser, a signed-in customer's cart by the API.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | October 2026 (the day is not recorded). The page as it is: 2026-11-24 |
| **Pages** | `/en/cart` · `/de/warenkorb` |
| **Code** | `src/app/[locale]/(shop)/cart/page.tsx`, `src/components/cart`, `src/features/cart`, `src/lib/cart` |
| **API** | [Cart](../api/endpoints.md#cart) |
| **State** | `localStorage` `rf.cart.v2` for visitors; the API for customers, cached under the query key `["cart", locale]`; the context of `CartProvider` |
| **Texts** | `cart`, `product` (the stepper, "Your cart is full …"), `shipping` (the box card), `home` (the row of suggestions) |
| **Tests** | `e2e/checkout.spec.ts` ("the cart"), `e2e/shipping.spec.ts`, `src/lib/cart/guest-cart.test.ts`, `src/features/cart/savings.test.ts`, `src/features/cart/shipping.test.ts` |
| **Backend reference** | [reference/backend/store-api.md](../reference/backend/store-api.md), section 8 |

The rules of the cart and of the bill (storage, limits, how changes are sent, every row of the totals, line issues) are in [business-logic/cart-and-bill.md](../business-logic/cart-and-bill.md). This document says what the customer sees.

## What the customer sees

### The cart page

The page is not for search engines (`robots: noindex, nofollow`). Its regions, in reading order:

| Region | Content |
| --- | --- |
| Title | "Your cart", and beside it the count: "3 products · 4 items" (`CartCount`: the number of lines and the sum of the quantities). No count for an empty cart and until the cart is known |
| A failed change | Above the list: "Your cart is full. Remove a product to add another." or the text of the API's error |
| The list | One frosted panel, named "Your cart" for assistive technology, one row per pack size |
| The summary | A frosted card beside the list from `lg`, under it below |
| The box card | Under the summary, only for a bill priced by the box |
| "Popular right now" | A frosted panel under the list with a row of product cards |
| The pill | Below `md`: the total and "Go to checkout", fixed above the tab bar |

Below `lg` the order is list, summary, box card, suggestions: the bill comes before products the customer did not choose.

### A line

| Part | Content | From |
| --- | --- | --- |
| Picture | The picture of the pack size on white; dimmed when the line has an issue | `line.product.image` |
| Brand | Small capitals over the name; left out when the admin gave none or a placeholder such as "N/A" | `brandOf` in `src/lib/format/product-name.ts` |
| Name | The name as a link to the product page of that size, the size after it in brackets: "Guava / Jamfal (500g)" | `formatProductName`, `formatPackSize` |
| Price per pack | `line.unitPrice`. When it is below the regular price: in red, the regular price struck through beside it, and the reduction as a small red badge ("−20%") | `line.unitPrice`, `product.pricing.regularPrice`, `product.pricing.discountPercent` |
| Stepper | Minus, the number, plus, as a pill of clear glass. Minus stops at 1, plus at the most that can be ordered | `ordering.maxQuantity` |
| Line total | What the line comes to; it drops into place when it changes | `line.lineTotal` |
| Heart | Saves the product with this pack size to the wishlist; the line stays in the cart | [wishlist](wishlist.md) |
| Bin | "Remove {name} from the cart": sets the quantity to 0 | – |
| Issue | A red note across the row with the API's reason and, where one tap settles it, "Set to {count}" | `line.issue` |

A line whose product is gone (`product` is `null`) shows "Currently not available" as its name, no price, no stepper, no heart; the bin stays. The six issues and what each offers are in [cart-and-bill.md](../business-logic/cart-and-bill.md#line-issues).

### The summary

| Order | Content | Shown |
| --- | --- | --- |
| 1 | "Summary" | Always |
| 2 | The free-delivery hint: "Add **{amount}** more for free delivery" with a bar, or "Delivery is free for this order"; the order value and "Free from {amount}" under the ends of the bar | Under the flat fee, while the shop has a free tier ([shipping](shipping.md)) |
| 3 | The totals: Subtotal, Discount, Discount code, Coins redeemed, Delivery, Total with "Tax included." | Always ([the rows](../business-logic/cart-and-bill.md#the-rows-of-the-totals)) |
| 4 | "Please sort out the marked products first." | While a line has an issue |
| 5 | "Go to checkout" | A link while the bill can be ordered and is up to date; otherwise switched off |
| 6 | "Continue to checkout: sign in, create an account, or order as a guest." | For a visitor whose bill can be ordered |
| 7 | "You pay in the next step, by card or PayPal." | Always |
| 8 | "Keep shopping", a link to all products | Always |

The discount code and the coins are entered at the checkout, not here. A code or coins a customer applied there stay with the stored cart, so their rows show in this summary too.

Under the summary stands the card of the boxes (`BoxShipping`) while the bill has `shipping` with at least one box. It replaces the free-delivery hint; the two never show together. See [shipping](shipping.md).

### "Popular right now"

The row of the home page (`ProductRow`, `ProductCard`), from the same cached answers: the products the admin marked as featured, or the first products of the catalogue while none is marked. Three cards across beside the summary, four on wide screens. A product that is in the cart is left out (`UnlessInCart`), also the moment it is added from the row. The panel is hidden when no card is left or the catalogue could not be read; the cart does not depend on it.

### States

| State | What shows |
| --- | --- |
| Loading | Two grey rows in a frosted panel and a grey summary; a second grey card when the shop's settings say delivery is by the box, so the page does not jump |
| Empty | A frosted panel: a bag icon, "Your cart is empty", "Put something in it: everything you add stays here until you order.", the button "Browse the range"; under it the row of suggestions |
| The bill could not be read | "We could not load the prices of your cart." with the error's text and a retry. This comes before "empty": a stored cart that could not be read is not an empty one |
| A change is on its way | The totals, the pill's total and the box card dim, the line totals fade, the checkout is switched off, a screen reader hears "Updating prices …" |
| A change failed | The message above the list; the numbers fall back to what the API holds |

### The cart outside its page

| Where | What | Code |
| --- | --- | --- |
| Header | A bag icon that leads to the cart, with the sum of the quantities in a wheat bubble ("99+" above 99); its spoken label carries the count ("Cart, 1 item", "Cart, empty"). It is where a product flies to when it is added | `src/components/shell/cart-link.tsx`, `src/features/cart/fly-to-cart.ts` |
| Tab bar on phones | The same bubble on the cart tab | `src/components/shell/tab-bar.tsx` |
| Bar on phones | Below `md`, as soon as something is in the cart: one slim green line above the tab bar with the count, the bill's total after a dot, and "View cart". Not on the cart page, the checkout, the sign-in page and the product page, which have a bar or a summary of their own | `src/components/cart/cart-summary-bar.tsx` |
| Any page | A toast for eight seconds when a product could not be added: the cart is full, the product is gone, the shop cannot be reached. The cart page shows the same message in its own place | `src/components/cart/cart-problem.tsx` |

## Rules

| Case | What happens | Decided by |
| --- | --- | --- |
| Prices, line totals, delivery, discounts, the total | Printed from the bill | The API |
| Whether the cart can be ordered | `bill.canOrder` | The API |
| The way to the checkout | Open while `canOrder` is `true` and the bill on the page is the bill of the cart on the page | The browser (`src/components/cart/cart-view.tsx`) |
| The most of a line | The stepper's plus stops at `ordering.maxQuantity` | The API gives the number; the browser stops |
| Below the minimum of a product | The stepper goes down to 1; the API answers `quantity_below_minimum` and the line offers "Set to {min}" | The API |
| A line the customer removed | Leaves the list at once, before the API answered | The browser |
| The bar on phones asks for a bill | Only while it is visible (a phone, something in the cart, a page without its own summary): the preview is rate-limited | The browser (`src/components/cart/cart-summary-bar.tsx`) |
| The total in the bar on phones | Shown only while the bill is up to date; otherwise the count alone | The browser |
| Guest or customer | A visitor's cart lives in the browser and is priced by the preview; a customer's is stored and answered by the API; on sign-in the first is handed to the second | [cart-and-bill.md](../business-logic/cart-and-bill.md#signing-in-and-signing-out) |

The browser computes three things on this page: the saving of the sale prices for the rows "Subtotal" and "Discount", the length of the free-delivery bar, and the counts beside the title. The formulas and worked examples are in [cart-and-bill.md](../business-logic/cart-and-bill.md#what-the-browser-computes).

## Data and API

| Step | Visitor | Customer |
| --- | --- | --- |
| The page opens | The server renders the title and the row of suggestions (`listProducts` with the home page's queries, and `getSettings` for the size of the placeholder). The cart itself is read in the browser | The same |
| The cart | `localStorage` | `GET /v1/store/cart`, asked together with the session |
| The bill | `POST /v1/store/cart/preview`, 350 ms after the last change | The answer of `GET /v1/store/cart` and of every change |
| A change | Written to `localStorage`, then a preview | `PUT /v1/store/cart/items/{variantId}` 300 ms after the last tap on that pack size; quantity `0` removes |
| After sign-in | `POST /v1/store/cart/merge`, once | – |

Answers are kept for 30 seconds (TanStack Query). An error of the first read shows the error state with a retry; an error of a change shows the message above the list and reads the cart again. The endpoints themselves are in [api/endpoints.md](../api/endpoints.md#cart).

## Behaviour

- **Layout.** From `lg` two columns: the list with the suggestions under it, and the summary 380 px wide beside both, which stays in view while the page scrolls. From `sm` the list is one grid and every row a subgrid of it, so the steppers and the line totals of all rows stand under each other. On phones the texts take the first row beside the picture; the stepper, the line total, the heart and the bin share the second.
- **The pill on phones.** Below `md` the total and "Go to checkout" float above the tab bar. The pill follows the same rule as the button of the summary.
- **Keyboard and screen reader.** The stepper is a group named "Quantity of {name}" with the buttons "One less" and "One more"; the number is announced when it changes. The line total is read as "Total: …", a reduced price as "Price: …" and "Regular price: …". The summary is a landmark named "Summary".
- **Motion.** The panels rise as they arrive, one after the other. An amount that changed drops into place (the line totals, the total, the count beside the title); the bar runs to its length. The reduced-motion preference stills all of it ([motion](../design-system/motion.md)).

## Not built

| Not in the shop | Note |
| --- | --- |
| A discount code or coins on the cart page | Both are entered at the checkout ([discount codes](discount-codes.md), [rewards](rewards.md)) |
| "Save for later" | The heart of a line saves to the wishlist and leaves the line in the cart |
| Undo after removing a line | – |
| "Empty the cart" | The API has `DELETE /v1/store/cart`; no page calls it |
| A cart drawer or a mini cart in the header | The header links to the cart page |
| A note for the delivery | Not asked anywhere |
| Typing a quantity | The stepper has no field |
| Reserving stock | The API reserves nothing before the payment; `ordering.remaining` can change while a product is in the cart |

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(shop)/cart/page.tsx` | The page: title, count, the texts of the `shipping` namespace, the row of suggestions handed to the view |
| `src/components/cart/cart-view.tsx` | `CartView` (list, summary, pill, the states), `CartLine`, `CartCount`, `UnlessInCart` |
| `src/components/cart/bill-summary.tsx` | `BillTotals` (the rows of a bill) and `FreeDeliveryProgress` (the flat fee's hint) |
| `src/components/cart/box-shipping.tsx` | `BoxShipping`, the card of the boxes |
| `src/components/cart/cart-summary-bar.tsx` | The slim bar on phones |
| `src/components/cart/cart-problem.tsx` | The toast for a change that failed |
| `src/features/cart/cart.tsx` | `CartProvider`, `useCart`, the hand-over on sign-in, `forgetGuestCart` |
| `src/features/cart/use-bill.ts` | `useBill`: the bill, `loading`, `updating` |
| `src/features/cart/savings.ts` | The saving of the sale prices |
| `src/features/cart/shipping.ts` | The case of a bill priced by the box and the length of its meter |
| `src/features/cart/fly-to-cart.ts` | The flight of a picture into the cart icon |
| `src/lib/cart/guest-cart.ts` | The visitor's cart in `localStorage` |
| `src/components/ui/quantity-stepper.tsx` | The stepper |
| `src/components/shell/cart-link.tsx` | The cart icon of the header and its bubble |
