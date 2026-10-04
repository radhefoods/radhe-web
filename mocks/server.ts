// A stand-in for the Radhe Foods API (radhe-api), for development and tests.
// It answers the store endpoints in the shapes and with the error codes of
// doc/CUSTOMER_WEB_API_DOCUMENTATION.md, from fixtures kept in memory.
//
//   npm run dev:mock        starts it on http://localhost:3000
//
// Built so far: settings, legal texts, cargo, categories, products, cart
// (preview, stored cart, merge), sign-in with a login code, addresses,
// orders, payments (with a stand-in payment page), invoices and credit notes
// with PDF, and returns. `demo@radhefoods.de` gets a filled demo account.
//
// Run with Node 22.18 or newer (it reads TypeScript directly); no build step.

import { randomBytes, randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { pathToFileURL } from "node:url";
import type { CartItemInput, ProductQuery } from "../src/lib/api/types.ts";
import {
  HttpError,
  OBJECT_ID,
  PHONE,
  objectBody,
  validationFailed,
} from "./errors.ts";
import {
  addresses,
  cancelOrder,
  getOrder,
  listOrders,
  orderingPermission,
  placeOrder,
  findOrder,
  resetFixtures,
} from "./orders.ts";
import { DEMO_EMAIL, seedDemoAccount } from "./demo.ts";
import {
  advanceOrder,
  cancelReturn,
  createCheckout,
  createReturn,
  decideReturn,
  findInvoice,
  findReturn,
  invoicePdf,
  listInvoices,
  markPaid,
  orderPayment,
  orderReturns,
  paymentBlockOf,
  stripe,
  type OrderAction,
} from "./payments.ts";
import {
  ACCESS_TTL_SECONDS,
  BLOCKED_EMAIL,
  MOCK_OTP_CODE,
  OTP_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_HOUR,
  OTP_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
  cargoState,
  customerByEmail,
  db,
  legalDocuments,
  newCustomer,
  resetState,
  type CustomerRecord,
  type Locale,
  type SessionRecord,
} from "./state.ts";
import {
  billOf,
  cargoStatus,
  categoryBySlug,
  categoryDetail,
  categoryTree,
  customerView,
  findProduct,
  legalDocument,
  legalList,
  listProducts,
  placeholderSvg,
  productBySlug,
  productDetail,
  setMediaBase,
  settingsView,
} from "./views.ts";

const ACCESS_COOKIE = "rf_customer_access";
const REFRESH_COOKIE = "rf_customer_refresh";
const REFRESH_PATH = "/v1/store/auth";
const CART_MAX_LINES = 100;
/** The shop, for the links the API builds (`SHOP_URL` of the real API). */
const SHOP_URL = process.env.SHOP_URL || "http://localhost:3001";

// --- Errors (doc 0.4) -------------------------------------------------------

// --- Request context --------------------------------------------------------

interface Context {
  method: string;
  url: URL;
  params: Record<string, string>;
  locale: Locale;
  body: unknown;
  cookies: Record<string, string>;
  headers: IncomingMessage["headers"];
}

interface Result {
  status?: number;
  body?: unknown;
  setCookies?: string[];
  raw?: {
    contentType: string;
    content: string | Buffer;
    cacheControl?: string;
  };
  /** Extra response headers, for example `Location` of a redirect. */
  headers?: Record<string, string>;
}

type Handler = (ctx: Context) => Result | Promise<Result>;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

const routes: Route[] = [];

function route(method: string, path: string, handler: Handler): void {
  const keys: string[] = [];
  const pattern = new RegExp(
    `^${path.replace(/:([a-zA-Z]+)/g, (_, key: string) => {
      keys.push(key);
      return "([^/]+)";
    })}$`,
  );
  routes.push({ method, pattern, keys, handler });
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0) {
      cookies[part.slice(0, index).trim()] = decodeURIComponent(
        part.slice(index + 1).trim(),
      );
    }
  }
  return cookies;
}

function localeOf(url: URL, headers: IncomingMessage["headers"]): Locale {
  const fromQuery = url.searchParams.get("locale");
  if (fromQuery === "en" || fromQuery === "de") return fromQuery;
  const accepted = String(headers["accept-language"] ?? "")
    .split(",")
    .map((entry) => entry.trim().slice(0, 2).toLowerCase());
  return accepted.find((l): l is Locale => l === "en" || l === "de") ?? "en";
}

// --- Validation helpers (unknown fields are rejected, doc 0.2) --------------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function emailOf(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) {
    throw validationFailed("email", "email must be an email");
  }
  return email;
}

function optionalLocale(value: unknown, fallback: Locale): Locale {
  if (value === undefined) return fallback;
  if (value !== "en" && value !== "de") {
    throw validationFailed("locale", "locale must be one of: en, de");
  }
  return value;
}

