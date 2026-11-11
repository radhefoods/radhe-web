import { expect, test, type Page } from "@playwright/test";
import { createAccount, MOCK } from "./helpers";

const DEMO = "demo@radhefoods.de";

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__mock/reset`);
});

/** Signs the browser in through the API; the account is created when new. */
async function signIn(page: Page, email = DEMO) {
  await createAccount(page.request, { email });
}

test.describe("a change of the cart that fails", () => {
  test("is explained where the product was added, not only in the cart", async ({
    page,
  }) => {
    // A visitor's cart holds at most 100 different pack sizes.
    const full = Array.from({ length: 100 }, (_, index) => ({
      variantId: index.toString(16).padStart(24, "a"),
      quantity: 1,
    }));
    await page.addInitScript((cart) => {
      window.localStorage.setItem("rf.cart.v2", JSON.stringify(cart));
    }, full);
    await page.goto("/en/products");
    // The count of the cart shows once the page is alive: only then a tap counts.
    await expect(page.getByRole("link", { name: /100 items/ })).toBeVisible();
    await page
      .getByRole("button", { name: "Add to cart: Chakki Atta (5kg)" })
      .click();
    const message = page.getByRole("alert").filter({ hasText: "cart is full" });
    await expect(message).toBeVisible();
    await message.getByRole("button", { name: "Close" }).click();
    await expect(message).toHaveCount(0);
  });
});

test.describe("while the next page is on its way", () => {
  test("a line at the top shows that the tap was understood", async ({
    page,
  }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // A slow connection: the next page takes a second.
    await page.route(/\/en\/how-it-works/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "How it works" })
      .click();
    await expect(page.locator(".nav-progress")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/how-it-works$/);
    await expect(page.locator(".nav-progress")).toHaveCount(0);
  });
});

test.describe("the cookie notice", () => {
  test("is part of the page the server sends, not added by scripts", async ({
    request,
  }) => {
    const html = await (await request.get("/en")).text();
    const markup = html.replace(/<script[\s\S]*?<\/script>/g, "");
    expect(markup).toContain("No tracking, no advertising.");
  });

  test("is never drawn for a visitor who has read it", async ({ page }) => {
    // The default state of these tests: the notice was read before.
    const seen: boolean[] = [];
    await page.exposeFunction("noticeSeen", (visible: boolean) => {
      seen.push(visible);
    });
    await page.addInitScript(() => {
      // Looks at every frame until the page has settled.
      const look = () => {
        const notice = document.querySelector(".cookie-notice");
        if (notice && getComputedStyle(notice).display !== "none") {
          void (
            window as unknown as { noticeSeen: (v: boolean) => void }
          ).noticeSeen(true);
        }
        requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(500);
    expect(seen).toEqual([]);
  });
});

test.describe("on a phone", () => {
  test("the menu opens, lists the categories, and gives focus back", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "The menu button exists on small screens only.");
    await page.goto("/en");
    const button = page.getByRole("button", { name: "Menu" });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    const menu = page.getByRole("dialog", { name: "Categories" });
    // The groups of the bar of wide screens, each naming its categories;
    // a category that is the only one of its group is a row of its own.
    const staples = menu.getByRole("button", { name: /^Rice, Flour & Dal/ });
    await expect(staples).toHaveAttribute("aria-expanded", "false");
    await expect(staples).toContainText(
      "Rice \u00b7 Flour \u00b7 Pulses & Lentils \u00b7 Ghee & Dairy",
    );
    await expect(
      menu.getByRole("link", { name: "Spices", exact: true }),
    ).toBeVisible();
    // While the panel is open, the page behind it is hidden from assistive
    // technology, the button included: look at the element itself.
    await expect(page.locator('button[aria-label="Menu"]')).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await menu.getByRole("button", { name: "Close" }).click();
    await expect(menu).toHaveCount(0);
    await expect(button).toBeFocused();

    await button.click();
    // Nothing but categories: no "all products", offers or "how it works".
    await expect(
      menu.getByRole("link", { name: /all products|offers|how it works/i }),
    ).toHaveCount(0);
    // A group folds out its categories, each with its sub-categories.
    const rice = menu.getByRole("link", { name: "Rice", exact: true });
    await expect(rice).toBeHidden();
    await staples.click();
    await expect(staples).toHaveAttribute("aria-expanded", "true");
    await expect(rice).toHaveAttribute("href", "/en/category/rice");
    await expect(rice).toBeVisible();
    await expect(
      menu
        .getByRole("list", { name: "Subcategories of Rice" })
        .getByRole("link", { name: "Basmati Rice" }),
    ).toBeVisible();
    await expect(
      menu.getByRole("link", { name: "Pulses & Lentils" }),
    ).toBeVisible();
    // A parent folds out its sub-categories; its own name leads to its page.
    const fold = menu.getByRole("button", { name: "Subcategories of Spices" });
    await expect(fold).toHaveAttribute("aria-expanded", "false");
    await expect(
      menu.getByRole("link", { name: "Masala Blends" }),
    ).toBeHidden();
    await fold.click();
    await expect(fold).toHaveAttribute("aria-expanded", "true");
    await menu.getByRole("link", { name: "Masala Blends" }).click();
    await expect(page).toHaveURL(/\/en\/category\/masala-blends$/);
    await expect(menu).toHaveCount(0);

    await page.getByRole("button", { name: "Menu" }).click();
    await menu.getByRole("link", { name: "Spices", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/category\/spices$/);
    await expect(menu).toHaveCount(0);

    // On the page of a category, its group is the open one.
    await page.goto("/en/category/basmati-rice");
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(staples).toHaveAttribute("aria-expanded", "true");
    await expect(
      menu.getByRole("link", { name: "Basmati Rice" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("the tab bar shows that a customer is signed in", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "The tab bar exists on small screens only.");
    const bar = page.getByRole("navigation", { name: "Quick navigation" });
    const dot = bar.locator("span.bg-leaf-600");

    await page.goto("/en");
    await expect(bar).toBeVisible();
    await expect(dot).toHaveCount(0);

    await signIn(page);
    await page.goto("/en/account");
    await expect(
      page.getByRole("heading", { level: 1, name: "Hello Priya" }),
    ).toBeVisible();
    await expect(dot).toHaveCount(1);
  });

  test("the header carries the heart of the wishlist for everyone and leads to it", async ({
    page,
  }) => {
    await page.goto("/en");
    const wishlist = page
      .getByRole("banner")
      .getByRole("link", { name: "Wishlist, empty" });
    await expect(wishlist).toBeVisible();
    await wishlist.click();
    await expect(page).toHaveURL(/\/en\/wishlist$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Your wishlist" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Nothing saved yet" }),
    ).toBeVisible();
  });
});

test.describe("the delivery fee", () => {
  test("is listed in steps that do not overlap, in German too", async ({
    page,
  }) => {
    await page.goto("/de/lieferung-und-zahlung");
    const fees = page.getByRole("table");
    await expect(fees).toContainText("unter 50,00 €");
    await expect(fees).toContainText("ab 50,00 €");
    await expect(fees).not.toContainText("ab 0,00 €");
  });
});
