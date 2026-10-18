// A stand-in for the Radhe Foods API (radhe-api), for development and tests.
// It answers the store endpoints in the shapes and with the error codes of
// doc/CUSTOMER_WEB_API_DOCUMENTATION.md, from fixtures kept in memory.
//
//   npm run dev:mock        starts it on http://localhost:3000
//
// Built so far: settings, legal texts, categories, products with their
// stock, cart (preview, stored cart, merge), sign-up and sign-in with email
// and password, the password reset by link, addresses, checkout with a
// stand-in payment page, orders and payments, invoices and credit notes
// with PDF, returns, the wishlist (preview, stored list, merge) and the
// banners of the home page. `demo@radhefoods.de` gets a filled demo
// account.
//
// Runs on the project's Node (24, see .nvmrc) and needs at least 22.18, which
// reads TypeScript directly; no build step.

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
  checkout,
  findOrder,
  getOrder,
  listOrders,
  resetFixtures,
} from "./orders.ts";
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoAccount } from "./demo.ts";
import {
  advanceOrder,
  cancelReturn,
  createReturn,
  decideReturn,
  expirePaymentPage,
  failPayment,
  findInvoice,
  findReturn,
  invoicePdf,
  listInvoices,
  orderPayment,
  orderReturns,
  paymentPage,
  settleLater,
  settlePayment,
  stripe,
  type OrderAction,
} from "./payments.ts";
import {
  ACCESS_TTL_SECONDS,
  BLOCKED_EMAIL,
  REFRESH_TTL_SECONDS,
  RESET_MAX_PER_HOUR,
  RESET_TTL_SECONDS,
  customerByEmail,
  db,
  hashPassword,
  isWeakPassword,
  legalDocuments,
  newCustomer,
  resetState,
  type CustomerRecord,
  type Locale,
  type SessionRecord,
} from "./state.ts";
import {
  bannerSvg,
  bannerView,
  billOf,
  categoryBySlug,
  categoryDetail,
  categoryTree,
  customerView,
  enabledVariants,
  findVariant,
  legalDocument,
  legalList,
  listProducts,
  liveBanners,
  productFacets,
  placeholderSvg,
  productBySlug,
  productDetail,
  setMediaBase,
  settingsView,
  soldProduct,
  wishlistView,
} from "./views.ts";

const ACCESS_COOKIE = "rf_customer_access";
const REFRESH_COOKIE = "rf_customer_refresh";
const REFRESH_PATH = "/v1/store/auth";
const CART_MAX_LINES = 100;
/** The shop, for the links the API builds (`SHOP_URL` of the real API). */
const SHOP_URL = process.env.SHOP_URL || "http://localhost:3001";

/** The address of the mock itself, where its payment page lives. */
function mockBaseOf(ctx: Context): string {
  return `http://${ctx.headers.host}`;
}

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
    const item = objectBody(entry, ["variantId", "quantity"]);
    if (typeof item.variantId !== "string" || !OBJECT_ID.test(item.variantId)) {
      throw validationFailed(
        `items.${index}.variantId`,
        "variantId must be an id",
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
    if (seen.has(item.variantId)) {
      throw validationFailed(
        "items",
        "items must not contain a pack size twice",
      );
    }
    seen.add(item.variantId);
    return { variantId: item.variantId, quantity: item.quantity };
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

/** First or last name: 1 to 80 characters after trimming (doc 1). */
function nameOf(
  body: Record<string, unknown>,
  field: "firstName" | "lastName",
): string {
  const value = body[field];
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length < 1 || trimmed.length > 80) {
    throw validationFailed(field, `${field} must be 1 to 80 characters`);
  }
  return trimmed;
}

/** A password of 8 to 128 characters, else `VALIDATION_FAILED` (doc 4). */
function passwordOf(value: unknown): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 128) {
    throw validationFailed("password", "password must be 8 to 128 characters");
  }
  return value;
}

