import { describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import type { AddressInput, CheckoutInput } from "../src/lib/api/types.ts";
import { SKU } from "./data/catalogue.ts";
import { startMockApi, TEST_NAME, TEST_PASSWORD } from "./testing.ts";

// The loyalty coins (doc/REWARDS.md 1, 3, 5 and 7), exercised through the
// shop's API client against the mock: the program, the welcome coins, the
// bill with coins, the order's life, and the history.

const mock = startMockApi();

const home: AddressInput = {
  firstName: "Priya",
  lastName: "Shah",
  street: "Hauptstraße",
  houseNumber: "12",
  postalCode: "60311",
  city: "Frankfurt am Main",
};

/**
 * A new customer with the 100 welcome coins, an address and two bags of
 * atta: 25.98 of goods, 4.99 delivery. 100 coins at 0.01 % take 26 cents
 * off 25.98; 99 do the same, so 99 is the most the bill allows.
 */
async function withAtta(email = "priya@example.com", bags = 2) {
  const client = await mock.signIn(email);
  const { items } = await client.api.createAddress(home);
  await client.api.setCartItem(SKU.chakkiAtta5kg, bags);
  const legal = await client.api.listLegal();
  const input = (expectedTotal: number): CheckoutInput => ({
    addressId: items[0].id,
    expectedTotal,
    consent: {
      accepted: true,
      versions: Object.fromEntries(legal.items.map((d) => [d.type, d.version])),
    },
  });
  return { ...client, input };
}

function payOnPage(url: string) {
  return fetch(`${url}/pay?type=card`, { redirect: "manual" });
}

async function reasonOf(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    if (hasErrorCode(error, "REWARDS_NOT_APPLICABLE")) {
      return { status: error.status, ...error.details };
    }
    throw error;
  }
}

describe("the program", () => {
  it("is public and names the rules, null where a rule is off", async () => {
    const { program } = await mock.guestApi().getRewardsProgram();
    expect(program).toEqual({
      enabled: true,
      earning: {
        order: { coinsPerEuro: 1 },
        welcome: 100,
        referral: { inviter: 100, invitee: null },
        review: 25,
        campaign: null,
      },
      redemption: {
        percentPerCoin: 0.01,
        minCoins: null,
        minRedeemValue: null,
        minOrderValue: null,
        maxCoinsPerOrder: null,
        maxDiscount: 500,
        combinableWithDiscountCodes: true,
      },
      expiry: null,
    });
  });

  it("can be switched off: nothing is earned or redeemed, balances stay", async () => {
    const { api } = await withAtta();
    await mock.control("rewards", { settings: { enabled: false } });
    expect((await mock.guestApi().getRewardsProgram()).program.enabled).toBe(
      false,
    );
    const mine = await api.getMyRewards();
    expect(mine).toMatchObject({
      canRedeem: false,
      reason: "disabled",
      account: { available: 100 },
    });
    expect((await api.getCart()).rewards).toMatchObject({
      applied: false,
      reason: "disabled",
      maxCoins: 0,
      earn: 0,
    });
    expect(await reasonOf(api.redeemCoins())).toEqual({
      status: 400,
      reason: "disabled",
    });
    // A sign-up gives nothing while the program is off.
    const { api: fresh } = mock.customerApi();
    await fresh.signUp({
      ...TEST_NAME,
      email: "max@example.com",
      password: TEST_PASSWORD,
    });
    const verified = await fresh.signUpVerify({
      email: "max@example.com",
      code: await mock.signupCode("max@example.com"),
    });
    expect(verified.rewards).toEqual({ welcomeCoins: 0 });
  });
});

