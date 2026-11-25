# Getting started

How to run the shop on a development computer, and the commands of the project. The shop has no database and no secrets of its own: it needs only an API to talk to, and for development that is the [mock API](mock-api.md) in this repository.

## 1. Requirements

| Needed | Version | Note |
| --- | --- | --- |
| Node.js | 24 | `.nvmrc` names it; `engines` in `package.json` asks for `>=24`. The mock API runs TypeScript directly with Node and needs it |
| npm | The one that comes with Node | `package-lock.json` is committed; the build check installs with `npm ci` |
| Chromium of Playwright | – | Only for the browser tests: `npx playwright install chromium`, once |

## 2. Setup

```bash
npm install
cp .env.example .env.local   # then adjust if needed
```

`.env.example` works as it is for local development: the shop on `http://localhost:3001`, the API on `http://localhost:3000`. Every variable is explained in [architecture/configuration.md](../architecture/configuration.md).

## 3. Running it

Two terminals:

```bash
npm run dev:mock   # the mock API on http://localhost:3000
npm run dev        # the shop on http://localhost:3001
```

Open `http://localhost:3001`. The address without a language leads to `/en`.

To use the real backend instead, start `radhe-api` on port 3000 and do not start the mock. Its `CORS_ORIGINS` must contain `http://localhost:3001`, and the shop and the API must be reached under the same host name (`localhost`), because the session travels in cookies ([authentication and security](../architecture/authentication-and-security.md)).

`next dev` rewrites `AGENTS.md` with its block about this version of Next.js; committing the file with the work keeps the tree clean.

## 4. Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | The shop in development mode on port 3001 |
| `npm run dev:mock` | The mock API on port 3000 |
| `npm run build` | The production build (Turbopack, the default of Next.js 16) |
| `npm run build:webpack` | The production build with webpack: the build script Hostinger is given ([deployment/hostinger.md](../deployment/hostinger.md)) |
| `npm run start` | Serves the production build on port 3001 |
| `npm run smoke` | Starts the built shop and the mock API on ports of their own (3101, 3100) and asks the shop for a handful of pages; with `-- --standalone` it starts the standalone server instead ([deployment](../deployment/README.md)) |
| `npm run check` | `typecheck`, `lint`, `format:check` and `test`, in this order: the check before every commit |
| `npm run typecheck` | `next typegen` (the types of the routes), then `tsc --noEmit` |
| `npm run lint` | ESLint (`eslint.config.mjs`) |
| `npm run format` · `npm run format:check` | Prettier over the repository; `.prettierignore` leaves out `docs`, `public`, `logo`, the lock file and what Next.js generates |
| `npm run test` · `npm run test:watch` | Unit and integration tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright): [testing.md](testing.md) |
| `npm run check:content` | Lists the placeholders still open in `content/legal/` ([legal pages](../features/legal-pages.md)) |
| `node docs/tools/check-docs.mjs` | Checks the documentation against the code ([documentation standard](documentation-standard.md)) |
| `node scripts/make-icons.mjs` | Draws the icons of the shop from the brand mark ([icons and images](../design-system/icons-and-images.md)) |

## 5. Where to read next

| To do this | Read |
| --- | --- |
| Understand how the shop is built | [architecture/overview.md](../architecture/overview.md) |
| Change a page or a feature | Its document in [features/](../features/README.md), then [conventions.md](conventions.md) |
| Call the API | [api/README.md](../api/README.md) |
| Add a text | [architecture/internationalization.md](../architecture/internationalization.md) |
| Change how something looks | [design-system/README.md](../design-system/README.md): the look is the owner's, ask first |
| Release | [deployment/README.md](../deployment/README.md) |
