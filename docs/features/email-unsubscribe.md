# Email unsubscribe

The page behind the unsubscribe link of a news email. One tap switches off the news about products and offers for the customer the link belongs to, without a sign-in. Emails about the customer's own orders are not affected. This document also names every other place where the shop deals with email choices.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | 2026-10 |
| **Pages** | `/en/unsubscribe/[token]` · `/de/unsubscribe/[token]` |
| **Code** | `src/app/[locale]/(plain)`, `src/components/public`, `src/proxy.ts` |
| **API** | [Newsletter and unsubscribe](../api/endpoints.md#newsletter-and-unsubscribe) |
| **State** | The token in the address. Nothing is stored in the browser |
| **Texts** | `unsubscribe`; the error sentences of `errors` |
| **Tests** | `e2e/public.spec.ts` ("the unsubscribe link of an email"), `mocks/public-links.test.ts` |
| **Backend reference** | Section 4 of [reference/backend/store-api.md](../reference/backend/store-api.md) |

## What the customer sees

The emails are written and sent by the API. Their link is `/unsubscribe/<token>` on the address of the shop, without a language.

The page stands in its own frame, the `(plain)` layout (`src/app/[locale]/(plain)/layout.tsx`): a header with nothing but the logo, which leads to the home page, and the page. No navigation, no search, no cart, no language switch and no footer. The cookie notice of the shop still appears on a first visit.

| State | What shows |
| --- | --- |
| The page opens | The heading "Unsubscribe from news", the text "After this you get no more news about products and offers from Radhe Foods. Emails about your own orders keep coming." and the button "Unsubscribe" |
| The call is on its way | The button shows that it is busy |
| Done | The green message "You are unsubscribed": "anna@example.com gets no more news from us. Emails about your own orders keep coming." Under it "Changed your mind? You can switch news on again in your profile." and the button "To my profile" |
| The link is not valid | The message "This link is not valid": "Please use the link from our latest email, or switch news off in your profile." and the button "To my profile" |
| Any other failure (no connection, too many requests, the API is away) | The error in the customer's language above the button; the button stays, so the tap can be repeated |

"To my profile" leads to the profile of the account, which asks for a sign-in when nobody is signed in.

## Rules

| Case | What happens | Decided by |
| --- | --- | --- |
| Whom the token stands for and whether it is valid | A tampered or unknown token answers `404 CUSTOMER_NOT_FOUND` | The API |
| What is switched off | News about products and offers only (`marketingOptIn: false`) | The API |
| When the call is made | Only on the tap of "Unsubscribe", never when the page opens: mail programs and security scanners open the links of an email on their own | `UnsubscribeView` in `src/components/public/unsubscribe-view.tsx` |
| The language of the page | The link carries none: the proxy sends it to the language the visitor chose before, then the browser's, then English, and keeps the token | `src/proxy.ts` |
| The dot in the token | A token has the form `<id>.<signature>`. The proxy leaves addresses with a dot alone as files, so `/unsubscribe/:token*` is named in its matcher | `src/proxy.ts` |
| The token on its way to the API | Passed through exactly as it came, encoded as one path segment | `src/lib/api/store-api.ts` |
| Search engines and referrers | `noindex, nofollow`, `referrer: no-referrer`, and `robots.txt` closes `/unsubscribe/`: the address carries a personal token | The page, `src/app/robots.ts` |
| A second tap on the same link | Answers the same result; nothing changes | The API |

## Data and API

```
email link  /unsubscribe/<token>
   → proxy  /en/unsubscribe/<token>            (or /de/…)
   → tap    POST /v1/unsubscribe/{token}       (browser, no session needed)
   → 200    { "email": "anna@example.com", "marketingOptIn": false }  → "You are unsubscribed"
   → 404    CUSTOMER_NOT_FOUND                                        → "This link is not valid"
   → other  the sentence of the error code, the button stays
```

The call is made by the browser (`api.unsubscribe` of `src/lib/api/browser.ts`); the server renders the frame and the heading only. Nothing is cached. The page does not read or change the session. Errors are shown by `ErrorAlert`; see [Error handling](../api/error-handling.md).

The texts of the page travel to the browser with this area only (`emailLinks` in `src/i18n/client-messages.ts`).

## Other email choices in the shop

| Where | What | Call |
| --- | --- | --- |
| Profile of the account (`/en/account/profile` · `/de/konto/profil`), section "News from Radhe Foods" | The switch "Yes, send me news about new products and offers by email." It is stored the moment it is toggled and moves back when the API refuses. The hint: "You can switch this off at any time, here or with the link in every such email. Emails about your own orders always come." | `PATCH /v1/store/me/communication` |
| Profile, "Your details" | "Language of our emails": English or German, saved with the details | `PATCH /v1/store/me` |
| Profile, "WhatsApp" (only with `NEXT_PUBLIC_FEATURE_WHATSAPP=true`) | A WhatsApp number and the consent to be told when an order is on its way | `PATCH /v1/store/me/communication` |

The news switch is off or on as the API stores it; the sign-up form does not ask for it. See [Account](account.md).

## Behaviour

- The page is one column of `max-w-xl` and works the same on every screen.
- The result replaces the text and the button; the messages are the shared `Alert` and `ErrorAlert`.

## Not built

Confirmed by a search of `src` for "newsletter", "marketing", "unsubscribe" and "optIn":

- A newsletter sign-up for visitors without an account: no field in the footer, on the home page or at the checkout.
- A tick box for news on the sign-up form or at the checkout.
- A page to subscribe again from an email, a list of topics to choose from, or a frequency setting: the profile has the one switch.
- Unsubscribing from the emails about orders: the API always sends them.
- An address of the shop that unsubscribes without the page (a one-click unsubscribe a mail program could call): the only route handler of the shop is the health route (`src/app/api/health/route.ts`), and the page always asks for the tap.

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(plain)/layout.tsx` | The frame with the logo only; sends the `unsubscribe` texts to the browser |
| `src/app/[locale]/(plain)/unsubscribe/[token]/page.tsx` | The heading and the metadata that keep the page out of search engines |
| `src/app/[locale]/(plain)/error.tsx` | The error page of this frame |
| `src/components/public/unsubscribe-view.tsx` | The button, the call and the three results |
| `src/proxy.ts` | Sends the link of the email to a language, the dot in the token included |
| `src/app/robots.ts` | Closes the address to search engines |
| `src/components/account/profile-view.tsx` | The news switch, the language of the emails and the WhatsApp consent in the account |
