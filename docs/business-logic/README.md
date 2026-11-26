# Business logic

The rules the shop applies, and who applies them. The shop is a window onto the backend: **prices, VAT, stock, the bill, discounts, coins, delivery fees, statuses and every rule of an order are decided by the API**, and the browser prints what it is given. What the browser does decide is small and listed here in full: how a value is worded and formatted, what is kept in the browser while no customer is signed in, which case of a bill a sentence belongs to, what a form refuses before it is sent, and the length of a few bars.

A rule is explained in one document. This page is the index; the rule itself is in the document it names.

## 1. Who decides what

| Question | Decided by | Where the shop reads it | Backend's document |
| --- | --- | --- | --- |
| What a pack size costs, whether it is reduced, the price per unit | API | `pricing` of a product (`PriceView`) | [store-api.md](../reference/backend/store-api.md), section 7 |
| VAT | API | `vatRate`, `vatAmount` of a line; the totals | Section 9 |
| Whether a size can be ordered, and how many | API | `ordering` (`canOrder`, `reason`, `minQuantity`, `maxQuantity`, `remaining`) | Section 7 |
| The order of products in a list, one card per product or per pack size | API (the admin) | The `view` of a list | [product-display-order.md](../reference/backend/product-display-order.md) |
| Every amount of the bill: subtotal, discounts, delivery, total | API | `Bill` (`totals`, `delivery`, `discount`, `rewards`, `shipping`) | Sections 8 and 9 |
| The delivery fee and when delivery is free | API | `bill.delivery`, the settings | Section 6 |
| The boxes of an order, their weights and fees | API | `bill.shipping` | [box-based-shipping.md](../reference/backend/box-based-shipping.md) |
| Whether a discount code applies, and what it takes off | API | `bill.discount` | Section 9 |
| Coins earned and redeemed, and the program's switch | API | `bill.rewards`, the rewards program | [rewards.md](../reference/backend/rewards.md) |
| Whether an order can be placed, cancelled, returned, reviewed, reported | API | `canOrder`; the order's own flags | Sections 9 and 12 |
| Order and payment statuses | API | The order | Section 13 |
| Who is signed in, and for how long | API | The session cookies | [customer-auth.md](../reference/backend/customer-auth.md) |
| The content of the banners, the FAQ, the blog, the legal pages | API (the admin) | The content endpoints | Their documents in [reference/backend/](../reference/backend/README.md) |

Every form is checked in the browser first, for the customer's convenience, and **again by the API, which has the last word** ([forms and validation](forms-and-validation.md)).

## 2. The rules of the browser

### Showing a product

