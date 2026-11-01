import type { APIRequestContext } from "@playwright/test";

// What the specs share: the mock API, the password of every test account,
// and the way an account is made through the API since the sign-up asks
// for an emailed code (doc 1, 2026-11-01).

export const MOCK = "http://localhost:3000";
export const PASSWORD = "Mangoes-in-May-2026";

/**
 * Creates an account through the API, with the code the mock "emailed",
 * or signs in when it exists. Through `page.request` the browser gets the
 * session cookies; through the `request` fixture it stays signed out.
 */
export async function createAccount(
  request: APIRequestContext,
  {
    email,
    firstName = "Priya",
    lastName = "Shah",
    password = PASSWORD,
  }: {
    email: string;
    firstName?: string;
    lastName?: string;
    password?: string;
  },
): Promise<"created" | "existing"> {
  const started = await request.post(`${MOCK}/v1/store/auth/signup`, {
    data: { firstName, lastName, email, password },
  });
  if (started.status() === 409) {
    await request.post(`${MOCK}/v1/store/auth/login`, {
      data: { email, password },
    });
    return "existing";
  }
  // A mock older than the code step signed the account in at once.
  if (started.status() === 201) return "created";
  const code = await signupCode(request, email);
  await request.post(`${MOCK}/v1/store/auth/signup/verify`, {
    data: { email, code },
  });
  return "created";
}

/** The code of a sign-up that waits for it (`GET /__mock/tokens`). */
export async function signupCode(
  request: APIRequestContext,
  email: string,
): Promise<string> {
  const response = await request.get(
    `${MOCK}/__mock/tokens?email=${encodeURIComponent(email)}`,
  );
  const tokens = (await response.json()) as { signupCode: string | null };
  if (!tokens.signupCode) throw new Error(`No sign-up waits for ${email}.`);
  return tokens.signupCode;
}
