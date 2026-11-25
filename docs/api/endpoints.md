# Endpoints

Every endpoint of the store API the shop calls: 94 in all. 91 are the functions of `createStoreApi` in `src/lib/api/store-api.ts`; three are called beside it (the refresh of the session and the two PDF paths) and are marked in their rows. How a call is built, cached and refreshed is in [README.md](README.md); what an error leads to is in [error-handling.md](error-handling.md).

How to read the tables:

| Column | Meaning |
| --- | --- |
| Method and path | As the API knows it; parameters in braces |
| Client function | `api.…` when the browser calls it (`src/lib/api/browser.ts`), `serverApi.…` when the Next.js server does (`src/lib/api/server.ts`); both objects have every function |
| Sends | The body, or the query where it says so, with its type in `src/lib/api/types.ts`; "–" for nothing |
| Answers | The type of the answer; "nothing" is a `204` |
| Session | `none`: works for everyone. `customer`: needs the session cookies. `token`: a guest order, opened by `?token=` |
| Called from | The files that make the call |

The shapes of the bodies and answers are the backend's: [reference/backend/store-api.md](../reference/backend/store-api.md) documents each call, and the section named under a table is the place to look. Unless a note says otherwise, the language travels as `?locale=`.

## Authentication

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `POST /v1/store/auth/signup` | `api.signUp` | `SignUpInput` | `SignUpStarted` (`202`), or `SessionResult` (`201`) from an older API | none | `src/components/auth/sign-up-form.tsx` |
| `POST /v1/store/auth/signup/verify` | `api.signUpVerify` | `SignUpVerifyInput` | `SignUpVerified` | none | `src/components/auth/sign-up-form.tsx` |
| `POST /v1/store/auth/signup/resend` | `api.signUpResend` | `{ email }` | nothing | none | `src/components/auth/sign-up-form.tsx` |
| `POST /v1/store/auth/login` | `api.login` | `LoginInput` | `SessionResult` | none | `src/components/auth/sign-in-form.tsx` |
| `POST /v1/store/auth/password/forgot` | `api.forgotPassword` | `{ email, locale }` | nothing, whether or not the address has an account | none | `src/components/auth/forgot-password-form.tsx` |
| `POST /v1/store/auth/password/reset` | `api.resetPassword` | `{ token, password }` | nothing | none | `src/components/auth/reset-password-form.tsx` |
| `POST /v1/store/auth/refresh` | `session.refresh` (not in `store-api.ts`) | – | Not read; the cookies are replaced | The refresh cookie | `src/lib/api/session-transport.ts` |
| `POST /v1/store/auth/logout` | `api.logout` | – | nothing | none needed | `src/components/account/sign-out.tsx` |
| `POST /v1/store/auth/logout-all` | `api.logoutAll` | – | nothing | customer | `src/components/account/sign-out.tsx` |

Section 1 of the backend reference, and [customer-auth.md](../reference/backend/customer-auth.md). `signup/verify` and `signup/resend` take the language as `Accept-Language`. A call to `/v1/store/auth/` is never answered with a refresh, except `logout-all`. Codes with handling of their own: `CUSTOMER_EMAIL_TAKEN`, `PASSWORD_TOO_WEAK`, `SIGNUP_CODE_INVALID` (`details.attemptsLeft`), `SIGNUP_NOT_FOUND`, `PASSWORD_RESET_INVALID`.

## Account

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `GET /v1/store/me` | `api.getMe` | – | `{ customer: Customer }` | customer | `src/features/session/session.ts` |
| `PATCH /v1/store/me` | `api.updateMe` | `UpdateProfileInput` | `{ customer: Customer }` | customer | `src/components/account/profile-view.tsx` |
| `PATCH /v1/store/me/communication` | `api.updateCommunication` | `UpdateCommunicationInput` | `{ communication: Communication }` | customer | `src/components/account/profile-view.tsx` |
| `GET /v1/store/me/overview` | `api.getOverview` | – | `AccountOverview` | customer | `src/features/account/overview.ts` |
| `POST /v1/store/me/delete` | `api.deleteAccount` | `DeleteAccountInput` | nothing; the cookies are cleared | customer | `src/components/account/delete-account.tsx` |