describe("the welcome coins", () => {
  it("arrive with the verified sign-up, once per address, and show everywhere", async () => {
    const { api } = mock.customerApi();
    await api.signUp({
      ...TEST_NAME,
      email: "anna@example.com",
      password: TEST_PASSWORD,
    });
    const verified = await api.signUpVerify({
      email: "anna@example.com",
      code: await mock.signupCode("anna@example.com"),
    });
    expect(verified.rewards).toEqual({ welcomeCoins: 100 });

    const mine = await api.getMyRewards();
    expect(mine.account).toMatchObject({
      available: 100,
      balance: 100,
      reserved: 0,
      earnedTotal: 100,
      redeemedTotal: 0,
      expiresAt: null,
    });
    expect(mine.canRedeem).toBe(true);
    expect(mine.reason).toBeNull();
    expect(mine.program.enabled).toBe(true);

    const history = await api.listRewardTransactions();
    expect(history).toMatchObject({ page: 1, total: 1, totalPages: 1 });
    expect(history.items[0]).toMatchObject({
      type: "welcome",
      coins: 100,
      state: "done",
      orderNumber: null,
    });

    const overview = await api.getOverview();
    expect(overview.rewards).toEqual({ enabled: true, available: 100 });
  });

  it("are not given again when the address closes its account and signs up anew", async () => {
    const first = await mock.signIn("anna@example.com");
    await first.api.deleteAccount({ password: TEST_PASSWORD, confirm: true });
    const { api } = mock.customerApi();
    await api.signUp({
      ...TEST_NAME,
      email: "anna@example.com",
      password: TEST_PASSWORD,
    });
    const verified = await api.signUpVerify({
      email: "anna@example.com",
      code: await mock.signupCode("anna@example.com"),
    });
    expect(verified.rewards).toEqual({ welcomeCoins: 0 });
    expect((await api.getMyRewards()).account.available).toBe(0);
  });
});

describe("coins on the bill", () => {
  it("says what the cart allows and what the order will earn before anything is chosen", async () => {
    const { api } = await withAtta();
    const bill = await api.getCart();
    expect(bill.rewards).toEqual({
      requested: 0,
      coins: 0,
      amount: 0,
      applied: false,
      reason: null,
      maxCoins: 99,
      maxAmount: 26,
      earn: 26,
    });
    expect(bill.totals.rewards).toBe(0);
    expect(bill.lines[0].rewardAmount).toBe(0);
    // A visitor's preview has no coins.
    const preview = await mock
      .guestApi()
      .previewCart([{ variantId: SKU.chakkiAtta5kg, quantity: 2 }]);
    expect(preview.rewards).toBeNull();
  });

  it("prices the coins asked for into the bill with the fewest coins for the same cents", async () => {
    const { api } = await withAtta();
    // 59 coins would take 15 cents off; 56 do the same, 56 are taken.
    const bill = await api.redeemCoins(59);
    expect(bill.rewards).toMatchObject({
      requested: 59,
      coins: 56,
      amount: 15,
      applied: true,
      reason: null,
      maxCoins: 99,
      maxAmount: 26,
      earn: 26,
    });
    expect(bill.lines[0]).toMatchObject({
      rewardAmount: 15,
      lineTotal: 2598 - 15,
    });
    expect(bill.totals).toMatchObject({
      subtotal: 2598,
      discount: 0,
      rewards: 15,
      deliveryFee: 499,
      total: 2598 - 15 + 499,
    });
    // VAT is computed on what is paid; the choice stays with the cart.
    expect(bill.totals.vat[0].gross).toBe(bill.totals.total);
    expect((await api.getCart()).rewards?.coins).toBe(56);
    expect((await api.getCart()).totals.total).toBe(3082);
  });

  it("redeems as many as allowed without a number, after the discount code, and can be removed", async () => {
    const { api } = await withAtta();
    await api.applyDiscount("DIWALI10"); // 2.60 off: 23.38 of goods
    const bill = await api.redeemCoins();
    expect(bill.discount?.amount).toBe(260);
    expect(bill.rewards).toMatchObject({
      requested: null,
      applied: true,
      amount: Math.round(2338 * 0.01),
    });
    expect(bill.rewards?.coins).toBe(bill.rewards?.maxCoins);
    expect(bill.totals.total).toBe(2338 - 23 + 499);
    expect(bill.delivery.missingForFree).toBe(5000 - (2338 - 23));

    const without = await api.removeCoins();
    expect(without.rewards).toMatchObject({ requested: 0, applied: false });
    expect(without.totals).toMatchObject({ rewards: 0, total: 2338 + 499 });
    expect(without.discount?.applied).toBe(true);
  });

  it("refuses with the reason and keeps nothing", async () => {
    const { api } = await withAtta();
    expect(await reasonOf(api.redeemCoins(500))).toEqual({
      status: 400,
      reason: "insufficient",
    });
    await mock.control("rewards", {
      settings: { redemption: { combinableWithDiscountCodes: false } },
    });
    await api.applyDiscount("DIWALI10");
    expect(await reasonOf(api.redeemCoins())).toEqual({
      status: 400,
      reason: "code_applied",
    });
    expect((await api.getCart()).rewards).toMatchObject({
      applied: false,
      reason: "code_applied",
      requested: 0,
    });
    await api.removeDiscount();
    await mock.control("rewards", {
      settings: { redemption: { minOrderValue: 5000 } },
    });
    expect((await api.getCart()).rewards?.reason).toBe("below_min_order");
    await mock.control("rewards", {
      settings: { redemption: { minOrderValue: null, minCoins: 200 } },
    });
    expect((await api.getCart()).rewards?.reason).toBe("below_min_coins");
    expect((await api.getMyRewards()).reason).toBe("below_min_coins");
    await mock.control("rewards", {
      settings: { redemption: { minCoins: null, maxDiscount: 10 } },
    });
    // At most 10 cents per order: 37 coins reach 10 cents, 36 give 9.
    expect((await api.getCart()).rewards).toMatchObject({
      maxCoins: 37,
      maxAmount: 10,
    });
  });
});

