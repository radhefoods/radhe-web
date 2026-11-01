# Prompt for the retail web agent: accounts, guest checkout, wishlists, referrals, reviews, problem reports

Copy everything below the line into the agent that works on the shop (`radhe-web`, shop.radhefoods.de).

---

You are working on the Radhe Foods shop (`radhe-web`, Next.js). The API gained six things for customers: sign-up with an emailed code, guest checkout, closing an account, several wishlists, a referral code, product reviews with order feedback, and problem reports after a delivery. Build them into the shop.

**Read first:** `doc/CUSTOMER_ACCOUNTS.md` in the `radhe-api` repository (the sibling folder `../radhe-api` of this repository; all sections), then sections 1, 2, 3, 9, 16 and 20 to 23 of `doc/CUSTOMER_WEB_API_DOCUMENTATION.md` there. These two files hold the complete contract: every endpoint, body, answer and error code you need. If you cannot read that repository, ask for the two files. All calls use the existing API client and session handling; amounts are cents. Two reference screenshots (the account overview and the "Report a problem" page) are attached or lie in the API repository under `reference-images/`: use them for layout and flow, not for colours or fonts.

**Do not change the theme, colours, fonts, typography or any unrelated functionality.** Reuse the existing forms, inputs, buttons, cards, badges, dialogs and the existing account layout.

## What to build

1. **Sign-up with a code**: after the sign-up form (`POST /v1/store/auth/signup` now answers `202`), a code step with six digits, "Resend code" (disabled for `resendAfterSeconds`) and "Start again"; `POST /v1/store/auth/signup/verify` signs the customer in. Map `SIGNUP_CODE_INVALID` (show `attemptsLeft`) and `SIGNUP_NOT_FOUND` (back to the form). Read `ref` from the URL on every page, keep it for 30 days, and send it as `referralCode` with the sign-up; show a line when `referral.applied` is true.

2. **Guest checkout**: on the checkout page, offer "Continue as guest" next to "Sign in". A guest enters the email and the address; the cart comes from local storage; `POST /v1/store/cart/preview` with `discountCode` prices it (keep the discount field of the account checkout); `POST /v1/store/guest/checkout` with an `Idempotency-Key` creates the order, then redirect to `checkout.url`. Keep the `token` of the answer in session storage. On `409 CUSTOMER_EMAIL_TAKEN` with `details.action: "sign_in"`, open the sign-in with the email filled in and keep the cart. Build the page `/guest/orders/[orderNumber]?token=…`: the order detail (reuse the account order page without the sidebar) from `GET /v1/store/guest/orders/{orderNumber}`, "Pay now" from `POST …/pay`, cancel from `POST …/cancel`, invoice PDFs with `?token=` appended, `?payment=success|cancelled` handled as on the account page. A missing or wrong token (`403`) shows "This link is not valid". Build this page first: the API's emails and the way back from Stripe link to it as soon as the API is deployed.

3. **Account overview**: the account home from `GET /v1/store/me/overview` as in the screenshot: the greeting with the name, "Member since", the tiles (orders, invoices, wishlists, addresses), the sidebar counts, the default address, the referral box. Leave out the points, subscriptions and rewards tiles, or show them without numbers.

4. **Addresses with labels**: a "Label" field (Home, Work, Mummy…) on the address form; show it as the title of the address card; `null` removes it.

5. **Delete account**: in Settings, a "Delete account" section: password, a confirmation checkbox, the warning that it cannot be undone; `POST /v1/store/me/delete`. On `409 CUSTOMER_HAS_OPEN_ORDERS` show the order numbers and say to wait or contact Radhe Foods; on `204` sign out and go home.

6. **Orders**: after cancelling an unpaid order, go to the orders list (its detail answers `404` from then on). Treat `404` on an order page as "this order is gone".

7. **Wishlists**: the heart keeps using `/v1/store/wishlist…` (default list). The wishlist page gets a list chooser (the default marked), "New list" (`POST /v1/store/wishlists`), rename and "Make default" (`PATCH`), delete with a confirmation (`DELETE`), and per product "Move to…" and "Copy to…" (`POST …/items/{productId}/transfer`). Show `wishlist.name` as the title; the sidebar count comes from the overview. Visitors still merge their local list after sign-in.

8. **Reviews**: stars and the count from `rating` on product cards and pages; a reviews section on the product page from `GET /v1/store/products/{productId}/reviews` with `summary.distribution`, paging, and the reply of Radhe Foods under a review. "Write a review" on delivered orders and a "Reviews" page in the account from `GET /v1/store/me/reviews/reviewable` and `GET /v1/store/me/reviews`, with the status badge (`pending` "Waiting for approval", `published`, `rejected` with the note), edit and delete. Order feedback: a small "How was it?" form (stars, delivery stars, comment) on a delivered order while `canGiveFeedback`, `POST /v1/store/orders/{orderNumber}/feedback`.

9. **Problem reports**: the "Report a problem" page of the screenshot from the order detail of a delivered order (`GET /v1/store/orders/{orderNumber}/issues` for `window` and `reportable`): step 1 items with a counter up to `available`, step 2 the problem chips, step 3 the text and the photos, step 4 the wish (refund, replacement, just tell us). Submit creates the report, then uploads the photos (`POST /v1/store/issues/{issueNumber}/images`, multipart `files`), then shows the report page with its `history`, the resolution and "Take back" while `canCancel`. A "Reports" list in the account from `GET /v1/store/issues`, and "Previous reports" on the order. Show the window's `until` as "You have N days left to report".

## Details

- All texts in English and German, as the shop has them.
- Problem names: damaged, missing item, wrong item, not fresh, arrived late, something else.
- Reviews are not shown until approved; say so after submitting.
- Nothing about wishlists, reviews or reports is offered to guests; they get the emails.
- A guest cannot sign in (no password) and gets no password-reset email: when a login fails, the page already offers "Create an account", which turns the guest record into the account.
- Error answers have the shape `{ code, message, details? }` as everywhere in the shop; the codes of the new flows are listed in section 11 of `doc/CUSTOMER_ACCOUNTS.md`.

## How to work

Write your plan first (pages, components, API calls, states, texts in both languages) and wait for my go before coding. Then implement, run the shop's lint and type checks, and report what you built and what you left out.
