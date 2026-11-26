# Search engines

Every public page of the shop is rendered on the server with a title, a description, a canonical address, the address of its other language, Open Graph data and, where it helps, structured data. One address is the shop's (`https://www.radhefoods.de` in production); every address a search engine is given starts with it. Pages that belong to one visitor, views of a list and pages with nothing on them say `noindex`. `robots.txt` and the sitemap are written by the shop from the same sources. The code is in `src/lib/seo`, in `src/app/robots.ts`, `src/app/sitemap.ts` and `src/app/manifest.ts`, and in the `generateMetadata` of each page.

## The one address of the shop

| Step | Where |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` is read as the address the shop answers at: the bare domain and `http` become `https://www.radhefoods.de`; any other address stays | `primarySiteUrl` in `src/config/env.ts`, giving `env.siteUrl` |
| Every absolute address is built from it | `absoluteUrl` and `pageUrl` in `src/lib/seo/alternates.ts`; `metadataBase` of the root layout; the ids of the structured data; `robots.txt`; the sitemap |
| A request for the bare domain is redirected for good to `www`, path and query kept | `bareDomainRedirect` in `next.config.ts` on a Node.js host; Vercel does it before the shop is asked |
| `/` and any address without a language lead to `/en` or `/de` | `src/proxy.ts` |

A setting that names an address which only redirects would put that address into every canonical link and sitemap entry, and a search engine does not index from those; the rule in the code keeps a wrong setting on a host from doing so ([configuration.md](configuration.md)).

## Metadata

### What every page inherits

`generateMetadata` of `src/app/[locale]/layout.tsx`:

| Field | Value |
| --- | --- |
| `metadataBase` | `env.siteUrl` |
| `title` | Default `Radhe Foods`; template `%s \| Radhe Foods` |
| `description` | The tagline (`site.tagline`) |
| `applicationName` | `Radhe Foods` |
| `formatDetection` | Telephone, email and address detection off |
| `openGraph` | `type: "website"` and `sharedOpenGraph(locale)`: the site name, `en_GB` or `de_DE`, the picture `public/brand/radhe-social-1200x630.jpg` (1200 × 630) |
| `twitter` | `summary_large_image` with the same picture |
| `viewport` | `themeColor` `#f1f6f1`, device width, `viewportFit: "cover"` |

Next.js merges metadata one level deep, so a page that sets `openGraph` replaces the layout's block as a whole. Such a page spreads `sharedOpenGraph` (`src/lib/seo/open-graph.ts`) in first, to keep the site name, the language and the picture.

### Titles

| Rule | Function |
| --- | --- |
| The layout appends the shop's name to every title | The template above |
| A title that names the shop already stands as written; any other gets the name from the template. Used for the titles the admin writes: categories, blog posts, blog categories, legal pages | `titleOnce` in `src/lib/seo/title.ts`; `legalTitle` in `src/lib/legal/pages.ts` |
| A product has one title of the admin for all its pack sizes, and each size is a page. The shop's name is taken off its end, and the size is added when the title does not name it. Without a title of the admin, or when it is only the product's name, the title is the one the page shows | `productPageTitle` |
| The tab follows the pack size a customer switches to, by the same rule | `PackSizes` in `src/components/catalogue/product-purchase.tsx` |

Worked example for `productPageTitle`, from `src/lib/seo/title.test.ts`: the product `Aachi Long Red Chillies with Stem` in the pack size `100 g`. The layout then appends ` | Radhe Foods` to each.

| Admin's title | Page title | Why |
| --- | --- | --- |
| None, or only spaces | `Aachi Long Red Chillies with Stem (100g)` | The title the page shows |
| `Aachi Long Red Chillies with Stem \| Radhe Foods` | `Aachi Long Red Chillies with Stem (100g)` | Without the shop's name it is only the product's name; the 250 g page gets `… (250g)` |
| `Buy red chillies online` | `Buy red chillies online (100g)` | The size is added |
| `Red chillies, 100 g pack` | `Red chillies, 100 g pack` | The title names the size |
| `Red chillies 1100g` | `Red chillies 1100g (100g)` | "1100g" does not name "100g" |

