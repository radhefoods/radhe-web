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
// with PDF, returns, the wishlist (preview, stored list, merge), the
// banners of the home page, the FAQ and the blog. `demo@radhefoods.de`
// gets a filled demo account.
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
import type { ProductQuery } from "../src/lib/api/types.ts";
import {
  HttpError,
  OBJECT_ID,
  PHONE,
  cartItems,
  emailOf,
  objectBody,
  validationFailed,
} from "./errors.ts";
import {
  addresses,
  applyDiscount,
  cancelOrder,
  cancelOrderRecord,
  checkout,
  findGuestOrder,
  findOrder,
  getOrder,
  guestCheckout,
  listOrders,
  orderDetail,
  ordersOf,
  removeDiscount,
  resetFixtures,
} from "./orders.ts";
import {
  blogCategoriesView,
  blogImageSvg,
  blogPostView,
  blogTagsView,
  faqsView,
  listBlogPosts,
} from "./content.ts";
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoAccount } from "./demo.ts";
import {
  addIssueImages,
  cancelIssue,
  createIssue,
  decideIssue,
  findIssue,
  issueView,
  listIssues,
  openIssuesOf,
  orderIssues,
  removeIssueImage,
} from "./issues.ts";
import { boundaryOf, parseMultipart, type MultipartBody } from "./multipart.ts";
import {
  advanceOrder,
  cancelReturn,
  createReturn,
  decideReturn,
  documentsOf,
  expirePaymentPage,
  failPayment,
  findInvoice,
  findReturn,
  invoicePdf,
  listInvoices,
  openReturnsOf,
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
  makeReferralCode,
  newCustomer,
  resetState,
  type CustomerRecord,
  type Locale,
  type PendingSignupRecord,
  type ReviewRecord,
  type SessionRecord,
  type WishlistListRecord,
} from "./state.ts";
import {
  bannerSvg,
  bannerView,
  billOf,
  categoryBySlug,
  categoryDetail,
  categorySvg,
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
  defaultVariant,
  findProduct,
  productImageUrl,
  ratingOf,
  variantSlug,
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

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function optionalLocale(value: unknown, fallback: Locale): Locale {
  if (value === undefined) return fallback;
  if (value !== "en" && value !== "de") {
    throw validationFailed("locale", "locale must be one of: en, de");
  }
  return value;
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
      // A closed account has no session left; its token means nothing.
      if (customer && customer.deletedAt === null) return customer;
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

// --- The sign-up with an emailed code (doc 1, CUSTOMER_ACCOUNTS 1) -----------

const SIGNUP_CODE_TTL_MS = 15 * 60_000;
const SIGNUP_ATTEMPTS = 5;
const SIGNUP_RESEND_AFTER_SECONDS = 60;
const SIGNUP_RESENDS = 3;
const REFERRAL_CODE = /^[A-Za-z0-9]{6,12}$/;

function newSignupCode(): string {
  return String(100_000 + (randomBytes(4).readUInt32BE(0) % 900_000));
}

/** A pending sign-up that still counts: not expired, attempts left. */
function pendingSignupOf(email: string): PendingSignupRecord | undefined {
  const pending = db.pendingSignups.get(email);
  if (!pending) return undefined;
  if (pending.expiresAt < Date.now() || pending.attemptsLeft <= 0) {
    db.pendingSignups.delete(email);
    return undefined;
  }
  return pending;
}

/**
 * Whether the referral code of the sign-up counts (doc 21): the code must
 * belong to another account, and the person must be new to the shop.
 */
function applyReferral(
  customer: CustomerRecord,
  code: string | null,
): { applied: boolean; reason: string | null } {
  if (!code) return { applied: false, reason: null };
  const referrer = [...db.customers.values()].find(
    (candidate) =>
      candidate.referralCode !== null &&
      candidate.referralCode.toUpperCase() === code.toUpperCase(),
  );
  if (!referrer) return { applied: false, reason: "unknown_code" };
  if (referrer.id === customer.id)
    return { applied: false, reason: "own_code" };
  const paidAsGuest = [...db.orders.values()].some(
    (order) => order.customerId === customer.id && order.payment.paidAmount > 0,
  );
  if (paidAsGuest) return { applied: false, reason: "already_customer" };
  if (db.referrals.some((record) => record.referredId === customer.id)) {
    return { applied: false, reason: "already_referred" };
  }
  db.referrals.push({
    id: `66f9${randomBytes(10).toString("hex")}`,
    code: referrer.referralCode!,
    referrerId: referrer.id,
    referredId: customer.id,
    status: "registered",
    registeredAt: new Date().toISOString(),
    orderNumber: null,
    qualifiedAt: null,
    voidReason: null,
    voidAt: null,
  });
  return { applied: true, reason: null };
}

/**
 * The account, once the code was right: a guest record of the address
 * becomes the account in place (doc 20), else the account is new.
 */
function completeSignUp(
  pending: PendingSignupRecord,
  mockBase: string,
): CustomerRecord {
  const guest = customerByEmail(pending.email);
  if (guest && guest.kind === "guest") {
    guest.firstName = pending.firstName;
    guest.lastName = pending.lastName;
    guest.locale = pending.locale;
    guest.passwordHash = pending.passwordHash;
    guest.kind = "registered";
    guest.emailVerifiedAt = new Date().toISOString();
    guest.referralCode = makeReferralCode();
    return guest;
  }
  return createAccount(
    {
      email: pending.email,
      locale: pending.locale,
      firstName: pending.firstName,
      lastName: pending.lastName,
      passwordHash: pending.passwordHash,
    },
    mockBase,
  );
}

route("POST", "/v1/store/auth/signup", (ctx) => {
  const body = objectBody(ctx.body, [
    "firstName",
    "lastName",
    "email",
    "password",
    "locale",
    "referralCode",
  ]);
  const firstName = nameOf(body, "firstName");
  const lastName = nameOf(body, "lastName");
  const email = emailOf(body.email);
  const password = passwordOf(body.password);
  const locale = optionalLocale(body.locale, ctx.locale);
  if (
    body.referralCode !== undefined &&
    (typeof body.referralCode !== "string" ||
      !REFERRAL_CODE.test(body.referralCode))
  ) {
    throw validationFailed(
      "referralCode",
      "referralCode must be 6 to 12 letters or digits",
    );
  }
  assertNotWeak(password, email);
  // An address with guest orders only is not refused (doc 20).
  if (customerByEmail(email)?.kind === "registered") {
    throw new HttpError(
      409,
      "CUSTOMER_EMAIL_TAKEN",
      "An account with this email already exists.",
    );
  }
  const now = Date.now();
  const code = newSignupCode();
  // A sign-up started again for the same address replaces the one before.
  db.pendingSignups.set(email, {
    email,
    firstName,
    lastName,
    locale,
    passwordHash: hashPassword(password),
    referralCode: (body.referralCode as string | undefined) ?? null,
    code,
    expiresAt: now + SIGNUP_CODE_TTL_MS,
    attemptsLeft: SIGNUP_ATTEMPTS,
    resends: 0,
    lastSentAt: now,
  });
  console.log(`[mock] sign-up code email (${locale}) to ${email}: ${code}`);
  return {
    status: 202,
    body: {
      email,
      validMinutes: SIGNUP_CODE_TTL_MS / 60_000,
      resendAfterSeconds: SIGNUP_RESEND_AFTER_SECONDS,
    },
  };
});

route("POST", "/v1/store/auth/signup/verify", (ctx) => {
  const body = objectBody(ctx.body, ["email", "code"]);
  const email = emailOf(body.email);
  if (typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) {
    throw validationFailed("code", "code must be six digits");
  }
  const pending = pendingSignupOf(email);
  if (!pending) {
    throw new HttpError(
      400,
      "SIGNUP_NOT_FOUND",
      "No sign-up waits for this address, or the code expired. Start again.",
    );
  }
  if (pending.code !== body.code) {
    pending.attemptsLeft -= 1;
    if (pending.attemptsLeft <= 0) db.pendingSignups.delete(email);
    throw new HttpError(400, "SIGNUP_CODE_INVALID", "The code is wrong.", {
      attemptsLeft: pending.attemptsLeft,
    });
  }
  db.pendingSignups.delete(email);
  const customer = completeSignUp(pending, mockBaseOf(ctx));
  const referral = applyReferral(customer, pending.referralCode);
  console.log(`[mock] welcome email (${customer.locale}) to ${email}`);
  const session = startSession(customer);
  return {
    ...session,
    status: 201,
    body: { ...(session.body as object), referral },
  };
});

route("POST", "/v1/store/auth/signup/resend", (ctx) => {
  const body = objectBody(ctx.body, ["email"]);
  const email = emailOf(body.email);
  const pending = pendingSignupOf(email);
  // The same answer whatever happened: at most once a minute, three times.
  if (
    pending &&
    pending.resends < SIGNUP_RESENDS &&
    Date.now() - pending.lastSentAt >= SIGNUP_RESEND_AFTER_SECONDS * 1000
  ) {
    pending.code = newSignupCode();
    pending.resends += 1;
    pending.lastSentAt = Date.now();
    console.log(
      `[mock] sign-up code email (${pending.locale}) to ${email}: ${pending.code}`,
    );
  }
  return { status: 204 };
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

/** The referral code and link of an account (doc 21). */
function referralOf(customer: CustomerRecord) {
  // Accounts from before the codes get one on first request.
  customer.referralCode ??= makeReferralCode();
  const mine = db.referrals.filter(
    (record) => record.referrerId === customer.id,
  );
  return {
    code: customer.referralCode,
    link: `${SHOP_URL}/?ref=${customer.referralCode}`,
    counts: {
      registered: mine.filter((r) => r.status === "registered").length,
      qualified: mine.filter((r) => r.status === "qualified").length,
    },
    records: mine,
  };
}

/** "ra***@example.com": the invited person's address, masked (doc 21). */
function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

route("GET", "/v1/store/me/overview", (ctx) => {
  const customer = requireCustomer(ctx);
  const orders = ordersOf(customer);
  const referral = referralOf(customer);
  return {
    body: {
      customer: customerView(customer),
      memberSince: customer.createdAt,
      counts: {
        orders: orders.length,
        openOrders: orders.filter((order) =>
          ["confirmed", "processing", "dispatched"].includes(order.status),
        ).length,
        invoices: documentsOf(customer).length,
        wishlists: wishlistsOf(customer).length,
        wishlistItems: customer.wishlists.reduce(
          (sum, list) => sum + list.items.length,
          0,
        ),
        addresses: customer.addresses.length,
        openIssues: openIssuesOf(customer).length,
      },
      defaultAddress:
        customer.addresses.find((address) => address.isDefault) ?? null,
      referral: {
        code: referral.code,
        link: referral.link,
        counts: referral.counts,
      },
      locale: customer.locale,
    },
  };
});

route("POST", "/v1/store/me/delete", (ctx) => {
  const customer = requireCustomer(ctx);
  const body = objectBody(ctx.body, ["password", "confirm"]);
  if (body.confirm !== true) {
    throw validationFailed("confirm", "confirm must be true");
  }
  if (
    typeof body.password !== "string" ||
    customer.passwordHash !== hashPassword(body.password)
  ) {
    throw new HttpError(
      401,
      "CUSTOMER_CREDENTIALS_INVALID",
      "The password is incorrect.",
    );
  }
  const open = ordersOf(customer).filter((order) =>
    ["pending_payment", "confirmed", "processing", "dispatched"].includes(
      order.status,
    ),
  );
  const openReturns = openReturnsOf(customer).length;
  const openIssues = openIssuesOf(customer).length;
  if (open.length > 0 || openReturns > 0 || openIssues > 0) {
    throw new HttpError(
      409,
      "CUSTOMER_HAS_OPEN_ORDERS",
      "The account cannot be deleted while an order, a return or a report is open.",
      {
        orderNumbers: open.map((order) => order.orderNumber),
        openReturns,
        openIssues,
      },
    );
  }
  // Everything personal goes; the record keeps its id for the books.
  console.log(`[mock] goodbye email (${customer.locale}) to ${customer.email}`);
  customer.email = `deleted:${customer.id}`;
  customer.firstName = null;
  customer.lastName = null;
  customer.phone = null;
  customer.passwordHash = null;
  customer.referralCode = null;
  customer.addresses = [];
  customer.wishlists = [];
  customer.cart = [];
  customer.discountCode = null;
  customer.communication = {
    whatsappNumber: null,
    whatsappOptIn: false,
    whatsappOptInAt: null,
    marketingOptIn: false,
    marketingOptInAt: null,
    marketingOptOutAt: null,
  };
  customer.deletedAt = new Date().toISOString();
  db.referrals = db.referrals.filter(
    (record) =>
      record.referredId !== customer.id && record.referrerId !== customer.id,
  );
  for (const session of db.sessions) {
    if (session.customerId === customer.id) db.sessions.delete(session);
  }
  return { status: 204, setCookies: clearCookies() };
});

route("GET", "/v1/store/me/referral", (ctx) => {
  const customer = requireCustomer(ctx);
  const referral = referralOf(customer);
  return {
    body: {
      referral: {
        code: referral.code,
        link: referral.link,
        counts: referral.counts,
        invitees: referral.records.map((record) => {
          const invited = db.customers.get(record.referredId);
          const gone = !invited || invited.deletedAt !== null;
          return {
            name: gone
              ? null
              : `${invited.firstName ?? ""} ${invited.lastName ?? ""}`.trim(),
            email: gone ? null : maskEmail(invited.email),
            status: record.status,
            registeredAt: record.registeredAt,
            qualifiedAt: record.qualifiedAt,
          };
        }),
      },
    },
  };
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
  "view",
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
const VIEWS = ["product", "variants_by_product", "variants_by_size"];
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
  const view = url.searchParams.get("view") ?? undefined;
  if (view !== undefined && !VIEWS.includes(view)) {
    throw validationFailed("view", `view must be one of: ${VIEWS.join(", ")}`);
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
    view: view as ProductQuery["view"],
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
  const body = objectBody(ctx.body, ["items", "discountCode"]);
  const items = cartItems(body.items, 1);
  // A visitor prices a code before the guest checkout (doc 20): the bill
  // carries the discount, or the code with the reason it does not apply.
  if (body.discountCode === undefined) {
    return { body: billOf(items, ctx.locale) };
  }
  if (
    typeof body.discountCode !== "string" ||
    body.discountCode.trim() === "" ||
    body.discountCode.length > 40
  ) {
    throw validationFailed(
      "discountCode",
      "discountCode must be 1 to 40 characters",
    );
  }
  return {
    body: billOf(items, ctx.locale, {
      id: "",
      discountCode: body.discountCode.trim().toUpperCase(),
    }),
  };
});

route("GET", "/v1/store/cart", (ctx) => {
  const customer = requireCustomer(ctx);
  return { body: billOf(customer.cart, ctx.locale, customer) };
});

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
  return { body: billOf(customer.cart, ctx.locale, customer) };
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
  return { body: billOf(customer.cart, ctx.locale, customer) };
});

route("DELETE", "/v1/store/cart/items/:variantId", (ctx) => {
  const customer = requireCustomer(ctx);
  const variantId = variantIdParam(ctx);
  customer.cart = customer.cart.filter((i) => i.variantId !== variantId);
  return { body: billOf(customer.cart, ctx.locale, customer) };
});

route("DELETE", "/v1/store/cart", (ctx) => {
  const customer = requireCustomer(ctx);
  customer.cart = [];
  return { body: billOf(customer.cart, ctx.locale, customer) };
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

const WISHLISTS_MAX = 20;
const WISHLIST_NAME_MAX = 40;
const DEFAULT_LIST_NAME = { en: "My Favourites", de: "Meine Favoriten" };

let wishlistSequence = 0;

function newWishlist(
  customer: CustomerRecord,
  name: string,
  isDefault: boolean,
): WishlistListRecord {
  wishlistSequence += 1;
  const now = new Date().toISOString();
  const list: WishlistListRecord = {
    id: `66fa${wishlistSequence.toString(16).padStart(20, "0")}`,
    name,
    isDefault,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
  customer.wishlists.push(list);
  return list;
}

/**
 * The default list (doc 16.2): the one the heart adds to and the old routes
 * address. Without any list, a fresh one appears on the first look.
 */
function defaultWishlist(customer: CustomerRecord): WishlistListRecord {
  const found = customer.wishlists.find((list) => list.isDefault);
  if (found) return found;
  if (customer.wishlists[0]) {
    customer.wishlists[0].isDefault = true;
    return customer.wishlists[0];
  }
  return newWishlist(customer, DEFAULT_LIST_NAME[customer.locale], true);
}

function findWishlist(
  customer: CustomerRecord,
  id: string,
): WishlistListRecord {
  const list = customer.wishlists.find((candidate) => candidate.id === id);
  if (!OBJECT_ID.test(id) || !list) {
    throw new HttpError(404, "WISHLIST_NOT_FOUND", "This list does not exist.");
  }
  return list;
}

/** Products that left the shop are dropped from a stored list (doc 16). */
function tidyWishlist(list: WishlistListRecord): void {
  list.items = list.items.filter((entry) => soldProduct(entry.productId));
}

function wishlistSummaryOf(list: WishlistListRecord) {
  tidyWishlist(list);
  return {
    id: list.id,
    name: list.name,
    isDefault: list.isDefault,
    count: list.items.length,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  };
}

/** The lists, the default first, then by age. */
function wishlistsOf(customer: CustomerRecord) {
  defaultWishlist(customer);
  return [...customer.wishlists].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault),
  );
}

function listView(list: WishlistListRecord, locale: Locale) {
  tidyWishlist(list);
  return { body: wishlistView(list.items, locale, wishlistSummaryOf(list)) };
}

/** A list's name as the customer typed it: 1 to 40 characters, unique whatever the case. */
function wishlistNameOf(
  customer: CustomerRecord,
  value: unknown,
  except?: WishlistListRecord,
): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (name.length < 1 || name.length > WISHLIST_NAME_MAX) {
    throw validationFailed("name", "name must be 1 to 40 characters");
  }
  const taken = customer.wishlists.some(
    (list) => list !== except && list.name.toLowerCase() === name.toLowerCase(),
  );
  if (taken) {
    throw new HttpError(
      409,
      "WISHLIST_NAME_TAKEN",
      "A list with this name exists already.",
    );
  }
  return name;
}

function makeDefaultWishlist(
  customer: CustomerRecord,
  list: WishlistListRecord,
): void {
  for (const candidate of customer.wishlists) {
    candidate.isDefault = candidate === list;
  }
}

/** Saves a product on a list, or changes its remembered size (doc 16). */
function saveOnWishlist(
  list: WishlistListRecord,
  productId: string,
  rawVariantId: unknown,
): void {
  const product = soldProduct(productId);
  if (!product) {
    throw new HttpError(
      404,
      "PRODUCT_NOT_FOUND",
      "No such product, or it is not in the shop.",
    );
  }
  let variantId: string | null = null;
  if (rawVariantId !== undefined) {
    if (typeof rawVariantId !== "string" || !OBJECT_ID.test(rawVariantId)) {
      throw validationFailed("variantId", "variantId must be an id");
    }
    if (!enabledVariants(product).some((v) => v.id === rawVariantId)) {
      throw new HttpError(
        404,
        "PRODUCT_VARIANT_NOT_FOUND",
        "The pack size is not one of this product's, or is switched off.",
      );
    }
    variantId = rawVariantId;
  }
  const existing = list.items.find((e) => e.productId === productId);
  if (existing) {
    existing.variantId = variantId;
  } else if (list.items.length >= WISHLIST_MAX) {
    throw new HttpError(400, "WISHLIST_FULL", "The wishlist is full.", {
      maximum: WISHLIST_MAX,
    });
  } else {
    list.items.unshift({
      productId,
      variantId,
      addedAt: new Date().toISOString(),
    });
  }
  list.updatedAt = new Date().toISOString();
}

route("POST", "/v1/store/wishlist/preview", (ctx) => {
  const body = objectBody(ctx.body, ["items"]);
  const entries = wishlistEntries(body.items).map((entry) => ({
    ...entry,
    addedAt: null,
  }));
  return { body: wishlistView(entries, ctx.locale) };
});

route("GET", "/v1/store/wishlist", (ctx) => {
  const customer = requireCustomer(ctx);
  return listView(defaultWishlist(customer), ctx.locale);
});

function productIdParam(ctx: Context): string {
  if (!OBJECT_ID.test(ctx.params.productId)) {
    throw validationFailed("productId", "The id in the URL is not valid.");
  }
  return ctx.params.productId;
}

route("PUT", "/v1/store/wishlist/items/:productId", (ctx) => {
  const customer = requireCustomer(ctx);
  const body = objectBody(ctx.body, ["variantId"]);
  const list = defaultWishlist(customer);
  saveOnWishlist(list, productIdParam(ctx), body.variantId);
  return listView(list, ctx.locale);
});

route("DELETE", "/v1/store/wishlist/items/:productId", (ctx) => {
  const customer = requireCustomer(ctx);
  const productId = productIdParam(ctx);
  const list = defaultWishlist(customer);
  list.items = list.items.filter((e) => e.productId !== productId);
  return listView(list, ctx.locale);
});

route("DELETE", "/v1/store/wishlist", (ctx) => {
  const customer = requireCustomer(ctx);
  const list = defaultWishlist(customer);
  list.items = [];
  return listView(list, ctx.locale);
});

route("POST", "/v1/store/wishlist/merge", (ctx) => {
  const customer = requireCustomer(ctx);
  const body = objectBody(ctx.body, ["items"]);
  const list = defaultWishlist(customer);
  // The visitor's list is newest first: taken in reverse, each new product
  // lands at the front, so the order stays. Saved products keep their
  // size; a full list drops the rest silently.
  for (const entry of wishlistEntries(body.items).reverse()) {
    const product = soldProduct(entry.productId);
    if (!product) continue;
    if (list.items.some((e) => e.productId === entry.productId)) continue;
    if (list.items.length >= WISHLIST_MAX) break;
    const sold = enabledVariants(product).some((v) => v.id === entry.variantId);
    list.items.unshift({
      productId: entry.productId,
      variantId: sold ? entry.variantId : null,
      addedAt: new Date().toISOString(),
    });
  }
  return listView(list, ctx.locale);
});

// --- 16.2 Several named lists (doc 16.2, CUSTOMER_ACCOUNTS 6) --------------

route("GET", "/v1/store/wishlists", (ctx) => ({
  body: { items: wishlistsOf(requireCustomer(ctx)).map(wishlistSummaryOf) },
}));

route("POST", "/v1/store/wishlists", (ctx) => {
  const customer = requireCustomer(ctx);
  const body = objectBody(ctx.body, ["name", "isDefault"]);
  defaultWishlist(customer);
  if (customer.wishlists.length >= WISHLISTS_MAX) {
    throw new HttpError(
      400,
      "WISHLIST_LIMIT_REACHED",
      "You can have up to 20 lists.",
    );
  }
  const name = wishlistNameOf(customer, body.name);
  if (body.isDefault !== undefined && typeof body.isDefault !== "boolean") {
    throw validationFailed("isDefault", "isDefault must be a boolean value");
  }
  const list = newWishlist(customer, name, false);
  if (body.isDefault === true) makeDefaultWishlist(customer, list);
  return { status: 201, body: { wishlist: wishlistSummaryOf(list) } };
});

route("GET", "/v1/store/wishlists/:id", (ctx) => {
  const customer = requireCustomer(ctx);
  return listView(findWishlist(customer, ctx.params.id), ctx.locale);
});

route("PATCH", "/v1/store/wishlists/:id", (ctx) => {
  const customer = requireCustomer(ctx);
  const list = findWishlist(customer, ctx.params.id);
  const body = objectBody(ctx.body, ["name", "isDefault"]);
  if (body.name !== undefined) {
    list.name = wishlistNameOf(customer, body.name, list);
  }
  if (body.isDefault !== undefined && typeof body.isDefault !== "boolean") {
    throw validationFailed("isDefault", "isDefault must be a boolean value");
  }
  // `false` is ignored: there is always one default.
  if (body.isDefault === true) makeDefaultWishlist(customer, list);
  list.updatedAt = new Date().toISOString();
  return { body: { wishlist: wishlistSummaryOf(list) } };
});

route("DELETE", "/v1/store/wishlists/:id", (ctx) => {
  const customer = requireCustomer(ctx);
  const list = findWishlist(customer, ctx.params.id);
  customer.wishlists = customer.wishlists.filter((c) => c !== list);
  // The oldest remaining list becomes the default; none: a fresh one appears later.
  if (list.isDefault && customer.wishlists[0]) {
    customer.wishlists[0].isDefault = true;
  }
  return { status: 204 };
});

route("PUT", "/v1/store/wishlists/:id/items/:productId", (ctx) => {
  const customer = requireCustomer(ctx);
  const list = findWishlist(customer, ctx.params.id);
  const body = objectBody(ctx.body, ["variantId"]);
  saveOnWishlist(list, productIdParam(ctx), body.variantId);
  return listView(list, ctx.locale);
});

route("DELETE", "/v1/store/wishlists/:id/items/:productId", (ctx) => {
  const customer = requireCustomer(ctx);
  const list = findWishlist(customer, ctx.params.id);
  const productId = productIdParam(ctx);
  list.items = list.items.filter((e) => e.productId !== productId);
  return listView(list, ctx.locale);
});

route("POST", "/v1/store/wishlists/:id/items/:productId/transfer", (ctx) => {
  const customer = requireCustomer(ctx);
  const list = findWishlist(customer, ctx.params.id);
  const productId = productIdParam(ctx);
  const body = objectBody(ctx.body, ["to", "copy"]);
  if (typeof body.to !== "string" || !OBJECT_ID.test(body.to)) {
    throw validationFailed("to", "to must be an id");
  }
  if (body.copy !== undefined && typeof body.copy !== "boolean") {
    throw validationFailed("copy", "copy must be a boolean value");
  }
  const target = findWishlist(customer, body.to);
  const entry = list.items.find((e) => e.productId === productId);
  if (!entry) {
    throw new HttpError(
      404,
      "PRODUCT_NOT_FOUND",
      "The product is not on this list.",
    );
  }
  // A product that is on the other list already stays as it is there.
  if (!target.items.some((e) => e.productId === productId)) {
    if (target.items.length >= WISHLIST_MAX) {
      throw new HttpError(400, "WISHLIST_FULL", "The wishlist is full.", {
        maximum: WISHLIST_MAX,
      });
    }
    target.items.unshift({ ...entry, addedAt: new Date().toISOString() });
    target.updatedAt = new Date().toISOString();
  }
  if (body.copy !== true) {
    list.items = list.items.filter((e) => e !== entry);
    list.updatedAt = new Date().toISOString();
  }
  return listView(list, ctx.locale);
});

route("DELETE", "/v1/store/wishlists/:id/items", (ctx) => {
  const customer = requireCustomer(ctx);
  const list = findWishlist(customer, ctx.params.id);
  list.items = [];
  list.updatedAt = new Date().toISOString();
  return listView(list, ctx.locale);
});

// --- 22 Product reviews and order feedback (doc 22, CUSTOMER_ACCOUNTS 8) ----

const REVIEW_TEXT_MIN = 10;
const REVIEW_TEXT_MAX = 2000;

/** The products of the customer's delivered orders, newest delivery first. */
function deliveredProducts(customer: CustomerRecord) {
  return ordersOf(customer)
    .filter((order) => order.delivery.deliveredAt !== null)
    .sort(
      (a, b) =>
        Date.parse(b.delivery.deliveredAt!) -
        Date.parse(a.delivery.deliveredAt!),
    )
    .flatMap((order) =>
      order.items.map((item) => ({
        productId: item.productId,
        orderNumber: order.orderNumber,
        deliveredAt: order.delivery.deliveredAt!,
      })),
    );
}

function productRefOf(productId: string, locale: Locale) {
  const p = findProduct(productId);
  return {
    id: productId,
    slug: p ? variantSlug(p, defaultVariant(p), locale) : productId,
    name: p ? p.name[locale] || p.name.en : productId,
    imageUrl: productImageUrl(productId, "small"),
  };
}

/** A review as the customer sees it among their own (doc 22). */
function myReviewView(review: ReviewRecord, locale: Locale) {
  return {
    id: review.id,
    productId: review.productId,
    product: productRefOf(review.productId, locale),
    orderNumber: review.orderNumber,
    rating: review.rating,
    title: review.title,
    text: review.text,
    locale: review.locale,
    status: review.status,
    rejectionNote: review.rejectionNote,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    publishedAt: review.publishedAt,
  };
}

/** "Priya S.": the first name and the initial of the last name. */
function authorNameOf(review: ReviewRecord): string {
  const customer = db.customers.get(review.customerId);
  if (!customer || customer.deletedAt) return "Radhe Foods customer";
  const initial = customer.lastName?.trim().charAt(0);
  return `${customer.firstName ?? ""}${initial ? ` ${initial}.` : ""}`.trim();
}

function publishedReviewView(review: ReviewRecord) {
  return {
    id: review.id,
    rating: review.rating,
    title: review.title,
    text: review.text,
    locale: review.locale,
    authorName: authorNameOf(review),
    verifiedPurchase: true,
    publishedAt: review.publishedAt,
    editedAt: review.editedAt,
    reply: review.reply,
  };
}

function myReviewsOf(customer: CustomerRecord): ReviewRecord[] {
  return [...db.reviews.values()]
    .filter((review) => review.customerId === customer.id)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

route("GET", "/v1/store/products/:productId/reviews", (ctx) => {
  const productId = ctx.params.productId;
  if (!OBJECT_ID.test(productId)) {
    throw validationFailed("productId", "The id in the URL is not valid.");
  }
  const page = intParam(ctx.url, "page", 1, 500) ?? 1;
  const limit = intParam(ctx.url, "limit", 1, 100) ?? 10;
  const rating = intParam(ctx.url, "rating", 1, 5);
  const published = [...db.reviews.values()]
    .filter(
      (review) =>
        review.productId === productId && review.status === "published",
    )
    .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!));
  const distribution = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const review of published) {
    distribution[String(review.rating) as keyof typeof distribution] += 1;
  }
  const filtered =
    rating === undefined
      ? published
      : published.filter((review) => review.rating === rating);
  const total = filtered.length;
  return {
    body: {
      items: filtered
        .slice((page - 1) * limit, page * limit)
        .map(publishedReviewView),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      summary: {
        average: ratingOf(productId)?.average ?? 0,
        count: published.length,
        distribution,
      },
    },
  };
});

route("GET", "/v1/store/me/reviews", (ctx) => {
  const customer = requireCustomer(ctx);
  return {
    body: {
      items: myReviewsOf(customer).map((review) =>
        myReviewView(review, ctx.locale),
      ),
    },
  };
});

route("GET", "/v1/store/me/reviews/reviewable", (ctx) => {
  const customer = requireCustomer(ctx);
  const seen = new Set<string>();
  const items = [];
  for (const entry of deliveredProducts(customer)) {
    if (seen.has(entry.productId)) continue;
    seen.add(entry.productId);
    const review = myReviewsOf(customer).find(
      (candidate) => candidate.productId === entry.productId,
    );
    items.push({
      product: productRefOf(entry.productId, ctx.locale),
      orderNumber: entry.orderNumber,
      deliveredAt: entry.deliveredAt,
      review: review ? myReviewView(review, ctx.locale) : null,
    });
  }
  return { body: { items } };
});

route("PUT", "/v1/store/me/reviews/:productId", (ctx) => {
  const customer = requireCustomer(ctx);
  const productId = productIdParam(ctx);
  const body = objectBody(ctx.body, [
    "rating",
    "title",
    "text",
    "orderNumber",
    "locale",
  ]);
  const rating = body.rating;
  if (
    typeof rating !== "number" ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    throw validationFailed("rating", "rating must be 1 to 5");
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < REVIEW_TEXT_MIN || text.length > REVIEW_TEXT_MAX) {
    throw validationFailed("text", "text must be 10 to 2000 characters");
  }
  if (
    body.title !== undefined &&
    (typeof body.title !== "string" || body.title.trim().length > 120)
  ) {
    throw validationFailed("title", "title must be at most 120 characters");
  }
  if (body.orderNumber !== undefined && typeof body.orderNumber !== "string") {
    throw validationFailed("orderNumber", "orderNumber must be a string");
  }
  const locale = optionalLocale(body.locale, ctx.locale);
  const delivered = deliveredProducts(customer).find(
    (entry) => entry.productId === productId,
  );
  if (!delivered) {
    throw new HttpError(
      403,
      "REVIEW_NOT_ALLOWED",
      "No delivered order of yours has this product.",
    );
  }
  const now = new Date().toISOString();
  const title =
    typeof body.title === "string" ? body.title.trim() || null : null;
  const existing = myReviewsOf(customer).find(
    (review) => review.productId === productId,
  );
  let review: ReviewRecord;
  if (existing) {
    // Rewritten: it waits for the admin again.
    review = existing;
    review.rating = rating;
    review.title = title;
    review.text = text;
    review.locale = locale;
    review.editedAt = review.status === "published" ? now : review.editedAt;
    review.status = "pending";
    review.rejectionNote = null;
    review.updatedAt = now;
    review.orderNumber =
      (body.orderNumber as string | undefined) ?? review.orderNumber;
  } else {
    review = {
      id: `66fb${randomBytes(10).toString("hex")}`,
      customerId: customer.id,
      productId,
      orderNumber:
        (body.orderNumber as string | undefined) ?? delivered.orderNumber,
      rating,
      title,
      text,
      locale,
      status: "pending",
      rejectionNote: null,
      reply: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      editedAt: null,
    };
    db.reviews.set(review.id, review);
  }
  return { body: { review: myReviewView(review, ctx.locale) } };
});

route("DELETE", "/v1/store/me/reviews/:productId", (ctx) => {
  const customer = requireCustomer(ctx);
  const productId = productIdParam(ctx);
  const existing = myReviewsOf(customer).find(
    (review) => review.productId === productId,
  );
  if (!existing) {
    throw new HttpError(404, "REVIEW_NOT_FOUND", "No review of this product.");
  }
  db.reviews.delete(existing.id);
  return { status: 204 };
});

route("POST", "/v1/store/orders/:orderNumber/feedback", (ctx) => {
  const customer = requireCustomer(ctx);
  const order = findOrder(customer, ctx.params.orderNumber);
  const body = objectBody(ctx.body, ["rating", "deliveryRating", "comment"]);
  for (const key of ["rating", "deliveryRating"] as const) {
    const value = body[key];
    if (key === "deliveryRating" && value === undefined) continue;
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > 5
    ) {
      throw validationFailed(key, `${key} must be 1 to 5`);
    }
  }
  if (
    body.comment !== undefined &&
    (typeof body.comment !== "string" || body.comment.length > 1000)
  ) {
    throw validationFailed(
      "comment",
      "comment must be at most 1000 characters",
    );
  }
  if (order.delivery.deliveredAt === null) {
    throw new HttpError(
      409,
      "FEEDBACK_NOT_POSSIBLE",
      "The order is not delivered yet.",
    );
  }
  if (order.feedback) {
    throw new HttpError(
      409,
      "FEEDBACK_ALREADY_GIVEN",
      "Feedback was given for this order already.",
    );
  }
  order.feedback = {
    rating: body.rating as number,
    deliveryRating: (body.deliveryRating as number | undefined) ?? null,
    comment:
      typeof body.comment === "string" ? body.comment.trim() || null : null,
    at: new Date().toISOString(),
  };
  return { status: 201, body: { feedback: order.feedback } };
});