function assertNotWeak(password: string, email: string): void {
  if (isWeakPassword(password, email)) {
    throw new HttpError(
      400,
      "PASSWORD_TOO_WEAK",
      "This password is too easy to guess. Choose another one.",
    );
  }
}

function createAccount(
  input: Parameters<typeof newCustomer>[0],
  mockBase: string,
): CustomerRecord {
  const customer = newCustomer(input);
  if (customer.email === DEMO_EMAIL) seedDemoAccount(customer, mockBase);
  if (customer.email === BLOCKED_EMAIL) customer.blocked = true;
  return customer;
}

route("POST", "/v1/store/auth/signup", (ctx) => {
  const body = objectBody(ctx.body, [
    "firstName",
    "lastName",
    "email",
    "password",
    "locale",
  ]);
  const firstName = nameOf(body, "firstName");
  const lastName = nameOf(body, "lastName");
  const email = emailOf(body.email);
  const password = passwordOf(body.password);
  const locale = optionalLocale(body.locale, ctx.locale);
  assertNotWeak(password, email);
  if (customerByEmail(email)) {
    throw new HttpError(
      409,
      "CUSTOMER_EMAIL_TAKEN",
      "An account with this email already exists.",
    );
  }
  const customer = createAccount(
    {
      email,
      locale,
      firstName,
      lastName,
      passwordHash: hashPassword(password),
    },
    mockBaseOf(ctx),
  );
  console.log(`[mock] welcome email (${locale}) to ${email}`);
  return { ...startSession(customer), status: 201 };
});

route("POST", "/v1/store/auth/login", (ctx) => {
  const body = objectBody(ctx.body, ["email", "password"]);
  const email = emailOf(body.email);
  const password = body.password;
  if (
    typeof password !== "string" ||
    password.length < 1 ||
    password.length > 128
  ) {
    throw validationFailed("password", "password must be 1 to 128 characters");
  }
  let customer = customerByEmail(email);
  // Not in the real API: the two accounts the mock knows by name exist the
  // moment someone signs in as them, so nobody has to sign up for them. The
  // blocked one takes whatever password its first sign-in brings.
  if (
    !customer &&
    (email === BLOCKED_EMAIL ||
      (email === DEMO_EMAIL && password === DEMO_PASSWORD))
  ) {
    customer = createAccount(
      {
        email,
        locale: ctx.locale,
        firstName: "Demo",
        lastName: "Customer",
        passwordHash: hashPassword(password),
      },
      mockBaseOf(ctx),
    );
  }
  if (!customer || customer.passwordHash !== hashPassword(password)) {
    // The same answer for an unknown address and a wrong password (doc 1).
    throw new HttpError(
      401,
      "CUSTOMER_CREDENTIALS_INVALID",
      "The email or password is incorrect.",
    );
  }
  if (customer.blocked) {
    throw new HttpError(403, "CUSTOMER_BLOCKED", "This account is blocked.");
  }
  return startSession(customer);
});

route("POST", "/v1/store/auth/password/forgot", (ctx) => {
  const body = objectBody(ctx.body, ["email", "locale"]);
  const email = emailOf(body.email);
  const locale = optionalLocale(body.locale, ctx.locale);
  const customer = customerByEmail(email);
  // The answer is the same whether or not the address has an account, and
  // whether or not a link went out: at most three per account and hour.
  if (customer) {
    const now = Date.now();
    const sent = (db.passwordResetRequests.get(customer.id) ?? []).filter(
      (at) => now - at < 3_600_000,
    );
    if (sent.length < RESET_MAX_PER_HOUR) {
      // A newer link replaces the older ones.
      for (const [token, reset] of db.passwordResets) {
        if (reset.customerId === customer.id) db.passwordResets.delete(token);
      }
      const resetToken = randomBytes(32).toString("base64url");
      db.passwordResets.set(resetToken, {
        customerId: customer.id,
        createdAt: now,
        expiresAt: now + RESET_TTL_SECONDS * 1000,
      });
      db.passwordResetRequests.set(customer.id, [...sent, now]);
      console.log(
        `[mock] password reset email (${locale}) to ${email}: ${SHOP_URL}/reset-password?token=${resetToken}`,
      );
    }
  }
  return { status: 204 };
});

