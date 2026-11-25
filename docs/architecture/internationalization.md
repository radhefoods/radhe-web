# Internationalisation

The shop speaks English and German, and both are first-class: every address carries its language (`/en/…`, `/de/…`), most pages have a German address of their own (`/de/warenkorb`), every text exists in both files of `messages`, and the API is asked for one language per call. English is the default, the language of the shop when nothing else is known. The library is next-intl 4 with localised pathnames.

## The two languages

| | English | German |
| --- | --- | --- |
| Code (`locales` in `src/i18n/routing.ts`) | `en`, the `defaultLocale` | `de` |
| `<html lang>` | `en` | `de` |
| Texts | `messages/en.json` | `messages/de.json` |
| Form of address | – | The formal "Sie" throughout (the owner, 2026-10-04) |
| Open Graph `locale` | `en_GB` | `de_DE` |
| Money | `€19.99` | `19,99 €` |
| Time zone | `Europe/Berlin` in both: deadlines and delivery days are meant in German time |  |

## The files of `src/i18n`

| File | What it is |
| --- | --- |
| `src/i18n/routing.ts` | `locales`, `defaultLocale` and `routing`: every page with its address per language, `localePrefix: "always"`, `alternateLinks: false`. Exports the types `Locale` and `Pathname` |
| `src/i18n/request.ts` | What next-intl loads for a request: the language (English for anything that is not a language of the shop), the texts of that language, the time zone. Named in `next.config.ts` |
| `src/i18n/navigation.ts` | `Link`, `redirect`, `permanentRedirect`, `usePathname`, `useRouter` and `getPathname` that know the languages. Used instead of `next/link` and `next/navigation` everywhere |
| `src/i18n/locale.ts` | `localeOf(params)`: the first line of every page and layout under `src/app/[locale]`. Answers "not found" for anything that is not a language (a request like `/favicon.ico` also lands there) and lets the page be rendered statically |
| `src/i18n/client-messages.ts` | Which namespaces travel to the browser: `clientMessages`, `CLIENT_NAMESPACES`, the type `ClientArea` |
| `src/i18n/area-messages.tsx` | `AreaMessages`: gives the client components of one area their namespaces |
| `src/i18n/types.d.ts` | Makes keys and the language type-checked: a key that is missing in `messages/en.json` is a compile error |
| `src/i18n/messages.test.ts`, `src/i18n/client-messages.test.ts`, `src/i18n/shipping-messages.test.ts` | The tests below |

## How a request gets its language

```
/cart ──▶ src/proxy.ts ──▶ /en/cart or /de/warenkorb   (the language chosen before, then the browser's, then English)
/de/warenkorb ──▶ src/proxy.ts ──▶ the page src/app/[locale]/(shop)/cart with locale = "de"
```

`src/proxy.ts` is the middleware of next-intl, built from `routing`. It handles every address except `/api`, `/_next`, `/_vercel` and files with an extension, plus the unsubscribe link by name, because its token can contain a dot. The language a visitor chose is kept in the cookie `NEXT_LOCALE`. Links in the emails of the API carry no language (`/reset-password?token=…`, `/account/orders/<number>`, `/products/<slug>`); the proxy sends them to the customer's language and keeps path and query.

The root layout (`src/app/[locale]/layout.tsx`) names both languages in `generateStaticParams` and sets `<html lang>`.

## Localised addresses

Code names a page by its internal key, the English pattern; customers see the address of their language. `routing.pathnames` is the one table.

| Key in code | English | German |
| --- | --- | --- |
| `/cart` | `/en/cart` | `/de/warenkorb` |
| `/products/[slug]` | `/en/products/<slug>` | `/de/produkte/<slug>` |
| `/category/[slug]` | `/en/category/<slug>` | `/de/kategorie/<slug>` |
| `/account/orders/[orderNumber]/return` | `/en/account/orders/<number>/return` | `/de/konto/bestellungen/<number>/ruecksendung` |
| `/legal/terms` | `/en/legal/terms` | `/de/rechtliches/agb` |
| `/faq`, `/blog`, `/blog/[slug]`, `/blog/tag/[tag]` | The same path in both languages |  |
| `/reset-password`, `/unsubscribe/[token]`, `/guest/orders/[orderNumber]` | The same path in both: the link of an email is the address |  |

