# Documentation standard

How the documents in `docs/` are written and kept true. The aim: a developer or a coding agent finds any fact about the shop in one place, and that place is right. The backend (`radhe-api`) keeps its documents by the same standard, so both repositories read alike.

## 1. Principles

1. **The code is the source of truth.** A document describes what the code does today. When they disagree, the document is wrong and is fixed.
2. **One fact, one place.** A rule is explained in one document; every other document links to it.
3. **State what is, not what changed.** No "new", "now", "recently". The date a feature exists since is in its header; why it is the way it is, is in the [decision log](../decisions/README.md); how it came about is in the history of the repository.
4. **Say the state.** Every feature says whether it is implemented, partially implemented, planned or deprecated ([the list](../features/README.md)).
5. **Never invent.** A value, a field, a text or an example comes from the code, a test or the mock API. What is not known is left out or marked as open.
6. **The shop does not do the backend's work.** Prices, VAT, stock, the bill, delivery fees and every rule of an order are decided by the API. A document says which side decides, and names the backend's document for the rule itself instead of repeating it.
7. **No secrets and no personal data.** Variable names, never values. Examples use invented people (`anna@example.com`).

## 2. Where a document goes

| Folder | Holds | A new file when |
| --- | --- | --- |
| `features/` | One document per feature a customer can see or use: what it shows, its rules in the browser, its calls, its states, its code map | The shop gets a page or a function with rules of its own |
| `business-logic/` | Rules that run through several features, and the index of every rule | A rule concerns three or more features and none owns it |
| `api/` | How the shop talks to the API: the client, the session, caching, errors, and every endpoint it calls | Never: add rows and sections |
| `architecture/` | How the shop is built: structure, routes, rendering, state, security, configuration, languages, search engines, performance | A cross-cutting technical topic appears |
| `design-system/` | Colours, type, glass, components, motion, icons, layout, accessibility | A new family of visual rules appears |
| `development/` | Getting started, testing, the mock API, conventions, this standard | Rarely |
| `deployment/` | The two hosts and how a release reaches them | A new host |
| `decisions/` | The decision log: what the owner decided, with the reason | Never: add a section to the log |
| `reference/backend/` | Copies of the backend's documents the shop was built against, as they were when copied | The backend hands over a new contract and the shop is built against it |
| `archive/` | Documents that no longer describe the shop but explain how it came about | A document stops describing the shop |
| `tools/` | The checker | – |

File names are lower-case words joined by hyphens, in English, named after the thing (`product-page.md`), not after the task (`redesign-plan.md`). Every folder has a `README.md` that indexes it, and every document is reachable from [docs/README.md](../README.md).

## 3. A feature document

Start from [feature-template.md](feature-template.md). The parts, in this order:

| Part | Content |
| --- | --- |
| Title and one paragraph | What the feature is for, in the words of the shop |
| **Header table** | `Status`, `Since`, `Pages`, `Code`, `API`, `State`, `Texts`, `Tests`, `Backend reference` |
| What the customer sees | Each page or part: its regions in order, and every state (loading, empty, error, signed in or guest) |
| Rules | What the browser decides, as tables of cases; what the API decides, as one line with a link. **A worked example with numbers for every calculation the browser does** |
| Data and API | The calls in the order they happen, where the answer is cached, what an error leads to. Link to [api/endpoints.md](../api/endpoints.md) for the endpoint itself |
| Behaviour | Responsive layout, keyboard and screen reader, motion: only what is particular to this feature; the rest is the [design system](../design-system/README.md) |
| Not built | What a reader might expect and the shop does not have |
| Code map | A table of the files of the feature, with one sentence each, last |

A feature document is as long as its rules need. When a section repeats another document, replace it by a link.

### The header

```markdown
| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | 2026-10-19 |
| **Pages** | `/en/wishlist` · `/de/merkliste` |
| **Code** | `src/components/wishlist`, `src/features/wishlist`, `src/lib/wishlist` |
| **API** | [Wishlist](../api/endpoints.md#wishlist) |
| **State** | `localStorage` `rf.wishlist.v1` for visitors; the API for customers |
| **Texts** | `wishlist` |
| **Tests** | `e2e/wishlists.spec.ts`, `e2e/catalogue.spec.ts` |
| **Backend reference** | [reference/backend/wishlist.md](../reference/backend/wishlist.md) |
```

`Status` is one of:

