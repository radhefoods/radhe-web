# FAQ

The questions customers ask most, with the answers of Radhe Foods, on one page for every visitor. The admin writes the questions, groups them and sets their order in the admin panel; the shop lists them and hands them to search engines.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | 2026-10-24 |
| **Pages** | `/en/faq` · `/de/faq` |
| **Code** | `src/app/[locale]/(shop)/faq/page.tsx`, `src/features/content/data.ts`, `src/components/legal/legal-text.tsx`, `src/components/ui/disclosure.tsx` |
| **API** | [FAQ](../api/endpoints.md#faq) |
| **State** | None. Which answers are open is the browser's own state of the `details` elements |
| **Texts** | `faq`; the name of a table's scroll box from `legal` |
| **Tests** | `e2e/public.spec.ts` ("questions and answers"), `e2e/accessibility.spec.ts`, `src/lib/format/markdown.test.ts` |
| **Backend reference** | [reference/backend/faq.md](../reference/backend/faq.md), section 18 of [reference/backend/store-api.md](../reference/backend/store-api.md) |

## What the customer sees

The page is reached from the help column of the footer ("FAQ"). In a column of `max-w-3xl`:

1. The heading "Questions and answers" and the intro "The questions we hear most, with our answers."
2. One section per group, in the admin's order: the group's name as an `h2`, and under it its questions as rows between hairlines. Each row is a question (`h3`) with a chevron; a tap folds the answer open.
3. The questions without a group come last, under "Other questions".

Every answer is closed when the page opens. An answer is Markdown and is rendered by `LegalText` like a blog post: no HTML, headings stepped down one level, wide tables in their own scroll box (see [Blog](blog.md), "How the text is rendered and kept safe").

| State | What shows |
| --- | --- |
| Nothing published | The heading and the intro only; no message, no section |
| A question without a text in German | The English text: the API answers the fallback |
| The API cannot be reached | The [error page](error-pages.md) with "Try again" |

There is no loading state: the page arrives complete from the server.

## Rules

| Case | What happens | Decided by |
| --- | --- | --- |
| Which groups and questions show, hidden groups, drafts, the order, the language fallback | Shown as sent | The API |
| The heading of the questions without a group | "Other questions": the group whose `name` is `null` | `src/app/[locale]/(shop)/faq/page.tsx` |
| The anchor of a question | `#faq-<id>` with the id of the API, so a link can point at one question | The page |
| The anchor of a group heading | `faq-group-<id>`, `faq-group-other` for the questions without a group | The page |
| Search engines | `noindex, follow` while no question is published; the sitemap leaves the page out for the same case | The page, `src/app/sitemap.ts` |

### Structured data

When at least one question is published, the page carries one `FAQPage` block (`faqPageJsonLd` in `src/lib/seo/json-ld.tsx`) with every question of every group. The answers go in as plain words: `markdownToText` in `src/lib/format/markdown.ts` drops the Markdown marks and keeps the text of links and the descriptions of pictures.

A question of the mock API (`mocks/data/faq.ts`), as the admin typed it and as the structured data carries it:

```
Markdown:   Yes, until we start preparing it. Open the order in your account and
            choose *Cancel order*. Once it is on its way, use the
            [right of withdrawal](/legal/withdrawal) instead.
Plain:      Yes, until we start preparing it. Open the order in your account and
            choose Cancel order. Once it is on its way, use the right of
            withdrawal instead.
```

A folded answer is still in the HTML the server sends, so search engines read it on the page as well.

A link inside an answer is rendered with the address the admin typed. An address of the shop without a language (`/legal/withdrawal`) is sent to the visitor's language by the proxy (`src/proxy.ts`).

The page "How it works" has six fixed questions of its own with their own `FAQPage` block; those are texts of the shop, not of the admin. See [Help and support](help-and-support.md).

## Data and API

| Call | Made by | Kept | When it fails |
| --- | --- | --- | --- |
| `GET /v1/store/faqs` | The server (`getFaqs` in `src/features/content/data.ts`), once for the page and its metadata | 300 seconds (`REVALIDATE.content`, tag `content`) | The error page; during a build the page is left to its first visit (`leaveToFirstVisitWhileBuilding`) |

The page exports `revalidate = 300`: a change in the admin panel shows within five minutes. The sitemap asks the same endpoint, kept for an hour, to decide whether the page is listed. The browser calls nothing.

## Behaviour

- The accordion is the shared `Disclosure` with `look="row"`: a native `details`, so it opens without scripts and the summary is a button to assistive technology.
- Several answers can be open at once; opening one does not close another.
- The answer glides open where the browser can animate `details`; elsewhere it appears at once. See [Motion](../design-system/motion.md).
- An address with `#faq-<id>` scrolls to that question; the page does not open it by itself.

## Not built

- A search or a filter within the questions.
- "Was this answer helpful?" and any other feedback on an answer.
- A form to ask a new question. The ways to reach Radhe Foods are in [Help and support](help-and-support.md).
- Opening the question an address points at.
- Questions on a product page or in the checkout: the FAQ is this one page.

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(shop)/faq/page.tsx` | The page: metadata, structured data, the groups and their questions |
| `src/features/content/data.ts` | `getFaqs`: the read of the API with its caching |
| `src/components/ui/disclosure.tsx` | The folding row |
| `src/components/legal/legal-text.tsx` | The Markdown renderer of the answers |
| `src/lib/format/markdown.ts` | `markdownToText`: an answer as plain words |
| `src/lib/seo/json-ld.tsx` | `faqPageJsonLd` |
| `mocks/data/faq.ts`, `mocks/content.ts` | The groups and questions of the mock API |