### Per page

| Page | Source file | Title | Description | Open Graph of its own |
| --- | --- | --- | --- | --- |
| Home | `src/app/[locale]/(shop)/page.tsx` | `Radhe Foods \| ` and `home.metaTitle`, absolute | `home.metaDescription` | Title, description, `og:url` |
| All products, search | `src/app/[locale]/(shop)/products/page.tsx` | `catalogue.allTitle`, or `catalogue.searchTitle` with the query | `catalogue.allDescription` | – |
| Product | `src/app/[locale]/(shop)/products/[slug]/page.tsx` | `productPageTitle` | The admin's `seo.description`, else `shortDescription`, else the first 160 characters of `description`, else `catalogue.productDescription` with name and size | Title, description, `og:url`, the main picture of the pack size (largest file) |
| Category | `src/app/[locale]/(shop)/category/[slug]/page.tsx` | `seo.title`, else the name | `seo.description`, else `description`, else `catalogue.categoryDescription` | – |
| All categories | `src/app/[locale]/(shop)/categories/page.tsx` | `catalogue.categoriesTitle` | `catalogue.categoriesDescription` | – |
| Blog, blog search | `src/app/[locale]/(shop)/blog/page.tsx` | `blog.title`, or `blog.searchTitle` | `blog.metaDescription` | – |
| Blog post | `src/app/[locale]/(shop)/blog/[slug]/page.tsx` | `seo.title` | `seo.description` | `type: "article"` with dates, author, tags, `og:url`, the featured picture (medium file) |
| Blog category | `src/app/[locale]/(shop)/blog/category/[slug]/page.tsx` | `seo.title`, else the name | `seo.description`, else `description`, else `blog.categoryDescription` | – |
| Blog tag | `src/app/[locale]/(shop)/blog/tag/[tag]/page.tsx` | `blog.tagTitle` | `blog.tagDescription` | – |
| FAQ | `src/app/[locale]/(shop)/faq/page.tsx` | `faq.title` | `faq.metaDescription` | – |
| Reviews | `src/app/[locale]/(shop)/reviews/page.tsx` | `reviews.publicTitle` | `reviews.metaDescription` | – |
| How it works; Delivery and payment | `src/app/[locale]/(shop)/how-it-works/page.tsx`, `src/app/[locale]/(shop)/delivery-and-payment/page.tsx` | `help.howItWorks.title`; `help.delivery.title` | Their `metaDescription` | – |
| The six legal pages of the API | `legalMetadata` in `src/components/legal/legal-document-page.tsx` | The admin's `seo.title`, else the title of the text | The admin's `seo.description`, else `legal.descriptions` by type | Title, description, `og:url` |
| Cookie page, and the legal notice and right of withdrawal while unpublished | `staticLegalMetadata` in `src/components/legal/static-legal-page.tsx` | `staticLegal` by name | The layout's | – |

### Icons and the manifest

| File | Serves |
| --- | --- |
| `src/app/favicon.ico` (16, 32, 48 px), `src/app/icon.svg`, `src/app/icon.png` (192 px), `src/app/apple-icon.png` (180 px) | The icon of the tab, of a search result and of an iOS home screen. Next.js writes the `<link>` tags from the files |
| `src/app/manifest.ts` | `/manifest.webmanifest`: name, `display: "browser"`, the colours, and three icons of `public/brand` (192, 512 and a maskable 512) |
| `scripts/make-icons.mjs` | Draws all of them, the peacock feather, from code |

## Canonical addresses and `hreflang`

`alternates(locale, hrefs)` in `src/lib/seo/alternates.ts` answers both for a page: the canonical address is the page in its own language; `languages` names the page in `en`, in `de`, and `x-default`, which is the English page.

| Page | `hrefs` |
| --- | --- |
| A page with the same key in both languages | `sameHref("/faq")`: the localised pattern does the rest (`/en/cart`, `/de/warenkorb`) |
| Product, category, blog post, blog category | The slug of each language, from the API (`slugs`, `alternates`) |

