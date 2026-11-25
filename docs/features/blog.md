# Blog

Recipes, kitchen tips and news that Radhe Foods writes in the admin panel, shown to every visitor: a list of posts with a search, the posts of one category, the posts on one topic (a tag), and the article itself. The admin decides what is published, in which language and in which order; the shop displays it and adds what search engines need.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | 2026-10-24 |
| **Pages** | `/en/blog` · `/de/blog`, `/en/blog/[slug]` · `/de/blog/[slug]`, `/en/blog/category/[slug]` · `/de/blog/kategorie/[slug]`, `/en/blog/tag/[tag]` · `/de/blog/tag/[tag]` |
| **Code** | `src/app/[locale]/(shop)/blog`, `src/components/blog`, `src/features/content`, `src/components/legal/legal-text.tsx` |
| **API** | [Blog](../api/endpoints.md#blog) |
| **State** | The address: `?q=` and `?page=`. Nothing is stored in the browser |
| **Texts** | `blog`; the empty search title and the paging labels from `catalogue`; the name of a table's scroll box from `legal` |
| **Tests** | `e2e/public.spec.ts` ("the blog"), `e2e/accessibility.spec.ts`, `src/features/content/blog-state.test.ts`, `src/lib/seo/json-ld.test.ts`, `src/lib/seo/sitemap.test.ts` |
| **Backend reference** | [reference/backend/blog.md](../reference/backend/blog.md), section 19 of [reference/backend/store-api.md](../reference/backend/store-api.md) |

## What the customer sees

The blog is reached from the help column of the footer ("Blog"). The header has no link to it.

### The list pages

The front page, a category page and a tag page share one body, `BlogListing` in `src/components/blog/blog-listing.tsx`. Only the heading differs.

| Page | Heading | Above the list |
| --- | --- | --- |
| `/en/blog` | "Blog" with the intro "Recipes, kitchen tips and news from our kitchen."; during a search "Articles for “dal”" without the intro | The search field |
| `/en/blog/category/[slug]` | The small line "Blog", the category's name, its description when the admin wrote one | – |
| `/en/blog/tag/[tag]` | The small line "Blog", then "Articles on “spices”" | – |

Regions of the body, in order:

1. **Search** (front page only): a field "Search the blog" with the placeholder "Search articles …" and a round submit button. It is a plain form that sends `?q=` to the front page, so it works without scripts.
2. **Categories**: a row of chips, "All articles" first, then every category that has at least one published post, each with its count. The chip of the current page is dark and carries `aria-current="page"`. The row scrolls sideways on phones and wraps from `sm` on. It is left out when no category has a post.
3. **Topics**: up to twelve chips (`#recipes`), the most used first, in the order of the API.
4. **Posts**: a grid of cards, one column on phones, two from `sm`, three from `lg`.
5. **Pages**: the shared `Pagination` of the product lists ("Page 2 of 2").

A card (`PostCard` in `src/components/blog/post-card.tsx`) shows the featured picture in 16:9, the category's name as a small line, the title, the summary cut to three lines, and the date with the reading time ("20 October 2026 · 1 min read"). The title is the link; the picture links too and is hidden from the keyboard and screen readers, so a card is one stop.

| State | What shows |
| --- | --- |
| No post published | "Nothing here yet", "There are no articles yet. Come back soon." |
| Category without posts | "Nothing here yet", "There are no articles in this category yet.", button "All articles" |
| Search without a result | "Nothing found", "We found no article for “zzzz”. Try another word.", button "All articles" |
| A page number beyond the last page | The "not found" page (404) |
| A tag no published post carries | The "not found" page (404) |
| A category slug the API does not list | The "not found" page (404) |
| The list cannot be loaded | The [error page](error-pages.md) with "Try again" |
| Categories or topics cannot be loaded | The page without those rows |

### The article

`src/app/[locale]/(shop)/blog/[slug]/page.tsx`, in a column of `max-w-3xl`:

1. A trail: "Blog", then the category when the post has one.
2. The title (the only `h1`), the summary, and the line "By Vrushabh · 20 October 2026 · 1 min read".
3. The featured picture as wide as the column, when there is one.
4. A wheat note when the text exists only in the other language: "This article is available in English only." or "This article is available in German only." The text below then carries the `lang` of its language.
5. The text.
6. The topics as chips that lead to their tag pages.
7. "More to read": up to three related posts as cards (three columns from `lg`). The API chooses them.

A slug that is unknown, a draft or a scheduled post shows the "not found" page with status 404.

## Rules

| Case | What happens | Decided by |
| --- | --- | --- |
| Which posts are published, their order (newest first), drafts and scheduled posts | Not listed, 404 on their address | The API |
| Reading time, author, summary, related posts, the SEO title and description | Shown as sent | The API |
| Posts per page | 12 (`BLOG_PAGE_SIZE`) | The browser side (`src/features/content/blog-state.ts`) |
| `?q=` | Trimmed, cut to 80 characters; shorter than 2 characters counts as no search | `parseBlogState` |
| `?page=` | A whole number from 1 to 500, anything else is page 1 | `parseBlogState` |
| A search on a category or tag page | `?q=` is honoured there too, although only the front page shows the field | `toBlogQuery` |
| A tag in the address | Decoded, trimmed, lower-cased, cut to 80 characters; a tag with a blank or a broken encoding is 404; another spelling redirects permanently to the lower-case address | `cleanTag`, `src/app/[locale]/(shop)/blog/tag/[tag]/page.tsx` |
| The slug of the other language (post or category) | Permanent redirect to the slug of the page's language | The page |
| Language switch on a post or category | Goes to the slug of the other language (`LocaleAlternates` with `alternates` of the API) | The page |

Worked example with the thirteen published posts of the mock API:

```
/en/blog                 → page 1, 12 cards, "Page 1 of 2"
/en/blog?page=2          → 1 card
/en/blog?page=3          → 404 (no post on that page)
/en/blog?page=501        → read as page 1
/en/blog?q=d             → read as no search (one character)
/en/blog?q=dal           → GET /v1/store/blog/posts?q=dal&page=1&limit=12&locale=en
/en/blog/tag/Spices      → permanent redirect to /en/blog/tag/spices
/en/blog/tag/two%20words → 404 (a tag is one word)
```

### How the text is rendered and kept safe

The admin writes Markdown. `LegalText` in `src/components/legal/legal-text.tsx` renders it with `react-markdown` and `remark-gfm` (tables, strikethrough, task lists), in the type of the shop.

| Point | Behaviour |
| --- | --- |
| HTML inside the text | Dropped (`skipHtml`): nothing pasted into a post can run in a customer's browser. No plugin that would render raw HTML is installed |
| Links | Rendered with the address the admin typed; the library's own filter for link addresses stays in place (no `urlTransform` is passed). An address of the shop without a language is sent to the visitor's language by the proxy |
| Headings | Stepped down one level (`demoteHeadings`): a `#` in the text is an `h2`, `##` an `h3`, `###` an `h4`, so the title stays the only `h1` |
| Tables | Wrapped in a box that scrolls sideways and takes keyboard focus, named "Table" |
| Pictures in the text | Plain images at their address, never wider than the column, with rounded corners |
| Structured data | `JsonLd` escapes every `<`, so a title cannot close the script tag |

### Pictures and dates

`PostImage` in `src/components/blog/post-image.tsx` builds a `srcset` from the three ready-made sizes of the API (`small`, `medium`, `large`) and never an address of its own. The first three cards of a list and the picture that heads an article load at once (`loading="eager"`, `fetchPriority="high"`); the others load lazily. A post without a picture shows the Radhe mark ghosted on mist. Dates are printed by `formatDate` of `src/lib/format/dates.ts` ("20 October 2026", "20. Oktober 2026"), with the exact time in `<time dateTime>`.

### For search engines

| Page | Title and description | Index | Canonical |
| --- | --- | --- | --- |
| Front page | "Blog", "Recipes, kitchen tips and news from Radhe Foods." | `noindex, follow` during a search and while no post is published | Itself; `?page=N` from page 2 |
| Category | The admin's SEO title, else the name; the SEO description, else the description, else "Articles in {name} from the Radhe Foods blog." | `noindex, follow` during a search | Itself with the slug of each language; `?page=N` from page 2 |
| Tag | "Articles on “{tag}”", "Every article of the Radhe Foods blog on “{tag}”." | `noindex, follow` during a search | Itself; `?page=N` from page 2 |
| Article | `seo.title` and `seo.description` of the API; a title that names the shop stands as written (`titleOnce`) | Indexed | The slug of each language from `alternates` |

An article also carries Open Graph data of type `article` (title, description, address, `publishedTime`, `modifiedTime`, author, tags, the `medium` picture), a Twitter card (`summary_large_image` with a picture, `summary` without), and an `Article` block of structured data (`articleJsonLd` in `src/lib/seo/json-ld.tsx`: headline, description, dates, author, publisher, the `large` picture, language of the text, section, keywords). The sitemap lists the posts and the categories with posts in both languages; tag pages stay out, and the front page is left out while no post is published. See [SEO](../architecture/seo.md).

## Data and API

All calls are made by the server through `src/features/content/data.ts`; the browser calls nothing.

| Call | Used by | When it fails |
| --- | --- | --- |
| `GET /v1/store/blog/posts` | Every list page, and the metadata of the front page | The error page |
| `GET /v1/store/blog/categories` | The chips (`getBlogCategories`) | An empty list: no chip row |
| `GET /v1/store/blog/categories` | Finding the category of a category page (`loadBlogCategories`) | The error page |
| `GET /v1/store/blog/tags` | The chips (`getBlogTags`) | An empty list: no chip row |
| `GET /v1/store/blog/posts/{slug}` | The article (`getBlogPost`) | `BLOG_POST_NOT_FOUND` or `NOT_FOUND`: 404; anything else: the error page |

Every answer is kept for 300 seconds (`REVALIDATE.content`, tag `content` in `src/lib/api/server.ts`), so a published post shows within five minutes. The article page exports `revalidate = 300` and builds no article ahead of time: each is rendered at its first visit and then kept. The three list pages read the query of the address; what they reuse is the API's kept answer. More in [rendering and caching](../architecture/rendering-and-caching.md).

## Behaviour

- The search of the blog is a landmark of its own (`role="search"`, "Search the blog"), named apart from the search of the shop in the header.
- The chip rows are `nav` landmarks: "Categories of the blog", "Topics of the blog". The trail of an article is "You are here".
- A card lifts on hover and its picture grows a little, only for visitors who have not asked for less motion.

## Not built

- Comments, likes, ratings and share buttons.
- An author page, an archive by month, an RSS or Atom feed.
- A search field on category and tag pages.
- A link to the blog in the header, and blog posts in the search of the shop.
- Products linked from a post as cards: a post links to a product only through a Markdown link the admin writes.
- A preview of drafts in the shop.

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(shop)/blog/page.tsx` | The front page: heading, metadata, the listing with the search |
| `src/app/[locale]/(shop)/blog/[slug]/page.tsx` | The article: redirect to its own slug, metadata, structured data, the text, topics, related posts |
| `src/app/[locale]/(shop)/blog/category/[slug]/page.tsx` | The posts of one category, found by the slug of either language |
| `src/app/[locale]/(shop)/blog/tag/[tag]/page.tsx` | The posts on one topic; cleans the tag of the address |
| `src/components/blog/blog-listing.tsx` | Search field, chips, grid, empty states, paging; decides the 404 of an empty page |
| `src/components/blog/post-card.tsx` | A post in a grid; `postHref` |
| `src/components/blog/post-image.tsx` | The featured picture or its stand-in |
| `src/components/legal/legal-text.tsx` | The Markdown renderer shared with the FAQ and the legal pages |
| `src/features/content/blog-state.ts` | The state in the address, the query of the API, `cleanTag`, `BLOG_PAGE_SIZE` |
| `src/features/content/data.ts` | The server's reads of the blog and the FAQ, with their caching and failure rules |
| `src/components/ui/pagination.tsx` | The paging shared with the product lists |
| `mocks/data/blog.ts`, `mocks/content.ts` | The posts, categories and tags of the mock API |
