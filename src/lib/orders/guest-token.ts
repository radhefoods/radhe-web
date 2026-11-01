// The token that opens a guest order (doc 20). It comes with the link of
// every email about the order and with the way back from Stripe; the shop
// keeps it for the session as well, so the page still opens when the
// address lost its query (a reload after the token was edited away, a
// link copied without it). Session storage: it goes when the tab closes,
// and it is never shared between orders.

const PREFIX = "rf.guest-order.v1:";

/** 8 to 256 characters of what a URL-safe token is made of. */
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{8,256}$/;

type TokenStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function sessionStore(): TokenStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Whether a value from the address or storage looks like a token at all. */
export function isGuestToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_FORMAT.test(value);
}

function keyOf(orderNumber: string): string {
  return `${PREFIX}${orderNumber.toUpperCase()}`;
}

/** Keeps the token of an order for this tab. */
export function rememberGuestToken(
  orderNumber: string,
  token: string,
  storage: TokenStorage | null = sessionStore(),
): void {
  if (!isGuestToken(token)) return;
  try {
    storage?.setItem(keyOf(orderNumber), token);
  } catch {
    // Storage blocked: the link in the email still carries the token.
  }
}

/** The token kept for an order, or `null`. */
export function storedGuestToken(
  orderNumber: string,
  storage: TokenStorage | null = sessionStore(),
): string | null {
  try {
    const value = storage?.getItem(keyOf(orderNumber));
    return isGuestToken(value) ? value : null;
  } catch {
    return null;
  }
}

/** Forgets the token of an order (the API said it does not open it). */
export function forgetGuestToken(
  orderNumber: string,
  storage: TokenStorage | null = sessionStore(),
): void {
  try {
    storage?.removeItem(keyOf(orderNumber));
  } catch {
    // Nothing stored.
  }
}

/**
 * The token to open an order with: the one in the address when it looks
 * like one, else the one kept for this tab.
 */
export function resolveGuestToken(
  orderNumber: string,
  fromUrl: string | null | undefined,
  storage: TokenStorage | null = sessionStore(),
): string | null {
  if (isGuestToken(fromUrl)) return fromUrl;
  return storedGuestToken(orderNumber, storage);
}
