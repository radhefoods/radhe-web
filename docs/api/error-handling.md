# Error handling

What the shop does when a call to the API fails: the one error type, how its code becomes a sentence for the customer, what server pages, lists and forms do with it, and the codes that are handled in a way of their own. The client itself is described in [README.md](README.md), the endpoints in [endpoints.md](endpoints.md). The backend's error format is section 0.4 of [reference/backend/store-api.md](../reference/backend/store-api.md).

## 1. The error model

Every failed call rejects with an `ApiError` (`src/lib/api/errors.ts`), made in `src/lib/api/http.ts`. The one exception is a call that was aborted through its `signal`: it rejects with the `AbortError` itself.

| What happened | `status` | `code` |
| --- | --- | --- |
| The API answered an error in its format (`{ error: { code, message, details }, requestId }`) | The HTTP status | The API's code |
| The same, with a code the shop does not know | The HTTP status | `INTERNAL_ERROR`; the code itself stays in `rawCode` |
| An answer that is not 2xx and not in that format (the page of a proxy) | The HTTP status | `UNEXPECTED_RESPONSE` |
| A 2xx answer whose body is not JSON | The HTTP status | `UNEXPECTED_RESPONSE` |
| The API could not be reached, or did not begin to answer the server within 10 seconds | `0` | `NETWORK_ERROR` |

| Field of `ApiError` | Holds |
| --- | --- |
| `status` | The HTTP status; `0` when the API was not reached |
| `code` | One of the 68 codes of `API_ERROR_CODES`, or one of the two the shop raises itself (`NETWORK_ERROR`, `UNEXPECTED_RESPONSE`). Always a code that has a text |
| `rawCode` | The code exactly as the API sent it |
| `details` | What the API sent along; its shape per code is the type `ErrorDetails` |
| `requestId` | `requestId` of the body, else the header `x-request-id`, else `null` |
| `message` | The API's English sentence, for developers; never shown |

| Helper | Use |
| --- | --- |
| `isApiError(error)` | Whether a caught value is an `ApiError` |
| `hasErrorCode(error, code)` | The same and the code matches; narrows `details` to the shape of `ErrorDetails` for that code |
| `error.is(code)` | The same check on an `ApiError` |
| `fieldProblems(error)` | The `details` of `VALIDATION_FAILED` as `{ field: problems[] }`, with dotted paths (`postalCode`, `items.0.quantity`); `{}` for any other error |
| `isUnexpectedError(error)` | Nothing the customer did wrong: not an `ApiError`, status 500 or above, status `0`, `INTERNAL_ERROR`, `UNEXPECTED_RESPONSE` |
| `isRetryable(error)` | Asking again can help and is safe for a read: `NETWORK_ERROR`, `RATE_LIMITED`, status 502, 503, 504 |

`ErrorDetails` types the `details` of `VALIDATION_FAILED`, `SIGNUP_CODE_INVALID`, `CUSTOMER_EMAIL_TAKEN`, `CUSTOMER_HAS_OPEN_ORDERS`, `ADDRESS_LIMIT_REACHED`, `CART_FULL`, `COMPANY_DETAILS_MISSING`, `LEGAL_DOCUMENTS_MISSING`, `LEGAL_VERSION_CHANGED`, `ORDER_ITEMS_NOT_ORDERABLE`, `ORDER_TOTAL_CHANGED`, `DISCOUNT_NOT_APPLICABLE`, `DELIVERY_COUNTRY_NOT_SERVED`, `ORDER_NOT_PAYABLE`, `ORDER_CANNOT_BE_CANCELLED`, `RETURN_NOT_POSSIBLE`, `RETURN_WINDOW_CLOSED`, `ORDER_ITEM_NOT_FOUND`, `RETURN_QUANTITY_INVALID`, `RETURN_TRANSITION_NOT_ALLOWED`, `WISHLIST_FULL`, `REWARDS_NOT_APPLICABLE`, `STOCK_ALERT_NOT_NEEDED` and `STOCK_ALERT_LIMIT_REACHED`.

## 2. Network failures, time limits and retries

