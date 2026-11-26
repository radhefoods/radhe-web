# Routing

Every page lives under `src/app/[locale]`, so the language is the first part of every address (`/en/…`, `/de/…`). The second part is localised: one table, `src/i18n/routing.ts`, gives each page an internal name used in the code (`/cart`) and its address per language (`/en/cart` · `/de/warenkorb`). `src/proxy.ts` sends a request without a language to the visitor's language and maps a localised address to its page. Three route groups give the pages their frame; whether a page needs a signed-in customer is decided in the browser, never by the proxy or the server.

## Pages

Addresses are written with their placeholders, as in `src/i18n/routing.ts`. `node docs/tools/check-docs.mjs routes` prints the first three columns from the code.

### Shop frame: public pages

Open to everyone and to search engines (a page says `noindex` itself where it has nothing to show or is a filtered view: [SEO](seo.md)).

| File | English | German | The page | Feature |
| --- | --- | --- | --- | --- |
| `src/app/[locale]/(shop)/page.tsx` | `/en` | `/de` | Home page | [Home](../features/home.md) |
| `src/app/[locale]/(shop)/products/page.tsx` | `/en/products` | `/de/produkte` | All products, and the results of a search (`?q=`) | [Catalogue](../features/catalogue.md), [Search](../features/search.md) |
| `src/app/[locale]/(shop)/products/[slug]/page.tsx` | `/en/products/[slug]` | `/de/produkte/[slug]` | A product, at the pack size its slug names | [Product page](../features/product-page.md) |
| `src/app/[locale]/(shop)/category/[slug]/page.tsx` | `/en/category/[slug]` | `/de/kategorie/[slug]` | The products of a category | [Catalogue](../features/catalogue.md) |
| `src/app/[locale]/(shop)/categories/page.tsx` | `/en/categories` | `/de/kategorien` | All categories | [Catalogue](../features/catalogue.md) |
| `src/app/[locale]/(shop)/how-it-works/page.tsx` | `/en/how-it-works` | `/de/so-funktionierts` | The shop explained | [Help and support](../features/help-and-support.md) |
| `src/app/[locale]/(shop)/delivery-and-payment/page.tsx` | `/en/delivery-and-payment` | `/de/lieferung-und-zahlung` | Delivery fees, delivery time, payment | [Help and support](../features/help-and-support.md) |
| `src/app/[locale]/(shop)/faq/page.tsx` | `/en/faq` | `/de/faq` | Questions and answers | [FAQ](../features/faq.md) |
| `src/app/[locale]/(shop)/reviews/page.tsx` | `/en/reviews` | `/de/bewertungen` | The published reviews of orders | [Reviews](../features/reviews.md) |
| `src/app/[locale]/(shop)/blog/page.tsx` | `/en/blog` | `/de/blog` | The blog, with its search | [Blog](../features/blog.md) |
| `src/app/[locale]/(shop)/blog/[slug]/page.tsx` | `/en/blog/[slug]` | `/de/blog/[slug]` | A post | [Blog](../features/blog.md) |
| `src/app/[locale]/(shop)/blog/category/[slug]/page.tsx` | `/en/blog/category/[slug]` | `/de/blog/kategorie/[slug]` | The posts of a category | [Blog](../features/blog.md) |
| `src/app/[locale]/(shop)/blog/tag/[tag]/page.tsx` | `/en/blog/tag/[tag]` | `/de/blog/tag/[tag]` | The posts under a tag | [Blog](../features/blog.md) |
| `src/app/[locale]/(shop)/legal/terms/page.tsx` | `/en/legal/terms` | `/de/rechtliches/agb` | Terms | [Legal pages](../features/legal-pages.md) |
| `src/app/[locale]/(shop)/legal/privacy/page.tsx` | `/en/legal/privacy` | `/de/rechtliches/datenschutz` | Privacy policy | [Legal pages](../features/legal-pages.md) |
| `src/app/[locale]/(shop)/legal/imprint/page.tsx` | `/en/legal/imprint` | `/de/rechtliches/impressum` | Imprint | [Legal pages](../features/legal-pages.md) |
| `src/app/[locale]/(shop)/legal/withdrawal/page.tsx` | `/en/legal/withdrawal` | `/de/rechtliches/widerruf` | Right of withdrawal | [Legal pages](../features/legal-pages.md) |
| `src/app/[locale]/(shop)/legal/shipping/page.tsx` | `/en/legal/shipping` | `/de/rechtliches/versand` | Shipping information | [Legal pages](../features/legal-pages.md) |
| `src/app/[locale]/(shop)/legal/refund-policy/page.tsx` | `/en/legal/refund-policy` | `/de/rechtliches/rueckerstattung` | Refund policy | [Legal pages](../features/legal-pages.md) |
| `src/app/[locale]/(shop)/legal/cookies/page.tsx` | `/en/legal/cookies` | `/de/rechtliches/cookies` | Cookies and storage, from a file of the shop | [Legal pages](../features/legal-pages.md) |
| `src/app/[locale]/(shop)/[...rest]/page.tsx` | any other `/en/…` | any other `/de/…` | Answers "not found" in the shop frame | [Error pages](../features/error-pages.md) |

