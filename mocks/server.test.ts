import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import { createRequester } from "../src/lib/api/http.ts";
import { createSessionTransport } from "../src/lib/api/session-transport.ts";
import { createStoreApi } from "../src/lib/api/store-api.ts";
import { SKU } from "./data/catalogue.ts";
import { createMockServer } from "./server.ts";

// The mock API and the shop's API client, tested against each other: what
// the client sends, the mock understands, in the shapes of the documentation.

const server = createMockServer({ allowedOrigins: ["http://localhost:3001"] });
let base = "";

/** A fetch that keeps cookies like a browser does, including their paths. */
function browserLikeFetch() {
  const jar: { name: string; value: string; path: string }[] = [];
  const fetchWithCookies: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const cookie = jar
      .filter((c) => url.pathname.startsWith(c.path))
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const response = await fetch(input, {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string>),
        ...(cookie && { cookie }),
        origin: "http://localhost:3001",
      },
    });
    for (const line of response.headers.getSetCookie()) {
      const [pair, ...attributes] = line.split(";").map((part) => part.trim());
      const [name, value] = pair.split("=");
      const path =
        attributes.find((a) => a.startsWith("Path="))?.slice(5) ?? "/";
      const index = jar.findIndex((c) => c.name === name && c.path === path);
      if (index >= 0) jar.splice(index, 1);
      if (value) jar.push({ name, value, path });
    }
    return response;
  };
  return { fetch: fetchWithCookies, jar };
}

function guestApi() {
  return createStoreApi(createRequester({ baseUrl: base }));
}

function customerApi() {
  const browser = browserLikeFetch();
  const transport = createSessionTransport({
    baseUrl: base,
    fetch: browser.fetch,
  });
  return {
    api: createStoreApi(transport.request),
    transport,
    jar: browser.jar,
  };
}

async function signIn(email: string) {
  const client = customerApi();
  await client.api.requestOtp({ email });
  const result = await client.api.verifyOtp({ email, code: "123456" });
  return { ...client, customer: result.customer };
}

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(async () => {
  await fetch(`${base}/__mock/reset`, { method: "POST" });
});

