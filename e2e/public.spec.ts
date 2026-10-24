import { expect, test, type APIRequestContext } from "@playwright/test";

const MOCK = "http://localhost:3000";

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__mock/reset`);
});

/**
 * Creates the account through the API, outside the browser: the browser of
 * the test stays without a session, like someone who opens a link in an
 * email. Answers the token the marketing emails would carry.
 */
async function tokensOf(request: APIRequestContext, email: string) {
  await request.post(`${MOCK}/v1/store/auth/signup`, {
    data: {
      firstName: "Anna",
      lastName: "Schmidt",
      email,
      password: "Mangoes-in-May-2026",
    },
  });
  const response = await request.get(
    `${MOCK}/__mock/tokens?email=${encodeURIComponent(email)}`,
  );
  return (await response.json()) as { unsubscribe: string };
}

test.describe("the unsubscribe link of an email", () => {
  test("switches the news off with one tap, without a sign-in", async ({
    page,
    request,
  }) => {
    const { unsubscribe } = await tokensOf(request, "anna@example.com");
    // The token contains a dot, which must survive the way to the page.
    expect(unsubscribe).toContain(".");
    await page.goto(`/unsubscribe/${unsubscribe}`);
    await expect(page).toHaveURL(/\/en\/unsubscribe\/.+\..+$/);
    await page.getByRole("button", { name: "Unsubscribe" }).click();
    await expect(page.getByText("You are unsubscribed")).toBeVisible();
    await expect(
      page.getByText(/anna@example\.com gets no more news/),
    ).toBeVisible();
  });

  test("says so when the link is not valid", async ({ page }) => {
    await page.goto("/en/unsubscribe/66f1000000000000000000ff.wrong");
    await page.getByRole("button", { name: "Unsubscribe" }).click();
    await expect(page.getByText("This link is not valid")).toBeVisible();
  });
});

test.describe("help and legal pages", () => {
  test("every link of the footer leads to a page", async ({ page }) => {
    await page.goto("/en");
    const hrefs = await page
      .getByRole("contentinfo")
      .getByRole("link")
      .evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).href));
    expect(hrefs.length).toBeGreaterThan(14);
    for (const href of new Set(hrefs)) {
      const response = await page.request.get(href);
      expect(response.status(), href).toBe(200);
    }
  });

  test("the old address of the pre-order terms leads to the terms", async ({
    request,
  }) => {
    const moved = await request.get("/en/legal/preorder-terms", {
      maxRedirects: 0,
    });
    expect(moved.status()).toBe(308);
    expect(moved.headers()["location"]).toBe("/en/legal/terms");
  });

  test("delivery and payment shows the real fee steps and the delivery time", async ({
    page,
  }) => {
    await page.goto("/en/delivery-and-payment");
    await expect(
      page.getByRole("heading", { level: 1, name: "Delivery and payment" }),
    ).toBeVisible();
    const fees = page.getByRole("table");
    await expect(fees).toContainText("under €50.00");
    await expect(fees).toContainText("€4.99");
    await expect(fees).toContainText("from €50.00");
    await expect(fees).toContainText("Free");
    await expect(
      page.getByText("Delivery time: 2 to 4 working days."),
    ).toBeVisible();
    await expect(page.getByText(/Within 14 days after delivery/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Payment at checkout" }),
    ).toBeVisible();
  });

  test("the shop is explained, in German too", async ({ page }) => {
    await page.goto("/de/so-funktionierts");
    await expect(
      page.getByRole("heading", { level: 1, name: "So funktioniert’s" }),
    ).toBeVisible();
    await expect(page.getByText("Wie bezahle ich?")).toBeVisible();
    await expect(page.getByText("Bezahlen", { exact: true })).toBeVisible();
  });

  test("the legal notice is a template with marked gaps until it is filled in", async ({
    page,
  }) => {
    await page.goto("/de/rechtliches/impressum");
    await expect(
      page.getByRole("heading", { level: 1, name: "Impressum" }),
    ).toBeVisible();
    await expect(
      page.getByText("Diese Seite ist noch nicht vollständig"),
    ).toBeVisible();
    await expect(page.locator("mark").first()).toContainText("[[");
  });

  test("the cookie page lists what the shop really stores", async ({
    page,
  }) => {
    await page.goto("/en/legal/cookies");
    const table = page.getByRole("table");
    await expect(table).toContainText("rf_customer_refresh");
    await expect(table).toContainText("rf.cart.v2");
    // No gaps here: this text describes facts of the shop.
    await expect(page.locator("mark")).toHaveCount(0);
  });
});

test.describe("questions and answers", () => {
  test("lists the published questions under their headings, with the answers folded", async ({
    page,
  }) => {
    await page.goto("/en/faq");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Questions and answers",
    );
    // The visible groups in the admin's order, the questions without a
    // group last; the hidden "Wholesale" group and the draft stay out.
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 2 })).toHaveText([
      "Orders",
      "Delivery",
      "Returns",
      "Other questions",
    ]);
    await expect(main.getByRole("heading", { level: 3 })).toHaveCount(7);
    await expect(page.getByText("Do you sell to restaurants?")).toHaveCount(0);
    await expect(page.getByText("Do you offer a subscription?")).toHaveCount(0);
    // The answer is Markdown, folded under its question with an anchor.
    const question = page.locator("#faq-66f500000000000000000a01");
    await expect(question).toHaveAttribute("id", /^faq-/);
    await question.locator("summary").click();
    await expect(
      question.getByRole("link", { name: "right of withdrawal" }),
    ).toHaveAttribute("href", "/legal/withdrawal");
    await expect(question.getByRole("emphasis")).toHaveText("Cancel order");
    // The structured data carries the answers as plain words.
    const jsonLd = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const faq = jsonLd
      .map((text) => JSON.parse(text))
      .find((data) => data["@type"] === "FAQPage");
    expect(faq.mainEntity).toHaveLength(7);
    expect(faq.mainEntity[0].acceptedAnswer.text).toContain(
      "choose Cancel order. Once it is on its way, use the right of withdrawal instead.",
    );
    // German, with English where the German is missing.
    await page.goto("/de/faq");
    await expect(main.getByRole("heading", { level: 2 })).toHaveText([
      "Bestellungen",
      "Lieferung",
      "Rücksendungen",
      "Weitere Fragen",
    ]);
    await expect(
      page.getByText("Do you have a shop in Frankfurt?"),
    ).toBeVisible();
  });
});

test.describe("the blog", () => {
  test("lists the published posts newest first, in pages, with categories and topics", async ({
    page,
  }) => {
    await page.goto("/en/blog");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Blog");
    // Thirteen published posts, twelve on the first page; the draft and the
    // scheduled post stay out.
    const cards = page.getByRole("main").getByRole("article");
    await expect(cards).toHaveCount(12);
    await expect(cards.first()).toContainText("The perfect dal");
    await expect(cards.first()).toContainText("Recipes");
    await expect(cards.first()).toContainText("20 October 2026");
    await expect(cards.first()).toContainText("1 min read");
    await expect(page.getByText("Draft: our story")).toHaveCount(0);
    await expect(page.getByText("Scheduled: Holi colours")).toHaveCount(0);
    const categories = page.getByRole("navigation", {
      name: "Categories of the blog",
    });
    await expect(categories.getByRole("link")).toHaveText([
      "All articles",
      /Recipes\s*5/,
      /Kitchen tips\s*4/,
      /News\s*4/,
    ]);
    await expect(
      page
        .getByRole("navigation", { name: "Topics of the blog" })
        .getByRole("link")
        .first(),
    ).toHaveText("#recipes");
    await page.getByRole("link", { name: "Page 2 of 2" }).click();
    await expect(page).toHaveURL(/\/en\/blog\?page=2$/);
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("We now deliver with Hermes too");
  });

  test("narrows the list by category, topic and search", async ({ page }) => {
    await page.goto("/en/blog/category/kitchen-tips");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Kitchen tips",
    );
    await expect(page.getByRole("main").getByRole("article")).toHaveCount(4);
    await expect(
      page
        .getByRole("navigation", { name: "Categories of the blog" })
        .getByRole("link", {
          name: /Kitchen tips/,
        }),
    ).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: "#spices" }).click();
    await expect(page).toHaveURL(/\/en\/blog\/tag\/spices$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Articles on “spices”",
    );
    await expect(page.getByRole("main").getByRole("article")).toHaveCount(3);
    await page.goto("/en/blog");
    await page.getByRole("searchbox", { name: "Search the blog" }).fill("dal");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en\/blog\?q=dal$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Articles for “dal”",
    );
    await expect(page.getByRole("main").getByRole("article")).toHaveCount(1);
    // A search is not for the index.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await page.goto("/en/blog?q=zzzz");
    await expect(
      page.getByText("We found no article for “zzzz”"),
    ).toBeVisible();
    // A German category address leads to the German page.
    await page.goto("/de/blog/kategorie/rezepte");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rezepte");
    await expect(page.getByRole("main").getByRole("article")).toHaveCount(5);
    await expect(
      page.getByRole("main").getByRole("article").first(),
    ).toContainText("20. Oktober 2026");
  });

  test("an article shows its text, picture, topics and related posts; drafts are not found", async ({
    page,
  }) => {
    await page.goto("/en/blog/the-perfect-dal");
    await expect(page).toHaveTitle(
      "The perfect dal – a recipe from Radhe Foods",
    );
    const article = page.getByRole("main").getByRole("article").first();
    await expect(article.getByRole("heading", { level: 1 })).toHaveText(
      "The perfect dal",
    );
    await expect(article).toContainText(
      "By Vrushabh · 20 October 2026 · 1 min read",
    );
    // The `#` of the text is the second level of the page, never a second h1.
    await expect(
      article.getByRole("heading", { level: 2, name: "Dal" }),
    ).toBeVisible();
    await expect(
      article.getByRole("heading", { level: 3, name: "The tempering" }),
    ).toBeVisible();
    await expect(
      article.getByRole("img", { name: "A bowl of dal" }).first(),
    ).toBeVisible();
    await expect(
      article.getByRole("link", { name: "#lentils" }),
    ).toHaveAttribute("href", "/en/blog/tag/lentils");
    const related = page.getByRole("region", { name: "More to read" });
    await expect(related.getByRole("article")).toHaveCount(3);
    await expect(related.getByRole("article").first()).toContainText(
      "Basmati, three ways",
    );
    // Canonical, both languages, the social preview and the structured data.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "http://localhost:3001/en/blog/the-perfect-dal",
    );
    await expect(page.locator('link[hreflang="de"]')).toHaveAttribute(
      "href",
      "http://localhost:3001/de/blog/das-perfekte-dal",
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
      "content",
      "article",
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /\/media\/blog\/.*\/medium\.svg$/,
    );
    const jsonLd = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const data = jsonLd
      .map((text) => JSON.parse(text))
      .find((entry) => entry["@type"] === "Article");
    expect(data.headline).toBe("The perfect dal");
    expect(data.author.name).toBe("Vrushabh");
    expect(data.datePublished).toBe("2026-10-20T08:00:00.000Z");
    // The language switch goes to the German slug.
    await page.getByRole("link", { name: "Deutsch" }).click();
    await expect(page).toHaveURL(/\/de\/blog\/das-perfekte-dal$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Das perfekte Dal",
    );
    // The English slug under /de leads to the German address.
    await page.goto("/de/blog/the-perfect-dal");
    await expect(page).toHaveURL(/\/de\/blog\/das-perfekte-dal$/);
    // A post without a German text shows the English one and says so.
    await page.goto("/de/blog/so-lagern-sie-gewuerze");
    await expect(
      page.getByText("Dieser Artikel ist nur auf Englisch verfügbar."),
    ).toBeVisible();
    await expect(page.getByText("Three rules")).toBeVisible();
    // Drafts, scheduled posts and unknown slugs are not found.
    for (const slug of ["our-story", "holi-colours", "no-such-post"]) {
      const response = await page.goto(`/en/blog/${slug}`);
      expect(response?.status(), slug).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Page not found",
      );
    }
  });
});

