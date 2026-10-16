import type {
  CartLineIssue,
  Cents,
  ConsentVersions,
  Id,
  IsoDateTime,
  LegalType,
  OrderStatus,
  PaymentStatus,
  Totals,
} from "./types";

/**
 * Every error code the store API documents. The API's `message` is English
 * and meant for developers; the shop translates the `code` (messages
 * `errors.<CODE>`).
 */
export const API_ERROR_CODES = [
  // generic (0.4)
  "VALIDATION_FAILED",
  "BAD_REQUEST",
  "AUTH_TOKEN_INVALID",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "ORIGIN_NOT_ALLOWED",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_ERROR",
  // authentication (1)
  "OTP_COOLDOWN",
  "OTP_LIMIT_REACHED",
  "OTP_INVALID",
  "MAIL_DELIVERY_FAILED",
  "GOOGLE_NOT_CONFIGURED",
  "GOOGLE_TOKEN_INVALID",
  "GOOGLE_EMAIL_NOT_VERIFIED",
  "AUTH_REFRESH_INVALID",
  "CUSTOMER_BLOCKED",
  // account (2, 3)
  "CUSTOMER_NOT_FOUND",
  "ADDRESS_LIMIT_REACHED",
  "ADDRESS_NOT_FOUND",
  // legal and catalogue (6, 7)
  "LEGAL_DOCUMENT_NOT_FOUND",
  "CATEGORY_NOT_FOUND",
  "PRODUCT_NOT_FOUND",
  // cart (8)
  "CART_PRODUCT_NOT_FOUND",
  "CART_FULL",
  // checkout and orders (9)
  "IDEMPOTENCY_KEY_REQUIRED",
  "PAYMENTS_NOT_CONFIGURED",
  "COMPANY_DETAILS_MISSING",
  "LEGAL_DOCUMENTS_MISSING",
  "LEGAL_VERSION_CHANGED",
  "CART_EMPTY",
  "ORDER_ITEMS_NOT_ORDERABLE",
  "ORDER_TOTAL_CHANGED",
  "ORDER_NOT_PAYABLE",
  "PAYMENT_PROVIDER_ERROR",
  "ORDER_NOT_FOUND",
  "ORDER_CANNOT_BE_CANCELLED",
  // invoices (11)
  "INVOICE_NOT_FOUND",
  // returns (12)
  "RETURN_NOT_POSSIBLE",
  "RETURN_WINDOW_CLOSED",
  "ORDER_ITEM_NOT_FOUND",
  "RETURN_QUANTITY_INVALID",
  "RETURN_NOT_FOUND",
  "RETURN_TRANSITION_NOT_ALLOWED",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/**
 * Codes the shop itself raises: the API could not be reached, or it answered
 * with something that is not its error format.
 */
export type ClientErrorCode = "NETWORK_ERROR" | "UNEXPECTED_RESPONSE";

export type ErrorCode = ApiErrorCode | ClientErrorCode;

const KNOWN_CODES: ReadonlySet<string> = new Set(API_ERROR_CODES);

/** One entry of `details` for `VALIDATION_FAILED` (0.4). */
export interface FieldProblem {
  field: string;
  problems: string[];
}

/** `details` per code, as documented with each endpoint. */
export interface ErrorDetails {
  VALIDATION_FAILED: FieldProblem[];
  OTP_COOLDOWN: { retryAfterSeconds: number };
  OTP_LIMIT_REACHED: { retryAfterSeconds: number };
  OTP_INVALID: { attemptsRemaining: number } | undefined;
  ADDRESS_LIMIT_REACHED: { maximum: number };
  CART_FULL: { maximum: number };
  COMPANY_DETAILS_MISSING: { missing: string[] };
  LEGAL_DOCUMENTS_MISSING: { missing: LegalType[] };
  LEGAL_VERSION_CHANGED: { current: ConsentVersions };
  /** One per cart line with an issue; all but `variantId`, `quantity` and `issue` are `null` for `product_not_found`. */
  ORDER_ITEMS_NOT_ORDERABLE: {
    lines: {
      productId: Id | null;
      variantId: Id;
      sku: string | null;
      quantity: number;
      issue: CartLineIssue;
      minQuantity: number | null;
      maxQuantity: number | null;
      remaining: number | null;
    }[];
  };
  ORDER_TOTAL_CHANGED: { expectedTotal: Cents; total: Cents; totals: Totals };
  ORDER_NOT_PAYABLE: { status: OrderStatus; paymentStatus: PaymentStatus };
  ORDER_CANNOT_BE_CANCELLED: { status: OrderStatus };
  RETURN_NOT_POSSIBLE: { status: OrderStatus };
  RETURN_WINDOW_CLOSED: { until: IsoDateTime | null; windowDays: number };
  ORDER_ITEM_NOT_FOUND: { variantId: Id };
  RETURN_QUANTITY_INVALID: { variantId: Id; sku: string; available: number };
  RETURN_TRANSITION_NOT_ALLOWED: { from: string; to: string };
}

export class ApiError extends Error {
  /** HTTP status; 0 when the API was not reached. */
  readonly status: number;
  /**
   * A documented code, or a client code. A code the shop does not know
   * (a newer API) is kept in `rawCode` and reported as `INTERNAL_ERROR`,
   * so that the interface always has a translation.
   */
  readonly code: ErrorCode;
  readonly rawCode: string;
  readonly details: unknown;
  /** Shown to the customer on unexpected errors, for support. */
  readonly requestId: string | null;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
    requestId?: string | null;
  }) {
    super(input.message);
    this.name = "ApiError";
    this.status = input.status;
    this.rawCode = input.code;
    this.code =
      KNOWN_CODES.has(input.code) ||
      input.code === "NETWORK_ERROR" ||
      input.code === "UNEXPECTED_RESPONSE"
        ? (input.code as ErrorCode)
        : "INTERNAL_ERROR";
    this.details = input.details;
    this.requestId = input.requestId ?? null;
  }

  /** Narrowing check with typed `details`. */
  is<C extends ErrorCode>(
    code: C,
  ): this is ApiError & {
    code: C;
    details: C extends keyof ErrorDetails ? ErrorDetails[C] : unknown;
  } {
    return this.code === code;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function hasErrorCode<C extends ErrorCode>(
  error: unknown,
  code: C,
): error is ApiError & {
  code: C;
  details: C extends keyof ErrorDetails ? ErrorDetails[C] : unknown;
} {
  return isApiError(error) && error.code === code;
}

/**
 * The problems of a `VALIDATION_FAILED` answer by field path
 * (`postalCode`, `items.0.quantity`), for showing them next to the field.
 */
export function fieldProblems(error: unknown): Record<string, string[]> {
  if (!hasErrorCode(error, "VALIDATION_FAILED")) return {};
  const details = error.details;
  if (!Array.isArray(details)) return {};
  const byField: Record<string, string[]> = {};
  for (const entry of details) {
    if (
      entry &&
      typeof entry.field === "string" &&
      Array.isArray(entry.problems)
    ) {
      byField[entry.field] = entry.problems.filter(
        (problem): problem is string => typeof problem === "string",
      );
    }
  }
  return byField;
}

/** Errors worth showing the request id for: nothing the customer did wrong. */
export function isUnexpectedError(error: unknown): boolean {
  if (!isApiError(error)) return true;
  return (
    error.status >= 500 ||
    error.status === 0 ||
    error.code === "INTERNAL_ERROR" ||
    error.code === "UNEXPECTED_RESPONSE"
  );
}

/**
 * Whether asking again can help, and is safe. Used for reads only: the
 * network failed, the API was busy (429) or briefly unavailable (502/503/504).
 */
export function isRetryable(error: unknown): boolean {
  if (!isApiError(error)) return false;
  if (error.code === "NETWORK_ERROR" || error.code === "RATE_LIMITED") {
    return true;
  }
  return error.status === 502 || error.status === 503 || error.status === 504;
}
