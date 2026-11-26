// Back-in-stock emails ("Notify me", doc 26) for the mock: the rules of
// `radhe-api/src/modules/stock-alerts`, with the requests kept in memory.
// One request per address and pack size; a visitor confirms the address by
// a link first, a customer's request counts at once. No email is sent: the
// tokens the emails would carry are read through `GET /__mock/stock-alerts`.

import { createHash } from "node:crypto";
import type { GuestStockAlert, OwnStockAlert } from "../src/lib/api/types.ts";
import { HttpError } from "./errors.ts";
import {
  db,
  settings,
  type CustomerRecord,
  type Locale,
  type StockAlertRecord,
} from "./state.ts";
import { findVariant, orderingOf, productSummary } from "./views.ts";

/** An address waits for at most this many pack sizes at a time. */
export const MAX_WAITING_ALERTS = 50;
/** And has at most this many requests that wait for their confirmation. */
export const MAX_UNCONFIRMED_ALERTS = 5;

const isWaiting = (alert: StockAlertRecord) =>
  alert.status === "unconfirmed" || alert.status === "active";

// --- Tokens: the id of the request and a signature, as the API builds them ---

type TokenPurpose = "confirm" | "unsubscribe";

function signatureOf(purpose: TokenPurpose, id: string): string {
  return createHash("sha256")
    .update(`mock-stock-alert:${purpose}:${id}`)
    .digest("base64url");
}

export function stockAlertToken(
  purpose: TokenPurpose,
  alert: StockAlertRecord,
): string {
  return `${alert.id}.${signatureOf(purpose, alert.id)}`;
}

/** The request of a token, or `404 STOCK_ALERT_TOKEN_INVALID`. */
function byToken(purpose: TokenPurpose, token: string): StockAlertRecord {
  const [id, signature, ...rest] = token.split(".");
  const alert =
    rest.length === 0 && id && signature === signatureOf(purpose, id)
      ? db.stockAlerts.get(id)
      : undefined;
  if (!alert) {
    // Not genuine, or a request that was never confirmed and is gone.
    throw new HttpError(
      404,
      "STOCK_ALERT_TOKEN_INVALID",
      "This link is no longer valid.",
    );
  }
  return alert;
}

// --- Asking -----------------------------------------------------------------

function assertEnabled(): void {
  if (!settings.stockAlerts.enabled) {
    throw new HttpError(
      409,
      "STOCK_ALERTS_DISABLED",
      "Notifications about products that come back are not offered at the moment.",
    );
  }
}

/** The pack size, when a customer can wait for it: shown, and not to be ordered now. */
function askable(variantId: string) {
  const found = findVariant(variantId);
  if (!found || !found.variant.isEnabled) {
    throw new HttpError(
      404,
      "PRODUCT_VARIANT_NOT_FOUND",
      "This product is not in the shop.",
    );
  }
  const ordering = orderingOf(found.product, found.variant);
  if (ordering.canOrder) {
    throw new HttpError(
      409,
      "STOCK_ALERT_NOT_NEEDED",
      "This product can be ordered now.",
      { variantId, ordering },
    );
  }
  return found;
}

/** An address cannot wait for the whole catalogue, nor be flooded with confirmations. */
function assertRoom(email: string, status: StockAlertRecord["status"]): void {
  const own = [...db.stockAlerts.values()].filter(
    (alert) => alert.email === email,
  );
  if (own.filter(isWaiting).length >= MAX_WAITING_ALERTS) {
    throw new HttpError(
      409,
      "STOCK_ALERT_LIMIT_REACHED",
      `An address can wait for ${MAX_WAITING_ALERTS} products at a time.`,
      { maximum: MAX_WAITING_ALERTS },
    );
  }
  if (
    status === "unconfirmed" &&
    own.filter((alert) => alert.status === "unconfirmed").length >=
      MAX_UNCONFIRMED_ALERTS
  ) {
    throw new HttpError(
      409,
      "STOCK_ALERT_LIMIT_REACHED",
      "Please confirm the requests we already sent you an email about first.",
      { maximum: MAX_UNCONFIRMED_ALERTS, unconfirmed: true },
    );
  }
}

