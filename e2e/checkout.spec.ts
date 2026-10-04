import { expect, test, type Page } from "@playwright/test";

const MOCK = "http://localhost:3000";

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__mock/reset`);
});

async function productId(page: Page, slug: string): Promise<string> {
  const response = await page.request.get(`${MOCK}/v1/store/products/${slug}`);
  return (await response.json()).product.id;
}

/**
 * A signed-in customer with an address and two bags of atta in the stored
 * cart (30.97 in total), set up through the API so that a test can start at
 * the checkout. The browser gets the session cookies of these calls.
 */
async function seedCustomer(page: Page, email = "priya@example.com") {
  const api = page.request;
  await api.post(`${MOCK}/v1/store/auth/otp/request`, { data: { email } });
  await api.post(`${MOCK}/v1/store/auth/otp/verify`, {
    data: { email, code: "123456" },
  });
  await api.post(`${MOCK}/v1/store/me/addresses`, {
    data: {
      firstName: "Priya",
      lastName: "Shah",
      street: "Hauptstraße",
      houseNumber: "12",
      postalCode: "60311",
      city: "Frankfurt am Main",
    },
  });
  const atta = await productId(page, "chakki-atta-5-kg");
  await api.put(`${MOCK}/v1/store/cart/items/${atta}`, {
    data: { quantity: 2 },
  });
  return { atta };
}

/** Puts products into the visitor's cart before the page loads. */
async function seedGuestCart(
  page: Page,
  items: { productId: string; quantity: number }[],
) {
  await page.addInitScript((cart) => {
    window.localStorage.setItem("rf.cart.v1", JSON.stringify(cart));
  }, items);
}

const placeButton = (page: Page) =>
  page.getByRole("button", { name: "Place binding pre-order" });
const consentBox = (page: Page) =>
  page.getByRole("checkbox", { name: /Terms and Conditions/ });

test.describe("from the cart to the confirmed pre-order", () => {
  test("a visitor orders: cart, sign-in, address, consent, binding button", async ({
    page,
  }) => {
    await page.goto("/en/products");
    const atta = page.getByRole("article").filter({ hasText: "Chakki Atta" });
    await atta
      .getByRole("button", { name: /Add to cart: Chakki Atta/ })
      .click();
    await atta.getByRole("button", { name: "One more" }).click();

    // The cart shows the bill of the API and that nothing is paid today.
    await page.goto("/en/cart");
    const summary = page.getByRole("complementary", { name: "Summary" });
    await expect(summary).toContainText("€25.98");
    await expect(summary).toContainText("€4.99");
    await expect(summary).toContainText("€30.97");
    await expect(summary).toContainText("includes 7% VAT");
    await expect(summary).toContainText("Add €24.02 more for free delivery");
    await expect(summary).toContainText("Due today");
    await expect(summary).toContainText("Nothing to pay today.");

    // Checkout needs an account: sign-in, then back to the checkout.
    await summary.getByRole("link", { name: "Go to checkout" }).click();
    await expect(page).toHaveURL(/\/en\/sign-in\?returnTo=%2Fcheckout$/);
    await page.getByLabel("Email address").fill("priya@example.com");
    await page.getByRole("button", { name: "Send code" }).click();
    await page.getByLabel("6-digit code").fill("123456");
    await expect(page).toHaveURL(/\/en\/checkout$/);

    // No address yet: the form is there at once.
    await page.getByLabel("First name").fill("Priya");
    await page.getByLabel("Last name").fill("Shah");
    await page.getByLabel("Street").fill("Hauptstraße");
    await page.getByLabel("House number").fill("12");
    await page.getByLabel("Postcode").fill("6031");
    await page.getByLabel("City").fill("Frankfurt am Main");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText("Enter a 5-digit postcode.")).toBeVisible();
    await page.getByLabel("Postcode").fill("60311");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByRole("radio")).toBeChecked();

    // The visitor's cart came along; the button is the binding one.
    const order = page.getByRole("complementary", { name: "Your pre-order" });
    await expect(order).toContainText("Chakki Atta, 5 kg");
    await expect(order).toContainText("€30.97");
    await expect(order).toContainText("Nothing to pay today.");

    await placeButton(page).click();
    await expect(
      page.getByText("Please accept the terms to place your pre-order."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/en\/checkout$/);

    await consentBox(page).check();
    await placeButton(page).click();
    await expect(page).toHaveURL(/\/en\/checkout\/confirmation\/RF-1085$/);
    await expect(
      page.getByRole("heading", { name: "Your pre-order is confirmed" }),
    ).toBeVisible();
    await expect(page.getByText("RF-1085")).toBeVisible();
    await expect(page.getByText("priya@example.com")).toBeVisible();

    // The order emptied the cart.
    await page.goto("/en/cart");
    await expect(
      page.getByRole("heading", { name: "Your cart is empty" }),
    ).toBeVisible();
  });

  test("in German the button says that the order is binding", async ({
    page,
  }) => {
    await seedCustomer(page);
    await page.goto("/de/kasse");
    const order = page.getByRole("complementary", {
      name: "Ihre Vorbestellung",
    });
    await expect(order).toContainText("30,97 €");
    await expect(order).toContainText("Heute zu zahlen");
    await expect(order).toContainText("inkl. MwSt. und Lieferung");
    await page.getByRole("checkbox", { name: /Geschäftsbedingungen/ }).check();
    await page
      .getByRole("button", { name: "Zahlungspflichtig vorbestellen" })
      .click();
    await expect(page).toHaveURL(/\/de\/kasse\/bestaetigung\/RF-1085$/);
    await expect(
      page.getByRole("heading", { name: "Ihre Vorbestellung ist bestätigt" }),
    ).toBeVisible();
  });

  test("the consent links lead to the exact versions of the texts", async ({
    page,
  }) => {
    await seedCustomer(page);
    await page.goto("/en/checkout");
    await expect(
      page.getByRole("link", { name: "Terms and Conditions (version 3)" }),
    ).toHaveAttribute("href", "/en/legal/terms");
    await expect(
      page.getByRole("link", { name: "Privacy Policy (version 2)" }),
    ).toHaveAttribute("href", "/en/legal/privacy");
    await page.goto("/en/legal/terms");
    await expect(
      page.getByRole("heading", { level: 1, name: "Terms and Conditions" }),
    ).toBeVisible();
    await expect(page.getByText(/Version 3, published on/)).toBeVisible();
  });
});

test.describe("when something changed since the page was loaded", () => {
  test("a changed total is shown and must be confirmed again", async ({
    page,
    request,
  }) => {
    const { atta } = await seedCustomer(page);
    await page.goto("/en/checkout");
    await consentBox(page).check();
    await expect(placeButton(page)).toBeEnabled();

    await request.post(`${MOCK}/__mock/price`, {
      data: { productId: atta, price: 1399 },
    });
    await placeButton(page).click();
    await expect(page.getByText("The total has changed")).toBeVisible();
    await expect(
      page.getByText(/It was €30\.97 and is now €32\.97/),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/en\/checkout$/);

    await placeButton(page).click();
    await expect(page).toHaveURL(/\/confirmation\/RF-1085$/);
    await expect(page.getByText("€32.97").first()).toBeVisible();
  });

  test("republished terms must be accepted again", async ({
    page,
    request,
  }) => {
    await seedCustomer(page);
    await page.goto("/en/checkout");
    await consentBox(page).check();
    await request.post(`${MOCK}/__mock/legal/republish`, {
      data: { type: "terms" },
    });
    await placeButton(page).click();
    await expect(page.getByText("Our terms were updated")).toBeVisible();
    await expect(consentBox(page)).not.toBeChecked();
    await expect(
      page.getByRole("link", { name: "Terms and Conditions (version 4)" }),
    ).toBeVisible();

    await consentBox(page).check();
    await placeButton(page).click();
    await expect(page).toHaveURL(/\/confirmation\/RF-1085$/);
  });

  test("ordering that closed meanwhile is explained, nothing is lost", async ({
    page,
    request,
  }) => {
    await seedCustomer(page);
    await page.goto("/en/checkout");
    await consentBox(page).check();
    await request.post(`${MOCK}/__mock/cargo`, { data: { mode: "closed" } });
    await placeButton(page).click();
    await expect(
      page.getByText("Ordering has just closed. Your cart stays saved"),
    ).toBeVisible();
    await expect(placeButton(page)).toBeDisabled();
  });

  test("an overdue payment stops the order and names what to pay", async ({
    page,
    request,
  }) => {
    await seedCustomer(page);
    await request.post(`${MOCK}/__mock/customer`, {
      data: { email: "priya@example.com", overdue: true },
    });
    await page.goto("/en/checkout");
    await expect(
      page.getByText("An earlier order is still unpaid."),
    ).toBeVisible();
    await expect(page.getByText(/Order RF-1001: €31\.93/)).toBeVisible();
    await expect(placeButton(page)).toBeDisabled();
  });
});

test.describe("the cart", () => {
  test("a line below its minimum is fixed with one tap", async ({ page }) => {
    const khakhra = await productId(page, "methi-khakhra-200-g");
    await seedGuestCart(page, [{ productId: khakhra, quantity: 1 }]);
    await page.goto("/en/cart");
    await expect(
      page.getByText("The minimum order for this product is 2."),
    ).toBeVisible();
    const summary = page.getByRole("complementary", { name: "Summary" });
    await expect(
      summary.getByRole("button", { name: "Go to checkout" }),
    ).toBeDisabled();

    await page.getByRole("button", { name: "Set to 2" }).click();
    await expect(
      page.getByText("The minimum order for this product is 2."),
    ).toHaveCount(0);
    await expect(
      summary.getByRole("link", { name: "Go to checkout" }),
    ).toBeVisible();
    await expect(summary).toContainText("€5.98");
  });

  test("a sold-out product blocks the order until it is removed", async ({
    page,
  }) => {
    const mango = await productId(page, "kesar-mango-box-3-kg");
    const dal = await productId(page, "toor-dal-1-kg");
    await seedGuestCart(page, [
      { productId: mango, quantity: 1 },
      { productId: dal, quantity: 1 },
    ]);
    await page.goto("/en/cart");
    await expect(page.getByText(/Sold out for this delivery\./)).toBeVisible();
    const summary = page.getByRole("complementary", { name: "Summary" });
    // Only what can be ordered is in the total.
    await expect(summary).toContainText("€4.49");
    await expect(
      summary.getByRole("button", { name: "Go to checkout" }),
    ).toBeDisabled();

    await page.getByRole("button", { name: /Remove Kesar Mango, Box/ }).click();
    await expect(
      summary.getByRole("link", { name: "Go to checkout" }),
    ).toBeVisible();
  });

  test("free delivery is reached and said so", async ({ page }) => {
    const atta = await productId(page, "chakki-atta-5-kg");
    await seedGuestCart(page, [{ productId: atta, quantity: 4 }]);
    await page.goto("/en/cart");
    const summary = page.getByRole("complementary", { name: "Summary" });
    await expect(summary).toContainText("Delivery is free for this order");
    await expect(summary).toContainText("€51.96");
  });

  test("on a phone the cart follows along above the tab bar", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "the bar exists on phones only");
    await page.goto("/en/products");
    await page
      .getByRole("article")
      .filter({ hasText: "Toor Dal" })
      .getByRole("button", { name: /Add to cart: Toor Dal/ })
      .click();
    const bar = page.getByRole("link", { name: /1 item.*View cart/ });
    await expect(bar).toContainText("€9.48");
    await bar.click();
    await expect(page).toHaveURL(/\/en\/cart$/);
  });
});

test.describe("signing in", () => {
  test("a wrong code counts down the attempts; a new code has to wait", async ({
    page,
  }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email address").fill("not-an-email");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(
      page.getByText("Please enter a valid email address."),
    ).toBeVisible();

    await page.getByLabel("Email address").fill("Max@Example.com");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText(/code to max@example\.com/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /New code possible in \d+s/ }),
    ).toBeDisabled();

    await page.getByLabel("6-digit code").fill("000000");
    await expect(
      page.getByText("This code is not correct. You have 4 attempts left."),
    ).toBeVisible();
    await page.getByLabel("6-digit code").fill("123456");
    await expect(page).toHaveURL(/\/en\/account$/);
  });

  test("the way back after sign-in never leaves the shop", async ({ page }) => {
    await page.goto("/en/sign-in?returnTo=https://evil.example/");
    await page.getByLabel("Email address").fill("max@example.com");
    await page.getByRole("button", { name: "Send code" }).click();
    await page.getByLabel("6-digit code").fill("123456");
    await expect(page).toHaveURL(/localhost:3001\/en\/account$/);
  });

  test("checkout without a session leads to sign-in first", async ({
    page,
  }) => {
    await page.goto("/en/checkout");
    await expect(page).toHaveURL(/\/en\/sign-in\?returnTo=%2Fcheckout$/);
    await expect(
      page.getByText("Sign in to confirm your pre-order."),
    ).toBeVisible();
  });
});
