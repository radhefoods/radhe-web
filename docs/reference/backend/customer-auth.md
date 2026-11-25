# Customer authentication: email and password

For the Customer Web agent. This is the complete contract of the customer sign-up, sign-in and password recovery of the Radhe Foods API as of 2026-10-18. It replaces the passwordless flow (emailed 6-digit codes and Google sign-in), which no longer exists. Section 1 of `doc/CUSTOMER_WEB_API_DOCUMENTATION.md` carries the same endpoints in short; everything else in that document (cookies, conventions, account, cart, checkout) is unchanged.

**Strict rule for the frontend:** do not change the visual design of the shop. Replace the code-entry step by a password field, add a sign-up form and the two password pages, inside the existing layouts and components.

## Contents

1. [What changed](#1-what-changed)
2. [How sessions work](#2-how-sessions-work)
3. [Endpoints](#3-endpoints)
4. [Validation rules](#4-validation-rules)
5. [Errors](#5-errors)
6. [The flows, screen by screen](#6-the-flows-screen-by-screen)
7. [Security notes for the frontend](#7-security-notes-for-the-frontend)
8. [Removed endpoints and fields](#8-removed-endpoints-and-fields)
9. [Checklist](#9-checklist)

---

## 1. What changed

| Before | Now |
| --- | --- |
| `POST /v1/store/auth/otp/request` + `POST /v1/store/auth/otp/verify` (code by email; first sign-in created the account) | `POST /v1/store/auth/signup` (first name, last name, email, password) and `POST /v1/store/auth/login` (email, password) |
| `POST /v1/store/auth/google` | Removed. There is no Google sign-in. |
| No way to recover an account | `POST /v1/store/auth/password/forgot` emails a link; `POST /v1/store/auth/password/reset` sets the new password |
| Login-code email | Welcome email after the sign-up; password reset email on request |
| `customer.hasGoogleLogin` in every profile answer | Removed from the profile |

Unchanged: `POST /v1/store/auth/refresh`, `POST /v1/store/auth/logout`, `POST /v1/store/auth/logout-all`, the two cookies, `GET /v1/store/me` and everything under `/v1/store/me/*`, the cart merge after sign-in, checkout, orders, returns, invoices.

There is no email verification step and no "change password" page for a signed-in customer. A customer who wants a new password uses the "forgot password" flow, signed in or not.

## 2. How sessions work

Nothing changed here; this is the summary the auth pages need.

- Authentication is cookie based. A successful `signup`, `login` or `refresh` sets two `httpOnly` cookies: `rf_customer_access` (JWT, 15 minutes, path `/`) and `rf_customer_refresh` (opaque, rotating, 30 days, path `/v1/store/auth`). Tokens never appear in a response body.
- Every call uses `fetch(url, { credentials: 'include' })`. The shop's origin must be in the API's `CORS_ORIGINS`.
- Every non-GET request from the browser carries an `Origin` header; a foreign origin answers `403 ORIGIN_NOT_ALLOWED`.
- On `401 AUTH_TOKEN_INVALID` from any protected call: call `POST /v1/store/auth/refresh` once and retry. If the refresh answers `401 AUTH_REFRESH_INVALID`, the session is over: clear app state and show sign-in.
- `GET /v1/store/me` on page load says whether a session exists (`401` = signed out).
- A password reset revokes every session of the customer. Open tabs keep working for at most 15 minutes (the access token is checked without a database read), then their refresh fails and they land on sign-in.

## 3. Endpoints

All under the base URL with the `/v1` prefix. Bodies are JSON (`Content-Type: application/json`). Unknown fields are rejected with `400 VALIDATION_FAILED`.

### `POST /v1/store/auth/signup`

Creates the account and signs it in on this device. A welcome email follows in the customer's language.

**Authentication:** none. **Rate limit:** 5 per minute per IP.

**Request body**

```json
{
  "firstName": "Anna",
  "lastName": "Schmidt",
  "email": "anna@example.com",
  "password": "Mangoes-in-May-2026",
  "locale": "de"
}
```

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `firstName` | string | yes | 1 to 80 characters after trimming |
| `lastName` | string | yes | 1 to 80 characters after trimming |
| `email` | string | yes | valid email, at most 254 characters; stored trimmed and lower-case |
| `password` | string | yes | 8 to 128 characters, see section 4 |
| `locale` | `en` or `de` | no | Language of the account and its emails. Defaults to the `Accept-Language` header. |

**Success: `201 Created`** with both cookies set.

```json
{
  "customer": {
    "id": "66f1a2b3c4d5e6f7a8b9c0d1",
    "email": "anna@example.com",
    "firstName": "Anna",
    "lastName": "Schmidt",
    "phone": null,
    "locale": "de",
    "communication": {
      "whatsappNumber": null,
      "whatsappOptIn": false,
      "whatsappOptInAt": null,
      "marketingOptIn": false,
      "marketingOptInAt": null,
      "marketingOptOutAt": null
    },
    "createdAt": "2026-10-18T10:00:00.000Z"
  },
  "accessTokenExpiresInSeconds": 900
}
```

**Errors**

- `400 VALIDATION_FAILED` with `details: [{ field, message }]`, for a missing or malformed field or a password outside 8 to 128 characters.
- `400 PASSWORD_TOO_WEAK`: the password is on the list of common passwords, one repeated character, or contains the customer's own email name. Show "This password is too easy to guess. Choose another one." and keep the form.
- `409 CUSTOMER_EMAIL_TAKEN`: an account with this email exists. Show it next to the email field with a link to sign-in and to "forgot password".
- `429 RATE_LIMITED`.

After a `201`, treat the customer as signed in: store `customer` in app state and, if a guest cart exists, call `POST /v1/store/cart/merge` (section 8 of the API documentation).

### `POST /v1/store/auth/login`

**Authentication:** none. **Rate limit:** 10 per minute per IP.

**Request body**

```json
{ "email": "anna@example.com", "password": "Mangoes-in-May-2026" }
```

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `email` | string | yes | valid email; case and surrounding spaces do not matter |
| `password` | string | yes | not empty, at most 128 characters |

**Success: `200 OK`** with both cookies set. Same body as `signup`.

**Errors**

- `401 CUSTOMER_CREDENTIALS_INVALID`: wrong password **or** unknown email. The answer is identical in both cases, on purpose. Show one message: "The email or password is incorrect." Do not say which.
- `403 CUSTOMER_BLOCKED`: the password was right, but Radhe Foods blocked the account. Show "This account has been blocked. Please contact Radhe Foods."
- `400 VALIDATION_FAILED`, `429 RATE_LIMITED`.

### `POST /v1/store/auth/password/forgot`

Emails a link to choose a new password, if the address has an account.

**Authentication:** none. **Rate limit:** 5 per minute per IP. Per account, at most 3 links per hour; further requests answer the same and send nothing.

**Request body**

```json
{ "email": "anna@example.com", "locale": "de" }
```

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `email` | string | yes | valid email |
| `locale` | `en` or `de` | no | Language of the email. Defaults to the language of the account. |

**Success: `204 No Content`**, always, whether or not the address has an account, and whether or not a link was sent. Show: "If an account exists for this address, we have sent an email with a link. The link is valid for 60 minutes."

**Errors:** `400 VALIDATION_FAILED`, `429 RATE_LIMITED`. Nothing else: an unknown address is not an error.

**The email** carries a button to

```
<SHOP_URL>/reset-password?token=<token>
```

`SHOP_URL` is the shop's public address configured on the server (production `https://radhefoods.de`). **The shop must serve this page** at exactly this path, in both languages, and read `token` from the query string. The token is 43 characters of `A–Z a–z 0–9 - _`. The link is valid for 60 minutes and works once; a newer link replaces the older ones.

### `POST /v1/store/auth/password/reset`

Sets the new password with the token from the email and signs the customer out on every device.

**Authentication:** none. **Rate limit:** 10 per minute per IP.

**Request body**

```json
{ "token": "<token from the link>", "password": "Coriander-and-Cumin-7" }
```

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `token` | string | yes | 20 to 200 characters, as it stands in the link |
| `password` | string | yes | 8 to 128 characters, see section 4 |

**Success: `204 No Content`.** The customer is **not** signed in by this call. Show "Your password has been changed. Please sign in." and lead to the sign-in page. Every earlier session of the customer is revoked.

**Errors**

- `400 PASSWORD_RESET_INVALID`: the link is unknown, already used, replaced by a newer one, or older than 60 minutes. Show "This link is no longer valid." with a button to request a new one (the forgot page).
- `400 PASSWORD_TOO_WEAK`: as in `signup`; the link stays valid, the customer chooses another password.
- `400 VALIDATION_FAILED`, `429 RATE_LIMITED`.

### `POST /v1/store/auth/refresh`, `POST /v1/store/auth/logout`, `POST /v1/store/auth/logout-all`

Unchanged. See section 1 of `doc/CUSTOMER_WEB_API_DOCUMENTATION.md`.

## 4. Validation rules

Mirror these in the forms so that the customer sees the problem before the request; the API checks them again.

| Field | Rule | Message suggestion |
| --- | --- | --- |
| First name, last name | required, 1 to 80 characters after trimming | "Please enter your first name" |
| Email | required, a valid address, at most 254 characters | "Please enter a valid email address" |
| Password | 8 to 128 characters. Any characters, spaces included. No rule about digits or capitals: length matters more. | "At least 8 characters" |
| Password (server only) | not one of the common passwords, not one repeated character, not the own email address or its name part | the message of `PASSWORD_TOO_WEAK` |

A password strength hint in the form is welcome but not required. Do not add rules the API does not have (the API would accept a password the form refuses).

## 5. Errors

All errors have the standard shape:

```json
{
  "error": { "code": "CUSTOMER_CREDENTIALS_INVALID", "message": "The email or password is incorrect.", "details": null },
  "requestId": "…"
}
```

Codes of this feature:

| Status | Code | Where | What to show |
| --- | --- | --- | --- |
| 400 | `VALIDATION_FAILED` | all | the field messages from `details` |
| 400 | `PASSWORD_TOO_WEAK` | signup, reset | "This password is too easy to guess. Choose another one." |
| 400 | `PASSWORD_RESET_INVALID` | reset | "This link is no longer valid." + request a new one |
| 401 | `CUSTOMER_CREDENTIALS_INVALID` | login | "The email or password is incorrect." |
| 401 | `AUTH_TOKEN_INVALID` | any protected call | refresh once, then sign-in |
| 401 | `AUTH_REFRESH_INVALID` | refresh | sign-in |
| 403 | `CUSTOMER_BLOCKED` | login, refresh | "This account has been blocked. Please contact Radhe Foods." |
| 403 | `ORIGIN_NOT_ALLOWED` | any non-GET | configuration problem, not a user error |
| 409 | `CUSTOMER_EMAIL_TAKEN` | signup | "An account with this email already exists." + links to sign-in and forgot password |
| 429 | `RATE_LIMITED` | all | "Too many attempts. Please wait a minute." |

Codes that no longer exist: `OTP_INVALID`, `OTP_COOLDOWN`, `OTP_LIMIT_REACHED`, `MAIL_DELIVERY_FAILED`, `GOOGLE_NOT_CONFIGURED`, `GOOGLE_TOKEN_INVALID`, `GOOGLE_EMAIL_NOT_VERIFIED`. Remove their translations.

## 6. The flows, screen by screen

**Sign-up page.** First name, last name, email, password (with a show/hide toggle), the consent lines the shop already has, submit → `POST /v1/store/auth/signup`. On `201`: the customer is signed in; merge the guest cart; go where the customer came from (checkout, account, home). On `409`: message at the email field with "Sign in" and "Forgot password?" links. On `400 PASSWORD_TOO_WEAK`: message at the password field.

**Sign-in page.** Email, password, submit → `POST /v1/store/auth/login`. Links: "Create an account" and "Forgot password?". On `401`: one message under the form, keep the email filled. On `403 CUSTOMER_BLOCKED`: the blocked message. On `200`: as after sign-up.

**Forgot password page** (`/forgot-password` or wherever the shop prefers). Email, submit → `POST /v1/store/auth/password/forgot`. On `204`: replace the form by the confirmation text ("If an account exists for this address…"). Offer "send again", which calls the same endpoint; the API ignores more than 3 requests per hour silently.

**Reset password page** (`/reset-password?token=…`, the path is fixed by the email). New password and its repetition (the repetition is a frontend check only), submit → `POST /v1/store/auth/password/reset` with the `token` from the query string. Without a `token` in the URL, show the "link is not valid" state right away. On `204`: "Your password has been changed", button to sign-in. On `400 PASSWORD_RESET_INVALID`: the "link is no longer valid" state with a button to the forgot page.

**Signed-in account area.** No password section is needed. If the design has a place for it, a line "To change your password, use 'Forgot password?' on the sign-in page" is enough.

**Session expiry.** Unchanged: `401 AUTH_TOKEN_INVALID` → refresh once → retry; on `AUTH_REFRESH_INVALID` → sign-in page with a note that the session has ended.

## 7. Security notes for the frontend

- Never store the password, the token or the cookies in local storage or app state. Send them once and forget them.
- Keep `autocomplete` attributes right: `email`, `given-name`, `family-name`, `new-password` on sign-up and reset, `current-password` on sign-in. Password managers depend on them.
- Do not tell the customer whether an email exists outside the sign-up `409`. The sign-in and forgot pages must not differ for known and unknown addresses.
- Do not retry a `401` on `login` automatically, and do not call `refresh` after a failed `login`.
- Do not put the reset token anywhere but in the `POST` body. Do not log the page URL with its query string to analytics.
- The reset page is a public page: it must render without a session and must not redirect a signed-in customer away (a customer may reset the password while signed in on another device).

## 8. Removed endpoints and fields

Remove from the shop:

- `POST /v1/store/auth/otp/request`, `POST /v1/store/auth/otp/verify`, `POST /v1/store/auth/google` and every screen, state and translation of the code entry and the Google button. The API answers `404` for these paths.
- The field `hasGoogleLogin` from the customer profile type.
- The resend countdown and the "code sent" step.
- Any handling of `503 GOOGLE_NOT_CONFIGURED` (the configuration table of the API documentation no longer lists Google sign-in).

Migration of existing customers: none in the shop. Accounts created under the old flow have no password; their owners use "Forgot password?" once. The database holds only test accounts at this point, so no customer notice is needed.

## 9. Checklist

- [ ] Sign-up form with the four fields and the `201` handling, including the cart merge.
- [ ] Sign-in form with email and password; the `401` message does not reveal which was wrong.
- [ ] Forgot page; `204` shows the neutral confirmation.
- [ ] Reset page at `/reset-password?token=…`, both languages, reads the token from the query string, handles `PASSWORD_RESET_INVALID` and `PASSWORD_TOO_WEAK`, leads to sign-in on success.
- [ ] Old code-entry and Google code removed, `hasGoogleLogin` gone from the types, obsolete error translations removed.
- [ ] `autocomplete` attributes set; nothing secret in local storage or analytics.
- [ ] Blocked account message on `403 CUSTOMER_BLOCKED` on sign-in and refresh.
