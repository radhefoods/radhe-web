# Radhe Foods – Customer Web API Documentation

For the customer-facing Next.js shop. Generated from the implemented NestJS backend (`radhe-api`) on 2026-10-16; every route, field, status and error below exists in the code as of this date. Admin-only APIs are documented separately in `ADMIN_API_DOCUMENTATION.md`.

**What the shop is:** an online shop for Indian groceries in Germany, sold from stock. Customers browse without an account, sign in to order, and **pay at checkout** (card or PayPal through Stripe Checkout). The payment confirms the order; Radhe Foods then prepares, dispatches and delivers it. The invoice is issued the moment the payment is captured and comes with the confirmation email.

A product comes in one or more **pack sizes** (`variants`): the product holds the name, texts, images, category and VAT rate; each pack size has its own id (`variantId`), article number, URL, price, stock and ordering state. The cart, the orders and the returns name the pack size.

## Contents

0. Conventions (base URL, versioning, responses, errors, auth, cookies, pagination, formats)
1. Customer authentication
2. Customer account: profile, communication preferences
3. Delivery addresses
4. Unsubscribe link (public)
5. Health
6. Shop settings and legal texts
7. Catalogue
8. Cart
9. Orders and checkout
10. Payments
11. Invoices and credit notes
12. Returns
13. Status reference
14. What depends on the server configuration
15. Integration checklist

---

## 0. Conventions

### 0.1 Base URL and versioning

- All shop routes are under `/v1/store/...`. The public link route is `/v1/unsubscribe/{token}`. Health is `/health` (no version).
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
- Generic codes: `VALIDATION_FAILED` (400), `BAD_REQUEST` (400), `AUTH_TOKEN_INVALID` (401, a store route that needs a session), `UNAUTHENTICATED` (401, other unauthenticated requests), `FORBIDDEN` (403), `ORIGIN_NOT_ALLOWED` (403), `NOT_FOUND` (404, also for unknown routes), `CONFLICT` (409), `RATE_LIMITED` (429), `SERVICE_UNAVAILABLE` (503), `INTERNAL_ERROR` (500).

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
| Human numbers | Orders `RF-1001`, returns `RF-1001-R1`, invoices `INV-2026-000001`, credit notes `CN-2026-000001`. Case-insensitive in URLs. |
| Money | Integer **cents** in EUR, VAT included (`1999` = €19.99). `currency` is always `"EUR"`. Never floats. |
| VAT rates | Hundredths of a percent: `700` = 7 %, `1900` = 19 %. Views also give `vatPercent` (`7`). |
| Date-times | ISO 8601 strings in UTC (`"2026-10-16T10:15:00.000Z"`). |
| Booleans/nulls | Optional values are `null` when not set, except where a section says a key is absent. |
| Images | Absolute `https` URLs (WebP), see section 7.1. Never construct image URLs yourself. |

### 0.8 Pagination

Two styles exist:

- **Page/limit** (catalogue): `?page=1&limit=24` → `{ items, page, limit, total, totalPages }`. `page` 1–500, `limit` 1–100.
- **Cursor** (orders, invoices): `?limit=25&cursor=<nextCursor>` → `{ items, nextCursor }`; newest first; `nextCursor` is `null` on the last page. `limit` 1–100, default 25.

### 0.9 HTTP status codes

`POST` answers `201` when something was created and `200` otherwise (documented per endpoint; `POST /v1/store/checkout` answers `201` for a new order and `200` when the same `Idempotency-Key` is sent again). `DELETE` answers `200` with the updated list or `204` (documented).

---

## 1. Customer authentication

Sign-in is passwordless: a 6-digit code by email, or Google sign-in. There is no separate sign-up: the first successful sign-in creates the account. Guests can browse and price a cart; they must sign in to check out.

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

**Purpose:** How the customer wants to hear from Radhe Foods. Emails about the customer's own orders always come and need no consent. WhatsApp messages need a number and a yes; news about products and offers (marketing) needs a yes of its own and can be withdrawn any time.

**Authentication:** customer session.

**Request Body:**

```json
{ "whatsappNumber": "+4915112345678", "whatsappOptIn": true, "marketingOptIn": true }
```

| Field | Type | Required | Validation / meaning |
| ----- | ---- | -------- | -------------------- |
| `whatsappNumber` | string or `null` | no | international format; `null` removes it. When absent, the profile `phone` is used for WhatsApp. |
| `whatsappOptIn` | boolean | no | Messages about own orders by WhatsApp (the dispatch message). |
| `marketingOptIn` | boolean | no | News about products and offers, by email (and WhatsApp when `whatsappOptIn`). |

**Success Response (200):**

```json
{
  "communication": {
    "whatsappNumber": "+4915112345678",
    "whatsappOptIn": true,
    "whatsappOptInAt": "2026-10-16T12:00:00.000Z",
    "marketingOptIn": true,
    "marketingOptInAt": "2026-10-16T12:00:00.000Z",
    "marketingOptOutAt": null
  }
}
```

Show the wording of the two consents clearly (they are dated for the record). WhatsApp sending itself needs credentials on the server (section 14); the preference can be stored in any case.

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

**Purpose:** Switch off news about products and offers for the customer the token stands for. Emails about the customer's own orders keep coming.

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

Public. Used by the layout (currency, delivery-fee hint, delivery estimate, return window) and by checkout (the legal texts the customer accepts).

### `GET /v1/store/settings`

**Purpose:** What the shop needs to render prices, the delivery-fee hint, the delivery estimate and the return window.

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
  "delivery": {
    "estimate": { "en": "2 to 4 working days", "de": "2 bis 4 Werktage" }
  },
  "returns": { "windowDays": 14 }
}
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `currency` | string | Always `EUR`. |
| `timezone` | string | The business time zone (`Europe/Berlin`); the dates on invoices are meant in it. |
| `deliveryFee.tiers[]` | `{ minOrderValue: int cents, fee: int cents }` | The highest tier whose `minOrderValue` the value of the goods reaches applies. One tier always starts at 0. Sorted ascending. |
| `deliveryFee.freeFrom` | int cents or `null` | Lowest goods value from which delivery is free, or `null` when no tier is free. |
| `delivery.estimate` | `{ en: string, de: string }` | How long delivery takes, as Radhe Foods words it. Both languages are always given (this endpoint takes no `locale`); show it at checkout and on the order page. |
| `returns.windowDays` | int | Days after delivery in which a return can be requested; `0` = returns switched off. |

The cancellation rule (until when a customer may cancel) is not part of this answer: use `canCancel` of each order (section 9).

### `GET /v1/store/legal`

**Purpose:** The versions of the legal texts that apply now. Checkout shows links to them and sends their versions back in `consent.versions`.

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

Only published types appear. There are two types, `terms` and `privacy`; both must be published before any order can be placed, and the versions of both are sent back at checkout.

### `GET /v1/store/legal/{type}`

**Purpose:** One legal text with its content (plain text or Markdown, as the admin entered it).

**Authentication:** none.

**Parameters:**

| Field | Location | Type | Required | Description |
| ----- | -------- | ---- | -------- | ----------- |
| `type` | path | `terms` \| `privacy` | yes | |
| `locale` | query | `en` \| `de` | no | |

**Success Response (200):**

```json
{
  "document": {
    "type": "terms",
    "version": 3,
    "title": "Terms and Conditions",
    "publishedAt": "2026-09-01T08:00:00.000Z",
    "content": "…markdown or plain text…"
  }
}
```

**Possible Errors:**

- `404 LEGAL_DOCUMENT_NOT_FOUND` – no published version of this type ("This legal text is not published yet.").
- `400 BAD_REQUEST` – unknown `type` (message `Validation failed (enum string is expected)`).

---

## 7. Catalogue

Public. Products, categories and, for every pack size, the answer "can the customer order this right now?", which follows from the stock.

