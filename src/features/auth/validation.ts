// The rules of the sign-up, sign-in and password forms, as the API checks
// them (doc/CUSTOMER_AUTH.md, section 4), so that the customer sees a
// problem before the request. Nothing stricter than the API: a password the
// form refused would be one the API accepts. Each check answers the key of
// the message to show (namespace `auth`), or `null` when the value is fine.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
const NAME_MAX = 80;
const EMAIL_MAX = 254;

/**
 * What an email address looks like, the pattern of zod's `z.email()` (the
 * library the address form validates with, and the same family of rules
 * as the API's). Written out here because these four functions are all
 * the sign-in, sign-up and password pages validate: importing the library
 * for one pattern put 90 KB (gzip) of it on each of those pages.
 * `validation.test.ts` holds the two side by side.
 */
const EMAIL =
  /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;

export type EmailProblem = "emailInvalid";
export type PasswordProblem =
  "passwordRequired" | "passwordTooShort" | "passwordTooLong";
export type NameProblem = "nameRequired" | "nameTooLong";

/** The address as the API stores it: trimmed and in lower case. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function checkEmail(value: string): EmailProblem | null {
  const email = normalizeEmail(value);
  return email.length <= EMAIL_MAX && EMAIL.test(email) ? null : "emailInvalid";
}

/**
 * 8 to 128 characters, any characters, spaces included. Length matters
 * more than digits or capitals (doc 4); whether it is too easy to guess is
 * for the API to say (`PASSWORD_TOO_WEAK`).
 */
export function checkPassword(value: string): PasswordProblem | null {
  if (value.length === 0) return "passwordRequired";
  if (value.length < PASSWORD_MIN) return "passwordTooShort";
  if (value.length > PASSWORD_MAX) return "passwordTooLong";
  return null;
}

/** Signing in: the password only has to be there (the API knows its rules). */
export function checkPasswordPresent(value: string): PasswordProblem | null {
  if (value.length === 0) return "passwordRequired";
  if (value.length > PASSWORD_MAX) return "passwordTooLong";
  return null;
}

/** First or last name: 1 to 80 characters after trimming. */
export function checkName(value: string): NameProblem | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "nameRequired";
  if (trimmed.length > NAME_MAX) return "nameTooLong";
  return null;
}

/** Only the entries with a problem, keyed by field. */
export function problemsOf<K extends string, P extends string>(
  checks: Record<K, P | null>,
): Partial<Record<K, P>> {
  const found: Partial<Record<K, P>> = {};
  for (const key of Object.keys(checks) as K[]) {
    const problem = checks[key];
    if (problem) found[key] = problem;
  }
  return found;
}
