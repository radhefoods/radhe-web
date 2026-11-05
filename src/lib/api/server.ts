import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { connection } from "next/server";
import { env } from "@/config/env";
import { createRequester } from "./http";
import { createStoreApi } from "./store-api";

// The API as the Next.js server uses it: public data only (catalogue,
// settings, legal texts), without cookies, cached by Next.js. Anything that
// belongs to a customer is fetched in the browser, because the refresh cookie
// never reaches this server (doc 0.5).

/**
 * How long a page waits for the API. An API that accepts the connection
 * and then hangs would otherwise hold every page, the frame of the shop
 * included, until the host gives up; after this the call fails like an
 * API that is away, and the pages degrade the way they are built to.
 */
const API_TIMEOUT_MS = 10_000;

export const serverApi = createStoreApi(
  createRequester({ baseUrl: env.apiInternalUrl, timeoutMs: API_TIMEOUT_MS }),
);

/** How long the server may reuse an answer of the API, in seconds. */
export const REVALIDATE = {
  /** Products, categories: change when the admin edits them. */
  catalogue: 300,
  /** Delivery fee steps, delivery estimate, return window. */
  settings: 300,
  /** Legal texts change rarely, but a new version must show soon. */
  legal: 300,
  /** The FAQ and the blog: the API allows five minutes (doc 18, 19). */
  content: 300,
  /** What customers say: a new review shows within minutes of its approval. */
  reviews: 300,
} as const;

/** Tags for on-demand revalidation, should the API notify the shop one day. */
export const TAGS = {
  catalogue: "catalogue",
  settings: "settings",
  legal: "legal",
  content: "content",
  reviews: "reviews",
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