// Not part of the real API: the admin's decision on a review, for tests
// and for looking at the shop (`{ email, productId, action, note?, text? }`).
route("POST", "/__mock/review", (ctx) => {
  const body = objectBody(ctx.body, [
    "email",
    "productId",
    "action",
    "note",
    "text",
  ]);
  const customer = customerByEmail(String(body.email).toLowerCase());
  const review =
    customer &&
    myReviewsOf(customer).find((r) => r.productId === body.productId);
  if (!review) throw validationFailed("productId", "no such review");
  const now = new Date().toISOString();
  switch (body.action) {
    case "approve":
      review.status = "published";
      review.publishedAt = review.publishedAt ?? now;
      review.rejectionNote = null;
      break;
    case "reject":
      review.status = "rejected";
      review.rejectionNote = String(body.note ?? "Rejected.");
      break;
    case "reply":
      review.reply = { text: String(body.text ?? ""), at: now };
      break;
    default:
      throw validationFailed(
        "action",
        "action must be approve, reject or reply",
      );
  }
  review.updatedAt = now;
  return { status: 204 };
});

// --- 23 Problem reports (doc 23, CUSTOMER_ACCOUNTS 9) -------------------------

route("GET", "/v1/store/orders/:orderNumber/issues", (ctx) => {
  const customer = requireCustomer(ctx);
  const order = findOrder(customer, ctx.params.orderNumber);
  return { body: orderIssues(order, ctx.locale) };
});

