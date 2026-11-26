import { describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import { startMockApi } from "./testing.ts";

// "Notify me" (doc 26) through the shop's API client: a visitor asks with
// an address and confirms it by a link, a customer asks with one call, and
// both take their requests back. The Kesar mango of the fixtures is sold
// out; the paneer is switched off for ordering.

const mock = startMockApi();

const MANGO = "kesar-mango-box-3kg";

async function variantOf(slug: string) {
  const { product } = await mock.guestApi().getProduct(slug);
  return { variantId: product.variantId, productId: product.id, product };
}

/** The requests of an address, with the tokens their emails would carry. */
async function requestsOf(email: string) {
  const response = await fetch(
    `${mock.base()}/__mock/stock-alerts?email=${encodeURIComponent(email)}`,
  );
  const { items } = (await response.json()) as {
    items: {
      variantId: string;
      status: string;
      locale: string;
      cycle: number;
      confirmToken: string;
      unsubscribeToken: string;
    }[];
  };
  return items;
}

async function run() {
  const response = await fetch(`${mock.base()}/__mock/stock-alerts/run`, {
    method: "POST",
  });
  return ((await response.json()) as { run: { queued: number } }).run;
}

const switchOn = (rules: Record<string, boolean> = {}) =>
  mock.control("stock-alerts", { enabled: true, ...rules });

describe("the switch", () => {
  it("is off until the admin switches it on, and the settings say so", async () => {
    const api = mock.guestApi();
    expect((await api.getSettings()).stockAlerts).toEqual({ enabled: false });
    await switchOn();
    expect((await api.getSettings()).stockAlerts).toEqual({ enabled: true });
  });

  it("refuses requests while it is off, and keeps what waits", async () => {
    await switchOn();
    const { variantId } = await variantOf(MANGO);
    const { api } = await mock.signIn("anna@example.com");
    const { alert } = await api.askMyStockAlert(variantId);
    await mock.control("stock-alerts", { enabled: false });

    const asCustomer = await api.askMyStockAlert(variantId).catch((e) => e);
    expect(hasErrorCode(asCustomer, "STOCK_ALERTS_DISABLED")).toBe(true);
    expect(asCustomer.status).toBe(409);
    const asVisitor = await mock
      .guestApi()
      .askStockAlert({ variantId, email: "gita@example.com", consent: true })
      .catch((e) => e);
    expect(hasErrorCode(asVisitor, "STOCK_ALERTS_DISABLED")).toBe(true);

    // The list and taking back still work.
    expect((await api.listMyStockAlerts()).items).toHaveLength(1);
    expect((await api.cancelMyStockAlert(alert.id)).alert.status).toBe(
      "cancelled",
    );
  });
});

describe("a visitor", () => {
  it("asks with an address, confirms it by the link and can take it back", async () => {
    await switchOn();
    const api = mock.guestApi();
    const { variantId, productId } = await variantOf(MANGO);

    const asked = await api.askStockAlert({
      variantId,
      email: "  Gita@Example.com ",
      consent: true,
      locale: "de",
    });
    expect(asked).toEqual({ variantId, productId, confirmationRequired: true });
    // The same answer for an address that waits already; nothing new is made.
    await expect(
      api.askStockAlert({
        variantId,
        email: "gita@example.com",
        consent: true,
      }),
    ).resolves.toEqual(asked);
    const [request, ...others] = await requestsOf("gita@example.com");
    expect(others).toEqual([]);
    expect(request).toMatchObject({
      variantId,
      status: "unconfirmed",
      locale: "de",
    });
    // The token is the id of the request and a signature, with a dot between.
    expect(request.confirmToken).toMatch(/^[0-9a-f]{24}\.[\w-]{20,}$/);

    const confirmed = await api.confirmStockAlert(request.confirmToken);
    expect(confirmed.alert).toMatchObject({
      variantId,
      productId,
      status: "active",
      email: "gi***@example.com",
    });
    expect(confirmed.alert).not.toHaveProperty("id");
    expect(confirmed.unsubscribeToken).toBe(request.unsubscribeToken);
    // Using the link twice changes nothing.
    await expect(api.confirmStockAlert(request.confirmToken)).resolves.toEqual(
      confirmed,
    );

    const taken = await api.unsubscribeStockAlert(confirmed.unsubscribeToken);
    expect(taken).toMatchObject({
      alert: { status: "cancelled", email: "gi***@example.com" },
      cancelled: 1,
      waiting: 0,
    });
    // Twice changes nothing either.
    await expect(
      api.unsubscribeStockAlert(confirmed.unsubscribeToken),
    ).resolves.toMatchObject({ cancelled: 0, waiting: 0 });
  });

  it("counts at once when the admin switched the confirmation off", async () => {
    await switchOn({ guestConfirmation: false });
    const { variantId } = await variantOf(MANGO);
    const asked = await mock.guestApi().askStockAlert({
      variantId,
      email: "gita@example.com",
      consent: true,
    });
    expect(asked.confirmationRequired).toBe(false);
    expect((await requestsOf("gita@example.com"))[0].status).toBe("active");
  });

  it("must agree and give a real address: both fields are named at once", async () => {
    await switchOn();
    const { variantId } = await variantOf(MANGO);
    const error = await mock
      .guestApi()
      .askStockAlert({
        variantId,
        email: "gita@",
        consent: false as unknown as true,
      })
      .catch((e) => e);
    expect(hasErrorCode(error, "VALIDATION_FAILED")).toBe(true);
    expect(
      (error.details as { field: string }[]).map((entry) => entry.field),
    ).toEqual(["email", "consent"]);
    expect(await requestsOf("gita@")).toEqual([]);
  });

  it("is told when the pack size can be ordered, or is not in the shop", async () => {
    await switchOn();
    const api = mock.guestApi();
    const rice = await variantOf("basmati-rice-1kg");
    const needless = await api
      .askStockAlert({
        variantId: rice.variantId,
        email: "gita@example.com",
        consent: true,
      })
      .catch((e) => e);
    expect(hasErrorCode(needless, "STOCK_ALERT_NOT_NEEDED")).toBe(true);
    expect(needless.status).toBe(409);
    expect(needless.details).toMatchObject({
      variantId: rice.variantId,
      ordering: { canOrder: true },
    });

    const unknown = await api
      .askStockAlert({
        variantId: "0123456789abcdef01234567",
        email: "gita@example.com",
        consent: true,
      })
      .catch((e) => e);
    expect(hasErrorCode(unknown, "PRODUCT_VARIANT_NOT_FOUND")).toBe(true);
    expect(unknown.status).toBe(404);
  });

  it("can wait for a product that is switched off for ordering", async () => {
    await switchOn();
    const paneer = await variantOf("paneer-500g");
    expect(paneer.product.ordering?.reason).toBe("product_unavailable");
    const asked = await mock.guestApi().askStockAlert({
      variantId: paneer.variantId,
      email: "gita@example.com",
      consent: true,
    });
    expect(asked.confirmationRequired).toBe(true);
  });

  it("cannot be flooded with confirmations: five wait at most", async () => {
    await switchOn();
    const api = mock.guestApi();
    const { items } = await api.listProducts({ limit: 12 });
    const sizes = items.slice(0, 6).map((product) => product.variantId);
    for (const variantId of sizes) {
      await mock.control("stock", { variantId, quantity: 0 });
    }
    for (const variantId of sizes.slice(0, 5)) {
      await api.askStockAlert({
        variantId,
        email: "gita@example.com",
        consent: true,
      });
    }
    const sixth = await api
      .askStockAlert({
        variantId: sizes[5],
        email: "gita@example.com",
        consent: true,
      })
      .catch((e) => e);
    expect(hasErrorCode(sixth, "STOCK_ALERT_LIMIT_REACHED")).toBe(true);
    expect(sixth.status).toBe(409);
    expect(sixth.details).toEqual({ maximum: 5, unconfirmed: true });
    // One that waits already is not a new request: the same answer as ever.
    await expect(
      api.askStockAlert({
        variantId: sizes[0],
        email: "gita@example.com",
        consent: true,
      }),
    ).resolves.toMatchObject({ confirmationRequired: true });
  });

  it("takes back one request, or all of the address, with the link of an email", async () => {
    await switchOn({ guestConfirmation: false });
    const api = mock.guestApi();
    const { items } = await api.listProducts({ limit: 12 });
    const sizes = items.slice(0, 3).map((product) => product.variantId);
    for (const variantId of sizes) {
      await mock.control("stock", { variantId, quantity: 0 });
      await api.askStockAlert({
        variantId,
        email: "gita@example.com",
        consent: true,
      });
    }
    const [first] = await requestsOf("gita@example.com");

    await expect(
      api.unsubscribeStockAlert(first.unsubscribeToken),
    ).resolves.toMatchObject({ cancelled: 1, waiting: 2 });
    await expect(
      api.unsubscribeStockAlert(first.unsubscribeToken, true),
    ).resolves.toMatchObject({ cancelled: 2, waiting: 0 });
    expect(
      (await requestsOf("gita@example.com")).map((entry) => entry.status),
    ).toEqual(["cancelled", "cancelled", "cancelled"]);
  });

  it("gets nowhere with a link that is not genuine", async () => {
    await switchOn();
    const api = mock.guestApi();
    const { variantId } = await variantOf(MANGO);
    await api.askStockAlert({
      variantId,
      email: "gita@example.com",
      consent: true,
    });
    const [request] = await requestsOf("gita@example.com");

    for (const attempt of [
      () => api.confirmStockAlert(`${request.confirmToken}x`),
      // The two links have signatures of their own.
      () => api.confirmStockAlert(request.unsubscribeToken),
      () => api.unsubscribeStockAlert(request.confirmToken),
      () => api.unsubscribeStockAlert("0123456789abcdef01234567.nothing"),
    ]) {
      const error = await attempt().catch((e) => e);
      expect(hasErrorCode(error, "STOCK_ALERT_TOKEN_INVALID")).toBe(true);
      expect(error.status).toBe(404);
    }
    const tooShort = await api.confirmStockAlert("short").catch((e) => e);
    expect(hasErrorCode(tooShort, "VALIDATION_FAILED")).toBe(true);
    expect((await requestsOf("gita@example.com"))[0].status).toBe(
      "unconfirmed",
    );
  });
});

describe("a signed-in customer", () => {
  it("asks with one call, sees the request in the list and takes it back", async () => {
    await switchOn();
    const { variantId, productId } = await variantOf(MANGO);
    const { api } = await mock.signIn("anna@example.com");
    expect((await api.listMyStockAlerts()).items).toEqual([]);

    const first = await api.askMyStockAlert(variantId, "de");
    expect(first.created).toBe(true);
    expect(first.alert).toMatchObject({
      variantId,
      productId,
      status: "active",
      // The pack size as listings show it, in the language of the request.
      product: {
        variantId,
        name: "Kesar-Mango, Kiste",
        ordering: { canOrder: false, reason: "sold_out" },
      },
    });
    expect(first.alert.id).toMatch(/^[0-9a-f]{24}$/);
    expect((await requestsOf("anna@example.com"))[0].locale).toBe("de");

    // Already waiting: 200 and the same request.
    const again = await api.askMyStockAlert(variantId);
    expect(again.created).toBe(false);
    expect(again.alert.id).toBe(first.alert.id);

    const { items } = await api.listMyStockAlerts();
    expect(items.map((alert) => alert.id)).toEqual([first.alert.id]);
    expect(items[0].product?.name).toBe("Kesar Mango, Box");

    const cancelled = await api.cancelMyStockAlert(first.alert.id);
    expect(cancelled.alert.status).toBe("cancelled");
    expect((await api.listMyStockAlerts()).items).toEqual([]);
    // Taking it back twice changes nothing.
    await expect(api.cancelMyStockAlert(first.alert.id)).resolves.toMatchObject(
      { alert: { status: "cancelled" } },
    );
  });

  it("does not see or cancel the requests of others", async () => {
    await switchOn();
    const { variantId } = await variantOf(MANGO);
    const anna = await mock.signIn("anna@example.com");
    const { alert } = await anna.api.askMyStockAlert(variantId);
    const ben = await mock.signIn("ben@example.com");

    expect((await ben.api.listMyStockAlerts()).items).toEqual([]);
    const error = await ben.api.cancelMyStockAlert(alert.id).catch((e) => e);
    expect(hasErrorCode(error, "STOCK_ALERT_NOT_FOUND")).toBe(true);
    expect(error.status).toBe(404);
    expect((await anna.api.listMyStockAlerts()).items).toHaveLength(1);
  });

  it("needs a session", async () => {
    await switchOn();
    const { variantId } = await variantOf(MANGO);
    const api = mock.guestApi();
    for (const attempt of [
      () => api.listMyStockAlerts(),
      () => api.askMyStockAlert(variantId),
      () => api.cancelMyStockAlert("0123456789abcdef01234567"),
    ]) {
      const error = await attempt().catch((e) => e);
      expect(hasErrorCode(error, "AUTH_TOKEN_INVALID")).toBe(true);
    }
  });

  it("takes over what the same address asked for as a visitor", async () => {
    await switchOn();
    const { variantId } = await variantOf(MANGO);
    await mock.guestApi().askStockAlert({
      variantId,
      email: "anna@example.com",
      consent: true,
    });
    expect((await requestsOf("anna@example.com"))[0].status).toBe(
      "unconfirmed",
    );

    // The account proves the address the visitor did not confirm.
    const { api } = await mock.signIn("anna@example.com");
    const { created, alert } = await api.askMyStockAlert(variantId);
    expect(created).toBe(true);
    expect(alert.status).toBe("active");
    expect(await requestsOf("anna@example.com")).toHaveLength(1);
    expect((await api.listMyStockAlerts()).items).toHaveLength(1);
  });

  it("is told once, and asking again later is a new round", async () => {
    await switchOn();
    const { variantId } = await variantOf(MANGO);
    const { api } = await mock.signIn("anna@example.com");
    const { alert } = await api.askMyStockAlert(variantId);

    // Nothing is back yet.
    expect((await run()).queued).toBe(0);
    await mock.control("stock", { variantId, quantity: 6 });
    expect((await run()).queued).toBe(1);
    expect((await run()).queued).toBe(0);
    // The request ended with its email: the list holds what is still open.
    expect((await api.listMyStockAlerts()).items).toEqual([]);
    expect((await requestsOf("anna@example.com"))[0]).toMatchObject({
      status: "notified",
      cycle: 1,
    });

    // In stock: nothing to wait for.
    const needless = await api.askMyStockAlert(variantId).catch((e) => e);
    expect(hasErrorCode(needless, "STOCK_ALERT_NOT_NEEDED")).toBe(true);

    await mock.control("stock", { variantId, quantity: 0 });
    const next = await api.askMyStockAlert(variantId);
    expect(next.created).toBe(true);
    expect(next.alert.id).toBe(alert.id);
    expect((await requestsOf("anna@example.com"))[0]).toMatchObject({
      status: "active",
      cycle: 2,
    });
  });

  it("cannot ask with a blocked account", async () => {
    await switchOn();
    const { variantId } = await variantOf(MANGO);
    const { api } = await mock.signIn("anna@example.com");
    await mock.control("customer", {
      email: "anna@example.com",
      blocked: true,
    });
    const error = await api.askMyStockAlert(variantId).catch((e) => e);
    expect(hasErrorCode(error, "CUSTOMER_BLOCKED")).toBe(true);
    expect(error.status).toBe(403);
  });

  it("leaves no request behind when the account is closed", async () => {
    await switchOn();
    const { variantId } = await variantOf(MANGO);
    const { api } = await mock.signIn("anna@example.com");
    await api.askMyStockAlert(variantId);
    await api.deleteAccount({ password: "Mangoes-in-May-2026", confirm: true });
    expect(await requestsOf("anna@example.com")).toEqual([]);
  });
});