route("POST", "/v1/store/auth/password/reset", (ctx) => {
  const body = objectBody(ctx.body, ["token", "password"]);
  const resetToken = body.token;
  if (
    typeof resetToken !== "string" ||
    resetToken.length < 20 ||
    resetToken.length > 200
  ) {
    throw validationFailed("token", "token must be 20 to 200 characters");
  }
  const password = passwordOf(body.password);
  const reset = db.passwordResets.get(resetToken);
  const customer = reset && db.customers.get(reset.customerId);
  if (!reset || !customer || reset.expiresAt < Date.now()) {
    throw new HttpError(
      400,
      "PASSWORD_RESET_INVALID",
      "The link is unknown, already used, replaced or expired.",
    );
  }
  // The link stays valid when the password is too easy to guess.
  assertNotWeak(password, customer.email);
  customer.passwordHash = hashPassword(password);
  db.passwordResets.delete(resetToken);
  // Every session of the customer ends. (The real API lets an access token
  // run out by itself, up to 15 minutes; the mock is stricter.)
  for (const session of db.sessions) {
    if (session.customerId === customer.id) db.sessions.delete(session);
  }
  return { status: 204 };
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
  if (!["terms", "privacy"].includes(ctx.params.type)) {
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

// --- 7 Catalogue ------------------------------------------------------------

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
  "storageType",
  "packSize",
  "onSale",
  "available",
  "orderable",
  "featured",
  "minPrice",
  "maxPrice",
  "sort",
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
const STORAGE_TYPES = ["ambient", "chilled", "frozen"];
/** `500g`, `1kg`, `0.5l`, `6pcs`: a size and a unit, no space. */
const PACK_SIZE = /^\d+(?:\.\d+)?(?:g|kg|ml|l|pcs)$/;

/** The repeated values of a parameter (`brand=a&brand=b`), or nothing. */
function listParam(
  url: URL,
  key: string,
  check?: (value: string) => boolean,
  hint?: string,
): string[] | undefined {
  const values = url.searchParams.getAll(key);
  if (values.length === 0) return undefined;
  for (const value of values) {
    if (value === "" || value.length > 80 || (check && !check(value))) {
      throw validationFailed(key, hint ?? `${key} has an invalid value`);
    }
  }
  return values;
}

/** The query of the product list and of its facets, checked like the API does. */
function productQueryOf(url: URL): ProductQuery {
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
  return {
    category: url.searchParams.get("category") ?? undefined,
    q: q?.trim(),
    tag: listParam(url, "tag"),
    brand: listParam(url, "brand"),
    storageType: listParam(
      url,
      "storageType",
      (value) => STORAGE_TYPES.includes(value),
      `storageType must be one of: ${STORAGE_TYPES.join(", ")}`,
    ) as ProductQuery["storageType"],
    packSize: listParam(
      url,
      "packSize",
      (value) => PACK_SIZE.test(value),
      "packSize must be a size and a unit without a space, for example 1kg",
    ),
    onSale: booleanParam(url, "onSale"),
    available: booleanParam(url, "available"),
    orderable: booleanParam(url, "orderable"),
    featured: booleanParam(url, "featured"),
    minPrice: intParam(url, "minPrice", 0, 1_000_000_000),
    maxPrice: intParam(url, "maxPrice", 0, 1_000_000_000),
    sort: sort as ProductQuery["sort"],
    page: intParam(url, "page", 1, 500),
    limit: intParam(url, "limit", 1, 100),
  };
}

route("GET", "/v1/store/products", (ctx) => {
  const result = listProducts(productQueryOf(ctx.url), ctx.locale);
  if ("error" in result) {
    throw new HttpError(
      404,
      "CATEGORY_NOT_FOUND",
      "This category does not exist.",
    );
  }
  return { body: result };
});

// Before the product page: "facets" is not a slug.
route("GET", "/v1/store/products/facets", (ctx) => {
  const result = productFacets(productQueryOf(ctx.url), ctx.locale);
  if ("error" in result) {
    throw new HttpError(
      404,
      "CATEGORY_NOT_FOUND",
      "This category does not exist.",
    );
  }
  return { body: result };
});

// The URL of a pack size, or the base slug of a product (its default size).
route("GET", "/v1/store/products/:slug", (ctx) => {
  const found = productBySlug(slugParam(ctx));
  if (!found) {
    throw new HttpError(
      404,
      "PRODUCT_NOT_FOUND",
      "This product does not exist.",
    );
  }
  return {
    body: { product: productDetail(found.product, found.variant, ctx.locale) },
  };
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
    // Unknown or disabled pack sizes are dropped silently; the larger
    // quantity wins.
    if (!findVariant(item.variantId)?.variant.isEnabled) continue;
    const existing = customer.cart.find((i) => i.variantId === item.variantId);
    if (existing)
      existing.quantity = Math.max(existing.quantity, item.quantity);
    else if (customer.cart.length < CART_MAX_LINES)
      customer.cart.push({ ...item });
  }
  return { body: billOf(customer.cart, ctx.locale) };
});

function variantIdParam(ctx: Context): string {
  if (!OBJECT_ID.test(ctx.params.variantId)) {
    throw validationFailed("variantId", "The id in the URL is not valid.");
  }
  return ctx.params.variantId;
}

route("PUT", "/v1/store/cart/items/:variantId", (ctx) => {
  const customer = requireCustomer(ctx);
  const variantId = variantIdParam(ctx);
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
  const existing = customer.cart.find((i) => i.variantId === variantId);
  if (quantity === 0) {
    customer.cart = customer.cart.filter((i) => i.variantId !== variantId);
  } else if (!findVariant(variantId)?.variant.isEnabled) {
    throw new HttpError(
      404,
      "CART_PRODUCT_NOT_FOUND",
      "No such pack size, or it is switched off.",
    );
  } else if (existing) {
    existing.quantity = quantity;
  } else if (customer.cart.length >= CART_MAX_LINES) {
    throw new HttpError(400, "CART_FULL", "The cart is full.", {
      maximum: CART_MAX_LINES,
    });
  } else {
    customer.cart.push({ variantId, quantity });
  }
  return { body: billOf(customer.cart, ctx.locale) };
});

route("DELETE", "/v1/store/cart/items/:variantId", (ctx) => {
  const customer = requireCustomer(ctx);
  const variantId = variantIdParam(ctx);
  customer.cart = customer.cart.filter((i) => i.variantId !== variantId);
  return { body: billOf(customer.cart, ctx.locale) };
});

route("DELETE", "/v1/store/cart", (ctx) => {
  const customer = requireCustomer(ctx);
  customer.cart = [];
  return { body: billOf(customer.cart, ctx.locale) };
});

// --- 16 Wishlist (doc 16) ---------------------------------------------------

const WISHLIST_MAX = 200;

/** The entries of a preview or a merge: 1 to 200, each product once. */
function wishlistEntries(
  value: unknown,
): { productId: string; variantId: string | null }[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > WISHLIST_MAX
  ) {
    throw validationFailed("items", "items must contain 1 to 200 entries");
  }
  const seen = new Set<string>();
  return value.map((entry, index) => {
    const item = objectBody(entry, ["productId", "variantId"]);
    if (typeof item.productId !== "string" || !OBJECT_ID.test(item.productId)) {
      throw validationFailed(
        `items.${index}.productId`,
        "productId must be an id",
      );
    }
    if (
      item.variantId !== undefined &&
      (typeof item.variantId !== "string" || !OBJECT_ID.test(item.variantId))
    ) {
      throw validationFailed(
        `items.${index}.variantId`,
        "variantId must be an id",
      );
    }
    if (seen.has(item.productId)) {
      throw validationFailed("items", "items must not contain a product twice");
    }
    seen.add(item.productId);
    return {
      productId: item.productId,
      variantId: typeof item.variantId === "string" ? item.variantId : null,
    };
  });
}

/** The stored list, with products that left the shop dropped (doc 16). */
function storedWishlist(customer: CustomerRecord, locale: Locale) {
  customer.wishlist = customer.wishlist.filter((entry) =>
    soldProduct(entry.productId),
  );
  return { body: wishlistView(customer.wishlist, locale) };
}

route("POST", "/v1/store/wishlist/preview", (ctx) => {
  const body = objectBody(ctx.body, ["items"]);
  const entries = wishlistEntries(body.items).map((entry) => ({
    ...entry,
    addedAt: null,
  }));
  return { body: wishlistView(entries, ctx.locale) };
});

route("GET", "/v1/store/wishlist", (ctx) =>
  storedWishlist(requireCustomer(ctx), ctx.locale),
);

function productIdParam(ctx: Context): string {
  if (!OBJECT_ID.test(ctx.params.productId)) {
    throw validationFailed("productId", "The id in the URL is not valid.");
  }
  return ctx.params.productId;
}

route("PUT", "/v1/store/wishlist/items/:productId", (ctx) => {
  const customer = requireCustomer(ctx);
  const productId = productIdParam(ctx);
  const body = objectBody(ctx.body, ["variantId"]);
  const product = soldProduct(productId);
  if (!product) {
    throw new HttpError(
      404,
      "PRODUCT_NOT_FOUND",
      "No such product, or it is not in the shop.",
    );
  }
  let variantId: string | null = null;
  if (body.variantId !== undefined) {
    if (typeof body.variantId !== "string" || !OBJECT_ID.test(body.variantId)) {
      throw validationFailed("variantId", "variantId must be an id");
    }
    if (!enabledVariants(product).some((v) => v.id === body.variantId)) {
      throw new HttpError(
        404,
        "PRODUCT_VARIANT_NOT_FOUND",
        "The pack size is not one of this product's, or is switched off.",
      );
    }
    variantId = body.variantId;
  }
  const existing = customer.wishlist.find((e) => e.productId === productId);
  if (existing) {
    existing.variantId = variantId;
  } else if (customer.wishlist.length >= WISHLIST_MAX) {
    throw new HttpError(400, "WISHLIST_FULL", "The wishlist is full.", {
      maximum: WISHLIST_MAX,
    });
  } else {
    customer.wishlist.unshift({
      productId,
      variantId,
      addedAt: new Date().toISOString(),
    });
  }
  return storedWishlist(customer, ctx.locale);
});

route("DELETE", "/v1/store/wishlist/items/:productId", (ctx) => {
  const customer = requireCustomer(ctx);
  const productId = productIdParam(ctx);
  customer.wishlist = customer.wishlist.filter(
    (e) => e.productId !== productId,
  );
  return storedWishlist(customer, ctx.locale);
});

route("DELETE", "/v1/store/wishlist", (ctx) => {
  const customer = requireCustomer(ctx);
  customer.wishlist = [];
  return { body: wishlistView([], ctx.locale) };
});

route("POST", "/v1/store/wishlist/merge", (ctx) => {
  const customer = requireCustomer(ctx);
  const body = objectBody(ctx.body, ["items"]);
  // The visitor's list is newest first: taken in reverse, each new product
  // lands at the front, so the order stays. Saved products keep their
  // size; a full list drops the rest silently.
  for (const entry of wishlistEntries(body.items).reverse()) {
    const product = soldProduct(entry.productId);
    if (!product) continue;
    if (customer.wishlist.some((e) => e.productId === entry.productId)) {
      continue;
    }
    if (customer.wishlist.length >= WISHLIST_MAX) break;
    const sold = enabledVariants(product).some((v) => v.id === entry.variantId);
    customer.wishlist.unshift({
      productId: entry.productId,
      variantId: sold ? entry.variantId : null,
      addedAt: new Date().toISOString(),
    });
  }
  return storedWishlist(customer, ctx.locale);
});

// --- 17 Homepage banners (doc 17) -------------------------------------------

route("GET", "/v1/store/banners", (ctx) => ({
  body: { banners: liveBanners().map((b) => bannerView(b, ctx.locale)) },
  headers: { "Cache-Control": "public, max-age=60" },
}));

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

// --- 9 Orders and checkout --------------------------------------------------

route("POST", "/v1/store/checkout", (ctx) => {
  const key = ctx.headers["idempotency-key"];
  return checkout(
    requireCustomer(ctx),
    typeof key === "string" ? key : undefined,
    ctx.body,
    ctx.locale,
    mockBaseOf(ctx),
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

route("POST", "/v1/store/orders/:orderNumber/pay", (ctx) => ({
  body: paymentPage(
    findOrder(requireCustomer(ctx), ctx.params.orderNumber),
    mockBaseOf(ctx),
  ),
}));

// The payment page of the mock: stands in for Stripe Checkout. Nothing is
// charged; "pay" settles the order the way Stripe's notification would.
function orderOfPage(orderNumber: string) {
  const order = db.orders.get(orderNumber.toUpperCase());
  if (!order) throw new HttpError(404, "NOT_FOUND", "Not found.");
  return order;
}

/** Whether the page can still be paid: the order waits and the page is not expired. */
function pageIsOpen(order: ReturnType<typeof orderOfPage>): boolean {
  const page = order.payment.checkout;
  return (
    order.status === "pending_payment" &&
    page !== null &&
    Date.parse(page.expiresAt) > Date.now()
  );
}

/** Where Stripe sends the browser afterwards (doc 10.4). */
function backToOrder(
  orderNumber: string,
  result: "success" | "cancelled",
): Result {
  return {
    status: 302,
    headers: {
      Location: `${SHOP_URL}/account/orders/${orderNumber}?payment=${result}`,
    },
  };
}

route("GET", "/__mock/stripe/:orderNumber", (ctx) => {
  const order = orderOfPage(ctx.params.orderNumber);
  const base = `/__mock/stripe/${order.orderNumber}`;
  const amount = `${(order.payment.amount / 100).toFixed(2)} EUR`;
  const content = pageIsOpen(order)
    ? `<p>Order ${order.orderNumber}: ${amount}</p><p><a href="${base}/pay?type=card">Pay by card</a></p><p><a href="${base}/pay?type=paypal">Pay with PayPal</a></p><p><a href="${base}/cancel">Cancel</a></p>`
    : `<p>This payment page is no longer open.</p><p><a href="${base}/cancel">Back to the order</a></p>`;
  return {
    raw: {
      contentType: "text/html; charset=utf-8",
      content: `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mock payment page</title><body style="font-family:system-ui;max-width:28rem;margin:3rem auto;padding:0 1rem"><h1>Mock payment page</h1><p>This page stands in for Stripe Checkout. Nothing is charged.</p>${content}</body></html>`,
    },
  };
});

route("GET", "/__mock/stripe/:orderNumber/pay", (ctx) => {
  const order = orderOfPage(ctx.params.orderNumber);
  // A closed page (the order was given up, or the page expired) pays nothing.
  if (!pageIsOpen(order)) return backToOrder(order.orderNumber, "cancelled");
  if (ctx.url.searchParams.get("type") === "paypal") {
    // The bank approves now; Stripe's notification comes a moment later.
    settleLater(order);
  } else {
    settlePayment(order, "card");
  }
  return backToOrder(order.orderNumber, "success");
});

route("GET", "/__mock/stripe/:orderNumber/cancel", (ctx) =>
  backToOrder(ctx.params.orderNumber.toUpperCase(), "cancelled"),
);

// --- Links in emails: no sign-in, the token is the key (doc 4) ---------------

/** The token of the unsubscribe link: the customer id and a signature. */
function unsubscribeTokenOf(customer: CustomerRecord): string {
  return `${customer.id}.mock-signature-${customer.id.slice(-6)}`;
}

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
// `passwordReset` is the open link of the password reset email, or null.
route("GET", "/__mock/tokens", (ctx) => {
  const customer = customerByEmail(ctx.url.searchParams.get("email") ?? "");
  if (!customer) throw validationFailed("email", "unknown customer");
  const passwordReset =
    [...db.passwordResets].find(
      ([, reset]) => reset.customerId === customer.id,
    )?.[0] ?? null;
  return {
    body: { unsubscribe: unsubscribeTokenOf(customer), passwordReset },
  };
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

route("GET", "/media/banners/:id/:file", (ctx) => {
  const svg = bannerSvg(ctx.params.id, ctx.params.file);
  if (!svg) throw new HttpError(404, "NOT_FOUND", "Not found.");
  return {
    raw: {
      contentType: "image/svg+xml",
      content: svg,
      cacheControl: "public, max-age=31536000, immutable",
    },
  };
});

// Not part of the real API: no banner at all, for the empty home page.
route("POST", "/__mock/banners", (ctx) => {
  const body = objectBody(ctx.body, ["enabled"]);
  db.bannersEnabled = body.enabled !== false;
  return { status: 204 };
});

// Not part of the real API: the admin sets the stock of a pack size.
route("POST", "/__mock/stock", (ctx) => {
  const body = objectBody(ctx.body, ["variantId", "quantity"]);
  const found = findVariant(String(body.variantId));
  const quantity = body.quantity;
  if (
    !found ||
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    quantity < 0
  ) {
    throw validationFailed("variantId", "unknown pack size or quantity");
  }
  found.variant.stock = quantity;
  return { body: { variantId: found.variant.id, stock: found.variant.stock } };
});

// Not part of the real API: a new version of a legal text is published.
route("POST", "/__mock/legal/republish", (ctx) => {
  const body = objectBody(ctx.body, ["type"]);
  const document = legalDocuments.find((d) => d.type === body.type);
  if (!document) throw validationFailed("type", "unknown legal type");
  document.version += 1;
  return { body: { type: document.type, version: document.version } };
});

// Not part of the real API: the admin changes the price of a pack size.
route("POST", "/__mock/price", (ctx) => {
  const body = objectBody(ctx.body, ["variantId", "price"]);
  const found = findVariant(String(body.variantId));
  if (!found || typeof body.price !== "number") {
    throw validationFailed("variantId", "unknown pack size or price");
  }
  found.variant.regularPrice = body.price;
  found.variant.salePrice = null;
  return {
    body: { variantId: found.variant.id, price: found.variant.regularPrice },
  };
});

// Not part of the real API: Radhe Foods blocks or unblocks a customer.
route("POST", "/__mock/customer", (ctx) => {
  const body = objectBody(ctx.body, ["email", "blocked"]);
  const customer = customerByEmail(String(body.email));
  if (!customer) throw validationFailed("email", "unknown customer");
  if (typeof body.blocked === "boolean") customer.blocked = body.blocked;
  return { status: 204 };
});

// Not part of the real API: the admin moves an order along.
const ORDER_ACTIONS: OrderAction[] = [
  "process",
  "dispatch",
  "deliver",
  "refund",
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

// Not part of the real API: what Stripe would report about a payment page.
route("POST", "/__mock/payment", (ctx) => {
  const body = objectBody(ctx.body, ["orderNumber", "action"]);
  const order = db.orders.get(String(body.orderNumber).toUpperCase());
  if (!order) throw validationFailed("orderNumber", "unknown order");
  switch (body.action) {
    case "settle":
      settlePayment(
        order,
        order.payment.checkout?.completesAt ? "paypal" : "card",
      );
      break;
    case "fail":
      failPayment(order);
      break;
    case "expire":
      expirePaymentPage(order);
      break;
    default:
      throw validationFailed(
        "action",
        "action must be one of: settle, fail, expire",
      );
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
    console.log(`[mock] demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  });
}