route("POST", "/v1/store/orders/:orderNumber/issues", (ctx) => {
  const customer = requireCustomer(ctx);
  const order = findOrder(customer, ctx.params.orderNumber);
  return {
    status: 201,
    body: { issue: createIssue(customer, order, ctx.body, ctx.locale) },
  };
});

route("POST", "/v1/store/issues/:issueNumber/images", (ctx) => {
  const customer = requireCustomer(ctx);
  const issue = findIssue(customer, ctx.params.issueNumber);
  const multipart = (ctx.body as { multipart?: MultipartBody } | undefined)
    ?.multipart;
  if (!multipart) {
    throw validationFailed("files", "send the pictures as multipart/form-data");
  }
  return {
    status: 201,
    body: { issue: addIssueImages(issue, multipart.files, ctx.locale) },
  };
});

route("DELETE", "/v1/store/issues/:issueNumber/images/:imageId", (ctx) => {
  const customer = requireCustomer(ctx);
  const issue = findIssue(customer, ctx.params.issueNumber);
  return {
    body: { issue: removeIssueImage(issue, ctx.params.imageId, ctx.locale) },
  };
});

route("GET", "/v1/store/issues", (ctx) => ({
  body: listIssues(requireCustomer(ctx), ctx.locale),
}));

route("GET", "/v1/store/issues/:issueNumber", (ctx) => {
  const customer = requireCustomer(ctx);
  return {
    body: {
      issue: issueView(findIssue(customer, ctx.params.issueNumber), ctx.locale),
    },
  };
});

