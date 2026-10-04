import { describe, expect, it, vi } from "vitest";
import { ApiError, fieldProblems, hasErrorCode, isRetryable } from "./errors";
import { buildUrl, createRequester } from "./http";
import { createSessionTransport } from "./session-transport";

const BASE = "https://api.test";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function apiError(status: number, code: string, details?: unknown): Response {
  return json(status, {
    error: { code, message: `${code} happened`, details },
    requestId: "req-12345678",
  });
}

/** A fetch that answers from a list of handlers, in order, per URL path. */
function scriptedFetch(script: Record<string, Array<() => Response>>) {
  const calls: { path: string; init: RequestInit }[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      calls.push({ path, init: init ?? {} });
      const next = script[path]?.shift();
      if (!next) throw new Error(`Unexpected call to ${path}`);
      return next();
    },
  );
  return { fetch: fetchMock as unknown as typeof fetch, calls };
}

describe("buildUrl", () => {
  it("adds the query and leaves out empty values", () => {
    expect(
      buildUrl(BASE, "/v1/store/products", {
        locale: "de",
        q: "reis",
        page: 2,
        onSale: true,
        tag: undefined,
        brand: null,
        category: "",
      }),
    ).toBe(`${BASE}/v1/store/products?locale=de&q=reis&page=2&onSale=true`);
  });
});

