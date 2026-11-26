# Back-in-stock emails ("Notify me")

For a pack size that cannot be ordered, a customer asks to be told when it can, and gets one email then. A signed-in customer asks with one tap; a visitor gives an email address, ticks a box and confirms the address by a link. The API keeps the requests, decides when a pack size is back and sends the emails. The shop shows the control where "Add to cart" would stand, the two pages the emails link to, and the list of what a customer waits for.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | 2026-11-26 |
| **Pages** | `/en/stock-alerts/confirm` · `/de/stock-alerts/confirm`; `/en/stock-alerts/unsubscribe` · `/de/stock-alerts/unsubscribe`; `/en/account/notifications` · `/de/konto/benachrichtigungen`; a control on every product page and product card |
| **Code** | `src/features/stock-alerts`, `src/components/catalogue/notify-me.tsx`, `src/components/catalogue/notify-me-panel.tsx`, `src/components/catalogue/notify-me-form.tsx`, `src/components/catalogue/notify-me-sheet.tsx`, `src/components/catalogue/stock-alert-notice.tsx`, `src/components/public/stock-alert-links.tsx`, `src/components/account/notifications-view.tsx`, `src/app/[locale]/(plain)/stock-alerts`, `src/app/[locale]/(shop)/account/notifications` |
| **API** | [Back-in-stock emails](../api/endpoints.md#back-in-stock-emails) |
| **State** | The API. The switch `stockAlerts.enabled` of the settings in the context of `StockAlertsProvider`; a customer's requests in the TanStack Query cache under `["stock-alerts", locale]`. Nothing is stored in the browser: a visitor's request leaves no trace there |
| **Texts** | `stockAlerts` (the control, with every page), `stockAlertLinks` (the two link pages), `account` (`nav.notifications`, `notifications`), the sentences of `errors` |
| **Tests** | `e2e/stock-alerts.spec.ts`, `mocks/stock-alerts.test.ts`, `src/features/stock-alerts/outcome.test.ts`, `src/features/stock-alerts/list-cache.test.ts` |
| **Backend reference** | [reference/backend/stock-alerts.md](../reference/backend/stock-alerts.md); section 26 of the backend's `api/store-api.md` |

**Switched off until the admin switches it on.** `GET /v1/store/settings` carries `stockAlerts { enabled }`. While it is `false`, or the settings have no such field (an API from before 2026-11-25), or the settings could not be read, the shop shows nothing of this feature: no control, no entry in the account, and the address of the account page shows the shop's "not found" page. The live API had no such field on 2026-11-26.

## What the customer sees

The control is offered for a pack size whose `ordering.canOrder` is `false`, whatever the reason ("Sold out", "Currently not available"). The pill that says the reason stays where it is; "Notify me" is added to it. A request is for one pack size: 1 kg can be back while 5 kg is not.

### On the product page

Under the pill that stands in the place of "Add to cart" (`NotifyMePanel`):

| State | What shows |
| --- | --- |
| Nothing asked | The button "Notify me" with a bell, full width, in the secondary look; under it "Email me when this product is back in stock." |
| A visitor tapped it | In the button's place: "Email me when this product is back in stock.", the field "Email address" (it has the focus), the box "I agree to receive one email when this product is available again.", the button "Notify me" and "Not now", which closes the form |
| The form is sent without a valid address, or without the tick | "Please enter a valid email address." under the field, or "Please tick the box, so that we may email you." under the box; the focus goes to the first of them. Nothing is sent |
| The visitor's request was taken, and the shop asks for a confirmation | A green message "Almost done": "Please confirm your address with the link we emailed you." |
| The visitor's request was taken, and the shop asks for none | A green message "We will email you when it is back." |
| A signed-in customer tapped it, or waits already | A green pill "We will notify you" with a ringing bell and "Cancel"; under it "We will email you at anna@example.com when it is back." No form |
| The customer cancelled | The button "Notify me" again; under it "You will not be notified about this product." |
| A call is on its way | The button shows that it is busy and keeps its size |
| The API refuses with a sentence | The sentence under the control, in the form while the form is open ([refusals](#what-the-api-refuses)) |

Each pack size of the page keeps its own state: choosing another size shows that size's control, and coming back shows what was said before.

On phones the bar above the tab bar shows the button "Notify me" in the place of its pill while there is something to ask. A visitor is taken to the form in the page; a customer is asked for with the tap and reads "We will email you at … when it is back." at the top of the window. Once the customer waits, or the visitor's form or its answer is in the page, the bar shows the pill again.

### On a product card

In the slot at the end of the price row, where the basket stands for a size that can be ordered (`NotifyMeBell`): a round bell on a soft leaf tone. The pill on the picture stays.

| Who | A tap |
| --- | --- |
| A signed-in customer | Asks at once. The bell fills and rings; at the top of the window "We will email you at anna@example.com when it is back." A second tap takes the request back and empties the bell |
| A visitor | Opens a panel that slides over the page (`Sheet`): the title "Notify me", the product with its size, "Email me when this product is back in stock." and the same form. After it: the green message and "Done". Closing the panel returns the focus to the bell |

A refusal that is a sentence is said at the top of the window for eight seconds (`StockAlertNotice`), as the wishlist and the cart say theirs.

### The page of the confirmation link

`/stock-alerts/confirm?token=…`, in the plain frame (the logo only), titled "Confirm your notification".

| State | What shows |
| --- | --- |
| The page opens | "We are confirming your address …" |
| Confirmed, also when the link was used before | The green message "Confirmed": "We will email you at gi\*\*\*@example.com when it is back." (the API hides most of the address), the button "Continue shopping" (to all products) and "Cancel this notification" |
| "Cancel this notification" was pressed | As after the unsubscribe link, below |
| The email about the pack size went out before the link was used | "Already sent": "We have already emailed you about this product. Please look in your inbox." |
| The request was cancelled or has lapsed | "This notification has ended": "It was cancelled or has lapsed. You can ask again on the page of the product." |
| The link is not genuine, its request is gone, or the address has no token | "This link is no longer valid." with "It may have expired, or it was not copied in full. You can ask again on the page of the product." and "Continue shopping" |
| Any other failure | The error's sentence with "Try again" |

### The page of the unsubscribe link

`/stock-alerts/unsubscribe?token=…`, in the plain frame, titled "Cancel notification".

| State | What shows |
| --- | --- |
| The page opens | "After this we will not email you when this product is back in stock." and the button "Cancel notification". Nothing has been changed |
| The button was pressed | The green message "Cancelled": "You will not be notified about this product." and "Continue shopping" |
| The address still waits for other pack sizes | Also "You are still waiting for 2 other products." and the button "Cancel all my notifications (2)" |
| "Cancel all" was pressed | "All your notifications are cancelled." |
| The link is not genuine, or the address has no token | "This link is no longer valid.", as above |

Neither page names the product: the API tells the pages its id only ([Not built](#not-built)).

### "Notifications" in the account

An entry "Notifications" at the end of the account's navigation, and the page `/en/account/notifications` · `/de/konto/benachrichtigungen`.

| State | What shows |
| --- | --- |
| Loading | The title, the line "You get one email as soon as a product you are waiting for can be ordered again." and three grey cards |
| Nothing waits | A bell, "You are not waiting for any product." and the button "Browse the range" |
| Requests | The product card of each pack size, newest first, as listings show it (its bell is filled); under each "Waiting since 26 November 2026" and "Cancel" |
| A pack size left the shop | A quiet tile "No longer in the shop": "This product has left our range.", with the same line and "Cancel" |
| The list could not be read | "We could not load your notifications." with the error's sentence and a retry |

While the shop does not offer the emails, the page is the shop's "not found" page, with that title. Like every page of the account it is put on the screen by the browser once the account's frame knows who is here: the address answers `200` with `noindex`, a visitor is sent to the sign-in first, and a signed-in customer reads "Page not found".

A request ends by itself when its email went out, so the list holds what is still open. Cancelling removes the card at once, by "Cancel" or by the bell of the card.

## Rules

| Case | What happens | Decided by |
| --- | --- | --- |
| Whether the shop offers the emails | `stockAlerts.enabled` of the settings; a missing field and unread settings mean no | The API; `src/app/[locale]/(shop)/layout.tsx` hands it to `StockAlertsProvider` |
| Where the control shows | For the shown pack size with `ordering.canOrder: false`, on the product page (with the fresh ordering the page asks for) and on a card (with the ordering the list was rendered with) | `ProductPurchase`, `ProductCard` |
| Who is asked for an address | A visitor. A customer's request uses the address of the account and counts at once | The API; the control looks at the session (`useSession`) |
| A tap while "who is here" is still being asked | The control waits for that answer (`customerNow` in `src/features/session/session.ts`), then asks as the customer or opens the form | `useNotifyMe` |
| What the form checks before the call | The address by the pattern of the sign-in forms (`checkEmail`), and the tick. The address is sent trimmed and in lower case | `NotifyMeForm`; the API checks again |
| What a visitor is told | The same after every request, whether or not the address was waiting already: the shop never says "you are already subscribed" | The API answers the same `202`; the shop shows `confirmationRequired` |
| Whether a visitor confirms the address | `confirmationRequired` of the answer | The API (the admin's rule) |
| Whether a customer waits for a pack size | The list `GET /v1/store/me/stock-alerts` holds a request with its `variantId` | The API; `useNotifyMe` |
| When the list is asked for | While the shop offers the emails, a customer is signed in and a control or the account page needs it; all controls of a page share one request | `useMyStockAlerts` |
| The language of the emails | The language of the page, sent as `locale` in the body of the two requests | The shop sends it; the API writes the emails |
| When the confirmation is made | Once, by the browser after the page has loaded; never while the server renders, and one call per try even where React runs an effect twice | `StockAlertConfirmView` |
| When the unsubscribe link acts | Only on its button: programs that check the links of an email open them | `StockAlertUnsubscribeView` |
| Search engines and referrers | Both link pages say `noindex, nofollow` and `referrer: no-referrer`, and `robots.txt` closes `/stock-alerts/`: the address carries a token | The pages, `src/app/robots.ts` |
| When a pack size is back, who is told and in which order, the limits, how long a request waits | Not the shop's | The API: [reference/backend/stock-alerts.md](../reference/backend/stock-alerts.md) |

### What the API refuses

`refusalOf` in `src/features/stock-alerts/outcome.ts` sorts a refusal into what it means for the control.

| The API answers | The control |
| --- | --- |
| `409 STOCK_ALERT_NOT_NEEDED` (the pack size can be ordered now) | "Good news: this product can be ordered again." at the top of the window, and "Add to cart" takes over: the product page asks for its pack sizes again; a card puts the basket into the slot with `details.ordering` of the answer, drops its pill and shows its picture in colour |
| `409 STOCK_ALERTS_DISABLED` (switched off since the page was made) | Every control of the page goes; the pill stays |
| `404 PRODUCT_VARIANT_NOT_FOUND` (the pack size left the shop) | This control goes |
| `401` (the session ended) | The visitor's form opens |
| `400 VALIDATION_FAILED` naming `email` or `consent` | The message under that field |
| `409 STOCK_ALERT_LIMIT_REACHED` with `details.unconfirmed` | "Please confirm the requests we already emailed you about first." |
| `409 STOCK_ALERT_LIMIT_REACHED` without it | "You are waiting for the maximum number of products." |
| `403 CUSTOMER_BLOCKED` | "This account is blocked. Please contact Radhe Foods." |
| `429`, no connection, anything else | The sentence of the error; the control stays, so the tap can be repeated |
| `404 STOCK_ALERT_TOKEN_INVALID` on a link page, and `400 VALIDATION_FAILED` there (a token cut short) | "This link is no longer valid." |
| `404 STOCK_ALERT_NOT_FOUND` on cancelling | Treated as cancelled: the request is gone either way |

## Data and API

```
product page or card, pack size with ordering.canOrder: false, stockAlerts.enabled: true

visitor   tap → form → POST /v1/store/stock-alerts { variantId, email, consent: true, locale }
              → 202 { variantId, productId, confirmationRequired }      → "Almost done" or "We will email you"
          email link /stock-alerts/confirm?token=…  → proxy → /en/stock-alerts/confirm?token=…
              → POST /v1/store/stock-alerts/confirm { token }            (browser, once)
              → 200 { alert, unsubscribeToken }                          → "Confirmed"
          email link /stock-alerts/unsubscribe?token=…  → button
              → POST /v1/store/stock-alerts/unsubscribe { token, all? }
              → 200 { alert, cancelled, waiting }                        → "Cancelled"

customer  GET /v1/store/me/stock-alerts                                  → which pack sizes wait
          tap → POST /v1/store/me/stock-alerts { variantId, locale }
              → 201 { alert, created: true } or 200 { …, created: false } → "We will notify you"
          "Cancel" → DELETE /v1/store/me/stock-alerts/{id}               → "Notify me" again
```

Every call is made by the browser (`api` of `src/lib/api/browser.ts`); the server reads the settings only, kept for 300 seconds like every setting ([rendering and caching](../architecture/rendering-and-caching.md)), so a switch in the admin panel shows after that time. The customer's list is fresh for 30 seconds and is changed in place after a request and a cancellation (a read of it that is still on its way is stopped first, so it cannot bring back the list from before; `src/features/stock-alerts/list-cache.ts`); like every cached answer of a customer it is dropped when the session ends or changes hands. All six calls carry the language as `Accept-Language`.

## Behaviour

- **The card.** The bell stands in the slot of the price row (`cardSlot` in `src/components/catalogue/card-slot.ts`), so a card that cannot be ordered is laid out like one that can: beside the price from 14 rem of card width, under it on narrower cards. It is a toggle for assistive technology (`aria-pressed`), named "Notify me when {name} is back" or "Cancel the notification for {name}".
- **A size that came back.** The card changes without being rendered again: the slot carries `data-back-again`, and the card's pill and the grey of its picture answer to it in CSS (`group-has-[[data-back-again]]`).
- **Loaded on demand.** A card carries the bell and its state only. The panel with the form and the dialog code behind it is fetched when a bell is first touched, focused or pointed at ([performance](../architecture/performance.md#code-loaded-on-demand)); a signed-in customer never needs it.
- **The form.** One form for the product page and the panel; the field takes the focus when the form opens; the two messages are announced when they appear.
- **Motion.** The bell pops once when it fills (`animate-count-pop`); nothing else is particular to this feature.

## Not built

Confirmed against the code and the backend's document:

- **A link to the product on the two link pages.** The answers of the confirmation and the unsubscribe call name the pack size by `productId` and `variantId`; the shop reaches a product by its slug, and the API has no call that finds a product by its id. The pages lead to all products instead.
- **A memory of a visitor's request.** After a reload the control of a visitor reads "Notify me" again. Asking again changes nothing and sends nothing.
- **Asking for a whole product**, for a category or for a search: a request is for one pack size.
- **A count of people waiting**, or a date when the pack size is expected.
- **The emails themselves**, and the admin's view of who waits for what: both are the API's and the admin panel's.
- **A link to the privacy policy in the form.** The text of the box says what is agreed to; the policy is written in the admin panel.

## Code map

| File | What it is |
| --- | --- |
| `src/features/stock-alerts/stock-alerts.tsx` | `StockAlertsProvider` (the switch, and what is said at the top of the window), `useMyStockAlerts`, `useNotifyMe`: whether the customer waits for a pack size, asking, asking as a visitor, cancelling |
| `src/features/stock-alerts/outcome.ts` | `refusalOf`: what a refusal of the API means for the control |
| `src/features/stock-alerts/list-cache.ts` | The key of the customer's list in the cache, and the two changes made to it in place: a request taken, a request taken back |
| `src/components/catalogue/notify-me.tsx` | What every product card carries: `useNotifyControl` (the state of one control, per pack size) and `NotifyMeBell`, which fetches its panel on demand |
| `src/components/catalogue/notify-me-panel.tsx` | `NotifyMePanel` (the block of the product page) and `NotifyMeBarButton` (the phone bar) |
| `src/components/catalogue/notify-me-form.tsx` | `NotifyMeForm` (the address and the box) and `NotifyMeAsked` (what a visitor is told after it) |
| `src/components/catalogue/notify-me-sheet.tsx` | `NotifyMeSheet`: the panel a card opens for a visitor |
| `src/components/catalogue/stock-alert-notice.tsx` | What a card's bell has to say, at the top of the window |
| `src/components/catalogue/card-slot.ts` | The classes of the slot the basket and the bell share |
| `src/components/catalogue/product-purchase.tsx`, `src/components/catalogue/product-card.tsx` | Where the control is placed |
| `src/components/public/stock-alert-links.tsx` | `StockAlertConfirmView` and `StockAlertUnsubscribeView` |
| `src/app/[locale]/(plain)/stock-alerts/confirm/page.tsx`, `src/app/[locale]/(plain)/stock-alerts/unsubscribe/page.tsx` | The two link pages: the heading, the token of the address, the metadata |
| `src/components/account/notifications-view.tsx`, `src/app/[locale]/(shop)/account/notifications/page.tsx` | The list in the account; the page is the shop's "not found" while the feature is off |
| `src/components/account/account-shell.tsx` | The entry "Notifications", while the feature is on |
| `src/app/[locale]/(shop)/layout.tsx` | Reads the switch and mounts the provider and the notice |
| `src/lib/api/store-api.ts`, `src/lib/api/types.ts`, `src/lib/api/errors.ts`, `src/lib/api/error-text.ts` | The six calls, their types, the five error codes and the two sentences of the limit |
| `mocks/stock-alerts.ts`, `mocks/server.ts` | The mock's side: the rules of the backend in memory, and three controls ([mock API](../development/mock-api.md)) |