route("POST", "/v1/store/issues/:issueNumber/cancel", (ctx) => {
  const customer = requireCustomer(ctx);
  return {
    body: {
      issue: cancelIssue(
        findIssue(customer, ctx.params.issueNumber),
        ctx.locale,
      ),
    },
  };
});

/** A customer's photo, as uploaded. */
route("GET", "/media/issues/:id", (ctx) => {
  const image = db.issueImages.get(ctx.params.id);
  if (!image) throw new HttpError(404, "NOT_FOUND", "No such picture.");
  return {
    raw: {
      contentType: image.type,
      content: image.data,
      cacheControl: "public, max-age=60",
    },
  };
});

// Not part of the real API: the admin's decision on a report
// (`{ issueNumber, action: "review" | "resolve" | "reject", note?, resolution?, amount? }`).
route("POST", "/__mock/issue", (ctx) => {
  const body = objectBody(ctx.body, [
    "issueNumber",
    "action",
    "note",
    "resolution",
    "amount",
  ]);
  const issue = db.issues.get(String(body.issueNumber).toUpperCase());
  if (!issue) throw validationFailed("issueNumber", "unknown report");
  decideIssue(issue, ctx.body);
  return { status: 204 };
});

// --- 17 Homepage banners (doc 17) -------------------------------------------

