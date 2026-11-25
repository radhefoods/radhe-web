# Features and their state

Every feature of the shop, with the state it is in. One document per feature says what it shows, its rules, its calls and its code; this page is the list.

| Status | Means |
| --- | --- |
| **Implemented** | Built in the shop and served by the API |
| **Partially implemented** | Part of it is built; the note says what is missing |
| **Planned** | Wanted by the owner or offered by the API, and not built in the shop |
| **Deprecated** | Still in the code, replaced or switched off |

Two features are built and wait for a switch in the admin panel: **delivery by the box** and **loyalty coins**. The shop shows them the moment the API says they are on, without a release; while they are off, customers see the flat delivery fee and no coins.

## Implemented

### Browsing

| Feature | Status | Since | Note |
| --- | --- | --- | --- |
| [Home page](home.md) | Implemented | 2026-10 | The banners are the admin's; without a live banner a fixed band stands in their place |
| [Header, navigation and footer](header-navigation-footer.md) | Implemented | 2026-10 | The category bar in groups since 2026-11-11 |
| [Search](search.md) | Implemented | 2026-10 | The live dropdown since 2026-10-28 |
| [Catalogue](catalogue.md) | Implemented | 2026-10 | Brands are a filter of the lists; there are no brand pages |
| [Product card](product-card.md) | Implemented | 2026-10-16 | The basket that opens and says "Add" since 2026-11-25 |
| [Product page](product-page.md) | Implemented | 2026-10 | Pictures per pack size since 2026-11-11 |

### Buying

| Feature | Status | Since | Note |
| --- | --- | --- | --- |
| [Wishlist](wishlist.md) | Implemented | 2026-10-19 | Several named lists for customers since 2026-11-01 |
| [Cart](cart.md) | Implemented | 2026-10 | The page in the owner's chosen design since 2026-11-24 |
| [Checkout](checkout.md) | Implemented | 2026-10 | Guest checkout since 2026-11-01; the page in the chosen design since 2026-11-24 |
| [Shipping](shipping.md): the flat fee | Implemented | 2026-10 | What the live shop charges while delivery by the box is off |
| [Shipping](shipping.md): delivery by the box | Implemented, switched off in the live API | 2026-11-20 | `GET /v1/store/settings` answered `shipping.boxBased: false` on 2026-11-25. Switched on in the admin panel (Settings → Shipping) |
| [Discount codes](discount-codes.md) | Implemented | 2026-10-27 | At the checkout only |
| [Payments](payments.md) | Implemented | 2026-10-16 | Stripe Checkout by a redirect; the shop holds no card data and loads no script of Stripe |

### The customer's account

| Feature | Status | Since | Note |
| --- | --- | --- | --- |
| [Authentication](authentication.md) | Implemented | 2026-10-18 | Email and password; the emailed code at the sign-up since 2026-11-01 |
| [Account](account.md) | Implemented | 2026-10 | The overview since 2026-11-01 |
| [Orders](orders.md) | Implemented | 2026-10-16 | Tracking is a link to the carrier; the guest's order page since 2026-11-01 |
| [Returns and problem reports](returns-and-reports.md) | Implemented | 2026-10 | Problem reports since 2026-11-01; neither is offered for a guest's order |
| [Rewards](rewards.md) | Implemented, switched off in the live API | 2026-11-02 | `GET /v1/store/rewards/program` answered `enabled: false` on 2026-11-25. Switched on in the admin panel |
| [Referrals](referrals.md) | Implemented | 2026-11-01 | |
| [Reviews](reviews.md) | Implemented | 2026-11-02 | One review per delivered order; products carry no stars |

### Content and help

| Feature | Status | Since | Note |
| --- | --- | --- | --- |
| [Blog](blog.md) | Implemented | 2026-10-24 | |
| [FAQ](faq.md) | Implemented | 2026-10-24 | |
| [Legal pages](legal-pages.md) | Implemented | 2026-10 | The six pages from the admin panel since 2026-11-11; the cookie page from a file |
| [Email unsubscribe](email-unsubscribe.md) | Implemented | 2026-10 | |
| [Error pages](error-pages.md) | Implemented | 2026-10 | The health route since 2026-11-21 |