function cartItems(value: unknown, minimum: number): CartItemInput[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > 100) {
    throw validationFailed("items", "items must contain 1 to 100 entries");
  }
  const seen = new Set<string>();
  return value.map((entry, index) => {
    const item = objectBody(entry, ["productId", "quantity"]);
    if (typeof item.productId !== "string" || !OBJECT_ID.test(item.productId)) {
      throw validationFailed(
        `items.${index}.productId`,
        "productId must be an id",
      );
    }
    if (
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 10_000
    ) {
      throw validationFailed(
        `items.${index}.quantity`,
        "quantity must not be less than 1",
      );
    }
    if (seen.has(item.productId)) {
      throw validationFailed("items", "items must not contain a product twice");
    }
    seen.add(item.productId);
    return { productId: item.productId, quantity: item.quantity };
  });
}

function booleanParam(url: URL, key: string): boolean | undefined {
  const value = url.searchParams.get(key);
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw validationFailed(key, `${key} must be a boolean value`);
}

function intParam(
  url: URL,
  key: string,
  min: number,
  max: number,
): number | undefined {
  const value = url.searchParams.get(key);
  if (value === null) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw validationFailed(
      key,
      `${key} must be an integer from ${min} to ${max}`,
    );
  }
  return number;
}

// --- Sessions and cookies (doc 0.5) -----------------------------------------

function cookie(
  name: string,
  value: string,
  path: string,
  maxAge: number,
): string {
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
}

function clearCookies(): string[] {
  return [
    cookie(ACCESS_COOKIE, "", "/", 0),
    cookie(REFRESH_COOKIE, "", REFRESH_PATH, 0),
  ];
}

function token(): string {
  return randomBytes(24).toString("base64url");
}

function startSession(customer: CustomerRecord): Result {
  const session: SessionRecord = {
    customerId: customer.id,
    accessToken: token(),
    accessExpiresAt: Date.now() + ACCESS_TTL_SECONDS * 1000,
    refreshToken: token(),
    refreshExpiresAt: Date.now() + REFRESH_TTL_SECONDS * 1000,
  };
  db.sessions.add(session);
  return {
    body: {
      customer: customerView(customer),
      accessTokenExpiresInSeconds: ACCESS_TTL_SECONDS,
    },
    setCookies: [
      cookie(ACCESS_COOKIE, session.accessToken, "/", ACCESS_TTL_SECONDS),
      cookie(
        REFRESH_COOKIE,
        session.refreshToken,
        REFRESH_PATH,
        REFRESH_TTL_SECONDS,
      ),
    ],
  };
}

function accessTokenOf(ctx: Context): string | undefined {
  const bearer = /^Bearer (.+)$/.exec(String(ctx.headers.authorization ?? ""));
  return bearer?.[1] ?? ctx.cookies[ACCESS_COOKIE];
}

/** The signed-in customer, or `401 AUTH_TOKEN_INVALID`. */
function requireCustomer(ctx: Context): CustomerRecord {
  const access = accessTokenOf(ctx);
  for (const session of db.sessions) {
    if (
      session.accessToken === access &&
      session.accessExpiresAt > Date.now()
    ) {
      const customer = db.customers.get(session.customerId);
      if (customer) return customer;
    }
  }
  throw new HttpError(
    401,
    "AUTH_TOKEN_INVALID",
    "The access token is missing, invalid or expired.",
  );
}

// --- Health -----------------------------------------------------------------

route("GET", "/health/live", () => ({ body: { status: "ok" } }));
route("GET", "/health", () => ({
  body: {
    status: "ok",
    database: "up",
    uptimeSeconds: Math.floor(process.uptime()),
  },
}));

// --- 1 Authentication -------------------------------------------------------

route("POST", "/v1/store/auth/otp/request", (ctx) => {
  const body = objectBody(ctx.body, ["email", "locale"]);
  const email = emailOf(body.email);
  const locale = optionalLocale(body.locale, ctx.locale);
  const now = Date.now();
  const previous = db.otps.get(email);
  const lastHour = (previous?.sentInLastHour ?? []).filter(
    (sent) => now - sent < 3_600_000,
  );
  if (previous && now - previous.sentAt < OTP_COOLDOWN_SECONDS * 1000) {
    throw new HttpError(429, "OTP_COOLDOWN", "A code was sent a moment ago.", {
      retryAfterSeconds: Math.ceil(
        (previous.sentAt + OTP_COOLDOWN_SECONDS * 1000 - now) / 1000,
      ),
    });
  }
  if (lastHour.length >= OTP_MAX_PER_HOUR) {
    throw new HttpError(429, "OTP_LIMIT_REACHED", "Too many codes were sent.", {
      retryAfterSeconds: Math.ceil((lastHour[0] + 3_600_000 - now) / 1000),
    });
  }
  db.otps.set(email, {
    code: MOCK_OTP_CODE,
    locale,
    attempts: 0,
    sentAt: now,
    expiresAt: now + OTP_TTL_SECONDS * 1000,
    sentInLastHour: [...lastHour, now],
  });
  console.log(`[mock] login code for ${email}: ${MOCK_OTP_CODE}`);
  return {
    body: {
      expiresInSeconds: OTP_TTL_SECONDS,
      resendAfterSeconds: OTP_COOLDOWN_SECONDS,
    },
  };
});