test.describe("the cookie notice", () => {
  // The other tests start with the notice already read.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("says once that only necessary storage is used", async ({ page }) => {
    await page.goto("/en");
    const notice = page.getByRole("complementary", { name: "Cookie notice" });
    await expect(notice).toContainText("No tracking, no advertising.");
    await expect(notice.getByRole("link", { name: "Details" })).toHaveAttribute(
      "href",
      "/en/legal/cookies",
    );
    await notice.getByRole("button", { name: "OK" }).click();
    await expect(notice).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(notice).toHaveCount(0);
  });
});

test.describe("for search engines", () => {
  test("robots.txt opens the shop and names the sitemap", async ({
    request,
  }) => {
    const text = await (await request.get("/robots.txt")).text();
    expect(text).toContain("Allow: /");
    expect(text).toContain("Disallow: /unsubscribe/");
    expect(text).not.toContain("/pay/");
    expect(text).toContain("Sitemap: http://localhost:3001/sitemap.xml");
  });

  test("the sitemap lists pages, categories and products in both languages", async ({
    request,
  }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const xml = await response.text();
    for (const url of [
      "http://localhost:3001/en",
      "http://localhost:3001/de/produkte",
      "http://localhost:3001/de/kategorie/reis",
      "http://localhost:3001/en/products/basmati-rice-5kg",
      "http://localhost:3001/de/produkte/basmati-reis-5kg",
      "http://localhost:3001/de/rechtliches/impressum",
      "http://localhost:3001/en/faq",
      "http://localhost:3001/de/blog",
      "http://localhost:3001/en/blog/the-perfect-dal",
      "http://localhost:3001/de/blog/das-perfekte-dal",
      "http://localhost:3001/de/blog/kategorie/rezepte",
    ]) {
      expect(xml, url).toContain(`<loc>${url}</loc>`);
    }
    expect(xml).toContain('hreflang="x-default"');
    expect(xml).not.toContain("/warenkorb");
    expect(xml).not.toContain("/account");
    expect(xml).not.toContain("preorder-terms");
  });

  test("a product page carries canonical, languages, a picture and an offer per size", async ({
    page,
  }) => {
    await page.goto("/de/produkte/basmati-reis-5kg");
    const head = page.locator("head");
    await expect(head.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "http://localhost:3001/de/produkte/basmati-reis-5kg",
    );
    await expect(
      head.locator('link[rel="alternate"][hreflang="en"]'),
    ).toHaveAttribute(
      "href",
      "http://localhost:3001/en/products/basmati-rice-5kg",
    );
    await expect(
      head.locator('link[rel="alternate"][hreflang="x-default"]'),
    ).toHaveAttribute(
      "href",
      "http://localhost:3001/en/products/basmati-rice-5kg",
    );
    await expect(head.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /large\.svg$/,
    );

    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    // One group for the product, one product per pack size (doc 7).
    const group = blocks
      .flatMap((block) => [JSON.parse(block)].flat())
      .find((entry) => entry["@type"] === "ProductGroup");
    expect(group.name).toBe("Basmati-Reis");
    expect(group.hasVariant).toHaveLength(2);
    const size = group.hasVariant.find((entry: { url: string }) =>
      entry.url.endsWith("/basmati-reis-5kg"),
    );
    expect(size).toMatchObject({
      "@type": "Product",
      name: "Basmati-Reis (5kg)",
      sku: "RF-00042",
      weight: { value: 5, unitCode: "KGM" },
    });
    expect(size.offers).toMatchObject({
      priceCurrency: "EUR",
      price: "19.99",
      availability: "https://schema.org/InStock",
    });
  });

  test("pages of one visitor are not for the index; the home page is", async ({
    page,
  }) => {
    await page.goto("/en/cart");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await page.goto("/en");
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(
      page.locator('head meta[property="og:image"]'),
    ).toHaveAttribute("content", /radhe-social-1200x630\.jpg$/);
    const manifest = await page.request.get("/manifest.webmanifest");
    expect((await manifest.json()).name).toBe("Radhe Foods");
  });
});
