# Prompt for the retail web agent: order reviews

Copy everything below the line into the agent that works on the shop (`radhe-web`, shop.radhefoods.de).

---

You are working on the Radhe Foods shop (`radhe-web`, Next.js). Reviews changed: a customer now reviews a **delivered order as a whole**, once, with stars and words. Reviews are not about products any more, and products carry no rating. Rebuild the review parts of the shop accordingly.

**Read first:** `doc/ORDER_REVIEWS.md` in the `radhe-api` repository (the sibling folder `../radhe-api` of this repository), sections 1 to 4. It holds the complete contract: endpoints, bodies, answers, error codes and the texts. If you cannot read that repository, ask for the file. All calls use the existing API client and session handling.

**Do not change the theme, colours, fonts, typography or any unrelated functionality.** Reuse the existing forms, inputs, buttons, cards, badges and the account layout.

## What to build

1. **Remove** stars and counts from product cards and product pages, the reviews section of the product page, "Write a review" per product, and the "How was it?" feedback form (delivery stars, "Anything to add? (optional)"). Their endpoints are gone.
2. **Review form on the order detail** of a delivered order, from `GET /v1/store/orders/{orderNumber}/review`: while `canReview`, two required fields, "Your order" (1 to 5 stars) and "Tell us about your experience" (10 to 2000 characters), sent with `POST …/review`; afterwards the review with its status badge (`pending` "Waiting for approval", `published`, `rejected` with the note). No edit, no delete.
3. **"Reviews" page in the account**: orders still to review from `GET /v1/store/me/reviews/reviewable` (link to the order), own reviews from `GET /v1/store/me/reviews`.
4. **"What our customers say"** from `GET /v1/store/reviews`: the summary (average, count), the reviews with stars, text, author, month, "Verified order", and the answer of Radhe Foods when `reply` is set; paged. Shown only while `summary.count > 0`. Place it on the home page or a page of its own, in the existing style.
5. **Texts** in English and German as the shop has them; the German suggestions are in the guide.

## How to work

Write your plan first (pages, components, API calls, states, texts in both languages) and wait for my go before coding. Then implement, run the shop's lint and type checks, and report what you built and what you left out.
