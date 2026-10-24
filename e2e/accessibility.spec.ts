import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const MOCK = "http://localhost:3000";
const DEMO = "demo@radhefoods.de";

// Every kind of page is checked by axe against WCAG 2.2 A and AA and its
// best-practice rules, on a wide screen and on a phone. An automatic check
// finds roughly the mechanical half of all barriers (names, roles,
// contrast, structure); the keyboard tests below cover a part of the rest.

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__mock/reset`);
});

const PASSWORD = "Mangoes-in-May-2026";

/** Signs the browser in through the API; the account is created when new. */
async function signIn(page: Page, email = DEMO) {
  const created = await page.request.post(`${MOCK}/v1/store/auth/signup`, {
    data: { firstName: "Priya", lastName: "Shah", email, password: PASSWORD },
  });
  if (created.status() === 409) {
    await page.request.post(`${MOCK}/v1/store/auth/login`, {
      data: { email, password: PASSWORD },
    });
  }
}

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

/** Opens a page and waits until its headline is there. */
async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("public pages have no barriers axe can find", () => {
  for (const path of [
    "/en",
    "/de",
    "/en/products",
    "/de/produkte?q=reis&sort=price_asc",
    "/en/products?q=nothing-like-this",
    "/en/category/rice",
    "/en/products?brand=MDH&brand=Amul&sort=price_asc",
    "/de/produkte?brand=MDH&storageType=chilled",
    "/en/products/basmati-rice-5kg",
    "/de/produkte/basmati-reis-5kg",
    "/en/cart",
    "/en/wishlist",
    "/en/sign-in",
    "/de/anmelden",
    "/en/sign-up",
    "/de/registrieren",
    "/en/forgot-password",
    "/en/reset-password?token=0123456789abcdefghijklmnopqrstuvwxyzABCDEFG",
    "/de/reset-password",
    "/de/so-funktionierts",
    "/en/faq",
    "/de/blog",
    "/en/blog/the-perfect-dal",
    "/en/blog/category/recipes",
    "/en/blog/tag/spices",
    "/en/delivery-and-payment",
    "/en/legal/terms",
    "/de/rechtliches/impressum",
    "/en/legal/cookies",
    "/en/this-page-does-not-exist",
    "/en/styleguide",
  ]) {
    test(path, async ({ page }) => {
      await open(page, path);
      await expectNoBarriers(page);
    });
  }

  test.describe("on a first visit", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("with the cookie notice", async ({ page }) => {
      await open(page, "/en");
      await expect(
        page.getByRole("complementary", { name: "Cookie notice" }),
      ).toBeVisible();
      await expectNoBarriers(page);
    });
  });
});

test.describe("cart, checkout and account have no barriers axe can find", () => {
  test("the cart with products, and the checkout", async ({ page }) => {
    await signIn(page);
    await open(page, "/en/products");
    await page
      .getByRole("button", { name: "Add to cart: Chakki Atta (5kg)" })
      .click();
    await expect(
      page.getByRole("group", { name: "Quantity of Chakki Atta (5kg)" }),
    ).toBeVisible();
    await expectNoBarriers(page);

    // The wishlist with a saved product, as a customer.
    await page
      .getByRole("button", { name: "Save to wishlist: Chakki Atta (5kg)" })
      .click();
    await open(page, "/en/wishlist");
    await expect(
      page.getByRole("button", {
        name: "Remove from wishlist: Chakki Atta (5kg)",
      }),
    ).toBeVisible();
    await expectNoBarriers(page);

    await open(page, "/en/cart");
    await expect(
      page.getByRole("group", { name: "Quantity of Chakki Atta (5kg)" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    await expectNoBarriers(page);

    await open(page, "/en/checkout");
    await expect(page.getByRole("button", { name: "Buy now" })).toBeVisible();
    await expectNoBarriers(page);
  });

  for (const path of [
    "/en/account",
    "/en/account/orders",
    "/en/account/orders/RF-1086",
    "/en/account/orders/RF-1086?payment=cancelled",
    "/en/account/orders/RF-1090",
    "/de/konto/bestellungen/RF-1087",
    "/en/account/orders/RF-1085/return",
    "/en/account/invoices",
    "/en/account/addresses",
    "/en/account/profile",
  ]) {
    test(path, async ({ page }) => {
      await signIn(page);
      await open(page, path);
      // The account is read in the browser: wait for what the API answers.
      await expect(page.locator("[aria-busy='true']")).toHaveCount(0);
      await expectNoBarriers(page);
    });
  }
});

test.describe("with the keyboard", () => {
  test("the first stop is the link that skips to the content", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "A phone has no Tab key.");
    await open(page, "/en/products");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("a product gets into the cart and its quantity changes", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "A phone has no Tab key.");
    await open(page, "/en/products/basmati-rice-5kg");
    const add = page
      .getByRole("main")
      .getByRole("button", { name: "Add to cart: Basmati Rice (5kg)" })
      .first();
    await add.focus();
    await page.keyboard.press("Enter");
    const quantity = page
      .getByRole("group", { name: "Quantity of Basmati Rice (5kg)" })
      .first();
    await expect(quantity).toContainText("1");
    // The control that replaced the button can be reached and used.
    await quantity.getByRole("button", { name: "One more" }).focus();
    await page.keyboard.press("Enter");
    await expect(quantity).toContainText("2");
  });

  test("every focused control shows a visible outline", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "A phone has no Tab key.");
    await open(page, "/en");
    for (let stop = 0; stop < 12; stop += 1) {
      await page.keyboard.press("Tab");
      const outline = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element || element === document.body) return null;
        const style = getComputedStyle(element);
        return {
          name: `${element.tagName} ${element.textContent?.trim().slice(0, 30)}`,
          visible:
            style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0,
        };
      });
      expect(outline, `tab stop ${stop + 1}`).not.toBeNull();
      expect(outline?.visible, outline?.name).toBe(true);
    }
  });
});

test.describe("for people who asked for less motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("nothing on the page keeps moving", async ({ page }) => {
    await open(page, "/en/account/orders");
    const moving = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => {
          const timing = animation.effect?.getComputedTiming();
          return (
            timing !== undefined &&
            (timing.iterations === Infinity || Number(timing.duration) > 50)
          );
        })
        .map((animation) => String((animation as CSSAnimation).animationName)),
    );
    expect(moving).toEqual([]);
  });
});

test.describe("the filter panel", () => {
  test("the open brand list on a wide screen has no barriers", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the panel of wide screens");
    await open(page, "/en/products?brand=MDH");
    await page.getByText("Brand", { exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "MDH" })).toBeVisible();
    await expectNoBarriers(page);
  });

  test("the open sheet on a phone has no barriers", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phones only");
    await open(page, "/en/products?brand=MDH");
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
    await expectNoBarriers(page);
  });
});