Section 2. `GET /v1/store/me` is how the shop learns who is signed in: `AUTH_TOKEN_INVALID` and `CUSTOMER_NOT_FOUND` mean nobody. `me/overview` and `me/delete` take the language as `Accept-Language`; an API without the overview answers `NOT_FOUND` and the account page shows no tiles. Deleting answers `CUSTOMER_CREDENTIALS_INVALID` for a wrong password and `CUSTOMER_HAS_OPEN_ORDERS` with what is still open.

## Addresses

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `GET /v1/store/me/addresses` | `api.listAddresses` | – | `AddressList` | customer | `src/components/account/address-book.tsx`, `src/components/checkout/checkout-view.tsx` |
| `POST /v1/store/me/addresses` | `api.createAddress` | `AddressInput` | `AddressList` | customer | Same two files |
| `PATCH /v1/store/me/addresses/{id}` | `api.updateAddress` | `Partial<AddressInput>` | `AddressList` | customer | Same two files |
| `POST /v1/store/me/addresses/{id}/default` | `api.setDefaultAddress` | – | `AddressList` | customer | `src/components/account/address-book.tsx` |
| `DELETE /v1/store/me/addresses/{id}` | `api.deleteAddress` | – | `AddressList` | customer | `src/components/account/address-book.tsx` |

Section 3. Every call answers the whole list, which is written into the cache under `["addresses"]`. Errors: `ADDRESS_LIMIT_REACHED` (`details.maximum`), `ADDRESS_NOT_FOUND`, and `VALIDATION_FAILED` with the fields of the form.

## Settings and legal texts

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `GET /v1/store/settings` | `serverApi.getSettings` | – | `ShopSettings` | none | `src/features/catalogue/data.ts` |
| `GET /v1/store/legal` | `serverApi.listLegal`, `api.listLegal` | – | `{ items: LegalSummary[] }` | none | `src/features/legal/data.ts`, `src/app/sitemap.ts`, `src/components/checkout/checkout-view.tsx` |
| `GET /v1/store/legal/{type}` | `serverApi.getLegal` | – | `{ document: LegalDocument }` | none | `src/features/legal/data.ts` |

Section 6, and [legal-pages.md](../reference/backend/legal-pages.md). The settings are asked without a language; the server keeps all three for 300 seconds. The checkout asks `GET /v1/store/legal` afresh in the browser, because the versions it sends as consent must be the current ones. `{type}` is a `LegalType`; an unpublished text answers `LEGAL_DOCUMENT_NOT_FOUND`, and an older API answers `BAD_REQUEST` for the four types it does not know.

## Catalogue

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `GET /v1/store/categories` | `serverApi.listCategories` | – | `{ items: Category[] }` | none | `src/features/catalogue/data.ts`, `src/app/sitemap.ts` |
| `GET /v1/store/categories/{slug}` | `serverApi.getCategory` | – | `{ category: CategoryDetail }` | none | `src/features/catalogue/data.ts` |
| `GET /v1/store/products` | `serverApi.listProducts`, `api.listProducts` | Query: `ProductQuery` | `ProductList` | none | `src/features/catalogue/data.ts`, `src/app/sitemap.ts`, `src/components/shell/search-form.tsx`, `src/components/home/category-row.tsx` |
| `GET /v1/store/products/facets` | `serverApi.getProductFacets`, `api.getProductFacets` | Query: `ProductQuery` without `page`, `limit`, `sort`, `view` | `ProductFacets` | none | `src/features/catalogue/data.ts`, `src/components/shell/search-form.tsx` |
| `GET /v1/store/products/{slug}` | `serverApi.getProduct`, `api.getProduct` | – | `{ product: ProductDetail }` | none | `src/features/catalogue/data.ts`, `src/components/catalogue/product-purchase.tsx` |

