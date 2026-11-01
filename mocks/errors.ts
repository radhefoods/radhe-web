// The error format of the API (doc 0.4), for the mock.

export class HttpError extends Error {
  status: number;
  code: string;
  details: unknown;
  setCookies: string[];

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
    setCookies: string[] = [],
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.setCookies = setCookies;
  }
}

export function validationFailed(field: string, problem: string): HttpError {
  return new HttpError(
    400,
    "VALIDATION_FAILED",
    "The request contains invalid data.",
    [{ field, problems: [problem] }],
  );
}

/** A JSON object with only the allowed keys: unknown fields are rejected (doc 0.2). */
export function objectBody(
  body: unknown,
  allowed: string[],
): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationFailed("", "the body must be a JSON object");
  }
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      throw validationFailed(key, `property ${key} should not exist`);
    }
  }
  return body as Record<string, unknown>;
}

export const OBJECT_ID = /^[0-9a-f]{24}$/i;
export const PHONE = /^\+[1-9]\d{6,14}$/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A valid, lower-cased address, or `VALIDATION_FAILED`. */
export function emailOf(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) {
    throw validationFailed("email", "email must be an email");
  }
  return email;
}

/** The `items` of a cart body (doc 8): 1 to 100 pack sizes, each once. */
export function cartItems(
  value: unknown,
  minimum: number,
): { variantId: string; quantity: number }[] {
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