function createAccount(email: string, locale: Locale): CustomerRecord {
  const customer = newCustomer(email, locale);
  if (email === DEMO_EMAIL) seedDemoAccount(customer, SHOP_URL);
  return customer;
}

route("POST", "/v1/store/auth/otp/verify", (ctx) => {
  const body = objectBody(ctx.body, ["email", "code", "locale"]);
  const email = emailOf(body.email);
  if (typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) {
    throw validationFailed("code", "code must be exactly 6 digits");
  }
  const otp = db.otps.get(email);
  if (!otp || otp.expiresAt < Date.now() || otp.attempts >= OTP_MAX_ATTEMPTS) {
    throw new HttpError(
      401,
      "OTP_INVALID",
      "The code is wrong or has expired.",
    );
  }
  if (otp.code !== body.code) {
    otp.attempts += 1;
    throw new HttpError(
      401,
      "OTP_INVALID",
      "The code is wrong or has expired.",
      {
        attemptsRemaining: OTP_MAX_ATTEMPTS - otp.attempts,
      },
    );
  }
  db.otps.delete(email);
  if (email === BLOCKED_EMAIL) {
    throw new HttpError(403, "CUSTOMER_BLOCKED", "This account is blocked.");
  }
  const customer =
    customerByEmail(email) ??
    createAccount(email, optionalLocale(body.locale, otp.locale));
  return startSession(customer);
});

route("POST", "/v1/store/auth/google", (ctx) => {
  objectBody(ctx.body, ["idToken", "locale"]);
  throw new HttpError(
    503,
    "GOOGLE_NOT_CONFIGURED",
    "Google sign-in is not set up on this server.",
  );
});

route("POST", "/v1/store/auth/refresh", (ctx) => {
  const refresh = ctx.cookies[REFRESH_COOKIE];
  const session = [...db.sessions].find((s) => s.refreshToken === refresh);
  if (!refresh || !session || session.refreshExpiresAt < Date.now()) {
    throw new HttpError(
      401,
      "AUTH_REFRESH_INVALID",
      "The session has ended. Please sign in again.",
      undefined,
      clearCookies(),
    );
  }
  const customer = db.customers.get(session.customerId);
  db.sessions.delete(session);
  if (!customer || customer.blocked) {
    throw new HttpError(
      403,
      "CUSTOMER_BLOCKED",
      "This account is blocked.",
      undefined,
      clearCookies(),
    );
  }
  // Refresh tokens rotate: the old one stops working.
  return startSession(customer);
});

route("POST", "/v1/store/auth/logout", (ctx) => {
  const refresh = ctx.cookies[REFRESH_COOKIE];
  const access = ctx.cookies[ACCESS_COOKIE];
  for (const session of db.sessions) {
    if (session.refreshToken === refresh || session.accessToken === access) {
      db.sessions.delete(session);
    }
  }
  return { status: 204, setCookies: clearCookies() };
});

route("POST", "/v1/store/auth/logout-all", (ctx) => {
  const customer = requireCustomer(ctx);
  for (const session of db.sessions) {
    if (session.customerId === customer.id) db.sessions.delete(session);
  }
  return { status: 204, setCookies: clearCookies() };
});

// --- 2 Account --------------------------------------------------------------

route("GET", "/v1/store/me", (ctx) => ({
  body: { customer: customerView(requireCustomer(ctx)) },
}));

route("PATCH", "/v1/store/me", (ctx) => {
  const customer = requireCustomer(ctx);
  const body = objectBody(ctx.body, [
    "firstName",
    "lastName",
    "phone",
    "locale",
  ]);
  for (const key of ["firstName", "lastName"] as const) {
    const value = body[key];
    if (value === undefined) continue;
    const text = typeof value === "string" ? value.trim() : "";
    if (text.length < 1 || text.length > 80) {
      throw validationFailed(key, `${key} must be 1 to 80 characters`);
    }
    customer[key] = text;
  }
  if (body.phone !== undefined) {
    if (typeof body.phone !== "string" || !PHONE.test(body.phone)) {
      throw validationFailed("phone", "phone must be in international format");
    }
    customer.phone = body.phone;
  }
  customer.locale = optionalLocale(body.locale, customer.locale);
  return { body: { customer: customerView(customer) } };
});

route("PATCH", "/v1/store/me/communication", (ctx) => {
  const customer = requireCustomer(ctx);
  const body = objectBody(ctx.body, [
    "whatsappNumber",
    "whatsappOptIn",
    "marketingOptIn",
  ]);
  const now = new Date().toISOString();
  const communication = customer.communication;
  if (body.whatsappNumber !== undefined) {
    if (
      body.whatsappNumber !== null &&
      (typeof body.whatsappNumber !== "string" ||
        !PHONE.test(body.whatsappNumber))
    ) {
      throw validationFailed(
        "whatsappNumber",
        "whatsappNumber must be in international format",
      );
    }
    communication.whatsappNumber = body.whatsappNumber;
  }
  for (const key of ["whatsappOptIn", "marketingOptIn"] as const) {
    if (body[key] !== undefined && typeof body[key] !== "boolean") {
      throw validationFailed(key, `${key} must be a boolean value`);
    }
  }
  if (typeof body.whatsappOptIn === "boolean") {
    communication.whatsappOptIn = body.whatsappOptIn;
    communication.whatsappOptInAt = body.whatsappOptIn ? now : null;
  }
  if (typeof body.marketingOptIn === "boolean") {
    communication.marketingOptIn = body.marketingOptIn;
    if (body.marketingOptIn) communication.marketingOptInAt = now;
    else communication.marketingOptOutAt = now;
  }
  return { body: { communication: { ...communication } } };
});

