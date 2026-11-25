# Configuration

The shop is configured by five environment variables, read once in `src/config/env.ts`, and by `next.config.ts`. None of the values is a secret: four are built into the scripts the browser loads, and the fifth is an address. A handful of further variables belong to the build, to the hosts and to the tools of the repository (the mock API, the smoke script, the browser tests). This document lists every variable the code reads, the one feature flag, and what each configuration file sets.

## The variables of the shop

`.env.example` names all five. A copy of it, `.env.local`, holds the values of a developer's machine and is not committed (`.gitignore` excludes every `.env*` file but the example). In production they are set in the dashboard of the host, with the same values on both hosts ([deployment](../deployment/README.md)).

| Variable | Read by | Visible | Default | What it does |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `src/config/env.ts`, `next.config.ts`, `scripts/smoke.mjs` | Public | `http://localhost:3001` | The public address of the shop, without a slash at the end: the base of every canonical address, `hreflang` link, Open Graph address and structured-data id, of `robots.txt` and of the sitemap; decides whether the bare domain is redirected |
| `NEXT_PUBLIC_API_URL` | `src/config/env.ts`, `next.config.ts` | Public | `http://localhost:3000` | The address of the API as the browser reaches it, without a slash at the end and without `/v1`; its origin is admitted by the Content Security Policy |
| `API_INTERNAL_URL` | `src/config/env.ts` | Server only | The value of `NEXT_PUBLIC_API_URL` | The address of the API as the Next.js server reaches it, for example an internal address on the same host |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | `src/config/env.ts` | Public | Empty | The contact address. The code uses it in one place: `email` of the `Organization` block of the home page (`src/lib/seo/json-ld.tsx`), left out when empty |
| `NEXT_PUBLIC_FEATURE_WHATSAPP` | `src/config/env.ts` | Public | Off | The feature flag below. Only the exact value `true` switches it on |

No variable is required for the shop to start. Without `NEXT_PUBLIC_API_URL` a deployed shop looks for the API on `localhost:3000`, which answers nothing there, so in practice the first two must be set before the first build.

### Build time and run time

| Kind | When it is read | To change it |
| --- | --- | --- |
| `NEXT_PUBLIC_*` | While building: Next.js replaces each name by its value in the scripts. That is why `src/config/env.ts` writes every name out in full | Set the value, then build again |
| `API_INTERNAL_URL` | When the server runs | Set the value and restart; no build is needed (`scripts/smoke.mjs` points a built shop at the mock API this way) |

### The address of the shop

`primarySiteUrl` in `src/config/env.ts` reads `NEXT_PUBLIC_SITE_URL` as the address the shop answers at, so that a setting which names an address that only redirects cannot reach a canonical link or the sitemap.

| Setting | Read as |
| --- | --- |
| `https://radhefoods.de` | `https://www.radhefoods.de` |
| `http://www.radhefoods.de/` | `https://www.radhefoods.de` |
| `https://www.radhefoods.de` | `https://www.radhefoods.de` |
| Any other address (a preview, `http://localhost:3001`) | As it is, without slashes at the end |

`bareDomainRedirect` in `next.config.ts` applies the same rule on its own, because the build tools of a host read that file alone, and `scripts/smoke.mjs` reads the variable the same way. The result is `env.siteUrl`; the address of the API is `env.apiUrl` (browser) and `env.apiInternalUrl` (server). How the address is used is in [seo.md](seo.md).

## Feature flags

`env.features` holds the flags; `isFeatureEnabled(name)` reads one.

| Flag | Variable | Read in | On |
| --- | --- | --- | --- |
| `whatsapp` | `NEXT_PUBLIC_FEATURE_WHATSAPP` | `src/components/account/profile-view.tsx` | The opt-in for messages by WhatsApp is shown in the profile. The API stores the preference either way |

Everything else that appears or disappears in the shop follows an answer of the API and is no flag of the shop: delivery by the box (`shipping.boxBased` of the settings), the coins (`enabled` of the rewards program), online payment, the published legal pages, the banners.

## Variables of the build and of the hosts

| Variable | Set by | Read by | What it does |
| --- | --- | --- | --- |
| `NODE_ENV` | Next.js | `next.config.ts`, `src/features/reviews/data.ts` | Outside `production` the Content Security Policy admits `'unsafe-eval'` and the WebSocket of `next dev`; in `development` the public reviews are read without the five-minute cache |
| `NEXT_PHASE` | Next.js | `src/lib/api/server.ts` | `leaveToFirstVisitWhileBuilding`: while building, a page that cannot load its content is left to its first visit instead of stopping the build |
| `VERCEL_ENV` | Vercel | `next.config.ts` | `preview` admits the origins of Vercel's comment toolbar in the Content Security Policy |
| `NEXT_OUTPUT` | The build check, a developer | `next.config.ts` | `standalone` builds the server that runs without `node_modules`. Not a variable of production: Hostinger sets that output itself, Vercel uses the ordinary one |
| `NEXT_BUILD_WORKERS` | A host, when needed | `next.config.ts` | How many processes `next build` starts for the pages. Without it: four at most, and one fewer than the processors of the machine |
| `CI` | GitHub Actions | `playwright.config.ts` | Forbids `test.only`, retries a failed test once, reports for GitHub, and starts servers of its own instead of using running ones |

The build check (`.github/workflows/ci.yml`) also sets `NEXT_TELEMETRY_DISABLED`, which Next.js itself reads.

## Variables of the tools

Read by the mock API and the smoke script, never by the shop. Details are in [development/mock-api.md](../development/mock-api.md).

