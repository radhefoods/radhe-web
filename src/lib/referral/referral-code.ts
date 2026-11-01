// The code of a referral link (doc 21): `https://shop.radhefoods.de/?ref=<code>`.
// The shop reads `ref` from the address of any page, keeps it for 30 days
// in local storage, and sends it as `referralCode` with the sign-up; a
// code that does not count never fails the sign-up, so nothing here needs
// to know whether it is real.

export const REFERRAL_STORAGE_KEY = "rf.referral.v1";
export const REFERRAL_KEEP_MS = 30 * 24 * 3600 * 1000;

/** 6 to 12 letters or digits, as the API accepts (doc 1). */
const CODE_FORMAT = /^[A-Za-z0-9]{6,12}$/;

type CodeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): CodeStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function isReferralCode(value: unknown): value is string {
  return typeof value === "string" && CODE_FORMAT.test(value);
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
  } catch {
    // Nothing stored.
  }
}
