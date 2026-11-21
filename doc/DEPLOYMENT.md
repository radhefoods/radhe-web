# Deployment: two hosts, one code

The shop can run on Hostinger and on Vercel. Both are kept ready for production at all times, and which of them serves `www.radhefoods.de` is decided by two DNS records, not by the code.

| Guide                                                | What it holds                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| This file                                            | The branches, the build check, keeping the branches in step, changing the host, going back |
| [DEPLOYMENT_HOSTINGER.md](DEPLOYMENT_HOSTINGER.md)   | Setting up and running the shop on Hostinger                     |
| [DEPLOYMENT_VERCEL.md](DEPLOYMENT_VERCEL.md)         | Setting up and running the shop on Vercel                        |

## 1. The branches

| Branch              | Deployed by | Role                                                                 |
| ------------------- | ----------- | -------------------------------------------------------------------- |
| `main`              | Hostinger   | The default branch. All work lands here. Every push is a deployment on Hostinger |
| `production/vercel` | Vercel      | What Vercel serves as production. Moves only when it is brought up to `main` (section 4) |

**Both branches hold the same code.** There is no Hostinger version and no Vercel version of any file. What differs between the hosts is set where it belongs:

| What differs                    | Hostinger                                       | Vercel                                   | Where it is set          |
| ------------------------------- | ----------------------------------------------- | ---------------------------------------- | ------------------------ |
| The branch that is deployed     | `main`                                          | `production/vercel`                      | The dashboard of the host |
| The build script                | `build:webpack` (`next build --webpack`)        | `build` (`next build`, Turbopack)        | The dashboard of the host |
| The output                      | Standalone server, set by Hostinger itself      | Vercel's own                             | Nothing to set           |
| Bare domain → `www`             | The shop redirects (`next.config.ts`)           | Vercel redirects before the shop is asked | Code that both carry; Vercel's Domains page |
| Environment variables           | hPanel → Environment variables                  | Project → Settings → Environment Variables | The dashboard of the host |

