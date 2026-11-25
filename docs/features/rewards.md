# Coins

The loyalty program: a signed-in customer collects coins (for delivered orders, the sign-up, invitations and published reviews) and redeems them on the checkout page for money off the goods. The admin sets every rule and can switch the program off; the API counts, prices and expires the coins. The shop shows the balance, the rules in words, the history, and the control that puts coins on a bill. Nothing about coins is calculated in the browser.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | 2026-11-02 |
| **Pages** | `/en/account/coins` · `/de/konto/coins`; a box on `/en/checkout` · `/de/kasse`; a section on `/en/how-it-works` · `/de/so-funktionierts`; a tile on `/en/account` · `/de/konto` |
| **Code** | `src/components/account/rewards-view.tsx`, `src/components/rewards/rewards-rules.tsx`, `src/components/checkout/redeem-coins.tsx`, `src/features/account/rewards.ts`, `src/components/cart/bill-summary.tsx` (the bill row) |
| **API** | [Rewards](../api/endpoints.md#rewards) |
| **State** | The API. TanStack Query entries `["account", "rewards"]` (fresh for 30 seconds) and `["account", "rewards", "history"]`; the coins chosen for an order are kept with the cart by the API |
| **Texts** | `rewards`, `checkout.rewards`, `cart` (`coinsRedeemed`), `account` (`overview.coins`, `nav.coins`), `auth` (`welcomeCoins`), `shipping` (`lostByCoins`) |
| **Tests** | `e2e/rewards.spec.ts`, `mocks/rewards.test.ts` |
| **Backend reference** | [reference/backend/rewards.md](../reference/backend/rewards.md), [reference/backend/store-api.md](../reference/backend/store-api.md) (section 24) |

The visible word is "Coins" in both languages.

## What the customer sees

### The coins page of the account

`RewardsView` in `src/components/account/rewards-view.tsx`: "Your coins" with "Collect coins with every delivered order and redeem them on the checkout page for money off the goods."

| Region | Content |
| --- | --- |
| The balance card | "Your balance" with `account.available` large and "coins"; "Earned in all" (`earnedTotal`); "Redeemed in all" (`redeemedTotal`); "Held by an unpaid order" (`reserved`) while above zero |
| Notes, each only in its case | "The coins program is paused at the moment. Your balance stays." (program off) · "Your coins expire on 2 May 2027." (`account.expiresAt`) · "After a credit, 12 coins more were taken back than you had. New coins make up for them first." (`account.balance` below zero) · "You can redeem from 200 coins on." (program on, `reason` is `below_min_coins`) · "Redeem your coins on the checkout page." (`canRedeem`) |
| "How it works" | While the program is on: the rules in two cards, "Collect" and "Redeem" (below) |
| "History" | One row per movement, newest first, 20 at a time with "Load more": what it was, the day, "Held" while the coins are reserved by an unpaid order, and the coins with their sign (earned in green) |

| State | What shows |
| --- | --- |
| Loading | Two grey blocks; two grey rows for the history |
| No movement yet | "No coins have moved yet. Your first delivered order brings the first ones." |
| The balance or the history fails | "We could not load your coins." with "Try again" |

The labels of the history, by the API's `type`:

| `type` | Label |
| --- | --- |
| `welcome` | Welcome coins |
| `order` | Order RF-1084 |
| `referral_inviter` | A friend's first order |
| `referral_invitee` | Invited by a friend |
| `review` | Review of RF-1084 |
| `redeem` | Redeemed on RF-1085 |
| `redeem_return` | Returned from RF-1085 |
| `reversal` | Taken back |
| `adjustment` | Adjusted by Radhe Foods |
| `expiry` | Expired |

A row that names an order links to it.

### The rules in words

`RewardsRules` (`src/components/rewards/rewards-rules.tsx`) turns the program of the API into sentences. A rule that is switched off (`null`, or 0) has no line. The same component serves the coins page and the public "How it works" page.

| Card | Line | From |
| --- | --- | --- |
| Collect | "1 coin per euro of goods, counted when the order is delivered." | `earning.order.coinsPerEuro` |
| Collect | "Right now 2 × the coins per euro (Diwali) until 12 November 2026." | `earning.campaign`, while `active`; name and end only when set |
| Collect | "100 coins for creating your account." | `earning.welcome` |
| Collect | "100 coins when a friend's first order is delivered." | `earning.referral.inviter` |
| Collect | "50 coins when you sign up with a friend's link." | `earning.referral.invitee` |
| Collect | "25 coins for a published review." | `earning.review` |
| Redeem | "100 coins take 1% off the goods of an order." | `redemption.percentPerCoin` |
| Redeem | "At most €5.00 per order." · "At most 500 coins per order." | `maxDiscount` · `maxCoinsPerOrder` |
| Redeem | "Redeem from 200 coins on." · "Redeem from a value of €1.00 on." · "For goods worth €20.00 or more." | `minCoins` · `minRedeemValue` · `minOrderValue` |
| Redeem | "Can be combined with a discount code." or "Not together with a discount code." | `combinableWithDiscountCodes` |
| Redeem | "Coins cannot be redeemed at the moment." | `redemption` is `null` |
| Redeem | "Coins expire after 12 months without earning or redeeming." | `expiry.inactivityMonths` |

The numbers above are examples; every one comes from the program.

### Coins at the checkout

`RedeemCoins` (`src/components/checkout/redeem-coins.tsx`) stands in the summary "Your order", under the discount code, for signed-in customers. What it shows follows `bill.rewards`:

| `bill.rewards` | What shows |
| --- | --- |
| Absent or `null` (a guest, or an API without the program) | Nothing |
| `applied: false`, `maxCoins` above 0 | The box "Redeem coins": "You have 340 coins." (the balance, from `GET /v1/store/me/rewards`; left out when that call fails), "Redeem up to 300 coins for €3.00." (`maxCoins`, `maxAmount`), a number field that starts at the most allowed, "Redeem", and the link "Redeem all" |
| `applied: true` | One row: "300 coins redeemed", "You save €3.00." and "Remove" |
| `maxCoins` 0 with a `reason` | One grey line with the reason; nothing for `no_coins` |

The figures are examples; each is the bill's own. Once coins are on the bill, the totals carry the row "Coins redeemed (300)" with the amount as a minus (`BillTotals`; also on the cart page and on the order). Under the totals of the checkout, while `bill.rewards.earn` is above zero: "You will earn 26 coins with this order."

The reasons, as worded on the checkout:

| `reason` | Text |
| --- | --- |
| `disabled` | Coins cannot be redeemed at the moment. |
| `no_coins` | You have no coins to redeem. |
| `below_min_coins` | You do not have enough coins to redeem yet. |
| `below_min_order` | The goods in the cart are worth less than coins require. |
| `below_min_value` | Your coins are not worth enough yet to be redeemed. |
| `code_applied` | Coins cannot be combined with a discount code. |
| `too_small` | These coins would take nothing off this order. |
| `insufficient` | You do not have that many coins. |

### Elsewhere

| Place | What shows |
| --- | --- |
| The account's overview | A fifth tile "Coins" with the balance and "Redeem at the checkout"; in the invitation box "A friend's first delivered order earns you coins." |
| The account's navigation | The entry "Coins" |
| After the code of the sign-up | "You received 100 coins. Redeem them on the checkout page." ([authentication.md](authentication.md)) |
| The referral page | "You receive 100 coins when a friend's first order is delivered." ([referrals.md](referrals.md)) |
| "How it works" | The section "Collect coins" with the rules and the link "Your coins" |

## Rules

### Where the shop reads the switch

The program is switched on and off in the admin panel. The shop has no setting of its own; each place reads the API's word for it.

| Place | Reads | While the program is off |
| --- | --- | --- |
| The tile of the overview, the note of the invitation box | `rewards.enabled` of `GET /v1/store/me/overview` | No tile, no note |
| The entry "Coins" of the navigation | `rewards.enabled` or `rewards.available > 0` of the overview | Listed only while the customer still has coins |
| The coins page | `program.enabled` of `GET /v1/store/me/rewards` | The balance and the history stay; "The coins program is paused at the moment. Your balance stays."; no rules |
| The box of the checkout | `bill.rewards` | "Coins cannot be redeemed at the moment." when the bill says `disabled`; nothing when the bill has no `rewards` |
| "You will earn …" | `bill.rewards.earn` | No line |
| The referral page | `program.enabled` of `GET /v1/store/me/rewards` | No line about coins |
| "How it works" | `program.enabled` of `GET /v1/store/rewards/program` | No coins section (also on `404` and when the API is away) |
| The sign-up | `rewards.welcomeCoins` of the answer to the code | No line |

An API that does not know coins at all leaves the fields out; every place then shows nothing.

### Redeeming

| Case | What happens | Decided by |
| --- | --- | --- |
| How many coins a cart takes, and what they are worth | `maxCoins`, `maxAmount`, `coins`, `amount` of the bill | The API |
| "Redeem" with a typed number | Sent as typed; a number above the most allowed is cut down by the API | The API |
| The typed value is not a whole number from 1 up | Not sent: "Enter a whole number of coins, 1 or more." | The browser |
| "Redeem all" | The request goes without a number: as many as the rules allow | The API |
| The API refuses (`REWARDS_NOT_APPLICABLE`) | Its reason under the field | The API |
| "Remove" | The bill comes back without coins | The API |
| Coins and a discount code together | Only when the program allows it; otherwise the bill says `code_applied` | The API |
| The coins lowered the goods so far that a box is no longer free | A note above the totals: "With these coins one box is no longer free. Add €4.20 more to get it free again." ([shipping.md](shipping.md)) | The API's bill; the browser compares the bill before and after |
| The coins stopped applying when the order is placed | The API takes them off the cart and refuses the order (`REWARDS_NOT_APPLICABLE`); the page loads the bill again and says "Your coins were not redeemed", the reason, and "You can place the order without them." | The API |
| When coins are held, spent, given back, earned and expired | [rewards.md](../reference/backend/rewards.md) | The API |

### What the browser formats

- **"100 coins take 1% off"**: `percentPerCoin × 100`, printed with up to four decimals. With `percentPerCoin` 0.01 the line reads "100 coins take 1% off the goods of an order." (German: "1 %").
- **The sign of a history row**: `coins` of 100 shows as "+100", of -56 as "−56".
- **The balance** is printed with the thousands separator of the language (1,240 in English, 1.240 in German).

## Data and API

```
coins page     GET    /v1/store/me/rewards                         balance, totals, canRedeem, the program
               GET    /v1/store/me/rewards/transactions?page=1&limit=20   the history, page by page
checkout       GET    /v1/store/cart                               the bill with its `rewards`
               GET    /v1/store/me/rewards                         only while the box is offered, for the balance
               PUT    /v1/store/checkout/rewards   { coins } | {}  -> the bill with the coins priced in
               DELETE /v1/store/checkout/rewards                   -> the bill without them
how it works   GET    /v1/store/rewards/program                    on the server, cached like the settings
overview       GET    /v1/store/me/overview                        `rewards.enabled`, `rewards.available`
```

- Every answer of the two checkout calls is the whole bill; it replaces the bill on the page and in the cache, so the row and the total change at once.
- The history is read again at every visit; the balance is reused for 30 seconds.
- An error that is not a refusal (network, rate limit) shows as an alert under the box.

## Behaviour

- The box is a small form: Enter in the field redeems. The field is a number input with the numeric keyboard; its refusal is announced and tied to the field (`aria-invalid`, `aria-describedby`).
- "Remove" is named "Remove the coins" for screen readers.
- The box and the discount code share one compact field style (`compactInput` in `src/components/checkout/discount-code.tsx`).
- The two rule cards stand side by side from `sm`.

## Not built

- Coins for guests: a guest order neither earns nor redeems.
- Redeeming on the cart page: the cart shows the redeemed row, the control is at the checkout.
- "You will earn …" on product cards, the product page, the cart and the order page.
- Levels or tiers, gifting coins to someone else, and redeeming for anything but money off the goods.
- A setting in the shop to switch the program: the API's word is the only switch.

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(shop)/account/coins/page.tsx` | The coins page |
| `src/components/account/rewards-view.tsx` | The balance, the notes, the rules, the history |
| `src/components/rewards/rewards-rules.tsx` | The rules of the program in words |
| `src/components/checkout/redeem-coins.tsx` | The box of the checkout |
| `src/components/checkout/checkout-view.tsx` | Places the box, the "You will earn" line and the note when coins stopped applying |
| `src/components/cart/bill-summary.tsx` | The row "Coins redeemed" of every bill |
| `src/features/account/rewards.ts` | `useMyRewards` and its cache key |
| `src/app/[locale]/(shop)/how-it-works/page.tsx` | Reads the public program and shows the rules |
| `src/components/account/overview.tsx` | The coins tile |
| `src/components/account/account-shell.tsx` | The entry "Coins" |
