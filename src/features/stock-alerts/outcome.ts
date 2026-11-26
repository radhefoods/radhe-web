import { fieldProblems, hasErrorCode } from "@/lib/api/errors";
import type { Ordering } from "@/lib/api/types";

// What a refusal of the back-in-stock routes means for the control that
// asked (doc 26). Most refusals are a sentence to show (the limits, a
// blocked account, too many requests, no connection); a few change what the
// control is.

export type StockAlertRefusal =
  /** The pack size can be ordered again: show "Add to cart", with this ordering when the API sent one. */
  | { kind: "back"; ordering: Ordering | null }
  /** The shop does not offer the emails (any more): nothing of the feature stays on the page. */
  | { kind: "off" }
  /** The pack size left the shop: this control goes. */
  | { kind: "gone" }
  /** Nobody is signed in (any more): the visitor's form is the way. */
  | { kind: "signedOut" }
  /** The form of a visitor: which of its two fields the API refused. */
  | { kind: "fields"; email: boolean; consent: boolean }
  /** Everything else: said with the sentence of its code. */
  | { kind: "error"; error: unknown };

function orderingOf(details: unknown): Ordering | null {
  const ordering = (details as { ordering?: Partial<Ordering> } | null)
    ?.ordering;
  return ordering &&
    ordering.canOrder === true &&
    typeof ordering.minQuantity === "number" &&
    typeof ordering.maxQuantity === "number" &&
    typeof ordering.remaining === "number"
    ? (ordering as Ordering)
    : null;
}

export function refusalOf(error: unknown): StockAlertRefusal {
  if (hasErrorCode(error, "STOCK_ALERT_NOT_NEEDED")) {
    return { kind: "back", ordering: orderingOf(error.details) };
  }
  if (hasErrorCode(error, "STOCK_ALERTS_DISABLED")) return { kind: "off" };
  if (hasErrorCode(error, "PRODUCT_VARIANT_NOT_FOUND")) return { kind: "gone" };
  if (
    hasErrorCode(error, "AUTH_TOKEN_INVALID") ||
    hasErrorCode(error, "AUTH_REFRESH_INVALID") ||
    hasErrorCode(error, "UNAUTHENTICATED") ||
    hasErrorCode(error, "CUSTOMER_NOT_FOUND")
  ) {
    return { kind: "signedOut" };
  }
  const fields = fieldProblems(error);
  if (fields.email || fields.consent) {
    return {
      kind: "fields",
      email: Boolean(fields.email),
      consent: Boolean(fields.consent),
    };
  }
  return { kind: "error", error };
}
