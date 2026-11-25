# Returns and problem reports

Two ways for a signed-in customer to tell Radhe Foods that something about a delivered order is not right. A return asks to send products back; a problem report says what went wrong with a delivery (damaged, missing, not fresh, late) with photos and a wish. Radhe Foods decides about both in the admin panel and answers by email; the shop collects the request and shows what came of it. Guests have neither.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | Problem reports 2026-11-01. Returns are older; the day is not recorded |
| **Pages** | `/en/account/orders/RF-1084/return` · `/de/konto/bestellungen/RF-1084/ruecksendung`, `/en/account/orders/RF-1084/report` · `/de/konto/bestellungen/RF-1084/problem-melden`, `/en/account/reports` · `/de/konto/meldungen`, `/en/account/reports/RF-1084-P1` · `/de/konto/meldungen/RF-1084-P1` |
| **Code** | `src/components/account` (`return-request.tsx`, `report-problem-view.tsx`, `photo-picker.tsx`, `issue-view.tsx`, `issues-list.tsx`, `order-issues.tsx`, the returns part of `order-detail.tsx`), `src/features/issues` |
| **API** | [Returns](../api/endpoints.md#returns), [Problem reports](../api/endpoints.md#problem-reports) |
| **State** | The API. TanStack Query entries `["order-returns", number, locale]`, `["order-issues", number, locale]`, `["issues", locale]`, `["issue", number, locale]`; `photos=failed` in the address bar |
| **Texts** | `returns`, `issues`, `errors` |
| **Tests** | `e2e/account.spec.ts` ("a return is requested with a reason, and can be withdrawn"), `e2e/issues.spec.ts`, `src/features/issues/issues.test.ts`, `mocks/issues.test.ts`, `mocks/multipart.test.ts` |
| **Backend reference** | [reference/backend/store-api.md](../reference/backend/store-api.md) (sections 12 and 23), [reference/backend/customer-accounts.md](../reference/backend/customer-accounts.md) (section 9) |

Both start on the page of an order ([orders.md](orders.md)).

## What the customer sees

### Returns on the order page

The section "Returns" shows while the API says a return is possible (`order.returns.possible`) or the order has return requests.

- A request shows "Return {returnNumber}", its status chip, "Requested on …", one line per product ("2 × Guava / Jamfal (500g) · Damaged", and "1 of 2 approved" when fewer were approved), "Answer of Radhe Foods: …", "Credited: …", and "Withdraw the request" while `canCancel`.
- The way to a request is the button "Request a return" with "You can ask to send products back until 26 November 2026." from `order.returns.until`.

### Requesting a return

`ReturnRequestView` in `src/components/account/return-request.tsx`: "Back to the order", "Request a return", and "Choose what you want to send back from order RF-1084. Radhe Foods decides about every request and answers by email."

| Part | Content |
| --- | --- |
| One row per pack size that can be returned | The picture (a parcel icon without one), the name, the size, "2 can be returned", and a stepper from 0 to that number |
| A row with a quantity above 0 | Turns leaf-coloured and opens "Reason" (a list starting at "Please choose") and "What is wrong? (optional)", up to 500 characters |
| Under the rows | "Anything else we should know? (optional)", up to 1000 characters, and "Send the request" |

When nothing can be returned the page says "Nothing of this order can be returned at the moment."; when it cannot be loaded, "We could not load this page." After sending, the customer is on the order page again, with the request under "Returns" as "Waiting for our answer".

### Problems on the order page

On a delivered order the section "Problems" (`OrderIssues`) lists the reports made so far (number, problems, day, status chip, each a link) and, while the API's window is open, "Report a problem" with "You can report a problem until …". The section is absent while there is neither a report nor an open window, and on an API without the route.

### Reporting a problem

`ReportProblemView` in `src/components/account/report-problem-view.tsx`. The head shows "Report a problem", a chip with the days left ("You have 3 days left to report", "Today is the last day to report") and "Sorry something wasn't right. Tell us what happened and we sort it out, usually the same day." Then four numbered steps, with a summary card beside them from `lg` (it stays in view while the steps scroll) and below them otherwise.

| Step | Content |
| --- | --- |
| 1 "Which items had a problem?" | One row per delivered pack size: a checkbox, the picture, the name, the size and unit price, "3 delivered". A ticked row shows "Affected", a stepper from 1 to the delivered number, and "of 3". "Leave them unticked for a problem with the whole delivery." |
| 2 "What went wrong?" | Six toggles, any number of them: "Damaged", "Missing item", "Wrong item", "Not fresh", "Arrived late", "Something else" |
| 3 "Tell us a bit more" | A text of 10 to 2000 characters with a counter ("0 / 2000"), and "Add photos" ("JPEG, PNG or WebP · up to 5"). Each chosen photo shows as a thumbnail with a button to take it off |
| 4 "How should we make it right?" | One of three: "Refund" ("To the payment method you used", preselected), "Replace in next delivery" ("With your next order"), "Just tell us" ("No refund needed") |

The summary card: "Order RF-1084", "Delivered 12 November 2026 · Berlin", "Items affected" (the chosen units, or "The whole delivery"), "Problems", "Item value" (only with items), "You would like", the button "Submit report" and "Radhe Foods looks at every report and answers by email." Under it "Your previous reports" when the order has some.

When the window has closed the page says "The time for reporting a problem with this order has passed."; when no report is possible for another reason, "No report is possible for this order at the moment." After sending, the customer is on the page of the report; when a photo did not upload, with "The report was sent, but some photos could not be uploaded."

### The reports of the account

"Your reports" with "Problems you reported after a delivery, and what came of them.": one card per report, newest first, in one request: "Report RF-1084-P1", the status chip, "Order RF-1084 · Reported on …", the problems and "2 items". Empty: "No reports. Fingers crossed it stays that way."

### The page of a report

`IssueView` in `src/components/account/issue-view.tsx`: "All reports" (back), "Report RF-1084-P1" with its chip, "Reported on … · Order RF-1084" (a link to the order).

| Part | Content |
| --- | --- |
| "What we did" | Once resolved: "Refund", "Replacement with your next delivery" or "Noted, thank you", with "€4.99 credited" when an amount was credited, and the note of Radhe Foods |
| "Rejected" | For a rejected report: the note that came with the rejection |
| "Items" | "2 × Guava / Jamfal (500g)" with its value and "1 of 2 refunded"; "The whole delivery" for a report without items |
| "What happened" | The problems as chips and the customer's text |
| "Photos" | The photos of the submission; a tap opens the full picture in a new tab. While `canAddImages` each has a button to take it off |
| "What you asked for" | The wish |
| "Take back" | While `canCancel`: asks "Take this report back?" with "Yes, take it back" and "Keep it" |

The only words of Radhe Foods on the page are the note of the resolution and the note of a rejection. The status chip says where the report stands.

## Rules

### Statuses

| Return (`status`) | English wording | Report (`status`) | English wording |
| --- | --- | --- | --- |
| `requested` | Waiting for our answer | `open` | Received |
| `approved` | Approved | `in_review` | Being looked at |
| `rejected` | Declined | `resolved` | Resolved |
| `completed` | Completed | `rejected` | Rejected |
| `cancelled` | Withdrawn | `cancelled` | Taken back |

Reasons of a return, in the order of the list: `damaged` "Damaged", `wrong_item` "Wrong product", `quality` "Quality not good", `not_as_described` "Not as described", `changed_mind` "Changed my mind", `other` "Another reason".

### Who decides

| Case | What happens | Decided by |
| --- | --- | --- |
| Whether and until when a return can be requested | `order.returns.possible` and `order.returns.until` | The API |
| How many days the window has | `returns.windowDays` of `GET /v1/store/settings`. The account pages show the last day, not the number; the number is said on the delivery and payment page and in the delivery promise card of the home page | The API |
| Which pack sizes and how many units can be returned | `returnable[].available` of `GET /v1/store/orders/{n}/returns`; rows with 0 are left out | The API |
| Approving, declining, the credit | Shown as sent | The API (the admin) |
| Whether a request can be withdrawn, a report taken back, a photo removed | `canCancel`, `canAddImages` | The API |
| Whether and until when a problem can be reported | `window.possible` and `window.until` of `GET /v1/store/orders/{n}/issues` | The API |
| Which units can be named in a report | `reportable[].available`; rows with 0 are left out | The API |
| A return without a product, or a chosen product without a reason | Not sent: "Choose at least one product." · "Please choose a reason." | The browser |
| A report without a problem, or a text under 10 characters | Not sent: "Please pick at least one problem." · "Please write at least 10 characters." | The browser |
| A report without items | Allowed: it is about the whole delivery | The API |
| A file that is not JPEG, PNG or WebP | Left out, with "Please choose JPEG, PNG or WebP pictures." | The browser (`PhotoPicker`) |
| More than five photos | Only the first five are kept, with "Up to 5 photos per report." | The browser; the API has the same limit |
| The days left and the item value | Calculated for display only (below) | The browser |

The API's refusals show as an alert above the button, in the words of `errors`: for example "The time for returns of this order has passed." (`RETURN_WINDOW_CLOSED`), "You can return at most 2 units of this product." (`RETURN_QUANTITY_INVALID`), "A problem can be reported for a delivered order, up to five times." (`ISSUE_NOT_POSSIBLE`), "Radhe Foods is already looking at this report; it can no longer be taken back." (`ISSUE_TRANSITION_NOT_ALLOWED`). After a refusal the quantities are read again.

### The two sums of the report page

`daysLeft` and `issueValue` in `src/features/issues/issues.ts`.

- **Days left** = whole days from the moment the page opened until `window.until`, rounded up, never below 0. The page opened on 7 November at 18:00, the window ends on 10 November at 12:00: 2.75 days, shown as "You have 3 days left to report".
- **Item value** = the sum of quantity × unit price over the ticked rows. Two units at 4.99 € and one at 2.49 €: `2 × 499 + 1 × 249 = 1247`, shown as €12.47. It is what the named units cost, not a promise of a refund.

## Data and API

```
return page    GET  /v1/store/orders/{n}                 the lines, their names and pictures
               GET  /v1/store/orders/{n}/returns         requests so far and what can be returned
               POST /v1/store/orders/{n}/returns         { items: [{ variantId, quantity, reason, comment? }], comment?, locale }
order page     POST /v1/store/returns/{returnNumber}/cancel     "Withdraw the request"
report page    GET  /v1/store/orders/{n}                 as above
               GET  /v1/store/orders/{n}/issues          reports so far, the window, what can be named
               POST /v1/store/orders/{n}/issues          { items?, problems, description, preferredResolution, locale }
               POST /v1/store/issues/{issueNumber}/images       the photos, as multipart `files`
reports        GET  /v1/store/issues                     every report of the customer
a report       GET  /v1/store/issues/{issueNumber}
               DELETE /v1/store/issues/{issueNumber}/images/{imageId}
               POST /v1/store/issues/{issueNumber}/cancel       "Take back"
```

- The report is created first; the photos follow in a second request. When that fails the report stays, and the customer lands on its page with `?photos=failed`.
- After a return is sent, the order and its returns are read again and the customer is back on the order page. After a report, the order's reports, the list of reports and the account's overview (the count beside "Reports") are read again.
- The returns and the reports of an order are read again at every visit of their page; a report is retried twice on a network failure, `429` or `502` to `504`.

## Behaviour

- The steppers are named for screen readers ("Units of Guava / Jamfal (500g) to return", "… affected").
- The problems are toggle buttons (`aria-pressed`); the wish is a group of radio buttons drawn as cards.
- On a phone the stepper of a report row takes a line of its own, and the summary card follows the steps.
- The photo tile is a file input laid over a dashed box, so it takes the keyboard focus and opens the device's own picker.

## Not built

- Returns and reports for a guest order.
- A return label, a pick-up appointment, an exchange, or choosing how the money comes back.
- A conversation: no messages go back and forth on a report or a return, and the history of a report that the API sends is not shown.
- Adding photos to a report after it was sent (a photo can only be taken off while nobody has decided); photos on a return request.
- Paging of the reports list.

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(shop)/account/orders/[orderNumber]/return/page.tsx`, `src/app/[locale]/(shop)/account/orders/[orderNumber]/report/page.tsx` | The return page and the report page |
| `src/app/[locale]/(shop)/account/reports/page.tsx`, `src/app/[locale]/(shop)/account/reports/[issueNumber]/page.tsx` | The list of reports and the page of one report |
| `src/components/account/return-request.tsx` | The return form |
| `src/components/account/order-detail.tsx` | The "Returns" section of the order page (`ReturnCard`) |
| `src/components/account/order-issues.tsx` | The "Problems" section of the order page |
| `src/components/account/report-problem-view.tsx` | The four steps, the summary card, the previous reports |
| `src/components/account/photo-picker.tsx` | Choosing, showing and taking off photos |
| `src/components/account/issues-list.tsx` | The list of reports |
| `src/components/account/issue-view.tsx` | The page of one report |
| `src/features/issues/issues.ts` | Cache keys, chip colours, the problems and wishes in order, the limits, `daysLeft`, `issueValue` |
| `src/features/orders/orders.ts` | `RETURN_STATUS_TONE` and the cache key of an order's returns |