/**
 * Writes the request: a new record, or the record of this address and pack
 * size opened again (a new round). An address that waits already changes
 * nothing. `created` is false when nothing was written.
 */
function open(input: {
  variantId: string;
  email: string;
  locale: Locale;
  confirmed: boolean;
  customerId: string | null;
}): { alert: StockAlertRecord; created: boolean } {
  const { product, variant } = askable(input.variantId);
  const status = input.confirmed ? "active" : "unconfirmed";
  const existing = [...db.stockAlerts.values()].find(
    (alert) => alert.variantId === variant.id && alert.email === input.email,
  );

  if (existing?.status === "active") {
    // Waiting already. An account takes over a request its address made
    // as a visitor.
    if (input.customerId && !existing.customerId) {
      existing.customerId = input.customerId;
    }
    return { alert: existing, created: false };
  }
  if (existing?.status === "unconfirmed") {
    if (!input.confirmed) return { alert: existing, created: false };
    // The account proves the address the visitor did not confirm.
    existing.status = "active";
    existing.customerId = input.customerId;
    existing.locale = input.locale;
    return { alert: existing, created: true };
  }

  assertRoom(input.email, status);
  const now = new Date().toISOString();
  if (existing) {
    // Told, taken back or lapsed before: the same record, a new round.
    existing.status = status;
    existing.productId = product.id;
    existing.locale = input.locale;
    existing.customerId = input.customerId;
    existing.requestedAt = now;
    existing.cycle += 1;
    return { alert: existing, created: true };
  }
  db.stockAlertSequence += 1;
  const alert: StockAlertRecord = {
    id: `66a1${db.stockAlertSequence.toString(16).padStart(20, "0")}`,
    productId: product.id,
    variantId: variant.id,
    email: input.email,
    customerId: input.customerId,
    locale: input.locale,
    status,
    requestedAt: now,
    cycle: 1,
  };
  db.stockAlerts.set(alert.id, alert);
  return { alert, created: true };
}

/** A visitor asks. The answer never says whether the address waited already. */
export function askAsGuest(input: {
  variantId: string;
  email: string;
  locale: Locale;
}) {
  assertEnabled();
  const { alert } = open({
    ...input,
    confirmed: !settings.stockAlerts.guestConfirmation,
    customerId: null,
  });
  if (alert.status === "unconfirmed") {
    console.log(
      `[mock] confirmation email (${alert.locale}) to ${alert.email}: /stock-alerts/confirm?token=${stockAlertToken("confirm", alert)}`,
    );
  }
  return {
    variantId: alert.variantId,
    productId: alert.productId,
    confirmationRequired: settings.stockAlerts.guestConfirmation,
  };
}

/** A signed-in customer asks. The address of the account is proven already. */
export function askAsCustomer(
  customer: CustomerRecord,
  variantId: string,
  locale: Locale,
) {
  assertEnabled();
  if (customer.blocked || customer.kind === "guest") {
    throw new HttpError(
      403,
      "CUSTOMER_BLOCKED",
      "This account cannot ask for notifications. Please contact Radhe Foods.",
    );
  }
  return open({
    variantId,
    email: customer.email,
    locale,
    confirmed: true,
    customerId: customer.id,
  });
}

// --- The links of the emails ------------------------------------------------

/** The link of the confirmation email. Using it twice changes nothing. */
export function confirmAlert(token: string): StockAlertRecord {
  const alert = byToken("confirm", token);
  if (alert.status === "unconfirmed") alert.status = "active";
  return alert;
}

/**
 * The link at the foot of the emails: the request of the link is taken
 * back, and with `all` every request of the same address that waits.
 */