| Where | Behaviour |
| --- | --- |
| The server (`serverApi`) | A call that has not begun to answer after 10 seconds (`API_TIMEOUT_MS` in `src/lib/api/server.ts`) fails as `NETWORK_ERROR`. The request is not aborted, so an answer that comes late still fills the cache. The server does not ask twice |
| The browser (`api`) | No time limit. A failed `fetch` is `NETWORK_ERROR` |
| Queries in the browser | Asked up to two more times when `isRetryable` says so; the default is set in `src/features/providers.tsx`. The four queries of the search dropdown never retry |
| Changes in the browser | Never repeated by themselves. The one deliberate repeat is the checkout, which sends the same idempotency key again ([README.md](README.md)) |
| An expired access cookie | Not an error for the caller: the transport refreshes once and repeats the call ([README.md](README.md)) |

## 3. From a code to a sentence

The API's `message` is never shown. `useErrorText` in `src/lib/api/error-text.ts` returns a function that turns any caught value into a sentence from the `errors` namespace of `messages/en.json` and `messages/de.json`: the text under the error's `code`. Three codes fill a number from `details` into their text (`ADDRESS_LIMIT_REACHED` and `CART_FULL` with `maximum`, `RETURN_QUANTITY_INVALID` with `available`), and one has two sentences: `STOCK_ALERT_LIMIT_REACHED` reads `STOCK_ALERT_LIMIT_UNCONFIRMED` when `details.unconfirmed` is set. A value that is not an `ApiError` gets the text of `INTERNAL_ERROR`.

`ErrorAlert` (`src/components/ui/error-alert.tsx`) is how nearly every component shows an error: the sentence, the line `errors.reference` ("Reference for our support: {requestId}") when the error is an unexpected one and has a request id, and a "Try again" button when the caller offers a retry. The cart and the wishlist show the sentence in a toast instead (`src/components/cart/cart-problem.tsx`, `src/components/catalogue/wishlist-problem.tsx`).

Every code has a text of its own:

