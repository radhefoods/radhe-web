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
