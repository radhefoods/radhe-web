import { expect, test, type Page } from "@playwright/test";

const MOCK = "http://localhost:3000";
const DEMO = "demo@radhefoods.de";

// The demo account of the mock comes with six orders:
//   RF-1085 delivered and paid, with a return request waiting
//   RF-1086 waiting for its payment, 36.95, the payment page open
//   RF-1087 paid, on its way with DHL
//   RF-1088 paid, cancelled by the customer and refunded
//   RF-1089 paid and confirmed (can be cancelled)
//   RF-1090 cancelled by the API: a product sold out before the capture

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

const payButton = (page: Page) =>
  page.getByRole("button", { name: "Pay €36.95 now" });

test.describe("the account", () => {
  test("greets, puts what waits for its payment first, and lists the latest orders", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/en/account");
    await expect(
      page.getByRole("heading", { level: 1, name: "Hello Priya" }),
    ).toBeVisible();
    await expect(page.getByText(`Signed in as ${DEMO}`)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Order RF-1086: €36.95" }),
    ).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(3);

    await page.getByRole("link", { name: "All orders" }).click();
    await expect(page).toHaveURL(/\/en\/account\/orders$/);
    await expect(page.getByRole("article")).toHaveCount(6);
    const waiting = page.getByRole("article").filter({ hasText: "RF-1086" });
    await expect(waiting).toContainText("Waiting for payment");
    const refunded = page.getByRole("article").filter({ hasText: "RF-1088" });
    await expect(refunded).toContainText("Cancelled");
    await expect(refunded).toContainText("Refunded");
  });

  test("a visitor is sent to sign in and comes back to the same order", async ({
    page,
    request,
  }) => {
    // The account exists; this browser has no session yet.
    await request.post(`${MOCK}/v1/store/auth/signup`, {
      data: {
        firstName: "Priya",
        lastName: "Shah",
        email: DEMO,
        password: PASSWORD,
      },
    });
    await page.goto("/en/account/orders/RF-1087");
    await expect(page).toHaveURL(
      /\/en\/sign-in\?returnTo=%2Faccount%2Forders%2FRF-1087$/,
    );
    await page.getByLabel("Email address").fill(DEMO);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/account\/orders\/RF-1087$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Order RF-1087" }),
    ).toBeVisible();
  });

  test("in German, with German addresses and words", async ({ page }) => {
    await signIn(page);
    await page.goto("/de/konto/bestellungen");
    await expect(
      page.getByRole("heading", { level: 1, name: "Ihre Bestellungen" }),
    ).toBeVisible();
    const waiting = page.getByRole("article").filter({ hasText: "RF-1086" });
    await expect(waiting).toContainText("Wartet auf Zahlung");
    await expect(waiting).toContainText("36,95 €");
    await waiting
      .getByRole("link", { name: "Bestellung RF-1086 ansehen" })
      .click();
    await expect(page).toHaveURL(/\/de\/konto\/bestellungen\/RF-1086$/);
    await expect(
      page.getByRole("button", { name: "Jetzt 36,95 € bezahlen" }),
    ).toBeVisible();
  });
});

