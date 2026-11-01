import { expect, test, type Page } from "@playwright/test";
import { createAccount, MOCK } from "./helpers";

// Ordering without an account (doc 20): the guest checkout and the guest
// order page the emails and the way back from Stripe lead to.

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__mock/reset`);
});

/** The id of the pack size a product page stands for: the cart's key. */
async function variantId(page: Page, slug: string): Promise<string> {
  const response = await page.request.get(`${MOCK}/v1/store/products/${slug}`);
  return (await response.json()).product.variantId;
}

/** Puts pack sizes into the visitor's cart before the page loads. */
async function seedGuestCart(page: Page, slug: string, quantity: number) {
  const id = await variantId(page, slug);
  await page.addInitScript(
    (cart) => {
      window.localStorage.setItem("rf.cart.v2", JSON.stringify(cart));
    },
    [{ variantId: id, quantity }],
  );
}

async function fillAddress(page: Page) {
  await page.getByLabel("First name").fill("Gita");
  await page.getByLabel("Last name").fill("Guest");
  await page.getByLabel("Street").fill("Hauptstraße");
  await page.getByLabel("House number").fill("12a");
  await page.getByLabel("Postcode").fill("60311");
  await page.getByLabel("City").fill("Frankfurt am Main");
  await page.getByRole("button", { name: "Save address" }).click();
}

test.describe("a guest orders", () => {
  test("with an email address and an address, pays, and sees the order by its token", async ({
    page,
  }) => {
    await seedGuestCart(page, "chakki-atta-5kg", 2);
    await page.goto("/en/checkout");
    await page.getByRole("button", { name: "Continue as guest" }).click();

    // The email first; a bad one is said at the field.
    const order = page.getByRole("complementary", { name: "Your order" });
    await expect(order).toContainText("Chakki Atta (5kg)");
    await expect(order).toContainText("€30.97");
    await fillAddress(page);
    await expect(page.getByRole("radio")).toBeChecked();
    await expect(page.getByText("Gita Guest")).toBeVisible();
    // A guest has the one address: nothing to add.
    await expect(
      page.getByRole("button", { name: "Add an address" }),
    ).toHaveCount(0);

    await page
      .getByRole("textbox", { name: "Email address" })
      .fill("not-an-email");
    await page.getByRole("checkbox", { name: /Terms and Conditions/ }).check();
    await page.getByRole("button", { name: "Buy now" }).click();
    await expect(
      page.getByText("Please enter a valid email address."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/en\/checkout$/);

    // A discount code is priced with the preview.
    await page.getByLabel("Discount code").fill("diwali10");
    await order.getByRole("button", { name: "Apply" }).click();
    await expect(order).toContainText("Code DIWALI10 applied");
    await expect(order).toContainText("€28.37");

    await page
      .getByRole("textbox", { name: "Email address" })
      .fill("Gita@Example.com");
    await page.getByRole("button", { name: "Buy now" }).click();
    await expect(page).toHaveURL(/__mock\/stripe\/RF-1085$/);
    await expect(page.getByText("28.37 EUR")).toBeVisible();
    await page.getByRole("link", { name: "Pay by card" }).click();

    // Back on the guest order page, with the token in the address.
    await expect(page).toHaveURL(
      /\/en\/guest\/orders\/RF-1085\?token=[A-Za-z0-9_-]+&payment=success$/,
    );
    await expect(page.getByText("Thank you, your order is paid")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Order RF-1085" }),
    ).toBeVisible();
    await expect(page.getByText("Gita Guest")).toBeVisible();
    await expect(page.getByText("Discount code DIWALI10")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create an account" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Request a return" }),
    ).toHaveCount(0);
    // The browser's cart did its work.
    await expect(page.getByRole("link", { name: "Cart, empty" })).toBeVisible();

    // The token is kept for the tab: the page opens without it too.
    await page.goto("/en/guest/orders/RF-1085");
    await expect(
      page.getByRole("heading", { level: 1, name: "Order RF-1085" }),
    ).toBeVisible();
    // A wrong token is refused.
    await page.goto("/en/guest/orders/RF-1085?token=not-the-token-0000");
    await expect(page.getByText("This link is not valid.")).toBeVisible();
  });

  test("an email address that has an account leads to the sign-in, filled in, with the cart kept", async ({
    page,
    request,
  }) => {
    await createAccount(request, { email: "priya@example.com" });
    await seedGuestCart(page, "chakki-atta-5kg", 1);
    await page.goto("/en/checkout");
    await page.getByRole("button", { name: "Continue as guest" }).click();
    await fillAddress(page);
    await page
      .getByRole("textbox", { name: "Email address" })
      .fill("priya@example.com");
    await page.getByRole("checkbox", { name: /Terms and Conditions/ }).check();
    await page.getByRole("button", { name: "Buy now" }).click();
    await expect(page).toHaveURL(
      /\/en\/sign-in\?returnTo=%2Fcheckout&email=priya%40example\.com$/,
    );
    await expect(
      page.getByRole("textbox", { name: "Email address" }),
    ).toHaveValue("priya@example.com");
    await expect(
      page.getByRole("link", { name: /Cart, 1 item/ }),
    ).toBeVisible();
  });

  test("the way back from Stripe without paying, and giving the order up", async ({
    page,
  }) => {
    await seedGuestCart(page, "chakki-atta-5kg", 1);
    await page.goto("/en/checkout");
    await page.getByRole("button", { name: "Continue as guest" }).click();
    await fillAddress(page);
    await page
      .getByRole("textbox", { name: "Email address" })
      .fill("gita@example.com");
    await page.getByRole("checkbox", { name: /Terms and Conditions/ }).check();
    await page.getByRole("button", { name: "Buy now" }).click();
    await expect(page).toHaveURL(/__mock\/stripe\/RF-1085$/);
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page).toHaveURL(
      /\/en\/guest\/orders\/RF-1085\?token=.*payment=cancelled$/,
    );
    await expect(page.getByText("Payment not completed")).toBeVisible();
    // "Pay now" stands in the outcome and in the payment panel.
    await expect(
      page.getByRole("button", { name: "Pay €17.98 now" }).first(),
    ).toBeVisible();
    // Nothing paid: the cart is still there for a new order.
    await expect(
      page.getByRole("link", { name: /Cart, 1 item/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Cancel order" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel the order now" })
      .click();
    await expect(page.getByText("Your order is cancelled.")).toBeVisible();
  });
});