A product has one or more pack sizes, smallest first in `variants`. One of them is the **default size** and stands for the product in lists: the smallest enabled size whose stock covers the smallest order, else the smallest enabled size. Each size has its own `id` (the `variantId` of the cart and the orders), `sku`, URL (`slug`), `packSize`, `pricing` and `ordering`. The **display name** is the product name followed by the pack label in parentheses: `Basmati Rice (1 kg)`, in German `Basmati Reis (1 kg)`.

### 7.1 Shared objects

**PriceView** (in every product answer as `pricing`, always the price of one pack size):

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
| `basePrice` | `{ amount: int cents, per: "kg" \| "l" \| "pcs" }` | Price per kilogram / litre / piece (German price-indication rule). Show it next to every price. |

**PackSize:** `{ "value": 5, "unit": "kg", "label": "5 kg" }`. `unit` ∈ `g`, `kg`, `ml`, `l`, `pcs`. `label` is localized (`"0,5 kg"`, `"Stk."` in German). All sizes of one product share one unit family (weight, volume or pieces).

**Pack size entry** (each item of `variants[]` on a product):

```json
{
  "id": "66f4a0c1e4b0f1a2b3c4d5e7",
  "sku": "RF-00041",
  "slug": "basmati-rice-1kg",
  "packSize": { "value": 1, "unit": "kg", "label": "1 kg" },
  "displayName": "Basmati Rice (1 kg)",
  "pricing": { "…PriceView…": "" },
  "ordering": { "canOrder": true, "reason": null, "minQuantity": 1, "maxQuantity": 10, "remaining": 37 },
  "isDefault": true,
  "isSelected": true
}
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `id` | ObjectId string | The `variantId` for the cart. |
| `slug` | string | The URL of this size in the requested language (`basmati-rice-1kg`, `basmati-reis-1kg`; `1-5kg` for 1.5, `6pcs` and in German `6stk` for pieces). |
| `displayName` | string | Name with the pack label; the title of this size. |
| `isDefault` | boolean | The size that stands for the product in lists. |
| `isSelected` | boolean | The size the answer is about (the one shown by the list entry or the product page). Exactly one entry is selected. |

`variants` holds only enabled sizes, smallest first; a size Radhe Foods switched off is not listed and its URL answers 404.

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

**Ordering block** (`ordering` on a product entry, for the size it shows, and on each entry of `variants`; the same object is `line.ordering` in the cart):

```json
{ "canOrder": true, "reason": null, "minQuantity": 1, "maxQuantity": 10, "remaining": 37 }
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `canOrder` | boolean | Whether this pack size can be put in an order at this moment: the product and the size are switched on and the stock covers the smallest order. This is the "add to cart" button state. |
| `reason` | `null` \| `product_unavailable` \| `sold_out` | Why not. `product_unavailable`: Radhe Foods switched the product or this size off for ordering. `sold_out`: the stock of this size does not cover `minQuantity`. |
| `minQuantity` | int | Least packs per order line (the product's `quantity.min`, the same for every size). |
| `maxQuantity` | int | Most packs in one order line: the product's limit per order (`quantity.max`) and the packs of this size in stock, whichever is lower. `0` when sold out. |
| `remaining` | int | Packs of this size in stock. Nothing is reserved before the payment, so this is what every customer sees; it can still change until a payment goes through. |

Products carry no other stock field: `remaining` is the number to use for "only 3 left" hints. Stock is per pack size: a sold-out 5 kg pack says nothing about the 1 kg pack.

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

**Purpose:** Product listing with filters, search, sorting and pages. One entry per product, shown as one of its pack sizes: the default size, or, with the `packSize` filter, the smallest enabled size that was asked for.

**Authentication:** none.

**Parameters (all query, all optional):**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `locale` | `en` \| `de` | |
| `category` | string (slug) | Products of the category and its sub-categories. |
| `q` | string, 2–80 chars | Search. Every word must begin a word of the product name, subtitle, brand, tags, search keywords or the article number of any of its sizes (umlauts are folded: `musli` finds `Müsli`). |
| `tag` | string, repeatable | Labels. A product matches when it has any of them: `tag=vegan&tag=new`. |
| `brand` | string ≤80, repeatable | Brands, any of them: `brand=Amul&brand=Tata`. |
| `storageType` | `ambient` \| `chilled` \| `frozen`, repeatable | Any of them. |
| `packSize` | string, repeatable | Pack sizes as value and unit without a space: `500g`, `1kg`, `0.5l`, `6pcs`. A product is listed when one of its enabled sizes is among them, and is shown as the smallest of those sizes (its `variantId`, `sku`, `slug`, `packSize`, `pricing`, `ordering`) instead of the default size. |
| `onSale` | boolean | `true`: only products with a reduced enabled size; `false`: only products without one. |
| `available` | boolean | `true`: only products switched on for ordering by Radhe Foods; `false`: only switched-off ones. Says nothing about stock or single sizes. |
| `orderable` | boolean | `true`: only products with an enabled size that can be ordered **now** (switched on, and its stock covers the smallest order). `false` is accepted and changes nothing. |
| `featured` | boolean | |
| `minPrice`, `maxPrice` | int cents, ≥0 | On the price of the default size. |
| `sort` | `recommended` (default) \| `newest` \| `price_asc` \| `price_desc` \| `discount` \| `name` | `price_*` and `discount` use the price and the discount of the default size. |
| `page` | int 1–500, default 1 | |
| `limit` | int 1–100, default 24 | |

**Success Response (200):**

```json
{
  "items": [
    {
      "id": "66f3…",
      "variantId": "66f4…",
      "sku": "RF-00041",
      "slug": "basmati-rice-1kg",
      "name": "Basmati Rice",
      "displayName": "Basmati Rice (1 kg)",
      "subtitle": null,
      "shortDescription": "Aged long-grain rice",
      "brand": "India Gate",
      "category": { "id": "66f0…", "slug": "rice", "name": "Rice" },
      "packSize": { "value": 1, "unit": "kg", "label": "1 kg" },
      "pricing": { "…PriceView…": "" },
      "isAvailable": true,
      "isFeatured": false,
      "quantity": { "min": 1, "max": 10 },
      "ordering": { "canOrder": true, "reason": null, "minQuantity": 1, "maxQuantity": 10, "remaining": 37 },
      "storageType": "ambient",
      "tags": ["new"],
      "image": { "…Image…": "" },
      "variants": [
        {
          "id": "66f4…", "sku": "RF-00041", "slug": "basmati-rice-1kg",
          "packSize": { "value": 1, "unit": "kg", "label": "1 kg" },
          "displayName": "Basmati Rice (1 kg)",
          "pricing": { "…PriceView…": "" },
          "ordering": { "canOrder": true, "reason": null, "minQuantity": 1, "maxQuantity": 10, "remaining": 37 },
          "isDefault": true, "isSelected": true
        },
        {
          "id": "66f5…", "sku": "RF-00042", "slug": "basmati-rice-5kg",
          "packSize": { "value": 5, "unit": "kg", "label": "5 kg" },
          "displayName": "Basmati Rice (5 kg)",
          "pricing": { "…PriceView…": "" },
          "ordering": { "canOrder": false, "reason": "sold_out", "minQuantity": 1, "maxQuantity": 0, "remaining": 0 },
          "isDefault": false, "isSelected": false
        }
      ],
      "variantCount": 2
    }
  ],
  "page": 1,
  "limit": 24,
  "total": 57,
  "totalPages": 3
}
```

- `id` is the product; `variantId`, `sku`, `slug`, `displayName`, `packSize`, `pricing` and `ordering` belong to the pack size the entry shows (the one with `isSelected: true` in `variants`). `name` is the product name without the size; `displayName` is the title of the card.
- `isAvailable` is the admin's switch for the whole product; `ordering` combines it with the size's own switch and stock. Use `ordering` for the button, not `isAvailable`.
- `quantity` is the product's own limit per order, the same for every size (`max` may be `null`); `ordering.maxQuantity` is that limit capped by the size's stock.
- `variants` holds every enabled size, smallest first, the shown one included, each with its own `ordering` (section 7.1). Use it for the size chooser: each entry has its own `slug` for the product page and its own `id` for the cart. `variantCount` is its length. Images, texts, `quantity` and `storageType` are the product's and apply to every size.
- `storageType` ∈ `ambient`, `chilled`, `frozen`. `category` and `image` can be `null`.
- Drafts, archived products and products in hidden categories are never returned.

**Possible Errors:**

- `404 CATEGORY_NOT_FOUND` – `category` slug unknown or hidden.
- `400 VALIDATION_FAILED` – e.g. `q` shorter than 2 characters, unknown query parameter, `packSize` not in the form `1kg`.

### `GET /v1/store/products/facets`

**Purpose:** The counts behind the filter panel: how many products each brand, label, storage type, pack size, price band, offer and ordering state has under the current filters. Exact at any size of the catalogue, and one request instead of one per filter value.

**Authentication:** none.

**Parameters:** the same as `GET /v1/store/products`. `page`, `limit` and `sort` are accepted and ignored.

**Counting rule:** each facet is counted **without its own filter and with all the others**. With `brand=Amul` chosen, `brands` still lists Tata with the number of products that choosing Tata too would add (the values of one facet are "any of"), while `tags`, `packSizes` and the price facets count only among Amul's products. `total` is the number of products with every filter applied, the `total` of the list. A product with several pack sizes counts once, except in `packSizes`, where each of its enabled sizes counts.

**Success Response (200):**

```json
{
  "total": 57,
  "brands": [ { "value": "Amul", "count": 12 }, { "value": "India Gate", "count": 8 } ],
  "tags": [ { "value": "vegan", "count": 20 }, { "value": "new", "count": 6 } ],
  "storageTypes": [ { "value": "ambient", "count": 50 }, { "value": "frozen", "count": 7 } ],
  "packSizes": [
    { "value": "200g", "packSize": { "value": 200, "unit": "g", "label": "200 g" }, "count": 9 },
    { "value": "1kg", "packSize": { "value": 1, "unit": "kg", "label": "1 kg" }, "count": 30 }
  ],
  "priceBands": [
    { "min": 0, "max": 199, "count": 4 },
    { "min": 200, "max": 499, "count": 21 },
    { "min": 500, "max": 999, "count": 17 },
    { "min": 1000, "max": 1999, "count": 10 },
    { "min": 2000, "max": 4999, "count": 4 },
    { "min": 5000, "max": null, "count": 1 }
  ],
  "price": { "min": 149, "max": 7999 },
  "onSale": [ { "value": true, "count": 5 }, { "value": false, "count": 52 } ],
  "orderable": [ { "value": true, "count": 30 }, { "value": false, "count": 27 } ]
}
```

- `brands`, `tags`, `storageTypes` and `packSizes` list only values with at least one product, most products first (`packSizes` by unit and size). The values go straight into the `brand`, `tag`, `storageType` and `packSize` parameters; `packSizes[].packSize.label` is the localized text to show.
- `priceBands` are fixed bands in cents, `min` and `max` inclusive; `max` is `null` for the last band. Pass a band as `minPrice` and `maxPrice`. Both use the price of each product's default size, like the `minPrice`/`maxPrice` filter. `price` is the cheapest and the dearest default size under the other filters, for a slider, or `null` without products.
- `onSale` and `orderable` always contain both values and count by the same rules as the filters: `onSale` when any enabled size is reduced, `orderable` when the product is switched on and any enabled size has the stock for the smallest order.

**Possible Errors:** as for the list.

### `GET /v1/store/products/{slug}`

**Purpose:** The product page, opened on one pack size.

**Authentication:** none.

**Parameters:**

| Field | Location | Type | Required | Description |
| ----- | -------- | ---- | -------- | ----------- |
| `slug` | path | string | yes | The URL of a pack size (`basmati-rice-1kg`: selects that size) or the base slug of the product (`basmati-rice`: selects the default size), in either language. The requested language is tried first, then the other one, so a link still works after the language switch. The URL of a disabled size answers 404. |
| `locale` | query | `en` \| `de` | no | |

**Success Response (200):** everything of the list entry, shown as the selected size (`isSelected: true` on it in `variants`), plus:

```json
{
  "product": {
    "…all list-entry fields…": "",
    "slugs": { "en": "basmati-rice-1kg", "de": "basmati-reis-1kg" },
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
    "seo": { "title": "Basmati Rice (1 kg)", "description": "Aged long-grain rice" },
    "publishedAt": "2026-09-01T08:00:00.000Z",
    "updatedAt": "2026-09-20T09:30:00.000Z"
  }
}
```

- `slugs` is the URL of the selected size in both languages, for the language switch and `hreflang`. `gtin` is the selected size's and may be `null`.
- Switching sizes on the page needs no request: every enabled size is in `variants` with its `slug`, `pricing` and `ordering`. Render the chosen size from the same answer and set the URL to its `slug` with the history API.
- `seo.title` defaults to `displayName`, `seo.description` to `shortDescription`. `food.*` texts are free text as the admin typed them (may be `null`). `images` come main image first. `description`, `highlights`, `uses`, `images`, `food` and `breadcrumbs` are the product's and apply to every size.

**Possible Errors:**

- `404 PRODUCT_NOT_FOUND` – unknown slug, product not active or in a hidden category, or the URL of a disabled pack size.
- `404 NOT_FOUND` – malformed slug.

---

## 8. Cart

The cart is stored on the server for signed-in customers. Visitors can price a cart without an account (`preview`) and hand it over after signing in (`merge`). Every cart endpoint answers with the same **bill** object. Prices come from the catalogue, never from the browser. The cart is kept through checkout and emptied when the payment is captured.

A cart line is a **pack size**: lines are keyed by `variantId` (the `id` of an entry of `variants` in the catalogue), and two sizes of one product are two lines. A guest cart in the browser stores `variantId` and `quantity` per line.

### 8.1 The bill (response of every cart endpoint)

```json
{
  "canOrder": true,
  "lines": [
    {
      "variantId": "66f4a0c1e4b0f1a2b3c4d5e7",
      "productId": "66e9f0a1b2c3d4e5f6a7b8c9",
      "quantity": 2,
      "unitPrice": 399,
      "lineTotal": 798,
      "vatRate": 700,
      "vatAmount": 52,
      "issue": null,
      "ordering": { "canOrder": true, "reason": null, "minQuantity": 1, "maxQuantity": 5, "remaining": 5 },
      "product": { "…product list entry (section 7), this size selected…": "" }
    },
    {
      "variantId": "66f6a0c1e4b0f1a2b3c4d5e9",
      "productId": "66e9f0a1b2c3d4e5f6a7b8ca",
      "quantity": 1,
      "unitPrice": 999,
      "lineTotal": 999,
      "vatRate": 700,
      "vatAmount": 65,
      "issue": null,
      "ordering": { "canOrder": true, "reason": null, "minQuantity": 1, "maxQuantity": 10, "remaining": 10 },
      "product": { "…": "", "pricing": { "price": 999, "regularPrice": 1299, "onSale": true, "…": "" } }
    }
  ],
  "totals": {
    "currency": "EUR",
    "subtotal": 1797,
    "deliveryFee": 499,
    "total": 2296,
    "netTotal": 2146,
    "vatTotal": 150,
    "vat": [ { "vatRate": 700, "vatPercent": 7, "gross": 2296, "net": 2146, "vat": 150 } ]
  },
  "delivery": { "fee": 499, "freeFrom": 5000, "missingForFree": 3203 }
}
```

A line whose pack size left the shop, and the bill of goods at two VAT rates:

```json
{
  "lines": [
    { "variantId": "66f7…", "productId": null, "quantity": 1, "unitPrice": 0, "lineTotal": 0, "vatRate": 0, "vatAmount": 0, "issue": "product_not_found", "ordering": null, "product": null },
    { "variantId": "66f4…", "productId": "66e9…", "quantity": 2, "unitPrice": 399, "lineTotal": 798, "vatRate": 700, "vatAmount": 52, "issue": null, "ordering": { "…": "" }, "product": { "…": "" } },
    { "variantId": "66f8…", "productId": "66ea…", "quantity": 1, "unitPrice": 299, "lineTotal": 299, "vatRate": 1900, "vatAmount": 48, "issue": null, "ordering": { "…": "" }, "product": { "…": "" } }
  ],
  "totals": {
    "currency": "EUR", "subtotal": 1097, "deliveryFee": 499, "total": 1596, "netTotal": 1451, "vatTotal": 145,
    "vat": [
      { "vatRate": 700, "vatPercent": 7, "gross": 1171, "net": 1094, "vat": 77 },
      { "vatRate": 1900, "vatPercent": 19, "gross": 425, "net": 357, "vat": 68 }
    ]
  }
}
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `canOrder` | boolean | `true` only when the cart is not empty and **every** line is free of issues. This is the checkout button state. |
| `lines[].variantId` | ObjectId string | The pack size of the line, as sent. |
| `lines[].productId` | ObjectId string or `null` | Its product; `null` when the pack size is not in the shop. |
| `lines[].issue` | `null` or one of `product_not_found`, `quantity_below_minimum`, `quantity_above_maximum`, `product_unavailable`, `sold_out` | Why this line cannot be ordered as it is. Show it on the line. `product_not_found`: the pack size or its product is gone, or the product is no longer active. `product_unavailable`: the product or this size was switched off. `quantity_above_maximum` also means "more than in stock" (`ordering.maxQuantity` is capped by the stock). |
| `lines[].ordering` | Ordering block or `null` | Of this pack size. `null` when the line is `product_not_found`. Inside `lines[].product` the `ordering` fields (on the entry and in its `variants`) are always `null`; use the line-level one. |
| `lines[].product` | product entry or `null` | The product list entry (section 7) with this pack size selected: its `displayName`, `packSize`, `pricing` and `image` are the line's. `null` when the line is `product_not_found` (then `unitPrice`, `lineTotal`, `vatRate`, `vatAmount` are `0`). |
| `totals` | object | Computed over issue-free lines only. `vat[]` is grouped by rate; the delivery fee is shared across the rates in proportion to the net value of the goods. An empty bill has `deliveryFee: 0` and `vat: []`. |
| `delivery.freeFrom` | int cents or `null` | Goods value from which delivery is free. `missingForFree` = what is still missing (`0` when reached; `null` when there is no free tier). |

### `POST /v1/store/cart/preview`

**Purpose:** Price a cart kept in the browser (visitor not signed in). Nothing is stored.

**Authentication:** none. Rate limit 60 requests per minute per IP.

**Parameters:** `locale` (query, optional).

**Request Body:**

```json
{ "items": [ { "variantId": "66f4a0c1e4b0f1a2b3c4d5e7", "quantity": 2 } ] }
```

| Field | Type | Required | Validation |
| ----- | ---- | -------- | ---------- |
| `items` | array | yes | 1–100 entries, no duplicate `variantId`. |
| `items[].variantId` | ObjectId string | yes | A pack size (`variants[].id` of a product). |
| `items[].quantity` | int | yes | 1–10000 |

**Success Response (200):** the bill.

**Possible Errors:** `400 VALIDATION_FAILED`, `429 RATE_LIMITED`.

### `GET /v1/store/cart`

**Purpose:** The stored cart of the signed-in customer, as a bill.

**Authentication:** customer session.

**Parameters:** `locale` (query, optional).

**Success Response (200):** the bill (with `lines: []` when empty).

### `POST /v1/store/cart/merge`

**Purpose:** After signing in, hand over the cart the visitor filled before. For a pack size in both carts the larger quantity wins. Unknown or disabled pack sizes and sizes of inactive products are dropped silently. Sending the same cart twice changes nothing.

**Authentication:** customer session.

**Request Body:** same as `preview`.

**Success Response (200):** the bill.

**Possible Errors:** `400 CART_FULL` (`details: { maximum: 100 }`), `400 VALIDATION_FAILED`.

### `PUT /v1/store/cart/items/{variantId}`

**Purpose:** Set the quantity of a pack size (adds it when missing). A quantity the size cannot be ordered in is kept and reported as the line's `issue`.

**Authentication:** customer session.

**Parameters:** `variantId` (path, ObjectId: `variants[].id` of a product), `locale` (query, optional).

**Request Body:**

```json
{ "quantity": 2 }
```

`quantity`: int 0–10000; `0` removes the pack size.

**Success Response (200):** the bill.

**Possible Errors:**

- `404 CART_PRODUCT_NOT_FOUND` – no such pack size, the size is disabled, or its product is not active (only when `quantity > 0`).
- `400 CART_FULL` – the cart already has 100 lines (`details: { maximum: 100 }`).
- `400 VALIDATION_FAILED`.

### `DELETE /v1/store/cart/items/{variantId}`

**Purpose:** Remove a pack size. Never fails when it is not in the cart.

**Authentication:** customer session. **Success Response (200):** the bill.

### `DELETE /v1/store/cart`

**Purpose:** Empty the cart.

**Authentication:** customer session. **Success Response (200):** the bill (empty).

---

## 9. Orders and checkout

An order is made from the **server-stored cart** at `POST /v1/store/checkout` and is paid at once on Stripe's payment page. It exists from that moment with status `pending_payment`; the payment confirms it. Nothing is reserved until the payment goes through, and the cart is kept until then. The items of an order cannot be changed afterwards: cancel and order again.

### 9.1 Order statuses

| `status` | Meaning for the customer |
| --- | --- |
| `pending_payment` | Waiting for the payment. The customer can pay (section 10) or give the order up. Nothing is reserved. |
| `confirmed` | Paid. Radhe Foods has the order; the invoice is issued. |
| `processing` | Radhe Foods is preparing it. |
| `dispatched` | On its way (carrier and tracking in `delivery`). |
| `delivered` | Delivered. Returns are possible within the return window. |
| `cancelled` | Cancelled by the customer, by Radhe Foods, or by the API (see `cancellation`). |
| `returned` | Everything was returned after delivery. |

| `paymentStatus` | Meaning |
| --- | --- |
| `pending` | Not paid yet. A payment page may be open (`payment.checkout`). |
| `authorized` | The bank approved the amount; the API is taking the stock and capturing the money. Lasts moments. |
| `paid` | Captured. |
| `failed` | The last attempt did not go through (declined, amount mismatch, or sold out before capture). The customer can open a new page while the order is `pending_payment`. |
| `refunded` | Everything that was paid went back. |

### 9.2 Order objects

**Order summary** (list entries):

```json
{
  "orderNumber": "RF-1001",
  "status": "dispatched",
  "paymentStatus": "paid",
  "placedAt": "2026-10-16T10:15:00.000Z",
  "total": 2296,
  "finalTotal": 2296,
  "currency": "EUR",
  "itemCount": 3,
  "preview": [
    { "name": "Bhakhri Atta", "imageUrl": "https://cdn…/small.webp" },
    { "name": "Cow Ghee", "imageUrl": null }
  ],
  "delivery": {
    "method": "dhl",
    "trackingNumber": "JD0001234567",
    "trackingUrl": "https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=JD0001234567&lang=en",
    "dispatchedAt": "2026-10-18T08:00:00.000Z",
    "deliveredAt": null
  }
}
```

- `placedAt` is when the checkout started. `total` is the agreed bill; `finalTotal` the bill after corrections and returns.
- `preview` holds the first three items (`imageUrl` may be `null`). `itemCount` = sum of quantities.
- `delivery.method` ∈ `radhe_delivery`, `dhl`, `hermes`, chosen by Radhe Foods (never by the customer). `trackingNumber`/`trackingUrl` are `null` until set; `trackingUrl` is `null` for `radhe_delivery`. `dispatchedAt` and `deliveredAt` are set when the order reaches that status. There is no promised date: show `delivery.estimate` from `GET /v1/store/settings`.

**Order detail** (`GET /v1/store/orders/{orderNumber}`, and the `order` of checkout and cancel) = summary plus:

```json
{
  "language": "en",
  "items": [
    {
      "productId": "66e9f0a1b2c3d4e5f6a7b8c9",
      "variantId": "66f4a0c1e4b0f1a2b3c4d5e7",
      "sku": "RF-00042",
      "name": "Bhakhri Atta",
      "displayName": "Bhakhri Atta (1 kg)",
      "packSize": { "value": 1, "unit": "kg", "label": "1 kg" },
      "imageUrl": "https://cdn…/small.webp",
      "quantity": 2,
      "unitPrice": 399,
      "regularUnitPrice": null,
      "lineTotal": 798,
      "vatRate": 700,
      "vatPercent": 7,
      "vatAmount": 52,
      "deliveredQuantity": 2,
      "returnedQuantity": 0,
      "finalLineTotal": 798
    },
    {
      "productId": "66e9f0a1b2c3d4e5f6a7b8ca",
      "variantId": "66f6a0c1e4b0f1a2b3c4d5e9",
      "sku": "RF-00043",
      "name": "Cow Ghee",
      "displayName": "Cow Ghee (500 ml)",
      "packSize": { "value": 500, "unit": "ml", "label": "500 ml" },
      "imageUrl": null,
      "quantity": 1,
      "unitPrice": 999,
      "regularUnitPrice": 1299,
      "lineTotal": 999,
      "vatRate": 700,
      "vatPercent": 7,
      "vatAmount": 65,
      "deliveredQuantity": 1,
      "returnedQuantity": 0,
      "finalLineTotal": 999
    }
  ],
  "totals": { "currency": "EUR", "subtotal": 1797, "deliveryFee": 499, "total": 2296, "netTotal": 2146, "vatTotal": 150, "vat": [ { "vatRate": 700, "gross": 2296, "net": 2146, "vat": 150 } ] },
  "finalTotals": { "…same shape as totals…": "" },
  "adjustments": [
    { "productId": "66e9…", "variantId": "66f4…", "sku": "RF-00042", "from": 2, "to": 1, "reason": "missing", "at": "2026-10-20T09:00:00.000Z" }
  ],
  "deliveryAddress": {
    "firstName": "Anna", "lastName": "Schmidt", "company": "…", "street": "Hauptstraße", "houseNumber": "12a",
    "additionalLine": "2. OG", "postalCode": "60311", "city": "Frankfurt am Main", "countryCode": "DE", "phone": "+4915112345678"
  },
  "note": "Please ring twice.",
  "payment": { "…payment block, section 10.1…": "" },
  "canCancel": true,
  "returns": { "possible": false, "until": null },
  "cancellation": null,
  "acceptedTerms": {
    "at": "2026-10-16T10:15:00.000Z",
    "documents": [ { "type": "terms", "version": 3 }, { "type": "privacy", "version": 2 } ]
  }
}
```

- Everything the customer saw at checkout is copied into the order: later changes of prices or addresses do not touch it.
- An item is one pack size: `variantId` names it (the key for returns, section 12), `name` is the product name, `displayName` the name with the size, `packSize` the size as ordered. `adjustments[]` name the item by `productId`, `variantId` and `sku`.
- `regularUnitPrice` is the crossed-out price or `null`. `finalLineTotal = (deliveredQuantity − returnedQuantity) × unitPrice`. `totals.vat[]` has no `vatPercent` (derive it: `vatRate / 100`).
- `adjustments[].reason` ∈ `missing`, `damaged`, `wrong_item`, `customer_complaint`, `other` (corrections of delivered quantities made by Radhe Foods). A correction lowers `finalTotals`, produces a credit note (section 11) and the difference is refunded by Radhe Foods.
- `deliveryAddress`: `company`, `additionalLine`, `phone` are **absent** when they were not set.
- `canCancel`: whether `POST …/cancel` is allowed right now: always while `pending_payment`; for a paid order by the rule of the shop (section 9.5).
- `returns.until`: end of the return window (delivery + `returns.windowDays`, ISO) or `null` when not delivered or returns are switched off; `returns.possible` is `true` while the window is open and something can still be sent back.
- `cancellation`: `null` or `{ "reason": "changed_mind", "text": "…", "by": "customer" | "admin" | "system", "at": "…" }`. `text` is only shown when `by` is `customer`. Reasons by `by`: see section 13.

### `POST /v1/store/checkout`

**Purpose:** Turn the stored cart into an order that waits for its payment, and get the address of the Stripe payment page (card or PayPal). Redirect the browser to `checkout.url`.

**Authentication:** customer session. Rate limit 20 per minute.

**Headers:**

| Header | Required | Description |
| ------ | -------- | ----------- |
| `Idempotency-Key` | yes | 8–64 characters `[A-Za-z0-9_-]` (a UUID works). Generate it when the customer reaches the last step of checkout and **reuse it on retries**. The same key sent again answers the first order (HTTP 200, `created: false`) with its payment page instead of creating a second order. Keys count per customer. |

**Parameters:** `locale` (query, optional; language of the `order` in the answer).

**Request Body:**

```json
{
  "addressId": "66e1a2b3c4d5e6f7a8b9c0d1",
  "expectedTotal": 2296,
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
| `expectedTotal` | int cents | yes | 1–1 000 000 000. `totals.total` of the bill the customer saw. If the bill changed since (prices, fee, cart), the checkout is refused with the new bill. |
| `consent.accepted` | boolean | yes | Must be `true`. |
| `consent.versions` | object | yes | `{ terms?: int ≥1, privacy?: int ≥1 }` – the versions from `GET /v1/store/legal`. Both must be the versions that apply now. |
| `note` | string | no | ≤500 characters, for Radhe Foods. |
| `language` | `en` \| `de` | no | Language of the order and its emails. Defaults to the account language. |

**What happens:** the cart is priced again and every line is checked against the stock (without reserving anything); the order is created as `pending_payment` with `payment.amount` = the total; a Stripe Checkout Session is created on which the bank only **approves** the amount (nothing is taken yet). The page stays open for the time set by Radhe Foods (`checkoutMinutes`, 60 by default): `checkout.expiresAt`. The API records the IP address and user agent of the request with the consent.

**Success Response:** `201` when created, `200` when the idempotency key was seen before.

```json
{
  "created": true,
  "order": { "…order detail, status pending_payment…": "" },
  "checkout": { "url": "https://checkout.stripe.com/c/pay/cs_…", "expiresAt": "2026-10-16T11:15:00.000Z" }
}
```

`order.payment.checkout` carries the same page. When the key is sent again: the same page while it is open (more than five minutes left), otherwise a new page for the same order; if the first order can no longer be paid (paid, or cancelled), `409 ORDER_NOT_PAYABLE`.

**Possible Errors (in the order they are checked):**

- `400 VALIDATION_FAILED`.
- `400 IDEMPOTENCY_KEY_REQUIRED` – header missing or malformed.
- `503 PAYMENTS_NOT_CONFIGURED` – online payment is not set up on the server (section 14). The shop cannot sell until it is.
- `409 COMPANY_DETAILS_MISSING` – the seller's invoice details are not complete in the admin settings (`details: { missing: [...] }`).
- `403 CUSTOMER_BLOCKED` – the account is blocked.
- `404 ADDRESS_NOT_FOUND`.
- `409 LEGAL_DOCUMENTS_MISSING` – the shop has no published `terms`/`privacy` yet (`details: { missing: [...] }`).
- `409 LEGAL_VERSION_CHANGED` – a text was republished since the page loaded, or a version is missing. `details.current` holds the current versions (`{ terms, privacy }`); reload the texts and ask again.
- `409 CART_EMPTY`.
- `409 ORDER_ITEMS_NOT_ORDERABLE` – `details.lines[]`: `{ productId, variantId, sku, quantity, issue, minQuantity, maxQuantity, remaining }`, one per cart line with an issue (`productId`, `sku`, `minQuantity`, `maxQuantity`, `remaining` are `null` for `product_not_found`). Show the lines and send the customer back to the cart.
- `409 ORDER_TOTAL_CHANGED` – `details: { expectedTotal, total, totals }` (`totals` is the new bill's totals). Show the new total and let the customer confirm again.
- `409 ORDER_NOT_PAYABLE` – the key was sent again for an order that was paid or cancelled meanwhile (`details: { status, paymentStatus }`).
- `502 PAYMENT_PROVIDER_ERROR` – Stripe could not be reached or returned no page; ask to try again.
- `429 RATE_LIMITED`.

### `GET /v1/store/orders`

**Purpose:** Own orders, newest first. Orders that wait for their payment are listed too (`status: "pending_payment"`), as are orders the API gave up because no payment came (`cancelled`).

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

**Parameters:** `orderNumber` (path, `RF-1001`; case-insensitive), `locale` (query, optional).

**Success Response (200):** `{ "order": { …order detail… } }`

**Possible Errors:** `404 ORDER_NOT_FOUND` (malformed number, or not this customer's order).

### `POST /v1/store/orders/{orderNumber}/cancel`

**Purpose:** Cancel an order while `canCancel` is true. An order that is not paid yet can always be given up: its open payment page is closed and nothing is charged. A paid order can be cancelled until the point the shop's rule sets; its units go back to the stock and Radhe Foods refunds what was paid (the customer gets an email when the refund is on its way; `payment.refundedAmount` shows it).

**Authentication:** customer session.

**Parameters:** `orderNumber` (path), `locale` (query, optional).

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

### 9.5 Cancellation rule

Radhe Foods sets until when a paid order can be cancelled by the customer. An unpaid order can always be given up.

| Setting | Customer can cancel while status is |
| --- | --- |
| `never` | `pending_payment` only (otherwise ask Radhe Foods) |
| `while_confirmed` | `pending_payment`, `confirmed` |
| `until_dispatched` (default) | `pending_payment`, `confirmed`, `processing` |

The setting is not exposed to the shop: use `order.canCancel` rather than computing this yourself.

---

## 10. Payments

The customer pays on Stripe's hosted page (card or PayPal) right after checkout. The bank approves the amount on the page; Stripe tells the API through a webhook; the API takes the stock of every item and only then captures the money, issues the invoice, confirms the order and empties the cart. If a product sold out in the meantime, the approval is let go of, nothing is charged, and the order is cancelled with reason `sold_out` (the customer gets an email). The order page can also ask Stripe itself (`GET …/payment`), so the answer is right the moment the customer comes back.

### 10.1 The payment block

Part of every order detail (`order.payment`) and of `GET …/payment`.

While the order waits for its payment:

```json
{
  "status": "pending",
  "amount": 2296,
  "paidAmount": 0,
  "creditedAmount": 0,
  "refundedAmount": 0,
  "method": null,
  "paidAt": null,
  "receiptUrl": null,
  "invoice": null,
  "checkout": { "url": "https://checkout.stripe.com/c/pay/cs_…", "expiresAt": "2026-10-16T11:15:00.000Z" },
  "canPayOnline": true,
  "lastFailure": null
}
```

After the payment:

```json
{
  "status": "paid",
  "amount": 2296,
  "paidAmount": 2296,
  "creditedAmount": 0,
  "refundedAmount": 0,
  "method": "card",
  "paidAt": "2026-10-16T10:17:30.000Z",
  "receiptUrl": "https://pay.stripe.com/receipts/…",
  "invoice": { "number": "INV-2026-000001", "issuedAt": "2026-10-16T10:17:30.000Z", "pdfPath": "/v1/store/invoices/INV-2026-000001/pdf" },
  "checkout": null,
  "canPayOnline": false,
  "lastFailure": null
}
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `status` | payment status (9.1) | |
| `amount` | int cents | The total to pay, agreed at checkout (= `totals.total`). |
| `paidAmount` | int cents | What was captured. |
| `creditedAmount` | int cents | Sum of the credit notes issued after the invoice (corrections, returns). |
| `refundedAmount` | int cents | Sum of the refunds Radhe Foods completed. Partial refunds keep `status: "paid"`. |
| `method` | `card` \| `paypal` \| `null` | The Stripe payment method, once paid. |
| `paidAt` | ISO or `null` | When the money was captured. |
| `receiptUrl` | string or `null` | Stripe receipt. |
| `invoice` | object or `null` | `{ number, issuedAt, pdfPath }` once paid. `pdfPath` is relative to the API base URL (needs the customer's cookies). |
| `checkout` | object or `null` | `{ url, expiresAt }` while a payment page is open and not expired. Send the customer there for "Pay now". |
| `canPayOnline` | boolean | `true` while the order is `pending_payment`, the payment is `pending` or `failed` and online payment is set up on the server. Show "Pay now" only when `true`. |
| `lastFailure` | string or `null` | Why the last attempt did not go through, in English for developers (for example `Stripe: the payment failed`). Show a generic message. |

### `GET /v1/store/orders/{orderNumber}/payment`

**Purpose:** The payment block and the documents of an order. Call it when the customer **returns from Stripe** or opens the page of a pending order: while a payment page is open the API asks Stripe how it ended before answering, so a completed payment is settled on the spot and `payment.status` is `paid` even before the webhook arrived. An expired page is forgotten the same way (`checkout` becomes `null`).

**Authentication:** customer session. Rate limit 30 per minute.

**Success Response (200):**

```json
{
  "orderNumber": "RF-1001",
  "status": "confirmed",
  "payment": { "…payment block…": "" },
  "documents": [ { "…invoice summary (section 11)…": "" } ]
}
```

`status` is the order status. `documents` are the invoice and its credit notes, oldest first; empty while the order is not paid.

**Possible Errors:** `404 ORDER_NOT_FOUND`; `502 PAYMENT_PROVIDER_ERROR` (Stripe could not be reached); `429 RATE_LIMITED`.

### `POST /v1/store/orders/{orderNumber}/pay`

**Purpose:** A payment page for an order that still waits: after its page expired, or after an attempt that did not go through. Asking while a page is open (more than five minutes left) answers the same page. Redirect the browser to `url`.

**Authentication:** customer session. Rate limit 10 per minute. No body.

**Success Response (200):**

```json
{ "url": "https://checkout.stripe.com/c/pay/cs_…", "expiresAt": "2026-10-16T12:20:00.000Z" }
```

**Possible Errors:**

- `409 ORDER_NOT_PAYABLE` – `details: { status, paymentStatus }`: the order is paid ("This order is paid."), cancelled, or online payment is not set up on the server (`canPayOnline` is `false` in every one of these cases, so the button should not be shown).
- `502 PAYMENT_PROVIDER_ERROR`, `404 ORDER_NOT_FOUND`, `429 RATE_LIMITED`.

### 10.4 The way back from Stripe

After paying, Stripe sends the browser to `<SHOP_URL>/account/orders/<orderNumber>?payment=success`; when the customer leaves the page without paying, to `<SHOP_URL>/account/orders/<orderNumber>?payment=cancelled`. The page needs the customer signed in (the cookies survive the top-level navigation). On it, call `GET …/payment` and act on the answer:

| Answer | What to show |
| --- | --- |
| `payment.status` is `paid` | The confirmation. `documents[0]` is the invoice; the confirmation email with the PDF is on its way. |
| `?payment=success`, but `status` still `pending` and `checkout` set | The payment method is asynchronous (PayPal can take a moment). Show "we are confirming your payment" and poll `GET …/payment` every few seconds; the webhook settles it. |
| `status` is `pending` and `checkout` is `null` | The page expired or was left. Offer "Pay now" (`POST …/pay`). |
| `status` is `failed` | The attempt did not go through. Say so and offer "Pay now". |
| order `status` is `cancelled` with `cancellation.reason` `sold_out` | A product sold out before the payment was captured; nothing was charged. |

### 10.5 While the order is `pending_payment`

- Show the order as "waiting for payment" with "Pay now" (while `payment.checkout` is set, link to its `url`; otherwise `POST …/pay`) and "Cancel order" (`canCancel` is always `true` while pending; cancelling closes the page, nothing is charged).
- The payment-failed email links to `<SHOP_URL>/account/orders/<orderNumber>?pay=1`: on `?pay=1` the page should open the payment page straight away (`POST …/pay`, then redirect to `url`).
- Nothing is reserved: the products stay available to every customer until the payment is approved, and `ordering.remaining` in the catalogue can go down meanwhile.
- The API gives an unpaid order up some time after its last payment page expired (at least ten minutes later, at the next run of the cleanup job): the order becomes `cancelled` with `cancellation.reason` `payment_not_completed` and `by: "system"`; no email is sent. The customer orders again from the cart, which was kept.

---

## 11. Invoices and credit notes

The invoice (`INV-2026-000001`) is issued the moment the payment is captured, is attached as a PDF to the confirmation email and can be fetched any time. Corrections by Radhe Foods and completed returns produce credit notes (`CN-2026-000001`). Documents never change once issued; numbers run without gaps per type and year. The PDF is rendered on request.

### 11.1 Document objects

**Summary:**

```json
{
  "id": "66f1c0a2b3d4e5f6a7b8c9d1",
  "number": "INV-2026-000001",
  "type": "invoice",
  "orderNumber": "RF-1001",
  "issuedAt": "2026-10-16T10:17:30.000Z",
  "paidAt": "2026-10-16T10:17:30.000Z",
  "total": 2296,
  "currency": "EUR",
  "language": "en",
  "invoiceNumber": null,
  "creditReason": null
}
```

`type` ∈ `invoice`, `credit_note`. An invoice is paid when it is issued, so `paidAt` is set. For a credit note `paidAt` is `null`, `invoiceNumber` names the invoice it corrects, `creditReason` is `return` or `adjustment`, and `total` is the amount credited.

**Detail** = summary plus:

```json
{
  "orderId": "66f1…", "customerId": "66f1…",
  "creditReference": null,
  "seller": { "name": "Radhe Foods GmbH", "addressLines": ["Hauptstraße 1", "60311 Frankfurt am Main"], "email": "billing@radhefoods.de", "phone": "+49 69 1234567", "website": null, "vatId": "DE123456789", "taxNumber": null, "registration": null },
  "customer": { "name": "Anna Schmidt", "company": null, "addressLines": ["Hauptstraße 12a", "60311 Frankfurt am Main", "Deutschland"], "email": "anna@example.com" },
  "lines": [
    { "description": "Bhakhri Atta, 1 kg", "sku": "RF-00042", "quantity": 2, "unitPrice": 399, "vatRate": 700, "vatPercent": 7, "lineTotal": 798 },
    { "description": "Cow Ghee, 500 ml", "sku": "RF-00043", "quantity": 1, "unitPrice": 999, "vatRate": 700, "vatPercent": 7, "lineTotal": 999 }
  ],
  "totals": { "currency": "EUR", "subtotal": 1797, "deliveryFee": 499, "total": 2296, "netTotal": 2146, "vatTotal": 150, "vat": [ { "vatRate": 700, "gross": 2296, "net": 2146, "vat": 150 } ] },
  "footer": null
}
```

- `lines` are the goods, in the language of the order; the delivery fee is in `totals.deliveryFee`. A credit note lists what is credited; when a whole order is credited, the delivery fee appears as a line of its own (`Delivery` / `Lieferung`).
- `creditReference`: for a credit note, what it is for: the return number (`RF-1001-R1`) or the corrected product with the reason (`RF-00042: missing`). `null` on invoices.
- `footer` is free text from the company settings, or `null`.

### `GET /v1/store/invoices`

**Purpose:** Own invoices and credit notes, newest first.

**Authentication:** customer session.

**Parameters:**

| Field | Location | Type | Required | Description |
| ----- | -------- | ---- | -------- | ----------- |
| `orderNumber` | query | `RF-1001` | no | Only the documents of one order. |
| `limit` | query | int 1–100 | no | Default 25. |
| `cursor` | query | ObjectId string | no | |

**Success Response (200):** `{ "items": [ …summaries… ], "nextCursor": null }`

### `GET /v1/store/invoices/{number}`

**Purpose:** One document with every line.

**Authentication:** customer session.

**Parameters:** `number` (path, `INV-2026-000001` or `CN-2026-000001`; case-insensitive).

**Success Response (200):** `{ "invoice": { …detail… } }`

**Possible Errors:** `404 INVOICE_NOT_FOUND`.

### `GET /v1/store/invoices/{number}/pdf`

**Purpose:** The PDF.

**Authentication:** customer session (send the cookies; open it with `fetch` + `credentials: 'include'` and a Blob URL, or as a direct link on the same site domain).

**Success Response (200):** binary body, `Content-Type: application/pdf`, `Content-Disposition: inline; filename="INV-2026-000001.pdf"`, `Cache-Control: private, no-store`.

**Possible Errors:** `404 INVOICE_NOT_FOUND`.

---

## 12. Returns

After delivery, within the return window, a customer can ask to send single items back. An item is a pack size of the order, named by its `variantId`. Radhe Foods decides; once the goods are back the bill goes down (credit note) and Radhe Foods refunds the difference.

### 12.1 Return statuses and reasons

| `status` | Meaning |
| --- | --- |
| `requested` | Waiting for Radhe Foods. The customer can still cancel. |
| `approved` | Accepted (possibly with fewer units: see `approvedQuantity`). Goods not back yet. |
| `rejected` | Declined; `answer` says why. Possible after approval too. |
| `completed` | Goods are back; `creditAmount` was taken off the bill. The refund follows. |
| `cancelled` | Withdrawn by the customer. |

Reasons: `damaged`, `wrong_item`, `quality`, `not_as_described`, `changed_mind`, `other`.

### 12.2 Return object

```json
{
  "returnNumber": "RF-1001-R1",
  "orderNumber": "RF-1001",
  "status": "requested",
  "requestedAt": "2026-10-26T12:00:00.000Z",
  "decidedAt": null,
  "completedAt": null,
  "items": [
    {
      "productId": "66e9…", "variantId": "66f4…", "sku": "RF-00042", "name": "Bhakhri Atta",
      "packSize": { "value": 1, "unit": "kg", "label": "1 kg" },
      "quantity": 1, "approvedQuantity": null, "unitPrice": 399,
      "reason": "damaged", "comment": "Bag was torn"
    }
  ],
  "comment": "Please collect on Monday.",
  "answer": null,
  "creditAmount": null,
  "canCancel": true
}
```

`answer` is what Radhe Foods wrote with the decision (or `null`). `creditAmount` is set when completed: the cents the final bill went down by (the credit note); when everything of an order comes back, the delivery fee is credited too.

### `GET /v1/store/orders/{orderNumber}/returns`

**Purpose:** The returns of an order (newest first) and what can still be sent back.

**Authentication:** customer session.

**Parameters:** `orderNumber` (path), `locale` (query, optional).

**Success Response (200):**

```json
{
  "items": [ { "…return…": "" } ],
  "returnable": [ { "productId": "66e9…", "variantId": "66f4…", "sku": "RF-00042", "available": 1 } ]
}
```

`returnable` has one row per order item (pack size); `available` = delivered − returned − units in open requests (can be `0`). Send `variantId` in the request below.

**Possible Errors:** `404 ORDER_NOT_FOUND`.

### `POST /v1/store/orders/{orderNumber}/returns`

**Purpose:** Ask to send items back. Only for a delivered order while `order.returns.possible` is true.

**Authentication:** customer session. Rate limit 10 per minute.

**Request Body:**

```json
{
  "items": [ { "variantId": "66f4…", "quantity": 1, "reason": "damaged", "comment": "Bag was torn" } ],
  "comment": "Please collect on Monday.",
  "locale": "en"
}
```

| Field | Type | Required | Validation |
| ----- | ---- | -------- | ---------- |
| `items` | array | yes | 1–100, unique `variantId`. |
| `items[].variantId` | ObjectId string | yes | The `variantId` of an item of the order. |
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
- `400 ORDER_ITEM_NOT_FOUND` – the order has no item with this `variantId`: `details: { variantId }`.
- `409 RETURN_QUANTITY_INVALID` – more than available: `details: { variantId, sku, available }`.
- `409 CONFLICT` – two requests for the same order arrived at the same moment; try again.
- `400 VALIDATION_FAILED`, `429 RATE_LIMITED`.

### `GET /v1/store/returns/{returnNumber}`

**Purpose:** One return. `returnNumber` like `RF-1001-R1` (case-insensitive).

**Authentication:** customer session. **Parameters:** `locale` (query, optional). **Success Response (200):** `{ "return": { … } }`. **Possible Errors:** `404 RETURN_NOT_FOUND`.

### `POST /v1/store/returns/{returnNumber}/cancel`

**Purpose:** Take the request back while it is `requested`.

**Authentication:** customer session. No body. **Parameters:** `locale` (query, optional).

**Success Response (200):** `{ "return": { …, "status": "cancelled" } }` (already cancelled → 200 unchanged).

**Possible Errors:** `404 RETURN_NOT_FOUND`; `409 RETURN_TRANSITION_NOT_ALLOWED` (`details: { from, to: "cancelled" }`) once Radhe Foods has decided.

---

## 13. Status reference

### Order status (`order.status`)

`pending_payment` → (payment captured) `confirmed` → `processing` → `dispatched` → `delivered`; `returned` when everything was returned after delivery; `cancelled` from `pending_payment` (customer, Radhe Foods, or the API), from `confirmed`/`processing` (customer by the rule, or Radhe Foods) and from `dispatched` (Radhe Foods). An order is never confirmed by hand: the payment confirms it. Radhe Foods can step one status back to correct a mistake, so a status can move backwards once in a while.

### Payment status (`order.paymentStatus`, `payment.status`)

`pending` → `authorized` → `paid`; `pending`/`authorized` → `failed` → `pending` (a new page was opened); `paid` → `refunded` (everything paid went back; partial refunds keep `paid` with `refundedAmount > 0`).

### Return status

`requested` → `approved` → `completed`; `requested`/`approved` → `rejected`; `requested` → `cancelled` (by the customer).

### Cart line issue / ordering reason

`product_unavailable` (the product or the pack size is switched off), `sold_out` (the stock of the pack size does not cover the smallest order), both from the ordering rule and per pack size; plus cart-only `product_not_found` (the pack size or its product is gone, or the product is not active), `quantity_below_minimum`, `quantity_above_maximum`.

### Delivery methods

`radhe_delivery` (Radhe Foods' own driver, no tracking), `dhl`, `hermes` (tracking link available). Chosen by Radhe Foods, never by the customer.

### Cancellation reasons

- By the customer (`by: "customer"`, the only ones the shop sends): `changed_mind`, `ordered_by_mistake`, `wrong_items`, `delivery_too_late`, `other`.
- By Radhe Foods (`by: "admin"`): `customer_request`, `product_unavailable`, `duplicate_order`, `suspected_misuse`, `other`.
- By the API (`by: "system"`): `payment_not_completed` (no payment came), `sold_out` (a product sold out before the payment was captured).

### Adjustment reasons (`adjustments[].reason`)

`missing`, `damaged`, `wrong_item`, `customer_complaint`, `other`.

### Return reasons

`damaged`, `wrong_item`, `quality`, `not_as_described`, `changed_mind`, `other`.

### Credit note reasons (`creditReason`)

`return`, `adjustment`.

---

## 14. What depends on the server configuration

| Feature | How it shows | What the shop should do |
| ------- | ------------ | ----------------------- |
| Online payment (Stripe Checkout: card, PayPal) | Needs the Stripe keys on the server. Without them `POST /v1/store/checkout` answers `503 PAYMENTS_NOT_CONFIGURED`, `payment.canPayOnline` is `false` and `POST …/pay` answers `409 ORDER_NOT_PAYABLE`. There is no other way to pay. | Show "checkout is not available right now" on the 503; show "Pay now" only when `canPayOnline` is `true`. |
| Seller details and legal texts | Set by Radhe Foods in the admin panel. Until then checkout answers `409 COMPANY_DETAILS_MISSING` or `409 LEGAL_DOCUMENTS_MISSING`. | Show "ordering is not possible yet". |
| Emails | Sent by the API through the configured provider (log in development, Amazon SES or SMTP in production). | Nothing to do; email content is the API's. |
| WhatsApp messages | Only the dispatch message and announcements go by WhatsApp, and only with the WhatsApp Business credentials on the server; without them those messages are recorded as skipped. The preference (`whatsappOptIn`) can be stored in any case. | Offer the WhatsApp opt-in; explain that messages come by WhatsApp "as soon as the service is available", or hide the toggle until Radhe Foods confirms. |
| Google sign-in | Needs the Google client id on the server (`503 GOOGLE_NOT_CONFIGURED` until then). | Hide the button on that error. |

---

## 15. Integration checklist

1. `fetch` with `credentials: 'include'`; shop origin in `CORS_ORIGINS`; handle `401` → refresh once → sign-in.
2. Pass `?locale=` on every store call (or rely on `Accept-Language`).
3. Layout: `GET /v1/store/settings` for the delivery-fee hint, the delivery estimate and the return window; `GET /v1/store/categories` for navigation.
4. Catalogue: one list entry per product, shown as one pack size (`displayName` as the title, `pricing.basePrice` next to every price); product pages by the URL of a pack size or the base slug (either language); `variants` for the size chooser (switch from the same answer and set the URL to the chosen `slug` with the history API); `ordering` per size for the "add to cart" state (`canOrder`, `reason`, `minQuantity`, `maxQuantity`, `remaining`); `orderable=true` and the facets for an "in stock" filter.
5. Cart by pack size: `variants[].id` is the `variantId` of `PUT /v1/store/cart/items/{variantId}` and of the `items` of `preview` and `merge`. Guest cart in local storage (`variantId`, `quantity`) → `POST /v1/store/cart/preview` for prices; after sign-in `POST /v1/store/cart/merge`, then the server cart. Show `lines[].issue` per line; the checkout button is `canOrder`.
6. Checkout page: `GET /v1/store/me/addresses` (address chooser), `GET /v1/store/legal` (consent versions and links), `GET /v1/store/cart` (`canOrder`, `totals.total` → `expectedTotal`), then `POST /v1/store/checkout` with an `Idempotency-Key` and redirect to `checkout.url`; handle `ORDER_TOTAL_CHANGED`, `ORDER_ITEMS_NOT_ORDERABLE`, `LEGAL_VERSION_CHANGED`, `CART_EMPTY`, `PAYMENTS_NOT_CONFIGURED`.
7. The way back from Stripe: `/account/orders/<orderNumber>?payment=success|cancelled` (sign-in required) → `GET …/payment`; poll while a page is still open after `?payment=success`; "Pay now" → `POST …/pay` → redirect.
8. Order page while `pending_payment`: "Pay now" when `canPayOnline` (the open `payment.checkout.url`, else `POST …/pay`), "Cancel order" (`canCancel`); `?pay=1` from the payment-failed email opens the payment page at once.
9. Account: orders list/detail (status, `delivery` with the tracking link, items with `displayName`, `adjustments`, `finalTotal`), cancel when `canCancel`; the `payment` block with `invoice.pdfPath`; invoices and PDFs; returns within `returns.until`, requested by the item's `variantId`.
10. Pages without sign-in: `/unsubscribe/<token>` (link in marketing emails); announcement emails also link to `/products/<slug>` (English slug) and the shop root.
11. Emails the API sends, all linking to `/account/orders/<orderNumber>`: order confirmed (with the invoice PDF), cancelled, dispatched (tracking), delivered (return window), payment failed (`?pay=1`), refund completed, return requested / approved / rejected / completed. Announcements go to customers with `marketingOptIn`.
12. Show `x-request-id` (or include it in support emails) when an unexpected error occurs.