Every page with both addresses is listed in [routing.md](routing.md).

| Rule | Detail |
| --- | --- |
| Links | `<Link href="/cart">` or `<Link href={{ pathname: "/products/[slug]", params: { slug } }}>`; a path that is not a key of the table does not compile |
| `usePathname` | Answers the key (`/cart`), not the address |
| An address for a string | `getPathname({ href, locale })`, as in `src/lib/seo/alternates.ts` |
| Slugs | A product, a category, a blog post and a blog category have a slug per language, given by the API (`slugs`, `alternates`). The API answers to the slug of either language; the page then redirects for good to its own address |
| No `Link` header | `alternateLinks: false`: next-intl would build a second set of `hreflang` links from the pattern, with the slug of the wrong language. The pages and the sitemap name the other language themselves ([seo.md](seo.md)) |

## The language switch

`LocaleSwitcher` in `src/components/shell/locale-switcher.tsx` shows EN and DE as a segmented control, in the header (`src/components/shell/header.tsx`) and in the frame of the checkout. It keeps the customer on the same page:

| Page | Where the other language's address comes from |
| --- | --- |
| Most pages | The current key and parameters, filled into the pattern of the other language |
| Category, blog post, blog category | The page renders `LocaleAlternates` with the slugs of both languages |
| Product | `PackSizes` in `src/components/catalogue/product-purchase.tsx` renders `LocaleAlternates` for the chosen pack size, so the switch keeps the size |

`LocaleAlternates` shows nothing; it hands the addresses to `LocaleAlternatesProvider`, which the root layout mounts, and clears them when the page is left.

## How the language reaches the API

Every endpoint answers in one language ([reference/backend/store-api.md](../reference/backend/store-api.md), section 0.6). `send` in `src/lib/api/http.ts` adds it to each call.

| Way | When |
| --- | --- |
| `?locale=en` or `?locale=de` | The default (`localeAs: "query"`) |
| The header `Accept-Language` | The calls made through `localized` in `src/lib/api/store-api.ts`: the routes whose validation refuses a query field they do not list (sign-up code, account overview and deletion, coins, guest checkout and guest order, the wishlists, referrals, reviews, problem reports) |
| A field of the body | `language` of the two checkout calls, `locale` of the forgot-password call: the language of the emails that follow |

| Caller | Which language |
| --- | --- |
| The server (`serverApi`) | Passed with each call, from `localeOf` |
| The browser (`api`) | The `locale` of the call, else `<html lang>` (`documentLocale` in `src/lib/api/browser.ts`) |

The API does not translate its error messages. The shop translates the `code` with the namespace `errors` and never shows the API's English `message` ([api/error-handling.md](../api/error-handling.md)). A text the API has in one language only is answered for both with its language named (`contentLocale` of a post, `contentLanguage` of a legal text); the page then marks the text with `lang` and, for a post, says so.

## The texts

`messages/en.json` and `messages/de.json` hold every text of the interface in 36 namespaces with the same keys.

