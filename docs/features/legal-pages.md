# Legal pages

The seven pages of legal text every visitor can reach from the footer: terms, privacy policy, shipping information, refund policy, right of withdrawal, legal notice (Impressum) and the cookie page. Six are written, versioned and published by Radhe Foods in the admin panel and come from the API; the cookie page describes what the shop itself stores and is a file of the shop.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | 2026-10 (terms and privacy from the API, three pages from files); all six from the API since 2026-11-11 |
| **Pages** | See the table of addresses below |
| **Code** | `src/app/[locale]/(shop)/legal`, `src/components/legal`, `src/features/legal`, `src/lib/legal`, `content/legal`, `scripts/check-content.mjs` |
| **API** | [Settings and legal texts](../api/endpoints.md#settings-and-legal-texts) |
| **State** | None for the pages. The cookie notice remembers "read" in `localStorage` `rf.cookie-notice.v1` |
| **Texts** | `legal`, `staticLegal`, `cookieNotice`, the legal labels of `footer` |
| **Tests** | `e2e/public.spec.ts` ("help and legal pages", "the cookie notice"), `e2e/polish.spec.ts`, `e2e/accessibility.spec.ts`, `src/lib/legal/pages.test.ts`, `src/lib/seo/sitemap.test.ts`, `mocks/legal.test.ts` |
| **Backend reference** | [reference/backend/legal-pages.md](../reference/backend/legal-pages.md), section 6 of [reference/backend/store-api.md](../reference/backend/store-api.md) |

## The seven addresses

| Page | Address | Type in the API | Text comes from | Without a published text |
| --- | --- | --- | --- | --- |
| Terms and Conditions | `/en/legal/terms` · `/de/rechtliches/agb` | `terms` | The API | 404 |
| Privacy policy | `/en/legal/privacy` · `/de/rechtliches/datenschutz` | `privacy` | The API | 404 |
| Shipping information | `/en/legal/shipping` · `/de/rechtliches/versand` | `shipping` | The API | 404 |
| Refund policy | `/en/legal/refund-policy` · `/de/rechtliches/rueckerstattung` | `refund` | The API | 404 |
| Legal notice | `/en/legal/imprint` · `/de/rechtliches/impressum` | `imprint` | The API; until a text is published, `content/legal/imprint.en.md` or `content/legal/imprint.de.md` | The file |
| Right of withdrawal | `/en/legal/withdrawal` · `/de/rechtliches/widerruf` | `withdrawal` | The API; until a text is published, `content/legal/withdrawal.en.md` or `content/legal/withdrawal.de.md` | The file |
| Cookies and storage | `/en/legal/cookies` · `/de/rechtliches/cookies` | – | Always `content/legal/cookies.en.md` or `content/legal/cookies.de.md` | – |

The addresses are fixed in `src/i18n/routing.ts` and are the API's default ones. The admin can change an address in the panel; the shop asks the API by type (`LEGAL_HREF` in `src/lib/legal/pages.ts`), so its pages keep answering under the addresses above and do not follow a changed one.

Three old addresses redirect permanently (`next.config.ts`): `/legal/preorder-terms` and `/en/legal/preorder-terms` to `/en/legal/terms`, `/de/rechtliches/vorbestellbedingungen` to `/de/rechtliches/agb`.

## What the customer sees

### A text published in the admin panel

`LegalDocumentPage` in `src/components/legal/legal-document-page.tsx`, one glass panel in a column of `max-w-3xl`:

1. The title the admin gave the text (the `h1`).
2. The line "Version 2, published on 11 November 2026".
3. The text.

A text that exists in one language only is shown on the page of the other language as well. The API says which language it is (`contentLanguage`); the text then carries that `lang`, and there is no visible note.

### A file of the shop

`StaticLegalPage` in `src/components/legal/static-legal-page.tsx`, in the same panel:

1. The title of the shop: "Legal notice", "Right of withdrawal" or "Cookies and storage".
2. While the file holds an open placeholder, the warning "This page is not complete yet": "The marked parts are placeholders that Radhe Foods still has to fill in."
3. The text. A placeholder is written as inline code holding double square brackets and is shown as a wheat mark with its words, for example "[[Phone number]]".

A file page has no version line. The comment at the head of a file is a note for the editor and is not shown.

### States

| State | What shows |
| --- | --- |
| Terms, privacy, shipping or refund not published | The "not found" page, status 404; the footer does not link it |
| Imprint or withdrawal not published | The file, with the warning while it has placeholders |
| The API cannot be reached | The [error page](error-pages.md) with "Try again" (the cookie page is not affected) |

### How a text is rendered

Both kinds go through `LegalText` in `src/components/legal/legal-text.tsx`: Markdown with tables (`react-markdown`, `remark-gfm`), never HTML (`skipHtml`), so nothing pasted into a text can run in a customer's browser. Plain text is valid Markdown and renders as paragraphs. Headings keep the level the text gives them (`demoteHeadings` is not set here): the files of the shop start at `##`, under the `h1` of the page, and a `#` in a text of the admin would be a second `h1`. A wide table scrolls inside its own box, which takes keyboard focus and is named "Table".

## Rules

| Case | What happens | Decided by |
| --- | --- | --- |
| Which text and which version applies, its title, its publication date | Shown as sent | The API (the admin panel) |
| No published version of a type | `LEGAL_DOCUMENT_NOT_FOUND` counts as "none"; so does `BAD_REQUEST`, which an API that knows only `terms` and `privacy` answers to the other four types | `getLegalDocument` in `src/features/legal/data.ts` |
| Which types fall back to a file | `imprint` and `withdrawal` only (`FILE_UNTIL_PUBLISHED`) | `src/lib/legal/pages.ts` |
| An open placeholder in a file | Warning on the page, `noindex, follow` | `PLACEHOLDER` in `src/components/legal/legal-text.tsx` |
| Which texts are accepted at the checkout | Those the API marks `requiresConsent` | The API; see [Checkout](checkout.md) |

### The links of the footer

The legal column is built by `footerLegalPages` from the list of published pages (`GET /v1/store/legal`), always in this order: terms, withdrawal, shipping, refund, privacy, cookies, imprint. The labels are the shop's own short ones from `footer` ("Terms and Conditions", "Right of withdrawal", "Shipping information", "Refund policy", "Privacy", "Cookies", "Legal notice"), not the titles typed in the panel.

| The API answers | Links shown |
| --- | --- |
| All six published | All seven |
| `shipping`, `terms`, `privacy` | Terms, withdrawal, shipping, privacy, cookies, imprint |
| Nothing published | Withdrawal, cookies, imprint |
| No answer at all | Terms, withdrawal, privacy, cookies, imprint |

A page of the API is linked only when it is published, so the footer never leads to a 404. The imprint, the right of withdrawal and the cookie page are always linked, because they always have something to show.

### Other links to the legal pages

| Where | Links to | Note |
| --- | --- | --- |
| The consent above the order button (`src/components/checkout/checkout-view.tsx`) | Terms and privacy, each in a new tab | "I have read and accept the Terms and Conditions, and I have read the Privacy Policy." The versions accepted travel with the order; a version republished meanwhile unticks the box. See [Checkout](checkout.md) |
| The sign-up form (`src/components/auth/sign-up-form.tsx`) | Privacy | "How we handle your data is explained in our privacy policy." Linked whether or not the page is published |
| "Delivery and payment" | Right of withdrawal | See [Help and support](help-and-support.md) |
| The cookie notice | Cookie page | "Details" |

### For search engines

| Page | Title | Description | Index |
| --- | --- | --- | --- |
| From the API | The admin's `seo.title`, else the title of the text; one that names the shop stands as written, any other gets " \| Radhe Foods" (`legalTitle`) | The admin's `seo.description`, else one sentence of the shop per page (`legal.descriptions`) | Indexed |
| From a file | The title of the shop | The tagline of the shop | `noindex, follow` while a placeholder is open |

A page from the API also carries Open Graph data and a `WebPage` block of structured data with the language of the text and the publication date of the version as `dateModified`. Every page names its address in both languages. The sitemap lists a page of the API when it is published, with that date; the cookie page always; the imprint and the right of withdrawal not while they show the file.

## The cookie page and the cookie notice

The cookie notice (`CookieNotice` in `src/components/shell/cookie-notice.tsx`) is part of every page, the checkout and the unsubscribe page included. It is a notice, not a consent banner: "This shop uses only the cookies and storage it needs to work: for signing in, your cart and your language. No tracking, no advertising." It offers "OK" and "Details", which leads to the cookie page. There is nothing to accept or refuse, because the shop has no analytics, no advertising and no tracking.

| Case | What happens |
| --- | --- |
| First visit | The notice is in the HTML the server sends and is painted with the page |
| "OK" | `localStorage` `rf.cookie-notice.v1` is set to `1`; the notice goes |
| A later visit | A short script before the first paint marks `<html data-cookie-notice="read">`; the style sheet hides the notice at once and React removes it |
| The browser blocks storage | The notice counts as read and is not shown |

The cookie page is the detail behind the notice: a table of what is stored (name, kind, purpose, duration), the note that Stripe's own cookies apply on its payment page, and how to clear the storage. It has no placeholders.

The table of the file lists `rf_customer_access`, `rf_customer_refresh`, `NEXT_LOCALE`, `rf.cart.v2`, `rf.session.v1`, `rf.checkout.key.v1` and `rf.cookie-notice.v1`. The code also writes `rf.wishlist.v1` and `rf.referral.v1` to `localStorage`, and `rf.checkout.for.v1` and `rf.referral-notice.v1` to `sessionStorage`; the file does not name these four. The file says of itself that it must follow the code.

## The content check

`scripts/check-content.mjs`, run as `npm run check:content`, reads every Markdown file under `content`, skips the comments, and prints each open placeholder under its file. It ends with exit code 1 while one is left and prints "No placeholders left in the content files." otherwise. It is run by hand before launch; neither the build nor the checks on GitHub run it. Once the imprint and the right of withdrawal are published in the admin panel, their four files are no longer shown.

## Data and API

| Call | Made by | Kept | When it fails |
| --- | --- | --- | --- |
| `GET /v1/store/legal/{type}` | The server, for a page and its metadata (`getLegalDocument`) | 300 seconds (`REVALIDATE.legal`, tag `legal`) | Not published: 404 or the file. Anything else: the error page; during a build the page is left to its first visit |
| `GET /v1/store/legal` | The server, once per request for the footer (`getPublishedLegal`), asked in English for both languages | 300 seconds | `null`: the footer of the last row above |
| `GET /v1/store/legal` | The browser, at the checkout, fresh | Not kept | See [Checkout](checkout.md) |
| `GET /v1/store/legal` | The sitemap | An hour | The sitemap fails as a whole |

The six pages of the API export `revalidate = 300`, so a newly published version shows within five minutes. The files are read from the disk of the server; `next.config.ts` adds `content/legal` to what a host deploys (`outputFileTracingIncludes`).

## Not built

- Following an address the admin changed in the panel.
- A visible note that a text is shown in the other language.
- Earlier versions of a text, or a comparison of versions: the shop shows the version that applies.
- A PDF or print version of a text, and the model withdrawal form as a file to download or a form to send.
- Cookie settings or a consent choice: there is nothing optional to choose.
- A legal page of the API with a type other than the six: the footer and the sitemap ignore it.

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(shop)/legal` | The seven pages; six call `LegalDocumentPage` with their type, the cookie page calls `StaticLegalPage` |
| `src/components/legal/legal-document-page.tsx` | A page of the API, its metadata and structured data, the fall-back to a file |
| `src/components/legal/static-legal-page.tsx` | A page from a file, its metadata, the warning about placeholders |
| `src/components/legal/legal-text.tsx` | The Markdown renderer, shared with the FAQ and the blog; `PLACEHOLDER` |
| `src/features/legal/data.ts` | `getLegalDocument`, `getPublishedLegal` |
| `src/lib/legal/pages.ts` | `LEGAL_HREF`, `FILE_UNTIL_PUBLISHED`, `footerLegalPages`, `legalTitle` |
| `src/components/shell/footer.tsx` | The legal column |
| `src/components/shell/cookie-notice.tsx` | The notice and the script that hides it before the first paint |
| `content/legal` | Six Markdown files: imprint, withdrawal and cookies, in English and German |
| `scripts/check-content.mjs` | Lists the open placeholders |
