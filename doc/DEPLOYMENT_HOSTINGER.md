# The shop on Hostinger

How the shop is set up and run as a Node.js web app on Hostinger's web hosting. The branches, the build check and the change of host are in [DEPLOYMENT.md](DEPLOYMENT.md).

> **What is proven and what is not (2026-11-21).** The server that Hostinger builds and starts (webpack, standalone output) was built on a computer and in the build check, started, and asked for its pages (`npm run smoke -- --standalone`). **No deployment on Hostinger itself has succeeded yet.** What Hostinger does is taken from its documentation, linked below; section 6 lists what the first deployment has to confirm.
>
> **2026-11-22: the first build on Hostinger failed, and why.** Installing, compiling with webpack and the type check passed there. Writing the pages ahead did not: Hostinger's build server has 56 processors, Next.js started 55 processes for it, each of them starts a thread per processor, and the account's limit of threads was reached ("OS can't spawn worker thread: Resource temporarily unavailable", then `SIGABRT`). The shop now starts four such processes at most (`buildWorkers` in `next.config.ts`). Whether the build passes with that is for the next deployment to show.

Sources: [Next.js on Hostinger](https://docs.hostinger.com/node.js/overview-1/next), [build settings](https://docs.hostinger.com/node.js/build-settings), [creating an app](https://docs.hostinger.com/node.js/creating-an-app), [environment variables](https://docs.hostinger.com/node.js/environment-variables), [deploying from Git](https://docs.hostinger.com/node.js/git-deployments), [deployments](https://docs.hostinger.com/node.js/deployments), [file structure](https://docs.hostinger.com/node.js/file-structure), [limits of the plans](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/), [Next.js 16 build errors](https://www.hostinger.com/support/?p=21144), [503 and the process limit](https://www.hostinger.com/support/?p=21123).

## 1. What Hostinger does with a Next.js app, and what the shop does about it

| Hostinger                                                                                                              | The shop                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Builds every Next.js app with the standalone output and starts that server itself. The `start` script and the "entry file" are not used | Nothing to set. `npm run start` (port 3001) stays what it is, for a developer's computer. The standalone server is what the build check starts   |
| States that Next.js 16.3.3 and newer must be built with webpack on its servers                                         | `npm run build:webpack` (`next build --webpack`) is the build script to choose. The shop has no setting that only one of the two bundlers knows   |
| Keeps `next.config.ts` and adds its output setting; a configuration exported as a function fails the build             | `next.config.ts` exports an object                                                                                                               |
| Gives the environment variables to the build and to the running app; saving a variable builds again                    | The five variables of `DEPLOYMENT.md`, section 2, set before the first build                                                                     |
| Builds on a shared server with 56 processors, under the account's limit of processes and threads (seen 2026-11-22)      | The build starts four processes for the pages at most, not one per processor (`buildWorkers` in `next.config.ts`; `NEXT_BUILD_WORKERS` sets another number)   |
| Stops the process of an app without visitors, and starts it at the next request                                        | The server answers about a second after its start (measured on a computer). A timer keeps it awake (section 3.4)                                  |
| Starts a process each for `radhefoods.de` and `www.radhefoods.de`; rewrites its `.htaccess` at every deployment        | The redirect of the bare domain to `www` is the shop's own (`next.config.ts`), not a rule in a file of the host. The process of the bare domain only answers redirects |
| Counts processes and threads of the whole plan against one limit (120 on Business)                                     | One process, no cluster, no PM2. The server ran with 16 threads on a computer. The API on the same plan counts too                               |
| Replaces the folder of the app at every deployment                                                                     | The pages the server has kept (section 7) are gone after a deployment and are rendered again at their first visit. Nothing else is stored in files |
| Ends a request after 120 seconds; no WebSockets; no ports of the app's own                                             | The shop waits ten seconds for the API at most, and uses neither                                                                                 |
| Has no button for an earlier version                                                                                   | `git revert` and push, or change the host (`DEPLOYMENT.md`, section 6)                                                                           |

## 2. What is needed

- The Business web hosting plan or a Cloud plan, with a free place for a web app.
- Access of the Hostinger account to the GitHub repository `radhefoods/radhe-web`.
- The values of the five environment variables.

## 3. Setting it up

### 3.1 The web app

hPanel → **Websites** → **Add website** → **Node.js web app** → import from **GitHub** → `radhefoods/radhe-web`.

| Setting          | Value                                                     |
| ---------------- | --------------------------------------------------------- |
| Branch           | `main`                                                    |
| Application type | Next.js                                                   |
| Node.js version  | 24 (`engines` in `package.json` and `.nvmrc` name it)     |
| Root directory   | `/`                                                       |
| Build script     | `build:webpack`                                           |
| Output directory | `.next`                                                   |
| Entry file       | Empty (not used for Next.js)                              |
| Package manager  | npm (found from `package-lock.json`)                      |

**The domain.** The DNS of `radhefoods.de` is kept in Hostinger. Adding a website for the domain itself can point its records to Hostinger at once, which is the change of host. Two ways:

- **Try first (recommended while another host serves the shop):** add the web app with the temporary address Hostinger offers, look at it there, and connect `radhefoods.de` when it is to take over. Sign-in cannot be tried on the temporary address: the session cookies belong to `.radhefoods.de`.
- **Take over at once (when no host serves the shop):** add it for `radhefoods.de` directly.

Either way, look at the DNS zone right after adding the website (hPanel → Domains → `radhefoods.de` → DNS / Nameservers), and at the records of `api`: they must stay as they are.

### 3.2 The environment variables

Before the first build: in the set-up, or later under **Environment variables** → **Import .env**:

```env
NEXT_PUBLIC_SITE_URL=https://www.radhefoods.de
NEXT_PUBLIC_API_URL=https://api.radhefoods.de
NEXT_PUBLIC_SUPPORT_EMAIL=hello@radhefoods.de
NEXT_PUBLIC_FEATURE_WHATSAPP=false
```

`API_INTERNAL_URL` stays unset: on web hosting the shop reaches the API at its public address. `PORT`, `HOSTNAME`, `NODE_ENV` and `NEXT_OUTPUT` are not to be set: Hostinger starts the server its own way.

Hostinger reads the names of the variables from `.env.example` and offers its values, which are those of development (`http://localhost:3001`, `http://localhost:3000`). Replace them by the values above before the first build: they are written into the pages when the shop is built.

`NEXT_BUILD_WORKERS` is not needed. It exists for one case: a build that still ends with "OS can't spawn worker thread" (section 8).

None of these is a secret; the shop has none.

### 3.3 The first deployment

Deploy. The build log shows `▲ Next.js 16.4.5 (webpack)`, then "Compiled successfully", the list of routes, and no error. The build asks the API for the pages it writes ahead (the legal texts, the delivery pages); pages it cannot load are left to their first visit, so an API that is away does not fail the build.

Then the checks of section 5, on the temporary address or on the real one.

### 3.4 The timer that keeps the shop awake

Without visitors Hostinger stops the process; the next visitor waits for its start. hPanel → **Advanced** → **Cron jobs**:

| Field    | Value                                                           |
| -------- | --------------------------------------------------------------- |
| Command  | `curl -s https://www.radhefoods.de/api/health > /dev/null`      |
| Schedule | `*/5 * * * *`                                                   |

`/api/health` asks the API for nothing and renders no page. Set the timer up once Hostinger serves `www.radhefoods.de`; while another host does, the call would keep that one awake instead. An uptime monitor on the same address (`DEPLOYMENT.md`, section 7) does the same job and tells somebody when it fails.

### 3.5 The domain and the certificate

`DEPLOYMENT.md`, section 5: the two records, the certificate, the checks.

## 4. Updates

A push to `main` is a deployment: Hostinger installs, builds and restarts. One deployment runs at a time; further pushes wait. Requests that arrive during the restart can fail for a few seconds, so push larger changes at a quiet hour.

A build that fails changes nothing: the build before it keeps running. The build log is under **Deployments** → the failed row.

After a deployment the server has kept no page yet. Every product page is rendered at its first visit and asks the API for it; the API allows each address 120 requests a minute, and the shop's server is one address (measured on 2026-11-12). A search engine that reads many product pages in the first minutes after a deployment can use that allowance up, and pages that are not kept yet then answer with the error page until the minute is over. Deploying at a quiet hour keeps that rare; raising the allowance for the shop's server is a matter of the API.

Before pushing: `npm run check`, and for changes to the configuration or to caching the build of section 5 on a computer.

## 5. Checks

On a computer, before a push that could matter to the host (Git Bash, macOS or Linux):

```bash
NEXT_OUTPUT=standalone NEXT_PUBLIC_SITE_URL=https://www.radhefoods.de npm run build:webpack
NEXT_PUBLIC_SITE_URL=https://www.radhefoods.de npm run smoke -- --standalone
```

On Hostinger, after a deployment (replace the address by the temporary one before the domain is connected; the second line needs the real domain):

```bash
curl -s  https://www.radhefoods.de/api/health            # {"status":"ok"}
curl -sI https://radhefoods.de/en/cart                   # 308, location: https://www.radhefoods.de/en/cart
curl -sI https://www.radhefoods.de/en | grep -iE "^(HTTP|cache-control|content-security-policy|strict-transport)"
curl -s  https://www.radhefoods.de/robots.txt
curl -s  https://www.radhefoods.de/sitemap.xml | head -c 600
# A product page, twice: the second answer says "x-nextjs-cache: HIT".
curl -sI https://www.radhefoods.de/en/products/<a slug> | grep -iE "^(HTTP|x-nextjs-cache|cache-control)"
```

Then the pages by hand: `DEPLOYMENT.md`, section 5.4.

## 6. What the first deployment has to confirm

None of these could be tried without a deployment. Each has a check and a way out.

| Question                                                                 | Check                                                                                      | If not                                                                                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Does the build pass on Hostinger's servers with `build:webpack`?         | The build log                                                                              | Not yet: the build of 2026-11-22 ended while writing the pages (section 8, "OS can't spawn worker thread"); installing, compiling and the type check passed. Read the error. "produced no standalone server": the output directory must be `.next`. A memory or time limit: tell Hostinger's support (the build takes about two minutes on a computer; Hostinger allows fifteen) |
| Does the name of the domain reach the shop (the redirect to `www`)?      | `curl -sI https://radhefoods.de/en/cart` answers 308 to `https://www.radhefoods.de/en/cart` | The shop then answers at both addresses. The canonical links still name `www`, so search engines are not misled; set a redirect in hPanel (Domains → Redirects) and tell the developer |
| Are the pages the server keeps written and read (ISR)?                   | A product page twice: `x-nextjs-cache: HIT` the second time                                | The pages still work, each visit renders. Tell the developer: the folder of the app is not writable                                 |
| Is the home page passed on as it is, not kept by a cache of the host?    | `curl -sI https://www.radhefoods.de/en` shows `cache-control: private, no-cache, no-store…` and no `x-litespeed-cache: hit` / `x-hcdn-cache-status: HIT` | Switch the cache off for the website (hPanel → Advanced → Cache Manager), or a price change shows late                              |
| Is the answer compressed?                                                | `curl -sI -H "Accept-Encoding: br, gzip" https://www.radhefoods.de/en` shows `content-encoding` | Nothing breaks; pages load slower. Ask Hostinger's support                                                                          |
| Do memory and processes stay under the limits of the plan, with the API on it? | The dashboard of the web app and Resource usage, after a day with visitors                 | Section 7; a Cloud plan has higher limits                                                                                           |
| Does the certificate cover both names?                                   | `DEPLOYMENT.md`, section 5.3                                                               | Install it in hPanel → Security → SSL                                                                                               |

## 7. What costs the server work, and what does not

Vercel starts as many servers as there are visitors. On Hostinger one process on shared hosting does everything, so it matters what is rendered per visit. Measured with the standalone server on a computer against the mock API (2026-11-21); Hostinger's shared processors are slower, the proportions hold.

| Pages                                                                 | Rendered                                                                 | Cost per visit                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| Cart, checkout, account, wishlist, sign-in, how it works, cookie page | Once, when the shop is built. What belongs to a customer is fetched by the browser from the API | About 5 ms: a file is sent                              |
| Product, blog post, FAQ, legal texts, the page of all categories      | At the first visit, then kept for five minutes; a visit after that gets the kept page while a new one is rendered behind it | About 5 ms; a render (15 to 90 ms) at most every five minutes per page |
| Category, the product list, the search, the blog lists, the reviews   | At every visit, from answers of the API that are kept for five minutes   | 30 to 40 ms                                             |
| Home page                                                             | At every visit (the owner, 2026-10-18: a price change shows as soon as on the category pages), and the banners are asked of the API at every visit | About 60 ms and one request to the API; 430 kB of HTML  |
| `sitemap.xml`                                                         | At every request, from answers of the API that are kept for an hour      | Small; about forty requests to the API once an hour     |
| `/api/health`                                                         | At every request                                                         | About 3 ms                                              |

- **No picture is processed by the shop.** Product pictures are files of the API's CDN in three sizes, set with a plain `srcset`; the logo and the icons are files of `public/`. The image optimizer of Next.js is not used, so there is no such work to move or to limit.
- **The fonts are part of the build.** No request goes to Google when the shop runs. The build itself downloads the font once; a build fails if Google's font server cannot be reached at that moment (try again).
- **Memory:** 92 MB after the start, 375 MB after forty home pages rendered at once, on a computer. Next.js keeps up to 50 MB of pages in memory and the rest in files.
- **Forty visitors on the home page in the same moment** were all served within two seconds on a computer. A shop with a few hundred orders a month is far from that.

What would lower the work further, should the dashboard ever show the limits reached (each changes how soon a change of the admin shows, so each is the owner's decision):

1. Ask for the banners once a minute instead of at every visit of the home page. The API itself answers them from a copy that is a minute old. This also takes the home page out of the API's allowance of 120 requests a minute.
2. Keep the home page for a minute, like the product pages are kept for five.
3. A plan with processors of its own (Cloud, VPS). The code does not change.

## 8. When something is wrong

| What shows                                              | What it is                                                                                         | What to do                                                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Hostinger's page "503 Service Unavailable"              | No process answers: the limit of processes or memory of the plan is reached, or the start failed   | Resource usage → Stop running processes; the dashboard of the web app → Running → Restart; runtime logs and `stderr.log` |
| The build ends while "Generating static pages", with "OS can't spawn worker thread: Resource temporarily unavailable" and `SIGABRT` | The build asked for more threads than the account may have. The log line "Generating static pages using N workers" shows how many processes it started; each starts a thread per processor of the build server | N must be 4 or less (`buildWorkers` in `next.config.ts`). If it is and the build still ends so: stop running processes (Resource usage), set the variable `NEXT_BUILD_WORKERS=1`, redeploy |
| The build fails with `TurbopackInternalError`           | The build script is `build`                                                                        | Choose `build:webpack` in the deployment settings, redeploy                                     |
| "Next.js build produced no standalone server"           | The output directory is not `.next`, or the configuration exports a function                       | Deployment settings; `next.config.ts`                                                           |
| The shop shows the frame, but "something went wrong" where products should be | The API does not answer the shop's server, or its allowance of requests is used up                 | `https://api.radhefoods.de/health`; the runtime logs of the API; wait a minute                  |
| Canonical links or the sitemap name another address     | `NEXT_PUBLIC_SITE_URL` was not set when the shop was built                                         | Set it, save (Hostinger builds again)                                                           |
| A change does not show after a deployment               | The deployment is still waiting or failed; or a kept page is up to five minutes old                | Deployments; wait five minutes                                                                  |
| Sign-in does not work                                   | The shop is looked at on an address outside `radhefoods.de` (the temporary address)                | Expected there. On the real address: `CORS_ORIGINS` and `COOKIE_DOMAIN` of the API              |