describe("at the checkout", () => {
  it("holds the coins with the order, spends them when paid, and earns at delivery", async () => {
    const { api, input } = await withAtta();
    const bill = await api.redeemCoins(56);
    const result = await api.checkout(input(bill.totals.total), "key-coins-1");
    expect(result.order.rewards).toEqual({
      coins: 56,
      amount: 15,
      percentPerCoin: 0.01,
      state: "reserved",
    });
    expect(result.order.totals.rewards).toBe(15);
    expect(result.order.items[0].rewardAmount).toBe(15);
    expect(result.order.payment.amount).toBe(3082);
    let mine = await api.getMyRewards();
    expect(mine.account).toMatchObject({ available: 44, reserved: 56 });
    const held = await api.listRewardTransactions();
    expect(held.items[0]).toMatchObject({
      type: "redeem",
      coins: -56,
      state: "reserved",
      orderNumber: result.order.orderNumber,
    });

    await payOnPage(result.checkout.url);
    const { order } = await api.getOrder(result.order.orderNumber);
    expect(order.status).toBe("confirmed");
    expect(order.rewards?.state).toBe("used");
    expect(order.finalTotals.rewards).toBe(15);
    mine = await api.getMyRewards();
    expect(mine.account).toMatchObject({
      available: 44,
      reserved: 0,
      redeemedTotal: 56,
    });
    expect((await api.listRewardTransactions()).items[0].state).toBe("spent");

    // The invoice shows the line.
    const documents = await api.listInvoices({
      orderNumber: order.orderNumber,
    });
    const { invoice } = await api.getInvoice(documents.items[0].number);
    expect(invoice.lines.at(-1)).toMatchObject({
      description: "Coins redeemed (56)",
      lineTotal: -15,
    });
    expect(invoice.totals.rewards).toBe(15);
    expect(invoice.totals.total).toBe(3082);

    // The paid order let go of the choice: the next cart starts without coins.
    const next = await api.setCartItem(SKU.toorDal1kg, 1);
    expect(next.rewards).toMatchObject({ requested: 0, applied: false });

    // Delivered: 25.83 paid for the goods earn 26 coins, once.
    await mock.control("order", {
      orderNumber: order.orderNumber,
      actions: ["process", "dispatch", "deliver"],
    });
    await mock.control("order", {
      orderNumber: order.orderNumber,
      actions: ["deliver"],
    });
    mine = await api.getMyRewards();
    expect(mine.account).toMatchObject({
      available: 70,
      earnedTotal: 126,
      redeemedTotal: 56,
    });
    const history = await api.listRewardTransactions({ limit: 2 });
    expect(history.total).toBe(3);
    expect(history.totalPages).toBe(2);
    expect(history.items[0]).toMatchObject({
      type: "order",
      coins: 26,
      orderNumber: order.orderNumber,
    });
  });

  it("gives the coins back when the order is given up unpaid, and hides that row", async () => {
    const { api, input } = await withAtta();
    const bill = await api.redeemCoins();
    const result = await api.checkout(input(bill.totals.total), "key-coins-2");
    expect((await api.getMyRewards()).account).toMatchObject({
      available: 1,
      reserved: 99,
    });
    await api.cancelOrder(result.order.orderNumber, { reason: "changed_mind" });
    expect((await api.getMyRewards()).account).toMatchObject({
      available: 100,
      reserved: 0,
      redeemedTotal: 0,
    });
    const history = await api.listRewardTransactions();
    expect(history.items.map((row) => row.type)).toEqual(["welcome"]);
  });

  it("refuses the checkout with 409 when the coins stopped applying, and drops the choice", async () => {
    const { api, input } = await withAtta();
    const bill = await api.redeemCoins();
    // The balance is gone meanwhile (an adjustment by Radhe Foods).
    await mock.control("rewards", {
      adjust: { email: "priya@example.com", coins: -100, reason: "misuse" },
    });
    expect(
      await reasonOf(api.checkout(input(bill.totals.total), "key-coins-3")),
    ).toEqual({ status: 409, reason: "no_coins" });
    const after = await api.getCart();
    expect(after.rewards).toMatchObject({ requested: 0, reason: "no_coins" });
    expect(after.totals.total).toBe(2598 + 499);
    expect((await api.listRewardTransactions()).items[0]).toMatchObject({
      type: "adjustment",
      coins: -100,
      reason: "misuse",
    });
  });

  it("gives the coins of credited goods back and shrinks what the order earned", async () => {
    const { api, input } = await withAtta();
    const bill = await api.redeemCoins(56); // 15 cents on two bags
    const result = await api.checkout(input(bill.totals.total), "key-coins-4");
    await payOnPage(result.checkout.url);
    await mock.control("order", {
      orderNumber: result.order.orderNumber,
      actions: ["deliver"],
    });
    expect((await api.getMyRewards()).account.available).toBe(44 + 26);
    const { return: returned } = await api.createReturn(
      result.order.orderNumber,
      {
        items: [
          { variantId: SKU.chakkiAtta5kg, quantity: 1, reason: "damaged" },
        ],
      },
    );
    await mock.control("return", {
      returnNumber: returned.returnNumber,
      action: "approve",
    });
    await mock.control("return", {
      returnNumber: returned.returnNumber,
      action: "complete",
    });
    const { order } = await api.getOrder(result.order.orderNumber);
    // One bag credited: 8 of the 15 cents stay on the kept bag, 7 cents
    // are unused, and 7/15 of the 56 coins come back: 26.
    expect(order.finalTotals.rewards).toBe(8);
    const history = await api.listRewardTransactions();
    expect(history.items.map((row) => [row.type, row.coins])).toEqual([
      ["reversal", -13],
      ["redeem_return", 26],
      ["order", 26],
      ["redeem", -56],
      ["welcome", 100],
    ]);
    // 1299 − 8 = 12.91 paid now: 13 coins; 26 earned, 13 taken back.
    expect((await api.getMyRewards()).account).toMatchObject({
      available: 44 + 26 + 26 - 13,
    });
  });
});

