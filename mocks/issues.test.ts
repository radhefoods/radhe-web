import { describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import { SKU } from "./data/catalogue.ts";
import { startMockApi } from "./testing.ts";

// Problem reports after a delivery (doc 23, CUSTOMER_ACCOUNTS 9), through
// the shop's API client.

const mock = startMockApi();

/** A customer with a delivered order: two bags of atta and one toor dal. */
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
  await client.api.setCartItem(SKU.chakkiAtta5kg, 2);
  const bill = await client.api.setCartItem(SKU.toorDal1kg, 1);
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
  return { ...client, orderNumber: order.orderNumber };
}

const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "a.png", {
  type: "image/png",
});

describe("problem reports", () => {
  it("names the window and what can be reported, makes the report, takes photos, and can be taken back", async () => {
    const { api, orderNumber } = await delivered();
    const before = await api.getOrderIssues(orderNumber);
    expect(before.items).toEqual([]);
    expect(before.window.possible).toBe(true);
    expect(before.window.until).not.toBeNull();
    expect(before.reportable.map((row) => row.available)).toEqual([2, 1]);

    const tooMany = await api
      .createIssue(orderNumber, {
        items: [{ variantId: SKU.chakkiAtta5kg, quantity: 3 }],
        problems: ["damaged"],
        description: "The bags were torn open.",
        preferredResolution: "refund",
      })
      .catch((e) => e);
    expect(hasErrorCode(tooMany, "ISSUE_QUANTITY_INVALID")).toBe(true);
    const unknown = await api
      .createIssue(orderNumber, {
        items: [{ variantId: "000000000000000000000001", quantity: 1 }],
        problems: ["damaged"],
        description: "The bags were torn open.",
        preferredResolution: "refund",
      })
      .catch((e) => e);
    expect(hasErrorCode(unknown, "ORDER_ITEM_NOT_FOUND")).toBe(true);
    const short = await api
      .createIssue(orderNumber, {
        problems: ["late"],
        description: "Late.",
        preferredResolution: "none",
      })
      .catch((e) => e);
    expect(hasErrorCode(short, "VALIDATION_FAILED")).toBe(true);

    const { issue } = await api.createIssue(orderNumber, {
      items: [{ variantId: SKU.chakkiAtta5kg, quantity: 1 }],
      problems: ["damaged", "not_fresh"],
      description: "One bag was torn open and the flour smelled stale.",
      preferredResolution: "refund",
    });
    expect(issue).toMatchObject({
      issueNumber: `${orderNumber}-P1`,
      status: "open",
      canCancel: true,
      canAddImages: true,
      preferredResolution: "refund",
    });
    expect(issue.items[0]).toMatchObject({ quantity: 1, refundedQuantity: 0 });
    expect(issue.history).toHaveLength(1);

    const withPhotos = await api.uploadIssueImages(issue.issueNumber, [
      png,
      png,
    ]);
    expect(withPhotos.issue.images).toHaveLength(2);
    expect(withPhotos.issue.images[0].url).toContain("/media/issues/");
    // The address names the media base of a started mock; the path is what counts here.
    const picture = await fetch(
      `${mock.base()}${new URL(withPhotos.issue.images[0].url).pathname}`,
    );
    expect(picture.status).toBe(200);
    expect(picture.headers.get("content-type")).toBe("image/png");
    const bad = await api
      .uploadIssueImages(issue.issueNumber, [
        new File(["x"], "a.gif", { type: "image/gif" }),
      ])
      .catch((e) => e);
    expect(hasErrorCode(bad, "IMAGE_INVALID")).toBe(true);
    const limit = await api
      .uploadIssueImages(issue.issueNumber, [png, png, png, png])
      .catch((e) => e);
    expect(hasErrorCode(limit, "IMAGE_LIMIT_REACHED")).toBe(true);
    const fewer = await api.deleteIssueImage(
      issue.issueNumber,
      withPhotos.issue.images[0].id,
    );
    expect(fewer.issue.images).toHaveLength(1);

    expect((await api.listIssues()).items.map((i) => i.issueNumber)).toEqual([
      issue.issueNumber,
    ]);
    expect((await api.getOverview()).counts.openIssues).toBe(1);
    const taken = await api.cancelIssue(issue.issueNumber);
    expect(taken.issue).toMatchObject({
      status: "cancelled",
      canCancel: false,
    });
    expect(taken.issue.history.map((h) => h.status)).toEqual([
      "open",
      "cancelled",
    ]);
    const again = await api.cancelIssue(issue.issueNumber).catch((e) => e);
    expect(hasErrorCode(again, "ISSUE_TRANSITION_NOT_ALLOWED")).toBe(true);
    expect((await api.getOverview()).counts.openIssues).toBe(0);
  });

  it("is decided by Radhe Foods: a refund corrects the order; a report in review cannot be taken back", async () => {
    const { api, orderNumber } = await delivered();
    const { issue } = await api.createIssue(orderNumber, {
      items: [{ variantId: SKU.chakkiAtta5kg, quantity: 2 }],
      problems: ["missing"],
      description: "Both bags of atta were missing from the box.",
      preferredResolution: "refund",
    });
    await mock.control("issue", {
      issueNumber: issue.issueNumber,
      action: "review",
    });
    const reviewing = (await api.getIssue(issue.issueNumber)).issue;
    expect(reviewing).toMatchObject({
      status: "in_review",
      canCancel: false,
      canAddImages: true,
    });
    const refused = await api.cancelIssue(issue.issueNumber).catch((e) => e);
    expect(hasErrorCode(refused, "ISSUE_TRANSITION_NOT_ALLOWED")).toBe(true);

    await mock.control("issue", {
      issueNumber: issue.issueNumber,
      action: "resolve",
      note: "Refunded, sorry!",
    });
    const resolved = (await api.getIssue(issue.issueNumber)).issue;
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolution).toMatchObject({
      type: "refund",
      amount: 2598,
      note: "Refunded, sorry!",
    });
    expect(resolved.items[0].refundedQuantity).toBe(2);
    expect(resolved.canAddImages).toBe(false);
    const order = (await api.getOrder(orderNumber)).order;
    expect(order.items[0].deliveredQuantity).toBe(0);
    expect(order.adjustments[0]).toMatchObject({
      from: 2,
      to: 0,
      reason: "missing",
    });
    // Nothing of the atta is left to report; the dal still is.
    expect(
      (await api.getOrderIssues(orderNumber)).reportable.map(
        (r) => r.available,
      ),
    ).toEqual([0, 1]);

    const stranger = await mock.signIn("max@example.com");
    const notMine = await stranger.api
      .getIssue(issue.issueNumber)
      .catch((e) => e);
    expect(hasErrorCode(notMine, "ISSUE_NOT_FOUND")).toBe(true);
  });

  it("refuses more than five reports, and an order that is not delivered", async () => {
    const { api, orderNumber } = await delivered();
    for (let i = 0; i < 5; i += 1) {
      await api.createIssue(orderNumber, {
        problems: ["late"],
        description: "The delivery came a day late.",
        preferredResolution: "none",
      });
    }
    const sixth = await api
      .createIssue(orderNumber, {
        problems: ["late"],
        description: "The delivery came a day late.",
        preferredResolution: "none",
      })
      .catch((e) => e);
    expect(hasErrorCode(sixth, "ISSUE_NOT_POSSIBLE")).toBe(true);
    expect((await api.getOrderIssues(orderNumber)).window.possible).toBe(false);
    // The account cannot be closed while reports are open.
    const blocked = await api
      .deleteAccount({ password: "Mangoes-in-May-2026", confirm: true })
      .catch((e) => e);
    expect(hasErrorCode(blocked, "CUSTOMER_HAS_OPEN_ORDERS")).toBe(true);
    if (hasErrorCode(blocked, "CUSTOMER_HAS_OPEN_ORDERS")) {
      expect(blocked.details.openIssues).toBe(5);
    }
  });
});