// --- 6 Settings and legal texts ---------------------------------------------

route("GET", "/v1/store/settings", () => ({ body: settingsView() }));

route("GET", "/v1/store/legal", (ctx) => ({ body: legalList(ctx.locale) }));

route("GET", "/v1/store/legal/:type", (ctx) => {
  if (!["terms", "preorder_terms", "privacy"].includes(ctx.params.type)) {
    throw new HttpError(
      400,
      "BAD_REQUEST",
      "Validation failed (enum string is expected)",
    );
  }
  const document = legalDocument(ctx.params.type, ctx.locale);
  if (!document) {
    throw new HttpError(
      404,
      "LEGAL_DOCUMENT_NOT_FOUND",
      "This legal text is not published yet.",
    );
  }
  return { body: { document } };
});

// --- 7 Catalogue and cargo --------------------------------------------------

route("GET", "/v1/store/cargo", (ctx) => ({ body: cargoStatus(ctx.locale) }));

route("GET", "/v1/store/categories", (ctx) => ({
  body: categoryTree(ctx.locale),
}));

function slugParam(ctx: Context): string {
  const slug = ctx.params.slug;
  if (!SLUG.test(slug) || slug.length > 120) {
    throw new HttpError(404, "NOT_FOUND", "Not found.");
  }
  return slug;
}

route("GET", "/v1/store/categories/:slug", (ctx) => {
  const record = categoryBySlug(slugParam(ctx));
  if (!record) {
    throw new HttpError(
      404,
      "CATEGORY_NOT_FOUND",
      "This category does not exist.",
    );
  }
  return { body: { category: categoryDetail(record, ctx.locale) } };
});

const PRODUCT_QUERY_KEYS = [
  "locale",
  "category",
  "q",
  "tag",
  "brand",
  "onSale",
  "available",
  "orderable",
  "featured",
  "minPrice",
  "maxPrice",
  "sort",
  "groupPackSizes",
  "page",
  "limit",
];
const SORTS = [
  "recommended",
  "newest",
  "price_asc",
  "price_desc",
  "discount",
  "name",
];

route("GET", "/v1/store/products", (ctx) => {
  const { url } = ctx;
  for (const key of url.searchParams.keys()) {
    if (!PRODUCT_QUERY_KEYS.includes(key)) {
      throw validationFailed(key, `property ${key} should not exist`);
    }
  }
  const q = url.searchParams.get("q") ?? undefined;
  if (q !== undefined && (q.trim().length < 2 || q.length > 80)) {
    throw validationFailed(
      "q",
      "q must be longer than or equal to 2 characters",
    );
  }
  const sort = url.searchParams.get("sort") ?? undefined;
  if (sort !== undefined && !SORTS.includes(sort)) {
    throw validationFailed("sort", `sort must be one of: ${SORTS.join(", ")}`);
  }
  const query: ProductQuery = {
    category: url.searchParams.get("category") ?? undefined,
    q: q?.trim(),
    tag: url.searchParams.get("tag") ?? undefined,
    brand: url.searchParams.get("brand") ?? undefined,
    onSale: booleanParam(url, "onSale"),
    available: booleanParam(url, "available"),
    orderable: booleanParam(url, "orderable"),
    featured: booleanParam(url, "featured"),
    minPrice: intParam(url, "minPrice", 0, 1_000_000_000),
    maxPrice: intParam(url, "maxPrice", 0, 1_000_000_000),
    sort: sort as ProductQuery["sort"],
    groupPackSizes: booleanParam(url, "groupPackSizes"),
    page: intParam(url, "page", 1, 500),
    limit: intParam(url, "limit", 1, 100),
  };
  const result = listProducts(query, ctx.locale);
  if ("error" in result) {
    throw new HttpError(
      404,
      "CATEGORY_NOT_FOUND",
      "This category does not exist.",
    );
  }
  return { body: result };
});

route("GET", "/v1/store/products/:slug", (ctx) => {
  const record = productBySlug(slugParam(ctx));
  if (!record) {
    throw new HttpError(
      404,
      "PRODUCT_NOT_FOUND",
      "This product does not exist.",
    );
  }
  return { body: { product: productDetail(record, ctx.locale) } };
});

// --- 8 Cart -----------------------------------------------------------------

route("POST", "/v1/store/cart/preview", (ctx) => {
  const body = objectBody(ctx.body, ["items"]);
  return { body: billOf(cartItems(body.items, 1), ctx.locale) };
});

route("GET", "/v1/store/cart", (ctx) => ({
  body: billOf(requireCustomer(ctx).cart, ctx.locale),
}));