route("GET", "/v1/store/banners", (ctx) => ({
  body: { banners: liveBanners().map((b) => bannerView(b, ctx.locale)) },
  headers: { "Cache-Control": "public, max-age=60" },
}));

// --- 18 FAQ (doc 18) --------------------------------------------------------

route("GET", "/v1/store/faqs", (ctx) => ({
  body: faqsView(ctx.locale),
  headers: { "Cache-Control": "public, max-age=300" },
}));

// --- 19 Blog (doc 19) -------------------------------------------------------

const BLOG_QUERY_KEYS = ["page", "limit", "category", "tag", "q", "locale"];

route("GET", "/v1/store/blog/posts", (ctx) => {
  for (const key of ctx.url.searchParams.keys()) {
    if (!BLOG_QUERY_KEYS.includes(key)) {
      throw validationFailed(key, `property ${key} should not exist`);
    }
  }
  const q = ctx.url.searchParams.get("q") ?? undefined;
  if (q !== undefined && (q.trim().length < 2 || q.length > 80)) {
    throw validationFailed(
      "q",
      "q must be longer than or equal to 2 characters",
    );
  }
  return {
    body: listBlogPosts(
      {
        category: ctx.url.searchParams.get("category") ?? undefined,
        tag: ctx.url.searchParams.get("tag") ?? undefined,
        q: q?.trim(),
        page: intParam(ctx.url, "page", 1, 500),
        limit: intParam(ctx.url, "limit", 1, 100),
      },
      ctx.locale,
    ),
    headers: { "Cache-Control": "public, max-age=300" },
  };
});

