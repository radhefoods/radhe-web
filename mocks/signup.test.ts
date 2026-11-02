import { describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import { SKU } from "./data/catalogue.ts";
import { startMockApi, TEST_NAME, TEST_PASSWORD } from "./testing.ts";

// The sign-up with an emailed code (doc 1, CUSTOMER_ACCOUNTS 1), the
// referral code that may come with it (doc 21), and the guest record that
// becomes the account (doc 20), exercised through the shop's API client.

const mock = startMockApi();

const anna = {
  ...TEST_NAME,
  email: "anna@example.com",
  password: TEST_PASSWORD,
};

describe("the sign-up with a code", () => {
  it("keeps the details aside, emails a code and makes the account with it", async () => {
    const { api, jar } = mock.customerApi();
    const started = await api.signUp(anna);
    expect(started).toEqual({
      email: "anna@example.com",
      validMinutes: 15,
      resendAfterSeconds: 60,
    });
    // No account yet: the address cannot sign in.
    const early = await api
      .login({ email: anna.email, password: TEST_PASSWORD })
      .catch((e) => e);
    expect(hasErrorCode(early, "CUSTOMER_CREDENTIALS_INVALID")).toBe(true);

    const code = await mock.signupCode(anna.email);
    expect(code).toMatch(/^\d{6}$/);
    const verified = await api.signUpVerify({ email: anna.email, code });
    expect(verified.customer).toMatchObject({
      email: "anna@example.com",
      firstName: "Anna",
      kind: "registered",
    });
    expect(verified.customer.emailVerifiedAt).not.toBeNull();
    expect(verified.referral).toEqual({ applied: false, reason: null });
    expect(jar.map((c) => c.name).sort()).toEqual([
      "rf_customer_access",
      "rf_customer_refresh",
    ]);
    expect((await api.getMe()).customer.id).toBe(verified.customer.id);

    // The code works once: the sign-up is finished.
    const again = await api
      .signUpVerify({ email: anna.email, code })
      .catch((e) => e);
    expect(hasErrorCode(again, "SIGNUP_NOT_FOUND")).toBe(true);
  });

  it("counts the wrong attempts down and ends the sign-up at five", async () => {
    const { api } = mock.customerApi();
    await api.signUp(anna);
    const code = await mock.signupCode(anna.email);
    const wrong = code === "000000" ? "111111" : "000000";
    for (const left of [4, 3, 2, 1]) {
      const error = await api
        .signUpVerify({ email: anna.email, code: wrong })
        .catch((e) => e);
      expect(hasErrorCode(error, "SIGNUP_CODE_INVALID")).toBe(true);
      if (hasErrorCode(error, "SIGNUP_CODE_INVALID")) {
        expect(error.details.attemptsLeft).toBe(left);
      }
    }
    const last = await api
      .signUpVerify({ email: anna.email, code: wrong })
      .catch((e) => e);
    expect(hasErrorCode(last, "SIGNUP_CODE_INVALID")).toBe(true);
    // Used up: the right code no longer helps, the sign-up starts again.
    const over = await api
      .signUpVerify({ email: anna.email, code })
      .catch((e) => e);
    expect(hasErrorCode(over, "SIGNUP_NOT_FOUND")).toBe(true);
    const malformed = await api
      .signUpVerify({ email: anna.email, code: "12345" })
      .catch((e) => e);
    expect(hasErrorCode(malformed, "VALIDATION_FAILED")).toBe(true);
  });

  it("answers the resend the same whatever happened, and a new sign-up replaces the old", async () => {
    const { api } = mock.customerApi();
    await expect(
      api.signUpResend({ email: "nobody@example.com" }),
    ).resolves.toBeUndefined();
    await api.signUp(anna);
    const first = await mock.signupCode(anna.email);
    // Within the minute nothing new goes out.
    await api.signUpResend({ email: anna.email });
    expect(await mock.signupCode(anna.email)).toBe(first);
    // Started again: the old code stops working.
    await api.signUp({ ...anna, firstName: "Annika" });
    const second = await mock.signupCode(anna.email);
    const stale = await api
      .signUpVerify({ email: anna.email, code: first })
      .catch((e) => e);
    if (first !== second) {
      expect(hasErrorCode(stale, "SIGNUP_CODE_INVALID")).toBe(true);
    }
    const verified = await api.signUpVerify({
      email: anna.email,
      code: second,
    });
    expect(verified.customer.firstName).toBe("Annika");
  });

  it("refuses an address that has an account, but not one with guest orders only", async () => {
    await mock.signIn("anna@example.com");
    const { api } = mock.customerApi();
    const taken = await api.signUp(anna).catch((e) => e);
    expect(hasErrorCode(taken, "CUSTOMER_EMAIL_TAKEN")).toBe(true);

    // A guest ordered before: the sign-up turns the record into the account,
    // and the order is in it.
    const guest = mock.guestApi();
    const items = [{ variantId: SKU.chakkiAtta5kg, quantity: 1 }];
    const bill = await guest.previewCart(items);
    const legal = await guest.listLegal();
    await guest.guestCheckout(
      {
        email: "gita@example.com",
        items,
        address: {
          firstName: "Gita",
          lastName: "Guest",
          street: "Hauptstraße",
          houseNumber: "12",
          postalCode: "60311",
          city: "Frankfurt am Main",
        },
        expectedTotal: bill.totals.total,
        consent: {
          accepted: true,
          versions: Object.fromEntries(
            legal.items.map((d) => [d.type, d.version]),
          ),
        },
      },
      "guest-signup-0001",
    );
    const client = mock.customerApi();
    await client.api.signUp({
      ...anna,
      firstName: "Gita",
      lastName: "Shah",
      email: "gita@example.com",
    });
    const verified = await client.api.signUpVerify({
      email: "gita@example.com",
      code: await mock.signupCode("gita@example.com"),
    });
    expect(verified.customer).toMatchObject({
      kind: "registered",
      firstName: "Gita",
      lastName: "Shah",
    });
    const orders = await client.api.listOrders();
    expect(orders.items.map((o) => o.orderNumber)).toEqual(["RF-1085"]);
    expect(orders.items[0].isGuest).toBe(true);
    const addresses = await client.api.listAddresses();
    expect(addresses.items).toHaveLength(1);
    expect(addresses.items[0]).toMatchObject({ city: "Frankfurt am Main" });
  });

  it("counts a referral code that belongs to another account, and says why one does not", async () => {
    const referrer = await mock.signIn("priya@example.com");
    const tokens = (await (
      await fetch(`${mock.base()}/__mock/tokens?email=priya@example.com`)
    ).json()) as { referralCode: string };
    expect(tokens.referralCode).toMatch(/^[A-Z2-9]{8}$/);

    const invited = mock.customerApi();
    await invited.api.signUp({
      ...anna,
      referralCode: tokens.referralCode.toLowerCase(),
    });
    const verified = await invited.api.signUpVerify({
      email: anna.email,
      code: await mock.signupCode(anna.email),
    });
    expect(verified.referral).toEqual({ applied: true, reason: null });

    const stranger = mock.customerApi();
    await stranger.api.signUp({
      ...anna,
      email: "max@example.com",
      referralCode: "NOSUCH01",
    });
    const unknown = await stranger.api.signUpVerify({
      email: "max@example.com",
      code: await mock.signupCode("max@example.com"),
    });
    expect(unknown.referral).toEqual({
      applied: false,
      reason: "unknown_code",
    });

    const malformed = await mock
      .customerApi()
      .api.signUp({ ...anna, email: "lea@example.com", referralCode: "x" })
      .catch((e) => e);
    expect(hasErrorCode(malformed, "VALIDATION_FAILED")).toBe(true);
    expect(referrer.customer.email).toBe("priya@example.com");
  });

  it("tells the form before the account exists whether a code is known, and who invites", async () => {
    await mock.signIn("priya@example.com");
    const tokens = (await (
      await fetch(`${mock.base()}/__mock/tokens?email=priya@example.com`)
    ).json()) as { referralCode: string };
    const guest = mock.guestApi();
    expect(
      await guest.checkReferralCode(tokens.referralCode.toLowerCase()),
    ).toEqual({ valid: true, inviter: { firstName: "Anna" } });
    for (const code of ["NOSUCH01", "x", "with-dash"]) {
      const unknown = await guest.checkReferralCode(code).catch((e) => e);
      expect(hasErrorCode(unknown, "REFERRAL_CODE_UNKNOWN")).toBe(true);
    }
  });
});