| Namespace | Holds |
| --- | --- |
| `site` | The name of the shop and its tagline |
| `language` | The names of the two languages |
| `common` | The skip link, "close", "try again", the search field and its dropdown, "Tax included.", the general error |
| `nav` | Header, tab bar, the groups of the category navigation, the spoken labels of account, cart and wishlist |
| `product` | The add-to-cart control and the stepper, why a size cannot be ordered, the heart of the wishlist, the product page, delivery and payment beside the button (`info`) |
| `catalogue` | Lists: titles, intro texts, descriptions for search engines, pagination, empty lists, the page of all categories |
| `filters` | The filter panel and the sorting |
| `home` | The home page: hero, steps, rows, the carousel, the delivery card |
| `footer` | The footer |
| `cart` | The cart page, the rows of the bill, the problems of a line (`issue`) |
| `shipping` | The boxes of a bill (delivery by the box) |
| `wishlist` | The wishlist page and its lists |
| `auth` | Sign-in, sign-up with its code, forgot and reset password, the messages of their fields |
| `address` | The address form |
| `checkout` | The checkout |
| `legal` | The version line of a legal text and the descriptions of the six legal pages |
| `account` | The frame of the account and its overview |
| `orders` | Orders: list, detail, statuses, cancelling, the guest order (`guest`) |
| `payment` | The payment of an order and the way back from the payment page |
| `documents` | Invoices and credit notes |
| `returns` | Return requests |
| `profile` | Profile, news preferences, sign-out, closing the account (`delete`) |
| `reviews` | Reviews of orders in the account and the public page of reviews |
| `issues` | Problem reports |
| `referral` | The referral page of the account |
| `rewards` | The coins: the account page and the public rules |
| `addressBook` | The addresses of the account |
| `help` | "How it works" (`howItWorks`) and "Delivery and payment" (`delivery`) |
| `faq`, `blog` | The fixed texts of the FAQ and the blog; their content comes from the API |
| `unsubscribe` | The page behind the unsubscribe link |
| `staticLegal` | The titles of the legal pages read from `content/legal` and the note on an unfinished template |
| `cookieNotice`, `invitation` | The cookie notice; the note about a referral code |
| `notFound` | The 404 page |
| `errors` | One sentence per error code of the API, plus `NETWORK_ERROR` and `UNEXPECTED_RESPONSE` |

Not in the files: the manifest (`src/app/manifest.ts`, English), the last-resort error page (`src/app/global-error.tsx`, both languages on one page, since no texts can be relied on there), and the style guide (English only).

## How texts reach client components

A server component reads its texts with `getTranslations` and sends only the finished words. A client component (`useTranslations`) can use only the texts that were sent to the browser, and whatever is sent is part of the page. So `src/i18n/client-messages.ts` sends the dictionary in parts:

| Part | Namespaces | Provided by |
| --- | --- | --- |
| Base, with every page | `errors`, `language`, `common`, `nav`, `product`, `cart`, `cookieNotice`, `invitation` | `NextIntlClientProvider` of `src/app/[locale]/layout.tsx` with `clientMessages(messages)` |
| `catalogue` | `filters` | `AreaMessages` in `src/components/catalogue/product-listing.tsx` |
| `signIn` | `auth` | The sign-in, sign-up, forgot-password and reset-password pages |
| `cart` | `shipping` | The cart page |
| `checkout` | `address`, `checkout`, `shipping` | The layout of the checkout |
| `account` | `account`, `address`, `addressBook`, `documents`, `issues`, `orders`, `payment`, `profile`, `referral`, `returns`, `reviews`, `rewards`, `shipping` | The layout of the account; the guest order page |
| `emailLinks` | `unsubscribe` | The layout of the plain pages |
| `wishlist` | `wishlist` | The wishlist page |

`clientMessages(messages, area)` answers the base namespaces plus those of the area. `AreaMessages` is a server component that wraps its children in a second `NextIntlClientProvider` with that selection, so inside it the base and the area are available, and outside it only the base. The other namespaces (`home`, `catalogue`, `footer`, `help`, `faq`, `blog`, `legal`, `staticLegal`, `notFound`, `site`) never reach the browser. A client component that uses a namespace its area does not carry shows a missing text; the test below catches that before a customer does.

## Message syntax in use

