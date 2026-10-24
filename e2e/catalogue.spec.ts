import { expect, test, type Page } from "@playwright/test";

const MOCK = "http://localhost:3000";
const PASSWORD = "Mangoes-in-May-2026";

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
  test("without a live banner the home page says what the shop promises, in both languages", async ({
    page,
    request,
  }) => {
    await request.post(`${MOCK}/__mock/banners`, {
      data: { enabled: false },
    });
    await page.goto("/en");
    // No carousel at all; the woven band with its ticket stands in.
    await expect(
      page.getByRole("region", { name: "Offers and news" }),
    ).toHaveCount(0);
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
    // The categories first (owner, 2026-10-24): a row of cards, each one
    // link to its category, "See all" leading to the page of all categories.
    const categories = page.getByRole("region", {
      name: "Popular categories",
    });
    await expect(
      categories.getByRole("link", { name: /^Rice/ }),
    ).toHaveAttribute("href", "/en/category/rice");
    await expect(
      categories.getByRole("link", { name: /^Flour/ }),
    ).toBeVisible();
    await expect(
      categories.getByRole("link", { name: "See all categories" }),
    ).toHaveAttribute("href", "/en/categories");
    // Then the popular products and a row per category with "See all"; no
    // offers section (owner, 2026-10-16).
    const popular = page.getByRole("region", { name: "Popular right now" });
    await expect(popular.getByRole("article").first()).toBeVisible();
    await expect(
      popular.getByRole("link", { name: "See all products" }),
    ).toHaveAttribute("href", "/en/products");
    // A row holds one card per pack size in rounds (doc PRODUCT_DISPLAY_ORDER):
    // the three rice products have five sizes between them.
    const rice = page.getByRole("region", { name: "Rice", exact: true });
    await expect(rice.getByRole("article")).toHaveCount(5);
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

  test("the home page opens with the banners of the admin as its hero, each in its own ratio, linked as the API says", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/en");
    const carousel = page.getByRole("region", { name: "Offers and news" });
    const slides = carousel.getByRole("group");
    await expect(slides).toHaveCount(4);
    // The carousel took the place of the woven band (owner, 2026-10-19).
    await expect(page.getByRole("link", { name: "Shop now" })).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Delivery and payment at a glance" }),
    ).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Indian groceries, delivered across Germany",
    );
    await expect(
      page.getByRole("region", { name: "Popular right now" }),
    ).toBeVisible();
    // The ratio of the upload, from the API; never a fixed height.
    const first = slides.first();
    await expect(first.locator("[style*='aspect-ratio']")).toHaveAttribute(
      "style",
      /aspect-ratio: 2400 \/ 1000/,
    );
    await expect(
      slides.nth(3).locator("[style*='aspect-ratio']"),
    ).toHaveAttribute("style", /aspect-ratio: 1800 \/ 750/);
    await expect(first.getByRole("img")).toHaveAttribute(
      "srcset",
      /768w.*1536w.*2400w/,
    );
    // A path of the shop navigates in the shop; an address opens a new tab.
    await expect(first.getByRole("link")).toHaveAttribute(
      "href",
      "/en/category/snacks",
    );
    // Slides that are not shown are inert: look at the elements themselves.
    await expect(slides.nth(1).locator("a")).toHaveAttribute(
      "href",
      "/en/products/basmati-rice-1kg",
    );
    const external = slides.nth(2).locator("a");
    await expect(external).toHaveAttribute("target", "_blank");
    await expect(external).toHaveAttribute("rel", /noopener/);
    await expect(slides.nth(3).locator("a")).toHaveCount(0);
    // The dots turn it; the arrows exist on wide screens.
    await carousel.getByRole("button", { name: "Go to slide 4" }).click();
    await expect(
      carousel.getByRole("button", { name: "Go to slide 4" }),
    ).toHaveAttribute("aria-current", "true");
    // No arrows and no pause button: the dots, a swipe or a mouse drag
    // (owner, 2026-10-19). A drag turns the slide and is not a click.
    await expect(carousel.getByRole("button", { name: /slide/ })).toHaveCount(
      4,
    );
    if (!isMobile) {
      await carousel.getByRole("button", { name: "Go to slide 1" }).click();
      await expect(
        carousel.getByRole("button", { name: "Go to slide 1" }),
      ).toHaveAttribute("aria-current", "true");
      const box = (await slides.first().boundingBox())!;
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width * 0.7, y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.5, y, { steps: 8 });
      await page.mouse.move(box.x + box.width * 0.3, y, { steps: 8 });
      await page.mouse.up();
      await expect(
        carousel.getByRole("button", { name: "Go to slide 2" }),
      ).toHaveAttribute("aria-current", "true");
      await expect(page).toHaveURL(/\/en$/);
    }
  });

  test("a product row turns by its arrows on wide screens", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "The arrows exist from medium screens on.");
    // Three cards per page at this width; "Spices" has four products with
    // six pack sizes, so six cards.
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto("/en");
    const spices = page.getByRole("region", { name: "Spices", exact: true });
    await expect(spices.getByRole("article")).toHaveCount(6);
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
        .getByRole("button", { name: "Add to cart: Chakki Atta (5kg)" })
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
      page.getByRole("button", { name: "Add to cart: Chakki Atta (5kg)" }),
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
      "Basmati-Reis (5kg)",
    );
    // The base slug of the product opens its default size.
    await page.goto("/en/products/basmati-rice");
    await expect(page).toHaveURL(/\/en\/products\/basmati-rice-1kg$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Basmati Rice (1kg)",
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
      "Basmati Rice (5kg)",
    );

    // A size chosen on the page is kept too.
    await page.goto("/de/produkte/basmati-reis-5kg");
    await page.getByRole("link", { name: "1kg" }).click();
    await expect(page).toHaveURL(/\/de\/produkte\/basmati-reis-1kg$/);
    await toEnglish.click();
    await expect(page).toHaveURL(/\/en\/products\/basmati-rice-1kg$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Basmati Rice (1kg)",
    );
  });

  test("pack sizes switch on the product page in place: headline, price, address", async ({
    page,
  }) => {
    await page.goto("/en/products/basmati-rice-1kg");
    const heading = page.getByRole("heading", { level: 1 });
    const main = page.getByRole("main");
    await expect(heading).toHaveText("Basmati Rice (1kg)");
    await expect(main.getByText("€5.99 / kg").first()).toBeVisible();
    await expect(main.getByText("RF-00041")).toBeVisible();
    // A mark that only a page that was not reloaded still carries.
    await page.evaluate(() => {
      (window as unknown as { stayed: boolean }).stayed = true;
    });

    await page.getByRole("link", { name: "5kg" }).click();
    await expect(heading).toHaveText("Basmati Rice (5kg)");
    await expect(page).toHaveURL(/\/en\/products\/basmati-rice-5kg$/);
    await expect(page).toHaveTitle(/^Basmati Rice \(5 kg\)/);
    await expect(main.getByText("€19.99").first()).toBeVisible();
    await expect(main.getByText("€4.00 / kg").first()).toBeVisible();
    await expect(main.getByText("RF-00042")).toBeVisible();
    await expect(page.getByRole("link", { name: "5kg" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      main
        .getByRole("button", { name: "Add to cart: Basmati Rice (5kg)" })
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
    await expect(heading).toHaveText("Basmati Rice (1kg)");
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
    // A search shows every size of a matching product as a card of its own.
    await expect(card(page, "Toor Dal (1kg)")).toBeVisible();
    await expect(card(page, "Toor Dal (2kg)")).toBeVisible();
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
    await expect(card(page, "Pure Ghee (500ml)")).toBeVisible();
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
      // The reduced sizes themselves, cheapest first (not the default sizes
      // of their products).
      "Chana Dal (1kg)",
      "Pure Ghee (1l)",
      "Basmati Rice (5kg)",
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
    await page.getByLabel("400g").check();
    await expect(page).toHaveURL(/packSize=400g/);
    await expect(page.getByText("2 Produkte")).toBeVisible();
    // The matching size stands for its product.
    await expect(
      card(page, "Kurkuma, gemahlen").getByRole("heading"),
    ).toContainText("(400g)");
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
    // The count names products; the cards are the pack sizes (one per
    // size in rounds, the way the category is set in the admin).
    await expect(page.getByText("4 products")).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(6);
    await expect(card(page, "Garam Masala")).toBeVisible();
    await expect(card(page, "Cumin Seeds (100g)")).toBeVisible();
    await expect(card(page, "Cumin Seeds (400g)")).toBeVisible();
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
    const atta = card(page, "Chakki Atta (5kg)");
    await atta
      .getByRole("button", { name: "Add to cart: Chakki Atta (5kg)" })
      .click();
    const quantity = atta.getByRole("group", {
      name: "Quantity of Chakki Atta (5kg)",
    });
    await expect(quantity).toContainText("1");
    await quantity.getByRole("button", { name: "One more" }).click();
    await expect(quantity).toContainText("2");
    await expect(
      page.getByRole("link", { name: "Cart, 2 items" }).first(),
    ).toBeAttached();

    await page.reload();
    await expect(
      card(page, "Chakki Atta (5kg)").getByRole("group", {
        name: "Quantity of Chakki Atta (5kg)",
      }),
    ).toContainText("2");

    // At quantity one, "less" removes the product.
    const again = card(page, "Chakki Atta (5kg)");
    await again.getByRole("button", { name: "One less" }).click();
    await again.getByRole("button", { name: "Remove from cart" }).click();
    await expect(
      again.getByRole("button", { name: "Add to cart: Chakki Atta (5kg)" }),
    ).toBeVisible();
  });

  test("a card shows one size: the brand, the name, the price, the price per unit, add", async ({
    page,
  }) => {
    await page.goto("/en/products");
    const rice = card(page, "Basmati Rice (1kg)");
    // Each size is a card of its own here; its name links to the page of
    // that size.
    const heading = rice.getByRole("heading");
    await expect(heading).toHaveText("Basmati Rice (1kg)");
    await expect(heading.getByRole("link")).toHaveAttribute(
      "href",
      "/en/products/basmati-rice-1kg",
    );
    // The brand over the name (owner, 2026-10-19), then the price, then
    // the price per kilogram under it.
    expect(await rice.innerText()).toMatch(
      /India Gate\s+Basmati Rice \(1kg\)\s+€5\.99\s+€5\.99 \/ kg/,
    );
    // Nothing else: the sizes are chosen on the product page, and the card
    // does not say "in stock".
    await expect(rice.getByRole("button", { name: "5kg" })).toHaveCount(0);
    await expect(rice).not.toContainText("In stock");
    await expect(rice).not.toContainText(/radhe/i);
    // No card says how its product is kept (owner, 2026-10-18).
    await expect(page.getByRole("article")).not.toHaveCount(0);
    await expect(
      page.getByRole("article").filter({ hasText: /Chilled|Frozen/ }),
    ).toHaveCount(0);
    await rice
      .getByRole("button", { name: "Add to cart: Basmati Rice (1kg)" })
      .click();
    await expect(
      rice.getByRole("group", { name: "Quantity of Basmati Rice (1kg)" }),
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
      "Moong Dal / Green Gram (1kg)",
    );
    const main = page.getByRole("main");
    await expect(main.locator('img[src*="radhe-logo"]').first()).toBeVisible();
    await expect(main).toContainText("coming soon");
    await page.goto("/de/produkte/moong-dal-1kg");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Moong Dal / Mungbohnen (1kg)",
    );
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

  test("the product page: stock chip, limits, accordions, more from the category, the categories", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/en/products/aloo-bhujia-400g");
    const main = page.getByRole("main");
    // Under the button: the stock and the delivery estimate of the settings.
    await expect(main.getByText("In stock", { exact: true })).toBeVisible();
    await expect(main.getByText("2 to 4 working days")).toBeVisible();
    await expect(page.getByText("At most 12 per order")).toBeVisible();

    // Delivery and payment, from the settings, with the accepted methods;
    // no return policy here (owner, 2026-10-22), it stays on the full page.
    const info = page.getByRole("region", { name: "Delivery and payment" });
    await expect(info).toContainText("Delivery €4.99 per order");
    await expect(info).toContainText("Free from €50.00");
    await expect(info).not.toContainText("days to return");
    const methods = info.getByRole("list", {
      name: "Accepted payment methods",
    });
    for (const name of ["Visa", "Mastercard", "American Express", "PayPal"]) {
      await expect(methods.getByRole("img", { name })).toBeVisible();
    }

    // The details fold out on a tap.
    const details = main.getByText("Product details", { exact: true });
    await expect(main.getByText("Item number")).toBeHidden();
    await details.click();
    await expect(main.getByText("Item number")).toBeVisible();

    // More from the category, as a row with the way to the whole category;
    // then the categories of the shop.
    const related = page.getByRole("region", { name: /^More from / });
    await expect(related.getByRole("article").first()).toBeVisible();
    await expect(
      related.getByRole("link", { name: /^View all / }),
    ).toHaveAttribute("href", /\/en\/category\//);
    const categories = page.getByRole("region", { name: "Shop by category" });
    await expect(
      categories.getByRole("link", { name: /Rice/ }).first(),
    ).toHaveAttribute("href", "/en/category/rice");
    if (!isMobile) {
      await expect(
        categories.getByRole("link", { name: "All products" }),
      ).toHaveAttribute("href", "/en/products");
    }

    // "About this product" is closed at first and opens on a tap.
    await page.goto("/en/products/basmati-rice-1kg");
    const about = page.getByRole("main").getByText("Biryani");
    await expect(about).toBeHidden();
    await page
      .getByRole("main")
      .getByText("About this product", { exact: true })
      .click();
    await expect(about).toBeVisible();
    await page
      .getByRole("button", { name: "Add to cart: Aloo Bhujia (400g)" })
      .filter({ visible: true })
      .first()
      .click();
    await expect(
      page.getByRole("link", { name: "Cart, 1 item" }).first(),
    ).toBeAttached();
  });
});

test.describe("the wishlist", () => {
  test("a visitor saves a product with the heart, sees it counted and on the wishlist page, and takes it off again", async ({
    page,
  }) => {
    await page.goto("/en/products");
    const rice = card(page, "Basmati Rice (1kg)");
    await rice
      .getByRole("button", { name: "Save to wishlist: Basmati Rice (1kg)" })
      .click();
    await expect(
      rice.getByRole("button", {
        name: "Remove from wishlist: Basmati Rice (1kg)",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    const heart = page.getByRole("link", { name: "Wishlist, 1 product" });
    await expect(heart).toBeVisible();

    // Remembered by the browser.
    await page.reload();
    await expect(
      card(page, "Basmati Rice").getByRole("button", {
        name: /Remove from wishlist/,
      }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Wishlist, 1 product" }).click();
    await expect(page).toHaveURL(/\/en\/wishlist$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Your wishlist" }),
    ).toBeVisible();
    await expect(page.getByText("1 product", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Sign in to keep your wishlist on every device."),
    ).toBeVisible();
    const saved = card(page, "Basmati Rice");
    await expect(saved.getByRole("heading")).toHaveText("Basmati Rice (1kg)");
    await saved.getByRole("button", { name: /Remove from wishlist/ }).click();
    await expect(
      page.getByRole("heading", { name: "Nothing saved yet" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Wishlist, empty" }),
    ).toBeVisible();
  });

  test("the product page remembers the open pack size; the list shows that size", async ({
    page,
  }) => {
    await page.goto("/en/products/basmati-rice-5kg");
    await page
      .getByRole("main")
      .getByRole("button", { name: "Save to wishlist: Basmati Rice (5kg)" })
      .click();
    await page.goto("/en/wishlist");
    await expect(card(page, "Basmati Rice").getByRole("heading")).toHaveText(
      "Basmati Rice (5kg)",
    );
    // "Remove all" asks once.
    await page.getByRole("button", { name: "Remove all" }).click();
    await page.getByRole("button", { name: "Keep" }).click();
    await expect(card(page, "Basmati Rice")).toBeVisible();
    await page.getByRole("button", { name: "Remove all" }).click();
    await page.getByRole("button", { name: "Yes, remove" }).click();
    await expect(
      page.getByRole("heading", { name: "Nothing saved yet" }),
    ).toBeVisible();
  });

  test("after signing up the visitor's list is taken over by the account and the browser's copy goes", async ({
    page,
  }) => {
    await page.goto("/en/products");
    await card(page, "Chakki Atta (5kg)")
      .getByRole("button", { name: /Save to wishlist/ })
      .click();
    await page.goto("/en/wishlist");
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/sign-in\?returnTo=%2Fwishlist$/);
    await page.getByRole("link", { name: "Create an account" }).click();
    await page.getByLabel("First name").fill("Priya");
    await page.getByLabel("Last name").fill("Shah");
    await page.getByLabel("Email address").fill("wish@example.com");
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en\/wishlist$/);
    await expect(card(page, "Chakki Atta")).toBeVisible();
    await expect(
      page.getByText("Sign in to keep your wishlist on every device."),
    ).toHaveCount(0);
    // The server has it now; the browser's copy is gone.
    const stored = await page.request.get(`${MOCK}/v1/store/wishlist`);
    expect((await stored.json()).count).toBe(1);
    expect(
      await page.evaluate(() => window.localStorage.getItem("rf.wishlist.v1")),
    ).toBeNull();
  });
});