test.describe("an order", () => {
  test("shows where it is, with the parcel link", async ({ page }) => {
    await signIn(page);
    await page.goto("/en/account/orders/RF-1087");
    const progress = page.getByRole("region", { name: "Progress" });
    await expect(progress.locator("[aria-current=step]")).toHaveText(
      /On its way/,
    );
    await expect(progress).toContainText("Parcel with DHL");
    await expect(
      progress.getByRole("link", { name: "Track parcel" }),
    ).toHaveAttribute("href", /dhl\.de/);
    await expect(page.getByRole("region", { name: "Payment" })).toContainText(
      "Paid on",
    );
  });

  test("waits for its payment, is paid on the payment page and confirmed at once", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/en/account/orders/RF-1086");
    const payment = page.getByRole("region", { name: "Payment" });
    await expect(payment).toContainText("€36.95");
    await expect(payment).toContainText("waits for the payment");
    const progress = page.getByRole("region", { name: "Progress" });
    await expect(progress.locator("[aria-current=step]")).toHaveText(/Payment/);
    await expect(progress).toContainText("Estimated delivery: 2 to 4");

    await payment.getByRole("button", { name: "Pay €36.95 now" }).click();
    await expect(page).toHaveURL(/__mock\/stripe\/RF-1086$/);
    await page.getByRole("link", { name: "Pay by card" }).click();

    await expect(page).toHaveURL(
      /\/en\/account\/orders\/RF-1086\?payment=success$/,
    );
    await expect(page.getByText("Thank you, your order is paid")).toBeVisible();
    await expect(payment).toContainText("Paid on");
    await expect(payment).toContainText("by card");
    await expect(payment).toContainText("Invoice INV-");
    await expect(payButton(page)).toHaveCount(0);
    await expect(
      page
        .getByRole("heading", { level: 1 })
        .locator("..")
        .getByText("Confirmed"),
    ).toBeVisible();
  });

  test("a payment page that was left charges nothing and can be opened again", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/en/account/orders/RF-1086");
    await payButton(page).click();
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/RF-1086\?payment=cancelled$/);
    await expect(page.getByText("Payment not completed")).toBeVisible();
    await expect(page.getByText("Nothing was charged.").first()).toBeVisible();
    await expect(payButton(page).first()).toBeVisible();
  });

  test("with PayPal the confirmation arrives a moment later", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/en/account/orders/RF-1086");
    await payButton(page).click();
    await page.getByRole("link", { name: "Pay with PayPal" }).click();
    await expect(page).toHaveURL(/RF-1086\?payment=success$/);
    await expect(
      page.getByText("We are confirming your payment"),
    ).toBeVisible();
    // The mock's "webhook" settles a few seconds after the return; the page
    // asks again every three seconds.
    await expect(page.getByText("Thank you, your order is paid")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("region", { name: "Payment" })).toContainText(
      "with PayPal",
    );
  });

  test("a failed attempt is explained and can be tried again", async ({
    page,
    request,
  }) => {
    await signIn(page);
    await request.post(`${MOCK}/__mock/payment`, {
      data: { orderNumber: "RF-1086", action: "fail" },
    });
    await page.goto("/en/account/orders/RF-1086");
    await expect(
      page.getByText("The payment did not go through"),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Progress" })).toContainText(
      "The last attempt did not go through.",
    );
    await payButton(page).first().click();
    await expect(page).toHaveURL(/__mock\/stripe\/RF-1086$/);
    await page.getByRole("link", { name: "Pay by card" }).click();
    await expect(page.getByText("Thank you, your order is paid")).toBeVisible();
  });

  test("the link of the payment email opens the payment page at once", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/en/account/orders/RF-1086?pay=1");
    await expect(page).toHaveURL(/__mock\/stripe\/RF-1086$/);
  });

  test("a product that sold out before the capture is said plainly", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/en/account/orders/RF-1090");
    await expect(
      page.getByText("A product sold out before your payment was captured"),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "To the cart" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Payment" })).toContainText(
      "Nothing was charged for this order.",
    );
    await expect(page.getByRole("region", { name: "Progress" })).toContainText(
      "Nothing was charged.",
    );
    await expect(page.getByRole("button", { name: /Pay/ })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Cancel order" }),
    ).toHaveCount(0);
  });

  test("offers no online payment while it is not set up", async ({
    page,
    request,
  }) => {
    await signIn(page);
    await request.post(`${MOCK}/__mock/stripe`, { data: { enabled: false } });
    await page.goto("/en/account/orders/RF-1086");
    const payment = page.getByRole("region", { name: "Payment" });
    await expect(payment).toContainText(
      "Online payment is not available at the moment",
    );
    await expect(payment.getByRole("button", { name: /Pay/ })).toHaveCount(0);
  });

  test("can be cancelled while it is only confirmed", async ({ page }) => {
    await signIn(page);
    await page.goto("/en/account/orders/RF-1089");
    await page.getByRole("button", { name: "Cancel order" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel order RF-1089" });
    await expect(dialog).toContainText("Radhe Foods refunds what you paid");
    await dialog.getByLabel("I ordered by mistake").check();
    await dialog.getByRole("button", { name: "Cancel the order now" }).click();
    await expect(page.getByText("Your order is cancelled.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cancel order" }),
    ).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Progress" })).toContainText(
      "Cancelled by you",
    );
    // A delivered order offers no cancelling.
    await page.goto("/en/account/orders/RF-1085");
    await expect(
      page.getByRole("heading", { level: 1, name: "Order RF-1085" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cancel order" }),
    ).toHaveCount(0);
  });

  test("an unpaid order can be given up, and nothing is charged", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/en/account/orders/RF-1086");
    await page.getByRole("button", { name: "Cancel order" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel order RF-1086" });
    await expect(dialog).toContainText("This order is not paid yet.");
    await dialog.getByRole("button", { name: "Cancel the order now" }).click();
    await expect(page.getByText("Your order is cancelled.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Payment" })).toContainText(
      "Nothing was charged for this order.",
    );
    await expect(payButton(page)).toHaveCount(0);
  });

  test("a return is requested with a reason, and can be withdrawn", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/en/account/orders/RF-1085");
    await page.getByRole("link", { name: "Request a return" }).click();
    await expect(page).toHaveURL(/\/en\/account\/orders\/RF-1085\/return$/);

    await page.getByRole("button", { name: "Send the request" }).click();
    await expect(page.getByText("Choose at least one product.")).toBeVisible();

    const rice = page.getByRole("group", {
      name: "Units of Basmati Rice (5kg) to return",
    });
    await rice.getByRole("button", { name: "One more" }).click();
    await page.getByRole("button", { name: "Send the request" }).click();
    await expect(page.getByText("Please choose a reason.")).toBeVisible();

    await page.getByLabel("Reason").first().selectOption("damaged");
    await page
      .getByLabel("What is wrong? (optional)")
      .first()
      .fill("Bag was torn");
    await page.getByRole("button", { name: "Send the request" }).click();

    await expect(page).toHaveURL(/\/en\/account\/orders\/RF-1085$/);
    const returns = page.getByRole("region", { name: "Returns" });
    const request = returns
      .getByRole("listitem")
      .filter({ hasText: "Return RF-1085-R2" });
    await expect(request).toContainText("Waiting for our answer");
    await expect(request).toContainText("1 × Basmati Rice (5kg)");

    await request.getByRole("button", { name: "Withdraw the request" }).click();
    await expect(request).toContainText("Withdrawn");
  });
});

