// The code of a referral link (doc 21): `https://shop.radhefoods.de/?ref=<code>`.
// The shop reads `ref` from the address of any page, keeps it for 30 days
// in local storage, shows it on the sign-up form (where it can be changed
// or typed by hand), and sends it as `referralCode` with the sign-up. A
// code that does not count never fails the sign-up: the verify answer says
// whether it counted and why not, so nothing here needs to know whether
// it is real.

export const REFERRAL_STORAGE_KEY = "rf.referral.v1";
export const REFERRAL_KEEP_MS = 30 * 24 * 3600 * 1000;
/** Fired on `window` when the kept code changes in this tab. */
const CHANGE_EVENT = "rf:referral";

/** 6 to 12 letters or digits, as the API accepts (doc 1). */
const CODE_FORMAT = /^[A-Za-z0-9]{6,12}$/;
export const REFERRAL_CODE_MAX = 12;

type CodeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): CodeStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function announce(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function isReferralCode(value: unknown): value is string {
  return typeof value === "string" && CODE_FORMAT.test(value);
}

/**
 * What was typed, as the API stores it: trimmed and in capitals. The API
 * accepts the code in any case but keeps it in capitals (doc 21).
 */
export function normalizeReferralCode(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * The typed code is fine when empty (the field is optional) or 6 to 12
 * letters or digits; else the key of the message to show (namespace `auth`).
 */
export function checkReferralCode(value: string): "referralInvalid" | null {
  const code = normalizeReferralCode(value);
  return code === "" || isReferralCode(code) ? null : "referralInvalid";
}

/** Keeps the code of a link for 30 days; a newer link replaces an older one. */
export function rememberReferralCode(
  code: string,
  storage: CodeStorage | null = browserStorage(),
  now = Date.now(),
): void {
  if (!isReferralCode(code)) return;
  try {
    storage?.setItem(
      REFERRAL_STORAGE_KEY,
      JSON.stringify({
        code: code.toUpperCase(),
        expiresAt: now + REFERRAL_KEEP_MS,
      }),
    );
    announce();
  } catch {
    // Storage blocked: the sign-up goes without the code.
  }
}

/** The kept code while it is not older than 30 days, else `null`. */
export function storedReferralCode(
  storage: CodeStorage | null = browserStorage(),
  now = Date.now(),
): string | null {
  try {
    const raw = storage?.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: unknown; expiresAt?: unknown };
    if (
      !isReferralCode(parsed.code) ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= now
    ) {
      storage?.removeItem(REFERRAL_STORAGE_KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

/** Called once the sign-up went through: the code did its work. */
export function forgetReferralCode(
  storage: CodeStorage | null = browserStorage(),
): void {
  try {
    storage?.removeItem(REFERRAL_STORAGE_KEY);
    announce();
  } catch {
    // Nothing stored.
  }
}

/**
 * Tells `onChange` when the kept code changes: in this tab (the capture
 * of a link, the sign-up that used it) or in another tab of the shop. For
 * `useSyncExternalStore`.
 */
export function subscribeReferralCode(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === REFERRAL_STORAGE_KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