route("POST", "/v1/store/cart/merge", (ctx) => {
  const customer = requireCustomer(ctx);
  const body = objectBody(ctx.body, ["items"]);
  for (const item of cartItems(body.items, 1)) {
    // Unknown products are dropped silently; the larger quantity wins.
    if (!findProduct(item.productId)) continue;
    const existing = customer.cart.find((i) => i.productId === item.productId);
    if (existing)
      existing.quantity = Math.max(existing.quantity, item.quantity);
    else if (customer.cart.length < CART_MAX_LINES)
      customer.cart.push({ ...item });
  }
  return { body: billOf(customer.cart, ctx.locale) };
});

function productIdParam(ctx: Context): string {
  if (!OBJECT_ID.test(ctx.params.productId)) {
    throw validationFailed("productId", "The id in the URL is not valid.");
  }
  return ctx.params.productId;
}

route("PUT", "/v1/store/cart/items/:productId", (ctx) => {
  const customer = requireCustomer(ctx);
  const productId = productIdParam(ctx);
  const body = objectBody(ctx.body, ["quantity"]);
  const quantity = body.quantity;
  if (
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    quantity < 0 ||
    quantity > 10_000
  ) {
    throw validationFailed(
      "quantity",
      "quantity must be an integer from 0 to 10000",
    );
  }
  const existing = customer.cart.find((i) => i.productId === productId);
  if (quantity === 0) {
    customer.cart = customer.cart.filter((i) => i.productId !== productId);
  } else if (!findProduct(productId)) {
    throw new HttpError(
      404,
      "CART_PRODUCT_NOT_FOUND",
      "This product does not exist or is not active.",
    );
  } else if (existing) {
    existing.quantity = quantity;
  } else if (customer.cart.length >= CART_MAX_LINES) {
    throw new HttpError(400, "CART_FULL", "The cart is full.", {
      maximum: CART_MAX_LINES,
    });
  } else {
    customer.cart.push({ productId, quantity });
  }
  return { body: billOf(customer.cart, ctx.locale) };
});

route("DELETE", "/v1/store/cart/items/:productId", (ctx) => {
  const customer = requireCustomer(ctx);
  const productId = productIdParam(ctx);
  customer.cart = customer.cart.filter((i) => i.productId !== productId);
  return { body: billOf(customer.cart, ctx.locale) };
});

route("DELETE", "/v1/store/cart", (ctx) => {
  const customer = requireCustomer(ctx);
  customer.cart = [];
  return { body: billOf(customer.cart, ctx.locale) };
});

// --- 3 Addresses ------------------------------------------------------------

route("GET", "/v1/store/me/addresses", (ctx) => ({
  body: addresses.list(requireCustomer(ctx)),
}));

route("POST", "/v1/store/me/addresses", (ctx) => ({
  status: 201,
  body: addresses.create(requireCustomer(ctx), ctx.body),
}));

route("PATCH", "/v1/store/me/addresses/:id", (ctx) => ({
  body: addresses.update(requireCustomer(ctx), ctx.params.id, ctx.body),
}));

route("POST", "/v1/store/me/addresses/:id/default", (ctx) => ({
  body: addresses.setDefault(requireCustomer(ctx), ctx.params.id),
}));

route("DELETE", "/v1/store/me/addresses/:id", (ctx) => ({
  body: addresses.remove(requireCustomer(ctx), ctx.params.id),
}));

// --- 9 Orders ---------------------------------------------------------------

route("GET", "/v1/store/me/ordering", (ctx) => ({
  body: orderingPermission(requireCustomer(ctx)),
}));

route("POST", "/v1/store/orders", (ctx) => {
  const key = ctx.headers["idempotency-key"];
  return placeOrder(
    requireCustomer(ctx),
    typeof key === "string" ? key : undefined,
    ctx.body,
    ctx.locale,
    SHOP_URL,
  );
});

route("GET", "/v1/store/orders", (ctx) => ({
  body: listOrders(
    requireCustomer(ctx),
    ctx.locale,
    intParam(ctx.url, "limit", 1, 100) ?? 25,
    ctx.url.searchParams.get("cursor") ?? undefined,
  ),
}));

route("GET", "/v1/store/orders/:orderNumber", (ctx) => ({
  body: getOrder(requireCustomer(ctx), ctx.params.orderNumber, ctx.locale),
}));

route("POST", "/v1/store/orders/:orderNumber/cancel", (ctx) => ({
  body: cancelOrder(
    requireCustomer(ctx),
    ctx.params.orderNumber,
    ctx.body,
    ctx.locale,
  ),
}));

// --- 10 Payments ------------------------------------------------------------

route("GET", "/v1/store/orders/:orderNumber/payment", (ctx) => {
  const customer = requireCustomer(ctx);
  return {
    body: orderPayment(customer, findOrder(customer, ctx.params.orderNumber)),
  };
});

route("POST", "/v1/store/orders/:orderNumber/checkout", (ctx) => ({
  body: createCheckout(
    findOrder(requireCustomer(ctx), ctx.params.orderNumber),
    // The payment page is played by the mock itself, at its own address.
    `http://${ctx.headers.host}`,
  ),
}));

