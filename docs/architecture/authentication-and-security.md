# Authentication and security

A customer's session lives in two `httpOnly` cookies that the API sets and only the API reads. The shop holds no token: the browser sends the cookies with every call to the API, asks for a fresh access cookie when the old one has run out, and learns who is signed in by asking `GET /v1/store/me`. Everything that belongs to one customer is therefore read in the browser; the Next.js server reads public data only. This document describes that mechanism and every security measure the shop sets itself. The screens of signing up and signing in are in [features/authentication.md](../features/authentication.md); the calls are in [api/endpoints.md](../api/endpoints.md#authentication).

## Where the session lives

| Cookie | Set by | Sent to | Lifetime |
| --- | --- | --- | --- |
| `rf_customer_access` | The API, at sign-in and at every refresh | Every path of the API | 15 minutes |
| `rf_customer_refresh` | The API | `/v1/store/auth/*` of the API only | 30 days, extended at every refresh, 180 days at most |

Names, paths and lifetimes are the API's ([reference/backend/store-api.md](../reference/backend/store-api.md), section 0.5): `HttpOnly`, `SameSite=Lax`, `Secure` in production, on a cookie domain the shop and the API share. No script of the shop can read them.

| Client | File | Cookies | Used for |
| --- | --- | --- | --- |
| `api` and `session` | `src/lib/api/browser.ts` | `credentials: "include"` on every call | Everything of a customer, and public data a client component asks for |
| `serverApi` | `src/lib/api/server.ts` | None | Public data: catalogue, settings, legal texts, FAQ, blog, reviews |

The refresh cookie never reaches the Next.js server, so the server could not renew a session. That is why account, cart, checkout and orders are client components.

## Refresh

`createSessionTransport` in `src/lib/api/session-transport.ts` wraps every call of the browser:

```
call ──▶ 2xx ──▶ answer
  │
  └─ 401 AUTH_TOKEN_INVALID ──▶ POST /v1/store/auth/refresh (one for all calls waiting)
                                   ├─ 2xx ──▶ the call is sent once more
                                   ├─ AUTH_REFRESH_INVALID or CUSTOMER_BLOCKED ──▶ session over, listeners told, the first error is thrown
                                   └─ network or another error ──▶ thrown; the session is kept
```

| Rule | Detail |
| --- | --- |
| Which calls are repeated | Every path outside `/v1/store/auth/`, and `POST /v1/store/auth/logout-all`, the one auth route that needs a session |
| One refresh at a time | Refresh tokens rotate, so calls that fail together wait for the same request |
| A call is repeated once | A second `401` goes to the caller |
| `raw` | The same handling for an answer that is not JSON (the PDF of an invoice) |
| Session over | `Providers` in `src/features/providers.tsx` listens with `session.onSessionEnded`: the hint is removed, the session query is set to `null`, and `forgetCachedData` drops every other cached query |

The query keys of TanStack Query do not name the customer, so what one customer loaded must leave the memory when the session ends or changes hands.

## Who is signed in

`useSession` in `src/features/session/session.ts` answers one of three states. Asking `GET /v1/store/me` on every page would mean two failing requests for every visitor without an account, so the browser keeps a hint.

| Thing | Value |
| --- | --- |
| Hint | `localStorage` key `rf.session.v1` with the value `1`: "this browser signed in before". Not a credential |
| Set | After a successful `GET /v1/store/me`, after sign-in (`useSessionActions().signedIn`) |
| Removed | Sign-out, account deleted, a refused refresh, `GET /v1/store/me` answering `AUTH_TOKEN_INVALID` or `CUSTOMER_NOT_FOUND` |
| Other tabs | Follow through the `storage` event; the same tab through the event `rf:session-hint` |
| Query | Key `["session"]`, fresh for five minutes |

| Hint | `force` | Before the API has answered | After |
| --- | --- | --- | --- |
| Absent | `false` | `guest`, no request is made | – |
| Present | either | `loading` | `customer`, or `guest` |
| Absent | `true` | `loading` | `customer`, or `guest` |

`force: true` is passed by the pages that need to know: the account (`src/components/account/account-shell.tsx`) and the checkout (`src/components/checkout/checkout-view.tsx`). With storage blocked the hint reads as absent, and those pages still ask. On the server and during hydration the hint counts as absent, so a prerendered page never shows a customer's state.

