import type { Locale } from "@/i18n/routing";
import { ApiError } from "./errors";

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, QueryValue>;
  /** Sent as JSON. */
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Sent as `?locale=`. Every store endpoint answers in one language. */
  locale?: Locale;
  /** Next.js data cache, server side only. */
  next?: { revalidate?: number | false; tags?: string[] };
  cache?: RequestCache;
}

/** Calls the API and returns the parsed answer (`undefined` for 204). */
export type Requester = <T>(
  path: string,
  options?: RequestOptions,
) => Promise<T>;

export interface TransportConfig {
  /** Without a trailing slash and without `/v1`. */
  baseUrl: string;
  /** `include` in the browser, so the session cookies travel. */
  credentials?: RequestCredentials;
  /** The language when a call names none. */
  defaultLocale?: () => Locale | undefined;
  fetch?: typeof fetch;
}

export function buildUrl(
  baseUrl: string,
  path: string,
  query: Record<string, QueryValue> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return `${baseUrl}${path}${search ? `?${search}` : ""}`;
}

/** Turns an answer that is not 2xx into an `ApiError` (error format 0.4). */
export async function toApiError(response: Response): Promise<ApiError> {
  const headerRequestId = response.headers.get("x-request-id");
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  const body = payload as
    | {
        error?: { code?: unknown; message?: unknown; details?: unknown };
        requestId?: unknown;
      }
    | undefined;
  if (body?.error && typeof body.error.code === "string") {
    return new ApiError({
      status: response.status,
      code: body.error.code,
      message:
        typeof body.error.message === "string"
          ? body.error.message
          : body.error.code,
      details: body.error.details,
      requestId:
        typeof body.requestId === "string" ? body.requestId : headerRequestId,
    });
  }
  return new ApiError({
    status: response.status,
    code: "UNEXPECTED_RESPONSE",
    message: `The API answered ${response.status} without an error body.`,
    requestId: headerRequestId,
  });
}

/**
 * One HTTP call to the API. Returns the raw `Response` when it is 2xx and
 * throws an `ApiError` otherwise, also when the API cannot be reached.
 */
export async function send(
  config: TransportConfig,
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const locale = options.locale ?? config.defaultLocale?.();
  const url = buildUrl(config.baseUrl, path, { ...options.query, locale });
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };
  const init: RequestInit & { next?: RequestOptions["next"] } = {
    method: options.method ?? "GET",
    headers,
    signal: options.signal,
  };
  if (config.credentials) init.credentials = config.credentials;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  if (options.next) init.next = options.next;
  if (options.cache) init.cache = options.cache;

  let response: Response;
  try {
    response = await (config.fetch ?? fetch)(url, init);
  } catch (cause) {
    // An aborted request is not an error of the API: let the caller see it.
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause;
    }
    throw new ApiError({
      status: 0,
      code: "NETWORK_ERROR",
      message: "The API could not be reached.",
    });
  }
  if (!response.ok) throw await toApiError(response);
  return response;
}

export async function parseJson<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError({
      status: response.status,
      code: "UNEXPECTED_RESPONSE",
      message: "The API answered with something that is not JSON.",
      requestId: response.headers.get("x-request-id"),
    });
  }
}

/** A requester without session handling: public data, server side. */
export function createRequester(config: TransportConfig): Requester {
  return async <T>(path: string, options?: RequestOptions) =>
    parseJson<T>(await send(config, path, options));
}