// The payment page of the mock: stands in for Stripe Checkout.
route("GET", "/__mock/stripe/:orderNumber", (ctx) => {
  const order = db.orders.get(ctx.params.orderNumber.toUpperCase());
  if (!order) throw new HttpError(404, "NOT_FOUND", "Not found.");
  const base = `/__mock/stripe/${order.orderNumber}`;
  return {
    raw: {
      contentType: "text/html; charset=utf-8",
      content: `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mock payment page</title><body style="font-family:system-ui;max-width:28rem;margin:3rem auto;padding:0 1rem"><h1>Mock payment page</h1><p>This page stands in for Stripe Checkout. Nothing is charged.</p><p>Order ${order.orderNumber}</p><p><a href="${base}/pay?type=card">Pay by card</a></p><p><a href="${base}/pay?type=paypal">Pay with PayPal</a></p><p><a href="${base}/cancel">Cancel</a></p></body></html>`,
    },
  };
});

route("GET", "/__mock/stripe/:orderNumber/pay", (ctx) => {
  const order = db.orders.get(ctx.params.orderNumber.toUpperCase());
  if (!order) throw new HttpError(404, "NOT_FOUND", "Not found.");
  markPaid(
    order,
    "stripe",
    ctx.url.searchParams.get("type") === "paypal" ? "paypal" : "card",
  );
  return {
    status: 302,
    headers: {
      Location: `${SHOP_URL}/account/orders/${order.orderNumber}?payment=success`,
    },
  };
});

route("GET", "/__mock/stripe/:orderNumber/cancel", (ctx) => ({
  status: 302,
  headers: {
    Location: `${SHOP_URL}/account/orders/${ctx.params.orderNumber.toUpperCase()}?payment=cancelled`,
  },
}));

// --- Links in emails: no sign-in, the token is the key (doc 4, 10.4) ----------

/** The token of the unsubscribe link: the customer id and a signature. */
function unsubscribeTokenOf(customer: CustomerRecord): string {
  return `${customer.id}.mock-signature-${customer.id.slice(-6)}`;
}

function orderOfPayLink(token: string) {
  for (const order of db.orders.values()) {
    if (order.payment && order.payment.payLinkToken === token) return order;
  }
  throw new HttpError(
    404,
    "PAY_LINK_INVALID",
    "This payment link is not valid.",
  );
}

route("GET", "/v1/pay/:token", (ctx) => {
  const order = orderOfPayLink(ctx.params.token);
  return {
    body: {
      orderNumber: order.orderNumber,
      firstName: db.customers.get(order.customerId)?.firstName ?? null,
      language: order.language,
      payment: paymentBlockOf(order),
    },
  };
});

route("POST", "/v1/pay/:token/checkout", (ctx) => ({
  body: createCheckout(
    orderOfPayLink(ctx.params.token),
    `http://${ctx.headers.host}`,
  ),
}));

route("POST", "/v1/unsubscribe/:token", (ctx) => {
  const customer = [...db.customers.values()].find(
    (candidate) => unsubscribeTokenOf(candidate) === ctx.params.token,
  );
  if (!customer) {
    throw new HttpError(404, "CUSTOMER_NOT_FOUND", "This link is not valid.");
  }
  // News is switched off; emails about the customer's own orders keep coming.
  if (customer.communication.marketingOptIn) {
    customer.communication.marketingOptIn = false;
    customer.communication.marketingOptOutAt = new Date().toISOString();
  }
  return { body: { email: customer.email, marketingOptIn: false } };
});

// Not part of the real API: the tokens the emails would carry, for tests.
route("GET", "/__mock/tokens", (ctx) => {
  const customer = customerByEmail(ctx.url.searchParams.get("email") ?? "");
  if (!customer) throw validationFailed("email", "unknown customer");
  const pay: Record<string, string> = {};
  for (const order of db.orders.values()) {
    if (order.customerId === customer.id && order.payment) {
      pay[order.orderNumber] = order.payment.payLinkToken;
    }
  }
  return { body: { unsubscribe: unsubscribeTokenOf(customer), pay } };
});

// --- 11 Invoices and credit notes -------------------------------------------

route("GET", "/v1/store/invoices", (ctx) => ({
  body: listInvoices(
    requireCustomer(ctx),
    ctx.url.searchParams.get("orderNumber") ?? undefined,
    intParam(ctx.url, "limit", 1, 100) ?? 25,
    ctx.url.searchParams.get("cursor") ?? undefined,
  ),
}));

route("GET", "/v1/store/invoices/:number", (ctx) => ({
  body: { invoice: findInvoice(requireCustomer(ctx), ctx.params.number) },
}));

route("GET", "/v1/store/invoices/:number/pdf", (ctx) => {
  const document = findInvoice(requireCustomer(ctx), ctx.params.number);
  return {
    raw: {
      contentType: "application/pdf",
      content: invoicePdf(document),
      cacheControl: "private, no-store",
    },
    headers: {
      "Content-Disposition": `inline; filename="${document.number}.pdf"`,
    },
  };
});