When `GET /v1/store/me` fails for another reason (network, a `500`), the state is `guest` with `error` set. "Not signed in" is an answer of the API; a failed request is not one, and the guards below treat the two differently.

## Sign-in, sign-out, the end of a session

| Event | What the shop does |
| --- | --- |
| Sign-in or a verified sign-up | The API sets the cookies. `signedIn(customer)` sets the hint and the session query; when the customer is another one than the one in memory, `forgetCachedData` runs first |
| Sign-out on this device | `SignOutButton` in `src/components/account/sign-out.tsx`: `POST /v1/store/auth/logout`, hint removed, then `window.location.assign` to the home page. A full load empties the memory, and the account page cannot redirect to the sign-in meanwhile |
| Sign-out on all devices | The same button with `everywhere`: `POST /v1/store/auth/logout-all`. An access cookie on another device stays valid until it runs out (15 minutes at most); its next refresh is refused |
| Account closed | `src/components/account/delete-account.tsx`: `POST /v1/store/me/delete` with the password, then as sign-out |
| Refresh refused | See "Refresh": the page stays, the customer's data leaves the memory, guarded pages lead to the sign-in |

## Guards

There is no guard on the server: `src/proxy.ts` decides the language only, and the server sends the pages of the account as frames without a customer's data. What protects the data is the API, which answers a call without a session with `401`.

| Area | Guard | Guest | API could not be asked |
| --- | --- | --- | --- |
| `/en/account` · `/de/konto` and every page under it | `AccountShell`, rendered by `src/app/[locale]/(shop)/account/layout.tsx` | `router.replace` to `/sign-in?returnTo=` with the page; a skeleton until then | An error with "try again"; no redirect |
| `/en/checkout` · `/de/kasse` | `CheckoutView` | The choice between signing in and ordering as a guest | An error with "try again"; the guest checkout is not offered |
| `/en/sign-in` · `/de/anmelden` | `src/components/auth/sign-in-form.tsx` | The form | – |

A signed-in customer who opens the sign-in page is sent on to `returnTo`. That value travels in the address, so `parseReturnTo` in `src/lib/navigation/return-to.ts` accepts only a fixed list of pages of the shop and the page of one order (`/account/orders/RF-…`); anything else becomes `/account`. An address from outside is never navigated to.

## What a guest can do

| A visitor without an account can | Kept in |
| --- | --- |
| Browse, search, read every public page | – |
| Fill a cart, priced by `POST /v1/store/cart/preview` | `localStorage` `rf.cart.v2` (pack sizes and quantities, never prices) |
| Keep a wishlist | `localStorage` `rf.wishlist.v1` |
| Order as a guest (`POST /v1/store/guest/checkout`) | The address and the email are sent with the order and stored nowhere in the browser |
| Open, pay and cancel the guest order | The token of the link, in the query of the address and in `sessionStorage` `rf.guest-order.v1:<order number>` (`src/lib/orders/guest-token.ts`) |
| Unsubscribe from news, choose a password by the link of an email | The token of the address |

After sign-in the cart and the wishlist of the visit are handed to the account once (`POST /v1/store/cart/merge`, `POST /v1/store/wishlist/merge`). The guest's token is sent as `?token=` because the API's CORS allows no header for it; it is checked against a format before it is used, and forgotten when the API refuses it.

## Security headers

`next.config.ts` sets these on every address (`/:path*`). `poweredByHeader: false` removes `X-Powered-By`.

| Header | Value | Effect |
| --- | --- | --- |
| `Content-Security-Policy` | See below | What a page may load and where it may send data |
| `X-Content-Type-Options` | `nosniff` | A file is used as the type it is served with |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Another site learns the origin of the shop, never the path |
| `X-Frame-Options` | `DENY` | The shop cannot be shown in a frame |
| `Strict-Transport-Security` | `max-age=31536000` | A browser that has seen the shop over https never tries http again; ignored on plain http. Without `includeSubDomains`: the other subdomains are not the shop's to promise for |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | None of the four is available to any page or frame |

`GET /api/health` adds `Cache-Control: no-store` and `X-Robots-Tag: noindex` (`src/app/api/health/route.ts`).

### Content Security Policy

