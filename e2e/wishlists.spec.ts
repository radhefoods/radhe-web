import { expect, test, type Page } from "@playwright/test";
import { createAccount, MOCK } from "./helpers";

// Several wishlists of a customer (doc 16.2): the chooser, a new list,
// moving a product, making a list the default, renaming and deleting it.
// The demo account comes with "My Favourites" (two products) and "Diwali".

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

test.describe("the lists of a customer", () => {
  test("the chooser names the lists; a product moves to a new list, which becomes the default, is renamed and deleted", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/en/wishlist");
    await expect(
      page.getByRole("heading", { level: 1, name: "My Favourites" }),
    ).toBeVisible();
    const chooser = page.getByRole("navigation", { name: "Your lists" });
    await expect(chooser.getByRole("button", { name: /Diwali/ })).toBeVisible();
    await expect(page.getByText("2 products")).toBeVisible();

    // A new list.
    await chooser.getByRole("button", { name: "New list" }).click();
    const sheet = page.getByRole("dialog", { name: "New list" });
    await sheet.getByRole("button", { name: "Create" }).click();
    await expect(sheet.getByText("Please give the list a name.")).toBeVisible();
    await sheet.getByLabel("Name of the list").fill("Diwali");
    await sheet.getByRole("button", { name: "Create" }).click();
    await expect(
      sheet.getByText("You already have a list with this name."),
    ).toBeVisible();
    await sheet.getByLabel("Name of the list").fill("Weekend");
    await sheet.getByRole("button", { name: "Create" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Weekend" }),
    ).toBeVisible();
    await expect(page.getByText("Nothing saved yet")).toBeVisible();

    // A product moves from the favourites to it.
    await chooser.getByRole("button", { name: /My Favourites/ }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "My Favourites" }),
    ).toBeVisible();
    await page
      .getByLabel("Move Basmati Rice (5kg) to another list")
      .selectOption({ label: "Weekend" });
    await expect(page.getByText("1 product", { exact: true })).toBeVisible();
    await chooser.getByRole("button", { name: /Weekend/ }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: /Basmati Rice/ }),
    ).toBeVisible();

    // The default moves with the star; the heart now means this list.
    await page.getByRole("button", { name: "Make default" }).click();
    await expect(
      chooser.getByRole("button", { name: /Weekend/ }).getByLabel("Default"),
    ).toBeVisible();
    await expect(
      page.getByText("The heart on a product saves to this list."),
    ).toBeVisible();

    // Renamed, then deleted with a second tap: back to the default.
    await page.getByRole("button", { name: "Rename" }).click();
    const rename = page.getByRole("dialog", { name: "Rename the list" });
    await rename.getByLabel("Name of the list").fill("Family");
    await rename.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Family" }),
    ).toBeVisible();
    await chooser.getByRole("button", { name: /Diwali/ }).click();
    await page.getByRole("button", { name: "Delete list" }).click();
    await page
      .getByRole("dialog", { name: 'Delete the list "Diwali"?' })
      .getByRole("button", { name: "Yes, delete" })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Family" }),
    ).toBeVisible();
    await expect(chooser.getByRole("button", { name: /Diwali/ })).toHaveCount(
      0,
    );
  });
});
