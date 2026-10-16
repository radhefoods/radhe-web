import { expect, test, type Page } from "@playwright/test";

const MOCK = "http://localhost:3000";

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__mock/reset`);
});

function card(page: Page, name: string) {
  return page.getByRole("article").filter({ hasText: name });
}

/** The id of the pack size a product page stands for (doc 7). */
async function variantIdOf(page: Page, slug: string): Promise<string> {
  const response = await page.request.get(`${MOCK}/v1/store/products/${slug}`);
  return (await response.json()).product.variantId;
}

test.describe("the category navigation", () => {
  test("the bar lists the categories; a parent opens its sub-categories on hover and by keyboard", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "The bar exists on wide screens only.");
    await page.goto("/en");
    const nav = page.getByRole("navigation", { name: "Categories" });
    await expect(
      nav.getByRole("link", { name: "Rice", exact: true }),
    ).toHaveAttribute("href", "/en/category/rice");
    // Nothing but the categories of the API.
    await expect(
      nav.getByRole("link", { name: /offers|how it works|all categories/i }),
    ).toHaveCount(0);
    const chevron = nav.getByRole("button", {
      name: "Subcategories of Spices",
    });
    await expect(chevron).toHaveAttribute("aria-expanded", "false");
    const wholeSpices = nav.getByRole("link", { name: "Whole Spices" });
    await expect(wholeSpices).toBeHidden();

    // Resting on the item opens the panel; moving down into it keeps it.
    await nav.getByRole("link", { name: "Spices", exact: true }).hover();
    await expect(wholeSpices).toBeVisible();
    await wholeSpices.hover();
    await expect(wholeSpices).toBeVisible();
    await wholeSpices.click();
    await expect(page).toHaveURL(/\/en\/category\/whole-spices$/);
    await expect(
      nav.getByRole("link", { name: "Spices", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Whole Spices" })).toBeHidden();

    // By keyboard: the chevron opens, Escape closes and keeps the focus.
    await page.mouse.move(0, 0);
    await chevron.focus();
    await page.keyboard.press("Enter");
    await expect(chevron).toHaveAttribute("aria-expanded", "true");
    await expect(
      nav.getByRole("link", { name: "Masala Blends" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(chevron).toHaveAttribute("aria-expanded", "false");
    await expect(chevron).toBeFocused();
  });
});

test.describe("the shop at a glance", () => {
  test("home says what the shop promises, in both languages", async ({
    page,
  }) => {
    await page.goto("/en");
    // The ticket in the hero: delivery, payment and returns from the settings.
    const card = page.getByRole("region", {
      name: "Delivery and payment at a glance",
    });
    await expect(card).toContainText("In stock now");
    await expect(card).toContainText("2 to 4 working days to your door.");
    await expect(card).toContainText("€4.99");
    await expect(card).toContainText("€50.00");
    await expect(card).toContainText("14");
    await expect(card).toContainText("Card or PayPal, at checkout");
    await expect(card).toContainText("Secure checkout");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "From our shelf to your door",
    );
    await expect(page.getByRole("link", { name: "Shop now" })).toBeVisible();
    // Popular products first, then a row per category with "See all"; no
    // offers section and no category tiles any more (owner, 2026-10-16).
    const popular = page.getByRole("region", { name: "Popular right now" });
    await expect(popular.getByRole("article").first()).toBeVisible();
    await expect(
      popular.getByRole("link", { name: "See all products" }),
    ).toHaveAttribute("href", "/en/products");
    const rice = page.getByRole("region", { name: "Rice", exact: true });
    await expect(rice.getByRole("article")).toHaveCount(3);
    await expect(
      rice.getByRole("link", { name: "See all Rice" }),
    ).toHaveAttribute("href", "/en/category/rice");
    await expect(page.getByRole("heading", { name: "Offers" })).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Shop by category" }),
    ).toHaveCount(0);

    await page.goto("/de");
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    const karte = page.getByRole("region", {
      name: "Lieferung und Zahlung auf einen Blick",
    });
    await expect(karte).toContainText("2 bis 4 Werktage bis vor Ihre Tür.");
    await expect(karte).toContainText("Sicher bezahlen");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Von unserem Regal bis vor Ihre Tür",
    );
    await expect(
      page.getByRole("region", { name: "Gerade beliebt" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Reis", exact: true })
        .getByRole("link", {
          name: "Alle in Reis ansehen",
        }),
    ).toHaveAttribute("href", "/de/kategorie/reis");
  });

  test("a product row turns by its arrows on wide screens", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "The arrows exist from medium screens on.");
    // Three cards per page at this width; "Spices" has four products.
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto("/en");
    const spices = page.getByRole("region", { name: "Spices", exact: true });
    await expect(spices.getByRole("article")).toHaveCount(4);
    const back = spices.getByRole("button", { name: "Scroll back" });
    const forward = spices.getByRole("button", { name: "Scroll forward" });
    await expect(back).toBeDisabled();
    await expect(forward).toBeEnabled();
    await forward.click();
    await expect(back).toBeEnabled();
    await expect(forward).toBeDisabled();
    await back.click();
    await expect(back).toBeDisabled();
    await expect(forward).toBeEnabled();
  });

  test("a sold-out product says so; few units left are counted", async ({
    page,
  }) => {
    await page.goto("/en/products");
    const mango = card(page, "Kesar Mango");
    await expect(mango).toContainText("Sold out");
    await expect(mango.getByRole("button", { name: /Add/ })).toHaveCount(0);
    const khakhra = card(page, "Methi Khakhra");
    await expect(khakhra).toContainText("Only 8 left");
    await expect(
      khakhra.getByRole("button", { name: /Add to cart: Methi Khakhra/ }),
    ).toBeVisible();
  });

  test("stock that ran out shows on a product page that was cached before", async ({
    page,
    request,
  }) => {
    await page.goto("/en/products/chakki-atta-5kg");
    await expect(
      page
        .getByRole("main")
        .getByRole("button", { name: "Add to cart: Chakki Atta (5 kg)" })
        .first(),
    ).toBeVisible();
    await request.post(`${MOCK}/__mock/stock`, {
      data: {
        variantId: await variantIdOf(page, "chakki-atta-5kg"),
        quantity: 0,
      },
    });
    // The page is cached for minutes; the buying part asks the API again.
    await page.reload();
    await expect(
      page.getByRole("main").getByText("Sold out").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to cart: Chakki Atta (5 kg)" }),
    ).toHaveCount(0);
  });
});

test.describe("languages and addresses", () => {
  test("a pack size has one address per language, whatever slug was used", async ({
    page,
  }) => {
    // The English slug under the German address: goes to the German slug.
    await page.goto("/de/produkte/basmati-rice-5kg");
    await expect(page).toHaveURL(/\/de\/produkte\/basmati-reis-5kg$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Basmati-Reis (5 kg)",
    );
    // The base slug of the product opens its default size.
    await page.goto("/en/products/basmati-rice");
    await expect(page).toHaveURL(/\/en\/products\/basmati-rice-1kg$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Basmati Rice (1 kg)",
    );
  });

  test("the language switch keeps the product and its size", async ({
    page,
  }) => {
    await page.goto("/de/produkte/basmati-reis-5kg");
    const toEnglish = page
      .getByRole("navigation", { name: "Sprache wechseln" })
      .getByRole("link", { name: "English" });
    await toEnglish.click();
    await expect(page).toHaveURL(/\/en\/products\/basmati-rice-5kg$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Basmati Rice (5 kg)",
    );

    // A size chosen on the page is kept too.
    await page.goto("/de/produkte/basmati-reis-5kg");
    await page.getByRole("link", { name: "1 kg" }).click();
    await expect(page).toHaveURL(/\/de\/produkte\/basmati-reis-1kg$/);
    await toEnglish.click();
    await expect(page).toHaveURL(/\/en\/products\/basmati-rice-1kg$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Basmati Rice (1 kg)",
    );
  });

  test("pack sizes switch on the product page in place: headline, price, address", async ({
    page,
  }) => {
    await page.goto("/en/products/basmati-rice-1kg");
    const heading = page.getByRole("heading", { level: 1 });
    const main = page.getByRole("main");
    await expect(heading).toHaveText("Basmati Rice (1 kg)");
    await expect(main.getByText("€5.99 / kg").first()).toBeVisible();
    await expect(main.getByText("RF-00041")).toBeVisible();
    // A mark that only a page that was not reloaded still carries.
    await page.evaluate(() => {
      (window as unknown as { stayed: boolean }).stayed = true;
    });

    await page.getByRole("link", { name: "5 kg" }).click();
    await expect(heading).toHaveText("Basmati Rice (5 kg)");
    await expect(page).toHaveURL(/\/en\/products\/basmati-rice-5kg$/);
    await expect(page).toHaveTitle(/^Basmati Rice \(5 kg\)/);
    await expect(main.getByText("€19.99").first()).toBeVisible();
    await expect(main.getByText("€4.00 / kg").first()).toBeVisible();
    await expect(main.getByText("RF-00042")).toBeVisible();
    await expect(page.getByRole("link", { name: "5 kg" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      main
        .getByRole("button", { name: "Add to cart: Basmati Rice (5 kg)" })
        .first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as unknown as { stayed: boolean }).stayed,
      ),
    ).toBe(true);

    // Back leads to the size from before, still on the same page.
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/products\/basmati-rice-1kg$/);
    await expect(heading).toHaveText("Basmati Rice (1 kg)");
    expect(
      await page.evaluate(
        () => (window as unknown as { stayed: boolean }).stayed,
      ),
    ).toBe(true);
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
      await page.goto("/products/basmati-rice-5kg");
      await expect(page).toHaveURL(/\/de\/produkte\/basmati-reis-5kg$/);
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

  test("filters apply at once, live in the address and come off one by one", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the panel of wide screens");
    await page.goto("/en/products");
    await expect(page.getByText("22 products")).toBeVisible();

    // Two brands are "any of them"; the counts say what each would leave.
    await page.getByText("Brand", { exact: true }).click();
    await page.getByLabel("MDH").check();
    await expect(page).toHaveURL(/brand=MDH/);
    await expect(page.getByText("3 products")).toBeVisible();
    await expect(page.getByLabel("Amul")).toBeEnabled();
    await page.getByLabel("Amul").check();
    await expect(page).toHaveURL(/brand=MDH&brand=Amul/);
    await expect(page.getByText("4 products")).toBeVisible();
    await expect(card(page, "Pure Ghee")).toBeVisible();
    await expect(card(page, "Basmati Rice")).toHaveCount(0);
    // The one that was ticked keeps the focus.
    await expect(page.getByRole("checkbox", { name: "Amul" })).toBeFocused();

    // The chips take one filter off each (the open list lies over them).
    await page.keyboard.press("Escape");
    const applied = page.getByRole("list", { name: "Applied filters" });
    await expect(applied.getByRole("link")).toHaveText([
      "MDH",
      "Amul",
      "Clear all filters",
    ]);
    await applied.getByRole("link", { name: "Remove filter: Amul" }).click();
    await expect(page).toHaveURL(/brand=MDH$/);
    await expect(page.getByText("3 products")).toBeVisible();

    await applied.getByRole("link", { name: "Clear all filters" }).click();
    await expect(page).toHaveURL(/\/en\/products$/);
    await expect(page.getByText("22 products")).toBeVisible();
  });

  test("the offers switch narrows the list and the sorting reorders it", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the panel of wide screens");
    await page.goto("/en/products");
    await page.getByLabel("Offers").check();
    await expect(page).toHaveURL(/onSale=1/);
    await expect(page.getByText("3 products")).toBeVisible();
    await page.getByText(/^Sort by:/).click();
    await page.getByLabel("Price: low to high").check();
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(
      page.getByRole("article").getByRole("heading", { level: 2 }),
    ).toHaveText([
      "Chana Dal (1 kg)",
      "Basmati Rice (1 kg)",
      "Pure Ghee (500 ml)",
    ]);
  });

  test("when nothing is left, the page says which filter to drop", async ({
    page,
  }) => {
    await page.goto("/en/products?brand=MDH&storageType=chilled");
    await expect(
      page.getByRole("heading", { name: "No products match" }),
    ).toBeVisible();
    await page
      .getByRole("link", {
        name: "Remove \u201cChilled\u201d to see 3 products",
      })
      .click();
    await expect(page).toHaveURL(/\/en\/products\?brand=MDH$/);
    await expect(page.getByText("3 products")).toBeVisible();
  });

  test("a list shows only the filters its products support, in German too", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the panel of wide screens");
    await page.goto("/de/kategorie/gewuerze");
    const list = page.getByRole("region", { name: "Gew\u00fcrze" });
    await expect(list.getByText("Marke", { exact: true })).toBeVisible();
    // One storage type, no offers: nothing to choose.
    await expect(list.getByText("Lagerung", { exact: true })).toHaveCount(0);
    await expect(list.getByText("Angebote", { exact: true })).toHaveCount(0);
    await list.getByText("Packungsgr\u00f6\u00dfe", { exact: true }).click();
    await page.getByLabel("400 g").check();
    await expect(page).toHaveURL(/packSize=400g/);
    await expect(page.getByText("2 Produkte")).toBeVisible();
    // The matching size stands for its product.
    await expect(
      card(page, "Kurkuma, gemahlen").getByRole("button", {
        name: "400 g",
        pressed: true,
      }),
    ).toBeVisible();
  });

  test("on a phone the filters live in a sheet that counts as you choose", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phones only");
    await page.goto("/en/products");
    await page.getByRole("button", { name: "Filters" }).click();
    const sheet = page.getByRole("dialog", { name: "Filters" });
    await expect(
      sheet.getByRole("button", { name: "Show 22 products" }),
    ).toBeVisible();
    await sheet.getByLabel("MDH").check();
    await expect(page).toHaveURL(/brand=MDH/);
    await sheet.getByRole("button", { name: "Show 3 products" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: "Filters 1" })).toBeFocused();
    await expect(
      page
        .getByRole("list", { name: "Applied filters" })
        .getByRole("link", { name: "Remove filter: MDH" }),
    ).toBeVisible();
    await expect(card(page, "Garam Masala")).toBeVisible();
    await expect(card(page, "Basmati Rice")).toHaveCount(0);
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
      .getByRole("button", { name: "Add to cart: Chakki Atta (5 kg)" })
      .click();
    const quantity = atta.getByRole("group", {
      name: "Quantity of Chakki Atta (5 kg)",
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
        name: "Quantity of Chakki Atta (5 kg)",
      }),
    ).toContainText("2");

    // At quantity one, "less" removes the product.
    const again = card(page, "Chakki Atta");
    await again.getByRole("button", { name: "One less" }).click();
    await again.getByRole("button", { name: "Remove from cart" }).click();
    await expect(
      again.getByRole("button", { name: "Add to cart: Chakki Atta (5 kg)" }),
    ).toBeVisible();
  });

  test("a card shows one size: the name, the price, the price per unit, add", async ({
    page,
  }) => {
    await page.goto("/en/products");
    const rice = card(page, "Basmati Rice");
    // The smallest size in stock stands for the product; its name links to
    // the page of that size.
    const heading = rice.getByRole("heading");
    await expect(heading).toHaveText("Basmati Rice (1 kg)");
    await expect(heading.getByRole("link")).toHaveAttribute(
      "href",
      "/en/products/basmati-rice-1kg",
    );
    // The name first, then the price, then the price per kilogram under it.
    expect(await rice.innerText()).toMatch(
      /Basmati Rice \(1 kg\)\s+€5\.99\s+€5\.99 \/ kg/,
    );
    // Nothing else: the sizes are chosen on the product page, and the card
    // does not say "in stock" or name the brand.
    await expect(rice.getByRole("button", { name: "5 kg" })).toHaveCount(0);
    await expect(rice).not.toContainText("In stock");
    await expect(rice).not.toContainText(/radhe/i);
    await rice
      .getByRole("button", { name: "Add to cart: Basmati Rice (1 kg)" })
      .click();
    await expect(
      rice.getByRole("group", { name: "Quantity of Basmati Rice (1 kg)" }),
    ).toBeVisible();
    // The picture flew to the one cart pill on screen: the header's, or on
    // phones the cart tab.
    await expect(page.locator("[data-cart-target]:visible")).toHaveCount(1);
  });

  test("a product without a picture shows the Radhe mark instead", async ({
    page,
  }) => {
    await page.goto("/en/category/pulses-and-lentils");
    const dal = card(page, "Moong Dal");
    await expect(dal.locator('img[src*="radhe-logo"]')).toBeVisible();
    await expect(dal).toContainText("coming soon");
    // The product page too, in both languages.
    await dal.getByRole("heading").getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Moong Dal (1 kg)",
    );
    const main = page.getByRole("main");
    await expect(main.locator('img[src*="radhe-logo"]').first()).toBeVisible();
    await expect(main).toContainText("coming soon");
    await page.goto("/de/produkte/moong-dal-1kg");
    await expect(page.getByRole("main")).toContainText("Bild folgt in Kürze");
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
    await expect(mango).toContainText("Sold out");
    await expect(mango.getByRole("button", { name: /Add/ })).toHaveCount(0);
    await expect(card(page, "Alphonso Mango")).toContainText(
      "Currently not available",
    );
  });

  test("the product page adds to the same cart and shows the limits", async ({
    page,
  }) => {
    await page.goto("/en/products/aloo-bhujia-400g");
    await expect(page.getByText("At most 12 per order")).toBeVisible();
    await page
      .getByRole("button", { name: "Add to cart: Aloo Bhujia (400 g)" })
      .filter({ visible: true })
      .first()
      .click();
    await expect(
      page.getByRole("link", { name: "Cart, 1 item" }).first(),
    ).toBeAttached();
  });
});