| Variable | Read by | Default | What it does |
| --- | --- | --- | --- |
| `MOCK_PORT` | `mocks/server.ts` | `PORT`, then `3000` | The port of the mock API |
| `PORT` | `mocks/server.ts` | `3000` | The port of the mock API when `MOCK_PORT` is not set |
| `CORS_ORIGINS` | `mocks/server.ts` | `http://localhost:3001` | The origins the mock API answers with credentials, separated by commas |
| `SHOP_URL` | `mocks/server.ts` | `http://localhost:3001` | The address of the shop in the links the mock API builds |
| `MOCK_LATENCY_MS` | `mocks/server.ts` | `0` | A delay before every answer, to see the loading states |
| `MOCK_STRIPE` | `mocks/payments.ts`, `mocks/server.ts` | On | `off` answers as an API without online payment |
| `MOCK_ACCESS_TTL_SECONDS` | `mocks/state.ts` | `900` | The lifetime of the access cookie, to see the refresh happen |
| `SMOKE_API_PORT` | `scripts/smoke.mjs` | `3100` | The port the smoke script starts the mock API on |
| `SMOKE_PORT` | `scripts/smoke.mjs` | `3101` | The port the smoke script starts the built shop on |

The smoke script hands the processes it starts `MOCK_PORT`, `NODE_ENV=production`, `PORT`, `HOSTNAME` and `API_INTERNAL_URL`.

## What `next.config.ts` sets

| Setting | Value | Why |
| --- | --- | --- |
| Plugin | `createNextIntlPlugin("./src/i18n/request.ts")` | Tells next-intl where the language and the texts of a request come from |
| `reactStrictMode` | `true` | – |
| `poweredByHeader` | `false` | No `X-Powered-By` header |
| `experimental.cpus` | `buildWorkers()` | Next.js starts one process per processor, less one, and each starts a thread per processor; on a shared build server with 56 processors that exceeded the account's limit of threads. Four are plenty for the pages written ahead |
| `output` | `standalone` when `NEXT_OUTPUT=standalone`, else the ordinary output | The same server Hostinger builds can be built elsewhere |
| `outputFileTracingIncludes` | The files of `content/legal` for the legal pages | The legal pages read Markdown files at run time; a host must deploy them with the server |
| `images` | Not set | Pictures are plain `<img>` elements with the ready-made files of the API's CDN; the image optimiser of Next.js is not used, so no remote pattern is needed ([performance.md](performance.md)) |
| `redirects` | The bare domain to `www` (permanent, path and query kept), only when `NEXT_PUBLIC_SITE_URL` is an `https://www.` address | On a Node.js host nothing else does it, and the shop would answer at two addresses. Vercel redirects before the shop is asked |
| `redirects` | `/legal/preorder-terms` and `/en/legal/preorder-terms` to `/en/legal/terms`; `/de/rechtliches/vorbestellbedingungen` to `/de/rechtliches/agb` (permanent) | Search engines hold the address of the pre-order terms from an earlier sitemap; it leads to the terms for good |
| `headers` | `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` on `/brand/:path*` | The logo and the icons keep their names: a day in the browser, renewed in the background for a week |
| `headers` | The Content Security Policy and five further headers on `/:path*` | [authentication-and-security.md](authentication-and-security.md) |

No rewrites, no `basePath`, no `i18n` key (the languages are next-intl's, [internationalization.md](internationalization.md)), no Cache Components.

## The other configuration files

| File | What it sets |
| --- | --- |
| `tsconfig.json` | Strict TypeScript without emit, `moduleResolution: "bundler"`, JSON imports, the plugin of Next.js, and one path alias: `@/*` is `./src/*` |
| `postcss.config.mjs` | One plugin, `@tailwindcss/postcss`: Tailwind CSS v4, configured in `src/app/globals.css` and not in a JavaScript file |
| `eslint.config.mjs` | The rule sets `core-web-vitals` and `typescript` of `eslint-config-next`, with its default ignores |
| `vitest.config.mts` | Tests are `src/**/*.test.ts`, `src/**/*.test.tsx` and `mocks/**/*.test.ts`, in the `node` environment, with the alias `@`; next-intl is processed by Vite |
| `playwright.config.ts` | Tests of `e2e`, one worker, a desktop (1280 × 800) and a phone (Pixel 7) project, the shop on `http://localhost:3001`, the cookie notice stored as read; starts `npm run dev:mock` and `npm run build && npm run start` unless they run already |
| `.prettierrc.json` | One plugin, `prettier-plugin-tailwindcss`, which sorts class names |
| `.prettierignore` | Keeps Prettier off `docs`, `public`, `logo`, the lock file and generated files |
| `.nvmrc` and `engines` of `package.json` | Node.js 24 |
| `src/proxy.ts` | The addresses the language proxy handles: everything but `/api`, `/_next`, `/_vercel` and files with an extension, plus the unsubscribe link, whose token can contain a dot |
| `.github/workflows/ci.yml` | The build check: `npm run check`, then the build of each host started by `scripts/smoke.mjs`, with the production values of the public variables and an `API_INTERNAL_URL` where nothing answers |

## Adding a variable

1. Read it in `src/config/env.ts`, with the name written out in full and a default that lets the shop start without it.
2. Add it to `.env.example` with a comment, and to this document (the checker of the documents compares both with the code).
3. A value the browser needs carries the prefix `NEXT_PUBLIC_` and is public; the shop has no place for a secret, since every call for a customer is made by the browser.
4. Set it on both hosts, and in the `env` block of `.github/workflows/ci.yml` when the build depends on it.