describe("plain requester", () => {
  it("sends the locale and parses the answer", async () => {
    const { fetch, calls } = scriptedFetch({
      "/v1/store/cargo": [() => json(200, { acceptingOrders: true })],
    });
    const request = createRequester({ baseUrl: BASE, fetch });
    const result = await request<{ acceptingOrders: boolean }>(
      "/v1/store/cargo",
      { locale: "de" },
    );
    expect(result.acceptingOrders).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/v1/store/cargo?locale=de`,
      expect.objectContaining({ method: "GET" }),
    );
    expect(calls[0].init.credentials).toBeUndefined();
  });

  it("answers undefined for 204", async () => {
    const { fetch } = scriptedFetch({
      "/v1/store/auth/logout": [() => new Response(null, { status: 204 })],
    });
    const request = createRequester({ baseUrl: BASE, fetch });
    await expect(
      request("/v1/store/auth/logout", { method: "POST" }),
    ).resolves.toBeUndefined();
  });

  it("turns the error format of the API into an ApiError", async () => {
    const { fetch } = scriptedFetch({
      "/v1/store/me/addresses": [
        () =>
          apiError(400, "VALIDATION_FAILED", [
            { field: "postalCode", problems: ["must be 5 digits"] },
          ]),
      ],
    });
    const request = createRequester({ baseUrl: BASE, fetch });
    const error = await request("/v1/store/me/addresses", {
      method: "POST",
      body: {},
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(hasErrorCode(error, "VALIDATION_FAILED")).toBe(true);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).requestId).toBe("req-12345678");
    expect(fieldProblems(error)).toEqual({ postalCode: ["must be 5 digits"] });
  });

  it("reports an unknown code as INTERNAL_ERROR and keeps the original", async () => {
    const { fetch } = scriptedFetch({
      "/v1/store/cart": [() => apiError(409, "SOMETHING_NEW")],
    });
    const error = (await createRequester({ baseUrl: BASE, fetch })(
      "/v1/store/cart",
    ).catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.rawCode).toBe("SOMETHING_NEW");
  });

  it("reports an answer without the error format", async () => {
    const { fetch } = scriptedFetch({
      "/v1/store/cart": [
        () => new Response("<html>502</html>", { status: 502 }),
      ],
    });
    const error = (await createRequester({ baseUrl: BASE, fetch })(
      "/v1/store/cart",
    ).catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe("UNEXPECTED_RESPONSE");
    expect(isRetryable(error)).toBe(true);
  });

  it("reports a failed network as NETWORK_ERROR", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof globalThis.fetch;
    const error = (await createRequester({ baseUrl: BASE, fetch })(
      "/v1/store/cargo",
    ).catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.status).toBe(0);
    expect(isRetryable(error)).toBe(true);
  });

  it("sends JSON bodies and extra headers", async () => {
    const { fetch, calls } = scriptedFetch({
      "/v1/store/orders": [() => json(201, { created: true })],
    });
    await createRequester({ baseUrl: BASE, fetch })("/v1/store/orders", {
      method: "POST",
      body: { expectedTotal: 3097 },
      headers: { "Idempotency-Key": "key-12345678" },
    });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Idempotency-Key"]).toBe("key-12345678");
    expect(calls[0].init.body).toBe('{"expectedTotal":3097}');
  });
});

describe("session transport", () => {
  it("sends the cookies with every call", async () => {
    const { fetch, calls } = scriptedFetch({
      "/v1/store/me": [() => json(200, { customer: { id: "1" } })],
    });
    const transport = createSessionTransport({ baseUrl: BASE, fetch });
    await transport.request("/v1/store/me");
    expect(calls[0].init.credentials).toBe("include");
  });

  it("refreshes once and repeats the call when the access token expired", async () => {
    const { fetch, calls } = scriptedFetch({
      "/v1/store/me": [
        () => apiError(401, "AUTH_TOKEN_INVALID"),
        () => json(200, { customer: { id: "1" } }),
      ],
      "/v1/store/auth/refresh": [() => json(200, { customer: { id: "1" } })],
    });
    const transport = createSessionTransport({ baseUrl: BASE, fetch });
    const result = await transport.request<{ customer: { id: string } }>(
      "/v1/store/me",
    );
    expect(result.customer.id).toBe("1");
    expect(calls.map((c) => c.path)).toEqual([
      "/v1/store/me",
      "/v1/store/auth/refresh",
      "/v1/store/me",
    ]);
    expect(calls[1].init.method).toBe("POST");
  });

  it("does not refresh a second time when the repeated call fails again", async () => {
    const { fetch, calls } = scriptedFetch({
      "/v1/store/me": [
        () => apiError(401, "AUTH_TOKEN_INVALID"),
        () => apiError(401, "AUTH_TOKEN_INVALID"),
      ],
      "/v1/store/auth/refresh": [() => json(200, {})],
    });
    const transport = createSessionTransport({ baseUrl: BASE, fetch });
    const error = await transport
      .request("/v1/store/me")
      .catch((e: unknown) => e);
    expect(hasErrorCode(error, "AUTH_TOKEN_INVALID")).toBe(true);
    expect(
      calls.filter((c) => c.path === "/v1/store/auth/refresh"),
    ).toHaveLength(1);
  });

  it("ends the session when the refresh is refused", async () => {
    const { fetch } = scriptedFetch({
      "/v1/store/cart": [() => apiError(401, "AUTH_TOKEN_INVALID")],
      "/v1/store/auth/refresh": [() => apiError(401, "AUTH_REFRESH_INVALID")],
    });
    const transport = createSessionTransport({ baseUrl: BASE, fetch });
    const ended = vi.fn();
    transport.onSessionEnded(ended);
    const error = await transport
      .request("/v1/store/cart")
      .catch((e: unknown) => e);
    expect(hasErrorCode(error, "AUTH_TOKEN_INVALID")).toBe(true);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it("ends the session when the account was blocked", async () => {
    const { fetch } = scriptedFetch({
      "/v1/store/cart": [() => apiError(401, "AUTH_TOKEN_INVALID")],
      "/v1/store/auth/refresh": [() => apiError(403, "CUSTOMER_BLOCKED")],
    });
    const transport = createSessionTransport({ baseUrl: BASE, fetch });
    const ended = vi.fn();
    transport.onSessionEnded(ended);
    await transport.request("/v1/store/cart").catch(() => undefined);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it("keeps the session when the refresh fails for another reason", async () => {
    const { fetch } = scriptedFetch({
      "/v1/store/cart": [() => apiError(401, "AUTH_TOKEN_INVALID")],
      "/v1/store/auth/refresh": [() => apiError(503, "SERVICE_UNAVAILABLE")],
    });
    const transport = createSessionTransport({ baseUrl: BASE, fetch });
    const ended = vi.fn();
    transport.onSessionEnded(ended);
    const error = await transport
      .request("/v1/store/cart")
      .catch((e: unknown) => e);
    expect(hasErrorCode(error, "SERVICE_UNAVAILABLE")).toBe(true);
    expect(ended).not.toHaveBeenCalled();
  });

  it("shares one refresh between calls that expire at the same time", async () => {
    let releaseRefresh: (() => void) | undefined;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const calls: string[] = [];
    const expired = new Set<string>();
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      calls.push(path);
      if (path === "/v1/store/auth/refresh") {
        await refreshGate;
        return json(200, {});
      }
      if (!expired.has(path)) {
        expired.add(path);
        return apiError(401, "AUTH_TOKEN_INVALID");
      }
      return json(200, { path });
    }) as unknown as typeof globalThis.fetch;

    const transport = createSessionTransport({ baseUrl: BASE, fetch });
    const all = Promise.all([
      transport.request<{ path: string }>("/v1/store/me"),
      transport.request<{ path: string }>("/v1/store/cart"),
      transport.request<{ path: string }>("/v1/store/orders"),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 10));
    releaseRefresh?.();
    const results = await all;
    expect(results.map((r) => r.path)).toEqual([
      "/v1/store/me",
      "/v1/store/cart",
      "/v1/store/orders",
    ]);
    expect(calls.filter((p) => p === "/v1/store/auth/refresh")).toHaveLength(1);
  });

  it("refreshes again for a later expiry", async () => {
    const { fetch, calls } = scriptedFetch({
      "/v1/store/me": [
        () => apiError(401, "AUTH_TOKEN_INVALID"),
        () => json(200, {}),
        () => apiError(401, "AUTH_TOKEN_INVALID"),
        () => json(200, {}),
      ],
      "/v1/store/auth/refresh": [() => json(200, {}), () => json(200, {})],
    });
    const transport = createSessionTransport({ baseUrl: BASE, fetch });
    await transport.request("/v1/store/me");
    await transport.request("/v1/store/me");
    expect(
      calls.filter((c) => c.path === "/v1/store/auth/refresh"),
    ).toHaveLength(2);
  });

  it("never answers an auth call with a refresh", async () => {
    const { fetch, calls } = scriptedFetch({
      "/v1/store/auth/logout-all": [() => apiError(401, "AUTH_TOKEN_INVALID")],
    });
    const transport = createSessionTransport({ baseUrl: BASE, fetch });
    await transport
      .request("/v1/store/auth/logout-all", { method: "POST" })
      .catch(() => undefined);
    expect(calls).toHaveLength(1);
  });

  it("passes other errors through untouched", async () => {
    const { fetch, calls } = scriptedFetch({
      "/v1/store/orders": [
        () =>
          apiError(409, "ORDER_TOTAL_CHANGED", {
            expectedTotal: 3097,
            total: 3297,
          }),
      ],
    });
    const transport = createSessionTransport({ baseUrl: BASE, fetch });
    const error = await transport
      .request("/v1/store/orders", { method: "POST", body: {} })
      .catch((e: unknown) => e);
    expect(hasErrorCode(error, "ORDER_TOTAL_CHANGED")).toBe(true);
    if (hasErrorCode(error, "ORDER_TOTAL_CHANGED")) {
      expect(error.details.total).toBe(3297);
    }
    expect(calls).toHaveLength(1);
  });
});
