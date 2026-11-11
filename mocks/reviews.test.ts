import { describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import { consentVersions } from "../src/lib/checkout/order-attempt.ts";
import { SKU } from "./data/catalogue.ts";
import { startMockApi } from "./testing.ts";

// Order reviews (doc ORDER_REVIEWS), through the shop's API client: one
// review per delivered order, waiting for the admin, then public.

const mock = startMockApi();

/** A customer with a paid order, delivered unless said otherwise. */
async function ordered(email = "priya@example.com", deliver = true) {
  const client = await mock.signIn(email);
  const { items } = await client.api.createAddress({
    firstName: "Priya",
    lastName: "Shah",
    street: "Hauptstraße",
    houseNumber: "12",
    postalCode: "60311",
    city: "Frankfurt am Main",
  });
  await client.api.setCartItem(SKU.basmati1kg, 1);
  const bill = await client.api.setCartItem(SKU.toorDal1kg, 2);
  const legal = await client.api.listLegal();
  const { order, checkout } = await client.api.checkout(
    {
      addressId: items[0].id,
      expectedTotal: bill.totals.total,
      consent: {
        accepted: true,
        versions: consentVersions(legal.items),
      },
    },
    `attempt-${email.replace(/\W/g, "")}`,
  );
  await fetch(`${checkout.url}/pay?type=card`, { redirect: "manual" });
  if (deliver) {
    await mock.control("order", {
      orderNumber: order.orderNumber,
      actions: ["deliver"],
    });
  }
  return { ...client, orderNumber: order.orderNumber };
}

describe("order reviews", () => {
  it("is written once for a delivered order, waits for approval, then shows among what customers say", async () => {
    const { api, orderNumber } = await ordered();
    expect(await api.getOrderReview(orderNumber)).toEqual({
      review: null,
      canReview: true,
    });
    expect(
      (await api.listReviewable()).items.map((order) => order.orderNumber),
    ).toEqual([orderNumber]);
    expect((await mock.guestApi().listReviews()).summary).toEqual({
      average: null,
      count: 0,
      distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
    });

    const tooShort = await api
      .writeOrderReview(orderNumber, { rating: 5, text: "Nice" })
      .catch((e) => e);
    expect(hasErrorCode(tooShort, "VALIDATION_FAILED")).toBe(true);
    const noStars = await api
      .writeOrderReview(orderNumber, {
        rating: 0,
        text: "Arrived well packed.",
      })
      .catch((e) => e);
    expect(hasErrorCode(noStars, "VALIDATION_FAILED")).toBe(true);

    const { review } = await api.writeOrderReview(orderNumber, {
      rating: 5,
      text: "Everything arrived fresh and well packed.",
    });
    expect(review).toMatchObject({
      orderNumber,
      status: "pending",
      rating: 5,
      authorName: "Anna S.",
      verifiedPurchase: true,
      rejectionNote: null,
      publishedAt: null,
    });
    expect((await api.getOrderReview(orderNumber)).canReview).toBe(false);
    expect((await api.listReviewable()).items).toEqual([]);
    // Not public until approved.
    expect((await mock.guestApi().listReviews()).items).toEqual([]);
    const again = await api
      .writeOrderReview(orderNumber, { rating: 4, text: "A second attempt." })
      .catch((e) => e);
    expect(hasErrorCode(again, "REVIEW_ALREADY_WRITTEN")).toBe(true);

    await mock.control("review", { orderNumber, action: "approve" });
    await mock.control("review", {
      orderNumber,
      action: "reply",
      text: "Thank you!",
    });
    const shown = await mock.guestApi().listReviews();
    expect(shown.summary).toMatchObject({ average: 5, count: 1 });
    expect(shown.items[0]).toMatchObject({
      authorName: "Anna S.",
      verifiedPurchase: true,
      reply: { text: "Thank you!" },
    });
    expect((await api.listMyReviews()).items[0]).toMatchObject({
      status: "published",
      reply: { text: "Thank you!" },
    });

    await mock.control("review", {
      orderNumber,
      action: "reject",
      note: "Please keep to the order.",
    });
    expect((await api.listMyReviews()).items[0]).toMatchObject({
      status: "rejected",
      rejectionNote: "Please keep to the order.",
    });
    expect((await mock.guestApi().listReviews()).summary.count).toBe(0);

    // Deleted by the admin: the order can be reviewed again.
    await mock.control("review", { orderNumber, action: "delete" });
    expect((await api.getOrderReview(orderNumber)).canReview).toBe(true);
    expect((await api.listMyReviews()).items).toEqual([]);
  });

  it("refuses an order that is not delivered, and another customer's order", async () => {
    const { api, orderNumber } = await ordered("max@example.com", false);
    expect(await api.getOrderReview(orderNumber)).toEqual({
      review: null,
      canReview: false,
    });
    expect((await api.listReviewable()).items).toEqual([]);
    const early = await api
      .writeOrderReview(orderNumber, {
        rating: 5,
        text: "Looking forward to it.",
      })
      .catch((e) => e);
    expect(hasErrorCode(early, "REVIEW_NOT_POSSIBLE")).toBe(true);
    const other = await mock.signIn("nina@example.com");
    const notMine = await other.api.getOrderReview(orderNumber).catch((e) => e);
    expect(hasErrorCode(notMine, "ORDER_NOT_FOUND")).toBe(true);
  });

  it("filters by stars and pages the list", async () => {
    const first = await ordered();
    await first.api.writeOrderReview(first.orderNumber, {
      rating: 3,
      text: "Average, honestly.",
    });
    await mock.control("review", {
      orderNumber: first.orderNumber,
      action: "approve",
    });
    const second = await ordered("max@example.com");
    await second.api.writeOrderReview(second.orderNumber, {
      rating: 5,
      text: "Best delivery so far!",
    });
    await mock.control("review", {
      orderNumber: second.orderNumber,
      action: "approve",
    });
    const all = await mock.guestApi().listReviews({ limit: 1 });
    expect(all.total).toBe(2);
    expect(all.totalPages).toBe(2);
    expect(all.items[0].text).toBe("Best delivery so far!");
    expect(all.summary).toMatchObject({ average: 4, count: 2 });
    expect(all.summary.distribution).toMatchObject({ "3": 1, "5": 1 });
    const fives = await mock.guestApi().listReviews({ rating: 5 });
    expect(fives.items.map((r) => r.rating)).toEqual([5]);
    expect(fives.summary.count).toBe(2);
    const page2 = await mock.guestApi().listReviews({ limit: 1, page: 2 });
    expect(page2.items[0].text).toBe("Average, honestly.");
  });
});