describe("catalogue", () => {
  it("answers in the language asked for", async () => {
    const api = guestApi();
    const en = await api.listCategories({ locale: "en" });
    const de = await api.listCategories({ locale: "de" });
    expect(en.items[0].name).toBe("Rice");
    expect(de.items[0].name).toBe("Reis");
    expect(de.items[0].slugs).toEqual({ en: "rice", de: "reis" });
    expect(en.items[0].children.map((c) => c.slug)).toContain("basmati-rice");
  });

  it("groups pack sizes into one entry with a size chooser", async () => {
    const page = await guestApi().listProducts(
      { q: "basmati" },
      { locale: "en" },
    );
    expect(page.total).toBe(1);
    const [rice] = page.items;
    expect(rice.packSize.label).toBe("5 kg");
    expect(rice.packSizes.map((s) => s.packSize.label)).toEqual([
      "1 kg",
      "5 kg",
    ]);
    expect(rice.packSizes.find((s) => s.isSelected)?.slug).toBe(rice.slug);
    expect(rice.pricing).toMatchObject({
      price: 1999,
      regularPrice: 2499,
      onSale: true,
      discountPercent: 20,
      basePrice: { amount: 400, per: "kg" },
    });
  });

  it("lists every pack size when grouping is off", async () => {
    const page = await guestApi().listProducts({
      q: "basmati",
      groupPackSizes: false,
    });
    expect(page.total).toBe(2);
  });

  it("finds products by word beginnings, with umlauts folded", async () => {
    const api = guestApi();
    const cumin = await api.listProducts({ q: "kreuzkum" }, { locale: "de" });
    expect(cumin.items[0]?.name).toBe("Kreuzkümmel, ganz");
    const none = await api.listProducts({ q: "ümmel" }, { locale: "de" });
    expect(none.total).toBe(0);
  });

  it("filters by category including its sub-categories, and sorts", async () => {
    const page = await guestApi().listProducts({
      category: "spices",
      sort: "price_asc",
    });
    expect(page.items.length).toBeGreaterThan(2);
    const prices = page.items.map((p) => p.pricing.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("finds a product by its slug in either language", async () => {
    const api = guestApi();
    const viaGerman = await api.getProduct("basmati-reis-5-kg", {
      locale: "en",
    });
    expect(viaGerman.product.slug).toBe("basmati-rice-5-kg");
    expect(viaGerman.product.slugs.de).toBe("basmati-reis-5-kg");
    expect(viaGerman.product.breadcrumbs.map((b) => b.slug)).toEqual([
      "rice",
      "basmati-rice",
    ]);
  });

  it("explains why a product cannot be ordered", async () => {
    const page = await guestApi().listProducts({
      limit: 100,
      groupPackSizes: false,
    });
    const ordering = (id: string) =>
      page.items.find((p) => p.id === id)?.ordering;
    expect(ordering(SKU.kesarMango)).toMatchObject({
      canOrder: false,
      reason: "sold_out",
      remaining: 0,
    });
    expect(ordering(SKU.alphonsoMango)?.reason).toBe("not_in_this_cargo");
    expect(ordering(SKU.paneer)?.reason).toBe("product_unavailable");
    expect(ordering(SKU.bhujia)).toEqual({
      canOrder: true,
      reason: null,
      minQuantity: 1,
      maxQuantity: 12,
      remaining: 37,
    });
  });

  it("answers the documented errors", async () => {
    const api = guestApi();
    const unknown = await api.getProduct("no-such-product").catch((e) => e);
    expect(hasErrorCode(unknown, "PRODUCT_NOT_FOUND")).toBe(true);
    const badCategory = await api
      .listProducts({ category: "no-such-category" })
      .catch((e) => e);
    expect(hasErrorCode(badCategory, "CATEGORY_NOT_FOUND")).toBe(true);
    const shortQuery = await api.listProducts({ q: "a" }).catch((e) => e);
    expect(hasErrorCode(shortQuery, "VALIDATION_FAILED")).toBe(true);
  });
});

describe("cargo", () => {
  it("is open with a countdown and delivery days", async () => {
    const status = await guestApi().getCargo({ locale: "de" });
    expect(status.acceptingOrders).toBe(true);
    expect(status.current?.name).toBe("Oktober-Lieferung");
    expect(status.current?.closesInSeconds).toBeGreaterThan(2 * 86_400);
    expect(status.current?.delivery.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(status.timezone).toBe("Europe/Berlin");
  });

  it("can be closed, and then nothing is orderable", async () => {
    await fetch(`${base}/__mock/cargo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "closed" }),
    });
    const api = guestApi();
    const status = await api.getCargo();
    expect(status.acceptingOrders).toBe(false);
    expect(status.current).toBeNull();
    expect(status.next?.opensInSeconds).toBeGreaterThan(0);
    const orderable = await api.listProducts({ orderable: true });
    expect(orderable.total).toBe(0);
    const bill = await api.previewCart([
      { productId: SKU.chakkiAtta5kg, quantity: 1 },
    ]);
    expect(bill.canOrder).toBe(false);
    expect(bill.cargo).toBeNull();
    expect(bill.lines[0].issue).toBe("ordering_closed");
  });
});

describe("the bill", () => {
  it("adds the delivery fee below the free limit and splits out VAT", async () => {
    // Two bags of atta at 12.99: the example of the API documentation (8.1).
    const bill = await guestApi().previewCart([
      { productId: SKU.chakkiAtta5kg, quantity: 2 },
    ]);
    expect(bill.canOrder).toBe(true);
    expect(bill.totals).toEqual({
      currency: "EUR",
      subtotal: 2598,
      deliveryFee: 499,
      total: 3097,
      netTotal: 2894,
      vatTotal: 203,
      vat: [{ vatRate: 700, vatPercent: 7, gross: 3097, net: 2894, vat: 203 }],
    });
    expect(bill.delivery).toEqual({
      fee: 499,
      freeFrom: 5000,
      missingForFree: 2402,
    });
    expect(bill.lines[0].product?.ordering).toBeNull();
    expect(bill.lines[0].ordering?.canOrder).toBe(true);
  });

  it("delivers free from the limit", async () => {
    const bill = await guestApi().previewCart([
      { productId: SKU.chakkiAtta5kg, quantity: 4 },
    ]);
    expect(bill.totals.deliveryFee).toBe(0);
    expect(bill.totals.total).toBe(5196);
    expect(bill.delivery.missingForFree).toBe(0);
  });

  it("keeps two VAT rates apart and shares the delivery fee between them", async () => {
    const bill = await guestApi().previewCart([
      { productId: SKU.chakkiAtta5kg, quantity: 1 },
      { productId: SKU.mangoDrink, quantity: 4 },
    ]);
    const { totals } = bill;
    expect(totals.vat.map((g) => g.vatRate)).toEqual([700, 1900]);
    expect(totals.vat.reduce((sum, g) => sum + g.gross, 0)).toBe(totals.total);
    expect(totals.netTotal + totals.vatTotal).toBe(totals.total);
    expect(totals.total).toBe(totals.subtotal + totals.deliveryFee);
  });

  it("marks lines that cannot be ordered and leaves them out of the total", async () => {
    const bill = await guestApi().previewCart([
      { productId: SKU.chakkiAtta5kg, quantity: 1 },
      { productId: SKU.kesarMango, quantity: 1 },
      { productId: SKU.khakhra, quantity: 1 },
      { productId: SKU.bhujia, quantity: 20 },
      { productId: "66e9000000000000000000ff", quantity: 1 },
    ]);
    expect(bill.canOrder).toBe(false);
    expect(bill.lines.map((line) => line.issue)).toEqual([
      null,
      "sold_out",
      "quantity_below_minimum",
      "quantity_above_maximum",
      "product_not_found",
    ]);
    expect(bill.lines[4].product).toBeNull();
    expect(bill.totals.subtotal).toBe(1299);
  });

  it("rejects fields the API does not know", async () => {
    const response = await fetch(`${base}/v1/store/cart/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ productId: SKU.toorDal1kg, quantity: 1, price: 1 }],
      }),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.details[0].problems[0]).toBe(
      "property price should not exist",
    );
    expect(typeof body.requestId).toBe("string");
  });
});

