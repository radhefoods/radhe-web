# Radhe Foods – Customer Web API Documentation

For the customer-facing Next.js shop. Generated from the implemented NestJS backend (`radhe-api`) on 2026-09-30; every route, field, status and error below exists in the code as of this date. Admin-only APIs are documented separately in `ADMIN_API_DOCUMENTATION.md`.

**What the shop is:** a pre-order shop for Indian groceries in Germany. Customers browse without an account, sign in to order, confirm a pre-order for the cargo that currently takes orders, and **pay after delivery** (online by card/PayPal through Stripe Checkout, or in cash to the driver). Nothing is charged at checkout.

## Contents

0. Conventions (base URL, versioning, responses, errors, auth, cookies, pagination, formats)
1. Customer authentication
2. Customer account: profile, communication preferences
3. Delivery addresses
4. Unsubscribe link (public)
5. Health
6. Shop settings and legal texts
7. Catalogue and cargo status
8. Cart
9. Orders (pre-orders)
10. Payments
11. Invoices and credit notes
12. Returns
13. Status reference
14. Prepared but not yet active
15. Integration checklist

---

## 0. Conventions

### 0.1 Base URL and versioning

- All shop routes are under `/v1/store/...`. Public link routes are `/v1/pay/{token}` and `/v1/unsubscribe/{token}`. Health is `/health` (no version).
- Local development: `http://localhost:3000`. Production: the API domain (for example `https://api.radhefoods.de`). Interactive OpenAPI documentation: `<API>/docs` (dev only), JSON at `<API>/docs/openapi.json`.
- Versioning is in the URI (`/v1`). There is no version header.

### 0.2 Requests

- JSON bodies with `Content-Type: application/json`.
- Validation is strict: **unknown fields are rejected** (`400 VALIDATION_FAILED`, "property X should not exist"). Send only documented fields.
- Strings are trimmed; an empty optional string counts as "not provided".
- Optional header `X-Request-Id` (8–64 chars `[A-Za-z0-9_-]`): echoed back; otherwise the API generates one. Every response carries `x-request-id` — log it with client-side errors.

### 0.3 Responses

There is no envelope. Each endpoint returns the object documented for it, usually keyed by what it is (`{ customer }`, `{ order }`, `{ items, nextCursor }`). Empty answers use `204 No Content`.

### 0.4 Error format

