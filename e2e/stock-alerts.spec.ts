import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { MOCK, createAccount, settled } from "./helpers";

// "Notify me" (doc 26): for a pack size that cannot be ordered, a visitor
// asks with an address and confirms it by a link, a customer asks with one
// tap; both take it back; and nothing of it shows while the shop does not
// offer the emails. The Kesar mango of the fixtures is sold out.
//
// The shop reads the switch with the settings on its server and keeps them
// for five minutes. `next dev` reads them afresh for a page that is asked
// for the way a hard reload asks (`Cache-Control: no-cache`), so every page
// of this spec is opened that way and shows the switch as it stands. A
// built shop (`next start`) ignores that, and a page opened right after the
// switch changed can show the old state for up to five minutes: `open`
// loads it again until it shows the new one. Run this spec against
// `next dev`.

// The first visit of a page compiles it in `next dev`.
test.describe.configure({ timeout: 180_000 });

const MANGO = "Kesar Mango, Box (3kg)";
const MANGO_PAGE = "/en/products/kesar-mango-box-3kg";
const MANGO_LIST = "/en/products?q=kesar";
const NOTIFY = `Notify me when ${MANGO} is back`;
const CANCEL = `Cancel the notification for ${MANGO}`;

test.beforeEach(async ({ page, request }) => {
  await request.post(`${MOCK}/__mock/reset`);
  await page.route("http://localhost:3001/**", async (route) => {
    const sent = route.request();
    await route.continue(
      sent.isNavigationRequest()
        ? { headers: { ...sent.headers(), "cache-control": "no-cache" } }
        : {},
    );
  });
});

const switchOn = (
  request: APIRequestContext,
  rules: Record<string, boolean> = {},
) =>
  request.post(`${MOCK}/__mock/stock-alerts`, {
    data: { enabled: true, ...rules },
  });

/** The requests of an address in the mock, with the tokens of their emails. */
async function requestsOf(request: APIRequestContext, email: string) {
  const response = await request.get(
    `${MOCK}/__mock/stock-alerts?email=${encodeURIComponent(email)}`,
  );
  return (
    (await response.json()) as {
      items: {
        variantId: string;
        status: string;
        locale: string;
        confirmToken: string;
        unsubscribeToken: string;
      }[];
    }
  ).items;
}

async function variantIdOf(request: APIRequestContext, slug: string) {
  const response = await request.get(`${MOCK}/v1/store/products/${slug}`);
  return (await response.json()).product.variantId as string;
}

/** A visitor's request, made through the API. */
async function ask(request: APIRequestContext, slug: string, email: string) {
  const response = await request.post(`${MOCK}/v1/store/stock-alerts`, {
    data: { variantId: await variantIdOf(request, slug), email, consent: true },
  });
  expect(response.status(), "the mock takes the request").toBe(202);
}

/**
 * Opens a page of the shop and waits until it shows "Notify me" the way
 * the switch stands now (`offered`), loading it again while it shows the
 * settings of a moment ago.
 */
async function open(page: Page, path: string, offered = true) {
  await expect(async () => {
    await page.goto(path);
    await expect(page.getByText("Sold out").first()).toBeVisible({
      timeout: 60_000,
    });
    const control = page.getByRole("button", { name: NOTIFY }).first();
    if (offered) await expect(control).toBeVisible({ timeout: 4000 });
    else await expect(control).toHaveCount(0, { timeout: 4000 });
  }).toPass({ timeout: 150_000 });
}

async function signIn(page: Page, email: string) {
  await createAccount(page.request, { email });
  await page.addInitScript(() => {
    window.localStorage.setItem("rf.session.v1", "1");
  });
}

const card = (page: Page) =>
  page.getByRole("article").filter({ hasText: "Kesar Mango" });

/** The block of "Notify me" on the product page. */
const panel = (page: Page) => page.locator("#notify-me");

async function expectNoBarriers(page: Page) {
  await settled(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    violations.map((violation) => `${violation.id}: ${violation.help}`),
  ).toEqual([]);
}