| Status | Means |
| --- | --- |
| **Implemented** | Built, in the shop, and served by the API |
| **Partially implemented** | Part of it is built; the header or the first section says what is missing |
| **Planned** | Wanted by the owner or offered by the API, and not built in the shop |
| **Deprecated** | Still in the code, replaced or switched off; say by what |

Something that was removed from the code has no document; it has a row in [features/README.md](../features/README.md#removed).

## 4. Style

- Plain English, short sentences, the words of the shop ("pack size", not "variant", outside names in the code). British spelling, as in the code's comments.
- Names of files, components, functions, fields, routes, texts and values in backticks; nothing else.
- A file is named by its path from the repository root (`src/components/cart/cart-view.tsx`). A function or component is named with its file the first time a document names it.
- A page is named by its English address with the German one beside it the first time (`/en/cart` · `/de/warenkorb`).
- An endpoint is written with its method and its path (`PUT /v1/store/cart/items/{variantId}`).
- Amounts in examples as cents in JSON and as euros in prose (`499`, 4.99 €).
- Links are relative and carry a readable label. Link to a section when the reader should land there.
- Tables for anything with more than three parallel items; a code block with arrows for a flow. No pictures: they cannot be compared or checked.
- Tables are written compact: one space around each bar (`| Code | Status | When |`). **The documents are not run through Prettier** (`docs` is in `.prettierignore`): it pads every table, so a one-word change would touch every row.
- No history in a living document: not "was added", not "replaces the old". The decision log holds the reasons, with their dates.

## 5. The checker

`docs/tools/check-docs.mjs` reads the documents and the code and changes nothing. It has no dependencies.

```bash
node docs/tools/check-docs.mjs          # verify the documents against the code; exit code 1 on a problem
node docs/tools/check-docs.mjs routes   # print every page with its addresses, for architecture/routing.md
node docs/tools/check-docs.mjs endpoints # print every endpoint the client calls, for api/endpoints.md
```

| Check | Catches |
| --- | --- |
| Relative links and anchors resolve | A renamed file or heading |
| Paths written in backticks (`src/…`, `e2e/…`, `mocks/…`, `messages/…`, `scripts/…`, `public/…`, `content/…`, `docs/…`) exist | A document that names a file that moved |
| Every document is reachable from `docs/README.md` | A document nobody will find |
| Every feature document has a `Status` of the four | A document without its header |
| Every page of `src/app` is listed in [architecture/routing.md](../architecture/routing.md) | A new page nobody documented |
| Every endpoint called in `src/lib/api` is listed in [api/endpoints.md](../api/endpoints.md) | A new call nobody documented |
| Every environment variable the code reads is explained in [architecture/configuration.md](../architecture/configuration.md) | A new variable nobody described |
| Every folder of `src/components`, `src/features` and `src/lib` is named in a document | A new area without a document |
| No living document names an old `doc/…` path | Leftovers of the old layout |

`archive/`, `reference/backend/` and the decision log are exempt from the checks on paths and old names: they are kept as they were written. A change is not done while the checker reports a problem.

## 6. Keeping it true

| When | Do |
| --- | --- |
| The look or the behaviour of a feature changes | Change its feature document in the same commit as the code and its test |
| The owner decides something | A section in the [decision log](../decisions/decision-log.md), newest first: the decision and its reason, with the date. The feature document then says what is, without the story |
| A page is added | A row in [architecture/routing.md](../architecture/routing.md); its feature document |
| A call to the API is added | A row in [api/endpoints.md](../api/endpoints.md); the feature document's "Data and API" |
| A feature is added | A feature document from the template; a row in [features/README.md](../features/README.md); its rules in [business-logic/README.md](../business-logic/README.md) |
| A component of `src/components/ui`, a colour, a utility of `globals.css` or an animation is added | The matching document of the [design system](../design-system/README.md) |
| A text namespace or a localised address is added | [architecture/internationalization.md](../architecture/internationalization.md) |
| An environment variable is added | [architecture/configuration.md](../architecture/configuration.md) and `.env.example` |
| The backend hands over a new contract | Copy it to `reference/backend/` with a row in its [README](../reference/backend/README.md); never edit a copy to match the shop |
| A prompt or a plan was carried out | Check that each fact in it is in a document that stays; then delete it and record it in [archive/README.md](../archive/README.md). The history of the repository keeps it |
| A feature is switched off or replaced | Status `Deprecated` with what replaces it; when the code is gone, delete the document and add a row to [Removed](../features/README.md#removed) |

Before every commit that touches `docs/` or a documented file: `node docs/tools/check-docs.mjs`.