### Shop frame: pages of one visitor

All say `noindex`. None needs a signed-in customer.

| File | English | German | The page | Who | Feature |
| --- | --- | --- | --- | --- | --- |
| `src/app/[locale]/(shop)/cart/page.tsx` | `/en/cart` | `/de/warenkorb` | The cart | Visitors and customers | [Cart](../features/cart.md) |
| `src/app/[locale]/(shop)/wishlist/page.tsx` | `/en/wishlist` | `/de/merkliste` | The wishlist | Visitors and customers | [Wishlist](../features/wishlist.md) |
| `src/app/[locale]/(shop)/sign-in/page.tsx` | `/en/sign-in` | `/de/anmelden` | Sign-in; takes `?returnTo=` and `?email=` | A signed-in customer is sent on to `returnTo` | [Authentication](../features/authentication.md) |
| `src/app/[locale]/(shop)/sign-up/page.tsx` | `/en/sign-up` | `/de/registrieren` | Sign-up; takes `?returnTo=` and `?ref=` | A signed-in customer is sent on to `returnTo` | [Authentication](../features/authentication.md), [Referrals](../features/referrals.md) |
| `src/app/[locale]/(shop)/forgot-password/page.tsx` | `/en/forgot-password` | `/de/passwort-vergessen` | Asks for the reset email | Everyone | [Authentication](../features/authentication.md) |
| `src/app/[locale]/(shop)/reset-password/page.tsx` | `/en/reset-password` | `/de/reset-password` | Behind the link of the reset email (`?token=`) | Everyone | [Authentication](../features/authentication.md) |
| `src/app/[locale]/(shop)/guest/orders/[orderNumber]/page.tsx` | `/en/guest/orders/[orderNumber]` | `/de/guest/orders/[orderNumber]` | The order of a guest (`?token=`, `?payment=`, `?pay=1`) | Whoever holds the token | [Orders](../features/orders.md) |

### Shop frame: the account

Every page here needs a signed-in customer. `AccountShell` in `src/components/account/account-shell.tsx` asks the API who is here; a visitor is sent to `/en/sign-in?returnTo=…` and comes back to the page (to the order's page from its return and report pages, to the overview from a report's page).