Section 7, and [product-display-order.md](../reference/backend/product-display-order.md) for `view`. The server keeps every answer for 300 seconds (3600 for the sitemap); the browser's calls are not kept by Next.js: the search suggestions, the further pages of a row of the home page, and the stock and pictures of the product page. A list filter with several values is sent as a repeated parameter. `CATEGORY_NOT_FOUND`, `PRODUCT_NOT_FOUND` and `NOT_FOUND` become the 404 page.

## Cart

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `POST /v1/store/cart/preview` | `api.previewCart` | `CartPreviewInput` | `Bill` | none | `src/features/cart/use-bill.ts`, `src/components/checkout/checkout-view.tsx` |
| `GET /v1/store/cart` | `api.getCart` | – | `Bill` | customer | `src/features/cart/cart.tsx`, `src/features/cart/use-bill.ts`, `src/components/checkout/checkout-view.tsx` |
| `POST /v1/store/cart/merge` | `api.mergeCart` | `{ items: CartItemInput[] }` | `Bill` | customer | `src/features/cart/cart.tsx` |
| `PUT /v1/store/cart/items/{variantId}` | `api.setCartItem` | `{ quantity }` | `Bill` | customer | `src/features/cart/cart.tsx` |
| `DELETE /v1/store/cart/items/{variantId}` | `api.removeCartItem` | – | `Bill` | customer | Not called |
| `DELETE /v1/store/cart` | `api.clearCart` | – | `Bill` | customer | Not called |

Section 8. Every call answers the whole bill. A visitor's cart lives in the browser and is priced by `cart/preview`, 350 ms after the last change; the guest checkout sends `discountCode` with it to price a code. A customer's changes go out one after the other, 300 ms after the last tap on a pack size, and a line is removed with `quantity: 0`, which is why the two `DELETE` calls have no caller. `cart/merge` runs once after sign-in. Errors: `CART_FULL` (`details.maximum`), `CART_PRODUCT_NOT_FOUND`. See [features/cart.md](../features/cart.md).

## Orders and checkout

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `PUT /v1/store/checkout/discount` | `api.applyDiscount` | `{ code }` | `Bill` | customer | `src/components/checkout/discount-code.tsx` |
| `DELETE /v1/store/checkout/discount` | `api.removeDiscount` | – | `Bill` | customer | `src/components/checkout/discount-code.tsx` |
| `POST /v1/store/checkout` | `api.checkout` | `CheckoutInput`; header `Idempotency-Key` | `CheckoutResult` | customer | `src/components/checkout/checkout-view.tsx` |
| `POST /v1/store/guest/checkout` | `api.guestCheckout` | `GuestCheckoutInput`; header `Idempotency-Key` | `GuestCheckoutResult` | none | `src/components/checkout/checkout-view.tsx` |
| `GET /v1/store/orders` | `api.listOrders` | Query: `limit`, `cursor` | `CursorPage<OrderSummary>` | customer | `src/components/account/order-list.tsx` |
| `GET /v1/store/orders/{orderNumber}` | `api.getOrder` | – | `{ order: OrderDetail }` | customer | `src/features/orders/order-access.ts`, `src/components/account/order-detail.tsx`, `src/components/account/return-request.tsx`, `src/components/account/report-problem-view.tsx` |
| `POST /v1/store/orders/{orderNumber}/cancel` | `api.cancelOrder` | `{ reason: CustomerCancellationReason, text? }` | `{ order: OrderDetail }` | customer | `src/features/orders/order-access.ts` |
| `GET /v1/store/guest/orders/{orderNumber}` | `api.getGuestOrder` | Query: `token` | `GuestOrder` | token | `src/features/orders/order-access.ts` |
| `POST /v1/store/guest/orders/{orderNumber}/cancel` | `api.cancelGuestOrder` | The same body; query: `token` | `{ order: OrderDetail }` | token | `src/features/orders/order-access.ts` |

