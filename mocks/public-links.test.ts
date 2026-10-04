import { describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import { startMockApi } from "./testing.ts";

// The links in emails: the payment link and the unsubscribe link. Neither
// needs a session; the token in the address is the key.

const mock = startMockApi();

async function tokensOf(email: string) {
  const response = await fetch(
    `${mock.base()}/__mock/tokens?email=${encodeURIComponent(email)}`,
  );
  return (await response.json()) as {
    unsubscribe: string;
    pay: Record<string, string>;
  };
}

describe("the payment link", () => {
  it("shows what it pays, in the language of the order, without a session", async () => {
    await mock.signIn("demo@radhefoods.de");
    const { pay } = await tokensOf("demo@radhefoods.de");
    const link = await mock.guestApi().getPayLink(pay["RF-1086"]);
    expect(link).toMatchObject({
      orderNumber: "RF-1086",
      firstName: "Priya",
      language: "en",
    });
    expect(link.payment).toMatchObject({
      status: "due",
      amountDue: 3695,
      canPayOnline: true,
    });
  });

  it("leads to the payment page, and shows the order as paid afterwards", async () => {
    await mock.signIn("demo@radhefoods.de");
    const { pay } = await tokensOf("demo@radhefoods.de");
    const api = mock.guestApi();
    const session = await api.createPayLinkCheckout(pay["RF-1086"]);
    await fetch(`${session.url}/pay?type=card`, { redirect: "manual" });
    const link = await api.getPayLink(pay["RF-1086"]);
    expect(link.payment).toMatchObject({ status: "paid", canPayOnline: false });
    const again = await api
      .createPayLinkCheckout(pay["RF-1086"])
      .catch((e) => e);
    expect(hasErrorCode(again, "PAYMENT_NOT_POSSIBLE")).toBe(true);
  });

  it("refuses an unknown token", async () => {
    const error = await mock
      .guestApi()
      .getPayLink("not-a-token")
      .catch((e) => e);
    expect(hasErrorCode(error, "PAY_LINK_INVALID")).toBe(true);
  });
});

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