| Directive | Value | Reason |
| --- | --- | --- |
| `default-src` | `'self'` | The shop's own files unless a line below says otherwise |
| `script-src` | `'self' 'unsafe-inline'` | Next.js writes the data of a page into inline scripts that differ with every render, and most pages are prerendered, so they cannot carry a nonce. Scripts of other origins stay out |
| `style-src` | `'self' 'unsafe-inline'` | React writes `style` attributes; the sheets of the menus lock scrolling with a `<style>` element |
| `img-src` | `'self' data: blob: https:` and the API's origin | The CDN of the API, pictures an editor puts into a blog post or a legal text, the preview of a photo chosen for a problem report (`blob:`) |
| `font-src` | `'self'` | Inter is served by the shop |
| `connect-src` | `'self'` and the API's origin | The browser calls the API and nothing else |
| `frame-src` | `'none'` | No frames |
| `manifest-src` | `'self'` | The web manifest |
| `object-src` | `'none'` | No plugins |
| `base-uri` | `'self'` | Injected markup cannot change where relative addresses lead |
| `form-action` | `'self'` | No form sends to another site |
| `frame-ancestors` | `'none'` | As `X-Frame-Options` |

The API's origin is taken from `NEXT_PUBLIC_API_URL`. Two environments widen the policy: `next dev` (`NODE_ENV` other than `production`) adds `'unsafe-eval'` to `script-src` and `ws://localhost:* ws://127.0.0.1:*` to `connect-src` for its tooling; a preview deployment on Vercel (`VERCEL_ENV=preview`) admits `https://vercel.live` in `script-src`, `style-src`, `font-src`, `connect-src` and `frame-src`, `https://assets.vercel.com` in `font-src` and `wss://ws-us3.pusher.com` in `connect-src` for the comment toolbar.

## What the browser sends where

| To | What | With |
| --- | --- | --- |
| The shop's origin | Pages, scripts, styles, the font, the files of `public/brand` | The cookie `NEXT_LOCALE` of next-intl |
| The API | `fetch` calls with `Accept: application/json`; JSON bodies, or `multipart/form-data` for the photos of a problem report | The session cookies; the language as `?locale=` or `Accept-Language`; `Idempotency-Key` on the two checkout calls |
| The hosts of pictures | `GET` of `<img>` | Nothing |
| Stripe | A navigation of the whole tab | Nothing of the shop |

The layout opens the connection to the API early (`preconnect` with `crossOrigin: "use-credentials"` in `src/app/[locale]/layout.tsx`). The shop loads no script, font, frame or tracker of a third party, and the policy above would refuse one.

What the shop expects of the API: its origin in the API's list of allowed origins, `Access-Control-Allow-Credentials: true`, and `Idempotency-Key` among the allowed headers (the backend snapshot lists `Content-Type, Authorization, X-Request-Id`; the decision log holds this as an open item). The API refuses a request that is not a `GET` from another origin with `403 ORIGIN_NOT_ALLOWED`; that is its protection against forged requests, together with `SameSite=Lax`.

## Public and server-only values

Every `NEXT_PUBLIC_*` variable is built into the scripts and visible to anyone. `API_INTERNAL_URL` is read on the server only, and is an address, not a secret. The shop has no secret: no key of Stripe, no token of the API, no signing key ([configuration.md](configuration.md)).

## Payments

The shop never sees a card. Placing an order answers the address of a payment page (`checkout.url`), and the browser goes there:

```
POST /v1/store/checkout (or /guest/checkout) ──▶ checkout.url ──▶ isSafePaymentUrl ──▶ window.location.assign
Stripe ──▶ the order page with ?payment=success or ?payment=cancelled ──▶ GET …/payment
```

`isSafePaymentUrl` in `src/features/orders/payment-url.ts` accepts `https`, and `http` for `localhost` and `127.0.0.1` only (the mock API plays the payment page in development); any other address is refused as `PAYMENT_PROVIDER_ERROR`. The same check guards "Pay now" on an order (`src/components/account/order-payment.tsx`). No script of Stripe is loaded and no dependency of Stripe is installed. The rest is in [features/payments.md](../features/payments.md).

