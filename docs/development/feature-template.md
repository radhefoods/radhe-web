# Feature name

One paragraph: what the feature is for, in the words of the shop, and who uses it (every visitor, guests, signed-in customers).

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | YYYY-MM-DD |
| **Pages** | `/en/…` · `/de/…` |
| **Code** | `src/components/…`, `src/features/…` |
| **API** | [Catalogue](../api/endpoints.md#catalogue): the section of the endpoints the feature calls |
| **State** | Where the feature keeps what it knows (the API, a cookie, `localStorage` key, the address bar, a context) |
| **Texts** | The namespaces of `messages/en.json` and `messages/de.json` |
| **Tests** | `e2e/….spec.ts`, `src/…/….test.ts` |
| **Backend reference** | [reference/backend/….md](../reference/backend/README.md) |

## What the customer sees

Each page or part, its regions in reading order, and every state: loading, empty, error, guest, signed in.

## Rules

| Case | What happens | Decided by |
| --- | --- | --- |
| … | … | The browser (`src/…`) or the API |

A worked example with numbers for every calculation the browser does.

## Data and API

The calls in the order they happen, where an answer is cached and for how long, and what each error leads to.

## Behaviour

Only what is particular to this feature: responsive layout, keyboard and screen reader, motion.

## Not built

What a reader might expect here and the shop does not have.

## Code map

| File | What it is |
| --- | --- |
| `src/…` | … |
