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
  await request.post(`${MOCK}/v1/store/auth/otp/request`, { data: { email } });
  await request.post(`${MOCK}/v1/store/auth/otp/verify`, {
    data: { email, code: "123456" },
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
      name: "Basmati-Reis (5 kg)",
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
