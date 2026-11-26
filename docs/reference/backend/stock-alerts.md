# Back-in-stock emails ("Notify me")

A customer who finds a pack size sold out asks to be told when it can be ordered again, and gets **one email** when it can. Visitors ask with an email address, signed-in customers with the address of their account. The admin sees who waits for what, which is also what customers want that the shop does not have, and sets the rules.

| | |
| --- | --- |
| **Status** | Partially implemented: the backend is complete and switched off (`enabled: false`); the frontends are not built |
| **Since** | 2026-11-25 |
| **Code** | `src/modules/stock-alerts`; the two emails in `src/mail/templates/stock-alert.templates.ts` |
| **Collection** | `stockAlerts`; the emails are records of `notifications` |
| **Setting** | `stock_alerts` |
| **Permissions** | `notifications.read`, `notifications.manage` |
| **Admin panel** | Not started ([prompt](../integration/prompts/admin-panel-stock-alerts-and-trustpilot.md)) |
| **Retail website** | Not started ([prompt](../integration/prompts/retail-website-stock-alerts-and-trustpilot.md)) |
| **Tests** | `test/stock-alerts.e2e-spec.ts`, `src/modules/stock-alerts/stock-alert-rules.spec.ts` |

When a pack size can be ordered is the rule of [stock](stock.md); how an email is queued, sent and retried is in [notifications](notifications.md).

## 1. Rules

**Who can ask, and for what**

- A request is for **one pack size** (`variantId`), never for a product as a whole: 1 kg can be back while 5 kg is not.
- A request is possible when the shop shows the pack size (the product is `active`, the pack size switched on) and it **cannot be ordered at this moment**: sold out, or the product switched off for ordering (`ordering.canOrder` is `false`, [stock](stock.md)). A pack size that can be ordered answers `409 STOCK_ALERT_NOT_NEEDED`; one the shop does not show answers `404 PRODUCT_VARIANT_NOT_FOUND`.
- **A signed-in customer** asks with the address of the account. The request counts at once. A blocked account answers `403 CUSTOMER_BLOCKED`.
- **A visitor** asks with an email address and must agree to get the email (`consent: true`). While `guestConfirmation` is on (the default) the address gets one email with a link, and the request counts once the link is used (double opt-in): nothing else is ever sent to an address nobody confirmed. A request that is not confirmed deletes itself after 7 days (`UNCONFIRMED_TTL_MS`).
- **One request per address and pack size** (a unique index). Asking again while waiting changes nothing and sends nothing. A visitor is answered the same `202` whether or not the address was waiting already, so nobody finds out what another person waits for by typing their address.
- An address waits for at most 50 pack sizes at a time (`MAX_WAITING_ALERTS_PER_EMAIL`) and has at most 5 requests that wait for their confirmation (`MAX_UNCONFIRMED_ALERTS_PER_EMAIL`): `409 STOCK_ALERT_LIMIT_REACHED`.
- A customer who signs in and asks for a pack size the same address asked for as a visitor takes that request over; the account proves the address, so an unconfirmed one counts from then on.

**When the email goes out**

- A pack size is **back** when the shop shows it, it can be ordered by the rule the cart uses, and it has at least `minStock` units (default 1).
- Nothing in the stock code calls this feature. A run **every five minutes** (`STOCK_ALERT_INTERVAL_MS`, and with every `POST /v1/jobs/run`) reads the pack sizes somebody waits for and tells the customers of those that are back. So it does not matter what brought the stock back: the admin panel, a spreadsheet import, the supplier's file, a cancelled order or a return.
- **One email per request.** The email is queued under a key of its own (`back_in_stock:<request>:<round>`) before the request is marked as told, so a run that stops half way, or two runs at the same moment, cannot send a second one. Customers are told in the order they asked.
- **Waves.** With `perUnit: 0` (the default) everybody who waits is told at once. With `perUnit` above 0 one run tells `max(1, stock × perUnit)` customers per pack size, the ones who asked first; the rest follow in later runs while the pack size is still back. Example, confirmed by `stock-alert-rules.spec.ts`: 3 units in stock and `perUnit: 5` tell 15 customers in this run.
- One run queues at most 2000 emails (`MAX_EMAILS_PER_RUN`); what is left follows in the next.
- After the email the request is closed (`notified`). **Asking again later is a new round** of the same record and gets a new email when the pack size is back again.
- With `automatic: false` nothing goes out by itself; the admin tells the customers of a pack size by hand.
- A request that waited longer than `expireAfterDays` (default 180; 0: never) is closed as `expired`. The requests of a pack size that left the catalogue are closed by the run.
- While `enabled` is `false` nobody can ask and nothing is sent; the requests that wait are kept and go on when it is switched on again.

