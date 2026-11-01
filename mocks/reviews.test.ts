import { describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import { SKU } from "./data/catalogue.ts";
import { startMockApi, TEST_PASSWORD } from "./testing.ts";

// Product reviews and order feedback (doc 22, CUSTOMER_ACCOUNTS 8), through
// the shop's API client.

const mock = startMockApi();

/** A customer with a delivered order of two products. */
async function delivered(email = "priya@example.com") {
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
        versions: Object.fromEntries(
          legal.items.map((d) => [d.type, d.version]),
        ),
      },
    },
    `attempt-${email.replace(/\W/g, "")}`,
  );
  await fetch(`${checkout.url}/pay?type=card`, { redirect: "manual" });
  await mock.control("order", {
    orderNumber: order.orderNumber,
    actions: ["deliver"],
  });
  const rice = (await client.api.getProduct("basmati-rice-1kg")).product;
  return { ...client, orderNumber: order.orderNumber, rice };
}

describe("product reviews", () => {
  it("is allowed for a delivered product, waits for approval, then shows on the product", async () => {
    const { api, orderNumber, rice } = await delivered();
    const nothing = await api.listProductReviews(rice.id);
    expect(nothing.summary).toEqual({
      average: 0,
      count: 0,
      distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
    });
    const reviewable = await api.listReviewable();
    expect(reviewable.items.map((item) => item.orderNumber)).toEqual([
      orderNumber,
      orderNumber,
    ]);
    expect(reviewable.items[0].review).toBeNull();

    const notBought = (await api.listProducts({ q: "khakhra" })).items[0];
    const refused = await api
      .saveReview(notBought.id, { rating: 5, text: "Never had it, sorry." })
      .catch((e) => e);
    expect(hasErrorCode(refused, "REVIEW_NOT_ALLOWED")).toBe(true);
    const tooShort = await api
      .saveReview(rice.id, { rating: 5, text: "Nice" })
      .catch((e) => e);
    expect(hasErrorCode(tooShort, "VALIDATION_FAILED")).toBe(true);

    const { review } = await api.saveReview(rice.id, {
      rating: 5,
      title: "Lovely",
      text: "Cooks evenly and smells wonderful.",
      orderNumber,
    });
    expect(review).toMatchObject({
      productId: rice.id,
      status: "pending",
      rating: 5,
      title: "Lovely",
    });
    expect(review.product.slug).toBe("basmati-rice-1kg");
    // Not shown until approved; the product has no rating yet.
    expect((await api.listProductReviews(rice.id)).items).toEqual([]);
    expect(
      (await api.getProduct("basmati-rice-1kg")).product.rating,
    ).toBeNull();
    expect((await api.listReviewable()).items[0].review?.id).toBe(review.id);

    await mock.control("review", {
      email: "priya@example.com",
      productId: rice.id,
      action: "approve",
    });
    await mock.control("review", {
      email: "priya@example.com",
      productId: rice.id,
      action: "reply",
      text: "Thank you!",
    });
    const shown = await api.listProductReviews(rice.id);
    expect(shown.summary).toMatchObject({ average: 5, count: 1 });
    expect(shown.items[0]).toMatchObject({
      authorName: "Anna S.",
      verifiedPurchase: true,
      reply: { text: "Thank you!" },
    });
    expect((await api.getProduct("basmati-rice-1kg")).product.rating).toEqual({
      average: 5,
      count: 1,
    });
    const mine = await api.listMyReviews();
    expect(mine.items[0].status).toBe("published");

    // Rewritten: it waits again, marked as edited once published.
    const rewritten = await api.saveReview(rice.id, {
      rating: 4,
      text: "Still good, a little less aroma this time.",
    });
    expect(rewritten.review.status).toBe("pending");
    expect((await api.listProductReviews(rice.id)).items).toEqual([]);

    await mock.control("review", {
      email: "priya@example.com",
      productId: rice.id,
      action: "reject",
      note: "Please keep to the product.",
    });
    expect((await api.listMyReviews()).items[0]).toMatchObject({
      status: "rejected",
      rejectionNote: "Please keep to the product.",
    });
    await api.deleteReview(rice.id);
    expect((await api.listMyReviews()).items).toEqual([]);
    const gone = await api.deleteReview(rice.id).catch((e) => e);
    expect(hasErrorCode(gone, "REVIEW_NOT_FOUND")).toBe(true);
  });

  it("filters by stars and pages the list", async () => {
    const { api, rice } = await delivered();
    await api.saveReview(rice.id, { rating: 3, text: "Average, honestly." });
    await mock.control("review", {
      email: "priya@example.com",
      productId: rice.id,
      action: "approve",
    });
    const other = await delivered("max@example.com");
    await other.api.saveReview(rice.id, { rating: 5, text: "Best rice ever!" });
    await mock.control("review", {
      email: "max@example.com",
      productId: rice.id,
      action: "approve",
    });
    const all = await mock.guestApi().listProductReviews(rice.id, { limit: 1 });
    expect(all.total).toBe(2);
    expect(all.totalPages).toBe(2);
    expect(all.summary).toMatchObject({ average: 4, count: 2 });
    expect(all.summary.distribution).toMatchObject({ "3": 1, "5": 1 });
    const fives = await mock
      .guestApi()
      .listProductReviews(rice.id, { rating: 5 });
    expect(fives.items.map((r) => r.rating)).toEqual([5]);
    expect(fives.summary.count).toBe(2);
  });
});

describe("order feedback", () => {
  it("is given once per delivered order and carried by the order", async () => {
    const { api, orderNumber } = await delivered();
    const before = (await api.getOrder(orderNumber)).order;
    expect(before.canGiveFeedback).toBe(true);
    expect(before.feedback).toBeNull();
    const { feedback } = await api.giveOrderFeedback(orderNumber, {
      rating: 5,
      deliveryRating: 4,
      comment: "Quick and friendly.",
    });
    expect(feedback).toMatchObject({
      rating: 5,
      deliveryRating: 4,
      comment: "Quick and friendly.",
    });
    const after = (await api.getOrder(orderNumber)).order;
    expect(after.canGiveFeedback).toBe(false);
    expect(after.feedback?.rating).toBe(5);
    const again = await api
      .giveOrderFeedback(orderNumber, { rating: 1 })
      .catch((e) => e);
    expect(hasErrorCode(again, "FEEDBACK_ALREADY_GIVEN")).toBe(true);
    const bad = await api
      .giveOrderFeedback(orderNumber, { rating: 6 })
      .catch((e) => e);
    expect(hasErrorCode(bad, "VALIDATION_FAILED")).toBe(true);
    expect(TEST_PASSWORD).toBeTruthy();
  });
});
