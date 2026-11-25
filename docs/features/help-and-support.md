# Help and support

Where a visitor learns how the shop works and what delivery costs, and every way the shop offers to reach Radhe Foods. Two help pages explain ordering, delivery, payment, cancelling and returns; the questions of the admin are on the [FAQ](faq.md) page.

| | |
| --- | --- |
| **Status** | Partially implemented: the two help pages are built. The shop shows no address, number or form to write to Radhe Foods; the only message a customer can send is a problem report or a return request on a delivered order |
| **Since** | 2026-10 (the two help pages) |
| **Pages** | `/en/how-it-works` · `/de/so-funktionierts`, `/en/delivery-and-payment` · `/de/lieferung-und-zahlung` |
| **Code** | `src/app/[locale]/(shop)/how-it-works/page.tsx`, `src/app/[locale]/(shop)/delivery-and-payment/page.tsx`, `src/config/env.ts` |
| **API** | [Settings and legal texts](../api/endpoints.md#settings-and-legal-texts), [Rewards](../api/endpoints.md#rewards) |
| **State** | None |
| **Texts** | `help`; the three steps from `home`; the coins block from `rewards`; the help column from `footer` |
| **Tests** | `e2e/public.spec.ts` ("help and legal pages"), `e2e/accessibility.spec.ts` |
| **Backend reference** | Section 6 of [reference/backend/store-api.md](../reference/backend/store-api.md), [reference/backend/box-based-shipping-web-integration.md](../reference/backend/box-based-shipping-web-integration.md), [reference/backend/rewards.md](../reference/backend/rewards.md) |

## What the customer sees

### Where help is linked

| Place | Links |
| --- | --- |
| The help column of the footer | "How it works", "Delivery and payment", "FAQ", "Blog", "Your account" |
| The hero of the home page | "How it works" |
| The product page (`src/components/catalogue/purchase-info.tsx`) | "Delivery and payment" |

The header has no help link.

### How it works

`src/app/[locale]/(shop)/how-it-works/page.tsx`, in a column of `max-w-4xl`:

1. The heading "How it works" and an intro.
2. Three numbered steps on glass cards, side by side from `md`: "Choose", "Pay", "Delivered". Their texts are the fixed texts `home.step1Title` to `home.step3Text`.
3. "Collect coins" (anchor `#coins`), only while the coins programme is switched on: an intro, the rules of the programme with the figures of the API (`RewardsRules`), and the link "Your coins" to the account. See [Rewards](rewards.md).
4. "Questions and answers": six fixed questions with their answers, all open, as one list on a glass panel.
5. The button "Shop now", which leads to all products.

| Question | Text key |
| --- | --- |
| "Do I need an account?" | `help.howItWorks.q1` |
| "How do I pay?" | `help.howItWorks.q2` |
| "When does my order arrive?" | `help.howItWorks.q3` |
| "Can I change or cancel my order?" | `help.howItWorks.q4` |
| "What if something is missing or damaged?" | `help.howItWorks.q5` |
| "Why can I not order a product right now?" | `help.howItWorks.q6` |

These six are texts of the shop in `messages/en.json` and `messages/de.json`; the admin cannot edit them. The page hands them to search engines as a `FAQPage` block of structured data. The questions the admin keeps are a separate page, the [FAQ](faq.md).

### Delivery and payment

`src/app/[locale]/(shop)/delivery-and-payment/page.tsx`, six glass panels in a column of `max-w-3xl`:

| Section | Content | Figures from |
| --- | --- | --- |
| "Where we deliver" | Every address in Germany; own driver or a parcel with DHL or Hermes | Fixed text |
| "Delivery fee" | A table of fee steps by order value; or, where delivery is priced by the box, what a box holds, the value of goods that makes a box free and the fee per paid box | The settings of the API |
| "Delivery time" | "Paid orders are packed and on their way soon. Delivery time: 2 to 4 working days." and a note that it is an estimate | The settings: the estimate in the language of the page |
| "Payment at checkout" | Card and PayPal on the payment page of Stripe; when the order is confirmed | Fixed text |
| "Cancellation" | In the account, until the order is on its way | Fixed text |
| "Returns" | "Within 14 days after delivery you can ask in your account to send products back. …" and the link "Your right of withdrawal" | The settings: the return window in days |

| State | What shows |
| --- | --- |
| The settings cannot be loaded | Fee: "The delivery fee is shown in your cart before you order." Time: "The delivery time is shown at checkout and on your order." Returns: "Please contact us if something is wrong with your delivery." The page never shows the error page |
| No fee step in the settings | The same fee sentence |
| A return window of 0 days | The same returns sentence |
| No estimate in this language | The same time sentence |

## Rules

| Case | What happens | Decided by |
| --- | --- | --- |
| The fee steps, the estimate, the return window, the box rules | Printed as sent; the shop computes no fee | The API (`GET /v1/store/settings`); see [Shipping](shipping.md) |
| Which fee section shows | The box rules when the settings say `shipping.boxBased` and carry both `feeTiers` and `boxCapacity`; else the flat steps | `src/app/[locale]/(shop)/delivery-and-payment/page.tsx` |
| The label of a flat fee step | Steps sorted by `minOrderValue`; the first reads "under {next}", a middle one "{from} to under {to}", the last "from {from}" | The page |
| The label of a box fee step | Tiers sorted by `upTo`, the open one last; "up to {amount}", the open one "above {previous}", a single open tier "any order value" | The page |
| A fee of 0 | "Free", in green | The page |
| Whether the coins section shows | Only when `GET /v1/store/rewards/program` answers `enabled: true`; off, missing or unreachable all hide it | `programOf` in the "How it works" page |

Worked example with the settings of the mock API (`deliveryFee.tiers`: `{ "minOrderValue": 0, "fee": 499 }`, `{ "minOrderValue": 5000, "fee": 0 }`; estimate "2 to 4 working days"; `returns.windowDays` 14):

| Order value | Delivery fee |
| --- | --- |
| under €50.00 | €4.99 |
| from €50.00 | Free |

## Data and API

| Call | Made by | Kept | When it fails |
| --- | --- | --- | --- |
| `GET /v1/store/settings` | The server (`getSettings` in `src/features/catalogue/data.ts`), for "Delivery and payment" | 300 seconds (`REVALIDATE.settings`, tag `settings`) | `null`: the fallback sentences above |
| `GET /v1/store/rewards/program` | The server, for "How it works" | 300 seconds | No coins section |

"Delivery and payment" exports `revalidate = 300`, so a change of the fees in the admin panel shows within five minutes. Both pages are in the sitemap. The browser calls nothing.

## Ways to reach Radhe Foods

| Way | State in the shop |
| --- | --- |
| Problem report on a delivered order | Built, for signed-in customers: what went wrong, a text, photos. See [Returns and reports](returns-and-reports.md) |
| Return request | Built, for signed-in customers, within the return window. See [Returns and reports](returns-and-reports.md) |
| Support email address | Configured with `NEXT_PUBLIC_SUPPORT_EMAIL` (`env.supportEmail` in `src/config/env.ts`). Its only use is the `email` field of the `Organization` structured data on the home page (`organizationJsonLd` in `src/lib/seo/json-ld.tsx`), left out when the variable is empty. No page shows it: not the footer, not an error page, not the account |
| WhatsApp | No button and no chat. `NEXT_PUBLIC_FEATURE_WHATSAPP=true` shows, in the profile of the account, a WhatsApp number and the consent "Yes, tell me by WhatsApp when my order is on its way." (`src/components/account/profile-view.tsx`). That is a choice about messages from Radhe Foods, not a way to write to it. See [Account](account.md) |
| The footer | The logo, one sentence about the shop, the three link columns, the copyright line and "All prices include tax." No address, phone number or email address |
| The legal notice | The page for the provider's contact details. From the file of the shop it shows placeholders for the phone number and the email address until they are filled in or the text is published in the admin panel. See [Legal pages](legal-pages.md) |
| The reference of an error | An unexpected error shows "Reference for our support: {requestId}", a number to quote; no address stands beside it. See [Error pages](error-pages.md) |

Several texts ask the customer to "contact us" or "contact Radhe Foods" (a return window of 0 days, a blocked account, an order that can no longer be cancelled, an item too heavy to ship, an account that cannot be deleted yet). None of them carries a link or an address.

## Not built

Confirmed by a search of `src` for contact pages, `mailto:`, `tel:`, `wa.me` and the names of chat services:

- A contact page or contact form.
- A live chat or a chat widget.
- A WhatsApp button or link to a chat with Radhe Foods.
- A phone number or a visible support email address anywhere in the frame of the shop.
- A problem report or a return request for an order placed as a guest, and a message to Radhe Foods that is not about a delivered order.
- A search within the help pages, and help texts the admin can edit apart from the FAQ and the legal pages.

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(shop)/how-it-works/page.tsx` | The steps, the coins section, the six fixed questions with their structured data |
| `src/app/[locale]/(shop)/delivery-and-payment/page.tsx` | The six sections with the figures of the settings and their fallbacks |
| `src/features/catalogue/data.ts` | `getSettings`: the settings, `null` when they do not arrive |
| `src/components/rewards/rewards-rules.tsx` | The rules of the coins programme as shown on "How it works" |
| `src/components/shell/footer.tsx` | The help column |
| `src/config/env.ts` | `supportEmail`, `features.whatsapp`, `isFeatureEnabled` |
| `src/lib/seo/json-ld.tsx` | `organizationJsonLd`: the one place the support address is used |