**The emails**

| Type | To | Says | Subject (English / German) |
| --- | --- | --- | --- |
| `back_in_stock_confirm` | A visitor's address | Please confirm the address; without the confirmation no further message comes. No unsubscribe link: nothing is subscribed yet | "Please confirm your notification" / "Bitte bestätigen Sie Ihre Benachrichtigung" |
| `back_in_stock` | Everybody who waits | The pack size with its brand and price, a button to its page, and that the email reserves nothing | "Back in stock: Basmati Rice (1 kg)" / "Wieder da: Basmati Reis (1 kg)" |

Both are in the language of the request. `back_in_stock` carries the unsubscribe link at its foot and as the `List-Unsubscribe` header. They are sent, retried and listed like every message ([notifications](notifications.md#3-the-queue)): six attempts, then `failed` with the reason, and the admin can retry.

**Taking a request back, and consent**

- A signed-in customer takes a request back in the account. A visitor uses the unsubscribe link of an email; with `all` every request of the address that still waits is taken back. A visitor who confirmed can also change their mind before the email comes: the answer to the confirmation link carries the token that takes the request back.
- The links need no sign-in. A token is the id of the request and a signature of it with `LINK_HMAC_SECRET`; the confirming and the unsubscribing link have different signatures, so one can never do the work of the other.
- The request records what was agreed to and when: `consent { source, at, confirmedAt, ip, userAgent }`.
- This is not marketing consent: the one email is the service the customer asked for. It does not need `marketingOptIn` and does not set it.
- Closing an account deletes its requests, and those of its address.

**The settings** (`stock_alerts`, replaced as a whole)

| Field | Default | Means |
| --- | --- | --- |
| `enabled` | `false` | Whether customers can ask, and whether anything is sent |
| `automatic` | `true` | Whether the emails go out by themselves when a pack size is back |
| `guestConfirmation` | `true` | Whether a visitor confirms the address by a link first. Off: a visitor's request counts at once, and anybody can enter anybody's address |
| `minStock` | `1` | Units a pack size must have before anybody is told (1 to 10,000) |
| `perUnit` | `0` | Emails per unit in stock and run; 0: everybody at once (0 to 1000) |
| `expireAfterDays` | `180` | Days after which a waiting request lapses; 0: never (0 to 3650) |

## 2. Statuses

| Status | Means | Next |
| --- | --- | --- |
| `unconfirmed` | A visitor asked; the confirmation link was not used yet. Deletes itself after 7 days | `active` (the link, or the same address asks while signed in), `cancelled` |
| `active` | Waits for the pack size | `notified`, `cancelled`, `expired` |
| `notified` | The email is queued or sent; `notification` says how it went | `active` or `unconfirmed` when the address asks again |
| `cancelled` | Taken back by the customer or the admin, or closed by the system because the pack size left the catalogue (`closedBy`, `closeReason`) | the same when asked again |
| `expired` | Waited longer than `expireAfterDays` | the same when asked again |

## 3. API

**Retail website**

<!-- docs:routes /v1/store/stock-alerts /v1/store/me/stock-alerts -->

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| POST | `/v1/store/stock-alerts` | Public | Ask for an email when a pack size is back, without an account |
| POST | `/v1/store/stock-alerts/confirm` | Public | Confirm the address of a request, with the token of the email |
| POST | `/v1/store/stock-alerts/unsubscribe` | Public | Take a request back, with the token of the email |
| GET | `/v1/store/me/stock-alerts` | Customer | What the customer waits for, newest first |
| POST | `/v1/store/me/stock-alerts` | Customer | Ask for an email when a pack size is back |
| DELETE | `/v1/store/me/stock-alerts/{id}` | Customer | Take a request back |

<!-- docs:end -->

| Call | Body | Answer |
| --- | --- | --- |
| `POST /v1/store/stock-alerts` | `{ variantId, email, consent: true, locale? }` | `202 { variantId, productId, confirmationRequired }`. `confirmationRequired: true`: the address gets the confirmation email (none comes to an address that waits already). 10 calls per minute per IP |
| `POST /v1/store/stock-alerts/confirm` | `{ token }` (from the link `/stock-alerts/confirm?token=…`) | `200 { alert, unsubscribeToken }`. Using the link twice changes nothing. 20 per minute |
| `POST /v1/store/stock-alerts/unsubscribe` | `{ token, all? }` (from the link `/stock-alerts/unsubscribe?token=…`, or `unsubscribeToken`) | `200 { alert, cancelled, waiting }`: how many requests were taken back by this call, and how many of the address still wait. 20 per minute |
| `GET /v1/store/me/stock-alerts` | `?locale=` | `{ items: [ own request ] }`: what the customer waits for, newest first |
| `POST /v1/store/me/stock-alerts` | `{ variantId, locale? }` | `201 { alert, created: true }`, or `200 { alert, created: false }` when the customer waited for it already. 30 per minute |
| `DELETE /v1/store/me/stock-alerts/{id}` | | `200 { alert }`, `cancelled`. Another customer's request answers `404 STOCK_ALERT_NOT_FOUND` |

`locale` (`en`, `de`) is the language of the emails; without it the `Accept-Language` header, for a customer the language of the account. `GET /v1/store/settings` carries `stockAlerts { enabled }`: the shop offers "Notify me" only while it is `true`.

**A visitor's request** (`alert` of confirm and unsubscribe): `variantId`, `productId`, `status`, `email` (masked: `gi***@example.com`), `requestedAt`. Never the id of the request.

**An own request:** `id`, `variantId`, `productId`, `status`, `requestedAt`, `product` (the pack size as listings show it, with `ordering`; `null` when it left the shop).

**Admin panel**

<!-- docs:routes /v1/admin/stock-alerts -->

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/v1/admin/stock-alerts/settings` | Admin: `notifications.read` | The rules of the back-in-stock emails |
| PUT | `/v1/admin/stock-alerts/settings` | Admin: `notifications.manage` | Set the rules of the back-in-stock emails |
| GET | `/v1/admin/stock-alerts/summary` | Admin: `notifications.read` | How many requests and emails there are of each status |
| GET | `/v1/admin/stock-alerts/demand` | Admin: `notifications.read` | What customers wait for: the demand per pack size |
| GET | `/v1/admin/stock-alerts` | Admin: `notifications.read` | Requests, newest first unless sorted |
| GET | `/v1/admin/stock-alerts/count` | Admin: `notifications.read` | How many requests match the filters of the list |
| POST | `/v1/admin/stock-alerts/run` | Admin: `notifications.manage` | Look for pack sizes that are back and queue the emails now |
| POST | `/v1/admin/stock-alerts/variants/{variantId}/notify` | Admin: `notifications.manage` | Tell the customers who wait for a pack size now |
| GET | `/v1/admin/stock-alerts/{id}` | Admin: `notifications.read` | One request, with its email |
| POST | `/v1/admin/stock-alerts/{id}/cancel` | Admin: `notifications.manage` | Take a request back |

<!-- docs:end -->

| Call | Body / query | Answer |
| --- | --- | --- |
| `GET /v1/admin/stock-alerts/settings` | | `{ settings }` |
| `PUT /v1/admin/stock-alerts/settings` | the six fields, all of them | `{ settings }`; `400 VALIDATION_FAILED` |
| `GET /v1/admin/stock-alerts/summary` | | `{ enabled, automatic, waiting, alerts: { unconfirmed, active, notified, cancelled, expired }, emails: { queued, sending, sent, failed, skipped, cancelled }, confirmations: { … } }` |
| `GET /v1/admin/stock-alerts/demand` | `productId?`, `waitingOnly?` (default `true`), `page`, `limit` | `{ items, page, limit, total, totalPages }`: one row per pack size, the most wanted first |
| `GET /v1/admin/stock-alerts` | `status?`, `variantId?`, `productId?`, `customerId?`, `source?` (`account`, `guest`), `q?` (the beginning of the address or of the SKU), `limit`, `cursor`, `sort` (`createdAt`, `requestedAt`, `status`) | `{ items, nextCursor }` |
| `GET /v1/admin/stock-alerts/count` | the same filters | `{ total }` |
| `GET /v1/admin/stock-alerts/{id}` | | `{ alert }` |
| `POST /v1/admin/stock-alerts/{id}/cancel` | `{ reason? }` | `{ alert }`. Only a request that waits is changed |
| `POST /v1/admin/stock-alerts/run` | | `{ run: { checked, back, queued, expired, removed } }`: what the scheduled run does, at once |
| `POST /v1/admin/stock-alerts/variants/{variantId}/notify` | | `{ waiting, queued }`: tells the customers who wait for the pack size now. Works while `automatic` is off; `minStock` does not count, one unit that can be ordered is enough. A customer who was told is not told again |

**A request, for the admin:** `id`, `status`, `email`, `source`, `customerId`, `customer`, `locale`, `product { productId, variantId, sku, name, displayName, packSize, brand, inCatalogue }`, `requestedAt`, `requests` (how often this address asked for this pack size), `consent { at, confirmedAt, ip }`, `notifiedAt`, `trigger` (`automatic`, `manual`), `notifiedBy`, `notification { id, status, sentAt, attempts, lastError } | null`, `closedAt`, `closedBy` (`customer`, `admin`, `system`), `closedByAdmin`, `closeReason`, `expiresAt` (while unconfirmed), `createdAt`.

**A row of the demand:** the `product` fields, then `waiting`, `unconfirmed`, `notified`, `total`, `firstRequestedAt`, `lastRequestedAt`, `stock`, `productStatus`, `isAvailable`, `isEnabled`, `canOrder`, `isBack` (the emails would go out now).

**The emails themselves** are notifications: `GET /v1/admin/notifications?type=back_in_stock` lists them (also `productId=`), `POST /v1/admin/notifications/{id}/retry` sends a failed one again ([notifications](notifications.md#6-api)).

### Errors

| Code | Status | When |
| --- | --- | --- |
| `STOCK_ALERTS_DISABLED` | 409 | The shop does not offer the emails (`enabled: false`) |
| `STOCK_ALERT_NOT_NEEDED` | 409 | The pack size can be ordered now (`details.ordering`) |
| `PRODUCT_VARIANT_NOT_FOUND` | 404 | The pack size is not in the shop |
| `STOCK_ALERT_LIMIT_REACHED` | 409 | 50 waiting requests of the address (`details.maximum`), or 5 unconfirmed ones (`details.unconfirmed: true`) |
| `STOCK_ALERT_TOKEN_INVALID` | 404 | The link is not genuine, or its request was never confirmed and is gone |
| `STOCK_ALERT_NOT_FOUND` | 404 | No such request, or not the customer's own |
| `STOCK_ALERT_NOT_IN_STOCK` | 409 | The admin wants to tell customers about a pack size that cannot be ordered (`details.ordering`) |
| `CUSTOMER_BLOCKED` | 403 | A blocked account asks |
| `VALIDATION_FAILED` | 400 | No `consent: true`, no valid address, an unknown field |

## 4. Admin panel

A page "Back in stock" under Communication, for `notifications.read`; the actions need `notifications.manage`.

- **Summary** from `GET /v1/admin/stock-alerts/summary`: customers waiting, emails sent, emails failed (a link to the notifications list with `type=back_in_stock&status=failed`), and a notice while `enabled` is `false`.
- **Demand** (the first tab) from `GET …/demand`: product, pack size, SKU, brand, waiting, told, stock, and a badge from `canOrder` and `isBack`. A row opens the requests of the pack size (`GET /v1/admin/stock-alerts?variantId=`). "Notify now" on a row calls `POST …/variants/{variantId}/notify` and shows "`queued` of `waiting` customers are being told"; `409 STOCK_ALERT_NOT_IN_STOCK`: "This pack size cannot be ordered, so nobody is told about it."
- **Requests** (the second tab) from `GET /v1/admin/stock-alerts`: the status filter (`active` by default), `source`, the search, and per row the address, the customer (a link) or "Guest", the pack size, the date, the status, and how the email went (`notification.status`, `lastError`). "Cancel" for a request that waits, with an optional reason.
- **Rules** (`GET` / `PUT …/settings`): the six fields with the explanations of the table in section 1. A warning next to `guestConfirmation` when it is switched off.
- **"Check now"** calls `POST …/run` and shows the five numbers of `run`.
- On the page of a product, a line per pack size from `GET …/demand?productId=…&waitingOnly=false` is optional.

## 5. Retail website

- Read `stockAlerts.enabled` from `GET /v1/store/settings`. While it is `false`, show nothing of this feature.
- **On a product page and a product card**, for the chosen pack size with `ordering.canOrder: false`: a "Notify me" control in place of "Add to cart".
  - Signed in: one click, `POST /v1/store/me/stock-alerts`. `201` or `200`: "We will email you at `<address of the account>` when it is back." The control then reads "We will notify you" with "Cancel" (`DELETE /v1/store/me/stock-alerts/{id}`). Which pack sizes the customer waits for comes from `GET /v1/store/me/stock-alerts`.
  - Not signed in: a field for the email address and a required checkbox with the text of what is agreed to, then `POST /v1/store/stock-alerts`. `202` with `confirmationRequired: true`: "Please check your inbox and confirm your address." With `false`: "We will email you when it is back."
  - `409 STOCK_ALERT_NOT_NEEDED`: the pack size came back meanwhile: reload the product and show "Add to cart". `409 STOCK_ALERT_LIMIT_REACHED`: with `details.unconfirmed` "Please confirm the requests we already emailed you about first", otherwise "You are waiting for the maximum number of products". `409 STOCK_ALERTS_DISABLED` and `404`: hide the control. `429`: "Please try again in a moment."
- **Two pages the emails link to**, both without sign-in, not indexed and with `referrer: no-referrer` (the address carries a token): `/stock-alerts/confirm?token=…` calls `POST /v1/store/stock-alerts/confirm` once from the browser and shows "Confirmed" with a link to the product (`alert.productId`), keeping `unsubscribeToken` for a "Cancel this notification" link; `/stock-alerts/unsubscribe?token=…` shows a button that calls `POST …/unsubscribe` (nothing before the button is pressed: programs that check the links of an email open them), then "You will not be notified", and, while `waiting` is above 0, a second button for the other requests of the address (`all: true`). `404 STOCK_ALERT_TOKEN_INVALID`: "This link is no longer valid."
- **The account** gets a list "Notifications" from `GET /v1/store/me/stock-alerts`: the product card of each request with "Cancel"; empty: "You are not waiting for any product."
- Send `locale` with every call, so the email comes in the language of the page.

## 6. Data and connections

- `stockAlerts`: one record per address and pack size: `productId`, `variantId`, `sku`, `email`, `customerId`, `locale`, `status`, `consent`, `requestedAt`, `cycle` (the round), what was sent (`notifiedAt`, `trigger`, `notifiedBy`, `notificationId`) and how it was closed. Indexes in [database-indexes](../architecture/database-indexes.md).
- The emails are records of `notifications` with the types `back_in_stock` and `back_in_stock_confirm`, the product in `productId`, and the keys above as `dedupeKey`.
- The feature reads the catalogue and never writes to it; it reads no orders and changes no stock.
- Deploying: `npm run db:indexes` creates the indexes of the collection ([deployment](../architecture/deployment.md#5-commands-for-the-server)).

## 7. Code map

<!-- docs:files src/modules/stock-alerts -->

| File | Kind | What it holds |
| --- | --- | --- |
| `src/modules/stock-alerts/admin-stock-alerts.controller.ts` | Controller | "Tell me when it is back", for the admin. |
| `src/modules/stock-alerts/stock-alert-rules.spec.ts` | Unit tests | 17 tests |
| `src/modules/stock-alerts/stock-alert-rules.ts` | Rules and helpers | The rules of "tell me when it is back", without a database. |
| `src/modules/stock-alerts/stock-alert-view.service.ts` | Service | Turns requests into what the API answers. |
| `src/modules/stock-alerts/stock-alert.schema.ts` | Schema | A request to be told when a pack size can be ordered again. |
| `src/modules/stock-alerts/stock-alerts-jobs.service.ts` | Service | Looks for pack sizes that are back and queues the emails. |
| `src/modules/stock-alerts/stock-alerts.module.ts` | Module | "Tell me when it is back". |
| `src/modules/stock-alerts/stock-alerts.service.ts` | Service | "Tell me when it is back". |
| `src/modules/stock-alerts/store-stock-alerts.controller.ts` | Controller | "Tell me when it is back", for visitors. |
| `src/modules/stock-alerts/dto/stock-alert.dto.ts` | Requests | Request bodies and query parameters of the back-in-stock routes, with their validation. |

<!-- docs:end -->