// --- 12 Returns -------------------------------------------------------------

route("GET", "/v1/store/orders/:orderNumber/returns", (ctx) => ({
  body: orderReturns(findOrder(requireCustomer(ctx), ctx.params.orderNumber)),
}));

route("POST", "/v1/store/orders/:orderNumber/returns", (ctx) => {
  const body = ctx.body as { locale?: unknown } | undefined;
  const locale =
    body?.locale === "en" || body?.locale === "de" ? body.locale : ctx.locale;
  return {
    status: 201,
    body: createReturn(
      findOrder(requireCustomer(ctx), ctx.params.orderNumber),
      ctx.body,
      locale,
    ),
  };
});

route("GET", "/v1/store/returns/:returnNumber", (ctx) => ({
  body: { return: findReturn(requireCustomer(ctx), ctx.params.returnNumber) },
}));

route("POST", "/v1/store/returns/:returnNumber/cancel", (ctx) => ({
  body: cancelReturn(findReturn(requireCustomer(ctx), ctx.params.returnNumber)),
}));

// --- Placeholder pictures and test controls ---------------------------------

route("GET", "/media/products/:productId/:file", (ctx) => {
  const sizes: Record<string, number> = {
    "small.svg": 320,
    "medium.svg": 800,
    "large.svg": 1600,
  };
  const size = sizes[ctx.params.file];
  const svg = size ? placeholderSvg(ctx.params.productId, size) : null;
  if (!svg) throw new HttpError(404, "NOT_FOUND", "Not found.");
  return {
    raw: {
      contentType: "image/svg+xml",
      content: svg,
      cacheControl: "public, max-age=31536000, immutable",
    },
  };
});

// Not part of the real API: lets tests choose the state of the shop.
route("POST", "/__mock/cargo", (ctx) => {
  const body = objectBody(ctx.body, ["mode"]);
  if (body.mode !== "open" && body.mode !== "closed" && body.mode !== "none") {
    throw validationFailed("mode", "mode must be one of: open, closed, none");
  }
  cargoState.mode = body.mode;
  return { body: { mode: cargoState.mode } };
});

// Not part of the real API: a new version of a legal text is published.
route("POST", "/__mock/legal/republish", (ctx) => {
  const body = objectBody(ctx.body, ["type"]);
  const document = legalDocuments.find((d) => d.type === body.type);
  if (!document) throw validationFailed("type", "unknown legal type");
  document.version += 1;
  return { body: { type: document.type, version: document.version } };
});

// Not part of the real API: the admin changes the price of a product.
route("POST", "/__mock/price", (ctx) => {
  const body = objectBody(ctx.body, ["productId", "price"]);
  const product = findProduct(String(body.productId));
  if (!product || typeof body.price !== "number") {
    throw validationFailed("productId", "unknown product or price");
  }
  product.regularPrice = body.price;
  product.salePrice = null;
  return { body: { productId: product.id, price: product.regularPrice } };
});

// Not part of the real API: what Radhe Foods decided about a customer.
route("POST", "/__mock/customer", (ctx) => {
  const body = objectBody(ctx.body, ["email", "overdue", "orderingBlocked"]);
  const customer = customerByEmail(String(body.email));
  if (!customer) throw validationFailed("email", "unknown customer");
  if (typeof body.orderingBlocked === "boolean") {
    customer.orderingBlocked = body.orderingBlocked;
  }
  if (typeof body.overdue === "boolean") {
    customer.overdue = body.overdue
      ? [
          {
            orderNumber: "RF-1001",
            invoiceNumber: "INV-2026-000012",
            amountDue: 3193,
            deadlineAt: "2026-09-20T21:59:59.000Z",
          },
        ]
      : [];
  }
  return { status: 204 };
});

// Not part of the real API: the admin moves an order along.
const ORDER_ACTIONS: OrderAction[] = [
  "prepare",
  "dispatch",
  "deliver",
  "fail",
  "activate",
  "pay_cash",
  "overdue",
];
route("POST", "/__mock/order", (ctx) => {
  const body = objectBody(ctx.body, ["orderNumber", "actions", "method"]);
  const order = db.orders.get(String(body.orderNumber).toUpperCase());
  if (!order) throw validationFailed("orderNumber", "unknown order");
  if (body.method === "dhl" || body.method === "hermes") {
    order.delivery.method = body.method;
  }
  const actions = Array.isArray(body.actions) ? body.actions : [];
  for (const action of actions) {
    if (!ORDER_ACTIONS.includes(action)) {
      throw validationFailed("actions", `unknown action ${String(action)}`);
    }
    advanceOrder(order, action);
  }
  return { status: 204 };
});

// Not part of the real API: the admin decides about a return.
route("POST", "/__mock/return", (ctx) => {
  const body = objectBody(ctx.body, ["returnNumber", "action"]);
  const request = db.returns.get(String(body.returnNumber).toUpperCase());
  if (!request) throw validationFailed("returnNumber", "unknown return");
  if (
    body.action !== "approve" &&
    body.action !== "reject" &&
    body.action !== "complete"
  ) {
    throw validationFailed("action", "unknown action");
  }
  decideReturn(request, body.action);
  return { status: 204 };
});

