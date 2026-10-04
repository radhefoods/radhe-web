import { expect, test, type Page } from "@playwright/test";

const MOCK = "http://localhost:3000";
const DEMO = "demo@radhefoods.de";

// The demo account of the mock comes with five orders:
//   RF-1085 delivered and paid (with a return request waiting)
//   RF-1086 delivered, invoice issued, 36.95 to pay
//   RF-1087 on its way with DHL
//   RF-1088 cancelled
//   RF-1089 confirmed (can be cancelled)

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__mock/reset`);
});

/** Signs the browser in through the API: the session cookies are set. */
async function signIn(page: Page, email = DEMO) {
  await page.request.post(`${MOCK}/v1/store/auth/otp/request`, {
    data: { email },
  });
  await page.request.post(`${MOCK}/v1/store/auth/otp/verify`, {
    data: { email, code: "123456" },
  });
}

test.describe("the account", () => {
  test("greets, puts what is to pay first, and lists the latest orders", async ({
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
    await expect(page.getByRole("article")).toHaveCount(5);
    const due = page.getByRole("article").filter({ hasText: "RF-1086" });
    await expect(due).toContainText("Delivered");
    await expect(due).toContainText("Payment due");
  });

  test("a visitor is sent to sign in and comes back to the same order", async ({
    page,
  }) => {
    await page.goto("/en/account/orders/RF-1087");
    await expect(page).toHaveURL(
      /\/en\/sign-in\?returnTo=%2Faccount%2Forders%2FRF-1087$/,
    );
    await page.getByLabel("Email address").fill(DEMO);
    await page.getByRole("button", { name: "Send code" }).click();
    await page.getByLabel("6-digit code").fill("123456");
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
    const due = page.getByRole("article").filter({ hasText: "RF-1086" });
    await expect(due).toContainText("Zahlung fällig");
    await expect(due).toContainText("36,95 €");
    await due.getByRole("link", { name: "Bestellung RF-1086 ansehen" }).click();
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
    await expect(page.getByText("Nothing to pay yet.")).toBeVisible();
  });

  test("is paid on the payment page and shows it at once", async ({ page }) => {
    await signIn(page);
    await page.goto("/en/account/orders/RF-1086");
    const payment = page.getByRole("region", { name: "Payment" });
    await expect(payment).toContainText("€36.95");
    await expect(payment).toContainText("Please pay by");
    await expect(payment).toContainText("cash to our driver");

    await payment.getByRole("button", { name: "Pay €36.95 now" }).click();
    await expect(page).toHaveURL(/__mock\/stripe\/RF-1086$/);
    await page.getByRole("link", { name: "Pay by card" }).click();

    await expect(page).toHaveURL(
      /\/en\/account\/orders\/RF-1086\?payment=success$/,
    );
    await expect(page.getByText("Payment received")).toBeVisible();
    await expect(payment).toContainText("Paid on");
    await expect(payment).toContainText("by card");
    await expect(
      payment.getByRole("button", { name: /Pay .* now/ }),
    ).toHaveCount(0);
  });

  test("a cancelled payment charges nothing and can be tried again", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/en/account/orders/RF-1086");
    await page.getByRole("button", { name: "Pay €36.95 now" }).click();
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/RF-1086\?payment=cancelled$/);
    await expect(page.getByText("Payment cancelled")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pay €36.95 now" }),
    ).toBeVisible();
  });

  test("offers no online payment while it is not set up", async ({
    page,
    request,
  }) => {
    await signIn(page);
    await request.post(`${MOCK}/__mock/stripe`, { data: { enabled: false } });
    await page.goto("/en/account/orders/RF-1086");
    const payment = page.getByRole("region", { name: "Payment" });
    await expect(payment).toContainText("cash to our driver");
    await expect(payment.getByRole("button", { name: /Pay/ })).toHaveCount(0);
  });

  test("can be cancelled while it is only confirmed", async ({ page }) => {
    await signIn(page);
    await page.goto("/en/account/orders/RF-1089");
    await page.getByRole("button", { name: "Cancel order" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel order RF-1089" });
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
    await page.goto("/en/account/orders/RF-1086");
    await expect(
      page.getByRole("heading", { level: 1, name: "Order RF-1086" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cancel order" }),
    ).toHaveCount(0);
  });

  test("a return is requested with a reason, and can be withdrawn", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/en/account/orders/RF-1086");
    await page.getByRole("link", { name: "Request a return" }).click();
    await expect(page).toHaveURL(/\/en\/account\/orders\/RF-1086\/return$/);

    await page.getByRole("button", { name: "Send the request" }).click();
    await expect(page.getByText("Choose at least one product.")).toBeVisible();

    const atta = page.getByRole("group", {
      name: "Units of Chakki Atta, 5 kg to return",
    });
    await atta.getByRole("button", { name: "One more" }).click();
    await page.getByRole("button", { name: "Send the request" }).click();
    await expect(page.getByText("Please choose a reason.")).toBeVisible();

    await page.getByLabel("Reason").selectOption("damaged");
    await page.getByLabel("What is wrong? (optional)").fill("Bag was torn");
    await page.getByRole("button", { name: "Send the request" }).click();

    await expect(page).toHaveURL(/\/en\/account\/orders\/RF-1086$/);
    const returns = page.getByRole("region", { name: "Returns" });
    await expect(returns).toContainText("Return RF-1086-R1");
    await expect(returns).toContainText("Waiting for our answer");
    await expect(returns).toContainText("1 × Chakki Atta, 5 kg");

    await returns.getByRole("button", { name: "Withdraw the request" }).click();
    await expect(returns).toContainText("Withdrawn");
  });
});

test.describe("documents, addresses, profile", () => {
  test("invoices are listed and download as PDF", async ({ page }) => {
    await signIn(page);
    await page.goto("/en/account/invoices");
    const rows = page.getByRole("listitem").filter({ hasText: "Invoice INV-" });
    await expect(rows).toHaveCount(2);
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