A product, a category and a post that are opened under the slug of the other language, or a product under its base slug, redirect for good to their own address, so each has exactly one. next-intl's own `Link` header is switched off (`alternateLinks: false` in `src/i18n/routing.ts`): it would name the slug of the wrong language. The sitemap repeats the same three links per entry.

## Lists: pages, filters and searches

| Case | `robots` | Canonical |
| --- | --- | --- |
| The plain list, page 1 | Indexable | Itself, with `hreflang` |
| A further page of a plain list (`?page=2`) | Indexable | Itself, with its query; not in the sitemap |
| Products or a category with a search (`q`), a sorting other than `recommended`, or any filter (`isFiltered` in `src/features/catalogue/listing-state.ts`) | `noindex, follow` | The plain list |
| A category without products | `noindex, follow` | Itself |
| Blog, blog category or blog tag with a search | `noindex, follow` | The list without the search |
| Reviews narrowed to a number of stars | `noindex, follow` | The plain list |
| A page number beyond the last page | 404 | – |

## Which pages are `noindex`

| Pages | Value | Why |
| --- | --- | --- |
| Account (the layout, so every page under it), cart, checkout, wishlist, sign-in, sign-up, forgot password | `noindex, nofollow` | They belong to one visitor |
| Reset password, unsubscribe, guest order, the two link pages of "Notify me" | `noindex, nofollow`, `referrer: "no-referrer"`, and closed in `robots.txt` | Their address carries a personal token |
| Filtered, sorted and searched lists | `noindex, follow` | Views of a list that is indexed |
| A category without products, the FAQ without a published question, the blog without a post, the reviews without a review | `noindex, follow`, and left out of the sitemap | A page with nothing on it counts against the site. Each comes back by itself: it reads the list it shows |
| A legal template with open `[[placeholders]]` | `noindex, follow` | It says of itself that it is not complete |
| The style guide (`src/app/[locale]/styleguide/page.tsx`) | `noindex, nofollow` | For the people who build the shop |
| The last-resort error page; `GET /api/health` | `<meta name="robots" content="noindex">`; `X-Robots-Tag: noindex` | Not pages of the shop |

## `robots.txt`

`src/app/robots.ts`, for every user agent:

| Rule | Value |
| --- | --- |
| `Allow` | `/` |
| `Disallow` | `/unsubscribe/`, `/*/unsubscribe/`, `/reset-password`, `/*/reset-password`, `/stock-alerts/`, `/*/stock-alerts/`, `/*/guest/` |
| `Sitemap` | `env.siteUrl` and `/sitemap.xml` |

Nothing else is closed. Cart, checkout, account and filtered lists say `noindex` themselves, which a search engine can only read on a page it may open.

## The sitemap

`src/app/sitemap.ts` reads the API; `buildSitemap` in `src/lib/seo/sitemap.ts` turns the answers into entries. Every entry exists once per language, and each names `en`, `de` and `x-default`.

| Entries | From | Priority, frequency | Extras |
| --- | --- | --- | --- |
| `/`, `/products` | `STATIC_PAGES` | 1 and 0.9, daily | – |
| `/categories`, `/how-it-works`, `/delivery-and-payment`, `/faq`, `/reviews`, `/blog`, `/legal/cookies` | `STATIC_PAGES` | 0.7 to 0.1, monthly | `/faq`, `/reviews` and `/blog` are left out while empty |
| The published legal pages | `GET /v1/store/legal` | 0.2, monthly | `lastModified`: the day the version was published |
| Categories with products, sub-categories included | `GET /v1/store/categories` (one call: the tree carries the slugs of both languages) | 0.8, daily | The category's picture |
| Every pack size on sale | `GET /v1/store/products` with `sort=name`, 100 a page, once per language, joined by the id of the size | 0.7, daily | The main picture of the size; `lastModified` when the list gives `updatedAt` |
| Blog categories with posts | `GET /v1/store/blog/categories` | 0.5, weekly | – |
| Blog posts | `GET /v1/store/blog/posts`, 100 a page, once per language | 0.6, monthly | The featured picture; `updatedAt`, else `publishedAt` |

