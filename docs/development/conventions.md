# Conventions

How work on the shop is done: the owner's standing rules, then the habits of the code. A developer or a coding agent who follows this page changes the shop the way it has been changed so far. The reasons behind the rules are in the [decision log](../decisions/README.md).

## 1. The owner's rules

| Rule | Means |
| --- | --- |
| **The look is the owner's** | Theme, colours, the font (Inter only), typography and brand identity stay. Something new is built from the existing components and tokens ([design system](../design-system/README.md)). A change that would alter the look is asked for first |
| **The backend decides** | Prices, VAT, stock, the bill, discounts, coins, delivery fees and every rule of an order come from the API. The shop prints them and calculates none of them ([business logic](../business-logic/README.md)) |
| **No invented endpoints** | The shop calls what the backend documents ([api/endpoints.md](../api/endpoints.md), [reference/backend/](../reference/backend/README.md)). What the API cannot do is reported, not worked around |
| **Say which side first** | When something is reported as wrong, first say whether it is the backend, the admin panel or the website. The website's code changes only when the cause is the website's |
| **Change the design, not the logic** | A redesign keeps every function, calculation, state (loading, empty, error) and call. What a design reference lacks is fitted into the new look, not dropped |
| **Both languages are first-class** | Every text exists in English and German. German addresses the customer formally ("Sie") and is written the way a German speaker writes it |
| **No secrets, no personal data** | The shop has no secrets; nothing personal goes into the repository, a test, a document or a request to an outside service |
| **The live shop is read, not written** | Checks against `www.radhefoods.de` and the live API are page reads. Anything else is asked for first |

## 2. From a request to a release

1. **Understand what exists.** Read the feature's document and its code, and the backend's document when the API is involved.
2. **Say the plan** when the change is more than a detail: what changes, what stays, what the API cannot do. A change of the look waits for the owner's word.
3. **Build in phases**, each one leaving the shop working.
4. **Check**: `npm run check` (types, lint, formatting, unit tests) and the browser tests of what was touched ([testing.md](testing.md)). Test before and after when the task is a redesign.
5. **Document in the same commit**: the feature's document; a section in the [decision log](../decisions/decision-log.md) when the owner decided something; `node docs/tools/check-docs.mjs` ([standard](documentation-standard.md)).
6. **Commit to `main` and push.** There are no long-lived feature branches. A push to `main` is a release on Hostinger, so it is done only with the check green; a branch named `feature/…` can be pushed first to run the build check for both hosts, and is deleted afterwards. `production/vercel` only ever moves forward to a commit of `main` ([deployment](../deployment/README.md)).
7. **Report plainly**: what was built, what was left out and why, which tests ran, what was not verified.

Commit messages follow the form of the history: `type(area): what is true after the commit` (`feat`, `fix`, `docs`, `test`, `ci`, `chore`), then a body that says what changed and why, and which tests ran.

## 3. Where code goes

The full map is in [architecture/overview.md](../architecture/overview.md). The short form:

| Kind of code | Place |
| --- | --- |
| A page, its metadata, its server data | `src/app/[locale]/…/page.tsx`, under the route group whose frame it has |
| What a customer sees | `src/components/<area>/` |
| A base component used everywhere | `src/components/ui/` |
| State and rules of a feature in the browser; the queries a server page reads | `src/features/<area>/` |
| Helpers without React: the API client, formatting, storage of the guest cart, SEO | `src/lib/<area>/` |
| A text | `messages/en.json` and `messages/de.json` |
| An address | `src/i18n/routing.ts` |
| Configuration and switches | `src/config/env.ts` |

## 4. Habits of the code

- **TypeScript, strict.** The types of the API are written by hand in `src/lib/api/types.ts`, section by section after the backend's reference; a field is added there first.
- **Server components by default.** A file is a client component (`"use client"`) only when it needs state, an effect or the customer's session ([rendering and caching](../architecture/rendering-and-caching.md)).
- **Tailwind utilities in the markup**, joined with `cn` (`src/lib/cn.ts`); shared looks are `@utility` classes of `src/app/globals.css`. Prettier orders the class names.
- **Comments say why.** A component's leading comment explains what it is for and names the owner's decision with its date when one shaped it. Comments name the backend's documents as "doc N" (section N of [reference/backend/store-api.md](../reference/backend/store-api.md)) or by an old path; [the reference's README](../reference/backend/README.md) maps both.
- **Errors are codes.** An `ApiError` carries a `code`; the customer reads the text of that code from the `errors` messages, never the API's English `message` ([error handling](../api/error-handling.md)).
- **Texts are never written in a component.** Every visible and every spoken text comes from the messages; a namespace used in the browser is listed in `src/i18n/client-messages.ts` ([internationalization](../architecture/internationalization.md)).
- **Accessible from the start**: a label for every control, the visible focus style, the keyboard, reduced motion ([accessibility](../design-system/accessibility.md)).
- **A test beside the rule.** A rule of the browser gets a unit test in the same folder; a flow gets a browser test.

## 5. What not to do

- Do not calculate a price, a tax, a fee, a weight or a count of boxes in the browser, and do not replace an answer of the API by a fixed value.
- Do not remove a loading, empty or error state to make a design simpler.
- Do not commit `.env.local`, screenshots with personal data, or generated folders (`.next`, `test-results`).
- Do not edit a copy in `docs/reference/backend/` to match the shop, and do not touch the backend's repository from here.
- Do not start the whole browser suite on a computer short of memory; run the specs of what changed.
