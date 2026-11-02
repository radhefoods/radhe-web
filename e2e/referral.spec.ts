import { expect, test, type Page } from "@playwright/test";
import { createAccount, MOCK, PASSWORD, signupCode } from "./helpers";

// The referral flow (doc 21): a link with `?ref=<code>` is noticed on any
// page, kept while the visitor browses, shown on the sign-up form where it
// can be changed, sent with the sign-up, and the outcome is said once the
// emailed code was right.

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__mock/reset`);
});

/** An account that invites, and its code. */
async function inviter(request: Parameters<typeof createAccount>[0]) {
  await createAccount(request, { email: "priya@example.com" });
  const response = await request.get(`${MOCK}/v1/store/me/referral`);
  const { referral } = (await response.json()) as {
    referral: { code: string; counts: { registered: number } };
  };
  return referral;
}

const notice = (page: Page) => page.getByTestId("invitation-notice");
const password = (page: Page) => page.getByLabel("Password", { exact: true });

async function fillAccount(page: Page, email: string) {
  await page.getByLabel("First name").fill("Anna");
  await page.getByLabel("Last name").fill("Schmidt");
  await page.getByLabel("Email address").fill(email);
  await password(page).fill(PASSWORD);
}

test.describe("a referral link", () => {
  test("is noticed, kept while browsing, shown on the sign-up and counted once the account exists", async ({
    page,
    request,
  }) => {
    const { code } = await inviter(request);

    await page.goto(`/en?ref=${code.toLowerCase()}`);
    await expect(notice(page)).toContainText("You have been invited");
    await expect(notice(page)).toContainText(code);
    // Browsing on, the invitation stays.
    await page.goto("/en/categories");
    await expect(notice(page)).toBeVisible();
    await notice(page).getByRole("link", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en\/sign-up$/);
    // The sign-up page itself does not repeat the notice.
    await expect(notice(page)).toHaveCount(0);

    const field = page.getByLabel("Referral code (optional)");
    await expect(field).toHaveValue(code);
    await expect(
      page.getByText("Taken from your invitation link. You can change it."),
    ).toBeVisible();
    await fillAccount(page, "anna@example.com");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/We sent a 6-digit code/)).toBeVisible();
    await page
      .getByLabel("Code")
      .fill(await signupCode(page.request, "anna@example.com"));
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Your account is ready.")).toBeVisible();
    await expect(
      page.getByText("Your invitation counted. Thank you!"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/en\/account$/);

    // The code did its work: gone from the browser, and the notice with it.
    expect(
      await page.evaluate(() => window.localStorage.getItem("rf.referral.v1")),
    ).toBeNull();
    await page.goto("/en");
    await expect(notice(page)).toHaveCount(0);
    // The inviter sees the sign-up.
    const after = await request.get(`${MOCK}/v1/store/me/referral`);
    expect(
      ((await after.json()) as { referral: { counts: { registered: number } } })
        .referral.counts.registered,
    ).toBe(1);
  });

  test("can be typed by hand, is checked, and says when it did not count", async ({
    page,
  }) => {
    await page.goto("/en/sign-up");
    await expect(page.getByLabel("Referral code (optional)")).toHaveCount(0);
    await page.getByRole("button", { name: "Have a referral code?" }).click();
    const field = page.getByLabel("Referral code (optional)");
    await expect(field).toBeFocused();
    await fillAccount(page, "max@example.com");
    await field.fill("abc");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(
      page.getByText("A referral code has 6 to 12 letters or digits."),
    ).toBeVisible();
    await expect(field).toBeFocused();
    // Typed small, kept in capitals; an unknown code never fails the sign-up.
    await field.fill("nobody99");
    await expect(field).toHaveValue("NOBODY99");
    await page.getByRole("button", { name: "Create account" }).click();
    await page
      .getByLabel("Code")
      .fill(await signupCode(page.request, "max@example.com"));
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Your account is ready.")).toBeVisible();
    await expect(
      page.getByText(
        "The referral code NOBODY99 is not known, so it was not applied. Your account works all the same.",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/en\/account$/);
  });

  test("leads straight to the sign-up as well, and the notice can be closed for the visit", async ({
    page,
    request,
  }) => {
    const { code } = await inviter(request);
    await page.goto(`/de/registrieren?ref=${code}`);
    await expect(page.getByLabel("Empfehlungscode (optional)")).toHaveValue(
      code,
    );
    await page.goto("/de");
    await expect(notice(page)).toContainText("Sie wurden eingeladen");
    await notice(page)
      .getByRole("button", { name: "Hinweis ausblenden" })
      .click();
    await expect(notice(page)).toHaveCount(0);
    await page.reload();
    await expect(notice(page)).toHaveCount(0);
    // The code itself is still kept for the sign-up.
    await page.goto("/de/registrieren");
    await expect(page.getByLabel("Empfehlungscode (optional)")).toHaveValue(
      code,
    );
  });
});
