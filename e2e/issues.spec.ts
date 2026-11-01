import { expect, test, type Page } from "@playwright/test";
import { createAccount, MOCK } from "./helpers";

// Problem reports after a delivery (doc 23). The demo account's RF-1085
// was delivered (basmati 5 kg, toor dal ×2, mango drink ×6) and has one
// resolved report of a mango drink carton.

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

/** A small PNG, as a file the picker accepts. */
const PNG = {
  name: "torn-bag.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
};

test.describe("reporting a problem", () => {
  test("the order shows its reports and the way to a new one; the four steps make the report with a photo", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/en/account/orders/RF-1085");
    const problems = page.getByRole("region", { name: "Problems" });
    await expect(problems).toContainText("Report RF-1085-P1");
    await expect(problems).toContainText("Resolved");
    await expect(problems).toContainText(/You can report a problem until/);
    await problems.getByRole("link", { name: "Report a problem" }).click();
    await expect(page).toHaveURL(/\/en\/account\/orders\/RF-1085\/report$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Report a problem" }),
    ).toBeVisible();
    await expect(
      page.getByText(/You have \d+ days left to report/),
    ).toBeVisible();
    await expect(page.getByText("Your previous reports")).toBeVisible();

    // Nothing chosen: the problems and the text are asked for.
    await page.getByRole("button", { name: "Submit report" }).click();
    await expect(
      page.getByText("Please pick at least one problem."),
    ).toBeVisible();
    await expect(
      page.getByText("Please write at least 10 characters."),
    ).toBeVisible();

    // Step 1: the toor dal, one of the two.
    const dal = page.getByRole("listitem").filter({ hasText: "Toor Dal" });
    await dal.getByRole("checkbox").check();
    await expect(dal.getByText("of 2")).toBeVisible();
    // Step 2: two problems.
    await page.getByRole("button", { name: "Damaged" }).click();
    await page.getByRole("button", { name: "Not fresh" }).click();
    await expect(page.getByRole("button", { name: "Damaged" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Step 3: the text and a photo.
    await page
      .getByRole("textbox", { name: "Tell us a bit more" })
      .fill("The bag was torn at the bottom and the dal smelled musty.");
    await page.locator("#report-photos").setInputFiles(PNG);
    await expect(
      page.getByRole("button", { name: "Remove photo 1" }),
    ).toBeVisible();
    // Step 4: a replacement.
    await page.getByRole("radio", { name: /Replace in next delivery/ }).check();

    const summary = page.getByRole("region", { name: "Order RF-1085" });
    await expect(summary).toContainText("1 × Toor Dal");
    await expect(summary).toContainText("Damaged, Not fresh");
    await expect(summary).toContainText("Replace in next delivery");

    await page.getByRole("button", { name: "Submit report" }).click();
    await expect(page).toHaveURL(/\/en\/account\/reports\/RF-1085-P2$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Report RF-1085-P2" }),
    ).toBeVisible();
    await expect(page.getByText("Received", { exact: true })).toBeVisible();
    await expect(page.getByText("1 × Toor Dal (1kg)")).toBeVisible();
    await expect(page.getByRole("img", { name: "Photo 1" })).toBeVisible();
    await expect(page.getByText("Replace in next delivery")).toBeVisible();

    // Taken back with a second tap.
    await page.getByRole("button", { name: "Take back" }).click();
    await page.getByRole("button", { name: "Yes, take it back" }).click();
    await expect(
      page.getByText("Taken back", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Take back" })).toHaveCount(
      0,
    );

    // The list of the account has both.
    await page.goto("/en/account/reports");
    await expect(page.getByRole("article")).toHaveCount(2);
    await expect(
      page
        .getByRole("navigation", { name: "Account" })
        .getByRole("link", { name: "Reports" }),
    ).toBeVisible();
  });

  test("a resolved report shows what was done and its history", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/en/account/reports/RF-1085-P1");
    await expect(
      page.getByRole("heading", { level: 1, name: "Report RF-1085-P1" }),
    ).toBeVisible();
    const done = page.getByRole("status");
    await expect(done).toContainText("What we did");
    await expect(done).toContainText("Refund");
    await expect(done).toContainText("credited");
    await expect(done).toContainText("Sorry about that!");
    const history = page.getByRole("region", { name: "What happened when" });
    await expect(history).toContainText("Received");
    await expect(history).toContainText("Being looked at");
    await expect(history).toContainText("Resolved");
    await expect(page.getByRole("button", { name: "Take back" })).toHaveCount(
      0,
    );
    await expect(page.getByText("1 of 1 refunded")).toBeVisible();
  });
});
