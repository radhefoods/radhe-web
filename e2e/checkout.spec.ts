import { expect, test, type Page } from "@playwright/test";

const MOCK = "http://localhost:3000";
const PASSWORD = "Mangoes-in-May-2026";

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
  await api.post(`${MOCK}/v1/store/auth/signup`, {
    data: { firstName: "Priya", lastName: "Shah", email, password: PASSWORD },
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
    const atta = page
      .getByRole("article")
      .filter({ hasText: "Chakki Atta (5kg)" });
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
    await expect(summary).toContainText(
      "sign in with your email and password, or create an account",
    );

    // Checkout needs an account: a new customer creates one from the
    // sign-in page and comes back to the checkout.
    await summary.getByRole("link", { name: "Go to checkout" }).click();
    await expect(page).toHaveURL(/\/en\/sign-in\?returnTo=%2Fcheckout$/);
    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL(/\/en\/sign-up\?returnTo=%2Fcheckout$/);
    await expect(
      page.getByText("Create your account to pay for your order."),
    ).toBeVisible();
    await page.getByLabel("First name").fill("Priya");
    await page.getByLabel("Last name").fill("Shah");
    await page.getByLabel("Email address").fill("priya@example.com");
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
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
    await expect(order).toContainText("Chakki Atta (5kg)");
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
    await expect(issues).toContainText("Chakki Atta (5kg)");
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

test.describe("discount codes on the checkout page", () => {
  const order = (page: Page) =>
    page.getByRole("complementary", { name: "Your order" });

  test("a code is refused with its reason, applied with the new total, and carried to the order", async ({
    page,
  }) => {
    await seedCustomer(page);
    await page.goto("/en/checkout");
    const field = page.getByLabel("Discount code");
    const apply = order(page).getByRole("button", { name: "Apply" });
    await expect(apply).toBeDisabled();

    await field.fill("nope");
    await apply.click();
    await expect(page.getByText("This code does not exist.")).toBeVisible();
    await expect(field).toHaveAttribute("aria-invalid", "true");

    // Typed in any case; the bill answers with the discount taken off.
    await field.fill("diwali10");
    await apply.click();
    const summary = order(page);
    await expect(summary).toContainText("Code DIWALI10 applied");
    await expect(summary).toContainText("You save €2.60.");
    await expect(summary).toContainText("Discount DIWALI10");
    await expect(summary).toContainText("−€2.60");
    await expect(summary).toContainText("€28.37");
    await expect(field).toBeHidden();

    // The order is placed with that total and keeps the code.
    await consentBox(page).check();
    await buyButton(page).click();
    await expect(page).toHaveURL(/__mock\/stripe\/RF-1085$/);
    await expect(page.getByText("28.37 EUR")).toBeVisible();
    await page.getByRole("link", { name: "Pay by card" }).click();
    await expect(page).toHaveURL(/\/en\/account\/orders\/RF-1085/);
    const bill = page.locator("section[aria-labelledby='order-bill']");
    await expect(bill).toContainText("Discount DIWALI10");
    await expect(bill).toContainText("−€2.60");
    await expect(bill).toContainText("€28.37");
  });

  test("removing the code brings the plain bill back", async ({ page }) => {
    await seedCustomer(page);
    await page.goto("/en/checkout");
    await page.getByLabel("Discount code").fill("DIWALI10");
    await order(page).getByRole("button", { name: "Apply" }).click();
    await expect(order(page)).toContainText("€28.37");
    await order(page)
      .getByRole("button", { name: "Remove the code DIWALI10" })
      .click();
    await expect(page.getByLabel("Discount code")).toBeVisible();
    await expect(order(page)).not.toContainText("Discount DIWALI10");
    await expect(order(page)).toContainText("€30.97");
  });

  test("a code that stopped applying is removed at checkout and the customer is told", async ({
    page,
  }) => {
    const { atta } = await seedCustomer(page);
    await page.goto("/en/checkout");
    await page.getByLabel("Discount code").fill("welcome5");
    await order(page).getByRole("button", { name: "Apply" }).click();
    await expect(order(page)).toContainText("Code WELCOME5 applied");

    // The cart shrinks below the code's minimum behind the page's back.
    await page.request.put(`${MOCK}/v1/store/cart/items/${atta}`, {
      data: { quantity: 1 },
    });
    await consentBox(page).check();
    await buyButton(page).click();
    const alert = page
      .getByRole("alert")
      .filter({ hasText: "Your discount code WELCOME5 was removed" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(
      "Add more to your cart to use this code.",
    );
    await expect(order(page)).toContainText("€17.98");
    await expect(page.getByLabel("Discount code")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/checkout$/);
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
        name: "Remove Kesar Mango, Box (3kg) from the cart",
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
      .filter({ hasText: "Toor Dal (1kg)" })
      .getByRole("button", { name: /Add to cart: Toor Dal/ })
      .click();
    const bar = page.getByRole("link", { name: /1 item.*View cart/ });
    await expect(bar).toContainText("€9.48");
    await bar.click();
    await expect(page).toHaveURL(/\/en\/cart$/);
  });
});

test.describe("signing in and the password", () => {
  const anna = {
    firstName: "Anna",
    lastName: "Schmidt",
    email: "anna@example.com",
    password: PASSWORD,
  };
  const password = (page: Page) => page.getByLabel("Password", { exact: true });

  test("a wrong password gets one message that names neither part; the right one signs in", async ({
    page,
    request,
  }) => {
    await request.post(`${MOCK}/v1/store/auth/signup`, { data: anna });
    await page.goto("/en/sign-in");
    await page.getByLabel("Email address").fill("not-an-email");
    await password(page).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByText("Please enter a valid email address."),
    ).toBeVisible();

    await page.getByLabel("Email address").fill("Anna@Example.com");
    await password(page).fill("not-the-one");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByText("The email address or the password is incorrect."),
    ).toBeVisible();
    // The address stays, the password is typed again.
    await expect(page.getByLabel("Email address")).toHaveValue(
      "Anna@Example.com",
    );
    await expect(password(page)).toHaveValue("");

    await password(page).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/account$/);
  });

  test("an unknown address gets the same message as a wrong password", async ({
    page,
  }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email address").fill("nobody@example.com");
    await password(page).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByText("The email address or the password is incorrect."),
    ).toBeVisible();
  });

  test("a new customer creates an account and lands where they wanted to go; an address is taken once", async ({
    page,
  }) => {
    await page.goto("/en/sign-up?returnTo=%2Fcart");
    await page.getByLabel("First name").fill("Anna");
    await page.getByLabel("Last name").fill("Schmidt");
    await page.getByLabel("Email address").fill("anna@example.com");
    await password(page).fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(
      page.getByText("Please use at least 8 characters."),
    ).toBeVisible();
    await password(page).fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en\/cart$/);
    await page.goto("/en/account");
    await expect(
      page.getByRole("heading", { level: 1, name: "Hello Anna" }),
    ).toBeVisible();

    // Signed out again, the same address cannot get a second account.
    await page.request.post(`${MOCK}/v1/store/auth/logout`);
    await page.goto("/en/sign-up");
    await page.getByLabel("First name").fill("Anna");
    await page.getByLabel("Last name").fill("Schmidt");
    await page.getByLabel("Email address").fill("anna@example.com");
    await password(page).fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(
      page.getByText("An account with this email address already exists."),
    ).toBeVisible();
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/en\/forgot-password$/);
  });

  test("a forgotten password is replaced by the link of the email", async ({
    page,
    request,
  }) => {
    await request.post(`${MOCK}/v1/store/auth/signup`, { data: anna });
    await page.goto("/en/sign-in");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/en\/forgot-password$/);
    await page.getByLabel("Email address").fill("anna@example.com");
    await page.getByRole("button", { name: "Send link" }).click();
    await expect(
      page.getByText(
        "If an account exists for this address, we have sent an email with a link.",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Send again" }).click();
    await expect(page.getByText("We have sent the email again.")).toBeVisible();

    // The link of the email carries no language and keeps its token.
    const tokens = (await (
      await request.get(`${MOCK}/__mock/tokens?email=anna%40example.com`)
    ).json()) as { passwordReset: string };
    await page.goto(`/reset-password?token=${tokens.passwordReset}`);
    await expect(page).toHaveURL(
      new RegExp(`/en/reset-password\\?token=${tokens.passwordReset}$`),
    );
    const fresh = page.getByLabel("New password", { exact: true });
    const repeat = page.getByLabel("Repeat the new password", { exact: true });
    await fresh.fill("Coriander-and-Cumin-7");
    await repeat.fill("Coriander-and-Cumin-8");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByText("The passwords do not match.")).toBeVisible();
    await repeat.fill("Coriander-and-Cumin-7");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(
      page.getByText("Your password has been changed"),
    ).toBeVisible();

    await page.getByRole("main").getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/sign-in$/);
    await page.getByLabel("Email address").fill("anna@example.com");
    await password(page).fill("Coriander-and-Cumin-7");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/account$/);

    // The link worked once.
    await page.goto(`/en/reset-password?token=${tokens.passwordReset}`);
    await fresh.fill("Coriander-and-Cumin-9");
    await repeat.fill("Coriander-and-Cumin-9");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByText("This link is no longer valid")).toBeVisible();
    await page.getByRole("link", { name: "Request a new link" }).click();
    await expect(page).toHaveURL(/\/en\/forgot-password$/);
  });

  test("a link without a token is not valid, in German too", async ({
    page,
  }) => {
    await page.goto("/de/reset-password");
    await expect(
      page.getByRole("heading", { level: 1, name: "Neues Passwort wählen" }),
    ).toBeVisible();
    await expect(
      page.getByText("Dieser Link ist nicht mehr gültig"),
    ).toBeVisible();
    await page.getByRole("link", { name: "Neuen Link anfordern" }).click();
    await expect(page).toHaveURL(/\/de\/passwort-vergessen$/);
  });

  test("the way back after sign-in never leaves the shop", async ({
    page,
    request,
  }) => {
    await request.post(`${MOCK}/v1/store/auth/signup`, { data: anna });
    await page.goto("/en/sign-in?returnTo=https://evil.example/");
    await page.getByLabel("Email address").fill("anna@example.com");
    await password(page).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
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
