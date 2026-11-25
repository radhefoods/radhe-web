# The shop on Vercel

How the shop is set up and run on Vercel. The branches, the build check and the change of host are in [README.md](README.md).

> **State on 2026-11-21.** Vercel built every commit of `main` as production until this day, and its last build (the commit both branches started from) succeeded. On the same day every address of the shop answered `402 Payment required` with `x-vercel-error: DEPLOYMENT_DISABLED`: Vercel has switched the deployments of the account off. That is a matter of the account (Vercel → Settings → Billing and Usage), not of the code, and it has to be settled before Vercel can serve the shop again, as the host in use or as the one kept ready. Vercel's free plan (Hobby) is for non-commercial use only; a shop needs the Pro plan.

## 1. The project

Vercel reads everything else from the repository: there is no `vercel.json`, and none is needed.

| Setting (Project → Settings)                 | Value                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| Git repository                               | `radhefoods/radhe-web`                                                 |
| **Production branch** (Environments → Production → Branch Tracking) | **`production/vercel`** (it was `main` until 2026-11-21) |
| Framework preset                             | Next.js                                                                |
| Build command                                | The default (`next build`). Not `build:webpack`: that script is Hostinger's |
| Install command, output directory            | The defaults                                                           |
| Root directory                               | The root of the repository                                             |
| Node.js version                              | 24.x. Vercel takes it from `engines` in `package.json`                 |
| Region of the functions                      | Frankfurt (`fra1`), next to the API                                    |

**Changing the production branch is the one setting that has to be made by hand** for the two-host arrangement. Until it is made, Vercel treats every push to `main` as its production.

## 2. The environment variables

Project → Settings → Environment Variables, for **Production** and **Preview**:

```env
NEXT_PUBLIC_SITE_URL=https://www.radhefoods.de
NEXT_PUBLIC_API_URL=https://api.radhefoods.de
NEXT_PUBLIC_SUPPORT_EMAIL=hello@radhefoods.de
NEXT_PUBLIC_FEATURE_WHATSAPP=false
```

`API_INTERNAL_URL` stays unset. The values are built into the pages: after changing one, redeploy (Deployments → the newest → Redeploy). A setting that names the bare domain is read as `www` by the code (`src/config/env.ts`).

`NEXT_OUTPUT` must not be set on Vercel.

## 3. The domains

Project → Settings → Domains:

| Domain              | Setting                                               |
| ------------------- | ----------------------------------------------------- |
| `www.radhefoods.de` | Production. The address the shop answers at           |
| `radhefoods.de`     | Redirect to `www.radhefoods.de` (308)                 |

Both stay in the project while Hostinger serves the shop. Vercel then shows "Invalid Configuration" for them, because the DNS points elsewhere; that is expected. It is what lets a change of host be two DNS records and nothing more ([README.md](README.md), section 5). The records Vercel asks for are shown on this page.

The shop carries the same redirect of the bare domain in its own configuration (`next.config.ts`), for the host that has none. On Vercel the redirect of this page answers first, and the one of the shop is never reached.

## 4. What Vercel builds, and when

| Push to               | Vercel builds                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `production/vercel`   | Production. The branch is moved by `git push origin origin/main:production/vercel` ([README.md](README.md), section 4) |
| `main`, other branches | A preview, at an address of its own under `vercel.app`                                                          |

The previews of `main` are worth keeping: each is a proof, at no cost of work, that this commit builds on Vercel, days before it is released there. Their limits: sign-in does not work on them (the session cookies belong to `.radhefoods.de`), and Vercel marks them `noindex`. To switch them off all the same: Settings → Git → Ignored Build Step, with a command that lets only the production branch build:

```bash
if [ "$VERCEL_GIT_COMMIT_REF" = "production/vercel" ]; then exit 1; else exit 0; fi
```

Vercel does not wait for the build check on GitHub. The order that keeps a broken build out of production is the one of [README.md](README.md), section 4: the check of the commit is green first, the branch is moved after.

## 5. After a deployment

```bash
curl -s  https://<the project>.vercel.app/api/health    # {"status":"ok"}
curl -sI https://<the project>.vercel.app/en | grep -iE "^(HTTP|x-vercel-cache|content-security-policy)"
```

and, when Vercel serves the real address, the checks of [README.md](README.md), section 5.4. `x-vercel-cache` says whether a page came from Vercel's cache (`HIT`, `STALE`, `PRERENDER`) or was rendered (`MISS`).

Going back to an earlier deployment: Deployments → the last good one → **Instant Rollback**. Then undo the commit on `main` (`git revert`) and move the branch again, so the branch says what is live.

## 6. What in the code is Vercel's

Three small things, all without effect on another host:

| Where                         | What                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `next.config.ts`              | When `VERCEL_ENV` is `preview`, the content security policy lets Vercel's comment toolbar load |
| `src/proxy.ts`                | The proxy leaves addresses under `/_vercel` alone                                              |
| `engines` in `package.json`   | Vercel reads the Node.js version from it (Hostinger does too)                                  |

No package of Vercel is installed, and no service of Vercel is used (no image optimizer, no functions at the edge, no store, no analytics). That is what makes the shop the same on both hosts.

## 7. Differences in behaviour worth knowing

| Topic                 | Vercel                                                                                      | Hostinger                                                             |
| --------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Servers               | As many as there are visitors, started and stopped by Vercel                                | One process                                                           |
| Kept pages (ISR)      | In Vercel's cache, shared by all servers, and served from its network close to the visitor  | In the memory and the files of the one process; gone after a deployment |
| The API's allowance of 120 requests a minute per address | The shop's servers counted as one address (measured 2026-11-12)                             | One address                                                           |
| Build                 | Turbopack                                                                                   | webpack                                                               |
| Earlier versions      | Instant Rollback                                                                            | `git revert` and push                                                 |
| The sitemap           | Written at every request on both (a file renewed on a timer was not renewed on Vercel, 2026-11-17) | The same                                                              |