| Rule | Document |
| --- | --- |
| How money is written in English and in German | [prices-and-availability.md](prices-and-availability.md#money) |
| A reduced price and the discount badge | [prices-and-availability.md](prices-and-availability.md#a-reduced-price-and-the-discount) |
| The price per kilogram, litre or piece | [prices-and-availability.md](prices-and-availability.md#the-price-per-unit) |
| Product names and pack sizes ("Guava / Jamfal (500g)") | [prices-and-availability.md](prices-and-availability.md#names-and-pack-sizes) |
| What the customer sees for each reason a size cannot be ordered | [prices-and-availability.md](prices-and-availability.md#what-can-be-ordered-means) |
| "Only N left" and its threshold | [prices-and-availability.md](prices-and-availability.md#only-n-left) |
| Quantity limits, and the first quantity a tap adds | [prices-and-availability.md](prices-and-availability.md#quantity-limits) |
| How current a shown price or stock is on a cached page | [prices-and-availability.md](prices-and-availability.md#how-current-a-shown-price-or-stock-is), [rendering and caching](../architecture/rendering-and-caching.md) |
| Badges, the basket and the stepper of a card | [features/product-card.md](../features/product-card.md) |
| "Notify me" for a pack size that cannot be ordered: who is asked for an address, what each refusal of the API leads to | [features/back-in-stock.md](../features/back-in-stock.md) |
| Switching the pack size on the product page | [features/product-page.md](../features/product-page.md) |
| Filters, sorting and pages, kept in the address | [features/catalogue.md](../features/catalogue.md) |

### The cart and the bill

| Rule | Document |
| --- | --- |
| The guest's cart in the browser: its key, its shape, its limits | [cart-and-bill.md](cart-and-bill.md#the-guest-cart) |
| The customer's cart in the API | [cart-and-bill.md](cart-and-bill.md#the-customers-cart) |
| What happens to a cart at sign-in and sign-out | [cart-and-bill.md](cart-and-bill.md#signing-in-and-signing-out) |
| How a change of quantity is sent, and quick taps | [cart-and-bill.md](cart-and-bill.md#how-a-quantity-change-is-sent) |
| The rows of the totals and the field each one prints | [cart-and-bill.md](cart-and-bill.md#the-rows-of-the-totals) |
| **Everything the browser works out itself**, with the formulas | [cart-and-bill.md](cart-and-bill.md#what-the-browser-computes) |
| Line issues and what the shop offers for each | [cart-and-bill.md](cart-and-bill.md#line-issues) |
| When "Go to checkout" and "Buy now" are allowed | [cart-and-bill.md](cart-and-bill.md#canorder) |
| A bill that changed while the customer was at the checkout | [cart-and-bill.md](cart-and-bill.md#a-bill-that-is-refused-at-the-checkout) |

### Delivery

| Rule | Document |
| --- | --- |
| The flat fee and the hint on free delivery | [features/shipping.md](../features/shipping.md) |
| Delivery by the box: which sentence a bill gets, the two meters, the list of boxes | [features/shipping.md](../features/shipping.md) |
| The delivery promises in the header, on the home page and the product page | [features/shipping.md](../features/shipping.md) |

### Ordering and paying

| Rule | Document |
| --- | --- |
| What "Buy now" checks and sends, for a customer and for a guest; the key that keeps an order from being placed twice | [features/checkout.md](../features/checkout.md) |
| A guest's address goes with the order alone | [features/checkout.md](../features/checkout.md) |
| How a code is applied, refused and removed; a customer's code and a guest's | [features/discount-codes.md](../features/discount-codes.md) |
| Redeeming coins at the checkout | [features/rewards.md](../features/rewards.md) |
| The way to Stripe and back; paying an open order again | [features/payments.md](../features/payments.md) |

### The account

| Rule | Document |
| --- | --- |
| Sign-up with the emailed code, sign-in, the password reset, where a customer lands afterwards | [features/authentication.md](../features/authentication.md) |
| What "signed in" means before the API has answered | [authentication and security](../architecture/authentication-and-security.md) |
| Saved addresses, the standard address, the limit | [features/account.md](../features/account.md) |
| How order statuses are worded; what an order page offers in each status | [features/orders.md](../features/orders.md) |
| Which lines can be returned, and until when | [features/returns-and-reports.md](../features/returns-and-reports.md) |
| The wishlist of a visitor, the lists of a customer, the merge at sign-in | [features/wishlist.md](../features/wishlist.md) |
| How a referral code is remembered and offered at the sign-up | [features/referrals.md](../features/referrals.md) |
| One review per delivered order | [features/reviews.md](../features/reviews.md) |

### Forms

| Rule | Document |
| --- | --- |
| Email, password and names | [forms-and-validation.md](forms-and-validation.md#email-password-and-names) |
| The delivery address | [forms-and-validation.md](forms-and-validation.md#the-delivery-address) |
| The profile; closing the account | [forms-and-validation.md](forms-and-validation.md#the-profile) |
| Cancelling, returning, reporting, reviewing | [forms-and-validation.md](forms-and-validation.md#orders-cancelling-returning-reporting-reviewing) |
| The checkout: the code, the coins, the guest's fields, the consent | [forms-and-validation.md](forms-and-validation.md#the-checkout-discount-code-coins-the-guests-fields-the-consent) |
| How an error of the API reaches a field | [forms-and-validation.md](forms-and-validation.md#how-errors-of-the-api-are-shown), [error handling](../api/error-handling.md) |

## 3. Adding a rule

1. Ask first whether the rule is the backend's. A price, a tax, a fee, a limit or a status belongs to the API; the shop asks for the answer and prints it.
2. A rule of the browser is a function in `src/features/<area>/` or `src/lib/<area>/`, with a unit test beside it.
3. It is explained once: in the feature's document when one feature owns it, in a document of this folder when three or more features share it. A calculation gets a worked example with numbers.
4. It gets a row on this page.