describe("sign-in and the stored cart", () => {
  it("creates the account at first sign-in and keeps the session in cookies", async () => {
    const { api, customer, jar } = await signIn("anna@example.com");
    expect(customer.email).toBe("anna@example.com");
    expect(jar.map((c) => `${c.name} ${c.path}`).sort()).toEqual([
      "rf_customer_access /",
      "rf_customer_refresh /v1/store/auth",
    ]);
    const me = await api.getMe();
    expect(me.customer.id).toBe(customer.id);
  });

  it("counts wrong codes and refuses a code after a resend too soon", async () => {
    const { api } = customerApi();
    await api.requestOtp({ email: "max@example.com", locale: "de" });
    const wrong = await api
      .verifyOtp({ email: "max@example.com", code: "000000" })
      .catch((e) => e);
    expect(hasErrorCode(wrong, "OTP_INVALID")).toBe(true);
    if (hasErrorCode(wrong, "OTP_INVALID")) {
      expect(wrong.details?.attemptsRemaining).toBe(4);
    }
    const again = await api
      .requestOtp({ email: "max@example.com" })
      .catch((e) => e);
    expect(hasErrorCode(again, "OTP_COOLDOWN")).toBe(true);
    const session = await api.verifyOtp({
      email: "max@example.com",
      code: "123456",
    });
    expect(session.customer.locale).toBe("de");
  });

  it("refuses protected calls without a session", async () => {
    const error = await guestApi()
      .getMe()
      .catch((e) => e);
    expect(hasErrorCode(error, "AUTH_TOKEN_INVALID")).toBe(true);
  });

  it("carries on with a refresh when the access cookie is gone", async () => {
    const { api, jar } = await signIn("anna@example.com");
    // The access cookie expired; the refresh cookie is still there.
    jar.splice(
      jar.findIndex((c) => c.name === "rf_customer_access"),
      1,
    );
    const me = await api.getMe();
    expect(me.customer.email).toBe("anna@example.com");
    expect(jar.some((c) => c.name === "rf_customer_access")).toBe(true);
  });

  it("ends the session when the refresh cookie is gone as well", async () => {
    const { api, jar, transport } = await signIn("anna@example.com");
    jar.length = 0;
    let ended = false;
    transport.onSessionEnded(() => {
      ended = true;
    });
    const error = await api.getMe().catch((e) => e);
    expect(hasErrorCode(error, "AUTH_TOKEN_INVALID")).toBe(true);
    expect(ended).toBe(true);
  });

  it("merges the visitor's cart: the larger quantity wins, unknown products are dropped", async () => {
    const { api } = await signIn("anna@example.com");
    await api.setCartItem(SKU.toorDal1kg, 3);
    const bill = await api.mergeCart([
      { productId: SKU.toorDal1kg, quantity: 1 },
      { productId: SKU.chakkiAtta5kg, quantity: 2 },
      { productId: "66e9000000000000000000ff", quantity: 5 },
    ]);
    expect(bill.lines.map((line) => [line.productId, line.quantity])).toEqual([
      [SKU.toorDal1kg, 3],
      [SKU.chakkiAtta5kg, 2],
    ]);
    const stored = await api.getCart();
    expect(stored.totals.total).toBe(bill.totals.total);
  });

  it("changes and empties the stored cart", async () => {
    const { api } = await signIn("anna@example.com");
    await api.setCartItem(SKU.toorDal1kg, 2);
    await api.setCartItem(SKU.basmati5kg, 1);
    const afterRemove = await api.removeCartItem(SKU.toorDal1kg);
    expect(afterRemove.lines).toHaveLength(1);
    const afterZero = await api.setCartItem(SKU.basmati5kg, 0);
    expect(afterZero.lines).toHaveLength(0);
    const unknown = await api
      .setCartItem("66e9000000000000000000ff", 1)
      .catch((e) => e);
    expect(hasErrorCode(unknown, "CART_PRODUCT_NOT_FOUND")).toBe(true);
    const empty = await api.clearCart();
    expect(empty.canOrder).toBe(false);
    expect(empty.totals.total).toBe(0);
  });

  it("signs out", async () => {
    const { api, jar } = await signIn("anna@example.com");
    await api.logout();
    expect(jar).toHaveLength(0);
    const error = await api.getMe().catch((e) => e);
    expect(hasErrorCode(error, "AUTH_TOKEN_INVALID")).toBe(true);
  });

  it("stores profile and communication preferences", async () => {
    const { api } = await signIn("anna@example.com");
    const { customer } = await api.updateMe({
      firstName: "Anna",
      lastName: "Schmidt",
      phone: "+4915112345678",
      locale: "de",
    });
    expect(customer).toMatchObject({ firstName: "Anna", locale: "de" });
    const { communication } = await api.updateCommunication({
      marketingOptIn: true,
    });
    expect(communication.marketingOptIn).toBe(true);
    expect(communication.marketingOptInAt).not.toBeNull();
    const bad = await api.updateMe({ phone: "0151 123" }).catch((e) => e);
    expect(hasErrorCode(bad, "VALIDATION_FAILED")).toBe(true);
  });

  it("refuses a browser request from a foreign origin", async () => {
    const response = await fetch(`${base}/v1/store/cart/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "https://evil.example",
      },
      body: JSON.stringify({
        items: [{ productId: SKU.toorDal1kg, quantity: 1 }],
      }),
    });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("ORIGIN_NOT_ALLOWED");
  });
});
