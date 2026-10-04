import type { ConsentVersions, LegalSummary, LegalType } from "@/lib/api/types";

// Helpers for `POST /v1/store/orders` (doc 9).

export const CHECKOUT_KEY_STORAGE = "rf.checkout.key.v1";

/** 8 to 64 characters of `[A-Za-z0-9_-]`, as the API asks. */
const KEY_FORMAT = /^[A-Za-z0-9_-]{8,64}$/;

export function newIdempotencyKey(): string {
  // `randomUUID` needs a secure context (https or localhost).
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

type KeyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function sessionStore(): KeyStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

let memoryKey: string | null = null;

/**
 * The idempotency key of the current checkout. It is made once when the
 * customer reaches the confirm step and kept until an order answers, also
 * across reloads: when the answer of a successful attempt was lost on the
 * way, sending the same key again returns that order instead of placing a
 * second one. A refusal (total changed, legal text changed, ...) creates no
 * order, so the key simply stays for the next try.
 */
export function checkoutKey(
  storage: KeyStorage | null = sessionStore(),
): string {
  try {
    const stored = storage?.getItem(CHECKOUT_KEY_STORAGE);
    if (stored && KEY_FORMAT.test(stored)) return stored;
  } catch {
    // Fall through to the key kept in memory.
  }
  if (!storage && memoryKey) return memoryKey;
  const key = newIdempotencyKey();
  memoryKey = key;
  try {
    storage?.setItem(CHECKOUT_KEY_STORAGE, key);
  } catch {
    // Storage blocked: the key lives in memory for this page.
  }
  return key;
}

/** Call when an order was answered (created or found again). */
export function clearCheckoutKey(
  storage: KeyStorage | null = sessionStore(),
): void {
  memoryKey = null;
  try {
    storage?.removeItem(CHECKOUT_KEY_STORAGE);
  } catch {
    // Nothing stored.
  }
}

const CONSENT_TYPES: readonly LegalType[] = [
  "terms",
  "preorder_terms",
  "privacy",
];

/**
 * `consent.versions` for the order: the versions of the published legal
 * texts the customer was shown (`GET /v1/store/legal`). Only published
 * types appear in that list; `preorder_terms` is optional.
 */
export function consentVersions(documents: LegalSummary[]): ConsentVersions {
  const versions: ConsentVersions = {};
  for (const document of documents) {
    if (CONSENT_TYPES.includes(document.type)) {
      versions[document.type] = document.version;
    }
  }
  return versions;
}

/** `terms` and `privacy` must be published before an order can be placed. */
export function missingLegalTypes(documents: LegalSummary[]): LegalType[] {
  const published = new Set(documents.map((document) => document.type));
  return (["terms", "privacy"] as const).filter((t) => !published.has(t));
}