Every error, from any endpoint:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request contains invalid data.",
    "details": [
      { "field": "items.0.quantity", "problems": ["quantity must not be less than 1"] }
    ]
  },
  "requestId": "3f0c1a2e-8b1d-4c2e-9f3a-1b2c3d4e5f60"
}
```

- `code` is stable and meant for the frontend (translate it); `message` is English, for developers and as a fallback.
- `details` is present only for some codes; its shape is documented per endpoint. For `VALIDATION_FAILED` it is always `[{ field, problems[] }]` with dotted paths (`consent.versions.terms`, `items.0.quantity`).
- Generic codes: `VALIDATION_FAILED` (400), `BAD_REQUEST` (400), `AUTH_TOKEN_INVALID` (401), `FORBIDDEN` (403), `ORIGIN_NOT_ALLOWED` (403), `NOT_FOUND` (404, also for unknown routes), `CONFLICT` (409), `RATE_LIMITED` (429), `SERVICE_UNAVAILABLE` (503), `INTERNAL_ERROR` (500).

### 0.5 Authentication and cookies (read this before anything else)

Authentication is **cookie based**. The API sets two `httpOnly` cookies after a successful sign-in; the browser sends them automatically. Tokens are **never** returned in a response body.

| Cookie | Purpose | Path | Lifetime |
| ------ | ------- | ---- | -------- |
| `rf_customer_access` | Access token (JWT). Sent with every request. | `/` | 15 minutes (`accessTokenExpiresInSeconds` in the sign-in answer) |
| `rf_customer_refresh` | Refresh token. Sent **only** to `/v1/store/auth/*`. | `/v1/store/auth` | 30 days, extended on every refresh, at most 180 days in total |

Cookie attributes: `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Domain` = the configured cookie domain (for example `.radhefoods.de`, so that `radhefoods.de` and `api.radhefoods.de` share them).

**What the Next.js app must do**

1. Call the API with credentials: `fetch(url, { credentials: 'include' })` (or `withCredentials: true` in axios). Without it no cookie is sent or stored.
2. Host the shop on an origin listed in the API's `CORS_ORIGINS` (dev: `http://localhost:3001`). The API answers CORS with `Access-Control-Allow-Credentials: true`, methods `GET, POST, PATCH, PUT, DELETE, OPTIONS`, headers `Content-Type, Authorization, X-Request-Id`.
3. Every non-GET request from the browser carries an `Origin` header; if it is not one of the allowed origins the API answers `403 ORIGIN_NOT_ALLOWED` (CSRF protection). Server-side calls (Next.js route handlers / server components, no `Origin` header) pass.
4. Handle `401 AUTH_TOKEN_INVALID` on any protected call by calling `POST /v1/store/auth/refresh` **once** and retrying; if the refresh answers `401 AUTH_REFRESH_INVALID`, the session is over: clear local state and show sign-in. (The refresh cookie only travels to `/v1/store/auth/*`, so the refresh call must use that exact path.)
5. The access token is verified without a database read, so it stays valid until it expires (≤15 min) even after `logout-all` or after the account was blocked; the next refresh then fails.
6. Server-side rendering: forward the incoming `Cookie` header to the API (`headers: { cookie: request.headers.get('cookie') }`). The guards also accept `Authorization: Bearer <access token>`, but since the token only exists inside the httpOnly cookie, forwarding the cookie is the practical way.
7. Cookies are `SameSite=Lax`: top-level navigations from other sites (e.g. the return from Stripe) still carry them.

**Rate limits:** 120 requests per minute per IP on everything (`429 RATE_LIMITED`), and lower limits on the auth endpoints (see section 1). Back off on 429.

### 0.6 Locale

Every store endpoint answers in **one** language. Pass `?locale=en` / `?locale=de` (or, for the auth and return-request bodies, the `locale` body field); otherwise the `Accept-Language` header decides (first supported language by weight), default `en`. A translated field that is missing in the requested language falls back to English. Error messages are not localized: translate `code`.

### 0.7 Data formats

| Kind | Representation |
| ---- | -------------- |
| IDs | MongoDB ObjectId as a 24-character hex string (`"66f1a2b3c4d5e6f7a8b9c0d1"`). Path parameters that take an id answer `400 VALIDATION_FAILED` ("The id in the URL is not valid.") for anything else. |
| Human numbers | Orders `RF-1084`, returns `RF-1084-R1`, invoices `INV-2026-000123`, credit notes `CN-2026-000007`, cargos `RF-C027`. Case-insensitive in URLs. |
| Money | Integer **cents** in EUR, VAT included (`1999` = €19.99). `currency` is always `"EUR"`. Never floats. |
| VAT rates | Hundredths of a percent: `700` = 7 %, `1900` = 19 %. Views also give `vatPercent` (`7`). |
| Date-times | ISO 8601 strings in UTC (`"2026-09-28T10:15:00.000Z"`). |
| Calendar days | `"YYYY-MM-DD"` (delivery windows, `deliveredOn`), meant in the business time zone `Europe/Berlin`. |
| Booleans/nulls | Optional values are `null` when not set, except where a section says a key is absent. |
| Images | Absolute `https` URLs (WebP), see section 7.1. Never construct image URLs yourself. |

### 0.8 Pagination

Two styles exist:

- **Page/limit** (catalogue): `?page=1&limit=24` → `{ items, page, limit, total, totalPages }`. `page` 1–500, `limit` 1–100.
- **Cursor** (orders, invoices): `?limit=25&cursor=<nextCursor>` → `{ items, nextCursor }`; newest first; `nextCursor` is `null` on the last page. `limit` 1–100, default 25.

### 0.9 Statuses

`POST` answers `201` when something was created and `200` otherwise (documented per endpoint). `DELETE` answers `200` with the updated list or `204` (documented).

---

## 1. Customer authentication

Sign-in is passwordless: a 6-digit code by email, or Google sign-in. There is no separate sign-up: the first successful sign-in creates the account. Guests can browse and price a cart; they must sign in to place an order.

### `POST /v1/store/auth/otp/request`

**Purpose:** Email a 6-digit login code.

**Authentication:** none. Rate limit 10 per minute per IP; per email: one code per 60 s, 5 per hour.

**Request Body:**

```json
{ "email": "customer@example.com", "locale": "de" }
```

| Field | Type | Required | Validation |
| ----- | ---- | -------- | ---------- |
| `email` | string | yes | valid email, ≤254 chars; normalized to lower case |
| `locale` | `en` \| `de` | no | Language of the email. Defaults to `Accept-Language`. |

**Success Response (200):**

```json
{ "expiresInSeconds": 600, "resendAfterSeconds": 60 }
```

Requesting a new code invalidates the previous one.

**Possible Errors:**

- `429 OTP_COOLDOWN` – `details: { retryAfterSeconds }` (a code was sent less than 60 s ago).
- `429 OTP_LIMIT_REACHED` – `details: { retryAfterSeconds }` (5 codes in the last hour).
- `503 MAIL_DELIVERY_FAILED` – the email could not be sent; ask to try again.
- `400 VALIDATION_FAILED`, `429 RATE_LIMITED`.

### `POST /v1/store/auth/otp/verify`

**Purpose:** Sign in with the code. Creates the account on first sign-in.

**Authentication:** none. Rate limit 20 per minute.

**Request Body:**

```json
{ "email": "customer@example.com", "code": "123456", "locale": "de" }
```

| Field | Type | Required | Validation |
| ----- | ---- | -------- | ---------- |
| `email` | string | yes | |
| `code` | string | yes | exactly 6 digits |
| `locale` | `en` \| `de` | no | Language of a **new** account. Defaults to the language of the code request. |

**Success Response (200)** + both cookies set:

```json
{
  "customer": {
    "id": "66f1a2b3c4d5e6f7a8b9c0d1",
    "email": "customer@example.com",
    "firstName": null,
    "lastName": null,
    "phone": null,
    "locale": "de",
    "hasGoogleLogin": false,
    "communication": {
      "whatsappNumber": null,
      "whatsappOptIn": false,
      "whatsappOptInAt": null,
      "marketingOptIn": false,
      "marketingOptInAt": null,
      "marketingOptOutAt": null
    },
    "createdAt": "2026-09-01T10:00:00.000Z"
  },
  "accessTokenExpiresInSeconds": 900
}
```

**Possible Errors:**

- `401 OTP_INVALID` – wrong, expired, or no open code. With `details: { attemptsRemaining }` after a wrong code (5 attempts per code); without details when no code is open.
- `403 CUSTOMER_BLOCKED` – the account is blocked by Radhe Foods.
- `400 VALIDATION_FAILED`, `429 RATE_LIMITED`.

### `POST /v1/store/auth/google`

**Purpose:** Sign in with Google (Google Identity Services). Links the Google account to the customer with the same verified email, or creates the account.

**Authentication:** none. Rate limit 20 per minute.

**Request Body:**

```json
{ "idToken": "<credential from Google Identity Services>", "locale": "en" }
```

| Field | Type | Required | Validation |
| ----- | ---- | -------- | ---------- |
| `idToken` | string | yes | ≤4096 chars; the `credential` Google returns |
| `locale` | `en` \| `de` | no | Language of a new account. Defaults to `Accept-Language`. |

**Success Response (200):** same as `otp/verify` (`hasGoogleLogin: true`; first/last name copied from Google when the profile had none).

**Possible Errors:**

- `503 GOOGLE_NOT_CONFIGURED` – Google sign-in is not set up on the server; hide the button when you get this.
- `401 GOOGLE_TOKEN_INVALID`, `401 GOOGLE_EMAIL_NOT_VERIFIED`.
- `403 CUSTOMER_BLOCKED`, `400 VALIDATION_FAILED`, `429 RATE_LIMITED`.

### `POST /v1/store/auth/refresh`

**Purpose:** Get a new access cookie (and a rotated refresh cookie) with the refresh cookie. Call it when a request answered `401 AUTH_TOKEN_INVALID`, or proactively before the 15 minutes are over.

**Authentication:** the `rf_customer_refresh` cookie (sent automatically to this path). No body. Rate limit 30 per minute.

**Success Response (200):** same as `otp/verify` (current profile + `accessTokenExpiresInSeconds`), cookies replaced.

**Possible Errors (both clear the cookies):**

- `401 AUTH_REFRESH_INVALID` – cookie missing, expired, already used, or revoked (also when a stolen token was reused: the whole session is revoked). Show sign-in.
- `403 CUSTOMER_BLOCKED`.

Refresh tokens rotate on every call. Two parallel refreshes within 10 seconds are tolerated (tabs racing); later reuse of an old token revokes the session.

### `POST /v1/store/auth/logout`

**Purpose:** Sign out on this device. Revokes the session of the refresh cookie (if any) and clears both cookies.

**Authentication:** none required. **Success Response:** `204`.

### `POST /v1/store/auth/logout-all`

**Purpose:** Sign out on every device (all sessions revoked), cookies cleared.

**Authentication:** customer session. **Success Response:** `204`.

### 1.7 Sign-in flow for the shop

1. Ask for the email → `otp/request` → show "code sent", a resend button after `resendAfterSeconds`.
2. Ask for the code → `otp/verify` → store `customer` in app state. If a guest cart exists, call `POST /v1/store/cart/merge` (section 8).
3. On page load, `GET /v1/store/me` tells whether a session exists (`401` = signed out).

---

## 2. Customer account

### `GET /v1/store/me`

**Purpose:** The signed-in customer (profile + communication preferences).

**Authentication:** customer session.

**Success Response (200):** `{ "customer": { …profile as in 1 … } }`

**Possible Errors:** `401 AUTH_TOKEN_INVALID`, `404 CUSTOMER_NOT_FOUND`.

### `PATCH /v1/store/me`

**Purpose:** Change name, phone or language. Send only what changes.

**Authentication:** customer session.

**Request Body:**

```json
{ "firstName": "Anna", "lastName": "Schmidt", "phone": "+4915112345678", "locale": "de" }
```

| Field | Type | Required | Validation |
| ----- | ---- | -------- | ---------- |
| `firstName`, `lastName` | string | no | 1–80 chars |
| `phone` | string | no | international format `^\+[1-9]\d{6,14}$` |
| `locale` | `en` \| `de` | no | Language of emails and of new orders by default |

**Success Response (200):** `{ "customer": { …profile… } }`

### `PATCH /v1/store/me/communication`

**Purpose:** How the customer wants to hear from Radhe Foods. Emails about the customer's own orders always come and need no consent. WhatsApp messages need a number and a yes; news about products and cargos (marketing) needs a yes of its own and can be withdrawn any time.

**Authentication:** customer session.

**Request Body:**

```json
{ "whatsappNumber": "+4915112345678", "whatsappOptIn": true, "marketingOptIn": true }
```

| Field | Type | Required | Validation / meaning |
| ----- | ---- | -------- | -------------------- |
| `whatsappNumber` | string or `null` | no | international format; `null` removes it. When absent, the profile `phone` is used for WhatsApp. |
| `whatsappOptIn` | boolean | no | Messages about own orders by WhatsApp (dispatch, invoice, reminders). |
| `marketingOptIn` | boolean | no | News about products and cargos, by email (and WhatsApp when `whatsappOptIn`). |

**Success Response (200):**

```json
{
  "communication": {
    "whatsappNumber": "+4915112345678",
    "whatsappOptIn": true,
    "whatsappOptInAt": "2026-09-30T12:00:00.000Z",
    "marketingOptIn": true,
    "marketingOptInAt": "2026-09-30T12:00:00.000Z",
    "marketingOptOutAt": null
  }
}
```

Show the wording of the two consents clearly (they are dated for the record). WhatsApp sending itself is prepared on the server but only active once configured (section 14); the preference can be stored in any case.

---

## 3. Delivery addresses

Up to 10 addresses per customer, Germany only. One is the default and is proposed at checkout. Orders keep a copy of the address they were placed with.

**Address object:**

```json
{
  "id": "66f1a2b3c4d5e6f7a8b9c0e2",
  "firstName": "Max",
  "lastName": "Müller",
  "company": null,
  "street": "Hauptstraße",
  "houseNumber": "12a",
  "additionalLine": null,
  "postalCode": "60311",
  "city": "Frankfurt am Main",
  "countryCode": "DE",
  "phone": null,
  "isDefault": true
}
```

Every address endpoint answers with the full list: `{ "items": [ …addresses… ] }`.

### `GET /v1/store/me/addresses`

**Authentication:** customer session. **Success Response (200):** `{ "items": [...] }`

### `POST /v1/store/me/addresses`

**Purpose:** Add an address. The first address becomes the default.

**Authentication:** customer session.

**Request Body:**

```json
{
  "firstName": "Max", "lastName": "Müller", "company": null,
  "street": "Hauptstraße", "houseNumber": "12a", "additionalLine": "c/o Schmidt",
  "postalCode": "60311", "city": "Frankfurt am Main", "countryCode": "DE",
  "phone": "+4915112345678", "isDefault": true
}
```

| Field | Type | Required | Validation |
| ----- | ---- | -------- | ---------- |
| `firstName`, `lastName` | string | yes | 1–80 |
| `company` | string or `null` | no | ≤120 |
| `street` | string | yes | 1–120 |
| `houseNumber` | string | yes | 1–20 |
| `additionalLine` | string or `null` | no | ≤120 (floor, flat, c/o) |
| `postalCode` | string | yes | exactly 5 digits |
| `city` | string | yes | 1–80 |
| `countryCode` | `DE` | no | only `DE` |
| `phone` | string or `null` | no | international format |
| `isDefault` | boolean | no | propose at checkout |

**Success Response (201):** `{ "items": [...] }`

**Possible Errors:** `400 ADDRESS_LIMIT_REACHED` (`details: { maximum: 10 }`), `400 VALIDATION_FAILED`.

### `PATCH /v1/store/me/addresses/{id}`

**Purpose:** Change an address; send only what changes. `null` clears `company`, `additionalLine`, `phone`. `isDefault: true` makes it the default.

**Authentication:** customer session. **Success Response (200):** `{ "items": [...] }`. **Possible Errors:** `404 ADDRESS_NOT_FOUND`.

### `POST /v1/store/me/addresses/{id}/default`

**Purpose:** Make this the default address. **Success Response (200):** `{ "items": [...] }`. **Possible Errors:** `404 ADDRESS_NOT_FOUND`.

### `DELETE /v1/store/me/addresses/{id}`

**Purpose:** Delete an address (the first remaining one becomes default if needed). **Success Response (200):** `{ "items": [...] }`. **Possible Errors:** `404 ADDRESS_NOT_FOUND`.

---

## 4. Unsubscribe link (public page)

Marketing emails carry a link `<SHOP_URL>/unsubscribe/<token>`. The shop needs a page at that route that calls the endpoint below and confirms "You will get no more news from us." No sign-in.

### `POST /v1/unsubscribe/{token}`

**Purpose:** Switch off news about products and cargos for the customer the token stands for. Emails about the customer's own orders keep coming.

**Authentication:** none (the signed token is the key). Rate limit 10 per minute.

**Parameters:** `token` (path) – opaque string from the email link; pass it through unchanged.

**Success Response (200):**

```json
{ "email": "anna@example.com", "marketingOptIn": false }
```

**Possible Errors:** `404 CUSTOMER_NOT_FOUND` – "This link is not valid." (tampered or unknown token).

---

## 5. Health

`GET /health/live` → `200 { "status": "ok" }` (process up). `GET /health` → `200 { "status": "ok", "database": "up", "uptimeSeconds": 1234 }` or `503 SERVICE_UNAVAILABLE` when the database is unreachable. No version prefix, not rate limited.

---

## 6. Shop settings and legal texts

Public. Used by the layout (currency, time zone, delivery fee steps) and by checkout (the legal texts the customer accepts).

### `GET /v1/store/settings`

**Purpose:** What the shop needs to render prices, countdowns and the delivery-fee hint.

**Authentication:** none.

**Success Response (200):**

```json
{
  "currency": "EUR",
  "timezone": "Europe/Berlin",
  "deliveryFee": {
    "tiers": [
      { "minOrderValue": 0, "fee": 499 },
      { "minOrderValue": 5000, "fee": 0 }
    ],
    "freeFrom": 5000
  },
  "returns": { "windowDays": 14 }
}
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `currency` | string | Always `EUR`. |
| `timezone` | string | The business time zone (`Europe/Berlin`): order deadlines and delivery days are meant in it. |
| `deliveryFee.tiers[]` | `{ minOrderValue: int cents, fee: int cents }` | The highest tier whose `minOrderValue` the value of the goods reaches applies. One tier always starts at 0. Sorted ascending. |
| `deliveryFee.freeFrom` | int cents or `null` | Lowest goods value from which delivery is free, or `null` when no tier is free. |
| `returns.windowDays` | int | Days after delivery in which a return can be requested; `0` = returns switched off. |

The cancellation rule (until when a customer may cancel) is not part of this answer: use `canCancel` of each order (section 9).

### `GET /v1/store/legal`

**Purpose:** The versions of the legal texts that apply now. Checkout shows links to them and sends their versions back in `consent.versions` when placing an order.

**Authentication:** none.

**Parameters:**

| Field | Location | Type | Required | Description |
| ----- | -------- | ---- | -------- | ----------- |
| `locale` | query | `en` \| `de` | no | Language of `title`. Defaults to `Accept-Language`, then `en`. |

**Success Response (200):**

```json
{
  "items": [
    { "type": "terms", "version": 3, "title": "Terms and Conditions", "publishedAt": "2026-09-01T08:00:00.000Z" },
    { "type": "privacy", "version": 2, "title": "Privacy Policy", "publishedAt": "2026-09-01T08:00:00.000Z" }
  ]
}
```

Only published types appear. `terms` and `privacy` must be published before any order can be placed; `preorder_terms` is optional and, when published, is also part of `consent.versions`.

### `GET /v1/store/legal/{type}`

**Purpose:** One legal text with its content (plain text or Markdown, as the admin entered it).

**Authentication:** none.

**Parameters:**

| Field | Location | Type | Required | Description |
| ----- | -------- | ---- | -------- | ----------- |
| `type` | path | `terms` \| `preorder_terms` \| `privacy` | yes | |
| `locale` | query | `en` \| `de` | no | |

**Success Response (200):**

```json
{
  "document": {
    "type": "terms",
    "version": 3,
    "title": "Terms and Conditions",
    "content": "…markdown or plain text…",
    "publishedAt": "2026-09-01T08:00:00.000Z"
  }
}
```

**Possible Errors:**

- `404 LEGAL_DOCUMENT_NOT_FOUND` – no published version of this type ("This legal text is not published yet.").
- `400 BAD_REQUEST` – unknown `type` (message `Validation failed (enum string is expected)`).

---

## 7. Catalogue and cargo status

Public. Products, categories and the answer "can the customer order right now?".

### 7.1 Shared objects

**PriceView** (in every product answer as `pricing`):

```json
{
  "currency": "EUR",
  "price": 1999,
  "regularPrice": 2499,
  "salePrice": 1999,
  "onSale": true,
  "discountPercent": 20,
  "discountAmount": 500,
  "vatIncluded": true,
  "vatRate": 700,
  "vatPercent": 7,
  "vatAmount": 131,
  "basePrice": { "amount": 400, "per": "kg" }
}
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `price` | int cents | The price to show and to charge (sale price when on sale). VAT included. |
| `regularPrice` | int cents | The crossed-out price when `onSale`. |
| `salePrice` | int cents or `null` | |
| `discountPercent` | int | `floor((regular − sale) × 100 / regular)`; `0` when not on sale. |
| `vatRate` | int | Hundredths of a percent: `700` = 7 %, `1900` = 19 %. |
| `basePrice` | `{ amount: int cents, per: "kg" \| "l" \| "pcs" }` | Price per kilogram / litre / piece (German price-indication rule). |

**PackSize:** `{ "value": 5, "unit": "kg", "label": "5 kg" }`. `unit` ∈ `g`, `kg`, `ml`, `l`, `pcs`. `label` is localized (`"0,5 kg"`, `"Stk."` in German).

**Image:**

```json
{
  "id": "66f2a0c1e4b0f1a2b3c4d5e6",
  "alt": "Basmati Rice",
  "isPrimary": true,
  "url": "https://cdn.radhefoods.de/catalog/products/66f1…/a1b2…/large.webp",
  "sizes": {
    "small":  { "url": "https://…/small.webp",  "width": 320,  "height": 240 },
    "medium": { "url": "https://…/medium.webp", "width": 800,  "height": 600 },
    "large":  { "url": "https://…/large.webp",  "width": 1600, "height": 1200 }
  }
}
```

All image URLs are absolute, WebP, immutable (cache them for a year). `url` is the largest variant. `small` is 320 px on the longest side, `medium` 800 px, `large` 1600 px (never enlarged: a 600 px source gives `medium`/`large` of 600 px). `alt` is localized and falls back to the product name.

**Ordering block** (`ordering` on products and pack sizes; the same object is `line.ordering` in the cart):

```json
{ "canOrder": true, "reason": null, "minQuantity": 1, "maxQuantity": 10, "remaining": 37 }
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `canOrder` | boolean | Whether the customer can put this product in a pre-order at this moment. |
| `reason` | `null` \| `ordering_closed` \| `product_unavailable` \| `not_in_this_cargo` \| `sold_out` | Why not. `ordering_closed`: no cargo is taking orders. `not_in_this_cargo`: the product is not offered in the current cargo. `sold_out`: the cargo's limit for this product is reached. |
| `minQuantity` | int | Least units per order line. |
| `maxQuantity` | int or `null` | Most units per order line (product limit and remaining cargo units combined); `null` = no limit. |
| `remaining` | int or `null` | Units still available in the current cargo; `null` when the cargo sets no limit. |

### `GET /v1/store/cargo`

**Purpose:** Whether ordering is open, the deadline countdown and the delivery days; and when the next cargo opens. Show this in the header and on the checkout page.

**Authentication:** none.

**Parameters:**

| Field | Location | Type | Required | Description |
| ----- | -------- | ---- | -------- | ----------- |
| `locale` | query | `en` \| `de` | no | Language of `name` and `message`. |

**Success Response (200):**

```json
{
  "acceptingOrders": true,
  "current": {
    "id": "66f0a1b2c3d4e5f6a7b8c9d0",
    "code": "RF-C027",
    "name": "October delivery",
    "message": "Order by Friday night.",
    "orderOpenAt": "2026-09-24T22:00:00.000Z",
    "orderCloseAt": "2026-09-26T21:59:00.000Z",
    "opensInSeconds": 0,
    "closesInSeconds": 172740,
    "delivery": { "start": "2026-10-05", "end": "2026-10-07" }
  },
  "next": null,
  "serverTime": "2026-09-24T22:01:00.000Z",
  "timezone": "Europe/Berlin"
}
```

- `current` is the cargo taking orders (status `taking_orders` and deadline not yet passed), or `null`. `next` is the scheduled cargo that opens first, same shape, or `null`.
- `name` and `message` may be `null`.
- `opensInSeconds` / `closesInSeconds` are computed on the server; use them (or `serverTime`) for countdowns instead of the browser clock. `delivery.start`/`end` are calendar days (`YYYY-MM-DD`) in `timezone`.

### `GET /v1/store/categories`

**Purpose:** All visible categories as a tree, for navigation.

**Authentication:** none.

**Parameters:** `locale` (query, optional).

**Success Response (200):**

```json
{
  "items": [
    {
      "id": "66f0…",
      "slug": "rice",
      "slugs": { "en": "rice", "de": "reis" },
      "name": "Rice",
      "tagline": "Long grain and more",
      "description": null,
      "parentId": null,
      "level": 1,
      "image": { "…Image…": "" },
      "productCount": 12,
      "seo": { "title": "Rice", "description": "Long grain and more" },
      "children": [
        { "id": "66f1…", "slug": "basmati", "slugs": { "en": "basmati", "de": "basmati" }, "name": "Basmati", "tagline": null, "description": null, "parentId": "66f0…", "level": 2, "image": null, "productCount": 4, "seo": { "title": "Basmati", "description": null }, "children": [] }
      ]
    }
  ]
}
```

`level` is 1–3. `productCount` counts active products of the category and its sub-categories. `image` can be `null`. Hidden categories (and everything below them) are not returned.

### `GET /v1/store/categories/{slug}`

**Purpose:** One category page: the category, its breadcrumbs and its sub-categories. Products come from `GET /v1/store/products?category=<slug>`.

**Authentication:** none.

**Parameters:**

| Field | Location | Type | Required | Description |
| ----- | -------- | ---- | -------- | ----------- |
| `slug` | path | string | yes | Slug in either language (`rice` or `reis` both work). Lower-case letters, digits and single hyphens, max 120 characters. |
| `locale` | query | `en` \| `de` | no | |

**Success Response (200):**

```json
{
  "category": {
    "id": "66f1…", "slug": "basmati", "slugs": { "en": "basmati", "de": "basmati" }, "name": "Basmati",
    "tagline": null, "description": null, "parentId": "66f0…", "level": 2, "image": null, "productCount": 4,
    "seo": { "title": "Basmati", "description": null },
    "breadcrumbs": [
      { "id": "66f0…", "slug": "rice", "name": "Rice" },
      { "id": "66f1…", "slug": "basmati", "name": "Basmati" }
    ],
    "children": []
  }
}
```

**Possible Errors:**

- `404 CATEGORY_NOT_FOUND` – unknown or hidden category.
- `404 NOT_FOUND` – malformed slug.

### `GET /v1/store/products`

**Purpose:** Product listing with filters, search, sorting and pages.

**Authentication:** none.

**Parameters (all query, all optional):**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `locale` | `en` \| `de` | |
| `category` | string (slug) | Products of the category and its sub-categories. |
| `q` | string, 2–80 chars | Search. Every word must begin a word of the product name, subtitle, SKU, brand, tags or search keywords (umlauts are folded: `musli` finds `Müsli`). |
| `tag` | string | Exact tag. |
| `brand` | string, ≤80 | Exact brand. |
| `onSale` | boolean | Only reduced products (`false`: only not reduced). |
| `available` | boolean | Only products marked available by the admin. |
| `orderable` | boolean | Only products that can be ordered **now** (a cargo takes orders, the product is in it, units are left). Empty when ordering is closed. |
| `featured` | boolean | |
| `minPrice`, `maxPrice` | int cents, ≥0 | On the effective price. |
| `sort` | `recommended` (default) \| `newest` \| `price_asc` \| `price_desc` \| `discount` \| `name` | |
| `groupPackSizes` | boolean, default `true` | `true`: a product with several pack sizes appears once (its default size) with all sizes in `packSizes`. `false`: every pack size is its own entry. |
| `page` | int 1–500, default 1 | |
| `limit` | int 1–100, default 24 | |

**Success Response (200):**

```json
{
  "items": [
    {
      "id": "66f3…",
      "sku": "RF-00042",
      "slug": "basmati-rice-5-kg",
      "name": "Basmati Rice",
      "subtitle": null,
      "shortDescription": "Aged long-grain rice",
      "brand": "India Gate",
      "category": { "id": "66f0…", "slug": "rice", "name": "Rice" },
      "packSize": { "value": 5, "unit": "kg", "label": "5 kg" },
      "pricing": { "…PriceView…": "" },
      "isAvailable": true,
      "isFeatured": false,
      "quantity": { "min": 1, "max": null },
      "ordering": { "canOrder": true, "reason": null, "minQuantity": 1, "maxQuantity": 37, "remaining": 37 },
      "storageType": "ambient",
      "tags": ["new"],
      "image": { "…Image…": "" },
      "packSizes": [
        {
          "id": "66f2…", "sku": "RF-00041", "slug": "basmati-rice-1-kg",
          "packSize": { "value": 1, "unit": "kg", "label": "1 kg" },
          "pricing": { "…PriceView…": "" },
          "isAvailable": true, "quantity": { "min": 1, "max": null },
          "ordering": { "…": "" }, "image": null, "isDefault": false, "isSelected": false
        },
        { "id": "66f3…", "sku": "RF-00042", "slug": "basmati-rice-5-kg", "…": "this product", "isDefault": true, "isSelected": true }
      ]
    }
  ],
  "page": 1,
  "limit": 24,
  "total": 57,
  "totalPages": 3
}
```

- `packSizes` always contains the product itself (`isSelected: true`) and its active sibling pack sizes, smallest first. Use it for the pack-size chooser; each entry has its own `slug` for the product page.
- `storageType` ∈ `ambient`, `chilled`, `frozen`. `category` and `image` can be `null`.
- Drafts, archived products and products in hidden categories are never returned.

**Possible Errors:**

- `404 CATEGORY_NOT_FOUND` – `category` slug unknown or hidden.
- `400 VALIDATION_FAILED` – e.g. `q` shorter than 2 characters, unknown query parameter.

### `GET /v1/store/products/{slug}`

**Purpose:** The product page.

**Authentication:** none.

**Parameters:** `slug` (path, either language), `locale` (query, optional).

**Success Response (200):** everything of the list entry plus:

```json
{
  "product": {
    "…all list-entry fields…": "",
    "slugs": { "en": "basmati-rice-5-kg", "de": "basmati-reis-5-kg" },
    "gtin": "8901234567890",
    "description": "…",
    "highlights": ["Aged 2 years"],
    "uses": ["Biryani"],
    "images": [ { "…Image…": "", "isPrimary": true }, { "…Image…": "", "isPrimary": false } ],
    "breadcrumbs": [ { "id": "66f0…", "slug": "rice", "name": "Rice" } ],
    "food": {
      "ingredients": "Basmati rice",
      "allergens": null,
      "nutrition": "Energy 1500 kJ / 355 kcal …",
      "storageInstructions": null,
      "origin": "India",
      "manufacturer": "…"
    },
    "seo": { "title": "Basmati Rice 5 kg", "description": "Aged long-grain rice" },
    "publishedAt": "2026-09-01T08:00:00.000Z",
    "updatedAt": "2026-09-20T09:30:00.000Z"
  }
}
```

`food.*` texts are free text as the admin typed them (may be `null`). `images` come main image first. `slugs` gives the slug in both languages for the language switch and `hreflang`. `gtin` may be `null`.

**Possible Errors:**

- `404 PRODUCT_NOT_FOUND` – unknown, not active, or in a hidden category.
- `404 NOT_FOUND` – malformed slug.

---

## 8. Cart

The cart is stored on the server for signed-in customers. Visitors can price a cart without an account (`preview`) and hand it over after signing in (`merge`). Every cart endpoint answers with the same **bill** object.

### 8.1 The bill (response of every cart endpoint)

```json
{
  "canOrder": true,
  "cargo": {
    "id": "66f0a1b2c3d4e5f6a7b8c9d0",
    "code": "RF-C027",
    "name": "October delivery",
    "message": null,
    "orderOpenAt": "2026-09-20T00:00:00.000Z",
    "orderCloseAt": "2026-10-05T21:59:59.000Z",
    "opensInSeconds": 0,
    "closesInSeconds": 432000,
    "delivery": { "start": "2026-10-20", "end": "2026-10-24" }
  },
  "lines": [
    {
      "productId": "66e9f0a1b2c3d4e5f6a7b8c9",
      "quantity": 2,
      "unitPrice": 1299,
      "lineTotal": 2598,
      "vatRate": 700,
      "vatAmount": 170,
      "issue": null,
      "ordering": { "canOrder": true, "reason": null, "minQuantity": 1, "maxQuantity": 10, "remaining": 48 },
      "product": { "…product list entry (section 7)…": "" }
    },
    {
      "productId": "66e9f0a1b2c3d4e5f6a7b8c9ff",
      "quantity": 1,
      "unitPrice": 0,
      "lineTotal": 0,
      "vatRate": 0,
      "vatAmount": 0,
      "issue": "product_not_found",
      "ordering": null,
      "product": null
    }
  ],
  "totals": {
    "currency": "EUR",
    "subtotal": 2598,
    "deliveryFee": 499,
    "total": 3097,
    "netTotal": 2894,
    "vatTotal": 203,
    "vat": [ { "vatRate": 700, "vatPercent": 7, "gross": 3097, "net": 2894, "vat": 203 } ]
  },
  "delivery": { "fee": 499, "freeFrom": 5000, "missingForFree": 2402 }
}
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `canOrder` | boolean | `true` only when a cargo takes orders, the cart is not empty and **every** line is free of issues. This is the "Confirm pre-order" button state. |
| `cargo` | object or `null` | The cargo the order would belong to (same shape as `current` of `GET /v1/store/cargo`). `null` = ordering closed. |
| `lines[].issue` | `null` or one of `product_not_found`, `quantity_below_minimum`, `quantity_above_maximum`, `ordering_closed`, `product_unavailable`, `not_in_this_cargo`, `sold_out` | Why this line cannot be ordered. Show it on the line. |
| `lines[].ordering` | Ordering block or `null` | `null` when the product no longer exists. Inside `lines[].product` the `ordering` field is always `null`; use the line-level one. |
| `lines[].product` | product entry or `null` | `null` when the product was removed or deactivated (then `unitPrice`, `lineTotal`, `vatRate`, `vatAmount` are `0`). |
| `totals` | object | Computed over issue-free lines only. `vat[]` is grouped by rate; the delivery fee is shared across rates. |
| `delivery.freeFrom` | int cents or `null` | Goods value from which delivery is free. `missingForFree` = what is still missing (`0` when reached; `null` when there is no free tier). |

### `POST /v1/store/cart/preview`

**Purpose:** Price a cart kept in the browser (visitor not signed in). Nothing is stored.

**Authentication:** none. Rate limit 60 requests per minute per IP.

**Parameters:** `locale` (query, optional).

**Request Body:**

```json
{ "items": [ { "productId": "66e9f0a1b2c3d4e5f6a7b8c9", "quantity": 2 } ] }
```

| Field | Type | Required | Validation |
| ----- | ---- | -------- | ---------- |
| `items` | array | yes | 1–100 entries, no duplicate `productId`. |
| `items[].productId` | ObjectId string | yes | |
| `items[].quantity` | int | yes | 1–10000 |

**Success Response (200):** the bill.

**Possible Errors:** `400 VALIDATION_FAILED`, `429 RATE_LIMITED`.

### `GET /v1/store/cart`

**Purpose:** The stored cart of the signed-in customer, as a bill.

**Authentication:** customer session.

**Parameters:** `locale` (query, optional).

**Success Response (200):** the bill (with `lines: []` when empty).

### `POST /v1/store/cart/merge`

**Purpose:** After signing in, hand over the cart the visitor filled before. For a product in both carts the larger quantity wins. Unknown or inactive products are dropped silently. Sending the same cart twice changes nothing.

**Authentication:** customer session.

**Request Body:** same as `preview`.

**Success Response (200):** the bill.

### `PUT /v1/store/cart/items/{productId}`

**Purpose:** Set the quantity of a product (adds it when missing).

**Authentication:** customer session.

**Parameters:** `productId` (path, ObjectId), `locale` (query, optional).

**Request Body:**

```json
{ "quantity": 2 }
```

`quantity`: int 0–10000; `0` removes the product.

**Success Response (200):** the bill.

**Possible Errors:**

- `404 CART_PRODUCT_NOT_FOUND` – product missing or not active (only when `quantity > 0`).
- `400 CART_FULL` – the cart already has 100 lines (`details: { maximum: 100 }`).
- `400 VALIDATION_FAILED`.

### `DELETE /v1/store/cart/items/{productId}`

**Purpose:** Remove a product. Never fails when the product is not in the cart.

**Authentication:** customer session. **Success Response (200):** the bill.

### `DELETE /v1/store/cart`

**Purpose:** Empty the cart.

**Authentication:** customer session. **Success Response (200):** the bill (empty).

---

## 9. Orders (pre-orders)

An order is made from the **server-stored cart**, belongs to the cargo that takes orders, and is paid **after delivery**. Nothing is charged at checkout.

### 9.1 Order statuses

| `status` | Meaning for the customer |
| --- | --- |
| `confirmed` | The pre-order is placed. |
| `preparing` | Radhe Foods is preparing it. |
| `dispatched` | On its way (carrier and tracking in `delivery`). |
| `delivered` | Delivered. Payment follows; returns are possible within the return window. |
| `delivery_failed` | Delivery was not possible; Radhe Foods will get in touch (usually the order moves to the next cargo). |
| `returned` | Everything was returned. |
| `cancelled` | Cancelled (by the customer or Radhe Foods; see `cancellation`). |

| `paymentStatus` | Meaning |
| --- | --- |
| `not_enabled` | Nothing to pay yet (not delivered, or payment not activated). |
| `due` | The invoice is issued; `payment.deadline` lies ahead. |
| `overdue` | The deadline passed. New orders are refused until paid. |
| `paid` | Paid (online, cash, or settled by a credit note). |
| `waived` | Radhe Foods waived the amount. |
| `refunded` | Everything paid was refunded. |

### 9.2 Order objects

**Order summary** (list entries):

```json
{
  "orderNumber": "RF-1084",
  "status": "dispatched",
  "paymentStatus": "not_enabled",
  "placedAt": "2026-09-28T10:15:00.000Z",
  "total": 3097,
  "finalTotal": 3097,
  "currency": "EUR",
  "itemCount": 3,
  "preview": [ { "name": "Chakki Atta", "imageUrl": "https://cdn…/small.webp" } ],
  "delivery": {
    "method": "dhl",
    "trackingNumber": "00340434161094015902",
    "trackingUrl": "https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=00340434161094015902&lang=en",
    "dispatchedAt": "2026-10-21T08:00:00.000Z",
    "deliveredAt": null,
    "promisedStart": "2026-10-20",
    "promisedEnd": "2026-10-24",
    "cargo": "RF-C027"
  }
}
```

- `total` is the agreed bill; `finalTotal` the bill after corrections and returns (what is invoiced).
- `preview` holds the first three items (`imageUrl` may be `null`). `itemCount` = sum of quantities.
- `delivery.method` ∈ `radhe_delivery`, `dhl`, `hermes`. `trackingNumber`/`trackingUrl` are `null` until set; `trackingUrl` is `null` for `radhe_delivery`. `promisedStart`/`promisedEnd` are calendar days.

**Order detail** (`GET /v1/store/orders/{orderNumber}`, and the `order` of place/cancel) = summary plus:

```json
{
  "language": "de",
  "items": [
    {
      "productId": "66e9f0a1b2c3d4e5f6a7b8c9",
      "sku": "ATTA-5KG",
      "name": "Chakki Atta",
      "packSize": { "value": 5, "unit": "kg", "label": "5 kg" },
      "imageUrl": "https://cdn…/small.webp",
      "quantity": 2,
      "unitPrice": 1299,
      "regularUnitPrice": 1499,
      "lineTotal": 2598,
      "vatRate": 700,
      "vatPercent": 7,
      "vatAmount": 170,
      "deliveredQuantity": 2,
      "returnedQuantity": 0,
      "finalLineTotal": 2598
    }
  ],
  "totals": { "currency": "EUR", "subtotal": 2598, "deliveryFee": 499, "total": 3097, "netTotal": 2894, "vatTotal": 203, "vat": [ { "vatRate": 700, "gross": 3097, "net": 2894, "vat": 203 } ] },
  "finalTotals": { "…same shape as totals…": "" },
  "adjustments": [
    { "productId": "66e9…", "sku": "ATTA-5KG", "from": 2, "to": 1, "reason": "damaged", "at": "2026-10-23T09:00:00.000Z" }
  ],
  "deliveryAddress": {
    "firstName": "Priya", "lastName": "Shah", "company": "…", "street": "Hauptstraße", "houseNumber": "12",
    "additionalLine": "2. OG", "postalCode": "60311", "city": "Frankfurt am Main", "countryCode": "DE", "phone": "+4915112345678"
  },
  "note": "Please ring twice.",
  "payment": { "…payment block, section 10.1…": "" },
  "canCancel": true,
  "returns": { "possible": false, "until": null },
  "cancellation": null,
  "acceptedTerms": {
    "at": "2026-09-28T10:15:00.000Z",
    "documents": [ { "type": "terms", "version": 3 }, { "type": "privacy", "version": 2 } ]
  }
}
```

- `regularUnitPrice` is the crossed-out price or `null`. `finalLineTotal = (deliveredQuantity − returnedQuantity) × unitPrice`.
- `adjustments[].reason` ∈ `missing`, `damaged`, `wrong_item`, `customer_complaint`, `other` (corrections of delivered quantities made by Radhe Foods).
- `deliveryAddress`: `company`, `additionalLine`, `phone` are **absent** when they were not set.
- `canCancel`: whether `POST …/cancel` is allowed right now (depends on the shop setting `customerCancellation`, section 9.6).
- `returns.until`: end of the return window (ISO) or `null`; `returns.possible` is `true` while the window is open and something can still be sent back.
- `cancellation`: `null` or `{ "reason": "changed_mind", "text": "…", "by": "customer" | "admin" | "system", "at": "…" }` (`text` is only shown when `by` is `customer`).

### `POST /v1/store/orders`

**Purpose:** Confirm the stored cart as a binding pre-order.

**Authentication:** customer session. Rate limit 20 per minute.

**Headers:**

| Header | Required | Description |
| ------ | -------- | ----------- |
| `Idempotency-Key` | yes | 8–64 characters `[A-Za-z0-9_-]` (a UUID works). Generate it when the customer reaches the confirm step and **reuse it on retries**. The same key sent again returns the first order (HTTP 200, `created: false`) instead of creating a second one. |

**Parameters:** `locale` (query, optional).

**Request Body:**

```json
{
  "addressId": "66e1a2b3c4d5e6f7a8b9c0d1",
  "expectedTotal": 3097,
  "consent": {
    "accepted": true,
    "versions": { "terms": 3, "privacy": 2 }
  },
  "note": "Please ring twice.",
  "language": "de"
}
```

| Field | Type | Required | Validation / meaning |
| ----- | ---- | -------- | -------------------- |
| `addressId` | ObjectId string | yes | One of the customer's delivery addresses. |
| `expectedTotal` | int cents | yes | 1–1 000 000 000. `totals.total` of the bill the customer saw. If the bill changed since (prices, fee, cart), the order is refused with the new bill. |
| `consent.accepted` | boolean | yes | Must be `true`. |
| `consent.versions` | object | yes | `{ terms?: int ≥1, preorder_terms?: int ≥1, privacy?: int ≥1 }` – the versions from `GET /v1/store/legal`. |
| `note` | string | no | ≤500 characters. |
| `language` | `en` \| `de` | no | Language of the order and its emails. Defaults to the account language. |

**Success Response:** `201` when created, `200` when the idempotency key was seen before.

```json
{ "created": true, "order": { "…order detail…": "" } }
```

**Possible Errors (in the order they are checked):**

- `400 IDEMPOTENCY_KEY_REQUIRED` – header missing or malformed.
- `403 CUSTOMER_BLOCKED` – the account is blocked.
- `403 ORDERING_BLOCKED` – Radhe Foods blocked ordering for this customer.
- `403 PAYMENT_OVERDUE` – an earlier order is unpaid past its deadline. `details.orders[]`: `{ orderNumber, invoiceNumber, amountDue, deadlineAt, orderUrl }` (max 10). Show a friendly message with a "Pay now" link to `orderUrl`.
- `404 ADDRESS_NOT_FOUND`.
- `409 LEGAL_DOCUMENTS_MISSING` – the shop has no published `terms`/`privacy` yet (`details: { missing: [...] }`).
- `409 LEGAL_VERSION_CHANGED` – a text was republished since the page loaded. `details.current` holds the current versions; reload the texts and ask again.
- `409 CART_EMPTY`.
- `409 ORDERING_CLOSED` – no cargo takes orders.
- `409 ORDER_ITEMS_NOT_ORDERABLE` – `details.lines[]`: `{ productId, sku, quantity, issue, minQuantity, maxQuantity }`.
- `409 ORDER_TOTAL_CHANGED` – `details: { expectedTotal, total, totals }` (`totals` is the new bill's totals). Show the new total and let the customer confirm again.
- `409 CARGO_PRODUCT_NOT_AVAILABLE` / `409 CARGO_PRODUCT_LIMIT_REACHED` (`details: { requested, remaining }`) – lost a race against other orders for the last units.
- `400 VALIDATION_FAILED`, `429 RATE_LIMITED`.

### `GET /v1/store/orders`

**Purpose:** Own orders, newest first.

**Authentication:** customer session.

**Parameters:**

| Field | Location | Type | Required | Description |
| ----- | -------- | ---- | -------- | ----------- |
| `locale` | query | `en` \| `de` | no | |
| `limit` | query | int 1–100 | no | Default 25. |
| `cursor` | query | ObjectId string | no | `nextCursor` of the previous page. |

**Success Response (200):**

```json
{ "items": [ { "…order summary…": "" } ], "nextCursor": "66f0…" }
```

`nextCursor` is `null` on the last page.

### `GET /v1/store/orders/{orderNumber}`

**Purpose:** One order with the full bill and the payment block.

**Authentication:** customer session.

**Parameters:** `orderNumber` (path, `RF-1084`; case-insensitive), `locale` (query, optional).

**Success Response (200):** `{ "order": { …order detail… } }`

**Possible Errors:** `404 ORDER_NOT_FOUND` (malformed number, or not this customer's order).

### `POST /v1/store/orders/{orderNumber}/cancel`

**Purpose:** Cancel an order while `canCancel` is true. Items of a placed order cannot be changed: cancel and order again.

**Authentication:** customer session.

**Request Body:**

```json
{ "reason": "changed_mind", "text": "Found it elsewhere." }
```

| Field | Type | Required | Validation |
| ----- | ---- | -------- | ---------- |
| `reason` | `changed_mind` \| `ordered_by_mistake` \| `wrong_items` \| `delivery_too_late` \| `other` | yes | |
| `text` | string | no | ≤1000 |

**Success Response (200):** `{ "order": { …order detail… } }` with `status: "cancelled"`. Cancelling an already cancelled order answers 200 unchanged.

**Possible Errors:**

- `404 ORDER_NOT_FOUND`.
- `409 ORDER_CANNOT_BE_CANCELLED` – `details: { status }`; the message asks the customer to contact Radhe Foods.
- `400 VALIDATION_FAILED`.

### 9.6 Cancellation rule

`GET /v1/store/settings` → `orderPolicy.customerCancellation`:

| Setting | Customer can cancel while status is |
| --- | --- |
| `while_confirmed` | `confirmed` |
| `until_dispatched` (default) | `confirmed`, `preparing` |
| `never` | never (ask Radhe Foods) |

Use `order.canCancel` rather than computing this yourself.

### `GET /v1/store/me/ordering`

**Purpose:** Whether the customer may place a new order now, for the message **before** the checkout button. Call it when the checkout page opens.

**Authentication:** customer session.

**Success Response (200):**

```json
{
  "canOrder": false,
  "reason": "payment_overdue",
  "overdue": [
    { "orderNumber": "RF-1084", "invoiceNumber": "INV-2026-000123", "amountDue": 3193, "deadlineAt": "2026-09-20T21:59:59.000Z" }
  ]
}
```

`reason` ∈ `null`, `account_blocked`, `ordering_blocked`, `payment_overdue`. `overdue[]` (max 10, earliest deadline first) lists the unpaid orders past their deadline; link each to `/account/orders/<orderNumber>` where the customer can pay. Browsing, the cart and paying keep working while ordering is blocked.

---

## 10. Payments

Payment starts after delivery: Radhe Foods issues the invoice and emails a payment link. The customer pays online (card or PayPal through Stripe Checkout) or in cash to the driver (self-delivery only). No partial payments.

### 10.1 The payment block

Part of every order detail (`order.payment`) and of the payment endpoints.

Before payment is activated:

```json
{ "status": "not_enabled", "amountDue": 0, "invoice": null, "deadline": null, "paidAt": null, "method": null, "canPayOnline": false }
```

After activation (more keys):

```json
{
  "status": "due",
  "amountDue": 3193,
  "invoicedAmount": 3193,
  "creditedAmount": 0,
  "paidAmount": 0,
  "refundedAmount": 0,
  "invoice": { "number": "INV-2026-000123", "issuedAt": "2026-09-28T10:15:00.000Z", "pdfPath": "/v1/store/invoices/INV-2026-000123/pdf" },
  "deadline": "2026-10-03T21:59:59.000Z",
  "isOverdue": false,
  "paidAt": null,
  "method": null,
  "paymentType": null,
  "receiptUrl": null,
  "canPayOnline": true,
  "cashPossible": true
}
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `status` | payment status (9.1) | |
| `amountDue` | int cents | What is still to pay. |
| `invoice.pdfPath` | string | Relative to the API base URL (needs the customer's cookies). |
| `deadline` | ISO | End of the payment deadline (23:59:59 German time of that day). |
| `isOverdue` | boolean | Computed against now, even before the status flips to `overdue`. |
| `method` | `stripe` \| `cash` \| `credit` \| `null` | How it was paid (`credit`: settled by a credit note). |
| `paymentType` | `card` \| `paypal` \| `null` | For Stripe payments. |
| `receiptUrl` | string or `null` | Stripe receipt. |
| `canPayOnline` | boolean | Show the "Pay now" button only when `true` (Stripe configured, status `due`/`overdue`, amount > 0). |
| `cashPossible` | boolean | `true` when the order is delivered by Radhe Foods and still owing: tell the customer cash to the driver is possible. |

### `GET /v1/store/orders/{orderNumber}/payment`

**Purpose:** The payment block and the documents of an order. Also the endpoint to call when the customer **returns from Stripe** (`?payment=success`): it asks Stripe about the open payment page before answering, so `status` can already be `paid` before the webhook arrives.

**Authentication:** customer session.

**Success Response (200):**

```json
{
  "orderNumber": "RF-1084",
  "payment": { "…payment block…": "" },
  "documents": [ { "…invoice summary (section 11)…": "" } ]
}
```

**Possible Errors:** `404 ORDER_NOT_FOUND`; `502 PAYMENT_PROVIDER_ERROR` (Stripe could not be reached).

### `POST /v1/store/orders/{orderNumber}/checkout`

**Purpose:** Get the address of the Stripe payment page for the full amount due, then redirect the browser to `url`. Asking again while the page is open returns the same page.

**Authentication:** customer session. Rate limit 10 per minute.

**Success Response (200):**

```json
{ "url": "https://checkout.stripe.com/c/pay/cs_…", "expiresAt": "2026-09-30T11:00:00.000Z" }
```

After paying, Stripe sends the browser to `<SHOP_URL>/account/orders/<orderNumber>?payment=success`; on cancel to `…?payment=cancelled`. On that page call `GET …/payment` (above); if `status` is still `due` (asynchronous methods), poll again after a few seconds.

**Possible Errors:**

- `409 PAYMENT_NOT_ACTIVATED` – no invoice yet.
- `409 PAYMENT_NOT_POSSIBLE` – `details: { paymentStatus }` (already paid, waived, refunded).
- `409 PAYMENT_NOTHING_DUE`.
- `503 PAYMENTS_NOT_CONFIGURED` – online payment is not set up on the server; offer cash instead. (`canPayOnline` is `false` in this case, so the button should not be shown.)
- `502 PAYMENT_PROVIDER_ERROR`, `404 ORDER_NOT_FOUND`, `429 RATE_LIMITED`.

### 10.4 The payment link page (`/pay/<token>`)

The payment request email and reminders carry a link `<SHOP_URL>/pay/<token>`. The shop page for it needs **no login**: it shows the order and the amount and leads to Stripe. A new token is issued with every reminder; older links stop working.

### `GET /v1/pay/{token}`

**Purpose:** What the link pays.

**Authentication:** none (the token is the key). Rate limit 30 per minute.

**Success Response (200):**

```json
{
  "orderNumber": "RF-1084",
  "firstName": "Anna",
  "language": "de",
  "payment": { "…payment block…": "" }
}
```

`firstName` may be `null`. Render the page in `language`.

**Possible Errors:** `404 PAY_LINK_INVALID` – malformed, unknown or replaced token. Show "This payment link is not valid. Please open the order in your account."

### `POST /v1/pay/{token}/checkout`

**Purpose:** The Stripe page for the linked order. Same answer and errors as `POST /v1/store/orders/{orderNumber}/checkout`, plus `404 PAY_LINK_INVALID`. Rate limit 10 per minute. The return URLs point to the account order page (the customer may be asked to sign in there).

---

## 11. Invoices and credit notes

Every activated payment has an invoice (`INV-2026-000123`); corrections and returns after invoicing produce credit notes (`CN-2026-000007`). Documents never change once issued. The PDF is rendered on request.

### 11.1 Document objects

**Summary:**

```json
{
  "id": "66f1c0a2b3d4e5f6a7b8c9d1",
  "number": "INV-2026-000123",
  "type": "invoice",
  "orderNumber": "RF-1084",
  "issuedAt": "2026-09-28T10:15:00.000Z",
  "dueAt": "2026-10-03T21:59:59.000Z",
  "paidAt": null,
  "total": 3193,
  "currency": "EUR",
  "language": "de",
  "invoiceNumber": null,
  "creditReason": null
}
```

`type` ∈ `invoice`, `credit_note`. For a credit note, `dueAt`/`paidAt` are `null`, `invoiceNumber` names the invoice it corrects and `creditReason` is `return` or `adjustment`.

**Detail** = summary plus:

```json
{
  "orderId": "66f1…", "customerId": "66f1…", "cargoId": "66f1…",
  "deliveredOn": "2026-09-27",
  "creditReference": null,
  "seller": { "name": "Radhe Foods GmbH", "addressLines": ["Hauptstraße 1", "60311 Frankfurt am Main"], "email": "billing@radhefoods.de", "phone": null, "website": null, "vatId": "DE123456789", "taxNumber": null, "registration": null },
  "customer": { "name": "Anna Schmidt", "company": null, "addressLines": ["Hauptstr. 5", "10115 Berlin", "Deutschland"], "email": "anna@example.com" },
  "lines": [
    { "description": "Basmati Reis, 5 kg", "sku": "RICE-5KG", "quantity": 2, "unitPrice": 1299, "vatRate": 700, "vatPercent": 7, "lineTotal": 2598 }
  ],
  "totals": { "currency": "EUR", "subtotal": 2598, "deliveryFee": 595, "total": 3193, "netTotal": 2984, "vatTotal": 209, "vat": [ { "vatRate": 700, "gross": 3193, "net": 2984, "vat": 209 } ] },
  "footer": null
}
```

### `GET /v1/store/invoices`

**Purpose:** Own invoices and credit notes, newest first.

**Authentication:** customer session.

**Parameters:**

| Field | Location | Type | Required | Description |
| ----- | -------- | ---- | -------- | ----------- |
| `orderNumber` | query | `RF-1084` | no | Only the documents of one order. |
| `limit` | query | int 1–100 | no | Default 25. |
| `cursor` | query | ObjectId string | no | |

**Success Response (200):** `{ "items": [ …summaries… ], "nextCursor": null }`

### `GET /v1/store/invoices/{number}`

**Purpose:** One document with every line.

**Authentication:** customer session.

**Parameters:** `number` (path, `INV-2026-000123` or `CN-2026-000007`; case-insensitive).

**Success Response (200):** `{ "invoice": { …detail… } }`

**Possible Errors:** `404 INVOICE_NOT_FOUND`.

### `GET /v1/store/invoices/{number}/pdf`

**Purpose:** The PDF.

**Authentication:** customer session (send the cookies; open it with `fetch` + `credentials: 'include'` and a Blob URL, or as a direct link on the same site domain).

**Success Response (200):** binary body, `Content-Type: application/pdf`, `Content-Disposition: inline; filename="INV-2026-000123.pdf"`, `Cache-Control: private, no-store`.

**Possible Errors:** `404 INVOICE_NOT_FOUND`.

---

## 12. Returns

After delivery, within the return window, a customer can ask to send single products back. Radhe Foods decides; once the goods are back the bill goes down (credit note, refund if already paid).

### 12.1 Return statuses and reasons

| `status` | Meaning |
| --- | --- |
| `requested` | Waiting for Radhe Foods. The customer can still cancel. |
| `approved` | Accepted (possibly with fewer units: see `approvedQuantity`). Goods not back yet. |
| `rejected` | Declined; `answer` says why. |
| `completed` | Goods are back; `creditAmount` was credited. |
| `cancelled` | Withdrawn by the customer. |

Reasons: `damaged`, `wrong_item`, `quality`, `not_as_described`, `changed_mind`, `other`.

### 12.2 Return object

```json
{
  "returnNumber": "RF-1084-R1",
  "orderNumber": "RF-1084",
  "status": "requested",
  "requestedAt": "2026-10-26T12:00:00.000Z",
  "decidedAt": null,
  "completedAt": null,
  "items": [
    {
      "productId": "66e9…", "sku": "ATTA-5KG", "name": "Chakki Atta",
      "packSize": { "value": 5, "unit": "kg", "label": "5 kg" },
      "quantity": 1, "approvedQuantity": null, "unitPrice": 1299,
      "reason": "damaged", "comment": "Bag was torn"
    }
  ],
  "comment": "Please pick up on Monday.",
  "answer": null,
  "creditAmount": null,
  "canCancel": true
}
```

### `GET /v1/store/orders/{orderNumber}/returns`

**Purpose:** The returns of an order and what can still be sent back.

**Authentication:** customer session.

**Parameters:** `orderNumber` (path), `locale` (query, optional).

**Success Response (200):**

```json
{
  "items": [ { "…return…": "" } ],
  "returnable": [ { "productId": "66e9…", "sku": "ATTA-5KG", "available": 1 } ]
}
```

`returnable` has one row per order item; `available` = delivered − returned − units in open requests (can be `0`).

**Possible Errors:** `404 ORDER_NOT_FOUND`.

### `POST /v1/store/orders/{orderNumber}/returns`

**Purpose:** Ask to send products back. Only for a delivered order while `order.returns.possible` is true.

**Authentication:** customer session. Rate limit 10 per minute.

**Request Body:**

```json
{
  "items": [ { "productId": "66e9…", "quantity": 1, "reason": "damaged", "comment": "Bag was torn" } ],
  "comment": "Please pick up on Monday.",
  "locale": "en"
}
```

| Field | Type | Required | Validation |
| ----- | ---- | -------- | ---------- |
| `items` | array | yes | 1–100, unique `productId`. |
| `items[].productId` | ObjectId string | yes | A product of the order. |
| `items[].quantity` | int | yes | 1–10000, at most `available`. |
| `items[].reason` | reason enum | yes | |
| `items[].comment` | string | no | ≤500 |
| `comment` | string | no | ≤1000 |
| `locale` | `en` \| `de` | no | In the **body** for this endpoint. |

**Success Response (201):** `{ "return": { …return… } }`

**Possible Errors:**

- `404 ORDER_NOT_FOUND`.
- `409 RETURN_NOT_POSSIBLE` – order not delivered (`details: { status }`).
- `409 RETURN_WINDOW_CLOSED` – `details: { until, windowDays }` (also when returns are switched off, `windowDays: 0`).
- `400 ORDER_ITEM_NOT_FOUND` – `details: { productId }`.
- `409 RETURN_QUANTITY_INVALID` – more than available: `details: { productId, sku, available }`.
- `400 VALIDATION_FAILED`, `429 RATE_LIMITED`.

### `GET /v1/store/returns/{returnNumber}`

**Purpose:** One return. `returnNumber` like `RF-1084-R1` (case-insensitive).

**Authentication:** customer session. **Success Response (200):** `{ "return": { … } }`. **Possible Errors:** `404 RETURN_NOT_FOUND`.

### `POST /v1/store/returns/{returnNumber}/cancel`

**Purpose:** Take the request back while it is `requested`.

**Authentication:** customer session. No body.

**Success Response (200):** `{ "return": { …, "status": "cancelled" } }` (already cancelled → 200 unchanged).

**Possible Errors:** `404 RETURN_NOT_FOUND`; `409 RETURN_TRANSITION_NOT_ALLOWED` (`details: { from, to: "cancelled" }`) once Radhe Foods has decided.

---

## 13. Status reference

### Order status (`order.status`)

`confirmed` → `preparing` → `dispatched` → `delivered`; `dispatched` → `delivery_failed` (then usually back to `dispatched` with the next cargo); `cancelled`; `returned` (everything was returned after delivery). Radhe Foods can step one status back to correct a mistake, so a status can move backwards once in a while.

### Payment status (`order.paymentStatus`, `payment.status`)

`not_enabled` → `due` → `paid`; `due` → `overdue` (deadline passed, still payable) → `paid`; `due`/`overdue` → `waived`; `paid` → `refunded` (everything refunded; partial refunds keep `paid` with `refundedAmount > 0`).

### Return status

`requested` → `approved` → `completed`; `requested`/`approved` → `rejected`; `requested` → `cancelled` (by the customer).

### Cart line issue / ordering reason

`ordering_closed`, `product_unavailable`, `not_in_this_cargo`, `sold_out` (from the ordering rule), plus cart-only `product_not_found`, `quantity_below_minimum`, `quantity_above_maximum`.

### Delivery methods

`radhe_delivery` (Radhe Foods' own driver; cash possible), `dhl`, `hermes` (tracking link available). Chosen by Radhe Foods, never by the customer.

### Cancellation reasons (customer)

`changed_mind`, `ordered_by_mistake`, `wrong_items`, `delivery_too_late`, `other`.

### Return reasons

`damaged`, `wrong_item`, `quality`, `not_as_described`, `changed_mind`, `other`.

### Ordering block reasons (`GET /v1/store/me/ordering`)

`account_blocked`, `ordering_blocked`, `payment_overdue`, or `null`.

---

## 14. Prepared but not yet active

| Feature | State | What the shop should do |
| ------- | ----- | ----------------------- |
| Online payment (Stripe Checkout, card + PayPal) | Built and tested against a Stripe stand-in; the Stripe account is not connected yet. Until then `payment.canPayOnline` is `false` and checkout answers `503 PAYMENTS_NOT_CONFIGURED`. | Show "Pay now" only when `canPayOnline` is `true`; show the cash hint when `cashPossible`. |
| Emails through Amazon SES | Built; the AWS account is not set up yet (emails currently go to the API log in development). | Nothing to do; email content is the API's. |
| WhatsApp messages | Built behind an interface; switched off until credentials exist. The preference (`whatsappOptIn`) can already be stored. | Offer the WhatsApp opt-in; explain that messages come by WhatsApp "as soon as the service is available", or hide the toggle until Radhe Foods confirms. |
| Google sign-in | Built; needs the Google client id on the server (`503 GOOGLE_NOT_CONFIGURED` until then). | Hide the button on that error. |

---

## 15. Integration checklist

1. `fetch` with `credentials: 'include'`; shop origin in `CORS_ORIGINS`; handle `401` → refresh once → sign-in.
2. Pass `?locale=` on every store call (or rely on `Accept-Language`).
3. Layout: `GET /v1/store/cargo` for the ordering state and countdown, `GET /v1/store/settings` for the delivery-fee hint, `GET /v1/store/categories` for navigation.
4. Product pages by slug (either language); use `packSizes` for the size chooser and `ordering` for the "add to cart" state.
5. Guest cart in local storage → `POST /v1/store/cart/preview` for prices; after sign-in `POST /v1/store/cart/merge`, then server cart.
6. Checkout: `GET /v1/store/me/ordering` (block message), `GET /v1/store/me/addresses` (address chooser), `GET /v1/store/legal` (consent versions and links), `GET /v1/store/cart` (`canOrder`, `totals.total` → `expectedTotal`), then `POST /v1/store/orders` with an `Idempotency-Key`; handle `ORDER_TOTAL_CHANGED`, `ORDER_ITEMS_NOT_ORDERABLE`, `LEGAL_VERSION_CHANGED`, `PAYMENT_OVERDUE`.
7. Account: orders list/detail, `canCancel` → cancel; `payment` block → "Pay now" (`POST …/checkout` → redirect to `url`), invoices and PDFs; returns within `returns.until`.
8. Pages without sign-in: `/pay/<token>` (payment link from emails), `/unsubscribe/<token>`, and the Stripe return page `/account/orders/<orderNumber>?payment=success|cancelled` (may require sign-in; then call `GET …/payment`).
9. Show `x-request-id` (or include it in support emails) when an unexpected error occurs.
