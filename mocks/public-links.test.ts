import { describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import { startMockApi } from "./testing.ts";

// The unsubscribe link of the marketing emails: no session, the token in the
// address is the key.

const mock = startMockApi();

async function tokensOf(email: string) {
  const response = await fetch(
    `${mock.base()}/__mock/tokens?email=${encodeURIComponent(email)}`,
  );
  return (await response.json()) as { unsubscribe: string };
}

describe("the unsubscribe link", () => {
  it("switches news off for the customer of the token, and only news", async () => {
    const { api } = await mock.signIn("anna@example.com");
    await api.updateCommunication({ marketingOptIn: true });
    const { unsubscribe } = await tokensOf("anna@example.com");
    // The token contains a dot, like the one of the real API.
    expect(unsubscribe).toContain(".");

    const result = await mock.guestApi().unsubscribe(unsubscribe);
    expect(result).toEqual({
      email: "anna@example.com",
      marketingOptIn: false,
    });
    const { customer } = await api.getMe();
    expect(customer.communication.marketingOptIn).toBe(false);
    expect(customer.communication.marketingOptOutAt).not.toBeNull();
    // Doing it twice changes nothing.
    await expect(mock.guestApi().unsubscribe(unsubscribe)).resolves.toEqual(
      result,
    );
  });

  it("refuses a token that was tampered with", async () => {
    await mock.signIn("anna@example.com");
    const { unsubscribe } = await tokensOf("anna@example.com");
    const error = await mock
      .guestApi()
      .unsubscribe(`${unsubscribe}x`)
      .catch((e) => e);
    expect(hasErrorCode(error, "CUSTOMER_NOT_FOUND")).toBe(true);
  });
});