describe("coins for a review", () => {
  it("arrive when the admin publishes it, once, and go back when it is rejected", async () => {
    const { api, input } = await withAtta();
    const bill = await api.getCart();
    const result = await api.checkout(input(bill.totals.total), "key-coins-5");
    await payOnPage(result.checkout.url);
    await mock.control("order", {
      orderNumber: result.order.orderNumber,
      actions: ["deliver"],
    });
    await api.writeOrderReview(result.order.orderNumber, {
      rating: 5,
      text: "Fresh atta, quick delivery, nicely packed.",
    });
    expect((await api.getMyRewards()).account.available).toBe(126);
    await mock.control("review", {
      orderNumber: result.order.orderNumber,
      action: "approve",
    });
    await mock.control("review", {
      orderNumber: result.order.orderNumber,
      action: "approve",
    });
    expect((await api.getMyRewards()).account.available).toBe(151);
    expect((await api.listRewardTransactions()).items[0]).toMatchObject({
      type: "review",
      coins: 25,
      orderNumber: result.order.orderNumber,
    });
    await mock.control("review", {
      orderNumber: result.order.orderNumber,
      action: "reject",
    });
    expect((await api.getMyRewards()).account.available).toBe(126);
    expect((await api.listRewardTransactions()).items[0]).toMatchObject({
      type: "reversal",
      coins: -25,
    });
  });
});

describe("the expiry", () => {
  it("names the date while the expiry is on", async () => {
    const { api } = await withAtta();
    await mock.control("rewards", {
      settings: { expiry: { enabled: true, inactivityMonths: 6 } },
    });
    const mine = await api.getMyRewards();
    expect(mine.program.expiry).toEqual({ inactivityMonths: 6 });
    const last = Date.parse(mine.account.lastActivityAt!);
    const expires = new Date(last);
    expires.setUTCMonth(expires.getUTCMonth() + 6);
    expect(mine.account.expiresAt).toBe(expires.toISOString());
  });
});