An order is made once: the idempotency key of a checkout is kept in `sessionStorage` (`rf.checkout.key.v1`) beside a fingerprint of the order it was made for (`rf.checkout.for.v1`), a hash, so no address or email is stored (`src/lib/checkout/order-attempt.ts`).

## Input and output

| Measure | Where |
| --- | --- |
| Every form handled by a script carries `method="post"`: a submit before the scripts ran cannot put an email and a password into the address | The forms of `src/components/auth`, `src/components/account`, `src/components/checkout` |
| One message for a wrong password and an unknown address | `src/components/auth/sign-in-form.tsx` |
| The forms check what the API checks, never more strictly | `src/features/auth/validation.ts` |
| HTML inside Markdown of the API is not rendered (`skipHtml`) | `src/components/legal/legal-text.tsx` |
| `<` is escaped in structured data, so a text cannot close the script tag | `JsonLd` in `src/lib/seo/json-ld.tsx` |
| The address of a picture is escaped for the sitemap | `src/lib/seo/sitemap.ts` |
| `?email=` of the sign-in page is used only when it looks like an address of 254 characters at most | `src/app/[locale]/(shop)/sign-in/page.tsx` |

## Cookies, storage and the cookie notice

| Name | Kind | Holds |
| --- | --- | --- |
| `rf_customer_access`, `rf_customer_refresh` | Cookies of the API | The session |
| `NEXT_LOCALE` | Cookie of the shop (next-intl) | The chosen language |
| `rf.session.v1` | `localStorage` | The sign-in hint |
| `rf.cart.v2` | `localStorage` | The visitor's cart |
| `rf.wishlist.v1` | `localStorage` | The visitor's wishlist |
| `rf.referral.v1` | `localStorage` | The code of a referral link, for 30 days |
| `rf.cookie-notice.v1` | `localStorage` | That the notice was read |
| `rf.checkout.key.v1`, `rf.checkout.for.v1` | `sessionStorage` | The idempotency key and its fingerprint |
| `rf.guest-order.v1:<order number>` | `sessionStorage` | The token of a guest order |
| `rf.referral-notice.v1` | `sessionStorage` | That the note about a referral code was hidden |

Everything here is needed for the shop to work, so `CookieNotice` in `src/components/shell/cookie-notice.tsx` is a notice and not a consent banner: one sentence, a link to `/en/legal/cookies` · `/de/rechtliches/cookies`, and "OK". `COOKIE_NOTICE_SCRIPT`, an inline script at the head of the body, marks `<html>` with `data-cookie-notice="read"` before the first paint, and a rule of `src/app/globals.css` hides the notice for a returning visitor. With storage blocked the notice is not shown at all. The table customers read is written by hand in `content/legal/cookies.en.md` and `content/legal/cookies.de.md` and has to be kept in step with the list above.

## Private pages and search engines

| Measure | Where |
| --- | --- |
| `noindex, nofollow` on the account as a whole | `metadata` of `src/app/[locale]/(shop)/account/layout.tsx` |
| `noindex, nofollow` on cart, checkout, wishlist, sign-in, sign-up, forgot and reset password, the guest order, unsubscribe | `generateMetadata` of each page |
| `referrer: "no-referrer"` on the three pages whose address carries a token (reset password, unsubscribe, guest order) | The same |
| `robots.txt` closes only those three kinds of address | `src/app/robots.ts` |

The other private pages stay open to crawlers on purpose: a `noindex` can only be read on a page that may be opened. The full list is in [seo.md](seo.md).

## Tests

| File | Guards |
| --- | --- |
| `src/lib/api/session-transport.test.ts` | Cookies on every call, refresh once, one shared refresh, the end of a session (refused refresh, blocked account), a kept session on another failure, `logout-all`; the language and the error format of a call |
| `src/lib/api/http.test.ts` | The time limit of the server's calls |
| `src/features/auth/validation.test.ts` | The rules of the forms against the API's |
| `src/lib/navigation/return-to.test.ts` | Only pages of the list are accepted |
| `src/features/orders/payment-url.test.ts` | Which payment addresses are accepted |
| `src/lib/orders/guest-token.test.ts`, `src/lib/checkout/order-attempt.test.ts` | The guest token and the idempotency key |
| `scripts/smoke.mjs` | A built shop sends the policy and `Strict-Transport-Security`, and no `X-Powered-By` |