| File | English | German | The page | Feature |
| --- | --- | --- | --- | --- |
| `src/app/[locale]/(shop)/account/page.tsx` | `/en/account` | `/de/konto` | Overview | [Account](../features/account.md) |
| `src/app/[locale]/(shop)/account/orders/page.tsx` | `/en/account/orders` | `/de/konto/bestellungen` | Orders | [Orders](../features/orders.md) |
| `src/app/[locale]/(shop)/account/orders/[orderNumber]/page.tsx` | `/en/account/orders/[orderNumber]` | `/de/konto/bestellungen/[orderNumber]` | An order (`?payment=`, `?pay=1`) | [Orders](../features/orders.md), [Payments](../features/payments.md) |
| `src/app/[locale]/(shop)/account/orders/[orderNumber]/return/page.tsx` | `/en/account/orders/[orderNumber]/return` | `/de/konto/bestellungen/[orderNumber]/ruecksendung` | Ask for a return | [Returns and reports](../features/returns-and-reports.md) |
| `src/app/[locale]/(shop)/account/orders/[orderNumber]/report/page.tsx` | `/en/account/orders/[orderNumber]/report` | `/de/konto/bestellungen/[orderNumber]/problem-melden` | Report a problem | [Returns and reports](../features/returns-and-reports.md) |
| `src/app/[locale]/(shop)/account/reports/page.tsx` | `/en/account/reports` | `/de/konto/meldungen` | Problem reports | [Returns and reports](../features/returns-and-reports.md) |
| `src/app/[locale]/(shop)/account/reports/[issueNumber]/page.tsx` | `/en/account/reports/[issueNumber]` | `/de/konto/meldungen/[issueNumber]` | A problem report (`?photos=failed`) | [Returns and reports](../features/returns-and-reports.md) |
| `src/app/[locale]/(shop)/account/invoices/page.tsx` | `/en/account/invoices` | `/de/konto/rechnungen` | Invoices and credit notes | [Orders](../features/orders.md) |
| `src/app/[locale]/(shop)/account/addresses/page.tsx` | `/en/account/addresses` | `/de/konto/adressen` | Addresses | [Account](../features/account.md) |
| `src/app/[locale]/(shop)/account/profile/page.tsx` | `/en/account/profile` | `/de/konto/profil` | Profile | [Account](../features/account.md) |
| `src/app/[locale]/(shop)/account/referrals/page.tsx` | `/en/account/referrals` | `/de/konto/empfehlungen` | Referral code and invitations | [Referrals](../features/referrals.md) |
| `src/app/[locale]/(shop)/account/reviews/page.tsx` | `/en/account/reviews` | `/de/konto/bewertungen` | The customer's reviews | [Reviews](../features/reviews.md) |
| `src/app/[locale]/(shop)/account/coins/page.tsx` | `/en/account/coins` | `/de/konto/coins` | Coins | [Rewards](../features/rewards.md) |
| `src/app/[locale]/(shop)/account/notifications/page.tsx` | `/en/account/notifications` | `/de/konto/benachrichtigungen` | The pack sizes the customer waits for; the shop's "not found" page, shown in the browser, while the shop does not offer "Notify me" | [Back-in-stock emails](../features/back-in-stock.md) |

### Checkout frame, plain frame, no frame

| File | English | German | The page | Who | Feature |
| --- | --- | --- | --- | --- | --- |
| `src/app/[locale]/(checkout)/checkout/page.tsx` | `/en/checkout` | `/de/kasse` | The checkout | Customers; a visitor chooses sign-in, sign-up or the guest checkout on the page | [Checkout](../features/checkout.md) |
| `src/app/[locale]/(plain)/unsubscribe/[token]/page.tsx` | `/en/unsubscribe/[token]` | `/de/unsubscribe/[token]` | Behind the unsubscribe link of an email | Whoever holds the token | [Email unsubscribe](../features/email-unsubscribe.md) |
| `src/app/[locale]/(plain)/stock-alerts/confirm/page.tsx` | `/en/stock-alerts/confirm` | `/de/stock-alerts/confirm` | Behind the confirmation link of a "Notify me" email (`?token=`) | Whoever holds the token | [Back-in-stock emails](../features/back-in-stock.md) |
| `src/app/[locale]/(plain)/stock-alerts/unsubscribe/page.tsx` | `/en/stock-alerts/unsubscribe` | `/de/stock-alerts/unsubscribe` | Behind the unsubscribe link of a "Notify me" email (`?token=`) | Whoever holds the token | [Back-in-stock emails](../features/back-in-stock.md) |
| `src/app/[locale]/styleguide/page.tsx` | `/en/styleguide` | `/de/styleguide` | The design system on one page, in English, `noindex`, linked nowhere | Developers | [Design system](../design-system/README.md) |

