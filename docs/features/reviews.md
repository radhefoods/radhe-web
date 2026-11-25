# Reviews

A signed-in customer reviews a delivered order once, as a whole, with stars and a few words. Radhe Foods reads every review in the admin panel before it is shown. The published ones are what every visitor sees under "What our customers say": on a page of its own and in a section of the home page. Products carry no rating.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | 2026-11-02 |
| **Pages** | `/en/reviews` · `/de/bewertungen`, `/en/account/reviews` · `/de/konto/bewertungen`; a section of the order page and of the home page |
| **Code** | `src/components/reviews`, `src/features/reviews`, `src/components/account/order-review.tsx`, `src/components/account/reviews-view.tsx`, `src/components/account/star-picker.tsx`, `src/components/home/customer-reviews.tsx`, `src/app/[locale]/(shop)/reviews/page.tsx` |
| **API** | [Order reviews](../api/endpoints.md#order-reviews) |
| **State** | The API. The public list is cached on the server for five minutes (tag `reviews`); `page` and `rating` in the address bar; TanStack Query entries `["orderReview", number, locale]`, `["account", "reviews"]`, `["account", "reviewable"]` |
| **Texts** | `reviews`; the pagination labels from `catalogue` |
| **Tests** | `e2e/reviews.spec.ts`, `mocks/reviews.test.ts` |
| **Backend reference** | [reference/backend/order-reviews.md](../reference/backend/order-reviews.md) |

## What the customer sees

### Reviewing an order

The form is on the page of the order ([orders.md](orders.md)), in the section "Your review" (`OrderReview` in `src/components/account/order-review.tsx`). The section exists for a signed-in customer once the order was delivered and the API says a review can be written or has been written; it is absent otherwise, and on an API without the route.

| State | Content |
| --- | --- |
| A review can be written | "How was this order? Your review is shown in the shop once Radhe Foods has read it."; "Your order" with five stars to choose from; "Tell us about your experience", a text field with "At least 10 characters, at most 2000." and a counter ("0 / 2000"); "Submit review" |
| Just sent | "Thank you. Your review will be shown once Radhe Foods has read it." above the review |
| Written | The stars, the status chip, the words, "Written on …"; for a review that was not published "Note from Radhe Foods: …" in red; and "Reply from Radhe Foods" with the answer, when there is one |

A review is written once. There is nothing to edit and nothing to delete.

### The reviews page of the account

`ReviewsView` in `src/components/account/reviews-view.tsx`: "Reviews" with "Review a delivered order once, with stars and a few words. Radhe Foods reads every review before it is shown."

| Region | Content |
| --- | --- |
| "Orders you can review" | One row per delivered order without a review: its pictures, "Order RF-1084" (a link), "Delivered on … · 3 items", and the button "Write a review", which leads to the order page where the form is. Empty: "Nothing to review yet. Orders appear here once they were delivered." |
| "Your reviews" | One card per review, whatever its status: the order, the chip, the stars, the words, "Written on …", the note of a rejection, the reply. Empty: "You have not written a review yet." |

Loading shows two grey rows; a failure of either list shows "We could not load this page." with "Try again".

### The public page

`/reviews`, rendered on the server: "What our customers say" with "Every review here was written by a customer about an order we delivered."

| Region | Content |
| --- | --- |
| The summary (`ReviewSummary`) | The average large, with one decimal in the language's notation ("4.6", "4,6"); five stars filled to the decimal; "4.6 of 5 from 128 orders"; and five bars, 5 stars to 1, each with its count |
| The bars | Each is a link that narrows the list to that number of stars (`?rating=4`); the chosen one is marked, and "Show all reviews" leads back |
| The reviews | Cards, two beside each other from `md`, ten to a page, newest first |
| The pages | Numbered links (`?page=2`), the shop's shared pagination |

A card (`ReviewCard`): the stars, the mark "Verified order", the customer's words in the language they were written in, the author as the API names them ("Priya S.") with the month of publishing, and "Reply from Radhe Foods" when there is one.

| State | What shows |
| --- | --- |
| No published review | "No reviews yet. The first one appears here once a delivered order was reviewed." |
| A star filter without a review | The summary, then "No reviews with this number of stars." |
| A page number beyond the last | The "Page not found" page |
| The API does not answer | The [error page](error-pages.md) |

### The section of the home page

`CustomerReviews` (`src/components/home/customer-reviews.tsx`) stands after the product rows, only while the shop has a published review: the heading "What our customers say", the stars with "4.6 of 5 from 128 orders", the pill "All reviews", and the three newest reviews as cards. On these cards a long text is cut after five lines and a reply after three. When the reviews cannot be read, the home page leaves the section out and shows everything else.

## Rules

### Statuses of a customer's review

| API value | English wording | Chip |
| --- | --- | --- |
| `pending` | Waiting for approval | Wheat |
| `published` | Published | Green |
| `rejected` | Not published | Red |

### Who decides

| Case | What happens | Decided by |
| --- | --- | --- |
| Whether an order can be reviewed | `canReview` of `GET /v1/store/orders/{n}/review`: delivered, and no review yet | The API |
| One review per order | A second attempt answers `REVIEW_ALREADY_WRITTEN`; the section reads the review afresh | The API |
| Which reviews are public, the author's name, the average, the counts per star | As sent | The API (the admin approves) |
| No stars chosen | Not sent: "Please choose a number of stars." | The browser |
| Fewer than 10 characters after trimming | Not sent: "Please write at least 10 characters." | The browser; the API has the same limit |
| More than 2000 characters | The field does not take them | The browser; the API has the same limit |
| Coins for a published review | Said in the rules of the coins ("25 coins for a published review."); granted by the API ([rewards.md](rewards.md)) | The API |
| `?page=` and `?rating=` | `page` must be a whole number from 1; `rating` a whole number from 1 to 5; anything else is ignored (`parseReviewsState`) | The browser |
| What a search engine may index | The list and its further pages. A filtered list, and the page while no review is published, say `noindex, follow`. A further page names itself as canonical (`/reviews?page=2`) | The browser ([seo.md](../architecture/seo.md)) |

### What the browser draws from the numbers

- **The stars of an average** are five grey stars with a filled row clipped over them at `average × 20` per cent: 4.6 fills 92 %.
- **The width of a bar** is its count divided by the largest of the five counts. With 80, 30, 10, 5 and 3 reviews for 5 to 1 stars, the bars are 100 %, 37.5 %, 12.5 %, 6.25 % and 3.75 % wide.
- **The average** is printed with exactly one decimal (`formatAverage`): 4.6 in English, 4,6 in German.

### Structured data

None. The reviews pages and the home page's section put no `Review` or `AggregateRating` data into the page, and the product data for search engines carries no rating.

## Trustpilot

Not built. Nothing in the repository names Trustpilot: no widget, no script, no link in the footer, no invitation to review there, no text in `messages/en.json` or `messages/de.json`, no entry in the [decision log](../decisions/decision-log.md) and no document of the backend. The reviews the shop shows are its own order reviews, collected and approved through the API.

## Data and API

```
order page      GET  /v1/store/orders/{n}/review         { review, canReview }; read again at every visit
                POST /v1/store/orders/{n}/review         { rating, text, locale } -> the review, waiting for approval
account page    GET  /v1/store/me/reviews/reviewable     delivered orders without a review
                GET  /v1/store/me/reviews                the customer's reviews, whatever their status
public page     GET  /v1/store/reviews?page=1&limit=10[&rating=4]   on the server
home page       GET  /v1/store/reviews?limit=3                      on the server
```

- `getReviews` in `src/features/reviews/data.ts` reads the public list on the server and keeps an answer for five minutes (`REVALIDATE.reviews`); in development it is read fresh every time. A review therefore appears within minutes of its approval.
- The metadata and the page ask for the same list; the call is answered once.
- After a review is written, the section keeps it and the two lists of the account are read again.
- Field errors of the API on `rating` or `text` land at the stars or the text with the messages above; any other error shows as an alert above the button.

## Behaviour

- The star picker is five radio buttons drawn as stars: the arrow keys move between them, and a screen reader hears "3 stars".
- A row of stars that shows a rating is one image with a spoken label ("4.6 out of 5, 128 reviews"); the star characters themselves are hidden from screen readers.
- The bars of the summary are a `nav` named "Reviews by stars"; each link is named "4 stars: 30 reviews". They are plain links, so the filter works without scripts and can be shared.
- A review written in the other language carries its `lang`, so it is read out in its own language.
- The public page stacks the summary (average above the bars) and shows one card per row on phones.

## Not built

- Reviews and stars of products: nothing on a product card or a product page is rated.
- Editing or deleting a review, and a second review of the same order.
- Photos with a review, a title, "helpful" votes, sorting.
- Reviews by guests.
- Structured data for reviews.
- Trustpilot, Google reviews or any other outside review service.

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(shop)/reviews/page.tsx` | The public page, its metadata and its paging |
| `src/app/[locale]/(shop)/account/reviews/page.tsx` | The reviews page of the account |
| `src/components/account/order-review.tsx` | The section of the order page: the form and the written review |
| `src/components/account/star-picker.tsx` | Choosing one to five stars |
| `src/components/account/reviews-view.tsx` | The orders to review and the customer's reviews |
| `src/components/reviews/review-summary.tsx` | The average and the bars that filter |
| `src/components/reviews/review-card.tsx` | One published review |
| `src/components/reviews/rating-stars.tsx` | Five stars filled to a decimal |
| `src/components/home/customer-reviews.tsx` | The section of the home page |
| `src/features/reviews/reviews.ts` | Cache keys, chip colours, the limits of the text, the page size, `formatAverage`, the address state |
| `src/features/reviews/data.ts` | `getReviews`, the cached read on the server |