test.describe("documents, addresses, profile", () => {
  test("invoices are listed and download as PDF", async ({ page }) => {
    await signIn(page);
    await page.goto("/en/account/invoices");
    const rows = page.getByRole("listitem").filter({ hasText: "Invoice INV-" });
    await expect(rows).toHaveCount(4);
    const download = page.waitForEvent("download");
    await rows
      .first()
      .getByRole("button", { name: /Download INV-.* as PDF/ })
      .click();
    expect((await download).suggestedFilename()).toMatch(
      /^INV-\d{4}-\d{6}\.pdf$/,
    );
  });

  test("addresses are added, made standard and deleted", async ({ page }) => {
    await signIn(page);
    await page.goto("/en/account/addresses");
    await expect(page.getByText("Hauptstraße 12")).toBeVisible();

    await page.getByRole("button", { name: "Add an address" }).click();
    await page.getByLabel("First name").fill("Priya");
    await page.getByLabel("Last name").fill("Office");
    await page.getByLabel("Street").fill("Kastanienallee");
    await page.getByLabel("House number").fill("7b");
    await page.getByLabel("Postcode").fill("10435");
    await page.getByLabel("City").fill("Berlin");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText("Kastanienallee 7b")).toBeVisible();

    await page
      .getByRole("button", {
        name: "Make the address of Priya Office the standard",
      })
      .click();
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "Kastanienallee 7b" })
        .getByText("Standard", { exact: true }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Delete the address of Priya Shah" })
      .click();
    await expect(page.getByText("Hauptstraße 12")).toHaveCount(0);
  });

  test("the profile is saved, news switched on, and signing out works", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/en/account/profile");
    await page.getByLabel("First name").fill("Anjali");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.").first()).toBeVisible();

    const news = page.getByRole("checkbox", { name: /send me news/ });
    await expect(news).not.toBeChecked();
    await news.check();
    await expect(news).toBeChecked();
    // WhatsApp is built but switched off for now.
    await expect(page.getByText("WhatsApp")).toHaveCount(0);

    await page
      .getByRole("navigation", { name: "Account" })
      .getByRole("link", { name: "Overview" })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Hello Anjali" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/en$/);
    await page.goto("/en/account");
    await expect(page).toHaveURL(/\/en\/sign-in\?returnTo=%2Faccount$/);
  });
});
