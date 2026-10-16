import { expect, test, type Page } from "@playwright/test";

const MOCK = "http://localhost:3000";

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__mock/reset`);
});

/** The id of the pack size a product page stands for: the cart's key. */
async function variantId(page: Page, slug: string): Promise<string> {
  const response = await page.request.get(`${MOCK}/v1/store/products/${slug}`);
  return (await response.json()).product.variantId;
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
  const atta = await variantId(page, "chakki-atta-5kg");
  await api.put(`${MOCK}/v1/store/cart/items/${atta}`, {
    data: { quantity: 2 },
  });
  return { atta };
}

/** Puts pack sizes into the visitor's cart before the page loads. */
async function seedGuestCart(
  page: Page,
  items: { variantId: string; quantity: number }[],
) {
  await page.addInitScript((cart) => {
    window.localStorage.setItem("rf.cart.v2", JSON.stringify(cart));
  }, items);
}

const buyButton = (page: Page) => page.getByRole("button", { name: "Buy now" });
const consentBox = (page: Page) =>
  page.getByRole("checkbox", { name: /Terms and Conditions/ });

test.describe("from the cart to the paid order", () => {
  test("a visitor orders: cart, sign-in, address, consent, payment page, confirmed order", async ({
    page,
  }) => {
    await page.goto("/en/products");
    const atta = page.getByRole("article").filter({ hasText: "Chakki Atta" });
    await atta
      .getByRole("button", { name: /Add to cart: Chakki Atta/ })
      .click();
    await atta.getByRole("button", { name: "One more" }).click();

    // The cart shows the bill of the API.
    await page.goto("/en/cart");
    const summary = page.getByRole("complementary", { name: "Summary" });
    await expect(summary).toContainText("€25.98");
    await expect(summary).toContainText("€4.99");
    await expect(summary).toContainText("€30.97");
    await expect(summary).toContainText("includes 7% VAT");
    await expect(summary).toContainText("Add €24.02 more for free delivery");
    await expect(summary).toContainText("You pay in the next step");

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

    // The visitor's cart came along; the customer pays now.
    const order = page.getByRole("complementary", { name: "Your order" });
    await expect(order).toContainText("Chakki Atta (5 kg)");
    await expect(order).toContainText("€30.97");
    await expect(order).toContainText("2 to 4 working days");
    await expect(order).toContainText("You pay now.");

    await buyButton(page).click();
    await expect(
      page.getByText("Please accept the terms to place your order."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/en\/checkout$/);

    // The order is placed and the browser goes to the payment page.
    await consentBox(page).check();
    await buyButton(page).click();
    await expect(page).toHaveURL(/__mock\/stripe\/RF-1085$/);
    await expect(page.getByText("30.97 EUR")).toBeVisible();
    await page.getByRole("link", { name: "Pay by card" }).click();

    // Back on the order, which is paid and confirmed.
    await expect(page).toHaveURL(
      /\/en\/account\/orders\/RF-1085\?payment=success$/,
    );
    await expect(page.getByText("Thank you, your order is paid")).toBeVisible();
    await expect(page.getByText("priya@example.com")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Order RF-1085" }),
    ).toBeVisible();
    const payment = page.getByRole("region", { name: "Payment" });
    await expect(payment).toContainText("Paid on");
    await expect(payment).toContainText("by card");
    await expect(payment).toContainText("Invoice INV-");

    // The payment emptied the cart.
    await page.goto("/en/cart");
    await expect(
      page.getByRole("heading", { name: "Your cart is empty" }),
    ).toBeVisible();
  });

  test("in German the button says that the customer pays, and the way back speaks German", async ({
    page,
  }) => {
    await seedCustomer(page);
    await page.goto("/de/kasse");
    const order = page.getByRole("complementary", {
      name: "Ihre Bestellung",
    });
    await expect(order).toContainText("30,97 €");
    await expect(order).toContainText("inkl. MwSt. und Lieferung");
    await expect(order).toContainText("Sie zahlen jetzt.");
    await page.getByRole("checkbox", { name: /Geschäftsbedingungen/ }).check();
    await page
      .getByRole("button", { name: "Zahlungspflichtig bestellen" })
      .click();
    await expect(page).toHaveURL(/__mock\/stripe\/RF-1085$/);
    await page.getByRole("link", { name: "Pay by card" }).click();
    await expect(page).toHaveURL(
      /\/de\/konto\/bestellungen\/RF-1085\?payment=success$/,
    );
    await expect(
      page.getByText("Vielen Dank, Ihre Bestellung ist bezahlt"),
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
    await expect(buyButton(page)).toBeEnabled();

    await request.post(`${MOCK}/__mock/price`, {
      data: { variantId: atta, price: 1399 },
    });
    await buyButton(page).click();
    await expect(page.getByText("The total has changed")).toBeVisible();
    await expect(
      page.getByText(/It was €30\.97 and is now €32\.97/),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/en\/checkout$/);

    await buyButton(page).click();
    await expect(page).toHaveURL(/__mock\/stripe\/RF-1085$/);
    await expect(page.getByText("32.97 EUR")).toBeVisible();
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
    await buyButton(page).click();
    await expect(page.getByText("Our terms were updated")).toBeVisible();
    await expect(consentBox(page)).not.toBeChecked();
    await expect(
      page.getByRole("link", { name: "Terms and Conditions (version 4)" }),
    ).toBeVisible();

    await consentBox(page).check();
    await buyButton(page).click();
    await expect(page).toHaveURL(/__mock\/stripe\/RF-1085$/);
  });

  test("a product that sold out meanwhile is named, and the cart is the way out", async ({
    page,
    request,
  }) => {
    const { atta } = await seedCustomer(page);
    await page.goto("/en/checkout");
    await consentBox(page).check();
    await request.post(`${MOCK}/__mock/stock`, {
      data: { variantId: atta, quantity: 1 },
    });
    await buyButton(page).click();
    const issues = page.getByRole("alert").filter({
      hasText: "Some products cannot be ordered right now.",
    });
    await expect(issues).toBeVisible();
    await expect(issues).toContainText("Chakki Atta (5 kg)");
    await expect(
      issues.getByRole("link", { name: "To the cart" }),
    ).toBeVisible();
    await expect(buyButton(page)).toBeDisabled();
  });

  test("when online payment is not set up, the checkout says so", async ({
    page,
    request,
  }) => {
    await seedCustomer(page);
    await request.post(`${MOCK}/__mock/stripe`, { data: { enabled: false } });
    await page.goto("/en/checkout");
    await consentBox(page).check();
    await buyButton(page).click();
    await expect(
      page.getByText("Checkout is not available right now"),
    ).toBeVisible();
    await expect(buyButton(page)).toBeDisabled();
  });
});

test.describe("the cart", () => {
  test("a line below its minimum is fixed with one tap", async ({ page }) => {
    const khakhra = await variantId(page, "methi-khakhra-200g");
    await seedGuestCart(page, [{ variantId: khakhra, quantity: 1 }]);
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
    const mango = await variantId(page, "kesar-mango-box-3kg");
    const dal = await variantId(page, "toor-dal-1kg");
    await seedGuestCart(page, [
      { variantId: mango, quantity: 1 },
      { variantId: dal, quantity: 1 },
    ]);
    await page.goto("/en/cart");
    await expect(page.getByText(/Sold out\. Please remove it/)).toBeVisible();
    const summary = page.getByRole("complementary", { name: "Summary" });
    // Only what can be ordered is in the total.
    await expect(summary).toContainText("€4.49");
    await expect(
      summary.getByRole("button", { name: "Go to checkout" }),
    ).toBeDisabled();

    await page
      .getByRole("button", {
        name: "Remove Kesar Mango, Box (3 kg) from the cart",
      })
      .click();
    await expect(
      summary.getByRole("link", { name: "Go to checkout" }),
    ).toBeVisible();
  });

  test("more than the stock is capped with one tap", async ({
    page,
    request,
  }) => {
    const atta = await variantId(page, "chakki-atta-5kg");
    await request.post(`${MOCK}/__mock/stock`, {
      data: { variantId: atta, quantity: 3 },
    });
    await seedGuestCart(page, [{ variantId: atta, quantity: 5 }]);
    await page.goto("/en/cart");
    await expect(
      page.getByText("Only 3 can be ordered right now."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Set to 3" }).click();
    await expect(
      page.getByText("Only 3 can be ordered right now."),
    ).toHaveCount(0);
  });

  test("free delivery is reached and said so", async ({ page }) => {
    const atta = await variantId(page, "chakki-atta-5kg");
    await seedGuestCart(page, [{ variantId: atta, quantity: 4 }]);
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
      page.getByText("Sign in to pay for your order."),
    ).toBeVisible();
  });
});