export function unsubscribeAlert(token: string, all: boolean) {
  const alert = byToken("unsubscribe", token);
  const sameAddress = [...db.stockAlerts.values()].filter(
    (other) => other.email === alert.email,
  );
  let cancelled = 0;
  for (const other of all ? sameAddress : [alert]) {
    if (!isWaiting(other)) continue;
    other.status = "cancelled";
    cancelled += 1;
  }
  return {
    alert,
    cancelled,
    waiting: sameAddress.filter(isWaiting).length,
  };
}

// --- The customer's own requests --------------------------------------------

/** What a signed-in customer waits for, newest first. */
export function alertsOf(customer: CustomerRecord): StockAlertRecord[] {
  return [...db.stockAlerts.values()]
    .filter((alert) => alert.customerId === customer.id && isWaiting(alert))
    .sort(
      (a, b) =>
        b.requestedAt.localeCompare(a.requestedAt) || b.id.localeCompare(a.id),
    );
}

/** A customer takes a request back. Taking it back twice changes nothing. */
export function cancelOwn(
  customer: CustomerRecord,
  alertId: string,
): StockAlertRecord {
  const alert = db.stockAlerts.get(alertId);
  if (!alert || alert.customerId !== customer.id) {
    throw new HttpError(
      404,
      "STOCK_ALERT_NOT_FOUND",
      "This notification does not exist.",
    );
  }
  if (isWaiting(alert)) alert.status = "cancelled";
  return alert;
}

/** Nothing of a closed account is kept here: the address is personal. */
export function forgetAlertsOf(customer: CustomerRecord): void {
  for (const [id, alert] of db.stockAlerts) {
    if (alert.customerId === customer.id || alert.email === customer.email) {
      db.stockAlerts.delete(id);
    }
  }
}

// --- What the API answers ---------------------------------------------------

/** Hides most of the local part: `gi***@example.com`. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return domain ? `${local.slice(0, 2)}***@${domain}` : "***";
}

/** What a visitor is told: never the id of the request, the address hidden. */
export function guestAlertView(alert: StockAlertRecord): GuestStockAlert {
  return {
    variantId: alert.variantId,
    productId: alert.productId,
    status: alert.status,
    email: maskEmail(alert.email),
    requestedAt: alert.requestedAt,
  };
}

/** A customer's request with its pack size as listings show it. */
export function ownAlertView(
  alert: StockAlertRecord,
  locale: Locale,
): OwnStockAlert {
  const found = findVariant(alert.variantId);
  return {
    id: alert.id,
    variantId: alert.variantId,
    productId: alert.productId,
    status: alert.status,
    requestedAt: alert.requestedAt,
    // Null when the pack size left the shop.
    product:
      found && found.variant.isEnabled
        ? productSummary(found.product, locale, { selected: found.variant })
        : null,
  };
}

// --- The run (a test control) -----------------------------------------------

/**
 * What the API does every five minutes: the customers who wait for a pack
 * size that can be ordered again are told (here: marked as told), and the
 * requests of pack sizes that left the shop are closed.
 */
export function runStockAlerts(): { queued: number; removed: number } {
  let queued = 0;
  let removed = 0;
  if (!settings.stockAlerts.enabled) return { queued, removed };
  for (const alert of db.stockAlerts.values()) {
    if (!isWaiting(alert)) continue;
    const found = findVariant(alert.variantId);
    if (!found || !found.variant.isEnabled) {
      alert.status = "cancelled";
      removed += 1;
    } else if (
      alert.status === "active" &&
      orderingOf(found.product, found.variant).canOrder
    ) {
      alert.status = "notified";
      queued += 1;
      console.log(
        `[mock] back-in-stock email (${alert.locale}) to ${alert.email}: /stock-alerts/unsubscribe?token=${stockAlertToken("unsubscribe", alert)}`,
      );
    }
  }
  return { queued, removed };
}
