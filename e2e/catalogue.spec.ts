import { expect, test, type Page } from "@playwright/test";

const MOCK = "http://localhost:3000";

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__mock/reset`);
});

function card(page: Page, name: string) {
  return page.getByRole("article").filter({ hasText: name });
}

test.describe("the pre-order is impossible to miss", () => {
  test("home says when to order, when it comes and that nothing is paid today", async ({
    page,
  }) => {
    await page.goto("/en");
    const strip = page.getByRole("region", { name: "Current pre-order" });
    await expect(strip).toContainText("Order by");
    await expect(strip).toContainText("Delivery");
    await expect(strip.getByRole("timer")).toHaveText(
      /Closes in \d+d \d{2}h \d{2}m/,
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "pay after delivery",
    );
    await expect(page.getByText("Nothing to pay today")).toBeVisible();
  });

  test("the same in German, with formal address", async ({ page }) => {
    await page.goto("/de");
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    const strip = page.getByRole("region", { name: "Aktuelle Vorbestellung" });
    await expect(strip).toContainText("Bestellschluss");
    await expect(strip.getByRole("timer")).toHaveText(
      /Noch \d+ T\. \d{2} Std\./,
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "nach der Lieferung bezahlen",
    );
    await expect(page.getByText("Heute zahlen Sie nichts")).toBeVisible();
  });

  test("a closed pre-order shows on a page that was cached while it was open", async ({
    page,
    request,
  }) => {
    await request.post(`${MOCK}/__mock/cargo`, { data: { mode: "closed" } });
    await page.goto("/en/products");
    await expect(
      page.getByRole("region", { name: "Current pre-order" }),
    ).toContainText("Ordering is closed right now.");
    const atta = card(page, "Chakki Atta");
    await expect(atta).toContainText("Ordering is closed right now");
    await expect(atta.getByRole("button", { name: /Add/ })).toHaveCount(0);
  });
});

test.describe("languages and addresses", () => {
  test("a product has one address per language, whatever slug was used", async ({
    page,
  }) => {
    // The English slug under the German address: goes to the German slug.
    await page.goto("/de/produkte/basmati-rice-5-kg");
    await expect(page).toHaveURL(/\/de\/produkte\/basmati-reis-5-kg$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Basmati-Reis",
    );
  });

  test("the language switch keeps the product", async ({ page }) => {
    await page.goto("/de/produkte/basmati-reis-5-kg");
    await page
      .getByRole("navigation", { name: "Sprache wechseln" })
      .getByRole("link", { name: "English" })
      .click();
    await expect(page).toHaveURL(/\/en\/products\/basmati-rice-5-kg$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Basmati Rice",
    );
  });

  test("an unknown address answers 404 in the language of the address", async ({
    page,
  }) => {
    const response = await page.goto("/de/gibt-es-nicht");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Seite nicht gefunden" }),
    ).toBeVisible();
  });

  test.describe("with a German browser", () => {
    test.use({ locale: "de-DE" });

    test("the start page and links from emails go to German", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/de$/);
      // The API's emails link products by their English slug, no language.
      await page.goto("/products/basmati-rice-5-kg");
      await expect(page).toHaveURL(/\/de\/produkte\/basmati-reis-5-kg$/);
    });
  });
});

test.describe("finding products", () => {
  test("search finds by word beginnings and says when nothing matches", async ({
    page,
  }) => {
    await page.goto("/en/products?q=dal");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Results for “dal”",
    );
    await expect(card(page, "Toor Dal")).toBeVisible();
    await expect(card(page, "Basmati Rice")).toHaveCount(0);

    await page.goto("/en/products?q=zzzz");
    await expect(
      page.getByRole("heading", { name: "Nothing found" }),
    ).toBeVisible();
  });

  test("a filter applies at once, lives in the address and can be reset", async ({
    page,
  }) => {
    await page.goto("/en/products");
    await expect(page.getByText("22 products")).toBeVisible();

    await page.getByLabel("Reduced only").check();
    await expect(page).toHaveURL(/onSale=1/);
    await expect(page.getByText("3 products")).toBeVisible();
    await expect(card(page, "Chakki Atta")).toHaveCount(0);

    await page.getByRole("link", { name: "Reset" }).click();
    await expect(page).not.toHaveURL(/onSale/);
    await expect(page.getByText("22 products")).toBeVisible();
    await expect(page.getByLabel("Reduced only")).not.toBeChecked();
  });

  test("a category lists its products and those of its sub-categories", async ({
    page,
  }) => {
    await page.goto("/en/category/spices");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Spices");
    await expect(card(page, "Garam Masala")).toBeVisible();
    await expect(card(page, "Cumin Seeds")).toBeVisible();
    await page
      .getByRole("navigation", { name: "In this category" })
      .getByRole("link", { name: "Masala Blends" })
      .click();
    await expect(page).toHaveURL(/\/en\/category\/masala-blends$/);
    await expect(card(page, "Cumin Seeds")).toHaveCount(0);
  });
});

test.describe("the cart of a visitor", () => {
  test("a product is added on its card, counted, and remembered", async ({
    page,
  }) => {
    await page.goto("/en/products");
    const atta = card(page, "Chakki Atta");
    await atta
      .getByRole("button", { name: "Add to cart: Chakki Atta, 5 kg" })
      .click();
    const quantity = atta.getByRole("group", {
      name: "Quantity of Chakki Atta, 5 kg",
    });
    await expect(quantity).toContainText("1");
    await quantity.getByRole("button", { name: "One more" }).click();
    await expect(quantity).toContainText("2");
    await expect(
      page.getByRole("link", { name: "Cart, 2 items" }).first(),
    ).toBeAttached();

    await page.reload();
    await expect(
      card(page, "Chakki Atta").getByRole("group", {
        name: "Quantity of Chakki Atta, 5 kg",
      }),
    ).toContainText("2");

    // At quantity one, "less" removes the product.
    const again = card(page, "Chakki Atta");
    await again.getByRole("button", { name: "One less" }).click();
    await again.getByRole("button", { name: "Remove from cart" }).click();
    await expect(
      again.getByRole("button", { name: "Add to cart: Chakki Atta, 5 kg" }),
    ).toBeVisible();
  });

  test("pack sizes switch on the card: price and product change", async ({
    page,
  }) => {
    await page.goto("/en/products");
    const rice = card(page, "Basmati Rice");
    await expect(rice).toContainText("€19.99");
    await rice.getByRole("button", { name: "1 kg" }).click();
    await expect(rice).toContainText("€5.99");
    await expect(rice).toContainText("€5.99 / kg");
    await rice
      .getByRole("button", { name: "Add to cart: Basmati Rice, 1 kg" })
      .click();
    await expect(
      rice.getByRole("group", { name: "Quantity of Basmati Rice, 1 kg" }),
    ).toBeVisible();
  });

  test("a product with a minimum quantity starts at the minimum", async ({
    page,
  }) => {
    await page.goto("/en/category/snacks");
    const khakhra = card(page, "Methi Khakhra");
    await khakhra
      .getByRole("button", { name: /Add to cart: Methi Khakhra/ })
      .click();
    await expect(
      khakhra.getByRole("group", { name: /Quantity of Methi Khakhra/ }),
    ).toContainText("2");
  });

  test("a sold-out product says so and cannot be added", async ({ page }) => {
    await page.goto("/en/category/fresh-fruit");
    const mango = card(page, "Kesar Mango");
    await expect(mango).toContainText("Sold out for this delivery");
    await expect(mango.getByRole("button", { name: /Add/ })).toHaveCount(0);
    await expect(card(page, "Alphonso Mango")).toContainText(
      "Not part of this delivery",
    );
  });

  test("the product page adds to the same cart and shows the limits", async ({
    page,
  }) => {
    await page.goto("/en/products/aloo-bhujia-400-g");
    await expect(page.getByText("At most 12 per order")).toBeVisible();
    await expect(page.getByText(/Order by .* and we deliver/)).toBeVisible();
    await page
      .getByRole("button", { name: "Add to cart: Aloo Bhujia, 400 g" })
      .filter({ visible: true })
      .first()
      .click();
    await expect(
      page.getByRole("link", { name: "Cart, 1 item" }).first(),
    ).toBeAttached();
  });
});