Sections 9, 9.6 and 20, and [customer-accounts.md](../reference/backend/customer-accounts.md) for the guest order. The two checkout calls carry an idempotency key from `checkoutKey` (`src/lib/checkout/order-attempt.ts`): the same order sends the same key again, and the API answers the first order with `created: false`. The four guest calls take the language as `Accept-Language`. The code is sent as typed; `applyDiscount` answers `400 DISCOUNT_NOT_APPLICABLE` with `details.reason`. The refusals of a checkout the page handles one by one are listed in [error-handling.md](error-handling.md); the page itself is [features/checkout.md](../features/checkout.md). A guest order's three reads (order, payment, documents) are one call: while one is on its way, the others wait for the same answer. An order that was given up unpaid answers `ORDER_NOT_FOUND`; a wrong token `ORDER_TOKEN_INVALID`.

## Payments

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `GET /v1/store/orders/{orderNumber}/payment` | `api.getOrderPayment` | – | `OrderPayment` | customer | `src/features/orders/order-access.ts`, for `src/components/account/order-payment.tsx` |
| `POST /v1/store/orders/{orderNumber}/pay` | `api.createPaymentPage` | – | `CheckoutSession` | customer | Same |
| `POST /v1/store/guest/orders/{orderNumber}/pay` | `api.payGuestOrder` | Query: `token` | `CheckoutSession` | token | Same |

Section 10. The shop never talks to Stripe: it receives the address of a payment page and sends the browser there. `…/payment` is asked while an order waits for its payment and after the way back from Stripe; with `?payment=success` and a page still completing it is asked again every 3 seconds, after 40 answers every 10. `…/pay` answers `ORDER_NOT_PAYABLE` when the order was paid or cancelled meanwhile; the page then reads the payment afresh. See [features/payments.md](../features/payments.md).

## Invoices

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `GET /v1/store/invoices` | `api.listInvoices` | Query: `orderNumber`, `limit`, `cursor` | `CursorPage<InvoiceSummary>` | customer | `src/components/account/invoice-list.tsx`, `src/features/orders/order-access.ts` |
| `GET /v1/store/invoices/{number}` | `api.getInvoice` | – | `{ invoice: InvoiceDetail }` | customer | Not called |
| `GET /v1/store/invoices/{number}/pdf` | `invoicePdfPath`, fetched with `session.raw` | – | The PDF | customer | `src/components/account/order-bits.tsx` |
| `GET /v1/store/guest/orders/{orderNumber}/invoices/{number}/pdf` | `guestInvoicePdfPath`, fetched with `session.raw` | Query: `token` | The PDF | token | `src/features/orders/order-access.ts`, `src/components/account/order-bits.tsx` |

Section 11. The two PDF paths are not functions of `createStoreApi`: `store-api.ts` builds the path, and `downloadPdf` in `src/components/account/order-bits.tsx` fetches it through `session.raw`, so the cookies travel and an expired access cookie is refreshed, then hands the file to the browser as `<number>.pdf`. The documents of one order are asked with `orderNumber` and `limit: 100`.

## Returns

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `GET /v1/store/orders/{orderNumber}/returns` | `api.getOrderReturns` | – | `OrderReturns` | customer | `src/components/account/order-detail.tsx`, `src/components/account/return-request.tsx` |
| `POST /v1/store/orders/{orderNumber}/returns` | `api.createReturn` | `CreateReturnInput` | `{ return: ReturnRequest }` | customer | `src/components/account/return-request.tsx` |
| `GET /v1/store/returns/{returnNumber}` | `api.getReturn` | – | `{ return: ReturnRequest }` | customer | Not called |
| `POST /v1/store/returns/{returnNumber}/cancel` | `api.cancelReturn` | – | `{ return: ReturnRequest }` | customer | `src/components/account/order-detail.tsx` |