## Partially implemented

| Feature | Built | Missing |
| --- | --- | --- |
| [Help and support](help-and-support.md) | The pages "How it works" and "Delivery and payment" | A way to write to Radhe Foods: the shop shows no address, number or form, though several texts say "contact us". The only messages a customer can send are a problem report and a return |
| WhatsApp ([account](account.md)) | The switch `NEXT_PUBLIC_FEATURE_WHATSAPP` and, when it is on, an opt-in for messages in the profile | Everything else: there is no WhatsApp button or chat. The switch is off in production |

## Planned

Named by the owner or prepared in the backend, and not in the shop's code.

| Feature | State |
| --- | --- |
| Back-in-stock notifications ("notify me") | Not built. A size that cannot be ordered shows "Sold out" and nothing more ([product page](product-page.md)). The backend's repository had a stock-alerts module in work, uncommitted, on 2026-11-25 |
| Trustpilot | Not built. The code and the texts do not name it; what customers say comes from the shop's own [order reviews](reviews.md) |
| Discount code and coins on the cart page, "save for later", undo after removing | Shown in the cart design the owner chose and left out when it was built on 2026-11-24, because the shop has no such functions there ([decision log](../decisions/decision-log.md)). Waiting for the owner's word |

## Deprecated

No feature is in this state: what was replaced was removed from the code. Functions and texts that are defined and no longer used are listed in the [audit findings](../archive/2026-11-25-audit-findings.md).

## Removed

What the shop had and has no more. The reasons are in the [decision log](../decisions/README.md).

| Was | Removed | Replaced by |
| --- | --- | --- |
| Pre-orders: cargo cycles, the countdown, paying later by a link | 2026-10-16 | A shop that sells from stock and is paid at the checkout |
| Sign-in with an emailed code, and Google sign-in | 2026-10-18 | [Email and password](authentication.md) |
| The delivery note at the checkout | 2026-10-22 | Nothing |
| The first theme (white pages, two fonts) | 2026-10-31 | [Liquid Glass](../design-system/liquid-glass.md), Inter only |
| Product reviews and order feedback (built 2026-11-01, never in production) | 2026-11-02 | [Order reviews](reviews.md) |
| The sentence with a bar and the per-box bars of the first build of delivery by the box (`ShippingProgress`, `BoxCapacity`) | 2026-11-24 | The card of the boxes under the button ([shipping](shipping.md)) |
| A guest's address card with "Save address" at the checkout | 2026-11-24 | The address typed into the page ([checkout](checkout.md)) |
| "Popular right now" under the list of the cart page (built 2026-11-24) | 2026-11-25 | Nothing: the [cart page](cart.md) suggests no products |

## Not built

Each feature document ends its description with a section "Not built": what a reader might expect there and the shop does not have, each confirmed by a search of the code. The ones asked about most often:

| Not in the shop | See |
| --- | --- |
| Brand pages, a brand index | [Catalogue](catalogue.md) |
| Product reviews and stars | [Reviews](reviews.md) |
| A contact form, a chat, a visible support address | [Help and support](help-and-support.md) |
| A newsletter sign-up for visitors | [Email unsubscribe](email-unsubscribe.md) |
| Tracking inside the shop | [Orders](orders.md) |
| Delivery outside Germany, a choice of delivery date | [Checkout](checkout.md) |
| A mini cart or cart drawer | [Cart](cart.md) |

## Adding a feature

A feature document from the [template](../development/feature-template.md), a row on this page, its rules in the [index of the rules](../business-logic/README.md), its page in [routing](../architecture/routing.md), its calls in [endpoints](../api/endpoints.md). The [standard](../development/documentation-standard.md) has the whole list.
