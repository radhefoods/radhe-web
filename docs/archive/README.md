# Archive

Documents that no longer describe the shop but explain how it came about, and the record of how this folder was reorganised. Nothing here is kept current, and the checker of the documentation leaves it alone. For what the shop is, read the [feature documents](../features/README.md); for the reasons, the [decision log](../decisions/README.md).

## What is kept here

| Document | What it was |
| --- | --- |
| [2026-11-readme-status-log.md](2026-11-readme-status-log.md) | The list the `README.md` opened with until 2026-11-25: one dated entry per round of work, and the list of what was open before the launch |
| [2026-11-25-audit-findings.md](2026-11-25-audit-findings.md) | What the audit of 2026-11-25 found in the code: possible bugs, texts that disagree with the shop, unused code, comments that name what moved. Reported, not fixed |

## The reorganisation of 2026-11-25

Until that day the repository had a folder `doc/` with 24 files, a `README.md` of 75 KB and a `DECISIONS.md` of 433 KB. An audit against the code found:

- `doc/` held almost nothing about the shop itself. Fourteen files were copies of the backend's documents, one (`ARCHITECTURE.md`) described the backend's architecture, six were prompts for work that had been carried out, three were the deployment guides.
- The shop was described in two places only: the status list of the `README.md` (a history) and the decision log (the reasons). No document said what a feature does today.
- About 170 comments in the code point at the backend's documents, as "doc N" or by a path under `doc/`.

The documentation was rebuilt as `docs/`, written from the code by the [standard](../development/documentation-standard.md), with a [checker](../tools/check-docs.mjs).

### Moved

| Was | Is | Note |
| --- | --- | --- |
| `doc/CUSTOMER_WEB_API_DOCUMENTATION.md` and the thirteen other copies of backend documents | [reference/backend/](../reference/backend/README.md), under lower-case names | Kept as written. The table of old and new names is in that folder's README |
| `doc/DEPLOYMENT.md` | [deployment/README.md](../deployment/README.md) | Links between the three guides repaired; a note of 2026-11-24 and 25 added to the Hostinger guide |
| `doc/DEPLOYMENT_HOSTINGER.md` | [deployment/hostinger.md](../deployment/hostinger.md) | |
| `doc/DEPLOYMENT_VERCEL.md` | [deployment/vercel.md](../deployment/vercel.md) | |
| `DECISIONS.md` | [decisions/decision-log.md](../decisions/decision-log.md) | Unchanged; indexed by [decisions/README.md](../decisions/README.md) |

### Merged

| Was | Its content is now in |
| --- | --- |
| `README.md`, "Status" and "Before launch" | [2026-11-readme-status-log.md](2026-11-readme-status-log.md), as written. What each round built is described, as it is today, in the [feature documents](../features/README.md) |
| `README.md`, "Requirements", "Setup", "Running it locally", "Scripts" | [development/getting-started.md](../development/getting-started.md) |
| `README.md`, "The mock API" | [development/mock-api.md](../development/mock-api.md), with the controls the table lacked (`/__mock/shipping`, `/__mock/rewards`, `/__mock/issue`, `/__mock/review`) |
| `README.md`, "Quality checks" | [development/testing.md](../development/testing.md) |
| `README.md`, "Environment" | [architecture/configuration.md](../architecture/configuration.md) |
| `README.md`, "Structure" and "How the API is called" | [architecture/overview.md](../architecture/overview.md), [api/README.md](../api/README.md) |
| `README.md`, "Adding a text" | [architecture/internationalization.md](../architecture/internationalization.md) |
| `README.md`, "Deployment" | [deployment/README.md](../deployment/README.md) |
| The working rules inside the prompts, and "Working rules" of the decision log | [development/conventions.md](../development/conventions.md) |

### Removed

Each of these was read before it was removed. The history of the repository keeps them: `git show 227c407:<path>` prints any of them as it last was.

| Removed | Why | Where its facts are |
| --- | --- | --- |
| `doc/ARCHITECTURE.md` | The architecture of the backend, a copy of 2026-10-24, not of this repository | The backend's repository: `radhe-api/docs/architecture/`. What the shop needs of it is the API: [reference/backend/store-api.md](../reference/backend/store-api.md) |
| `doc/PROMPT_CUSTOMER_WEB.md` | The brief for the move to a shop that sells from stock (2026-10-16), carried out | The decision log, "The shop sells from stock"; the backend keeps the brief in its archive (`radhe-api/docs/archive/2026-10-migration-brief-retail-website.md`) |
| `doc/CUSTOMER_WEB_ACCOUNT_AGENT_PROMPT.md` | Prompt for accounts, guest checkout, wishlists, referrals, reviews and reports, carried out | [reference/backend/customer-accounts.md](../reference/backend/customer-accounts.md) and the feature documents |
| `doc/CUSTOMER_WEB_BOX_SHIPPING_AGENT_PROMPT.md` | Prompt for delivery by the box, carried out | [reference/backend/box-based-shipping-web-integration.md](../reference/backend/box-based-shipping-web-integration.md), [features/shipping.md](../features/shipping.md) |
| `doc/CUSTOMER_WEB_LEGAL_PAGES_AGENT_PROMPT.md` | Prompt for the legal pages from the API, carried out | [reference/backend/legal-pages.md](../reference/backend/legal-pages.md), [features/legal-pages.md](../features/legal-pages.md) |
| `doc/CUSTOMER_WEB_ORDER_REVIEWS_AGENT_PROMPT.md` | Prompt for order reviews, carried out | [reference/backend/order-reviews.md](../reference/backend/order-reviews.md), [features/reviews.md](../features/reviews.md) |
| `doc/CUSTOMER_WEB_VARIANT_IMAGES_AGENT_PROMPT.md` | Prompt for pictures per pack size, carried out | [reference/backend/variant-images.md](../reference/backend/variant-images.md), [features/product-page.md](../features/product-page.md) |

### Changed outside `docs/`

| File | Change |
| --- | --- |
| `README.md` | Rewritten as the short entry to the repository; everything else moved as listed above |
| `.prettierignore` | `doc` became `docs`: the documents are not run through Prettier ([standard](../development/documentation-standard.md)) |
| `CLAUDE.md` | Points coding agents at `docs/README.md` |

No file of the application was changed.

## Old paths

Comments in the code, the decision log, the build check's file and `.env.example` still name the paths of before 2026-11-25. They were not edited: the task was documentation only.

| A text names | Read |
| --- | --- |
| "doc N" or a path `doc/…` of a backend document | [reference/backend/README.md](../reference/backend/README.md#2-what-the-comments-in-the-code-call-them) |
| `doc/DEPLOYMENT.md`, `doc/DEPLOYMENT_HOSTINGER.md`, `doc/DEPLOYMENT_VERCEL.md` | [deployment/](../deployment/README.md) |
| `DECISIONS.md` | [decisions/decision-log.md](../decisions/decision-log.md) |
| `README.md`, "Status" or "Environment" | [2026-11-readme-status-log.md](2026-11-readme-status-log.md), [architecture/configuration.md](../architecture/configuration.md) |
