import { expect, test, type Page } from "@playwright/test";

const MOCK = "http://localhost:3000";
const DEMO = "demo@radhefoods.de";

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__mock/reset`);
});

async function signIn(page: Page, email = DEMO) {
  await page.request.post(`${MOCK}/v1/store/auth/otp/request`, {
    data: { email },
  });
  await page.request.post(`${MOCK}/v1/store/auth/otp/verify`, {
    data: { email, code: "123456" },
  });
}

test.describe("a change of the cart that fails", () => {
  test("is explained where the product was added, not only in the cart", async ({
    page,
  }) => {
    // A visitor's cart holds at most 100 different products.
    const full = Array.from({ length: 100 }, (_, index) => ({
      productId: index.toString(16).padStart(24, "a"),
      quantity: 1,
    }));
    await page.addInitScript((cart) => {
      window.localStorage.setItem("rf.cart.v1", JSON.stringify(cart));
    }, full);
    await page.goto("/en/products");
    await page
      .getByRole("button", { name: "Add to cart: Chakki Atta, 5 kg" })
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
      .getByRole("link", { name: "How pre-ordering works" })
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
    await expect(
      menu.getByRole("link", { name: "Rice", exact: true }),
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
    await menu.getByRole("link", { name: "Spices", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/category\/spices$/);
    await expect(menu).toHaveCount(0);
  });

  test("the tab bar shows that a customer is signed in", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "The tab bar exists on small screens only.");
    const bar = page.getByRole("navigation", { name: "Quick navigation" });
    const dot = bar.locator("span.bg-teal-600");

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
