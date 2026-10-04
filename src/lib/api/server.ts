import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { connection } from "next/server";
import { env } from "@/config/env";
import { createRequester } from "./http";
import { createStoreApi } from "./store-api";

// The API as the Next.js server uses it: public data only (catalogue, cargo,
// settings, legal texts), without cookies, cached by Next.js. Anything that
// belongs to a customer is fetched in the browser, because the refresh cookie
// never reaches this server (doc 0.5).

export const serverApi = createStoreApi(
  createRequester({ baseUrl: env.apiInternalUrl }),
);

/** How long the server may reuse an answer of the API, in seconds. */
export const REVALIDATE = {
  /** Products, categories: change when the admin edits them. */
  catalogue: 300,
  /** Open or closed, deadline, delivery days: also refreshed in the browser. */
  cargo: 60,
  /** Delivery fee steps, return window. */
  settings: 300,
  /** Legal texts change rarely, but a new version must show soon. */
  legal: 300,
} as const;

/** Tags for on-demand revalidation, should the API notify the shop one day. */
export const TAGS = {
  catalogue: "catalogue",
  cargo: "cargo",
  settings: "settings",
  legal: "legal",
} as const;

/**
 * The build must not depend on the API. A page that is built ahead of time
 * and cannot load its content calls this before it gives up: during the
 * build, the page is then left out and rendered at its first visit instead
 * of stopping the whole build. On a running shop this does nothing, and the
 * error goes on to the error page.
 */
export async function leaveToFirstVisitWhileBuilding(): Promise<void> {
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) await connection();
}
