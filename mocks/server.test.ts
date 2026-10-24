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

const PASSWORD = "Mangoes-in-May-2026";
const NAME = { firstName: "Anna", lastName: "Schmidt" };

/** A signed-in customer; the account is created when it is new. */
async function signIn(email: string) {
  const client = customerApi();
  const result = await client.api
    .signUp({ ...NAME, email, password: PASSWORD })
    .catch((error: unknown) => {
      if (!hasErrorCode(error, "CUSTOMER_EMAIL_TAKEN")) throw error;
      return client.api.login({ email, password: PASSWORD });
    });
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

  it("shows a product as its default size, with every size to choose from", async () => {
    const page = await guestApi().listProducts(
      { q: "basmati" },
      { locale: "en" },
    );
    expect(page.total).toBe(1);
    const [rice] = page.items;
    // The smallest enabled size in stock stands for the product.
    expect(rice.packSize.label).toBe("1 kg");
    expect(rice.slug).toBe("basmati-rice-1kg");
    expect(rice.displayName).toBe("Basmati Rice (1 kg)");
    expect(rice.variantCount).toBe(2);
    expect(rice.variants.map((v) => v.packSize.label)).toEqual([
      "1 kg",
      "5 kg",
    ]);
    expect(rice.variants.find((v) => v.isSelected)?.id).toBe(rice.variantId);
    expect(rice.variants.find((v) => v.isDefault)?.slug).toBe(rice.slug);
    const big = rice.variants[1];
    expect(big.displayName).toBe("Basmati Rice (5 kg)");
    expect(big.pricing).toMatchObject({
      price: 1999,
      regularPrice: 2499,
      onSale: true,
      discountPercent: 20,
      basePrice: { amount: 400, per: "kg" },
    });
  });

  it("opens a product on the URL of a size or on its base slug", async () => {
    const api = guestApi();
    const big = await api.getProduct("basmati-rice-5kg");
    expect(big.product.displayName).toBe("Basmati Rice (5 kg)");
    expect(big.product.slugs).toEqual({
      en: "basmati-rice-5kg",
      de: "basmati-reis-5kg",
    });
    expect(big.product.variants.find((v) => v.isSelected)?.slug).toBe(
      "basmati-rice-5kg",
    );
    expect(big.product.seo.title).toBe("Basmati Rice (5 kg)");
    const base = await api.getProduct("basmati-rice");
    expect(base.product.slug).toBe("basmati-rice-1kg");
    expect(base.product.variants.find((v) => v.isSelected)?.isDefault).toBe(
      true,
    );
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

  it("lists one card per pack size, the sizes of a product together or in rounds, and names the view", async () => {
    const api = guestApi();
    // No view and no category: one card per product, as before.
    const products = await api.listProducts({ q: "basmati" });
    expect(products.view).toBe("product");
    expect(products.total).toBe(1);

    // The sizes of a product together, smallest first; `total` counts cards
    // and every card is its size (doc PRODUCT_DISPLAY_ORDER).
    const grouped = await api.listProducts({
      q: "basmati",
      view: "variants_by_product",
    });
    expect(grouped.view).toBe("variants_by_product");
    expect(grouped.total).toBe(2);
    expect(grouped.items.map((p) => p.displayName)).toEqual([
      "Basmati Rice (1 kg)",
      "Basmati Rice (5 kg)",
    ]);
    expect(new Set(grouped.items.map((p) => p.id)).size).toBe(1);
    for (const card of grouped.items) {
      const selected = card.variants.find((v) => v.isSelected);
      expect(selected?.id).toBe(card.variantId);
      expect(selected?.slug).toBe(card.slug);
    }

    // Rounds: the smallest size of every product, then the second sizes.
    const rounds = await api.listProducts({
      category: "rice",
      view: "variants_by_size",
    });
    expect(rounds.view).toBe("variants_by_size");
    expect(rounds.items.map((p) => p.displayName)).toEqual([
      "Basmati Rice (1 kg)",
      "Sona Masoori Rice (5 kg)",
      "Poha (Flattened Rice) (1 kg)",
      "Basmati Rice (5 kg)",
      "Sona Masoori Rice (10 kg)",
    ]);

    // Without a view a category is listed the way it is set: rounds, until
    // the admin changes it.
    const byCategory = await api.listProducts({ category: "rice" });
    expect(byCategory.view).toBe("variants_by_size");
    expect(byCategory.total).toBe(5);
    const { items } = await api.listCategories();
    expect(items[0].listingView).toBe("variants_by_size");
    const asProducts = await api.listProducts({
      category: "rice",
      view: "product",
    });
    expect(asProducts.total).toBe(3);
  });

  it("filters and sorts the pack-size cards one by one; the facets keep counting products", async () => {
    const api = guestApi();
    // Only the reduced sizes become cards, and the price order sorts the
    // cards by their own price, the sizes of a product no longer together.
    const offers = await api.listProducts({
      view: "variants_by_product",
      onSale: true,
      sort: "price_asc",
    });
    expect(offers.items.map((p) => p.displayName)).toEqual([
      "Chana Dal (1 kg)",
      "Pure Ghee (1 l)",
      "Basmati Rice (5 kg)",
    ]);
    // A size that cannot be ordered is no card with `orderable=true`.
    const orderable = await api.listProducts({
      category: "fresh-fruit",
      view: "variants_by_size",
      orderable: true,
    });
    expect(orderable.items.map((p) => p.displayName)).toEqual([
      "Alphonso Mango, Box (3 kg)",
    ]);
    // `total` counts cards; the facets count products, whatever the view.
    const all = await api.listProducts({
      view: "variants_by_product",
      limit: 100,
    });
    expect(all.total).toBe(29);
    const response = await fetch(
      `${base}/v1/store/products/facets?view=variants_by_product`,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).total).toBe(22);
    const bad = await api
      .listProducts({ view: "by_colour" as "product" })
      .catch((e) => e);
    expect(hasErrorCode(bad, "VALIDATION_FAILED")).toBe(true);
  });

  it("finds a product by its slug in either language", async () => {
    const api = guestApi();
    const viaGerman = await api.getProduct("basmati-reis-5kg", {
      locale: "en",
    });
    expect(viaGerman.product.slug).toBe("basmati-rice-5kg");
    expect(viaGerman.product.slugs.de).toBe("basmati-reis-5kg");
    expect(viaGerman.product.breadcrumbs.map((b) => b.slug)).toEqual([
      "rice",
      "basmati-rice",
    ]);
  });

  it("explains why a product cannot be ordered", async () => {
    const page = await guestApi().listProducts({ limit: 100 });
    const ordering = (id: string) =>
      page.items.find((p) => p.variantId === id)?.ordering;
    expect(ordering(SKU.kesarMango)).toMatchObject({
      canOrder: false,
      reason: "sold_out",
      remaining: 0,
      maxQuantity: 0,
    });
    expect(ordering(SKU.alphonsoMango)?.canOrder).toBe(true);
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

describe("filters and facets", () => {
  it("takes several values of a filter as any of them", async () => {
    const api = guestApi();
    const page = await api.listProducts({ brand: ["MDH", "Amul"] });
    expect(page.total).toBe(4);
    expect(new Set(page.items.map((p) => p.brand))).toEqual(
      new Set(["MDH", "Amul"]),
    );
    const cold = await api.listProducts({
      storageType: ["chilled", "frozen"],
    });
    expect(cold.total).toBe(4);
    // Different parameters narrow down.
    const both = await api.listProducts({
      brand: ["MDH"],
      storageType: ["chilled"],
    });
    expect(both.total).toBe(0);
  });

  it("shows the matching pack size of a product with several", async () => {
    const page = await guestApi().listProducts({ packSize: ["1kg"] });
    expect(page.total).toBe(6);
    const rice = page.items.find((p) => p.name === "Basmati Rice");
    expect(rice?.packSize.label).toBe("1 kg");
    expect(rice?.slug).toBe("basmati-rice-1kg");
    expect(rice?.variants.find((s) => s.isSelected)?.slug).toBe(
      "basmati-rice-1kg",
    );
    expect(page.items.find((p) => p.name === "Chakki Atta")).toBeUndefined();
  });

  it("counts every facet without its own filter and with the others", async () => {
    const api = guestApi();
    const all = await api.getProductFacets({});
    expect(all.total).toBe(22);
    expect(all.brands.slice(0, 3)).toEqual([
      { value: "Radhe", count: 13 },
      { value: "MDH", count: 3 },
      { value: "Aashirvaad", count: 1 },
    ]);
    expect(all.storageTypes).toEqual([
      { value: "ambient", count: 18 },
      { value: "chilled", count: 3 },
      { value: "frozen", count: 1 },
    ]);
    // A product counts once, in the band of its default size (doc 7).
    expect(all.priceBands.map((band) => band.count)).toEqual([
      3, 11, 4, 2, 2, 0,
    ]);
    expect(all.priceBands.at(-1)).toMatchObject({ min: 5000, max: null });
    expect(all.price).toEqual({ min: 179, max: 2999 });
    // A product is on offer when one of its sizes is reduced.
    expect(all.onSale).toEqual([
      { value: true, count: 3 },
      { value: false, count: 19 },
    ]);

    const mdh = await api.getProductFacets({ brand: ["MDH"] });
    expect(mdh.total).toBe(3);
    // The brands still list the others: choosing one more would add them.
    expect(mdh.brands.find((b) => b.value === "Radhe")?.count).toBe(13);
    // The other facets count among MDH's products only.
    expect(mdh.tags).toEqual([]);
    expect(mdh.storageTypes).toEqual([{ value: "ambient", count: 3 }]);
    expect(
      mdh.packSizes.map((s) => [s.value, s.packSize.label, s.count]),
    ).toEqual([
      ["100g", "100 g", 3],
      ["400g", "400 g", 1],
    ]);
    // The price range runs over the default sizes, not the 400 g pack.
    expect(mdh.price).toEqual({ min: 179, max: 249 });
    const de = await api.getProductFacets({ brand: ["MDH"] }, { locale: "de" });
    expect(de.packSizes[0]?.packSize.label).toBe("100 g");
  });

  it("refuses a malformed pack size or storage type", async () => {
    const api = guestApi();
    const size = await api.listProducts({ packSize: ["1 kg"] }).catch((e) => e);
    expect(hasErrorCode(size, "VALIDATION_FAILED")).toBe(true);
    const type = await api
      .getProductFacets({ storageType: ["cold" as "chilled"] })
      .catch((e) => e);
    expect(hasErrorCode(type, "VALIDATION_FAILED")).toBe(true);
  });
});

describe("stock", () => {
  async function setStock(variantId: string, quantity: number) {
    await fetch(`${base}/__mock/stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, quantity }),
    });
  }

  it("caps the quantity of a line at what is in stock", async () => {
    await setStock(SKU.chakkiAtta5kg, 3);
    const api = guestApi();
    const product = await api.getProduct("chakki-atta-5kg");
    expect(product.product.ordering).toMatchObject({
      canOrder: true,
      maxQuantity: 3,
      remaining: 3,
    });
    const bill = await api.previewCart([
      { variantId: SKU.chakkiAtta5kg, quantity: 4 },
    ]);
    expect(bill.canOrder).toBe(false);
    expect(bill.lines[0].issue).toBe("quantity_above_maximum");
  });

  it("sells out when the stock is gone, and the cart says so", async () => {
    await setStock(SKU.chakkiAtta5kg, 0);
    const api = guestApi();
    const product = await api.getProduct("chakki-atta-5kg");
    expect(product.product.ordering).toMatchObject({
      canOrder: false,
      reason: "sold_out",
      maxQuantity: 0,
      remaining: 0,
    });
    const orderable = await api.listProducts({ q: "atta", orderable: true });
    expect(orderable.items.map((p) => p.sku)).not.toContain("RF-00101");
    const bill = await api.previewCart([
      { variantId: SKU.chakkiAtta5kg, quantity: 1 },
    ]);
    expect(bill.canOrder).toBe(false);
    expect(bill.lines[0].issue).toBe("sold_out");
  });
});

describe("the bill", () => {
  it("adds the delivery fee below the free limit and splits out VAT", async () => {
    // Two bags of atta at 12.99: the example of the API documentation (8.1).
    const bill = await guestApi().previewCart([
      { variantId: SKU.chakkiAtta5kg, quantity: 2 },
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
      { variantId: SKU.chakkiAtta5kg, quantity: 4 },
    ]);
    expect(bill.totals.deliveryFee).toBe(0);
    expect(bill.totals.total).toBe(5196);
    expect(bill.delivery.missingForFree).toBe(0);
  });

  it("keeps two VAT rates apart and shares the delivery fee between them", async () => {
    const bill = await guestApi().previewCart([
      { variantId: SKU.chakkiAtta5kg, quantity: 1 },
      { variantId: SKU.mangoDrink, quantity: 4 },
    ]);
    const { totals } = bill;
    expect(totals.vat.map((g) => g.vatRate)).toEqual([700, 1900]);
    expect(totals.vat.reduce((sum, g) => sum + g.gross, 0)).toBe(totals.total);
    expect(totals.netTotal + totals.vatTotal).toBe(totals.total);
    expect(totals.total).toBe(totals.subtotal + totals.deliveryFee);
  });

  it("marks lines that cannot be ordered and leaves them out of the total", async () => {
    const bill = await guestApi().previewCart([
      { variantId: SKU.chakkiAtta5kg, quantity: 1 },
      { variantId: SKU.kesarMango, quantity: 1 },
      { variantId: SKU.khakhra, quantity: 1 },
      { variantId: SKU.bhujia, quantity: 20 },
      { variantId: "66f4000000000000000000ff", quantity: 1 },
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
        items: [{ variantId: SKU.toorDal1kg, quantity: 1, price: 1 }],
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

describe("sign-up, sign-in and the stored cart", () => {
  it("creates the account with the sign-up and keeps the session in cookies", async () => {
    const { api, customer, jar } = await signIn("anna@example.com");
    expect(customer.email).toBe("anna@example.com");
    expect(customer.firstName).toBe("Anna");
    expect(customer).not.toHaveProperty("hasGoogleLogin");
    expect(jar.map((c) => `${c.name} ${c.path}`).sort()).toEqual([
      "rf_customer_access /",
      "rf_customer_refresh /v1/store/auth",
    ]);
    const me = await api.getMe();
    expect(me.customer.id).toBe(customer.id);
  });

  it("refuses a second account for the address and a password that is easy to guess", async () => {
    const { api } = customerApi();
    await api.signUp({
      ...NAME,
      email: "Anna@Example.com",
      password: PASSWORD,
    });
    const taken = await api
      .signUp({ ...NAME, email: "anna@example.com", password: "Another-1" })
      .catch((e) => e);
    expect(hasErrorCode(taken, "CUSTOMER_EMAIL_TAKEN")).toBe(true);
    expect(taken.status).toBe(409);

    for (const password of ["password1", "aaaaaaaaaa", "my-max-2026"]) {
      const weak = await api
        .signUp({ ...NAME, email: "max@example.com", password })
        .catch((e) => e);
      expect(hasErrorCode(weak, "PASSWORD_TOO_WEAK")).toBe(true);
    }
    const short = await api
      .signUp({ ...NAME, email: "max@example.com", password: "short" })
      .catch((e) => e);
    expect(hasErrorCode(short, "VALIDATION_FAILED")).toBe(true);
    const unknownField = await api
      .signUp({
        ...NAME,
        email: "max@example.com",
        password: PASSWORD,
        hasGoogleLogin: false,
      } as never)
      .catch((e) => e);
    expect(hasErrorCode(unknownField, "VALIDATION_FAILED")).toBe(true);
  });

  it("signs in with email and password, and says the same for a wrong password and an unknown address", async () => {
    await signIn("anna@example.com");
    const { api } = customerApi();
    const wrong = await api
      .login({ email: "anna@example.com", password: "not-the-one" })
      .catch((e) => e);
    const unknown = await api
      .login({ email: "nobody@example.com", password: PASSWORD })
      .catch((e) => e);
    expect(hasErrorCode(wrong, "CUSTOMER_CREDENTIALS_INVALID")).toBe(true);
    expect(hasErrorCode(unknown, "CUSTOMER_CREDENTIALS_INVALID")).toBe(true);
    expect(unknown.status).toBe(wrong.status);
    expect(unknown.message).toBe(wrong.message);

    const session = await api.login({
      email: " Anna@Example.com ",
      password: PASSWORD,
    });
    expect(session.customer.email).toBe("anna@example.com");

    const blocked = await api
      .login({ email: "blocked@example.com", password: PASSWORD })
      .catch((e) => e);
    expect(hasErrorCode(blocked, "CUSTOMER_BLOCKED")).toBe(true);
  });

  it("resets a forgotten password by the link of the email and ends every session", async () => {
    const first = await signIn("anna@example.com");
    const { api } = customerApi();
    // The same answer whether or not the address has an account.
    await expect(
      api.forgotPassword({ email: "nobody@example.com" }),
    ).resolves.toBeUndefined();
    await api.forgotPassword({ email: "anna@example.com", locale: "de" });
    const tokens = (await (
      await fetch(`${base}/__mock/tokens?email=anna@example.com`)
    ).json()) as { passwordReset: string | null };
    expect(tokens.passwordReset).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const resetToken = tokens.passwordReset!;

    const weak = await api
      .resetPassword({ token: resetToken, password: "password1" })
      .catch((e) => e);
    expect(hasErrorCode(weak, "PASSWORD_TOO_WEAK")).toBe(true);
    await api.resetPassword({
      token: resetToken,
      password: "Coriander-and-Cumin-7",
    });

    // The link worked once; the old password is gone; the new one works.
    const again = await api
      .resetPassword({ token: resetToken, password: "Coriander-and-Cumin-8" })
      .catch((e) => e);
    expect(hasErrorCode(again, "PASSWORD_RESET_INVALID")).toBe(true);
    const old = await api
      .login({ email: "anna@example.com", password: PASSWORD })
      .catch((e) => e);
    expect(hasErrorCode(old, "CUSTOMER_CREDENTIALS_INVALID")).toBe(true);
    const fresh = await api.login({
      email: "anna@example.com",
      password: "Coriander-and-Cumin-7",
    });
    expect(fresh.customer.id).toBe(first.customer.id);
    // The earlier session is over: its refresh is refused as well.
    const ended = await first.api.getMe().catch((e) => e);
    expect(hasErrorCode(ended, "AUTH_TOKEN_INVALID")).toBe(true);

    const unknownLink = await api
      .resetPassword({
        token: "not-a-link-anyone-was-sent-0000",
        password: "Coriander-and-Cumin-7",
      })
      .catch((e) => e);
    expect(hasErrorCode(unknownLink, "PASSWORD_RESET_INVALID")).toBe(true);
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
      { variantId: SKU.toorDal1kg, quantity: 1 },
      { variantId: SKU.chakkiAtta5kg, quantity: 2 },
      { variantId: "66f4000000000000000000ff", quantity: 5 },
    ]);
    expect(bill.lines.map((line) => [line.variantId, line.quantity])).toEqual([
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
        items: [{ variantId: SKU.toorDal1kg, quantity: 1 }],
      }),
    });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("ORIGIN_NOT_ALLOWED");
  });
});

describe("the wishlist", () => {
  async function rice() {
    const page = await guestApi().listProducts({ q: "basmati" });
    const product = page.items.find((p) =>
      p.variants.some((v) => v.id === SKU.basmati1kg),
    )!;
    return { product, oneKg: SKU.basmati1kg, fiveKg: SKU.basmati5kg };
  }

  it("renders a visitor's list without storing it; unknown products are left out, the remembered size is selected", async () => {
    const { product, fiveKg } = await rice();
    const list = await guestApi().previewWishlist([
      { productId: product.id, variantId: fiveKg },
      { productId: "000000000000000000000000" },
    ]);
    expect(list.count).toBe(1);
    expect(list.items[0]).toMatchObject({
      productId: product.id,
      variantId: fiveKg,
      addedAt: null,
    });
    expect(list.items[0].product.variantId).toBe(fiveKg);
    // A size that is not the product's: the size listings show, nothing remembered.
    const other = await guestApi().previewWishlist([
      { productId: product.id, variantId: "000000000000000000000001" },
    ]);
    expect(other.items[0].variantId).toBeNull();
    expect(other.items[0].product.variantId).toBe(product.variantId);
    const twice = await guestApi()
      .previewWishlist([{ productId: product.id }, { productId: product.id }])
      .catch((e) => e);
    expect(hasErrorCode(twice, "VALIDATION_FAILED")).toBe(true);
  });

  it("a customer saves a product, changes its size, removes it and empties the list", async () => {
    const { api } = await signIn("anna@example.com");
    const { product, oneKg, fiveKg } = await rice();
    expect((await api.getWishlist()).count).toBe(0);
    let list = await api.saveWishlistItem(product.id);
    expect(list.count).toBe(1);
    expect(list.items[0].variantId).toBeNull();
    expect(list.items[0].addedAt).not.toBeNull();
    list = await api.saveWishlistItem(product.id, fiveKg);
    expect(list.count).toBe(1);
    expect(list.items[0].variantId).toBe(fiveKg);
    expect(list.items[0].product.variantId).toBe(fiveKg);
    expect(list.items[0].product.variants.map((v) => v.id)).toContain(oneKg);

    const unknown = await api
      .saveWishlistItem("000000000000000000000000")
      .catch((e) => e);
    expect(hasErrorCode(unknown, "PRODUCT_NOT_FOUND")).toBe(true);
    expect(unknown.status).toBe(404);
    const wrongSize = await api
      .saveWishlistItem(product.id, "000000000000000000000001")
      .catch((e) => e);
    expect(hasErrorCode(wrongSize, "PRODUCT_VARIANT_NOT_FOUND")).toBe(true);
    expect((await api.getWishlist()).count).toBe(1);

    expect((await api.removeWishlistItem(product.id)).count).toBe(0);
    expect((await api.removeWishlistItem(product.id)).count).toBe(0);
    await api.saveWishlistItem(product.id);
    expect((await api.clearWishlist()).items).toEqual([]);
    expect((await api.getWishlist()).count).toBe(0);
  });

  it("merges the visitor's list once: saved products keep their size, nothing is doubled", async () => {
    const { api } = await signIn("anna@example.com");
    const { product, oneKg, fiveKg } = await rice();
    const dal = (await guestApi().listProducts({ q: "toor" })).items[0];
    await api.saveWishlistItem(product.id, oneKg);
    const merged = await api.mergeWishlist([
      { productId: dal.id },
      { productId: product.id, variantId: fiveKg },
      { productId: "000000000000000000000000" },
    ]);
    expect(merged.items.map((i) => i.productId)).toEqual([dal.id, product.id]);
    expect(merged.items[1].variantId).toBe(oneKg);
    const again = await api.mergeWishlist([{ productId: dal.id }]);
    expect(again.count).toBe(2);
    expect(
      hasErrorCode(
        await api.mergeWishlist([]).catch((e) => e),
        "VALIDATION_FAILED",
      ),
    ).toBe(true);
  });
});

describe("the banners of the home page", () => {
  it("answers the live ones in order, each in three widths of one ratio, linked as the admin said", async () => {
    const { banners } = await guestApi().listBanners();
    expect(banners.map((b) => b.linkUrl)).toEqual([
      "/category/snacks",
      "/products/basmati-rice-1kg",
      "https://example.com/radhe-foods",
      null,
    ]);
    expect(banners.map((b) => b.isExternal)).toEqual([
      false,
      false,
      true,
      false,
    ]);
    const first = banners[0].image;
    expect(first.sizes.small.width).toBe(768);
    expect(first.sizes.medium.width).toBe(1536);
    expect(first.sizes.large).toMatchObject({ width: 2400, height: 1000 });
    expect(first.width / first.height).toBeCloseTo(
      first.sizes.small.width / first.sizes.small.height,
      1,
    );
    expect(first.alt).toBe("Diwali offer: sweets and snacks reduced");
    const german = await guestApi().listBanners({ locale: "de" });
    expect(german.banners[0].image.alt).toBe(
      "Diwali-Angebot: Süßes und Snacks reduziert",
    );
    expect(banners[2].image.alt).toBeNull();
    // A picture that was uploaded smaller than 2560 is never enlarged.
    expect(banners[3].image.sizes.large.width).toBe(1800);
    // The picture lives on the mock itself (the address is set when it starts).
    const picture = await fetch(
      `${base}${new URL(first.sizes.small.url).pathname}`,
    );
    expect(picture.headers.get("content-type")).toBe("image/svg+xml");
  });

  it("answers no banner at all when the control says so", async () => {
    await fetch(`${base}/__mock/banners`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect((await guestApi().listBanners()).banners).toEqual([]);
  });
});

describe("the FAQ", () => {
  it("answers the visible groups with their published questions, the ungrouped last", async () => {
    const { groups } = await guestApi().listFaqs();
    expect(groups.map((g) => g.name)).toEqual([
      "Orders",
      "Delivery",
      "Returns",
      null,
    ]);
    expect(groups[0].items.map((i) => i.question)).toEqual([
      "Can I cancel my order?",
      "Can I track my order?",
    ]);
    expect(groups[3]).toMatchObject({ id: null, name: null });
    expect(groups[3].items).toHaveLength(2);
    // Markdown stays Markdown; the shop renders it.
    expect(groups[0].items[0].answer).toContain("*Cancel order*");
    // German falls back to English where it is missing.
    const german = await guestApi().listFaqs({ locale: "de" });
    expect(german.groups[0].name).toBe("Bestellungen");
    expect(german.groups[3].items[0].question).toBe(
      "Do you have a shop in Frankfurt?",
    );
  });
});

describe("the blog", () => {
  it("lists the published posts whose date has come, newest first, in pages", async () => {
    const page = await guestApi().listBlogPosts({ limit: 5 });
    expect(page).toMatchObject({ page: 1, limit: 5, total: 13, totalPages: 3 });
    expect(page.items[0]).toMatchObject({
      slug: "the-perfect-dal",
      title: "The perfect dal",
      author: "Vrushabh",
      readingMinutes: 1,
      category: { slug: "recipes", name: "Recipes" },
      tags: ["recipes", "lentils", "dal"],
    });
    expect(page.items[0].featuredImage?.alt).toBe("A bowl of dal");
    expect(page.items[0].featuredImage?.sizes.large).toMatchObject({
      width: 1920,
      height: 1080,
    });
    // A post without a description of its picture takes its title.
    expect(page.items[1].featuredImage?.alt).toBe("How to store spices");
    const last = await guestApi().listBlogPosts({ limit: 5, page: 3 });
    expect(last.items.map((p) => p.slug)).toEqual([
      "tempering-explained",
      "aloo-paratha-for-breakfast",
      "we-now-deliver-with-hermes-too",
    ]);
    const all = await guestApi().listBlogPosts({ limit: 100 });
    expect(all.items.map((p) => p.slug)).not.toContain("our-story");
    expect(all.items.map((p) => p.slug)).not.toContain("holi-colours");
    // German slugs and names.
    const german = await guestApi().listBlogPosts(
      { limit: 1 },
      { locale: "de" },
    );
    expect(german.items[0]).toMatchObject({
      slug: "das-perfekte-dal",
      category: { slug: "rezepte", name: "Rezepte" },
    });
  });

  it("narrows the list by category (either language), tag and search", async () => {
    const api = guestApi();
    expect((await api.listBlogPosts({ category: "kitchen-tips" })).total).toBe(
      4,
    );
    expect((await api.listBlogPosts({ category: "kuechentipps" })).total).toBe(
      4,
    );
    expect((await api.listBlogPosts({ category: "no-such" })).total).toBe(0);
    expect((await api.listBlogPosts({ tag: "spices" })).total).toBe(3);
    expect(
      (await api.listBlogPosts({ q: "dal" })).items.map((p) => p.slug),
    ).toEqual(["the-perfect-dal"]);
    expect((await api.listBlogPosts({ q: "basm" })).total).toBe(1);
    await expect(api.listBlogPosts({ q: "d" })).rejects.toSatisfy((error) =>
      hasErrorCode(error, "VALIDATION_FAILED"),
    );
  });

  it("answers an article by the slug of either language, with related posts", async () => {
    const { post } = await guestApi().getBlogPost("the-perfect-dal");
    expect(post.content).toContain("# Dal");
    expect(post.content).toContain(
      "/media/blog/66f600000000000000000001/medium.svg",
    );
    expect(post.contentLocale).toBe("en");
    expect(post.seo).toEqual({
      title: "The perfect dal – a recipe from Radhe Foods",
      description:
        "How to cook toor dal with a proper tempering of cumin, garlic and chilli.",
    });
    expect(post.alternates).toEqual({
      en: "the-perfect-dal",
      de: "das-perfekte-dal",
    });
    expect(post.related.map((p) => p.slug)).toEqual([
      "basmati-three-ways",
      "masala-chai-properly",
      "chana-masala-for-a-crowd",
    ]);
    // The German address, with the English text where the German is missing.
    const german = await guestApi().getBlogPost("so-lagern-sie-gewuerze", {
      locale: "de",
    });
    expect(german.post.slug).toBe("so-lagern-sie-gewuerze");
    expect(german.post.contentLocale).toBe("en");
    expect(german.post.seo.title).toBe("So lagern Sie Gewürze");
    const byEnglishSlug = await guestApi().getBlogPost("the-perfect-dal", {
      locale: "de",
    });
    expect(byEnglishSlug.post.slug).toBe("das-perfekte-dal");
    expect(byEnglishSlug.post.contentLocale).toBe("de");
    // The picture lives on the mock itself.
    const picture = await fetch(
      `${base}${new URL(post.featuredImage!.sizes.small.url).pathname}`,
    );
    expect(picture.headers.get("content-type")).toBe("image/svg+xml");
  });

  it("does not find drafts, scheduled posts and unknown slugs", async () => {
    for (const slug of ["our-story", "holi-colours", "no-such-post"]) {
      await expect(guestApi().getBlogPost(slug)).rejects.toSatisfy((error) =>
        hasErrorCode(error, "BLOG_POST_NOT_FOUND"),
      );
    }
  });

  it("lists the categories with their counts and the tags most used first", async () => {
    const { items } = await guestApi().listBlogCategories();
    expect(items.map((c) => [c.slug, c.postCount])).toEqual([
      ["recipes", 5],
      ["kitchen-tips", 4],
      ["news", 4],
      ["festivals", 0],
    ]);
    expect(items[0].alternates).toEqual({ en: "recipes", de: "rezepte" });
    expect(items[0].seo.title).toBe("Indian recipes from Radhe Foods");
    const tags = await guestApi().listBlogTags();
    expect(tags.items.slice(0, 3)).toEqual([
      { tag: "recipes", count: 5 },
      { tag: "news", count: 3 },
      { tag: "spices", count: 3 },
    ]);
  });
});