Section 12. The order page asks for the returns only once the order is delivered, and never for a guest order. Errors: `RETURN_NOT_POSSIBLE`, `RETURN_WINDOW_CLOSED`, `RETURN_QUANTITY_INVALID` (`details.available`), `RETURN_TRANSITION_NOT_ALLOWED`. See [features/returns-and-reports.md](../features/returns-and-reports.md).

## Wishlist

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `POST /v1/store/wishlist/preview` | `api.previewWishlist` | `{ items: WishlistEntryInput[] }` | `Wishlist` | none | `src/features/wishlist/wishlist.tsx` |
| `GET /v1/store/wishlist` | `api.getWishlist` | – | `Wishlist` | customer | `src/features/wishlist/wishlist.tsx` |
| `PUT /v1/store/wishlist/items/{productId}` | `api.saveWishlistItem` | `{ variantId? }` | `Wishlist` | customer | `src/features/wishlist/wishlist.tsx` |
| `DELETE /v1/store/wishlist/items/{productId}` | `api.removeWishlistItem` | – | `Wishlist` | customer | `src/features/wishlist/wishlist.tsx` |
| `DELETE /v1/store/wishlist` | `api.clearWishlist` | – | `Wishlist` | customer | `src/features/wishlist/wishlist.tsx` |
| `POST /v1/store/wishlist/merge` | `api.mergeWishlist` | `{ items: WishlistEntryInput[] }` | `Wishlist` | customer | `src/features/wishlist/wishlist.tsx` |
| `GET /v1/store/wishlists` | `api.listWishlists` | – | `{ items: WishlistSummary[] }` | customer | `src/features/wishlist/wishlists.ts` |
| `POST /v1/store/wishlists` | `api.createWishlist` | `WishlistInput` with a `name` | `{ wishlist: WishlistSummary }` | customer | `src/components/wishlist/wishlist-lists.tsx` |
| `GET /v1/store/wishlists/{id}` | `api.getWishlistById` | – | `Wishlist` | customer | `src/features/wishlist/wishlists.ts` |
| `PATCH /v1/store/wishlists/{id}` | `api.updateWishlist` | `WishlistInput` | `{ wishlist: WishlistSummary }` | customer | `src/components/wishlist/wishlist-lists.tsx` |
| `DELETE /v1/store/wishlists/{id}` | `api.deleteWishlist` | – | nothing | customer | `src/components/wishlist/wishlist-lists.tsx` |
| `PUT /v1/store/wishlists/{id}/items/{productId}` | `api.saveWishlistItemTo` | `{ variantId? }` | `Wishlist` | customer | Not called |
| `DELETE /v1/store/wishlists/{id}/items/{productId}` | `api.removeWishlistItemFrom` | – | `Wishlist` | customer | `src/components/wishlist/wishlist-item-actions.tsx` |
| `POST /v1/store/wishlists/{id}/items/{productId}/transfer` | `api.transferWishlistItem` | `WishlistTransferInput` | `Wishlist` | customer | `src/components/wishlist/wishlist-item-actions.tsx` |
| `DELETE /v1/store/wishlists/{id}/items` | `api.clearWishlistById` | – | `Wishlist` | customer | `src/components/wishlist/wishlist-view.tsx` |

Sections 16 and 16.2, [wishlist.md](../reference/backend/wishlist.md) and [customer-accounts.md](../reference/backend/customer-accounts.md). The six calls under `/wishlist` address the default list, the one the heart adds to; the nine under `/wishlists` address a list by its id and take the language as `Accept-Language`. A visitor's list lives in the browser and is rendered by `wishlist/preview`; `wishlist/merge` runs once after sign-in. Errors: `WISHLIST_FULL` (`details.maximum`), `WISHLIST_NAME_TAKEN`, `WISHLIST_LIMIT_REACHED`, `WISHLIST_NOT_FOUND`. See [features/wishlist.md](../features/wishlist.md).

