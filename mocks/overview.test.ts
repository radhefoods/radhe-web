import { describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import type { AddressInput } from "../src/lib/api/types.ts";
import { SKU } from "./data/catalogue.ts";
import { startMockApi, TEST_NAME, TEST_PASSWORD } from "./testing.ts";

// The account at a glance, closing an account, address labels, the
// referral page, and the orders the customer no longer sees
// (CUSTOMER_ACCOUNTS 3, 4, 5 and 7), through the shop's API client.

const mock = startMockApi();

const home: AddressInput = {
  label: "Home",
  firstName: "Priya",
  lastName: "Shah",
  street: "Hauptstraße",
  houseNumber: "12",
  postalCode: "60311",
  city: "Frankfurt am Main",
};

/** An order that waits for its payment, from two bags of atta. */
async function placeOrder(api: Awaited<ReturnType<typeof mock.signIn>>["api"]) {
  const { items } = await api.createAddress(home);
  const bill = await api.setCartItem(SKU.chakkiAtta5kg, 2);
  const legal = await api.listLegal();
  return api.checkout(
    {
      addressId: items[0].id,
      expectedTotal: bill.totals.total,
      consent: {
        accepted: true,
        versions: Object.fromEntries(
          legal.items.map((d) => [d.type, d.version]),
        ),
      },
    },
    "attempt-0001",
  );
}

describe("the account at a glance", () => {
  it("counts what the account holds and names the standard address with its label", async () => {
    const { api, customer } = await mock.signIn("priya@example.com");
    const empty = await api.getOverview();
    expect(empty.customer.id).toBe(customer.id);
    expect(empty.memberSince).toBe(customer.createdAt);
    expect(empty.counts).toEqual({
      orders: 0,
      openOrders: 0,
      invoices: 0,
      wishlists: 1,
      wishlistItems: 0,
      addresses: 0,
      openIssues: 0,
    });
    expect(empty.defaultAddress).toBeNull();
    expect(empty.referral.code).toMatch(/^[A-Z2-9]{8}$/);
    expect(empty.referral.link).toBe(
      `http://localhost:3001/?ref=${empty.referral.code}`,
    );
    expect(empty.referral.counts).toEqual({ registered: 0, qualified: 0 });

    const { items } = await api.createAddress(home);
    expect(items[0].label).toBe("Home");
    const relabelled = await api.updateAddress(items[0].id, { label: null });
    expect(relabelled.items[0].label).toBeNull();
    await api.updateAddress(items[0].id, { label: "Mummy" });
    const { product } = await api.getProduct("basmati-rice-1kg");
    await api.saveWishlistItem(product.id);
    const filled = await api.getOverview();
    expect(filled.counts.addresses).toBe(1);
    expect(filled.counts.wishlistItems).toBe(1);
    expect(filled.defaultAddress?.label).toBe("Mummy");

    const tooLong = await api
      .updateAddress(items[0].id, { label: "x".repeat(31) })
      .catch((e) => e);
    expect(hasErrorCode(tooLong, "VALIDATION_FAILED")).toBe(true);
  });

  it("hides an unpaid order the customer gave up, and no longer finds it", async () => {
    const { api } = await mock.signIn("priya@example.com");
    const { order } = await placeOrder(api);
    expect((await api.getOverview()).counts.orders).toBe(1);
    await api.cancelOrder(order.orderNumber, { reason: "changed_mind" });
    expect((await api.listOrders()).items).toEqual([]);
    expect((await api.getOverview()).counts.orders).toBe(0);
    const gone = await api.getOrder(order.orderNumber).catch((e) => e);
    expect(hasErrorCode(gone, "ORDER_NOT_FOUND")).toBe(true);
  });
});

describe("closing the account", () => {
  it("needs the password and the confirmation, then ends every session and frees the address", async () => {
    const { api } = await mock.signIn("priya@example.com");
    const wrong = await api
      .deleteAccount({ password: "not-the-one", confirm: true })
      .catch((e) => e);
    expect(hasErrorCode(wrong, "CUSTOMER_CREDENTIALS_INVALID")).toBe(true);
    const unconfirmed = await api
      .deleteAccount({ password: TEST_PASSWORD, confirm: false as never })
      .catch((e) => e);
    expect(hasErrorCode(unconfirmed, "VALIDATION_FAILED")).toBe(true);

    await api.deleteAccount({ password: TEST_PASSWORD, confirm: true });
    const me = await api.getMe().catch((e) => e);
    expect(hasErrorCode(me, "AUTH_TOKEN_INVALID")).toBe(true);
    const login = await mock
      .customerApi()
      .api.login({ email: "priya@example.com", password: TEST_PASSWORD })
      .catch((e) => e);
    expect(hasErrorCode(login, "CUSTOMER_CREDENTIALS_INVALID")).toBe(true);
    // The address is free for a new account at once.
    const again = await mock.signIn("priya@example.com");
    expect(again.customer.firstName).toBe(TEST_NAME.firstName);
  });

  it("refuses while an order waits, and names it", async () => {
    const { api } = await mock.signIn("priya@example.com");
    const { order } = await placeOrder(api);
    const refused = await api
      .deleteAccount({ password: TEST_PASSWORD, confirm: true })
      .catch((e) => e);
    expect(hasErrorCode(refused, "CUSTOMER_HAS_OPEN_ORDERS")).toBe(true);
    if (hasErrorCode(refused, "CUSTOMER_HAS_OPEN_ORDERS")) {
      expect(refused.details).toEqual({
        orderNumbers: [order.orderNumber],
        openReturns: 0,
        openIssues: 0,
      });
    }
    await api.cancelOrder(order.orderNumber, { reason: "changed_mind" });
    await expect(
      api.deleteAccount({ password: TEST_PASSWORD, confirm: true }),
    ).resolves.toBeUndefined();
  });
});

describe("the referral page", () => {
  it("lists who signed up with the link, masked, and a closed account as gone", async () => {
    const referrer = await mock.signIn("priya@example.com");
    const { referral } = await referrer.api.getReferral();
    expect(referral.invitees).toEqual([]);

    const invited = mock.customerApi();
    await invited.api.signUp({
      ...TEST_NAME,
      firstName: "Rahul",
      email: "rahul@example.com",
      password: TEST_PASSWORD,
      referralCode: referral.code,
    });
    await invited.api.signUpVerify({
      email: "rahul@example.com",
      code: await mock.signupCode("rahul@example.com"),
    });
    const after = (await referrer.api.getReferral()).referral;
    expect(after.counts).toEqual({ registered: 1, qualified: 0 });
    expect(after.invitees).toHaveLength(1);
    expect(after.invitees[0]).toMatchObject({
      name: "Rahul Schmidt",
      email: "ra***@example.com",
      status: "registered",
      qualifiedAt: null,
    });
    expect((await referrer.api.getOverview()).referral.counts.registered).toBe(
      1,
    );

    await invited.api.deleteAccount({ password: TEST_PASSWORD, confirm: true });
    const gone = (await referrer.api.getReferral()).referral;
    expect(gone.invitees).toEqual([]);
  });
});