test.describe("while the shop does not offer the emails", () => {
  test("a sold-out size says so and nothing more, and the account has no such page", async ({
    page,
  }) => {
    await open(page, MANGO_PAGE, false);
    await expect(panel(page)).toHaveCount(0);
    await expect(page.getByText("Email me when this product")).toHaveCount(0);

    await open(page, MANGO_LIST, false);
    await expect(card(page)).toContainText("Sold out");
    await expect(card(page).getByRole("button")).toHaveCount(1); // the heart

    await signIn(page, "anna@example.com");
    await page.goto("/en/account");
    const nav = page.getByRole("navigation", { name: "Account" });
    await expect(nav.getByRole("link", { name: "Wishlist" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Notifications" })).toHaveCount(
      0,
    );
  });
});

test.describe("a visitor", () => {
  test("asks on the product page with an address and a ticked box, and is told to confirm", async ({
    page,
    request,
  }) => {
    await switchOn(request);
    await open(page, MANGO_PAGE);
    await expect(panel(page)).toContainText(
      "Email me when this product is back in stock.",
    );
    await panel(page).getByRole("button", { name: NOTIFY }).click();

    // The form opens in place, with the address first.
    const email = panel(page).getByLabel("Email address");
    await expect(email).toBeFocused();
    const send = panel(page).getByRole("button", { name: "Notify me" });
    await send.click();
    await expect(
      panel(page).getByText("Please enter a valid email address."),
    ).toBeVisible();
    await email.fill("gita@example.com");
    await send.click();
    await expect(
      panel(page).getByText("Please tick the box, so that we may email you."),
    ).toBeVisible();
    await expectNoBarriers(page);
    expect(await requestsOf(request, "gita@example.com")).toEqual([]);

    await panel(page)
      .getByLabel("I agree to receive one email when this product is available")
      .check();
    await send.click();
    await expect(panel(page)).toContainText("Almost done");
    await expect(panel(page)).toContainText(
      "Please confirm your address with the link we emailed you.",
    );
    await expect(email).toHaveCount(0);
    const [waiting] = await requestsOf(request, "gita@example.com");
    expect(waiting).toMatchObject({ status: "unconfirmed", locale: "en" });
  });

  test("is told that the email will come when the shop asks for no confirmation", async ({
    page,
    request,
  }) => {
    await switchOn(request, { guestConfirmation: false });
    await open(page, MANGO_PAGE);
    await panel(page).getByRole("button", { name: NOTIFY }).click();
    await panel(page).getByLabel("Email address").fill("gita@example.com");
    await panel(page).getByRole("checkbox").check();
    await panel(page).getByRole("button", { name: "Notify me" }).click();
    await expect(panel(page)).toContainText(
      "We will email you when it is back.",
    );
    await expect(panel(page)).not.toContainText("Almost done");
  });

  test("asks from a product card in a panel that slides over the page", async ({
    page,
    request,
  }) => {
    await switchOn(request);
    await open(page, MANGO_LIST);
    // The pill stays; the bell stands where the basket would.
    await expect(card(page)).toContainText("Sold out");
    await card(page).getByRole("button", { name: NOTIFY }).click();

    const sheet = page.getByRole("dialog", { name: "Notify me" });
    await expect(sheet).toContainText(MANGO);
    await expect(sheet.getByLabel("Email address")).toBeFocused();
    await expectNoBarriers(page);
    await sheet.getByLabel("Email address").fill("gita@example.com");
    await sheet.getByRole("checkbox").check();
    await sheet.getByRole("button", { name: "Notify me" }).click();
    await expect(sheet).toContainText("Almost done");
    await sheet.getByRole("button", { name: "Done" }).click();
    await expect(sheet).toHaveCount(0);
    // Back where the visitor was.
    await expect(
      card(page).getByRole("button", { name: NOTIFY }),
    ).toBeFocused();
    expect(await requestsOf(request, "gita@example.com")).toHaveLength(1);
  });

  test("reads German and gets German emails on the German page", async ({
    page,
    request,
  }) => {
    await switchOn(request);
    await expect(async () => {
      await page.goto("/de/produkte/kesar-mango-kiste-3kg");
      await expect(page.locator("#notify-me").getByRole("button")).toBeVisible({
        timeout: 60_000,
      });
    }).toPass({ timeout: 150_000 });
    await expect(panel(page)).toContainText(
      "Schreiben Sie mir, sobald dieser Artikel wieder da ist.",
    );
    await panel(page).getByRole("button").click();
    await panel(page).getByLabel("E-Mail-Adresse").fill("gita@example.com");
    await panel(page)
      .getByLabel("Ich bin einverstanden, eine E-Mail zu erhalten")
      .check();
    await panel(page)
      .getByRole("button", { name: "Benachrichtigen Sie mich" })
      .click();
    await expect(panel(page)).toContainText(
      "Bitte bestätigen Sie Ihre Adresse über den Link in unserer E-Mail.",
    );
    expect((await requestsOf(request, "gita@example.com"))[0].locale).toBe(
      "de",
    );
  });
});

test.describe("a signed-in customer", () => {
  test("asks with one tap on the product page, reads where the email goes and takes it back", async ({
    page,
    request,
  }) => {
    await switchOn(request);
    await signIn(page, "anna@example.com");
    await open(page, MANGO_PAGE);
    await panel(page).getByRole("button", { name: NOTIFY }).click();
    await expect(panel(page)).toContainText("We will notify you");
    await expect(panel(page)).toContainText(
      "We will email you at anna@example.com when it is back.",
    );
    // No form, and the request counts at once.
    await expect(panel(page).getByLabel("Email address")).toHaveCount(0);
    expect((await requestsOf(request, "anna@example.com"))[0].status).toBe(
      "active",
    );
    await expectNoBarriers(page);

    // Still so when the page is opened again.
    await page.reload();
    await expect(panel(page)).toContainText("We will notify you");

    await panel(page).getByRole("button", { name: CANCEL }).click();
    await expect(
      panel(page).getByRole("button", { name: NOTIFY }),
    ).toBeVisible();
    await expect(panel(page)).toContainText(
      "You will not be notified about this product.",
    );
    expect((await requestsOf(request, "anna@example.com"))[0].status).toBe(
      "cancelled",
    );
  });

  test("asks with the bell of a card, which fills, and takes it back with a second tap", async ({
    page,
    request,
  }) => {
    await switchOn(request);
    await signIn(page, "anna@example.com");
    await open(page, MANGO_LIST);
    const bell = card(page).getByRole("button", { name: NOTIFY });
    await expect(bell).toHaveAttribute("aria-pressed", "false");
    await bell.click();

    const on = card(page).getByRole("button", { name: CANCEL });
    await expect(on).toHaveAttribute("aria-pressed", "true");
    // No room on a card: said at the top of the window.
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "We will email you at anna@example.com" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await on.click();
    await expect(bell).toHaveAttribute("aria-pressed", "false");
    expect((await requestsOf(request, "anna@example.com"))[0].status).toBe(
      "cancelled",
    );
  });

  test("finds what they wait for under Notifications in the account", async ({
    page,
    request,
  }) => {
    await switchOn(request);
    await signIn(page, "anna@example.com");
    await open(page, MANGO_PAGE);
    await panel(page).getByRole("button", { name: NOTIFY }).click();
    await expect(panel(page)).toContainText("We will notify you");

    await page.goto("/en/account/notifications");
    await expect(
      page.getByRole("heading", { level: 1, name: "Notifications" }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      page
        .getByRole("navigation", { name: "Account" })
        .getByRole("link", { name: "Notifications" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", { level: 2, name: /Kesar Mango/ }),
    ).toBeVisible();
    await expect(page.getByText(/^Waiting since \d/)).toBeVisible();
    await expectNoBarriers(page);

    await page.getByRole("button", { name: CANCEL }).last().click();
    await expect(
      page.getByText("You are not waiting for any product."),
    ).toBeVisible();
    expect((await requestsOf(request, "anna@example.com"))[0].status).toBe(
      "cancelled",
    );
  });
});

test.describe("what the API refuses", () => {
  test("a size that came back meanwhile gets its basket, on a card that still said sold out", async ({
    page,
    request,
  }) => {
    await switchOn(request);
    await open(page, MANGO_LIST);
    // The list is a few minutes old; the admin has stocked up since.
    await request.post(`${MOCK}/__mock/stock`, {
      data: {
        variantId: await variantIdOf(request, "kesar-mango-box-3kg"),
        quantity: 6,
      },
    });
    await card(page).getByRole("button", { name: NOTIFY }).click();
    const sheet = page.getByRole("dialog", { name: "Notify me" });
    await sheet.getByLabel("Email address").fill("gita@example.com");
    await sheet.getByRole("checkbox").check();
    await sheet.getByRole("button", { name: "Notify me" }).click();

    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Good news: this product can be ordered again." }),
    ).toBeVisible();
    await expect(sheet).toHaveCount(0);
    await expect(card(page).getByText("Sold out")).toBeHidden();
    await card(page)
      .getByRole("button", { name: `Add to cart: ${MANGO}` })
      .click();
    await expect(
      card(page).getByRole("group", { name: `Quantity of ${MANGO}` }),
    ).toContainText("1");
    expect(await requestsOf(request, "gita@example.com")).toEqual([]);
  });

  test("the control goes when the shop switched the emails off since the page was made", async ({
    page,
    request,
  }) => {
    await switchOn(request);
    await open(page, MANGO_PAGE);
    await request.post(`${MOCK}/__mock/stock-alerts`, {
      data: { enabled: false },
    });
    await panel(page).getByRole("button", { name: NOTIFY }).click();
    await panel(page).getByLabel("Email address").fill("gita@example.com");
    await panel(page).getByRole("checkbox").check();
    await panel(page).getByRole("button", { name: "Notify me" }).click();
    await expect(panel(page)).toHaveCount(0);
    // The pill that says why the size cannot be ordered stays.
    await expect(page.getByText("Sold out").first()).toBeVisible();
  });

  test("a sentence says why, like too many requests that wait for their confirmation", async ({
    page,
    request,
  }) => {
    await switchOn(request);
    const list = await request.get(`${MOCK}/v1/store/products?limit=12`);
    const sizes: string[] = (await list.json()).items
      .slice(0, 5)
      .map((product: { variantId: string }) => product.variantId);
    for (const variantId of sizes) {
      await request.post(`${MOCK}/__mock/stock`, {
        data: { variantId, quantity: 0 },
      });
      await request.post(`${MOCK}/v1/store/stock-alerts`, {
        data: { variantId, email: "gita@example.com", consent: true },
      });
    }
    await open(page, MANGO_PAGE);
    await panel(page).getByRole("button", { name: NOTIFY }).click();
    await panel(page).getByLabel("Email address").fill("gita@example.com");
    await panel(page).getByRole("checkbox").check();
    await panel(page).getByRole("button", { name: "Notify me" }).click();
    await expect(
      panel(page).getByText(
        "Please confirm the requests we already emailed you about first.",
      ),
    ).toBeVisible();
    // The form stays, with what was typed.
    await expect(panel(page).getByLabel("Email address")).toHaveValue(
      "gita@example.com",
    );
  });
});

test.describe("the links of the emails", () => {
  test("the confirmation link confirms once, in the customer's language, and offers to cancel", async ({
    page,
    request,
  }) => {
    await switchOn(request);
    await ask(request, "kesar-mango-box-3kg", "gita@example.com");
    const [waiting] = await requestsOf(request, "gita@example.com");

    const calls: string[] = [];
    page.on("request", (sent) => {
      if (new URL(sent.url()).pathname.startsWith("/v1/store/stock-alerts")) {
        calls.push(new URL(sent.url()).pathname);
      }
    });
    // The link of the email carries no language: the proxy adds it.
    await page.goto(
      `/stock-alerts/confirm?token=${encodeURIComponent(waiting.confirmToken)}`,
    );
    await expect(page).toHaveURL(/\/en\/stock-alerts\/confirm\?token=/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Confirm your notification",
      }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("main")).toContainText("Confirmed");
    await expect(page.getByRole("main")).toContainText(
      "We will email you at gi***@example.com when it is back.",
    );
    expect((await requestsOf(request, "gita@example.com"))[0].status).toBe(
      "active",
    );
    expect(calls).toEqual(["/v1/store/stock-alerts/confirm"]);
    // Nothing for a search engine, and the token goes to no other site.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute(
      "content",
      "no-referrer",
    );
    await expectNoBarriers(page);

    await page
      .getByRole("button", { name: "Cancel this notification" })
      .click();
    await expect(page.getByRole("main")).toContainText(
      "You will not be notified about this product.",
    );
    expect((await requestsOf(request, "gita@example.com"))[0].status).toBe(
      "cancelled",
    );
    await expect(
      page.getByRole("link", { name: "Continue shopping" }),
    ).toHaveAttribute("href", "/en/products");
  });

  test("the unsubscribe link changes nothing until its button is pressed, and can cancel all", async ({
    page,
    request,
  }) => {
    await switchOn(request, { guestConfirmation: false });
    await ask(request, "kesar-mango-box-3kg", "gita@example.com");
    await ask(request, "paneer-500g", "gita@example.com");
    const [mango] = await requestsOf(request, "gita@example.com");

    await page.goto(
      `/stock-alerts/unsubscribe?token=${encodeURIComponent(mango.unsubscribeToken)}`,
    );
    const cancel = page.getByRole("button", { name: "Cancel notification" });
    await expect(cancel).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("main")).toContainText(
      "After this we will not email you when this product is back in stock.",
    );
    // Programs that check the links of an email open them: nothing happened.
    expect(
      (await requestsOf(request, "gita@example.com")).map((r) => r.status),
    ).toEqual(["active", "active"]);

    await cancel.click();
    await expect(page.getByRole("main")).toContainText(
      "You will not be notified about this product.",
    );
    await expect(page.getByRole("main")).toContainText(
      "You are still waiting for 1 other product.",
    );
    expect(
      (await requestsOf(request, "gita@example.com")).map((r) => r.status),
    ).toEqual(["cancelled", "active"]);

    await page
      .getByRole("button", { name: "Cancel all my notifications (1)" })
      .click();
    await expect(page.getByRole("main")).toContainText(
      "All your notifications are cancelled.",
    );
    await expect(
      page.getByRole("button", { name: /Cancel all my notifications/ }),
    ).toHaveCount(0);
    expect(
      (await requestsOf(request, "gita@example.com")).map((r) => r.status),
    ).toEqual(["cancelled", "cancelled"]);
  });

  test("a link that is not genuine, or carries no token, says so on both pages", async ({
    page,
  }) => {
    for (const path of [
      "/en/stock-alerts/confirm?token=0123456789abcdef01234567.nothing",
      // Cut short on its way: not even a token.
      "/en/stock-alerts/confirm?token=0123456789ab",
      "/en/stock-alerts/confirm",
      "/en/stock-alerts/unsubscribe",
    ]) {
      await page.goto(path);
      await expect(page.getByText("This link is no longer valid.")).toBeVisible(
        { timeout: 60_000 },
      );
      await expect(
        page.getByRole("link", { name: "Continue shopping" }),
      ).toBeVisible();
    }
    await page.goto(
      "/en/stock-alerts/unsubscribe?token=0123456789abcdef01234567.nothing",
    );
    await page.getByRole("button", { name: "Cancel notification" }).click();
    await expect(page.getByText("This link is no longer valid.")).toBeVisible();
  });
});

test.describe("on a phone", () => {
  test("the bar above the tab bar offers it and leads a visitor to the form", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the bar is for phones");
    await switchOn(request);
    await open(page, MANGO_PAGE);
    // Down the page, where only the bar is in reach.
    await page.mouse.wheel(0, 2400);
    const inBar = page.getByRole("button", { name: NOTIFY }).last();
    await expect(inBar).toBeInViewport();
    await inBar.click();
    await expect(panel(page).getByLabel("Email address")).toBeFocused();
    await expect(panel(page).getByLabel("Email address")).toBeInViewport();
    // While the form is open, the bar says why the size cannot be ordered.
    await expect(page.getByRole("button", { name: NOTIFY })).toHaveCount(0);
  });
});