// Not part of the real API: online payment configured or not.
route("POST", "/__mock/stripe", (ctx) => {
  const body = objectBody(ctx.body, ["enabled"]);
  stripe.enabled = body.enabled === true;
  return { status: 204 };
});

route("POST", "/__mock/reset", () => {
  resetState();
  resetFixtures();
  stripe.enabled = process.env.MOCK_STRIPE !== "off";
  return { status: 204 };
});

// --- The server -------------------------------------------------------------

export interface MockServerOptions {
  /** Origins that may call with cookies. Default: http://localhost:3001 */
  allowedOrigins?: string[];
  /** Wait this long before every answer, to see loading states. */
  latencyMs?: number;
  /** Print one line per request. */
  log?: boolean;
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "BAD_REQUEST", "The body is not valid JSON.");
  }
}

export function createMockServer(options: MockServerOptions = {}): Server {
  const allowedOrigins = options.allowedOrigins ?? ["http://localhost:3001"];
  const latencyMs = options.latencyMs ?? 0;

  return createServer(
    async (request: IncomingMessage, response: ServerResponse) => {
      const requestId = String(request.headers["x-request-id"] ?? randomUUID());
      const origin = request.headers.origin;
      const method = request.method ?? "GET";
      const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

      response.setHeader("x-request-id", requestId);
      response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      if (origin && allowedOrigins.includes(origin)) {
        response.setHeader("Access-Control-Allow-Origin", origin);
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
        response.setHeader("Vary", "Origin");
      }

      const send = (status: number, result: Result = {}) => {
        for (const [name, value] of Object.entries(result.headers ?? {})) {
          response.setHeader(name, value);
        }
        if (result.setCookies?.length) {
          response.setHeader("Set-Cookie", result.setCookies);
        }
        if (result.raw) {
          response.writeHead(status, {
            "Content-Type": result.raw.contentType,
            "Cache-Control": result.raw.cacheControl ?? "no-store",
          });
          response.end(result.raw.content);
        } else if (result.body === undefined) {
          response.writeHead(status).end();
        } else {
          response.writeHead(status, {
            "Content-Type": "application/json; charset=utf-8",
          });
          response.end(JSON.stringify(result.body));
        }
        if (options.log)
          console.log(`[mock] ${method} ${url.pathname} ${status}`);
      };

      try {
        if (method === "OPTIONS") {
          // `Idempotency-Key` must be allowed, or browsers cannot place orders.
          response.setHeader(
            "Access-Control-Allow-Methods",
            "GET, POST, PATCH, PUT, DELETE, OPTIONS",
          );
          response.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, X-Request-Id, Idempotency-Key",
          );
          response.setHeader("Access-Control-Max-Age", "600");
          return send(204);
        }
        if (latencyMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, latencyMs));
        }
        // CSRF protection of the API: a browser request that changes something
        // must come from an allowed origin. Server-side calls carry no Origin.
        if (method !== "GET" && origin && !allowedOrigins.includes(origin)) {
          throw new HttpError(
            403,
            "ORIGIN_NOT_ALLOWED",
            "This origin is not allowed.",
          );
        }

        for (const candidate of routes) {
          if (candidate.method !== method) continue;
          const match = candidate.pattern.exec(url.pathname);
          if (!match) continue;
          const params: Record<string, string> = {};
          candidate.keys.forEach((key, index) => {
            params[key] = decodeURIComponent(match[index + 1]);
          });
          const result = await candidate.handler({
            method,
            url,
            params,
            locale: localeOf(url, request.headers),
            body: method === "GET" ? undefined : await readBody(request),
            cookies: parseCookies(request.headers.cookie),
            headers: request.headers,
          });
          return send(result.status ?? 200, result);
        }
        throw new HttpError(
          404,
          "NOT_FOUND",
          `Cannot ${method} ${url.pathname}`,
        );
      } catch (error) {
        const known = error instanceof HttpError ? error : null;
        if (!known) console.error("[mock] unexpected error", error);
        send(known?.status ?? 500, {
          setCookies: known?.setCookies,
          body: {
            error: {
              code: known?.code ?? "INTERNAL_ERROR",
              message: known?.message ?? "Something went wrong.",
              ...(known?.details !== undefined && { details: known.details }),
            },
            requestId,
          },
        });
      }
    },
  );
}

// Started directly (`node mocks/server.ts`), not imported by a test.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const port = Number(process.env.MOCK_PORT || process.env.PORT || 3000);
  const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3001")
    .split(",")
    .map((origin) => origin.trim());
  setMediaBase(`http://localhost:${port}`);
  createMockServer({
    allowedOrigins,
    latencyMs: Number(process.env.MOCK_LATENCY_MS || 0),
    log: true,
  }).listen(port, () => {
    console.log(`[mock] Radhe Foods mock API on http://localhost:${port}`);
    console.log(`[mock] allowed origins: ${allowedOrigins.join(", ")}`);
    console.log(`[mock] login code for every email: ${MOCK_OTP_CODE}`);
  });
}
