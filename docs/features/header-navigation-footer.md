# Header, navigation and footer

The frame of every shop page: the strip with the promises of the shop, the header with the search and the icons, the category bar with its panels, the menu and the tab bar of phones, the footer, and the small helpers that belong to every page (skip link, loading line, cookie notice). Every visitor sees it. The checkout and the unsubscribe page have frames of their own ([Checkout](checkout.md), [Email unsubscribe](email-unsubscribe.md)).

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | The original plan, before 2026-10-11 (the log gives no day); the category groups since 2026-11-11 |
| **Pages** | Every page under `src/app/[locale]/(shop)` |
| **Code** | `src/app/[locale]/layout.tsx`, `src/app/[locale]/(shop)/layout.tsx`, `src/components/shell`, `src/features/catalogue/navigation.ts`, `src/lib/navigation` |
| **API** | [Catalogue](../api/endpoints.md#catalogue) (categories), [Settings and legal texts](../api/endpoints.md#settings-and-legal-texts) |
| **State** | `localStorage` `rf.cookie-notice.v1` (cookie notice read); the open panel, menu and group in component state; counts from the cart and the wishlist stores |
| **Texts** | `nav`, `common`, `home` (the promises), `footer`, `cookieNotice`, `language`, `site` |
| **Tests** | `e2e/catalogue.spec.ts` ("the category navigation"), `e2e/polish.spec.ts`, `e2e/accessibility.spec.ts`, `src/features/catalogue/navigation.test.ts`, `src/features/catalogue/delivery-promise.test.ts` |
| **Backend reference** | [store-api.md](../reference/backend/store-api.md) (sections 6 and 7), [legal-pages.md](../reference/backend/legal-pages.md) |

## What the customer sees

From the top of the page to its foot:

| Part | Component | Screens |
| --- | --- | --- |
| Skip link "Skip to content" | `src/app/[locale]/layout.tsx` | All; visible on keyboard focus only |
| Loading line | `NavigationProgress` in `src/components/shell/navigation-progress.tsx` | All |
| Promise strip | `Header` in `src/components/shell/header.tsx` | From `lg` |
| Header bar: logo, search, language, wishlist, account, cart, menu button | `Header` | All (account and cart from `md`, menu button below `lg`) |
| Category bar with its panels | `CategoryNav` in `src/components/shell/category-nav.tsx` | From `lg` |
| Invitation line | `InvitationNotice` in `src/components/shell/invitation-notice.tsx` | All; see [Referrals](referrals.md) |
| The page (`main`, the target of the skip link) | – | – |
| Footer | `Footer` in `src/components/shell/footer.tsx` | All |
| Messages about a failed change | `CartProblem`, `WishlistProblem` (both use `ProblemToast`) | All; see [Cart](cart.md), [Wishlist](wishlist.md) |
| Cart bar of phones | `CartSummaryBar` | See [Cart](cart.md) |
| Tab bar | `TabBar` in `src/components/shell/tab-bar.tsx` | Below `md` |
| Cookie notice | `CookieNotice` in `src/components/shell/cookie-notice.tsx` | All, until "OK" |

### Promise strip

Three centred promises, each with an icon: "Secure payment at checkout", "Delivery across Germany" and "Free delivery from {amount}". The third appears only when the settings name an amount (`deliveryFee.freeFrom`); where delivery is priced by the box it reads "Free delivery from {amount} per box (up to {weight})". The strip is not part of the sticky header and scrolls away.

### Header bar

| Element | Component | Behaviour |
| --- | --- | --- |
| Logo | `Logo` in `src/components/shell/logo.tsx` | Links to the home page; spoken "Radhe Foods, to the home page" |
| Search field | `SearchForm` | See [Search](search.md). Beside the logo from `lg`; a full row under it below |
| Language switch | `LocaleSwitcher` in `src/components/shell/locale-switcher.tsx` | EN and DE as a segmented control; leads to the same page in the other language |
| Wishlist | `WishlistLink` in `src/components/shell/wishlist-link.tsx` | A heart for everyone, to `/en/wishlist` · `/de/merkliste`; a wheat bubble counts the saved products ("99+" above 99) |
| Account | `AccountLink` in `src/components/shell/account-link.tsx` | To `/en/account` · `/de/konto`; a green dot while signed in; the tooltip says "Sign in" or the customer's first name |
| Cart | `CartLink` in `src/components/shell/cart-link.tsx` | To `/en/cart` · `/de/warenkorb`; the bubble counts units, not lines ("99+" above 99); the place a product's picture flies to |
| Menu button | `MobileMenu` in `src/components/shell/mobile-menu.tsx` | Opens the category sheet |

The bubbles show nothing while their store is still loading or the count is 0; the spoken label always carries the count ("Cart, 3 items", "Cart, empty"). From `md` the header (bar and category bar) sticks to the top of the window; on phones it scrolls away and the tab bar takes over.

### Category bar and its panels (the mega menu)

One row: "All products" first, then the items `navItems` builds from the parent categories of the API.

| Item | Is | Opens |
| --- | --- | --- |
| A group ("Rice, Flour & Dal") | A button with a chevron | A panel with the group's categories |
| A category that stands alone | A link to its page, with a chevron button beside it when it has sub-categories | A panel with that category |
| "More" | A button | What no group knows; below `xl` also the groups the bar has no room for, each under its group's name |
| "All categories" | A button | Every category, when no group knows any of them |

A panel is a solid white sheet as wide as the page under the bar. Each category is a block: its name with its product count as the link to its page, over a hairline, and under it its sub-categories (and theirs) with their counts. The foot reads "{n} categories, {m} products" (`nav.groupSummary`) and links "All categories" to the page of all categories. The page behind dims while a panel is open.

| Way | Opens | Closes |
| --- | --- | --- |
| Mouse | Resting on an item for 90 ms | 220 ms after the pointer left the item and its panel |
| Press or tap | On the group button or the chevron | The same press again; a press anywhere outside the bar. A press on an item the pointer had opened keeps it open |
| Keyboard | Enter or Space on the button; arrow down opens and moves into the panel | Escape (focus returns to the item); focus leaving the item |
| Following a link | – | Always |

Keyboard along the bar: arrow left and right, Home and End move between the items shown at this width; Tab walks the bar and the links of an open panel. The item that holds the page's category carries `aria-current` and the leaf tint.

### Phone menu

Below `lg` the menu button opens a sheet titled "Categories" (`MobileMenuPanel` in `src/components/shell/mobile-menu-panel.tsx`) with the same items as the bar and nothing else:

- A group is a row with its label and, under it, the names of its categories joined by " · ". A tap folds it open, one group at a time, and scrolls it into view: each category as a link with its count, its sub-categories as chips.
- A category that stands alone is a row that leads to its page, with a chevron that folds out its sub-categories.
- Opened on a category page, the group of that category is open.

The panel's code is fetched when the button is first touched, hovered or focused, not with every page.

### Tab bar

Four tabs on a floating glass bar, below `md`:

| Tab | Leads to | Active on |
| --- | --- | --- |
| Shop | Home page | The home page, a category page, a product page |
| Search | `/en/products` · `/de/produkte` | The product list |
| Cart | The cart, with the unit bubble | The cart |
| Account | The account, with the green dot | Every account page |

### Footer

One frosted panel with four columns and a line of small print.

| Column | Content |
| --- | --- |
| Brand | The logo and `footer.about` |
| "Shop" | "All products", then every parent category the API answers, in its order |
| "Help" | "How it works", "Delivery and payment", "FAQ", "Blog", "Your account" |
| "Legal" | The legal pages, see the rules |
| Small print | "© {year} Radhe Foods" and "All prices include tax." |

### Cookie notice, skip link, loading line

- **Cookie notice.** A small panel (bottom left from `sm`, above the tab bar on phones) with the text `cookieNotice.text`, the button "OK" and the link "Details" to `/en/legal/cookies` · `/de/rechtliches/cookies`. It is a notice, not a consent banner: the shop uses no analytics.
- **Skip link.** The first focusable element of every page; it jumps to `#main`.
- **Loading line.** A 3 px leaf line at the top of the window after a click on a link of the shop, until the address has changed.

## Rules

| Case | What happens | Decided by |
| --- | --- | --- |
| Names, order, pages and counts of categories | Shown as answered | The API |
| Which group a parent category belongs to | The first group of `NAV_GROUPS` that knows a word of the category's English slug; none: "More" | The browser (`src/features/catalogue/navigation.ts`) |
| Six parent categories or fewer | No groups: every category is an item | The browser (`MAX_UNGROUPED`) |
| A group with one category | Shown as that category | The browser |
| Below `xl` (80 rem), more than five items | The first four stay, the others share "More" (`collapseTail`, `NARROW_VISIBLE`); done in CSS, both versions are in the HTML | The browser |
| Empty categories | Listed in the bar, the phone menu and the footer, with their count | The browser |
| Legal links of the footer | The pages the API lists as published, plus imprint, right of withdrawal and cookies, in a fixed order (`footerLegalPages` in `src/lib/legal/pages.ts`); when the API did not answer: terms and privacy with those three | The API publishes, the shop orders; see [Legal pages](legal-pages.md) |
| Language switch on a product or category page | Uses the address of the other language the page hands over (`LocaleAlternates`); elsewhere the same address pattern | The browser |
| Cookie notice read before | Never drawn: a script in the page marks `html` before the first paint and a style rule hides the notice | The browser |
| Storage blocked | The notice is not shown at all | The browser |
| Loading line | Starts only for a plain left click on a same-origin link to another path or query; appears after 150 ms; gives up after 10 s | The browser |

**Worked example, the groups.** The API answers nineteen parent categories (the live catalogue of 2026-11-11). The slug `spices-masalas` splits into "spices" and "masalas"; the group `cooking` knows "spices", so the category stands under "Spices & Pantry". A slug such as `oils-ghee` would go to `staples` ("Rice, Flour & Dal") through "oils". A slug none of whose words is listed goes to "More". With categories in all six groups the bar shows "All products" and six groups from `xl`; below, four groups and "More", whose panel holds the remaining two under their names.

**Worked example, the legal column.** The API lists `terms`, `privacy` and `shipping` as published. The footer links, in this order: Terms and Conditions, Right of withdrawal, Shipping information, Privacy, Cookies, Legal notice. "Refund policy" is missing because its page would answer 404.

## Data and API

| Call | Where | Cached | On failure |
| --- | --- | --- | --- |
| `GET /v1/store/categories` | `src/app/[locale]/(shop)/layout.tsx`, on the server | 300 s, tag `catalogue` | Empty list: no category bar, an empty menu, the footer's "Shop" column holds "All products" alone |
| `GET /v1/store/settings` | The same | 300 s, tag `settings` | The free-delivery promise is left out |
| `GET /v1/store/legal` | The same | See [Legal pages](legal-pages.md) | The fallback of the rules |

The frame never takes a page down: these three readers answer a fallback instead of throwing. The counts of the cart, the wishlist and the signed-in dot come from the browser's stores ([State management](../architecture/state-management.md)).

Every category link of the bar is in the HTML the server sends, in panels that are `hidden` until opened, so a crawler reads the whole tree.

## Behaviour

- **Layers.** The header is above the page (`z-40`); panels and the search dropdown above it (`z-50`); the dimmed page below both (`z-30`); the loading line on top of everything.
- **Motion.** Panels and sheets use the shared animations of the [design system](../design-system/motion.md); the reduced-motion preference stills them.
- **Screen reader.** The strip is a region named after the shop; the bar is a navigation "Categories", the tab bar "Quick navigation", the language switch "Switch language"; group buttons carry `aria-expanded` and `aria-controls`; a section of the "More" panel is a group named by its caption; product counts in the panels are hidden from speech. Closing the phone menu returns the focus to the menu button.
- **Phones.** The footer keeps room at its foot for the tab bar and the bars above it.

## Not built

- A WhatsApp button. The flag `whatsapp` of `src/config/env.ts` only shows the WhatsApp preference in the profile ([Account](account.md)).
- Contact details, payment marks, social links or a newsletter field in the footer. The payment marks stand on the product page and at the checkout.
- Pictures or icons of categories in the panels.
- A cart preview on hover (mini cart): the icon leads to the cart page.
- A choice in the cookie notice: nothing needs consent.
- Groups set by the admin: the grouping is the shop's file.

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/layout.tsx` | The document: skip link, cookie script, `NavigationProgress`, `ReferralCapture`, providers, `CookieNotice` |
| `src/app/[locale]/(shop)/layout.tsx` | The frame of a shop page: header, invitation line, `main`, footer, messages, bars |
| `src/components/shell/header.tsx` | Promise strip, header bar and category bar |
| `src/components/shell/logo.tsx` | The wordmark from `public/brand` |
| `src/components/shell/search-form.tsx` | The search field and its dropdown |
| `src/components/shell/locale-switcher.tsx` | `LocaleSwitcher`, `LocaleAlternates`, `LocaleAlternatesProvider` |
| `src/components/shell/wishlist-link.tsx` | The heart with `WishlistBadge` |
| `src/components/shell/account-link.tsx` | The account icon with `AccountDot` |
| `src/components/shell/cart-link.tsx` | The cart icon with `CartBadge` |
| `src/components/shell/icon-control.ts` | The shared look of the three icons |
| `src/components/shell/category-nav.tsx` | The category bar: items, panels, hover, press, keyboard |
| `src/components/shell/mobile-menu.tsx` | The menu button; loads the panel on demand |
| `src/components/shell/mobile-menu-panel.tsx` | The category sheet of phones |
| `src/components/shell/tab-bar.tsx` | The tab bar |
| `src/components/shell/footer.tsx` | The footer |
| `src/components/shell/cookie-notice.tsx` | The notice and the script that hides it before the first paint |
| `src/components/shell/navigation-progress.tsx` | The loading line |
| `src/components/shell/invitation-notice.tsx` | The line about a kept referral code |
| `src/components/shell/referral-capture.tsx` | Reads `?ref=` from any address |
| `src/components/shell/problem-toast.tsx` | The red message at the top of the window |
| `src/components/shell/success-toast.tsx` | The green message at the top of the window |
| `src/components/shell/page-error.tsx` | The body of the error page, see [Error pages](error-pages.md) |
| `src/features/catalogue/navigation.ts` | `NAV_GROUPS`, `navItems`, `collapseTail`, `holdsSlug` |
| `src/lib/navigation/shop-link.ts` | A path of the API as a link of the shop (banners) |
| `src/lib/navigation/return-to.ts` | The checked address to return to after signing in, see [Authentication](authentication.md) |