## Banners

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `GET /v1/store/banners` | `serverApi.listBanners` | – | `{ banners: Banner[] }` | none | `src/features/catalogue/data.ts` |

Section 17, and [banners.md](../reference/backend/banners.md). Asked at every visit of the home page with `cache: "no-store"`, so a banner the admin switches shows at once. An empty list, or an API that does not answer, means no carousel.

## FAQ

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `GET /v1/store/faqs` | `serverApi.listFaqs` | – | `Faqs` | none | `src/features/content/data.ts`, `src/app/sitemap.ts` |

Section 18, and [faq.md](../reference/backend/faq.md). Kept for 300 seconds. `groups: []` means nothing is published.

## Blog

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `GET /v1/store/blog/posts` | `serverApi.listBlogPosts` | Query: `BlogQuery` | `Page<BlogPostSummary>` | none | `src/features/content/data.ts`, `src/app/sitemap.ts` |
| `GET /v1/store/blog/posts/{slug}` | `serverApi.getBlogPost` | – | `{ post: BlogPost }` | none | `src/features/content/data.ts` |
| `GET /v1/store/blog/categories` | `serverApi.listBlogCategories` | – | `{ items: BlogCategory[] }` | none | `src/features/content/data.ts`, `src/app/sitemap.ts` |
| `GET /v1/store/blog/tags` | `serverApi.listBlogTags` | – | `{ items: BlogTag[] }` | none | `src/features/content/data.ts` |

Section 19, and [blog.md](../reference/backend/blog.md). Kept for 300 seconds. A draft, a scheduled post and an unknown slug answer `BLOG_POST_NOT_FOUND`, which becomes the 404 page. For the sitemap, an API without the blog (any `404`) means no blog pages.

## Referrals

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `GET /v1/store/me/referral` | `api.getReferral` | – | `{ referral: Referral }` | customer | `src/components/account/referral-view.tsx` |
| `GET /v1/store/referral-codes/{code}` | `api.checkReferralCode` | – | `ReferralCodeCheck` | none | `src/components/auth/sign-up-form.tsx` |

Section 21. Both take the language as `Accept-Language`. The code is trimmed and upper-cased before it goes into the path. The sign-up form looks a code of full length up 500 ms after the last keystroke and keeps each answer; `REFERRAL_CODE_UNKNOWN` marks the code as unknown, any other failure lets the code travel with the sign-up. See [features/referrals.md](../features/referrals.md).

## Order reviews

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `GET /v1/store/reviews` | `serverApi.listReviews` | Query: `ReviewQuery` | `ReviewPage` | none | `src/features/reviews/data.ts`, `src/app/sitemap.ts` |
| `GET /v1/store/orders/{orderNumber}/review` | `api.getOrderReview` | – | `OrderReviewState` | customer | `src/components/account/order-review.tsx` |
| `POST /v1/store/orders/{orderNumber}/review` | `api.writeOrderReview` | `WriteReviewInput` | `{ review: MyReview }` | customer | `src/components/account/order-review.tsx` |
| `GET /v1/store/me/reviews` | `api.listMyReviews` | – | `{ items: MyReview[] }` | customer | `src/components/account/reviews-view.tsx` |
| `GET /v1/store/me/reviews/reviewable` | `api.listReviewable` | – | `{ items: OrderSummary[] }` | customer | `src/components/account/reviews-view.tsx` |

Section 22, and [order-reviews.md](../reference/backend/order-reviews.md). All five take the language as `Accept-Language`. The public list is kept for 300 seconds on the server (not at all in development). `REVIEW_ALREADY_WRITTEN` makes the form read the review afresh; `REVIEW_NOT_POSSIBLE` is shown as its text. See [features/reviews.md](../features/reviews.md).

