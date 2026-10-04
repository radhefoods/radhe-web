// Where to go after signing in. The value travels in the address
// (`/sign-in?returnTo=/checkout`), so anyone can write anything into it:
// only pages of this list, and the page of one order, are accepted, never an
// address from outside.

const STATIC_TARGETS = [
  "/",
  "/cart",
  "/checkout",
  "/account",
  "/account/orders",
  "/account/invoices",
  "/account/addresses",
  "/account/profile",
] as const;

type StaticTarget = (typeof STATIC_TARGETS)[number];

/** The page of one order: `/account/orders/RF-1084`. */
const ORDER_TARGET = /^\/account\/orders\/(RF-\d{1,10})$/i;

/** A checked return address: a path inside the shop, safe to navigate to. */
export type ReturnTarget = StaticTarget | `/account/orders/${string}`;

/** Where a sign-in without a wish leads. */
export const DEFAULT_RETURN_TARGET: ReturnTarget = "/account";

export function parseReturnTo(
  value: string | string[] | null | undefined,
): ReturnTarget {
  const candidate = (Array.isArray(value) ? value[0] : value) ?? "";
  if ((STATIC_TARGETS as readonly string[]).includes(candidate)) {
    return candidate as StaticTarget;
  }
  const order = ORDER_TARGET.exec(candidate);
  if (order) return `/account/orders/${order[1].toUpperCase()}`;
  return DEFAULT_RETURN_TARGET;
}

export type ReturnHref =
  | StaticTarget
  | {
      pathname: "/account/orders/[orderNumber]";
      params: { orderNumber: string };
    };

/** The checked target as a link of the shop's router. */
export function returnHref(target: ReturnTarget): ReturnHref {
  const order = ORDER_TARGET.exec(target);
  return order
    ? {
        pathname: "/account/orders/[orderNumber]",
        params: { orderNumber: order[1] },
      }
    : (target as StaticTarget);
}