| Code | English text |
| --- | --- |
| `NETWORK_ERROR` | We could not reach the shop. Check your internet connection and try again. |
| `UNEXPECTED_RESPONSE` | Something went wrong on our side. Please try again. |
| `INTERNAL_ERROR` | Something went wrong on our side. Please try again. |
| `SERVICE_UNAVAILABLE` | The shop is briefly unavailable. Please try again in a moment. |
| `RATE_LIMITED` | That was a lot of requests in a short time. Please wait a moment and try again. |
| `VALIDATION_FAILED` | Please check the marked fields. |
| `BAD_REQUEST` | This request could not be understood. Please try again. |
| `FORBIDDEN` | You are not allowed to do this. |
| `ORIGIN_NOT_ALLOWED` | This request was not accepted. Please reload the page and try again. |
| `NOT_FOUND` | We could not find what you were looking for. |
| `CONFLICT` | This could not be completed because something changed in the meantime. Please reload the page. |
| `AUTH_TOKEN_INVALID` | Please sign in to continue. |
| `UNAUTHENTICATED` | Please sign in to continue. |
| `AUTH_REFRESH_INVALID` | You have been signed out. Please sign in again. |
| `CUSTOMER_BLOCKED` | This account is blocked. Please contact Radhe Foods. |
| `CUSTOMER_NOT_FOUND` | This link is not valid. |
| `CUSTOMER_CREDENTIALS_INVALID` | The email address or the password is incorrect. |
| `CUSTOMER_EMAIL_TAKEN` | An account with this email address already exists. |
| `PASSWORD_TOO_WEAK` | This password is too easy to guess. Please choose another one. |
| `PASSWORD_RESET_INVALID` | This link is no longer valid. Please request a new one. |
| `SIGNUP_CODE_INVALID` | The code is not right. |
| `SIGNUP_NOT_FOUND` | This code has expired or was used up. Please start the sign-up again. |
| `CUSTOMER_HAS_OPEN_ORDERS` | Your account cannot be deleted while an order, a return or a report is still open. |
| `ADDRESS_LIMIT_REACHED` | You can save up to {maximum} addresses. Delete one to add another. |
| `ADDRESS_NOT_FOUND` | This address no longer exists. |
| `LEGAL_DOCUMENT_NOT_FOUND` | This text is not published yet. |
| `BLOG_POST_NOT_FOUND` | This article does not exist or is not published. |
| `CATEGORY_NOT_FOUND` | This category does not exist. |
| `PRODUCT_NOT_FOUND` | This product is no longer available. |
| `PRODUCT_VARIANT_NOT_FOUND` | This pack size is no longer sold. |
| `CART_PRODUCT_NOT_FOUND` | This product is no longer available and could not be added. |
| `CART_FULL` | Your cart is full ({maximum} different products). Remove one to add another. |
| `IDEMPOTENCY_KEY_REQUIRED` | Something went wrong on our side. Please reload the page and try again. |
| `PAYMENTS_NOT_CONFIGURED` | Online payment is not available at the moment. |
| `COMPANY_DETAILS_MISSING` | Ordering is not possible yet. Please try again later. |
| `LEGAL_DOCUMENTS_MISSING` | Ordering is not possible at the moment. Please try again later. |
| `LEGAL_VERSION_CHANGED` | Our terms were updated while you were here. Please read and accept the current version. |
| `CART_EMPTY` | Your cart is empty. |
| `ORDER_ITEMS_NOT_ORDERABLE` | Some products in your cart cannot be ordered right now. Please check your cart. |
| `ORDER_TOTAL_CHANGED` | The total has changed. Please check the new total and confirm again. |
| `DISCOUNT_NOT_APPLICABLE` | This discount code cannot be applied. |
| `DELIVERY_COUNTRY_NOT_SERVED` | We do not deliver to this country yet. |
| `ORDER_NOT_PAYABLE` | This order can no longer be paid. Please check your orders. |
| `PAYMENT_PROVIDER_ERROR` | The payment service could not be reached. Please try again in a moment. |
| `ORDER_NOT_FOUND` | We could not find this order. |
| `ORDER_CANNOT_BE_CANCELLED` | This order can no longer be cancelled here. Please contact Radhe Foods. |
| `ORDER_TOKEN_INVALID` | This link does not open this order. |
| `INVOICE_NOT_FOUND` | We could not find this document. |
| `RETURN_NOT_POSSIBLE` | A return is possible only after the order was delivered. |
| `RETURN_WINDOW_CLOSED` | The time for returns of this order has passed. |
| `ORDER_ITEM_NOT_FOUND` | This product is not part of the order. |
| `RETURN_QUANTITY_INVALID` | You can return at most {available, plural, one {# unit} other {# units}} of this product. |
| `RETURN_NOT_FOUND` | We could not find this return. |
| `RETURN_TRANSITION_NOT_ALLOWED` | This return has already been decided and can no longer be withdrawn. |
| `WISHLIST_FULL` | Your wishlist is full ({maximum} products). Remove one to save another. |
| `WISHLIST_NOT_FOUND` | This list does not exist any more. |
| `WISHLIST_NAME_TAKEN` | You already have a list with this name. |
| `WISHLIST_LIMIT_REACHED` | You can have up to 20 lists. Delete one to add another. |
| `REFERRAL_CODE_UNKNOWN` | This referral code is not known. |
| `REWARDS_NOT_APPLICABLE` | Your coins cannot be redeemed on this order. |
| `REVIEW_NOT_POSSIBLE` | You can review an order once it was delivered. |
| `REVIEW_ALREADY_WRITTEN` | You have already reviewed this order. Thank you! |
| `REVIEW_NOT_FOUND` | We could not find this review. |
| `ISSUE_NOT_FOUND` | We could not find this report. |
| `ISSUE_NOT_POSSIBLE` | A problem can be reported for a delivered order, up to five times. |
| `ISSUE_WINDOW_CLOSED` | The time for reporting a problem with this order has passed. |
| `ISSUE_QUANTITY_INVALID` | You can report at most as many units as were delivered to you. |
| `ISSUE_TRANSITION_NOT_ALLOWED` | Radhe Foods is already looking at this report; it can no longer be taken back. |
| `IMAGE_LIMIT_REACHED` | A report can have up to five photos. |
| `IMAGE_INVALID` | Please use JPEG, PNG or WebP pictures. |
| `STOCK_ALERTS_DISABLED` | Notifications about products that come back are not offered at the moment. |
| `STOCK_ALERT_NOT_NEEDED` | Good news: this product can be ordered again. |
| `STOCK_ALERT_LIMIT_REACHED` | You are waiting for the maximum number of products. With `details.unconfirmed`: Please confirm the requests we already emailed you about first. |
| `STOCK_ALERT_TOKEN_INVALID` | This link is no longer valid. |
| `STOCK_ALERT_NOT_FOUND` | We could not find this notification. |

## 4. Server pages when the API is away

The readers of the server decide per kind of data (`src/features/catalogue/data.ts`, `src/features/content/data.ts`, `src/features/legal/data.ts`, `src/features/reviews/data.ts`): the frame of the shop must never take a page down and falls back to nothing; the content of a page throws, so the error page shows.

| Reader | On a failure | The visitor sees |
| --- | --- | --- |
| `getSettings` | `null` | The page without what the settings feed (delivery estimate, free-delivery threshold) |
| `getCategories` | `[]` | A header without categories; a home page without category rows |
| `getPublishedLegal` | `null` | A footer that links the terms, the privacy policy and the pages the shop keeps a text of its own for (`footerLegalPages` in `src/lib/legal/pages.ts`) |
| `getBanners` | `[]` | No carousel; the static hero stands in |
| `getBlogCategories`, `getBlogTags` | `[]` | The blog without its categories and tags |
| The lists and the reviews of the home page (`src/app/[locale]/(shop)/page.tsx`) | `null`, caught on the page | The row or the section is left out |
| `programOf` (`src/app/[locale]/(shop)/how-it-works/page.tsx`) | `null` | No section about the coins |
| `getCategory`, `getProduct`, `getBlogPost` | `null` for `CATEGORY_NOT_FOUND`, `PRODUCT_NOT_FOUND`, `BLOG_POST_NOT_FOUND` or `NOT_FOUND`; any other error is thrown | The 404 page (`notFound()`), or the error page |
| `getLegalDocument` | `null` for `LEGAL_DOCUMENT_NOT_FOUND` or `BAD_REQUEST`; any other error is thrown | The text kept in the shop for that page when there is one, else the 404 page ([features/legal-pages.md](../features/legal-pages.md)) |
| `listProducts`, `getProductFacets`, `loadCategories`, `getFaqs`, `listBlogPosts`, `loadBlogCategories`, `getReviews` | Thrown | The error page |
| The sitemap (`src/app/sitemap.ts`) | Thrown: the request answers 500. Only a `404` of the blog means "no blog pages", and a failed FAQ or review call is ignored | A search engine keeps the sitemap it read before |

| Page | File | Shows |
| --- | --- | --- |
| The error page | `src/components/shell/page-error.tsx`, used by `src/app/[locale]/(shop)/error.tsx`, `src/app/[locale]/(plain)/error.tsx` and `src/app/[locale]/(checkout)/error.tsx` | "That did not work", a "Try again" button that renders the page again, and the `digest` of the failure as the reference |
| The last resort | `src/app/global-error.tsx` | The same in both languages on a plain page, when the frame of the shop itself fails |
| The 404 page | `src/app/[locale]/(shop)/not-found.tsx` | Also for a page number beyond the last page of a list |

A page built ahead of time must not stop the build when the API is away: `loadCategories`, `getFaqs`, `getBlogPost`, `loadBlogCategories` and `getLegalDocument` call `leaveToFirstVisitWhileBuilding` before they throw, which leaves the page to its first visit. On a running shop it does nothing. See [architecture/rendering-and-caching.md](../architecture/rendering-and-caching.md) and [features/error-pages.md](../features/error-pages.md).

## 5. Lists and pages in the browser

| Case | What happens |
| --- | --- |
| A query fails and nothing is on screen yet | `ErrorAlert` with a title of the page and "Try again", which asks again |
| A query fails while an older answer is on screen | The older answer stays |
| The account cannot tell who is here (`GET /v1/store/me` failed for another reason than "not signed in") | `src/components/account/account-shell.tsx` and the checkout show `ErrorAlert` with "Try again" instead of sending the customer to the sign-in |
| A change of the cart or the wishlist fails | The change on screen is taken back, the stored state is read again, and the sentence shows in a toast (on the cart page, in its own place) |
| A further page of a row of the home page fails | Nothing is said; the next scroll asks again |
| The suggestions of the search fail | One line in the dropdown (`searchError` of the `common` namespace). The recommended and popular products of the empty field just stay away |

## 6. Forms and field errors

Forms check their fields in the browser first ([business-logic/forms-and-validation.md](../business-logic/forms-and-validation.md)). When the API still answers `VALIDATION_FAILED`, `fieldProblems` gives the fields; the API's English problems are not shown, the form shows its own text at each field it knows. An error without a known field goes to `ErrorAlert` under the form.

| Form | File | Fields taken from the answer |
| --- | --- | --- |
| Address (account and checkout) | `src/components/checkout/address-form.tsx` | Every field of the form; the first one gets the focus |
| Sign-in | `src/components/auth/sign-in-form.tsx` | `email`, `password`; the password is emptied after every failure |
| Sign-up | `src/components/auth/sign-up-form.tsx` | `firstName`, `lastName`, `email`, `password`, `referralCode` |
| Forgot password | `src/components/auth/forgot-password-form.tsx` | `email` |
| Reset password | `src/components/auth/reset-password-form.tsx` | `token` (the link counts as not valid), `password` |
| Profile | `src/components/account/profile-view.tsx` | Every field the answer names |
| Review of an order | `src/components/account/order-review.tsx` | `text`, `rating` |

## 7. Codes with handling of their own

Every other code is shown as its sentence.

| Code | Where | What the shop does |
| --- | --- | --- |
| `AUTH_TOKEN_INVALID` | `src/lib/api/session-transport.ts` | Refreshes the session once and repeats the call |
| `AUTH_REFRESH_INVALID`, `CUSTOMER_BLOCKED` (on the refresh) | `src/lib/api/session-transport.ts` | The session is over: the hint, the session and every cached answer are dropped |
| `AUTH_TOKEN_INVALID`, `CUSTOMER_NOT_FOUND` (on `GET /v1/store/me`) | `src/features/session/session.ts` | Nobody is signed in: the hint is removed, no error |
| `CATEGORY_NOT_FOUND`, `PRODUCT_NOT_FOUND`, `BLOG_POST_NOT_FOUND`, `NOT_FOUND` | `src/features/catalogue/data.ts`, `src/features/content/data.ts` | The 404 page |
| `LEGAL_DOCUMENT_NOT_FOUND`, `BAD_REQUEST` | `src/features/legal/data.ts` | The page counts as not published |
| `NOT_FOUND` (on the overview) | `src/components/account/overview.tsx` | An API without the overview: the tiles are left out |
| `CUSTOMER_EMAIL_TAKEN` | `src/components/auth/sign-up-form.tsx` | Says so at the email field, with a link to the sign-in |
| `CUSTOMER_EMAIL_TAKEN` | `src/components/checkout/checkout-view.tsx` (guest) | Goes to the sign-in with the email filled in and the way back to the checkout |
| `PASSWORD_TOO_WEAK` | `src/components/auth/sign-up-form.tsx`, `src/components/auth/reset-password-form.tsx` | A text at the password field, which is emptied and focused |
| `SIGNUP_CODE_INVALID` | `src/components/auth/sign-up-form.tsx` | "Wrong code" with `details.attemptsLeft`; the field is emptied |
| `SIGNUP_NOT_FOUND` | `src/components/auth/sign-up-form.tsx` | Back to the sign-up form, marked as expired |
| `REFERRAL_CODE_UNKNOWN` | `src/components/auth/sign-up-form.tsx` | The code is marked unknown and refused on submit; any other failure of the check lets the code go with the sign-up |
| `PASSWORD_RESET_INVALID` | `src/components/auth/reset-password-form.tsx` | The page says the link is not valid any more |
| `CUSTOMER_CREDENTIALS_INVALID` | `src/components/account/delete-account.tsx` | "Wrong password"; the field is emptied |
| `CUSTOMER_HAS_OPEN_ORDERS` | `src/components/account/delete-account.tsx` | Shows what is still open, from `details` |
| `CUSTOMER_NOT_FOUND` | `src/components/public/unsubscribe-view.tsx` | The page says the link is not valid |
| `WISHLIST_NAME_TAKEN` | `src/components/wishlist/wishlist-lists.tsx` | A text at the name field |
| `DISCOUNT_NOT_APPLICABLE` (`400`) | `src/components/checkout/discount-code.tsx` | The reason of `details.reason` under the field |
| `REWARDS_NOT_APPLICABLE` (`400`) | `src/components/checkout/redeem-coins.tsx` | The reason of `details.reason` under the field |
| `ORDER_TOTAL_CHANGED` | `src/components/checkout/checkout-view.tsx` | A notice with the total before and after (`details.expectedTotal`, `details.total`); the bill is read again |
| `LEGAL_VERSION_CHANGED` | same | A notice; the consent is unticked and the legal versions are read again |
| `ORDER_ITEMS_NOT_ORDERABLE` | same | Names the refused lines with their issue (`details.lines`); the bill is read again |
| `DISCOUNT_NOT_APPLICABLE` (`409`) | same | A notice that the code was removed, with the reason; a guest's code is dropped; the bill is read again |
| `REWARDS_NOT_APPLICABLE` (`409`) | same | A notice that the coins were dropped, with the reason; the bill is read again |
| `PAYMENTS_NOT_CONFIGURED` | same | "Not available" notice; the button is disabled |
| `COMPANY_DETAILS_MISSING`, `LEGAL_DOCUMENTS_MISSING` | same | "Ordering is not possible" notice; the button is disabled |
| `ORDER_NOT_PAYABLE` | same | The order of this idempotency key is paid or given up: the key is cleared, a notice shows, the button is disabled |
| `ADDRESS_NOT_FOUND` | same | The sentence, and the addresses are read again (the bill is read again after any other refusal too) |
| `PAYMENT_PROVIDER_ERROR` | same | The sentence with "Try again", which places the order again. The shop raises this code itself when the address of the payment page is not an accepted one |
| `ORDER_NOT_PAYABLE` | `src/components/account/order-payment.tsx` | The payment is read again, so the page shows the real state |
| `STOCK_ALERT_NOT_NEEDED` | `src/features/stock-alerts/stock-alerts.tsx` | "Add to cart" takes the place of "Notify me": the product page asks for its pack sizes again, a card uses `details.ordering` |
| `STOCK_ALERTS_DISABLED` | same | Every "Notify me" control of the page goes |
| `PRODUCT_VARIANT_NOT_FOUND` (on a request) | same | The control of that pack size goes |
| `AUTH_TOKEN_INVALID`, `AUTH_REFRESH_INVALID`, `UNAUTHENTICATED`, `CUSTOMER_NOT_FOUND` (on a customer's request) | same | The visitor's form opens |
| `STOCK_ALERT_TOKEN_INVALID`, and `VALIDATION_FAILED` on the two link pages (a token cut short) | `src/components/public/stock-alert-links.tsx` | "This link is no longer valid." in the place of the page's content |
| `STOCK_ALERT_NOT_FOUND` (on cancelling) | `src/features/stock-alerts/stock-alerts.tsx`, `src/components/account/notifications-view.tsx` | Treated as cancelled |
| `ORDER_NOT_FOUND` | `src/components/account/order-detail.tsx`, `src/components/account/guest-order.tsx` | An information that the order is gone, not an error |
| `ORDER_TOKEN_INVALID`, `VALIDATION_FAILED` (guest order) | `src/components/account/guest-order.tsx` | "This link is not valid"; the token kept in the tab is forgotten |
| `REVIEW_ALREADY_WRITTEN` | `src/components/account/order-review.tsx` | The review is read afresh and shown |

The checkout's cases are explained with their texts in [features/checkout.md](../features/checkout.md); the session's in [architecture/authentication-and-security.md](../architecture/authentication-and-security.md).