Files that only one host reads still live in both branches, and the other host ignores them: `build:webpack` in `package.json` and `NEXT_OUTPUT` in `next.config.ts` (Hostinger and the build check), `VERCEL_ENV` in the content security policy (Vercel's previews). A `vercel.json`, should one ever be needed, goes into `main` as well. That is what keeps the two branches free of conflicts: **nothing is ever committed on `production/vercel` alone.**

### Why one code and not two

The shop uses nothing a host has to provide beyond Node.js: no image optimizer (the pictures are ready-made files of the API's CDN), no functions at the edge, no key-value store, no secrets. The five environment variables are the same on both hosts. Two diverging branches would have to be merged by hand for every change, and the one not in use would rot unnoticed. With one code, the branch not in use is proven by the same build check as the one in use.

## 2. The environment variables

The same five on both hosts, with the same values. All are public (`README.md`, "Environment").

| Variable                       | Production value            | Read             |
| ------------------------------ | --------------------------- | ---------------- |
| `NEXT_PUBLIC_SITE_URL`         | `https://www.radhefoods.de` | While building   |
| `NEXT_PUBLIC_API_URL`          | `https://api.radhefoods.de` | While building   |
| `NEXT_PUBLIC_SUPPORT_EMAIL`    | The support mailbox         | While building   |
| `NEXT_PUBLIC_FEATURE_WHATSAPP` | `false`                     | While building   |
| `API_INTERNAL_URL`             | Empty                       | When the server runs |

`NEXT_PUBLIC_` values are built into the pages: set them before the first build, and build again after changing one (Hostinger does that by itself when a variable is saved; on Vercel, redeploy).

Because both hosts are built for `https://www.radhefoods.de`, the host that is not in use names the real address in its canonical links, its `robots.txt` and its sitemap. A search engine that finds its technical address (`….vercel.app`, Hostinger's preview address) is pointed to the real shop.

`NEXT_OUTPUT=standalone` is not a variable of production. Hostinger sets the standalone output by itself; the variable exists so that the build check and a developer can build the same thing.

## 3. The build check

`.github/workflows/ci.yml` runs on every push to `main` and to `production/vercel`, and on every pull request into either:

| Job                        | What it does                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| Types, lint, format, tests | `npm run check`                                                                                        |
| Build and start (vercel)   | `npm run build`, then `npm run smoke`: the ordinary build, started with `next start`                   |
| Build and start (hostinger) | `NEXT_OUTPUT=standalone npm run build:webpack`, then `npm run smoke -- --standalone`: the standalone server, started as Hostinger starts it |

`npm run smoke` (`scripts/smoke.mjs`) starts the mock API and the built shop on ports of their own and asks the shop for: `/api/health`, the redirect of `/` to a language, both home pages with their security headers, a built style sheet, a file of `public/`, the product list, a product page twice (rendered once, then served from the cache), a legal text read from `content/`, `robots.txt`, `sitemap.xml`, a 404, and the redirect of the bare domain to `www`. The API is not reachable while the pages are built, which keeps the promise that the build does not depend on the API.

The check does not deploy, and the hosts do not wait for it: a push to `main` is built by Hostinger whether the check is green or not. So:

- **Before pushing to `main`**, run `npm run check`. For a change to `next.config.ts`, `package.json`, the proxy or anything about caching, also run the two builds with their smoke test (the commands of the table).
- **Before bringing `production/vercel` up to `main`**, the check of that `main` commit must be green (section 4).
- A rule on GitHub that protects both branches and requires the three jobs (Settings → Rules → Rulesets) turns the habit into a guarantee for pull requests. It is not set up: the work so far is pushed to `main` directly, and such a rule would end that. The owner's choice.

The end-to-end tests (`npm run test:e2e`) are not part of the check: the whole suite takes about a quarter of an hour and has tests that are known to be out of date (`README.md`). They remain the check by hand before a larger release.

## 4. Bringing `production/vercel` up to `main`

`production/vercel` only ever moves forward to a commit of `main`. No merge commit, nothing to resolve.

1. The commit of `main` to release has a green build check (GitHub → Actions), and Hostinger serves it without trouble if Hostinger is the host in use.
2. Move the branch:

   ```bash
   git fetch origin
   git push origin origin/main:production/vercel
   ```

   Git refuses this push unless it is a plain step forward, so it cannot lose anything. To release an older commit of `main` instead of the newest, name it: `git push origin <commit>:production/vercel`.

3. Vercel builds the branch and puts it into production on its side. Check `https://<the project>.vercel.app/api/health` and one product page there, or the real address if Vercel is the host in use.

**If the push is refused** ("non-fast-forward"), somebody committed on `production/vercel` directly. Nothing is lost; bring the work to `main`, where it belongs:

```bash
git fetch origin
git log --oneline origin/main..origin/production/vercel   # the commits that exist only there
git checkout main && git pull
git cherry-pick <each of those commits, oldest first>      # resolve conflicts here, once
npm run check && git push origin main
git checkout production/vercel && git pull
git merge origin/main                                       # a merge commit; no force push
git push origin production/vercel
```

After that the branches hold the same code again, and later steps forward work as before. Do not force-push either branch: both are deployed from.

**A setting of one host is never lost in this**, because none of them is in a file of one branch: the settings are in the dashboards (section 1) and in the two host guides.

How often: with every release that should be ready on Vercel. As long as Hostinger is the host in use, once a week or after every larger change is enough; the longer the branch lags, the less a change of host is "the same shop".

## 5. Changing the host

Nothing in the code changes, and nothing is built for it. The host that takes over is already running the shop.

The DNS of `radhefoods.de` is kept at Hostinger (name servers `*.dns-parking.com`; hPanel → Domains → `radhefoods.de` → DNS / Nameservers). The API (`api.radhefoods.de`) is not touched by any of this.

### 5.1 The day before

1. **Write down the records as they are** (`@` and `www`: type, value, TTL). They are the way back.
2. **Lower the TTL** of the `@` and `www` records to 300 seconds, at least one old TTL before the change. A change, and a change back, then reach visitors within five minutes.
3. **Bring the host that takes over up to date** and prove it:
   - To Vercel: section 4, then `https://<the project>.vercel.app/api/health` answers `{"status":"ok"}` and a product page opens there.
   - To Hostinger: the last deployment of `main` is green in hPanel, and the checks of `DEPLOYMENT_HOSTINGER.md`, section 5, pass.
4. **Environment variables** of the host that takes over are the five of section 2. They were built in at its last build; if one was changed since, redeploy first.
5. **The domain is added on the host that takes over** (`www.radhefoods.de` and `radhefoods.de`), even while DNS points elsewhere. Vercel shows "Invalid Configuration" for a domain whose DNS points away; that is expected and harmless.
6. **The API needs nothing**: its `CORS_ORIGINS`, `SHOP_URL` and `COOKIE_DOMAIN` name the shop's address, and the address stays the same. Sign-in, the cart and the way back from Stripe work on either host for that reason.

### 5.2 The change

Pick a quiet hour. An order that is being paid at Stripe during the change is safe: the payment is confirmed between Stripe and the API, and the customer comes back to the same address.

| To      | `@` (the bare domain)                                             | `www`                                                              |
| ------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| Vercel  | `A` → the address Vercel's Domains page shows for the project (`216.198.79.1` on 2026-11-21) | `CNAME` → the name Vercel's Domains page shows (`9e8e9dd5828f80e0.vercel-dns-017.com` on 2026-11-21) |
| Hostinger | What hPanel sets when the domain is connected to the web app ("Connect domain"), or `A` → the IP address of the hosting plan (hPanel → Websites → Dashboard → Plan details) | `CNAME` → `radhefoods.de`, or what hPanel sets |

Take the values from the dashboards on the day, not from this table: both hosts change their addresses from time to time. Remove `AAAA` records for `@` and `www` that point to the host being left.

### 5.3 The certificate

Each host issues its own certificate for the domain, and can only do so (and renew it) while DNS points to it. On the host that takes over:

- Vercel issues it within a minute or two after DNS arrives. Domains page: "Valid Configuration".
- Hostinger: hPanel → Websites → Dashboard → Security → SSL shows "Active" for both names; install it there if it is not.

Until the certificate is there, browsers show a warning for the shop, and because the shop sends `Strict-Transport-Security`, a returning visitor cannot click past it. That window is the real cost of a change: minutes when all goes well. A certificate that the host still holds from an earlier turn and that has not expired (90 days) closes the window entirely, so changing back soon after a change is immediate.

### 5.4 Checking the change

```bash
# Which host answers? Vercel: "server: Vercel". Hostinger: "server: hcdn" or "LiteSpeed", and "platform: hostinger".
curl -sI https://www.radhefoods.de/api/health

curl -s  https://www.radhefoods.de/api/health          # {"status":"ok"}
curl -sI https://radhefoods.de/en/cart                 # 308, location: https://www.radhefoods.de/en/cart
curl -sI https://www.radhefoods.de/                    # 307 to /en (or /de)
curl -s  https://www.radhefoods.de/robots.txt          # Sitemap: https://www.radhefoods.de/sitemap.xml
curl -s  https://www.radhefoods.de/sitemap.xml | head -c 600
```

Then in a browser, in a private window:

1. The home page, a category, a product, the search.
2. Sign in, open the account. (The session cookies are the API's, for `.radhefoods.de`: a customer who was signed in before the change is still signed in.)
3. Put a product into the cart, go to the checkout, press Buy now, and come back from Stripe's page without paying.
4. Both languages; a legal page; the cookie page.

For a day: the runtime logs of the new host, and Search Console → Sitemaps (the sitemap is read again without doing anything).

### 5.5 Afterwards

- Raise the TTL again (an hour or more) once the change has held for a day.
- **Keep the other host deployed.** It is the way back, and it costs nothing while nobody visits it. On Hostinger the process of an app without visitors is stopped by itself.
- The host that was left can no longer renew its certificate. That only matters at the next change back (5.3).

### 5.6 Going back

Set the two records back to the values written down in 5.1. With a TTL of 300 seconds visitors are back on the old host within five minutes. Nothing else has to be undone.

## 6. A deployment that went wrong

| Host      | A build fails                                                    | A deployment works badly                                                                 |
| --------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Hostinger | The build before it stays live. Read the build log, fix, push    | There is no button for an earlier version. `git revert <commit>` on `main` and push: Hostinger builds the state before. For an outage that cannot wait for a build: change the host (section 5) |
| Vercel    | The deployment before it stays live                              | Deployments → the last good one → **Instant Rollback** (or Promote). Then `git revert` on `main` and section 4, so the branch matches what is live |

`git revert` adds a commit that undoes one; it never rewrites the history of a branch that is deployed from.

## 7. Watching the shop

Neither host is told to alert anybody today. The least that is worth having:

- **An uptime monitor** (UptimeRobot, Better Stack, any) on `https://www.radhefoods.de/api/health` and on `https://www.radhefoods.de/en`, every five minutes, with an email on failure. The first says the server runs; the second that a page with the API behind it renders.
- **On Hostinger**: the dashboard of the web app (CPU, memory, processes against the limits of the plan) and the runtime logs.
- **On Vercel**: Observability and the runtime logs of the project.
- **Search Console**: Pages and Sitemaps, in the week after a change of host.

`/api/health` asks the API for nothing and renders no page. It answers `{"status":"ok"}` with `Cache-Control: no-store`.
