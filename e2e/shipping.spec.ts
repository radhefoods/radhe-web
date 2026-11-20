import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from "@playwright/test";
import { createAccount, MOCK } from "./helpers";

// Delivery by the box in the cart, at the checkout and on the order page
// (doc/BOX_BASED_SHIPPING_WEB_INTEGRATION.md): the ten scenarios of its
// section 12, with the rules of its section 1 (39 € of goods per free box,
// 25 kg per box, 6.99 € per paid box up to 20 € of goods and 4.99 € above),
// and the shop as it was while the rules are off. The figures come from the
// mock API, which runs the rule functions of the real one; the shop only
// prints them.

// The first visit of a page compiles it in `next dev`.
test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__mock/reset`);
});

/** The pack sizes of the scenarios: what they cost and what they weigh. */
const PACKS = {
  /** A 20 kg sack for 29.50 €. */
  sack: { slug: "chakki-atta-5kg", price: 2950, shippingWeight: 20000 },
  /** A 5.1 kg bag for 10.00 €. */
  bag: { slug: "basmati-rice-5kg", price: 1000, shippingWeight: 5100 },
  /** 1 kg for 19.00 €. */
  small: { slug: "toor-dal-1kg", price: 1900, shippingWeight: 1000 },
  /** 2.1 kg for 10.00 €. */
  light: { slug: "basmati-rice-1kg", price: 1000, shippingWeight: 2100 },
  /** 5.3 kg for 25.00 €. */
  medium: { slug: "turmeric-powder-1kg", price: 2500, shippingWeight: 5300 },
  /** 11.2 kg for 39.00 €. */
  full: { slug: "turmeric-powder-400g", price: 3900, shippingWeight: 11200 },
} as const;
type Pack = keyof typeof PACKS;
type Ids = Record<Pack, string>;
type Cart = [Pack, number][];

/** The admin enters the prices and the weights of the scenarios. */
async function stockThePacks(request: APIRequestContext): Promise<Ids> {
  const ids = {} as Ids;
  for (const [pack, { slug, price }] of Object.entries(PACKS)) {
    const response = await request.get(`${MOCK}/v1/store/products/${slug}`);
    expect(response.ok(), `the mock knows ${slug}`).toBe(true);
    const id: string = (await response.json()).product.variantId;
    ids[pack as Pack] = id;
    await request.post(`${MOCK}/__mock/price`, {
      data: { variantId: id, price },
    });
  }
  const set = await request.post(`${MOCK}/__mock/shipping`, {
    data: {
      weights: (Object.keys(PACKS) as Pack[]).map((pack) => ({
        variantId: ids[pack],
        shippingWeight: PACKS[pack].shippingWeight,
      })),
    },
  });
  expect(set.ok(), "the mock takes the weights").toBe(true);
  return ids;
}

/** Box-based shipping switched on, with the scenarios' packs. */
async function boxRules(
  request: APIRequestContext,
  rules: Record<string, unknown> = {},
): Promise<Ids> {
  const ids = await stockThePacks(request);
  const set = await request.post(`${MOCK}/__mock/shipping`, {
    data: { enabled: true, ...rules },
  });
  expect(set.ok(), "the mock takes the rules").toBe(true);
  return ids;
}

/** Puts pack sizes into the visitor's cart before the page loads. */
async function seedGuestCart(page: Page, ids: Ids, cart: Cart) {
  await page.addInitScript(
    (items) => {
      window.localStorage.setItem("rf.cart.v2", JSON.stringify(items));
    },
    cart.map(([pack, quantity]) => ({ variantId: ids[pack], quantity })),
  );
}

/**
 * A signed-in customer with an address and these packs in the stored cart,
 * set up through the API. The browser gets the session cookies of these
 * calls, and the hint that it signed in before.
 */
async function seedCustomer(page: Page, ids: Ids, cart: Cart) {
  const api = page.request;
  await createAccount(api, { email: "priya@example.com" });
  await api.post(`${MOCK}/v1/store/me/addresses`, {
    data: {
      firstName: "Priya",
      lastName: "Shah",
      street: "Hauptstraße",
      houseNumber: "12",
      postalCode: "60311",
      city: "Frankfurt am Main",
    },
  });
  for (const [pack, quantity] of cart) {
    await api.put(`${MOCK}/v1/store/cart/items/${ids[pack]}`, {
      data: { quantity },
    });
  }
  await page.addInitScript(() => {
    window.localStorage.setItem("rf.session.v1", "1");
  });
}

const cartSummary = (page: Page) =>
  page.getByRole("complementary", { name: "Summary" });
const orderSummary = (page: Page) =>
  page.getByRole("complementary", { name: "Your order" });
/** The bar of the free-delivery progress, by how full it is drawn. */
const barAt = (summary: Locator, percent: number) =>
  summary.locator(`[style*="width: ${percent}%"]`);
/** axe against WCAG 2.2 A and AA and its best-practice rules, as in accessibility.spec.ts. */
async function expectNoBarriers(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags([
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "wcag22aa",
      "best-practice",
    ])
    .analyze();
  const found = violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes
        .slice(0, 4)
        .map(
          (node) =>
            `    ${node.target.join(" ")}\n      ${(node.failureSummary ?? "").replace(/\s+/g, " ")}`,
        )
        .join("\n"),
  );
  expect(found, `${page.url()}\n${found.join("\n")}`).toEqual([]);
}
/** The page is not wider than the screen. */
async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow, "no sideways scroll").toBeLessThanOrEqual(1);
}

test.describe("switched off (scenario 10)", () => {
  test("the cart and the checkout are the ones of before", async ({
    page,
    request,
  }) => {
    const ids = await stockThePacks(request);
    await seedGuestCart(page, ids, [["light", 1]]);
    await page.goto("/en/cart");
    const summary = cartSummary(page);
    // The flat fee of the mock: 4.99 €, free from 50.00 €.
    await expect(summary).toContainText("Add €40.00 more for free delivery");
    await expect(summary).toContainText("Free from €50.00");
    await expect(summary).toContainText("€4.99");
    await expect(summary).toContainText("€14.99");
    // Nothing of the boxes.
    await expect(summary.getByRole("region")).toHaveCount(0);
    await expect(summary).not.toContainText("box");
    await expect(summary).not.toContainText("kg");

    await page.goto("/en/checkout");
    await page.getByRole("button", { name: "Continue as guest" }).click();
    const order = orderSummary(page);
    await expect(order).toContainText("€14.99");
    await expect(order).not.toContainText("ships free");
    await expect(order).not.toContainText("box");
  });

  test("a free-delivery code is named at the delivery, without a discount row", async ({
    page,
    request,
  }) => {
    const ids = await stockThePacks(request);
    await seedCustomer(page, ids, [["light", 1]]);
    await page.goto("/en/checkout");
    const order = orderSummary(page);
    await expect(order).toContainText("€14.99");
    await page.getByLabel("Discount code").fill("freeship");
    await order.getByRole("button", { name: "Apply" }).click();
    await expect(order).toContainText("Code FREESHIP applied");
    await expect(order).toContainText("Free delivery.");
    await expect(order).toContainText("with code FREESHIP");
    // Nothing off the goods: no "Discount code" row, no "You save €0.00".
    await expect(order).not.toContainText("Discount code FREESHIP");
    await expect(order).not.toContainText("€0.00");
    await expect(order).toContainText("€10.00");
    await expect(order).not.toContainText("€14.99");
  });
});

test.describe("one box (scenarios 1 to 3)", () => {
  test("1: 10.00 €, 2.1 kg pays 6.99 € and is 29.00 € from free", async ({
    page,
    request,
  }) => {
    const ids = await boxRules(request);
    await seedGuestCart(page, ids, [["light", 1]]);
    await page.goto("/en/cart");
    const summary = cartSummary(page);
    await expect(summary).toContainText(
      "Add €29.00 more and this order ships free.",
    );
    await expect(barAt(summary, 26)).toHaveCount(1);
    await expect(summary).toContainText("€39.00 per free box");
    await expect(summary).toContainText("€6.99");
    await expect(summary).toContainText("€16.99");
    const box = summary.getByRole("region", { name: "Your box" });
    await expect(box).toContainText("2.1 kg of 25 kg");
    await expect(box).toContainText("22.9 kg of room left in your box.");
    await expect(barAt(box, 8)).toHaveCount(1);
    // One box: no line of boxes under the delivery, and the old hint is gone.
    await expect(summary).not.toContainText("boxes");
    await expect(summary).not.toContainText("for free delivery");
    await expectNoSidewaysScroll(page);
  });

  test("2 and 3: 25.00 € pay 4.99 €, 39.00 € ship free", async ({
    page,
    request,
  }) => {
    const ids = await boxRules(request);
    await seedGuestCart(page, ids, [["medium", 1]]);
    await page.goto("/en/cart");
    const summary = cartSummary(page);
    await expect(summary).toContainText(
      "Add €14.00 more and this order ships free.",
    );
    await expect(summary).toContainText("€4.99");
    await expect(summary).toContainText("€29.99");
    await expect(
      summary.getByRole("region", { name: "Your box" }),
    ).toContainText("5.3 kg of 25 kg");

    // The visitor's cart is the browser's: another pack in it (as another
    // tab would put it there), and the bill follows.
    await page.evaluate(
      (cart) => {
        window.localStorage.setItem("rf.cart.v2", JSON.stringify(cart));
        window.dispatchEvent(new Event("rf:guest-cart"));
      },
      [{ variantId: ids.full, quantity: 1 }],
    );
    await expect(summary).toContainText("Great, this order ships free!");
    await expect(barAt(summary, 100)).toHaveCount(1);
    await expect(
      summary.getByRole("region", { name: "Your box" }),
    ).toContainText("11.2 kg of 25 kg");
    await expect(summary).toContainText("€39.00");
    await expect(summary).not.toContainText("€4.99");
  });
});

test.describe("two boxes (scenarios 4 to 6)", () => {
  test("4: a 20 kg sack and a 5.1 kg bag need two boxes, one of them free", async ({
    page,
    request,
  }) => {
    const ids = await boxRules(request);
    await seedGuestCart(page, ids, [
      ["sack", 1],
      ["bag", 1],
    ]);
    await page.goto("/en/cart");
    const summary = cartSummary(page);
    await expect(summary).toContainText(
      "Add €38.50 more and box 2 ships free too.",
    );
    await expect(summary).toContainText(
      "This order needs 2 boxes: 1 free, 1 at €4.99.",
    );
    const boxes = summary.getByRole("region", { name: "Your boxes" });
    await expect(boxes).toContainText("25.1 kg");
    const rows = boxes.getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Box 1");
    await expect(rows.nth(0)).toContainText("20 kg");
    await expect(rows.nth(0)).toContainText("Free");
    await expect(rows.nth(1)).toContainText("Box 2");
    await expect(rows.nth(1)).toContainText("5.1 kg");
    await expect(rows.nth(1)).toContainText("€4.99");
    await expect(boxes).toContainText("Box 2 has 19.9 kg of room left.");
    await expect(summary).toContainText("2 boxes: 1 free, 1 paid");
    await expect(summary).toContainText("€44.49");
    await expectNoSidewaysScroll(page);
  });

  test("5 and 6: 59.00 € pay one box; with 19.00 € more both are free, and back", async ({
    page,
    request,
  }) => {
    const ids = await boxRules(request);
    await seedCustomer(page, ids, [
      ["sack", 2],
      ["small", 1],
    ]);
    await page.goto("/en/cart");
    const summary = cartSummary(page);
    // Scenario 6: 78.00 €, 41 kg, still two boxes.
    await expect(summary).toContainText("Great, all 2 boxes ship free!");
    await expect(summary).toContainText("2 boxes, all free");
    await expect(summary).toContainText("€78.00");
    const boxes = summary.getByRole("region", { name: "Your boxes" });
    await expect(boxes).toContainText("41 kg");
    await expect(boxes.getByRole("listitem").nth(0)).toContainText("21 kg");

    // Scenario 5: the kilogram is taken out again.
    await page
      .getByRole("button", { name: "Remove Toor Dal (1kg) from the cart" })
      .click();
    await expect(summary).toContainText(
      "Add €19.00 more and box 2 ships free too.",
    );
    await expect(barAt(summary, 51)).toHaveCount(1);
    await expect(summary).toContainText("2 boxes: 1 free, 1 paid");
    await expect(summary).toContainText("€63.99");
    await expect(boxes).toContainText("40 kg");
  });

  test("quick taps end on the bill of the last one", async ({
    page,
    request,
  }) => {
    const ids = await boxRules(request);
    await seedCustomer(page, ids, [["sack", 2]]);
    await page.goto("/en/cart");
    const summary = cartSummary(page);
    await expect(summary).toContainText(
      "Add €19.00 more and box 2 ships free too.",
    );
    const more = page.getByRole("button", { name: "One more" });
    await more.click();
    await more.click();
    await more.click();
    // Five sacks: 147.50 €, five boxes, three of them free.
    await expect(summary).toContainText(
      "Add €8.50 more and box 4 ships free too.",
    );
    await expect(summary).toContainText(
      "This order needs 5 boxes: 3 free, 2 at €4.99 each.",
    );
    await expect(summary).toContainText("5 boxes: 3 free, 2 paid");
    await expect(
      summary.getByRole("region", { name: "Your boxes" }).getByRole("listitem"),
    ).toHaveCount(5);
    await expect(summary).toContainText("€157.48");
  });
});

test.describe("codes and coins at the checkout (scenarios 7 to 9)", () => {
  test("7: a 10 % code on 78.00 € costs a free box, and its removal gives it back", async ({
    page,
    request,
  }) => {
    const ids = await boxRules(request);
    await seedCustomer(page, ids, [
      ["sack", 2],
      ["small", 1],
    ]);
    await page.goto("/en/checkout");
    const order = orderSummary(page);
    await expect(order).toContainText("Great, all 2 boxes ship free!");
    await expect(order).toContainText("2 boxes, all free");
    // How full the boxes are stays on the cart page.
    await expect(order.getByRole("region")).toHaveCount(0);

    await page.getByLabel("Discount code").fill("DIWALI10");
    await order.getByRole("button", { name: "Apply" }).click();
    await expect(order).toContainText(
      "Add €7.80 more and box 2 ships free too.",
    );
    await expect(order).toContainText(
      "With this discount one box is no longer free. Add €7.80 more to get it free again.",
    );
    await expect(order).toContainText("Discount code DIWALI10");
    await expect(order).toContainText("−€7.80");
    await expect(order).toContainText("2 boxes: 1 free, 1 paid");
    await expect(order).toContainText("€75.19");

    await order
      .getByRole("button", { name: "Remove the code DIWALI10" })
      .click();
    await expect(order).toContainText("Great, all 2 boxes ship free!");
    await expect(order).not.toContainText("no longer free");
    await expect(order).toContainText("€78.00");
  });

  test("8: a free-delivery code frees every box and has no discount row", async ({
    page,
    request,
  }) => {
    const ids = await boxRules(request);
    await seedCustomer(page, ids, [["sack", 2]]);
    await page.goto("/en/checkout");
    const order = orderSummary(page);
    await expect(order).toContainText(
      "Add €19.00 more and box 2 ships free too.",
    );
    await expect(order).toContainText("€63.99");

    await page.getByLabel("Discount code").fill("FREESHIP");
    await order.getByRole("button", { name: "Apply" }).click();
    await expect(order).toContainText(
      "Free delivery with code FREESHIP. You save €4.99.",
    );
    await expect(order).toContainText("Code FREESHIP applied");
    await expect(order).toContainText("Free delivery. You save €4.99.");
    await expect(order).toContainText("2 boxes, free with code FREESHIP");
    // What the delivery would have cost is struck through beside "Free".
    await expect(order.locator("s", { hasText: "€4.99" })).toHaveCount(1);
    await expect(order).not.toContainText("Discount code FREESHIP");
    await expect(order).not.toContainText("€0.00");
    await expect(order).toContainText("€59.00");
    await expect(order).not.toContainText("€63.99");
  });

  test("9: coins worth 1.95 € on 39.00 € bring the delivery fee back", async ({
    page,
    request,
  }) => {
    const ids = await boxRules(request);
    // 100 coins take 5 % off the goods.
    await request.post(`${MOCK}/__mock/rewards`, {
      data: { settings: { redemption: { percentPerCoin: 0.05 } } },
    });
    await seedCustomer(page, ids, [["full", 1]]);
    await page.goto("/en/checkout");
    const order = orderSummary(page);
    await expect(order).toContainText("Great, this order ships free!");
    await order.getByRole("button", { name: "Redeem all" }).click();
    await expect(order).toContainText(
      "Add €1.95 more and this order ships free.",
    );
    await expect(order).toContainText(
      "With these coins one box is no longer free. Add €1.95 more to get it free again.",
    );
    await expect(order).toContainText("−€1.95");
    await expect(order).toContainText("€4.99");
    await expect(order).toContainText("€42.04");
  });
});

test.describe("in German", () => {
  test("the cart speaks German, with German numbers", async ({
    page,
    request,
  }) => {
    const ids = await boxRules(request);
    await seedGuestCart(page, ids, [["sack", 2]]);
    await page.goto("/de/warenkorb");
    const summary = page.getByRole("complementary", { name: "Übersicht" });
    await expect(summary).toContainText(
      "Noch 19,00 €, dann ist auch Box 2 kostenlos.",
    );
    await expect(summary).toContainText(
      "Diese Bestellung braucht 2 Boxen: 1 kostenlos, 1 für 4,99 €.",
    );
    await expect(summary).toContainText("39,00 € je kostenlose Box");
    const boxes = summary.getByRole("region", { name: "Ihre Boxen" });
    await expect(boxes).toContainText("40 kg");
    await expect(boxes.getByRole("listitem").nth(0)).toContainText("Kostenlos");
    await expect(boxes.getByRole("listitem").nth(1)).toContainText("4,99 €");
    await expect(boxes).toContainText("In Box 2 ist noch Platz für 5 kg.");
    await expect(summary).toContainText(
      "2 Boxen: 1 kostenlos, 1 kostenpflichtig",
    );
    await expect(summary).toContainText("63,99 €");
  });

  test("one box, with a comma in the weight", async ({ page, request }) => {
    const ids = await boxRules(request);
    await seedGuestCart(page, ids, [["light", 1]]);
    await page.goto("/de/warenkorb");
    const summary = page.getByRole("complementary", { name: "Übersicht" });
    await expect(summary).toContainText(
      "Noch 29,00 € bis zur kostenlosen Lieferung.",
    );
    const box = summary.getByRole("region", { name: "Ihre Box" });
    await expect(box).toContainText("2,1 kg von 25 kg");
    await expect(box).toContainText("In der Box ist noch Platz für 22,9 kg.");
  });
});

test.describe("the order", () => {
  test("a guest orders two boxes, and the order page says what was agreed", async ({
    page,
    request,
  }) => {
    const ids = await boxRules(request);
    await seedGuestCart(page, ids, [["sack", 2]]);
    await page.goto("/en/checkout");
    await page.getByRole("button", { name: "Continue as guest" }).click();
    const order = orderSummary(page);
    await expect(order).toContainText(
      "Add €19.00 more and box 2 ships free too.",
    );
    await expect(order).toContainText("€63.99");
    await page.getByLabel("First name").fill("Gita");
    await page.getByLabel("Last name").fill("Guest");
    await page.getByLabel("Street").fill("Hauptstraße");
    await page.getByLabel("House number").fill("12a");
    await page.getByLabel("Postcode").fill("60311");
    await page.getByLabel("City").fill("Frankfurt am Main");
    await page.getByRole("button", { name: "Save address" }).click();
    await page
      .getByRole("textbox", { name: "Email address" })
      .fill("gita@example.com");
    await page.getByRole("checkbox", { name: /Terms and Conditions/ }).check();
    await page.getByRole("button", { name: "Buy now" }).click();
    await expect(page).toHaveURL(/__mock\/stripe\/RF-1085$/);
    await expect(page.getByText("63.99 EUR")).toBeVisible();
    await page.getByRole("link", { name: "Pay by card" }).click();

    await expect(page).toHaveURL(/\/en\/guest\/orders\/RF-1085\?token=/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Order RF-1085" }),
    ).toBeVisible();
    await expect(
      page.getByText("Delivery: 2 boxes, 40 kg — 1 free, 1 × €4.99"),
    ).toBeVisible();

    // The admin changes the rules afterwards: the order keeps its boxes.
    await request.post(`${MOCK}/__mock/shipping`, {
      data: { freeThresholdPerBox: 9900, maxBoxWeight: 30000 },
    });
    await page.reload();
    await expect(
      page.getByText("Delivery: 2 boxes, 40 kg — 1 free, 1 × €4.99"),
    ).toBeVisible();
  });

  test("an order that paid the flat fee has no line of boxes", async ({
    page,
    request,
  }) => {
    const ids = await stockThePacks(request);
    await seedCustomer(page, ids, [["light", 1]]);
    await page.goto("/en/checkout");
    await page.getByRole("checkbox", { name: /Terms and Conditions/ }).check();
    await page.getByRole("button", { name: "Buy now" }).click();
    await expect(page).toHaveURL(/__mock\/stripe\/RF-1085$/);
    await page.getByRole("link", { name: "Pay by card" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Order RF-1085" }),
    ).toBeVisible();
    await expect(page.getByText("Bill", { exact: true })).toBeVisible();
    await expect(page.getByText(/Delivery: \d+ box/)).toHaveCount(0);
  });

  test("a bill that changed with the rules is shown again before the order is placed", async ({
    page,
    request,
  }) => {
    const ids = await boxRules(request);
    await seedCustomer(page, ids, [["sack", 2]]);
    await page.goto("/en/checkout");
    const order = orderSummary(page);
    await expect(order).toContainText("€63.99");
    await page.getByRole("checkbox", { name: /Terms and Conditions/ }).check();
    // The admin changes the fee of a paid box while the customer looks.
    await request.post(`${MOCK}/__mock/shipping`, {
      data: { feeTiers: [{ upTo: null, fee: 599 }] },
    });
    await page.getByRole("button", { name: "Buy now" }).click();
    const changed = page
      .getByRole("alert")
      .filter({ hasText: "The total has changed" });
    await expect(changed).toContainText("It was €63.99 and is now €64.99.");
    await expect(order).toContainText("€5.99");
    await expect(order).toContainText("€64.99");
    await expect(page).toHaveURL(/\/en\/checkout$/);
  });
});

test.describe("heavy packs and many boxes", () => {
  test("a pack the shop does not send says so, and the cart cannot be ordered", async ({
    page,
    request,
  }) => {
    const ids = await boxRules(request, { overweight: "not_orderable" });
    await request.post(`${MOCK}/__mock/shipping`, {
      data: { weights: [{ variantId: ids.sack, shippingWeight: 30000 }] },
    });
    await seedGuestCart(page, ids, [
      ["sack", 1],
      ["light", 1],
    ]);
    await page.goto("/en/cart");
    await expect(
      page.getByText(
        "This item is too heavy to be shipped. Please remove it or contact us.",
      ),
    ).toBeVisible();
    const summary = cartSummary(page);
    await expect(
      summary.getByRole("button", { name: "Go to checkout" }),
    ).toBeDisabled();
    // The bill and the box are those of the line that can be ordered.
    await expect(summary).toContainText(
      "Add €29.00 more and this order ships free.",
    );
    await expect(
      summary.getByRole("region", { name: "Your box" }),
    ).toContainText("2.1 kg of 25 kg");
  });

  test("a parcel that travels alone, and an estimated weight", async ({
    page,
    request,
  }) => {
    const ids = await boxRules(request);
    await request.post(`${MOCK}/__mock/shipping`, {
      data: {
        weights: [
          { variantId: ids.sack, shipsSeparately: true },
          // No weight on record: 1 kg of rice is taken as 1,050 g.
          { variantId: ids.light, shippingWeight: null },
        ],
      },
    });
    await seedGuestCart(page, ids, [
      ["sack", 1],
      ["light", 1],
    ]);
    await page.goto("/en/cart");
    const boxes = cartSummary(page).getByRole("region", { name: "Your boxes" });
    const rows = boxes.getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Box 1");
    await expect(rows.nth(1)).toContainText("Separate parcel");
    await expect(rows.nth(1)).toContainText("20 kg");
    await expect(boxes).toContainText("Weight is approximate.");
    await expect(boxes).toContainText("Box 1 has 23.9 kg of room left.");
  });

  test("four boxes fit the screen", async ({ page, request }) => {
    const ids = await boxRules(request);
    await seedGuestCart(page, ids, [
      ["sack", 3],
      ["bag", 1],
    ]);
    await page.goto("/en/cart");
    const summary = cartSummary(page);
    // 98.50 €: two boxes free, two paid.
    await expect(summary).toContainText(
      "Add €18.50 more and box 3 ships free too.",
    );
    await expect(summary).toContainText(
      "This order needs 4 boxes: 2 free, 2 at €4.99 each.",
    );
    const boxes = summary.getByRole("region", { name: "Your boxes" });
    await expect(boxes.getByRole("listitem")).toHaveCount(4);
    await expect(boxes).toContainText("65.1 kg");
    await expect(summary).toContainText("4 boxes: 2 free, 2 paid");
    await expect(summary).toContainText("€108.48");
    await expectNoSidewaysScroll(page);
  });

  test("twelve boxes scroll inside their list, which the keyboard reaches", async ({
    page,
    request,
  }) => {
    const ids = await boxRules(request);
    await seedGuestCart(page, ids, [["sack", 12]]);
    await page.goto("/en/cart");
    const summary = cartSummary(page);
    // 354.00 €: nine boxes free, three paid.
    await expect(summary).toContainText(
      "This order needs 12 boxes: 9 free, 3 at €4.99 each.",
    );
    const boxes = summary.getByRole("region", { name: "Your boxes" });
    const list = boxes.getByRole("list");
    await expect(list.getByRole("listitem")).toHaveCount(12);
    await expect(list).toHaveAttribute("tabindex", "0");
    const scrolls = await list.evaluate(
      (element) => element.scrollHeight > element.clientHeight + 1,
    );
    expect(scrolls, "the list scrolls inside").toBe(true);
    await expect(boxes).toContainText("240 kg");
    await expectNoSidewaysScroll(page);
    await expectNoBarriers(page);
  });
});

test.describe("barriers", () => {
  test("axe finds none in the cart and at the checkout with the boxes", async ({
    page,
    request,
  }) => {
    const ids = await boxRules(request);
    await request.post(`${MOCK}/__mock/shipping`, {
      data: {
        weights: [
          // A parcel of its own, and a weight that is estimated.
          { variantId: ids.bag, shipsSeparately: true },
          { variantId: ids.small, shippingWeight: null },
        ],
      },
    });
    await seedCustomer(page, ids, [
      ["sack", 2],
      ["small", 1],
      ["bag", 1],
    ]);
    await page.goto("/en/cart");
    const summary = cartSummary(page);
    await expect(
      summary.getByRole("region", { name: "Your boxes" }),
    ).toContainText("Separate parcel");
    await expect(summary).toContainText("Weight is approximate.");
    await expectNoBarriers(page);

    await page.goto("/en/checkout");
    const order = orderSummary(page);
    await expect(order).toContainText("ship");
    await page.getByLabel("Discount code").fill("FREESHIP");
    await order.getByRole("button", { name: "Apply" }).click();
    await expect(order).toContainText("Free delivery with code FREESHIP");
    await expectNoBarriers(page);
  });
});