## Problem reports

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `GET /v1/store/orders/{orderNumber}/issues` | `api.getOrderIssues` | – | `OrderIssues` | customer | `src/components/account/order-issues.tsx`, `src/components/account/report-problem-view.tsx` |
| `POST /v1/store/orders/{orderNumber}/issues` | `api.createIssue` | `CreateIssueInput` | `{ issue: Issue }` | customer | `src/components/account/report-problem-view.tsx` |
| `POST /v1/store/issues/{issueNumber}/images` | `api.uploadIssueImages` | `multipart/form-data`, field `files` | `{ issue: Issue }` | customer | `src/components/account/report-problem-view.tsx` |
| `DELETE /v1/store/issues/{issueNumber}/images/{imageId}` | `api.deleteIssueImage` | – | `{ issue: Issue }` | customer | `src/components/account/issue-view.tsx` |
| `GET /v1/store/issues` | `api.listIssues` | – | `{ items: Issue[] }` | customer | `src/components/account/issues-list.tsx` |
| `GET /v1/store/issues/{issueNumber}` | `api.getIssue` | – | `{ issue: Issue }` | customer | `src/components/account/issue-view.tsx` |
| `POST /v1/store/issues/{issueNumber}/cancel` | `api.cancelIssue` | – | `{ issue: Issue }` | customer | `src/components/account/issue-view.tsx` |

Section 23, and [customer-accounts.md](../reference/backend/customer-accounts.md). All seven take the language as `Accept-Language`. The photos are the one upload of the shop: the report is created first, then its photos are sent as files. Errors: `ISSUE_NOT_POSSIBLE`, `ISSUE_WINDOW_CLOSED`, `ISSUE_QUANTITY_INVALID`, `ISSUE_TRANSITION_NOT_ALLOWED`, `IMAGE_LIMIT_REACHED`, `IMAGE_INVALID`. See [features/returns-and-reports.md](../features/returns-and-reports.md).

## Rewards

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `GET /v1/store/rewards/program` | `serverApi.getRewardsProgram` | – | `{ program: RewardsProgram }` | none | `src/app/[locale]/(shop)/how-it-works/page.tsx` |
| `GET /v1/store/me/rewards` | `api.getMyRewards` | – | `MyRewards` | customer | `src/features/account/rewards.ts` |
| `GET /v1/store/me/rewards/transactions` | `api.listRewardTransactions` | Query: `page`, `limit` | `Page<RewardTransaction>` | customer | `src/components/account/rewards-view.tsx` |
| `PUT /v1/store/checkout/rewards` | `api.redeemCoins` | `{ coins? }`; `{}` for as many as allowed | `Bill` | customer | `src/components/checkout/redeem-coins.tsx` |
| `DELETE /v1/store/checkout/rewards` | `api.removeCoins` | – | `Bill` | customer | `src/components/checkout/redeem-coins.tsx` |

Section 24, and [rewards.md](../reference/backend/rewards.md). All five take the language as `Accept-Language`. The rules are kept for 300 seconds on the server and asked without a language; an API without coins, or one that does not answer, leaves the section of the page out. `redeemCoins` answers `400 REWARDS_NOT_APPLICABLE` with `details.reason`. See [features/rewards.md](../features/rewards.md).

## Newsletter and unsubscribe

| Method and path | Client function | Sends | Answers | Session | Called from |
| --- | --- | --- | --- | --- | --- |
| `POST /v1/unsubscribe/{token}` | `api.unsubscribe` | – | `UnsubscribeResult` | none | `src/components/public/unsubscribe-view.tsx` |

Section 4. The one path outside `/v1/store`. The token of the link is passed through exactly as it came, and the call is made only when the visitor presses the button; `CUSTOMER_NOT_FOUND` means the link is not valid. The shop has no call for subscribing: the consent to marketing emails is `marketingOptIn` of `PATCH /v1/store/me/communication` ([Account](#account)). See [features/email-unsubscribe.md](../features/email-unsubscribe.md).