Whether the FAQ and the reviews are empty is asked with `GET /v1/store/faqs` and `GET /v1/store/reviews?limit=1`. Tag pages and further pages of lists are not listed.

| Rule | Detail |
| --- | --- |
| Written at each request | `dynamic = "force-dynamic"`; the answers of the API behind it are kept for an hour, so a crawler that asks often costs no call. The file is not renewed on a timer of its own (`revalidate`): measured on the host, such a timer does not run for this file (decision log, 2026-11-17) |
| The API does not answer and nothing is kept | The request fails with 500: a search engine keeps the sitemap it read before, where a sitemap without products would tell it they are gone |
| An API without the blog (404) | No blog entries; the rest is written |
| A date or a picture the API does not give | Left out; no date is made up |
| A picture's address | Escaped for XML by `xmlText` |
| One file | No sitemap index |

## Structured data

`JsonLd` in `src/lib/seo/json-ld.tsx` renders one `<script type="application/ld+json">`; the functions beside it build the blocks.

| Page | Type | Built by | Carries |
| --- | --- | --- | --- |
| Home | `Organization` | `organizationJsonLd` | Name, `alternateName` `RadheFoods`, the root of the domain, the logo, the tagline, `areaServed` Germany, the support address when set |
| Home | `WebSite` | `websiteJsonLd` | The same name and root, the language, a `SearchAction` on `/products?q=` |
| Product | `ProductGroup` with one `Product` per pack size | `productJsonLd` | Per size: its own address, name with size, pictures, `sku`, weight or size, an `Offer` with price, currency, `InStock` or `OutOfStock` (from `ordering.canOrder`), `NewCondition`. The GTIN only on the size the page was loaded for |
| Product, category | `BreadcrumbList` | `breadcrumbJsonLd` | Home, the categories of the API's `breadcrumbs`, and on a product its name |
| Product lists (all products, a search, a category) | `ItemList` | `itemListJsonLd` in `src/components/catalogue/product-listing.tsx` | The cards of the page in order, with name and address |
| FAQ | `FAQPage` | `faqPageJsonLd` | Every published question; the answer as plain words (`markdownToText`). Not written while there is no question |
| How it works | `FAQPage` | Written in the page | Its six fixed questions |
| Blog post | `Article` | `articleJsonLd` | Headline, dates, author, publisher, the featured picture, language of the text, category, tags |
| A legal page of the API | `WebPage` | `webPageJsonLd` in `src/components/legal/legal-document-page.tsx` | Name, description, the language of the text, `dateModified` |

Prices are printed from cents as an exact decimal string. A pack size without a picture has no `image`, never that of another size. `<` is escaped, so a text cannot close the script tag.

## Dynamic addresses

| Page | Address | The slug |
| --- | --- | --- |
| Product (one per pack size) | `/en/products/<slug>` · `/de/produkte/<slug>` | The slug of the pack size in the page's language |
| Category | `/en/category/<slug>` · `/de/kategorie/<slug>` | Per language |
| Blog post | `/en/blog/<slug>` · `/de/blog/<slug>` | Per language |
| Blog category | `/en/blog/category/<slug>` · `/de/blog/kategorie/<slug>` | Per language |
| Blog tag | `/en/blog/tag/<tag>` · `/de/blog/tag/<tag>` | The same lower-case word in both; another spelling redirects to it |

The pack sizes of a product page are plain links, so a crawler finds every size; a click switches the size in place and changes the address. An address that names nothing answers 404 through the localised "not found" page.

## Tests

| File | Guards |
| --- | --- |
| `src/lib/seo/title.test.ts` | `titleOnce`, `withoutShopName`, `productPageTitle` |
| `src/lib/seo/sitemap.test.ts` | The entries, their languages, what is left out |
| `src/lib/seo/json-ld.test.ts` | The blocks |
| `e2e/public.spec.ts` | `robots.txt`, the sitemap, canonical and `hreflang` links, `noindex` on the pages of one visitor, the product page's offers |
| `scripts/smoke.mjs` | A built shop answers `robots.txt` and a sitemap with products, and redirects the bare domain |