| Feature | Example | Where |
| --- | --- | --- |
| Placeholders | `"searchAll": "View all results for “{q}”"` | Throughout |
| Plurals | `{count, plural, one {# day} other {# days}}`, with `=0` for "empty" in the spoken labels of cart and wishlist | 56 texts in English, 54 in German |
| Ordinals | `{number, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}` | Two English texts of `shipping` ("the 2nd box"); German writes `{number}.` |
| Tags | `<b>`, `<em>` and the like, rendered with `t.rich` or `t.markup` | The hero's title, the bill, the boxes, the checkout, the profile, the sign-up, the referral note |

No `select` is used. Numbers that come from the API are formatted by the shop's own functions before they go into a text.

## Formatting

Money, weights and dates are printed by `src/lib/format`, not by next-intl, so the server and the browser print the same characters.

| What | Function | English | German |
| --- | --- | --- | --- |
| Money | `formatMoney` in `src/lib/format/money.ts` | `€19.99` (`en-DE`) | `19,99 €` (`de-DE`) |
| Price per unit | `formatBasePrice` | `€4.00 / kg`, unit `pc` | `4,00 € / kg`, unit `Stk.` |
| Percent | `formatPercent`, `formatDiscount` | `7%`, `−20%` | `7 %`, `−20 %` (no-break space) |
| Weight | `formatWeight` in `src/lib/format/weight.ts` | `7.5 kg`, `850 g` (`en-GB`) | `7,5 kg`, `850 g` |
| Date | `formatDate` in `src/lib/format/dates.ts` | `28 September 2026` | `28. September 2026` |
| Date and time | `formatDateTime` | `28 Sep 2026, 12:15` | `28. Sept. 2026, 12:15 Uhr` |
| Month | `formatMonthYear` | `November 2026` | `November 2026` |
| Product name | `productTitle` in `src/lib/format/product-name.ts` | `Guava / Jamfal (500g)` in both; the name itself comes translated from the API |  |

Amounts are whole cents passed to `Intl.NumberFormat` as an exact decimal string, so no float is involved. Weights use `en-GB` for English because `en-DE` prints plain numbers with a decimal comma. Dates are always in `Europe/Berlin`; the month names and the punctuation come from a table in the file, because engines spell them differently and the server and the browser would disagree about the same page. The rules behind the numbers are in [business-logic/prices-and-availability.md](../business-logic/prices-and-availability.md).

## Adding a text

1. Add the key to `messages/en.json` and to `messages/de.json`, in the same namespace, with the same placeholders. German addresses the customer as "Sie".
2. In a server component: `getTranslations("namespace")`. In a client component: `useTranslations("namespace")`.
3. When a client component starts using a namespace its area does not carry, add the namespace to `BASE` or to the area in `src/i18n/client-messages.ts`. A component in a folder that belongs to no area gets the base only; a file rendered in another area than its folder is named in `AREA_OF_FILE` of `src/i18n/client-messages.test.ts`.
4. An error code of the API gets its sentence in `errors` of both files.
5. Run `npm run test`.

A page with a German address of its own gets a line in `pathnames` of `src/i18n/routing.ts`, and a row in [routing.md](routing.md).

## Tests

| File | Guards |
| --- | --- |
| `src/i18n/messages.test.ts` | Both files have the same keys; each text uses the same placeholders in both languages; no text is empty; every error code of the API has a sentence in both |
| `src/i18n/client-messages.test.ts` | Reads the source: for every client component it collects the namespaces it and everything it imports use, and checks that its area sends them. Also that the base stays small (`orders`, `checkout` and `shipping` are not in it) |
| `src/i18n/shipping-messages.test.ts` | The texts of delivery by the box written out in both languages with one and with several boxes: plurals, ordinals, the owner's wording |
| `src/lib/format/money.test.ts`, `src/lib/format/weight.test.ts`, `src/lib/format/dates.test.ts`, `src/lib/format/product-name.test.ts` | The formats above |
| `e2e/public.spec.ts` | In a real browser: German pages under their German addresses, the canonical and `hreflang` links of both languages, a text that exists in one language shown and marked in the other |
