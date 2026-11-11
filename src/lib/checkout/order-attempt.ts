import type { ConsentVersions, LegalSummary, LegalType } from "@/lib/api/types";

// Helpers for `POST /v1/store/checkout` (doc 9).

export const CHECKOUT_KEY_STORAGE = "rf.checkout.key.v1";
/** What the stored key was made for: the fingerprint of that order. */
export const CHECKOUT_ORDER_STORAGE = "rf.checkout.for.v1";

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
let memoryOrder: string | null = null;

/**
 * A short fingerprint of what a checkout asks for (the request and the
 * lines of the bill it was made from): the same order gives the same
 * text, another order another one. Not a secret and not kept anywhere but
 * beside the key; a hash, so that no address or email is stored.
 */
export function orderFingerprint(order: unknown): string {
  const text = JSON.stringify(order) ?? "";
  // FNV-1a, 32 bit.
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}-${text.length.toString(36)}`;
}

/**
 * The idempotency key of the current checkout. It is made when the
 * customer orders and kept until an order answers, also across reloads:
 * when the answer of a successful attempt was lost on the way, sending the
 * same key again returns that order and its payment page instead of
 * creating a second order. A refusal (total changed, legal text changed,
 * ...) creates no order.
 *
 * The key belongs to one order. The API answers a key it has seen with the
 * first order, whatever is sent with it: when the customer changed the
 * address, the cart or the code after a lost answer, the same key would
 * lead to the payment page of the order from before the change. So a
 * different order gets a key of its own.
 *
 * @param order what is ordered: the request, and the lines it is made from
 */
export function checkoutKey(
  order: unknown,
  storage: KeyStorage | null = sessionStore(),
): string {
  const fingerprint = orderFingerprint(order);
  try {
    const stored = storage?.getItem(CHECKOUT_KEY_STORAGE);
    if (
      stored &&
      KEY_FORMAT.test(stored) &&
      storage?.getItem(CHECKOUT_ORDER_STORAGE) === fingerprint
    ) {
      return stored;
    }
  } catch {
    // Fall through to the key kept in memory.
  }
  if (!storage && memoryKey && memoryOrder === fingerprint) return memoryKey;
  const key = newIdempotencyKey();
  memoryKey = key;
  memoryOrder = fingerprint;
  try {
    storage?.setItem(CHECKOUT_KEY_STORAGE, key);
    storage?.setItem(CHECKOUT_ORDER_STORAGE, fingerprint);
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
  memoryOrder = null;
  try {
    storage?.removeItem(CHECKOUT_KEY_STORAGE);
    storage?.removeItem(CHECKOUT_ORDER_STORAGE);
  } catch {
    // Nothing stored.
  }
}

/**
 * The texts accepted at checkout, for an API that does not say so itself
 * (older than 2026-11-11, without `requiresConsent`).
 */
const CONSENT_TYPES: readonly LegalType[] = ["terms", "privacy"];

/**
 * Whether the customer accepts this text with the order. The API says
 * which ones (`requiresConsent`): of the six legal pages only the terms
 * and the privacy policy. The others inform; they are never part of the
 * consent, and the API refuses their keys in `consent.versions`.
 */
export function requiresConsent(document: LegalSummary): boolean {
  return document.requiresConsent ?? CONSENT_TYPES.includes(document.type);
}

/**
 * `consent.versions` for the checkout: the versions of the published legal
 * texts the customer accepts (`GET /v1/store/legal`, those with
 * `requiresConsent`). They must be the versions that apply now; the API
 * refuses others with `LEGAL_VERSION_CHANGED`.
 */
export function consentVersions(documents: LegalSummary[]): ConsentVersions {
  const versions: ConsentVersions = {};
  for (const document of documents) {
    if (requiresConsent(document)) versions[document.type] = document.version;
  }
  return versions;
}

/** `terms` and `privacy` must be published before an order can be placed. */
export function missingLegalTypes(documents: LegalSummary[]): LegalType[] {
  const published = new Set(documents.map((document) => document.type));
  return CONSENT_TYPES.filter((type) => !published.has(type));
}
