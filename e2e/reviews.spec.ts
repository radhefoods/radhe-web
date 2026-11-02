import { expect, test, type Page } from "@playwright/test";
import { createAccount, MOCK } from "./helpers";

// Order reviews (doc ORDER_REVIEWS): a delivered order is reviewed once,
// from its page, with stars and words; the admin publishes it; the shop
// shows it among "What our customers say". The demo account has the
// delivered RF-1085 with a published review and the dispatched RF-1087;
// another customer has a published and a pending review.

const DEMO = "demo@radhefoods.de";

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__mock/reset`);
});

async function signIn(page: Page) {
  await createAccount(page.request, { email: DEMO });
  await page.addInitScript(() => {
    window.localStorage.setItem("rf.session.v1", "1");
  });
}

test.describe("order reviews", () => {
  test("a delivered order is reviewed once from its page, waits for approval, then shows among what customers say", async ({
    page,
    request,
  }) => {
    await signIn(page);
    // The admin delivers RF-1087: it can be reviewed now.
    await request.post(`${MOCK}/__mock/order`, {
      data: { orderNumber: "RF-1087", actions: ["deliver"] },
    });
    await page.goto("/en/account/reviews");
    const open = page.getByRole("region", { name: "Orders you can review" });
    await expect(open).toContainText("Order RF-1087");
    await expect(open).not.toContainText("Order RF-1085");
    const mine = page.getByRole("region", { name: "Your reviews" });
    await expect(
      mine.getByRole("listitem").filter({ hasText: "RF-1085" }),
    ).toContainText("Published");
    await expect(mine).toContainText("Reply from Radhe Foods");

    await open.getByRole("link", { name: "Write a review" }).click();
    await expect(page).toHaveURL(/\/en\/account\/orders\/RF-1087$/);
    const section = page.getByRole("region", { name: "Your review" });
    await section.getByRole("button", { name: "Submit review" }).click();
    await expect(
      section.getByText("Please choose a number of stars."),
    ).toBeVisible();
    await expect(
      section.getByText("Please write at least 10 characters."),
    ).toBeVisible();
    await section.getByRole("radio", { name: "4 stars" }).check();
    await section
      .getByLabel("Tell us about your experience")
      .fill("Quick delivery, the rice was well packed and fresh.");
    await section.getByRole("button", { name: "Submit review" }).click();
    await expect(section).toContainText(
      "Thank you. Your review will be shown once Radhe Foods has read it.",
    );
    await expect(section).toContainText("Waiting for approval");
    await expect(
      section.getByRole("button", { name: "Submit review" }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("region", { name: "Your review" }),
    ).toContainText("Waiting for approval");
    // No way to write a second one, nothing to edit or delete.
    await expect(
      page.getByRole("button", { name: "Submit review" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Edit|Delete/ })).toHaveCount(
      0,
    );

    // Published with an answer: among what customers say, with the summary.
    await request.post(`${MOCK}/__mock/review`, {
      data: { orderNumber: "RF-1087", action: "approve" },
    });
    await request.post(`${MOCK}/__mock/review`, {
      data: {
        orderNumber: "RF-1087",
        action: "reply",
        text: "Thank you, Priya!",
      },
    });
    await page.goto("/en/reviews");
    await expect(
      page.getByRole("heading", { level: 1, name: "What our customers say" }),
    ).toBeVisible();
    await expect(page.getByText(/of 5 from 3 orders/)).toBeVisible();
    const card = page
      .getByRole("article")
      .filter({ hasText: "Quick delivery, the rice" });
    await expect(card).toContainText("Priya S.");
    await expect(card).toContainText("Verified order");
    await expect(card).toContainText("Reply from Radhe Foods");
    await expect(card).toContainText("Thank you, Priya!");
    // The pending review of the other customer is not public.
    await expect(page.getByText("kaju katli")).toHaveCount(0);

    // Narrowed to four stars: Priya's and Meera's.
    await page.getByRole("link", { name: /4 stars/ }).click();
    await expect(page).toHaveURL(/\/en\/reviews\?rating=4$/);
    await expect(page.getByRole("article")).toHaveCount(2);
    await page.getByRole("link", { name: "Show all reviews" }).click();
    await expect(page.getByRole("article")).toHaveCount(3);

    // The account shows it published; nothing waits any more.
    await page.goto("/en/account/reviews");
    await expect(
      page
        .getByRole("region", { name: "Your reviews" })
        .getByRole("listitem")
        .filter({ hasText: "RF-1087" }),
    ).toContainText("Published");
    await expect(
      page.getByRole("region", { name: "Orders you can review" }),
    ).toContainText("Nothing to review yet");
  });

  test("the home page carries the section; products carry no stars; a dispatched order has no form", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/en");
    const section = page.getByRole("region", {
      name: "What our customers say",
    });
    await expect(section).toContainText("Priya S.");
    await expect(section).toContainText("Verified order");
    await expect(
      section.getByRole("link", { name: "All reviews" }),
    ).toHaveAttribute("href", "/en/reviews");

    await page.goto("/en/products?q=basmati");
    await expect(page.getByRole("img", { name: /Rated/ })).toHaveCount(0);
    await page.goto("/en/products/basmati-rice-5kg");
    await expect(page.getByRole("region", { name: "Reviews" })).toHaveCount(0);

    // Dispatched, not delivered: nothing about a review on the order.
    await page.goto("/en/account/orders/RF-1087");
    await expect(
      page.getByRole("heading", { level: 1, name: /RF-1087/ }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Your review" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("region", { name: "How was it?" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("link", { name: "Write a review" }),
    ).toHaveCount(0);
  });
});