### Files that are not pages

| File | Address | What it is | Described in |
| --- | --- | --- | --- |
| `src/app/api/health/route.ts` | `GET /api/health` | Answers `{"status":"ok"}` while the server runs; asks the API for nothing | [Deployment](../deployment/README.md) |
| `src/app/sitemap.ts` | `/sitemap.xml` | Every indexable address in both languages, written at each request | [SEO](seo.md) |
| `src/app/robots.ts` | `/robots.txt` | Allows everything but the addresses that carry a token | [SEO](seo.md) |
| `src/app/manifest.ts` | `/manifest.webmanifest` | Name, colours and icons for a phone's home screen | [SEO](seo.md) |
| `src/app/favicon.ico`, `src/app/icon.svg`, `src/app/icon.png`, `src/app/apple-icon.png` | Linked from every page by Next.js | The icons | [Icons and images](../design-system/icons-and-images.md) |
| `src/app/[locale]/(shop)/not-found.tsx` | – | The localised "not found" page of the shop frame | [Error pages](../features/error-pages.md) |
| `src/app/[locale]/(shop)/error.tsx`, `src/app/[locale]/(checkout)/error.tsx`, `src/app/[locale]/(plain)/error.tsx` | – | The error page of each frame (`PageError`) | [Error pages](../features/error-pages.md) |
| `src/app/global-error.tsx` | – | The last resort when the frame itself fails, in both languages | [Error pages](../features/error-pages.md) |

## Route groups and layouts

A folder in round brackets groups pages under one layout and is not part of the address.

| Group | Layout | Frame |
| --- | --- | --- |
| – | `src/app/[locale]/layout.tsx` | The root layout: `<html lang>`, texts, providers, cookie notice. `generateStaticParams` names `en` and `de` |
| `(shop)` | `src/app/[locale]/(shop)/layout.tsx` | Header, footer, tab bar, the cart bar of phones; reads categories, settings and the published legal pages |
| `(shop)/account` | `src/app/[locale]/(shop)/account/layout.tsx` | The account's navigation and its guard, inside the shop frame |
| `(checkout)` | `src/app/[locale]/(checkout)/layout.tsx` | A header pill with the logo, the way back to the cart and the language switch; nothing leads away from the order |
| `(plain)` | `src/app/[locale]/(plain)/layout.tsx` | The logo only: no navigation, no cart, no language switch. The pages behind the links of emails that need no sign-in |
| `styleguide` | none of its own | Under the root layout alone; the page writes its own `<main>` |

