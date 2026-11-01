import { expect, test, type Page } from "@playwright/test";
import { createAccount, MOCK } from "./helpers";

// Product reviews and order feedback (doc 22). The demo account has a
// delivered order RF-1085 (basmati 5 kg, toor dal, mango drink), a
// published review of the basmati with a reply, and a pending one of the
// toor dal; another customer's review of the basmati is published too.

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

test.describe("reviews on the product", () => {
  test("the cards and the page show the stars; the section lists the reviews with the reply and filters by stars", async ({
    page,
    request,
  }) => {
    // The demo account seeds the reviews when it is created.
    await createAccount(request, { email: DEMO });
    await page.goto("/en/products/basmati-rice-5kg");
    await expect(
      page.getByRole("link", { name: /Rated 4[.,]5 out of 5 by 2 customers/ }),
    ).toBeVisible();
    const section = page.getByRole("region", { name: "Reviews" });
    await expect(section).toContainText("2 reviews");
    await expect(section).toContainText("Fluffy and fragrant");
    await expect(section).toContainText("Priya S.");
    await expect(section).toContainText("Verified purchase");
    await expect(section).toContainText("Reply from Radhe Foods");
    await expect(section).toContainText("Very good rice");
    // The pending review of the toor dal is not shown anywhere public.
    await expect(section).not.toContainText("pressure cooker");

    await section
      .getByRole("button", { name: "Show only reviews with 4 stars" })
      .click();
    await expect(section).toContainText("Very good rice");
    await expect(section).not.toContainText("Fluffy and fragrant");
    await section.getByRole("button", { name: "Show all reviews" }).click();
    await expect(section).toContainText("Fluffy and fragrant");

    // The card in a list carries the stars too.
    await page.goto("/en/products?q=basmati");
    await expect(
      page
        .getByRole("img", { name: /Rated 4[.,]5 out of 5 by 2 customers/ })
        .first(),
    ).toBeVisible();
  });
});

test.describe("the reviews of a customer", () => {
  test("a delivered product is reviewed from the order, the review waits for approval, is edited and deleted", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/en/account/orders/RF-1085");
    await page
      .getByRole("listitem")
      .filter({ hasText: "Mango Drink" })
      .getByRole("link", { name: "Write a review" })
      .click();
    await expect(page).toHaveURL(/\/en\/account\/reviews\?product=/);
    const sheet = page.getByRole("dialog", { name: /Your review of/ });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Save review" }).click();
    await expect(
      sheet.getByText("Please choose a number of stars."),
    ).toBeVisible();
    await sheet.getByRole("radio", { name: "4 stars" }).check();
    await sheet.getByLabel("Your review").fill("Too short");
    await sheet.getByRole("button", { name: "Save review" }).click();
    await expect(
      sheet.getByText("Please write at least 10 characters."),
    ).toBeVisible();
    await sheet
      .getByLabel("Your review")
      .fill("Sweet and refreshing, the children loved it.");
    await sheet.getByRole("button", { name: "Save review" }).click();
    await expect(
      page.getByText(
        "Thank you. Your review is shown once we have approved it.",
      ),
    ).toBeVisible();

    const mine = page.getByRole("region", { name: "Your reviews" });
    const drink = mine.getByRole("listitem").filter({ hasText: "Mango Drink" });
    await expect(drink).toContainText("Waiting for approval");
    await expect(
      mine.getByRole("listitem").filter({ hasText: "Basmati Rice" }),
    ).toContainText("Published");
    await expect(
      page.getByRole("region", { name: "Waiting for your review" }),
    ).toContainText("Nothing to review yet");

    await drink.getByRole("button", { name: "Edit" }).click();
    const edit = page.getByRole("dialog", { name: /Your review of/ });
    await edit.getByLabel("Title (optional)").fill("Summer in a carton");
    await edit.getByRole("button", { name: "Save review" }).click();
    await expect(drink).toContainText("Summer in a carton");

    await drink.getByRole("button", { name: "Delete" }).click();
    await drink.getByRole("button", { name: "Yes, delete" }).click();
    await expect(
      mine.getByRole("listitem").filter({ hasText: "Mango Drink" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Waiting for your review" }),
    ).toContainText("Mango Drink");
  });

  test("a delivered order is rated once", async ({ page }) => {
    await signIn(page);
    await page.goto("/en/account/orders/RF-1085");
    const feedback = page.getByRole("region", { name: "How was it?" });
    await feedback.getByRole("button", { name: "Send" }).click();
    await expect(
      feedback.getByText("Please choose a number of stars."),
    ).toBeVisible();
    await feedback
      .getByRole("group", { name: "Your order" })
      .getByRole("radio", { name: "5 stars" })
      .check();
    await feedback
      .getByRole("group", { name: "The delivery (optional)" })
      .getByRole("radio", { name: "4 stars" })
      .check();
    await feedback.getByLabel(/Anything to add/).fill("Quick and friendly.");
    await feedback.getByRole("button", { name: "Send" }).click();
    await expect(feedback).toContainText("Thank you for your feedback.");
    await expect(feedback).toContainText("You rated this order 5 out of 5.");
    await expect(feedback).toContainText("The delivery: 4 out of 5.");
    await page.reload();
    await expect(
      page.getByRole("region", { name: "How was it?" }),
    ).toContainText("You rated this order 5 out of 5.");
    await expect(page.getByRole("button", { name: "Send" })).toHaveCount(0);
  });
});
