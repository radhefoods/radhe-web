# Account

The pages of a signed-in customer: an overview of everything, the profile, and the saved delivery addresses, inside one frame with the account's navigation. Orders, returns, reports, reviews, coins and referrals have their pages in the same frame and their own documents.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | 2026-11-01 (the overview with its tiles, labels on addresses, closing the account). The account area with orders, addresses and profile is older; the day is not recorded |
| **Pages** | `/en/account` · `/de/konto`, `/en/account/profile` · `/de/konto/profil`, `/en/account/addresses` · `/de/konto/adressen` |
| **Code** | `src/app/[locale]/(shop)/account`, `src/components/account`, `src/features/account`, `src/components/checkout/address-form.tsx`, `src/features/checkout/address-schema.ts` |
| **API** | [Account](../api/endpoints.md#account), [Addresses](../api/endpoints.md#addresses) |
| **State** | The API. TanStack Query entries `["session"]`, `["account", "overview"]` (fresh for 30 seconds), `["addresses"]`, `["orders", locale]` |
| **Texts** | `account`, `profile`, `addressBook`, `address`, `language` |
| **Tests** | `e2e/account.spec.ts`, `e2e/accessibility.spec.ts`, `mocks/overview.test.ts`, `mocks/account.test.ts`, `src/features/checkout/address-schema.test.ts` |
| **Backend reference** | [reference/backend/customer-accounts.md](../reference/backend/customer-accounts.md) (sections 3 and 4), [reference/backend/store-api.md](../reference/backend/store-api.md) (sections 2 and 3) |

Who may open these pages and what a visitor without a session sees is in [authentication.md](authentication.md).

## What the customer sees

### The frame and its navigation

`AccountShell` (`src/components/account/account-shell.tsx`) puts the navigation beside the page from `lg` (a column of 13 rem with one entry per line) and above it on smaller screens (one frosted track that scrolls sideways, the current entry on a white thumb). Nothing of the account is indexed.

| Entry | Leads to | Number beside it |
| --- | --- | --- |
| Overview | `/account` | – |
| Orders | `/account/orders` ([orders.md](orders.md)) | `counts.orders` |
| Invoices | `/account/invoices` ([orders.md](orders.md)) | `counts.invoices` |
| Reviews | `/account/reviews` ([reviews.md](reviews.md)) | – |
| Reports | `/account/reports` ([returns-and-reports.md](returns-and-reports.md)) | `counts.openIssues` |
| Addresses | `/account/addresses` | `counts.addresses` |
| Referrals | `/account/referrals` ([referrals.md](referrals.md)) | – |
| Coins | `/account/coins` ([rewards.md](rewards.md)) | – |
| Profile | `/account/profile` | – |
| Wishlist | `/wishlist`, outside the frame ([wishlist.md](wishlist.md)) | `counts.wishlistItems` |
| Notifications | `/account/notifications` ([back-in-stock.md](back-in-stock.md)) | – |

The numbers come from `GET /v1/store/me/overview` and show as a small pill only above zero. "Coins" is listed while the overview says the program is on or the customer still has coins (`rewards.enabled` or `rewards.available > 0`); an API that sends no `rewards` never lists it. "Notifications" is listed while the shop offers "Notify me" (`stockAlerts.enabled` of the settings). An entry is current when the address starts with its own; "Overview" only on `/account` itself.

### Overview

`AccountOverview` in `src/components/account/overview.tsx`, top to bottom:

1. **The greeting card.** A round badge with the initials (the first letters of first and last name; the first letter of the email address without a name), "Namaste", "Hello Anna" ("Hello" without a first name), the email address and the phone number, "Member since November 2026", and the buttons "Edit profile" and "Sign out".
2. **The tiles**, each a link with a number, a title and a line:

| Tile | Number | Line | Leads to |
| --- | --- | --- | --- |
| Orders | `counts.orders` | "2 on the way" from `counts.openOrders`; "Nothing on the way" at zero | `/account/orders` |
| Invoices | `counts.invoices` | "Download any time" | `/account/invoices` |
| Wishlist | `counts.wishlistItems` | "2 lists" from `counts.wishlists` | `/wishlist` |
| Addresses | `counts.addresses` | "For your deliveries" | `/account/addresses` |
| Coins | `rewards.available` | "Redeem at the checkout" | `/account/coins` |

   The coins tile exists only while `rewards.enabled`; with it the row is three wide from `lg` and five from `xl`, without it four from `lg`.
3. **"Waiting for your payment"**, a wheat-coloured box with one link per unpaid order ("Order RF-1084: €23.45"), only when the first page of orders holds one with the status `pending_payment`.
4. **"Your latest orders"**: the three newest as cards (see [orders.md](orders.md)) with the link "All orders". Without any order: "No orders yet", "Your orders appear here as soon as you place one." and the button "Browse the range" to `/products`.
5. **Beside the orders** from `lg`, below them otherwise: "Standard address" (its label, the address, or "No address saved yet.", and "Manage addresses") and "Invite friends" (the code, the link with "Copy link", "3 signed up · 1 ordered", "All invitations"; see [referrals.md](referrals.md)).

| State | What shows |
| --- | --- |
| Loading | The greeting from the session at once; four grey tiles; two grey order cards |
| The API has no overview (`404 NOT_FOUND`) | The greeting and the orders; no tiles, no side column, no error |
| The overview fails otherwise | "We could not load this page." with "Try again", between the greeting and the orders |
| The orders fail | The same alert in place of the orders |

### Profile

`ProfileView` in `src/components/account/profile-view.tsx`, a column of four panels:

| Panel | Content |
| --- | --- |
| "Your details" | "Email address" (read only, "You sign in with this address. It cannot be changed here."), "First name", "Last name", "Phone (optional)", "Language of our emails" (English or Deutsch), "Save" |
| "News from Radhe Foods" | One checkbox, "Yes, send me news about new products and offers by email.", with "You can switch this off at any time, here or with the link in every such email. Emails about your own orders always come." With `NEXT_PUBLIC_FEATURE_WHATSAPP` on, also "WhatsApp": a number with "Save" and the checkbox "Yes, tell me by WhatsApp when my order is on its way." |
| "Sign-in" | "Sign out", "Sign out on all devices", and "To change your password, request a link by email and choose a new one." with a link to `/forgot-password` |
| "Delete account" | The warning, "Your password", the checkbox "I understand that my account is deleted for good.", the red button "Delete my account" |

A saved profile and a saved preference are confirmed by a toast that stays four seconds: "Your profile has been saved successfully." and "Your preferences have been saved."

### Addresses

`AddressBook` in `src/components/account/address-book.tsx`: "Delivery addresses" with "Up to 10 addresses in Germany. The standard address is suggested at checkout.", then the addresses as cards, two beside each other from `md`.

| Part of a card | Content |
| --- | --- |
| Label | The customer's own word ("Home"), small capitals, when there is one |
| Address | Name in bold, company, street and house number, second line, postcode and city, phone |
| Chip | "Standard" on the standard address |
| Buttons | "Edit"; "Make standard" (not on the standard address); "Delete" |

"Edit" turns the card into the form, across both columns. "Add an address" opens an empty form under the list. The form (`AddressForm`, its plain look): "Label (optional)", first and last name, "Company (optional)", street and house number, "Address line 2 (optional)", postcode and city, "Country" fixed to "Germany", "Phone (optional)", the checkbox "Use as my standard address", "Save address" and "Cancel".

| State | What shows |
| --- | --- |
| Loading | One grey block |
| No address | "You have no address yet." and "Add an address" |
| Ten addresses | "You have saved 10 addresses, the maximum. Delete one to add another." in place of the button |
| The list fails | "We could not load this page." with "Try again" |
| "Make standard" or "Delete" fails | The error above the list |

## Rules

| Case | What happens | Decided by |
| --- | --- | --- |
| Which numbers the tiles and pills show | As sent in `counts` | The API |
| Whose name the greeting shows | The session's customer first, the overview's second: the profile changes the session at once, the overview is kept for a while | The browser |
| What can be changed in the profile | First name, last name, phone, the language of the emails. The email address cannot | The API ([customer-accounts.md](../reference/backend/customer-accounts.md)) |
| An empty phone field | Left out of the request, so a stored number stays | The browser (`DetailsForm`) |
| A switch of the news panel | Moves at once and is stored at once; it moves back when the API refuses | The browser, then the API |
| An empty WhatsApp number | Sent as `null`: the phone of the profile is used | The browser |
| Closing the account | Needs the password and the ticked box; the browser sends nothing without both | The browser, then the API |
| An order, a return or a report is still open | The API refuses with `CUSTOMER_HAS_OPEN_ORDERS`; the panel lists what is open | The API |
| What stays after closing | Orders and invoices without the name; the rest is deleted | The API |
| How many addresses | Ten. The browser hides "Add an address" at ten (`ADDRESS_LIMIT`); the API refuses the eleventh with `ADDRESS_LIMIT_REACHED` | Both |
| "Use as my standard address" | Offered when adding to an existing list and when editing an address that is not the standard one | The browser |
| Which address is the standard after a delete | As the answered list says | The API |
| Deleting an address | At once, without a second question | The browser |
| Two changes at a time | Not possible: while one is on its way the buttons of every card are disabled, because every answer is the whole list | The browser |
| The fields of the profile and of an address | [forms-and-validation.md](../business-logic/forms-and-validation.md) | The browser, then the API |

Texts of the delete panel:

| Case | Text |
| --- | --- |
| The warning | "Your orders and invoices stay with us for the books, without your name. Everything else is deleted: your addresses, your wishlist, your reviews. This cannot be undone." |
| No password typed | "Please enter your password." |
| The box not ticked | "Please tick the box to go on." |
| `CUSTOMER_CREDENTIALS_INVALID` | "The password is not right." (the field is emptied) |
| `CUSTOMER_HAS_OPEN_ORDERS` | "Your account cannot be deleted yet", "These orders are still open: RF-1084, RF-1085.", "1 open return · 2 open reports", "Please wait until they are done, or contact Radhe Foods." |

## Data and API

```
every page   GET    /v1/store/me                        who is signed in (["session"], five minutes)
             GET    /v1/store/me/overview               counts, standard address, referral, coins (30 seconds)
overview     GET    /v1/store/orders?limit=25           the first page; read again at every visit
profile      PATCH  /v1/store/me                        { firstName, lastName, phone?, locale }
             PATCH  /v1/store/me/communication          { marketingOptIn } | { whatsappOptIn } | { whatsappNumber }
             POST   /v1/store/me/delete                 { password, confirm: true } -> 204, cookies cleared
addresses    GET    /v1/store/me/addresses
             POST   /v1/store/me/addresses              every address call answers the whole list
             PATCH  /v1/store/me/addresses/{id}
             POST   /v1/store/me/addresses/{id}/default
             DELETE /v1/store/me/addresses/{id}
```

- The overview is invalidated when an address is saved, made standard or deleted, when an order is cancelled, and when a report is made or taken back; the counts follow.
- A saved profile replaces the customer under `["session"]` (`signedIn`), so the greeting and the header follow without a request.
- After the account is deleted the session hint is removed and the home page is loaded in full, so nothing of the account stays in memory.
- Field errors of the API (`VALIDATION_FAILED`) land at the field as "Please check this field."; any other error shows as an alert in the panel.

## Behaviour

- The navigation is a `nav` named "Account"; the current entry carries `aria-current="page"`.
- The edit, standard and delete buttons of a card are named with the person ("Edit the address of Anna Example") for screen readers.
- In the checkout the same address form is used with floating labels; see [checkout.md](checkout.md).

## Not built

- Changing the email address, and a page to change the password (the profile links to "Forgot password?").
- A profile picture: the badge shows initials.
- A question before an address is deleted, and a way to undo it.
- A billing address apart from the delivery address, and addresses outside Germany.
- Downloading one's own data.
- Subscriptions (the owner's reference showed them; the API has none).

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(shop)/account/layout.tsx` | The frame of every account page, with the account's texts and `noindex` |
| `src/app/[locale]/(shop)/account/page.tsx`, `src/app/[locale]/(shop)/account/profile/page.tsx`, `src/app/[locale]/(shop)/account/addresses/page.tsx` | The three pages |
| `src/components/account/account-shell.tsx` | The navigation with its counts; sends a visitor to the sign-in |
| `src/components/account/overview.tsx` | The greeting, the tiles, the unpaid orders, the latest orders, the side column |
| `src/components/account/profile-view.tsx` | The details form, the news and WhatsApp switches, the sign-in panel |
| `src/components/account/delete-account.tsx` | Closing the account |
| `src/components/account/address-book.tsx` | The list of addresses and its actions |
| `src/components/checkout/address-form.tsx` | The address form, shared with the checkout |
| `src/components/shell/success-toast.tsx` | The toast after a save |
| `src/features/account/overview.ts` | `useOverview` and its cache key |
| `src/features/checkout/address-schema.ts` | The schema of an address and its conversion for the API |
