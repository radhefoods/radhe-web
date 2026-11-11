import { expect, test, type Page } from "@playwright/test";
import { createAccount, MOCK, PASSWORD, signupCode } from "./helpers";

// The loyalty coins (doc/REWARDS.md 8): redeemed on the checkout page,
// shown on the bill and the order, collected on the account's coins page,
// given with the sign-up, explained on "How it works".

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__mock/reset`);
});

async function variantId(page: Page, slug: string): Promise<string> {
  const response = await page.request.get(`${MOCK}/v1/store/products/${slug}`);
  return (await response.json()).product.variantId;
}

/**
 * A new customer (100 welcome coins) with an address and two bags of atta
 * in the stored cart: 25.98 of goods, 4.99 delivery. 100 coins at 0.01 %
 * take 26 cents off; 99 do the same, so 99 is the most the bill allows.
 */
async function seedCustomer(page: Page, email = "priya@example.com") {
  const api = page.request;
  await createAccount(api, { email });
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
  await api.put(
    `${MOCK}/v1/store/cart/items/${await variantId(page, "chakki-atta-5kg")}`,
    { data: { quantity: 2 } },
  );
}

const summary = (page: Page) =>
  page.getByRole("complementary", { name: "Your order" });

test.describe("coins on the checkout page", () => {
  test("are offered with the balance, redeemed by number or all, shown on the bill and removed again", async ({
    page,
  }) => {
    await seedCustomer(page);
    await page.goto("/en/checkout");
    const box = summary(page);
    await expect(box).toContainText("You have 100 coins.");
    await expect(box).toContainText("Redeem up to 99 coins for €0.26.");
    await expect(box).toContainText("You will earn 26 coins with this order.");
    const field = page.getByRole("spinbutton", { name: "Coins to redeem" });
    await expect(field).toHaveValue("99");

    // 59 coins would take 15 cents off; 56 do the same, 56 are taken.
    await field.fill("59");
    await page.getByRole("button", { name: "Redeem", exact: true }).click();
    await expect(box).toContainText("56 coins redeemed");
    await expect(box).toContainText("You save €0.15.");
    await expect(box).toContainText("Coins redeemed (56)");
    await expect(box).toContainText("−€0.15");
    await expect(box).toContainText("€30.82");
    await expect(field).toHaveCount(0);

    await page.getByRole("button", { name: "Remove the coins" }).click();
    await expect(box).not.toContainText("Coins redeemed");
    await expect(box).toContainText("€30.97");
    await page.getByRole("button", { name: "Redeem all" }).click();
    await expect(box).toContainText("99 coins redeemed");
    await expect(box).toContainText("You save €0.26.");
    await expect(box).toContainText("€30.71");

    // A number that is not one is refused in the form.
    await page.getByRole("button", { name: "Remove the coins" }).click();
    await field.fill("0");
    await page.getByRole("button", { name: "Redeem", exact: true }).click();
    await expect(
      page.getByText("Enter a whole number of coins, 1 or more."),
    ).toBeVisible();
    // More than the customer has: the API's reason.
    await field.fill("500");
    await page.getByRole("button", { name: "Redeem", exact: true }).click();
    await expect(
      page.getByText("You do not have that many coins."),
    ).toBeVisible();
  });

  test("give way to the reason while coins cannot be used, and are dropped at checkout when they stopped applying", async ({
    page,
    request,
  }) => {
    await seedCustomer(page);
    await request.post(`${MOCK}/__mock/rewards`, {
      data: {
        settings: { redemption: { combinableWithDiscountCodes: false } },
      },
    });
    await page.goto("/en/checkout");
    await page.getByLabel("Discount code").fill("DIWALI10");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(summary(page)).toContainText("Code DIWALI10 applied");
    await expect(summary(page)).toContainText(
      "Coins cannot be combined with a discount code.",
    );
    await expect(page.getByRole("spinbutton")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Remove the code DIWALI10" })
      .click();
    await expect(page.getByRole("spinbutton")).toBeVisible();

    // Redeemed, then the balance is gone before the order is placed: the
    // API refuses the checkout, the bill is loaded again without the coins.
    await page.getByRole("button", { name: "Redeem all" }).click();
    await expect(summary(page)).toContainText("99 coins redeemed");
    await request.post(`${MOCK}/__mock/rewards`, {
      data: {
        adjust: { email: "priya@example.com", coins: -100, reason: "misuse" },
      },
    });
    await page.getByRole("checkbox", { name: /Terms and Conditions/ }).check();
    await page.getByRole("button", { name: "Buy now" }).click();
    await expect(
      page.getByText("Your coins were not redeemed", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "You have no coins to redeem. You can place the order without them.",
      ),
    ).toBeVisible();
    await expect(summary(page)).not.toContainText("coins redeemed");
    await expect(summary(page)).toContainText("€30.97");
    // Without coins there is no box and no reason line.
    await expect(page.getByRole("spinbutton")).toHaveCount(0);
  });
});

test.describe("the coins in the account", () => {
  test("show on the overview, the coins page with the rules and the history, and the order", async ({
    page,
    request,
  }) => {
    await seedCustomer(page);
    const api = page.request;
    // An order with 56 coins, paid and delivered, through the API.
    const bill = await (
      await api.put(`${MOCK}/v1/store/checkout/rewards`, {
        data: { coins: 56 },
      })
    ).json();
    const legal = await (await api.get(`${MOCK}/v1/store/legal`)).json();
    const address = (
      await (await api.get(`${MOCK}/v1/store/me/addresses`)).json()
    ).items[0];
    const placed = await (
      await api.post(`${MOCK}/v1/store/checkout`, {
        headers: { "Idempotency-Key": "e2e-coins-0001" },
        data: {
          addressId: address.id,
          expectedTotal: bill.totals.total,
          consent: {
            accepted: true,
            // Only the texts that are accepted at checkout (doc 6).
            versions: Object.fromEntries(
              legal.items
                .filter((d: { requiresConsent: boolean }) => d.requiresConsent)
                .map((d: { type: string; version: number }) => [
                  d.type,
                  d.version,
                ]),
            ),
          },
        },
      })
    ).json();
    const orderNumber = placed.order.orderNumber as string;
    await request.post(`${MOCK}/__mock/payment`, {
      data: { orderNumber, action: "settle" },
    });
    await request.post(`${MOCK}/__mock/order`, {
      data: { orderNumber, actions: ["deliver"] },
    });

    await page.goto("/en/account");
    const tile = page.getByRole("link", {
      name: /Coins Redeem at the checkout/,
    });
    await expect(tile).toContainText("70");
    await page
      .getByRole("navigation", { name: "Account" })
      .getByRole("link", { name: "Coins" })
      .click();
    await expect(page).toHaveURL(/\/en\/account\/coins$/);
    await expect(
      page.getByRole("heading", { name: "Your coins" }),
    ).toBeVisible();
    await expect(page.getByText("70coins")).toBeVisible();
    await expect(page.getByText("Earned in all")).toBeVisible();
    await expect(page.getByText("126", { exact: true })).toBeVisible();
    await expect(page.getByText("Redeemed in all")).toBeVisible();
    await expect(page.getByText("56", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "1 coin per euro of goods, counted when the order is delivered.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("100 coins take 1% off the goods of an order."),
    ).toBeVisible();
    await expect(page.getByText("At most €5.00 per order.")).toBeVisible();
    const rows = page
      .getByRole("list")
      .filter({ hasText: "Welcome coins" })
      .getByRole("listitem");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText(`Order ${orderNumber}`);
    await expect(rows.nth(0)).toContainText("+26");
    await expect(rows.nth(1)).toContainText(`Redeemed on ${orderNumber}`);
    await expect(rows.nth(1)).toContainText("−56");
    await expect(rows.nth(2)).toContainText("Welcome coins");
    await expect(rows.nth(2)).toContainText("+100");

    await rows.nth(1).getByRole("link").click();
    await expect(page).toHaveURL(
      new RegExp(`/en/account/orders/${orderNumber}$`),
    );
    await expect(page.getByText("Coins redeemed (56)")).toBeVisible();
    await expect(page.getByText("−€0.15")).toBeVisible();
  });

  test("say so while the program is paused, and the page stays reachable with a balance", async ({
    page,
    request,
  }) => {
    await seedCustomer(page);
    await request.post(`${MOCK}/__mock/rewards`, {
      data: { settings: { enabled: false } },
    });
    await page.goto("/en/account");
    await expect(
      page.getByRole("link", { name: /Redeem at the checkout/ }),
    ).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "Account" })
      .getByRole("link", { name: "Coins" })
      .click();
    await expect(
      page.getByText(
        "The coins program is paused at the moment. Your balance stays.",
      ),
    ).toBeVisible();
    await expect(page.getByText("100coins")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "How it works" }),
    ).toHaveCount(0);
  });
});

test.describe("the welcome coins", () => {
  test("are announced after the emailed code, in German too", async ({
    page,
  }) => {
    await page.goto("/de/registrieren");
    await page.getByLabel("Vorname").fill("Anna");
    await page.getByLabel("Nachname").fill("Schmidt");
    await page.getByLabel("E-Mail-Adresse").fill("anna@example.com");
    await page.getByLabel("Passwort", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Konto anlegen" }).click();
    await page
      .getByLabel("Code")
      .fill(await signupCode(page.request, "anna@example.com"));
    await page.getByRole("button", { name: "Bestätigen" }).click();
    await expect(page.getByText("Ihr Konto ist bereit.")).toBeVisible();
    await expect(
      page.getByText(
        "Sie haben 100 Coins erhalten. Lösen Sie sie an der Kasse ein.",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Weiter" }).click();
    await expect(page).toHaveURL(/\/de\/konto$/);
    await expect(
      page.getByRole("link", { name: /An der Kasse einlösen/ }),
    ).toContainText("100");
  });
});

test.describe("the public page", () => {
  test("explains the coins while the program is on", async ({ page }) => {
    await page.goto("/en/how-it-works");
    await expect(
      page.getByRole("heading", { name: "Collect coins" }),
    ).toBeVisible();
    await expect(
      page.getByText("100 coins for creating your account."),
    ).toBeVisible();
    await expect(
      page.getByText("25 coins for a published review."),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Your coins" }),
    ).toHaveAttribute("href", "/en/account/coins");
  });
});
