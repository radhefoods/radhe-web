# Referrals

Every customer has a referral code and a link that carries it. Someone who opens the link is told that they were invited, the code is remembered in their browser, and the sign-up form offers it. The API decides whether an invitation counts and what it brings; the shop shows the code, the link and the people who used it, and carries the code from the link to the sign-up.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | 2026-11-01 (the referral page, the link remembered); the code shown and typed at the sign-up, and the notice under the header, 2026-11-02 |
| **Pages** | `/en/account/referrals` · `/de/konto/empfehlungen`; the notice on every shop page; the field on `/en/sign-up` · `/de/registrieren`; the box on `/en/account` · `/de/konto` |
| **Code** | `src/components/account/referral-view.tsx`, `src/components/account/copy-link.tsx`, `src/lib/referral`, `src/components/shell/referral-capture.tsx`, `src/components/shell/invitation-notice.tsx`, the referral part of `src/components/auth/sign-up-form.tsx` |
| **API** | [Referrals](../api/endpoints.md#referrals), [Authentication](../api/endpoints.md#authentication) (the sign-up carries the code) |
| **State** | `localStorage` `rf.referral.v1` (the code of a link, for 30 days); `sessionStorage` `rf.referral-notice.v1` (the code whose notice was closed in this tab); `ref` in the address bar; TanStack Query entry `["account", "referral"]` (fresh for 30 seconds) |
| **Texts** | `referral`, `invitation`, `auth` (the `referral…` texts), `account.overview` |
| **Tests** | `e2e/referral.spec.ts`, `e2e/account.spec.ts` (the invitation box of the overview), `src/lib/referral/referral-code.test.ts`, `mocks/signup.test.ts` |
| **Backend reference** | [reference/backend/customer-accounts.md](../reference/backend/customer-accounts.md) (section 7), [reference/backend/store-api.md](../reference/backend/store-api.md) (section 21) |

## What the customer sees

### The referral page of the account

`ReferralView` in `src/components/account/referral-view.tsx`: "Your invitations" with "Everyone who signs up with your link is listed here. An invitation counts once their first order was delivered."

| Region | Content |
| --- | --- |
| "Your invitation link" | "Your code" with the code in large, widely spaced letters; the link in a read-only field that selects itself when it gets the focus; the button "Copy link"; "3 signed up · 1 ordered" from `counts.registered` and `counts.qualified`; and, while the coins program pays the inviter, "You receive 100 coins when a friend's first order is delivered." |
| "Who used your link" | One card per invited person: the name (or "Deleted account" once they closed their account), the masked email address when the API sends one, "Signed up on …", "Delivered on …" once their first order arrived, and a status chip |

| State | What shows |
| --- | --- |
| Loading | Two grey blocks |
| Nobody yet | "Nobody has used your link yet. Share it with friends who like Indian groceries." |
| The call fails | "We could not load this page." with "Try again" |

The same code, link, "Copy link" and counts stand in the box "Invite friends" of the account's overview, with "Share your link. We count who signs up with it and who orders." and the link "All invitations" ([account.md](account.md)).

### Copying the link

`CopyLink` (`src/components/account/copy-link.tsx`): "Copy link" writes the link to the clipboard and reads "Link copied" with a tick for two seconds; a screen reader hears it too. Where the browser gives no clipboard, the field takes the focus and selects the link for a copy by hand.

### The invited visitor

The link leads to the home page with the code in the address: `https://www.radhefoods.de/?ref=K7Q3XM9P` (the API builds it and sends it as `link`). `ref` is read on every page of the shop, so a link to any page works.

While a code is remembered and nobody is signed in, a slim leaf-coloured line under the header (`InvitationNotice`) says "You have been invited. The referral code K7Q3XM9P will be applied when you create your account.", with the button "Create account" and a cross ("Hide this note"). It is not shown on the sign-in, sign-up, forgot-password and reset-password pages, nor to a signed-in customer, who cannot be invited any more.

### At the sign-up

| Case | The form shows |
| --- | --- |
| A code from the link of this page (`/sign-up?ref=…`) or remembered from an earlier link | The field "Referral code (optional)", filled in, with "Taken from your invitation link. You can change it." |
| No code | The link "Have a referral code?", which opens the empty field with "Enter the code from the invitation link you received." |
| A code of 6 to 12 characters, half a second after typing pauses or when the field is left | "Checking the code …", then "Invitation from Priya." in green ("This referral code is good." when the API gives no name), or "This referral code is not known. Please check it or leave the field empty." |
| A code of another shape, on "Create account" | "A referral code has 6 to 12 letters or digits." |

After the emailed code of the sign-up, the note "Your account is ready." says what became of the referral code: "Your invitation counted. Thank you!", or why it did not count (the texts are in [authentication.md](authentication.md)).

## Rules

### What inviter and invitee get

The shop words it in three places, and each number is the API's:

| Place | Text | Shown while |
| --- | --- | --- |
| The referral page | "You receive 100 coins when a friend's first order is delivered." | The coins program is on and pays the inviter (`program.earning.referral.inviter` of `GET /v1/store/me/rewards`) |
| The overview's box | "A friend's first delivered order earns you coins." | `rewards.enabled` of the overview |
| The rules of the coins ([rewards.md](rewards.md)) | "100 coins when a friend's first order is delivered." · "50 coins when you sign up with a friend's link." | The matching rule of the program is set |

Without the coins program an invitation is counted and listed, and brings nothing. The history of the coins names the two kinds "A friend's first order" (for the inviter) and "Invited by a friend" (for the invitee).

### Statuses of an invitation

| API value | English wording | Chip |
| --- | --- | --- |
| `registered` | Signed up | Leaf |
| `qualified` | First order delivered | Green |
| `void` | Not counted | Grey |

### How the code is remembered

All of it is `src/lib/referral/referral-code.ts`.

| Case | What happens | Decided by |
| --- | --- | --- |
| A page opens with `?ref=` | `ReferralCapture` (rendered by `src/app/[locale]/layout.tsx`) hands the value to `rememberReferralCode` | The browser |
| The value is 6 to 12 letters or digits | Stored in capitals under `rf.referral.v1` with an expiry 30 days ahead | The browser |
| The value has another shape | Ignored; nothing is stored | The browser |
| A second link arrives | It replaces the first, with 30 days of its own | The browser |
| The stored code is read after its expiry, or is damaged | Removed; there is no code | The browser |
| The customer types a code at the sign-up and presses "Create account" | Stored the same way, so a reload during the code step or "Start again" keeps it | The browser |
| The account is made | The code is forgotten (`forgetReferralCode`); the notice goes by itself | The browser |
| The notice is closed | The code is noted in `sessionStorage`; the notice stays away for that code in this tab | The browser |
| Storage is blocked | Nothing is kept: only `/sign-up?ref=…` itself still fills the field | The browser |
| The code changes in another tab | The form and the notice follow at once (`useReferralCode` listens to storage events) | The browser |

Worked example: a link is opened on 3 November at 10:00. The entry is `{"code":"K7Q3XM9P","expiresAt":…}` with `expiresAt` 30 × 24 × 3600 × 1000 = 2 592 000 000 milliseconds later. A sign-up on 2 December offers the code; a sign-up on 4 December does not.

### What the API decides

| Rule | Decided by |
| --- | --- |
| Whether a code belongs to someone (`GET /v1/store/referral-codes/{code}`; `404 REFERRAL_CODE_UNKNOWN` otherwise) | The API |
| Whether the code counts for this person: not their own code, not someone who ordered before, not someone invited before | The API, in `referral.applied` and `referral.reason` of the answer to the emailed code |
| When an invitation is `qualified` or `void`, and what it pays | The API ([customer-accounts.md](../reference/backend/customer-accounts.md), [rewards.md](../reference/backend/rewards.md)) |
| That a code which does not count never fails the sign-up | The API |

The browser refuses a sign-up only for a code the lookup called unknown. A lookup that could not be answered (the API busy or away) lets the sign-up go ahead with the code.

## Data and API

```
referral page   GET  /v1/store/me/referral            { code, link, counts, invitees }
                GET  /v1/store/me/rewards             the inviter's coins, while the program is on
overview        GET  /v1/store/me/overview            referral.code, referral.link, referral.counts
sign-up         GET  /v1/store/referral-codes/{code}  who invites; each code is asked once per form
                POST /v1/store/auth/signup            … referralCode
                POST /v1/store/auth/signup/verify     -> referral: { applied, reason }
```

- The lookup needs no session and is limited by the API to 10 calls a minute per address; therefore the form waits for a pause in typing, and never asks for the same code twice (an answer that could not be given is asked for again when the field is left or the form is sent).
- The code is sent in capitals; the API accepts any case.
- Nothing about a referral is sent before the sign-up: the remembered code lives in the browser only.

## Behaviour

- The notice is an `aside` named "You have been invited"; on a narrow screen its parts wrap onto further lines.
- The referral field writes capitals, drops spaces, takes 12 characters at most, and is set with wide letter spacing so a code is read at a glance.
- The hint under the field turns into the error when the code is refused; the error is announced.

## Not built

- Sharing buttons (WhatsApp, email, the device's share sheet): the link is copied.
- A QR code of the link.
- Entering a referral code after the account exists, or at the guest checkout.
- A page for the invited visitor: the link opens the home page with the notice.
- A reward chosen or paid by the shop: coins are the only reward, and only while the API's program pays them.

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(shop)/account/referrals/page.tsx` | The referral page |
| `src/components/account/referral-view.tsx` | The code, the link, the counts, the invited people |
| `src/components/account/copy-link.tsx` | The field with "Copy link" |
| `src/components/account/overview.tsx` | The box "Invite friends" of the overview |
| `src/lib/referral/referral-code.ts` | The shape of a code; remembering, reading and forgetting it |
| `src/lib/referral/use-referral-code.ts` | The remembered code as a hook that follows changes |
| `src/components/shell/referral-capture.tsx` | Reads `?ref=` on every page |
| `src/components/shell/invitation-notice.tsx` | The line under the header |
| `src/components/auth/sign-up-form.tsx` | The field, the lookup, and the outcome after the code |
| `src/app/[locale]/(shop)/sign-up/page.tsx` | Reads `?ref=` of the sign-up page itself |