route("GET", "/v1/store/blog/posts/:slug", (ctx) => {
  const post = blogPostView(ctx.params.slug, ctx.locale);
  if (!post) {
    throw new HttpError(
      404,
      "BLOG_POST_NOT_FOUND",
      "This article does not exist.",
    );
  }
  return {
    body: { post },
    headers: { "Cache-Control": "public, max-age=300" },
  };
});

route("GET", "/v1/store/blog/categories", (ctx) => ({
  body: blogCategoriesView(ctx.locale),
  headers: { "Cache-Control": "public, max-age=300" },
}));

route("GET", "/v1/store/blog/tags", () => ({
  body: blogTagsView(),
  headers: { "Cache-Control": "public, max-age=300" },
}));

route("GET", "/media/blog/:id/:file", (ctx) => {
  const svg = blogImageSvg(ctx.params.id, ctx.params.file);
  if (!svg) throw new HttpError(404, "NOT_FOUND", "Not found.");
  return {
    raw: {
      contentType: "image/svg+xml",
      content: svg,
      cacheControl: "public, max-age=31536000, immutable",
    },
  };
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

// --- 9.6 Discount codes on the checkout page --------------------------------

route("PUT", "/v1/store/checkout/discount", (ctx) => ({
  body: applyDiscount(requireCustomer(ctx), ctx.body, ctx.locale),
}));

route("DELETE", "/v1/store/checkout/discount", (ctx) => ({
  body: removeDiscount(requireCustomer(ctx), ctx.locale),
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

/**
 * Where Stripe sends the browser afterwards (doc 10.4): the order page of
 * the account, or the guest order page with its token (doc 20).
 */
function backToOrder(
  order: ReturnType<typeof orderOfPage>,
  result: "success" | "cancelled",
): Result {
  const location = order.guestToken
    ? `${SHOP_URL}/guest/orders/${order.orderNumber}?token=${encodeURIComponent(order.guestToken)}&payment=${result}`
    : `${SHOP_URL}/account/orders/${order.orderNumber}?payment=${result}`;
  return { status: 302, headers: { Location: location } };
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
  if (!pageIsOpen(order)) return backToOrder(order, "cancelled");
  if (ctx.url.searchParams.get("type") === "paypal") {
    // The bank approves now; Stripe's notification comes a moment later.
    settleLater(order);
  } else {
    settlePayment(order, "card");
  }
  return backToOrder(order, "success");
});

route("GET", "/__mock/stripe/:orderNumber/cancel", (ctx) =>
  backToOrder(orderOfPage(ctx.params.orderNumber), "cancelled"),
);

// --- 20 Guest checkout ------------------------------------------------------

route("POST", "/v1/store/guest/checkout", (ctx) => {
  const key = ctx.headers["idempotency-key"];
  return guestCheckout(
    typeof key === "string" ? key : undefined,
    ctx.body,
    ctx.locale,
    mockBaseOf(ctx),
  );
});

/** The token of a guest order: `?token=` or the `X-Order-Token` header (doc 20). */
function guestOrderOf(ctx: Context) {
  const header = ctx.headers["x-order-token"];
  const token =
    ctx.url.searchParams.get("token") ??
    (typeof header === "string" ? header : undefined);
  return findGuestOrder(ctx.params.orderNumber, token);
}

route("GET", "/v1/store/guest/orders/:orderNumber", (ctx) => {
  const order = guestOrderOf(ctx);
  const customer = db.customers.get(order.customerId)!;
  const payment = orderPayment(customer, order);
  return {
    body: {
      order: orderDetail(order, ctx.locale),
      payment: payment.payment,
      documents: payment.documents,
    },
  };
});

route("POST", "/v1/store/guest/orders/:orderNumber/pay", (ctx) => ({
  body: paymentPage(guestOrderOf(ctx), mockBaseOf(ctx)),
}));

route("POST", "/v1/store/guest/orders/:orderNumber/cancel", (ctx) => ({
  body: cancelOrderRecord(guestOrderOf(ctx), ctx.body, ctx.locale),
}));

route(
  "GET",
  "/v1/store/guest/orders/:orderNumber/invoices/:number/pdf",
  (ctx) => {
    const order = guestOrderOf(ctx);
    const customer = db.customers.get(order.customerId)!;
    const document = findInvoice(customer, ctx.params.number);
    if (document.orderNumber !== order.orderNumber) {
      throw new HttpError(
        404,
        "INVOICE_NOT_FOUND",
        "This document does not exist.",
      );
    }
    return {
      raw: {
        contentType: "application/pdf",
        content: invoicePdf(document),
      },
      headers: {
        "Content-Disposition": `attachment; filename="${document.number}.pdf"`,
      },
    };
  },
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
// `passwordReset` is the open link of the password reset email, or null;
// `signupCode` the code of a sign-up that waits, or null.
route("GET", "/__mock/tokens", (ctx) => {
  const email = (ctx.url.searchParams.get("email") ?? "").toLowerCase();
  const customer = customerByEmail(email);
  const pending = pendingSignupOf(email);
  if (!customer && !pending)
    throw validationFailed("email", "unknown customer");
  const passwordReset =
    (customer &&
      [...db.passwordResets].find(
        ([, reset]) => reset.customerId === customer.id,
      )?.[0]) ??
    null;
  return {
    body: {
      unsubscribe: customer ? unsubscribeTokenOf(customer) : null,
      passwordReset,
      signupCode: pending?.code ?? null,
      referralCode: customer?.referralCode ?? null,
    },
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

route("GET", "/media/categories/:id/:file", (ctx) => {
  const svg = categorySvg(ctx.params.id, ctx.params.file);
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
  const raw = Buffer.concat(chunks);
  // The photos of a problem report come as multipart/form-data (doc 23).
  const boundary = boundaryOf(request.headers["content-type"]);
  if (boundary) return { multipart: parseMultipart(raw, boundary) };
  const text = raw.toString("utf8");
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
            "Content-Type, Authorization, X-Request-Id, Idempotency-Key, X-Order-Token",
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
