# Authentication

Creating an account, signing in, choosing a new password and signing out. A visitor needs none of it to browse or to order as a guest; an account keeps the cart, the addresses, the orders and the invoices in one place. Sign-up asks for a name, an email address and a password and is confirmed by a six-digit code sent to the address. There is no social sign-in and no sign-in by emailed code.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | 2026-10-18 (email and password); the emailed code of the sign-up 2026-11-01; the referral code field 2026-11-02 |
| **Pages** | `/en/sign-in` · `/de/anmelden`, `/en/sign-up` · `/de/registrieren`, `/en/forgot-password` · `/de/passwort-vergessen`, `/en/reset-password?token=…` · `/de/reset-password?token=…` |
| **Code** | `src/components/auth`, `src/features/auth`, `src/features/session`, `src/components/account/sign-out.tsx`, `src/lib/navigation/return-to.ts` |
| **API** | [Authentication](../api/endpoints.md#authentication) |
| **State** | The session in httpOnly cookies set by the API; `localStorage` `rf.session.v1` (the hint that this browser signed in before); the TanStack Query entry `["session"]`; `returnTo`, `email`, `ref` and `token` in the address bar |
| **Texts** | `auth`, `errors`, `common`, `profile` (sign-out) |
| **Tests** | `e2e/checkout.spec.ts` (sign-in, sign-up, password reset, return addresses), `e2e/referral.spec.ts`, `e2e/account.spec.ts`, `src/features/auth/validation.test.ts`, `src/lib/navigation/return-to.test.ts`, `mocks/signup.test.ts` |
| **Backend reference** | [reference/backend/customer-auth.md](../reference/backend/customer-auth.md), [reference/backend/customer-accounts.md](../reference/backend/customer-accounts.md) (section 1) |

How the session works (cookies, the silent refresh, the hint, what is cleared when a session ends) is in [architecture/authentication-and-security.md](../architecture/authentication-and-security.md). The rules of the fields are in [business-logic/forms-and-validation.md](../business-logic/forms-and-validation.md).

## What the customer sees

The four pages share one frame, `AuthPage` in `src/components/auth/auth-page.tsx`: the title, one line of introduction, and one frosted card. None of them is indexed.

### Sign in

"Sign in" with "Welcome back. Sign in with your email address and your password."; with `returnTo=/checkout` the introduction reads "Sign in to pay for your order. Your cart comes with you." The card holds "Email address", "Password" (with a button that shows or hides the characters), the button "Sign in", "Forgot password?" and "New here? Create an account" (which carries the same `returnTo`).

`?email=` fills the address in: the guest checkout sends it when the address turned out to have an account. A value without `@` or longer than 254 characters is ignored.

### Create an account

The card has three states, kept in `SignUpForm` (`src/components/auth/sign-up-form.tsx`).

| State | Content |
| --- | --- |
| The form | "First name" and "Last name", "Email address", "Password" with the hint "At least 8 characters. Spaces are fine.", the referral code, the line "How we handle your data is explained in our privacy policy." (a link to `/legal/privacy`), the button "Create account", and "Already have an account? Sign in". No checkbox: the terms are accepted at the checkout |
| The code | "We sent a 6-digit code to anna@example.com. It is valid for 15 minutes." (address and minutes from the API's answer), one field "Code" for six digits, the button "Confirm", "Resend code" and "Start again" |
| Done | Only when there is something to say: the note "Your account is ready." with "You received 100 coins. Redeem them on the checkout page." and, when a referral code was sent, "Your invitation counted. Thank you!" or the reason it did not count; then "Continue" |

"Resend code" is disabled and reads "Resend code (42 s)" until the seconds the API named (`resendAfterSeconds`) have passed since the last email; a resend shows "We have sent a new code." and starts the countdown again. "Start again" goes back to the form with its values kept. A sign-up whose code expired or whose attempts are used up goes back to the form with "This code has expired or was used up. Please start again."

The referral code is a link "Have a referral code?" that opens the field "Referral code (optional)"; with a code from an invitation link the field is there from the start, filled in. How the code is remembered, looked up and answered is in [referrals.md](referrals.md).

### Forgot password

"Forgot your password?" with one field and "Send link". Afterwards the card shows "Check your inbox" with "If an account exists for this address, we have sent an email with a link. The link is valid for 60 minutes.", "Send again" (which adds "We have sent the email again.") and "Back to sign in". The page reads the same for every address. A signed-in customer may use it too: the account has no page to change a password, and the profile links here.

### Choose a new password

The page behind the link of the email, `/reset-password?token=…`. The address is the same in both languages; the proxy (`src/proxy.ts`) adds the language and keeps the query. The page sends no referrer, never looks at the session and never redirects: a customer may reset the password while signed in elsewhere.

| State | Content |
| --- | --- |
| With a token | "Afterwards you are signed out on every device and sign in with the new password.", "New password", "Repeat the new password", "Save password" |
| Saved | "Your password has been changed" with "Please sign in with your new password." and the button "Sign in" |
| No token, or the API refuses it | "This link is no longer valid" with "A link works once and for 60 minutes, and a newer link replaces it. Request a new one and use the latest email." and "Request a new link" |

### Signing out

`SignOutButton` (`src/components/account/sign-out.tsx`) stands in the greeting card of the account's overview ("Sign out") and in the "Sign-in" panel of the profile, where "Sign out on all devices" stands beside it with "Ends every session of your account, also on other phones and computers." Both load the home page afresh in the current language. A failure shows under the button and the customer stays signed in.

### A signed-out visitor on an account page

`AccountShell` (`src/components/account/account-shell.tsx`) asks the API who is there, whatever the hint says. While it asks, the visitor sees the navigation of the account and grey placeholders in place of the page. When the API says "not signed in", the sign-in page follows, with `returnTo` set to the page they asked for. When the API gives no answer (network, server), the page says "We could not load this page." with "Try again", and nobody is sent to the sign-in.

## Rules

### Where a customer lands afterwards

`returnTo` travels in the address, so anyone can write anything into it. `parseReturnTo` in `src/lib/navigation/return-to.ts` accepts only the shop's own list and falls back to `/account`.

| `returnTo` | Accepted |
| --- | --- |
| `/`, `/cart`, `/checkout`, `/wishlist`, `/account` and its pages `orders`, `invoices`, `addresses`, `profile`, `referrals`, `reviews`, `reports`, `coins` | Yes |
| `/account/orders/RF-1084` (`RF-` and 1 to 10 digits, any case; made upper case) | Yes |
| Anything else, also an address of another site | No: `/account` |

| Case | Where the customer lands |
| --- | --- |
| Sign-in succeeds | The accepted `returnTo` |
| The code of the sign-up is right | `returnTo`; with welcome coins or a referral code sent, the "Done" note first |
| A signed-in customer opens the sign-in or the sign-up page | `returnTo`, at once |
| A visitor opens an account page | Sign-in with `returnTo` of that page. The return and report pages of an order lead back to the order; a single report leads back to `/account` |
| The guest checkout finds an account for the address (`CUSTOMER_EMAIL_TAKEN`) | Sign-in with `returnTo=/checkout` and `email` filled in |
| Password saved on the reset page | "Sign in" leads to the sign-in page without a `returnTo` |
| Signed out, or the account deleted | The home page, loaded in full |

The cart and the wishlist of the visit are handed to the account by their own providers once the session exists ([cart.md](cart.md), [wishlist.md](wishlist.md)).

The API decides whether an address has an account, whether a password is right or too easy to guess, whether an account is blocked, how long a code and a link are valid, how many attempts a code has and how often an email is sent ([customer-auth.md](../reference/backend/customer-auth.md)). The sign-in and the forgot page never say whether an address has an account: the API answers alike, and the shop shows one message.

### Every error text

Under a field:

| Page | Case | Text |
| --- | --- | --- |
| All | Not an email address | "Please enter a valid email address." |
| Sign-in | No password | "Please enter your password." |
| Sign-up, reset | Password empty, under 8, over 128 characters | "Please enter your password." · "Please use at least 8 characters." · "Please use at most 128 characters." |
| Sign-up, reset | `PASSWORD_TOO_WEAK` | "This password is too easy to guess. Please choose another one." |
| Sign-up | A name empty or over 80 characters | "Please fill in this field." · "Please use at most 80 characters." |
| Sign-up | `CUSTOMER_EMAIL_TAKEN` | "An account with this email address already exists." with the links "Sign in" and "Forgot password?" |
| Sign-up | The referral code has the wrong shape | "A referral code has 6 to 12 letters or digits." |
| Sign-up | The referral code is not known | "This referral code is not known. Please check it or leave the field empty." |
| Sign-up, reset | The API names a field without a code of its own | "Please check this field." |
| Code | Not six digits | "Please enter the six digits." |
| Code | `SIGNUP_CODE_INVALID` | "Wrong code. 4 attempts left." (the count from the API) |
| Reset | The repetition differs | "The passwords do not match." |

In the card:

| Case | Text |
| --- | --- |
| Sign-in: wrong password or unknown address (`CUSTOMER_CREDENTIALS_INVALID`) | "The email address or the password is incorrect." The address stays; the password is emptied and focused |
| Sign-in: `CUSTOMER_BLOCKED` | "This account is blocked. Please contact Radhe Foods." |
| Any: `RATE_LIMITED` | "That was a lot of requests in a short time. Please wait a moment and try again." |
| Any: no network | "We could not reach the shop. Check your internet connection and try again." |
| Sign-up: `SIGNUP_NOT_FOUND` | "This code has expired or was used up. Please start again." |
| Done: `unknown_code` | "The referral code K7Q3XM9P is not known, so it was not applied. Your account works all the same." |
| Done: `own_code` | "You cannot use your own referral code, so it was not applied." |
| Done: `already_customer` | "You have ordered from us before, so the referral code K7Q3XM9P does not apply." |
| Done: `already_referred` | "You were invited before, so the referral code K7Q3XM9P was not applied." |
| Done: no reason given | "The referral code K7Q3XM9P could not be applied. Your account works all the same." |

Every other error is the sentence of its code from the `errors` texts, shown by `ErrorAlert` ([api/error-handling.md](../api/error-handling.md)).

## Data and API

```
sign-up     GET  /v1/store/referral-codes/{code}      (only with a referral code)
            POST /v1/store/auth/signup                -> 202 { email, validMinutes, resendAfterSeconds }
            POST /v1/store/auth/signup/resend         (on "Resend code")
            POST /v1/store/auth/signup/verify         -> 201 customer, referral, rewards.welcomeCoins + cookies
sign-in     POST /v1/store/auth/login                 -> customer + cookies
forgot      POST /v1/store/auth/password/forgot       -> 204 for every address
reset       POST /v1/store/auth/password/reset        -> 204; every session of the customer ends
sign-out    POST /v1/store/auth/logout | /logout-all  -> then a full load of the home page
who is it   GET  /v1/store/me                         -> cached as ["session"] for five minutes
```

- The sign-up sends `firstName`, `lastName`, `email` (trimmed, lower case), `password`, `locale` and, when given, `referralCode`. The reset sends the token in the body and nowhere else.
- An answer of the sign-up that already carries `customer` (an API without the code step) signs in at once.
- After a sign-in `signedIn` in `src/features/session/session.ts` stores the customer under `["session"]` and sets the hint. `GET /v1/store/me` is asked only with the hint, or on pages that need an account (`useSession({ force: true })`); the rest is in [authentication-and-security.md](../architecture/authentication-and-security.md).

## Behaviour

- After a refused sign-in the focus is in the empty password field, after a wrong code in the emptied code field, after a refused referral code in that field.
- `autocomplete`: `email`, `given-name`, `family-name`, `current-password` on the sign-in, `new-password` on the sign-up and the reset, `one-time-code` on the code. The code field asks for the numeric keyboard and takes six digits only.
- The show-password button is a toggle (`aria-pressed`) labelled "Show password" or "Hide password".

## Not built

- Sign-in with Google, Apple or any other provider; sign-in by an emailed code or link; passkeys; two-factor sign-in.
- A page to change the password while signed in, and changing the email address of an account.
- "Remember me" and a list of the devices that are signed in.
- A `returnTo` on the forgot and reset pages.

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(shop)/sign-in/page.tsx`, `src/app/[locale]/(shop)/sign-up/page.tsx` | The two pages; they read `returnTo`, `email` and `ref` |
| `src/app/[locale]/(shop)/forgot-password/page.tsx`, `src/app/[locale]/(shop)/reset-password/page.tsx` | The two password pages; the second reads `token` |
| `src/components/auth/auth-page.tsx` | The shared frame and the look of the links inside the forms |
| `src/components/auth/sign-in-form.tsx` | The sign-in form |
| `src/components/auth/sign-up-form.tsx` | The sign-up form, the code step, the referral lookup, the "Done" note |
| `src/components/auth/forgot-password-form.tsx` | The address, and the confirmation that reads the same for everyone |
| `src/components/auth/reset-password-form.tsx` | The password twice, the saved and the invalid state |
| `src/components/account/sign-out.tsx` | The two sign-out buttons |
| `src/features/auth/validation.ts` | The checks of email, password and names |
| `src/features/session/session.ts` | `useSession`, `useSessionActions`, the hint, clearing the cache |
| `src/lib/navigation/return-to.ts` | The accepted return addresses |