Every layout and page calls `localeOf(params)` of `src/i18n/locale.ts` first: it answers "not found" for anything that is not a language of the shop (a request like `/favicon.ico` also lands in `[locale]`) and sets the language for static rendering. The providers and frames are listed in the [overview](overview.md#around-every-page).

## The proxy

`src/proxy.ts` is the middleware of `next-intl`, built from the routing table.

| Request | What happens |
| --- | --- |
| No language (`/`, `/products/basmati-rice-5kg`, `/reset-password?token=…`) | Redirect to the visitor's language with path and query kept: the language chosen before (cookie `NEXT_LOCALE`), then the browser's, then English. This is how the links of the API's emails and the way back from Stripe, which carry no language, arrive |
| A localised address (`/de/warenkorb`) | Rewritten to its page (`[locale]/(shop)/cart`) |
| An address of the other language or the internal name under a language (`/de/cart`) | Redirect to the address of that language (`/de/warenkorb`) |
| An address the table does not know (`/en/styleguide`) | Passed on as it is |

The matcher leaves out `/api`, `/_next`, `/_vercel` and every path with a dot (files, `robots.txt`, `sitemap.xml`); it names `/unsubscribe/:token*` and `/(en|de)/unsubscribe/:token*` explicitly, because an unsubscribe token contains a dot. `alternateLinks` is off: pages and the sitemap name their other language themselves, with the slug of that language ([SEO](seo.md)).

## Redirects and rewrites

`next.config.ts` defines redirects and no rewrites. They run before the proxy.

| From | To | Kind | When |
| --- | --- | --- | --- |
| Any path on the bare domain | The same path on `www` | Permanent | Only when `NEXT_PUBLIC_SITE_URL` is an `https` address that starts with `www.` ([configuration](configuration.md)) |
| `/legal/preorder-terms`, `/en/legal/preorder-terms` | `/en/legal/terms` | Permanent | Always |
| `/de/rechtliches/vorbestellbedingungen` | `/de/rechtliches/agb` | Permanent | Always |

Pages redirect themselves where one thing has several addresses:

| Page | Redirect | Why |
| --- | --- | --- |
| Product, category, blog post, blog category | `permanentRedirect` to the slug the API names for this language | The API answers to the slug of either language (and to a product's base slug); a page has one address per language |
| Blog tag | `permanentRedirect` to the tag in lower case | One address per tag |
| Account pages | `router.replace` to sign-in, in the browser | No session |
| Sign-in, sign-up | `router.replace` to `returnTo` | Already signed in, or signed in on the page |

`returnTo` is checked by `parseReturnTo` in `src/lib/navigation/return-to.ts`: only a fixed list of pages and the page of one order are accepted; anything else leads to `/account`. A page number beyond the last page of a list, an unknown slug and an unpublished legal page answer `notFound()`.

## How links are built

Links never name a language or a localised path. `src/i18n/navigation.ts` exports `Link`, `redirect`, `permanentRedirect`, `usePathname`, `useRouter` and `getPathname`, made by `createNavigation(routing)`; they take the internal name and write the address of the current language.

| Link to | Written as |
| --- | --- |
| A fixed page | `<Link href="/cart">` |
| A page with a placeholder | `href={{ pathname: "/products/[slug]", params: { slug } }}` |
| A list in a state | `href={{ pathname: "/reviews", query: { rating: "5" } }}` |
| The same page in the other language | `<Link href={…} locale="de">` |
| An address as text (form action, `window.location`) | `getPathname({ href, locale })` |
| An absolute address (canonical, Open Graph, sitemap) | `pageUrl(href, locale)` in `src/lib/seo/alternates.ts` |

`Pathname` in `src/i18n/routing.ts` is the union of the internal names, so a link to a name the table does not hold is a type error. `usePathname` of `src/i18n/navigation.ts` answers the internal name, without the language and unlocalised (`/sign-up` on `/de/registrieren`); on a page with a placeholder it answers the pattern, and `useParams` of `next/navigation` gives the values. Three helpers turn other things into such links: `shopHref` in `src/lib/navigation/shop-link.ts` (a path the API hands out without a language, such as a banner's link), `returnHref` in `src/lib/navigation/return-to.ts` (the checked way back) and `IntentLink` in `src/components/catalogue/intent-link.tsx` (a `Link` that is prefetched only when the visitor shows they mean it).

A page gets its addresses from its row in `src/i18n/routing.ts`; without a row it answers under its folder name in both languages and cannot be linked with the typed `Link` (the style guide is the one such page).

## How an address changes with the language

`LocaleSwitcher` in `src/components/shell/locale-switcher.tsx` links to the same page in the other language.

| Page | The other address |
| --- | --- |
| Most pages | The same internal name with the current placeholders, written in the other language (`/en/cart` ↔ `/de/warenkorb`) |
| Category, blog post, blog category | The page renders `LocaleAlternates` with the slug of each language from the API |
| Product | `PackSizes` in `src/components/catalogue/product-purchase.tsx` renders `LocaleAlternates`: the slugs of the page's pack size, or the slug of the size chosen since, which the product page then redirects to its own language |

The query of the address is not carried over: a filtered list or a search opens unfiltered in the other language. The proxy keeps the last language in `NEXT_LOCALE`. For search engines each page names both addresses itself (`alternates` in `src/lib/seo/alternates.ts`); the texts and the languages are in [internationalisation](internationalization.md).
