import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import { createRequester } from "../src/lib/api/http.ts";
import { createSessionTransport } from "../src/lib/api/session-transport.ts";
import { createStoreApi } from "../src/lib/api/store-api.ts";
import { createMockServer } from "./server.ts";

// Helpers for tests that run the shop's API client against the mock API.

/** The password and the name of every account a test creates. */
export const TEST_PASSWORD = "Mangoes-in-May-2026";
export const TEST_NAME = { firstName: "Anna", lastName: "Schmidt" };

/** A fetch that keeps cookies like a browser does, including their paths. */
export function browserLikeFetch() {
  const jar: { name: string; value: string; path: string }[] = [];
  const fetchWithCookies: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const cookie = jar
      .filter((c) => url.pathname.startsWith(c.path))
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const response = await fetch(input, {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string>),
        ...(cookie && { cookie }),
        origin: "http://localhost:3001",
      },
    });
    for (const line of response.headers.getSetCookie()) {
      const [pair, ...attributes] = line.split(";").map((part) => part.trim());
      const [name, value] = pair.split("=");
      const path =
        attributes.find((a) => a.startsWith("Path="))?.slice(5) ?? "/";
      const index = jar.findIndex((c) => c.name === name && c.path === path);
      if (index >= 0) jar.splice(index, 1);
      if (value) jar.push({ name, value, path });
    }
    return response;
  };
  return { fetch: fetchWithCookies, jar };
}

/**
 * Starts the mock API for a test file (on a free port), resets it before
 * every test, and gives API clients for a visitor and for customers.
 */
export function startMockApi() {
  const server = createMockServer({
    allowedOrigins: ["http://localhost:3001"],
  });
  let base = "";

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });
  beforeEach(async () => {
    await fetch(`${base}/__mock/reset`, { method: "POST" });
  });

  function customerApi() {
    const browser = browserLikeFetch();
    const transport = createSessionTransport({
      baseUrl: base,
      fetch: browser.fetch,
    });
    return {
      api: createStoreApi(transport.request),
      transport,
      jar: browser.jar,
    };
  }

  return {
    base: () => base,
    guestApi: () => createStoreApi(createRequester({ baseUrl: base })),
    customerApi,
    /** A signed-in customer; the account is created when it is new. */
    async signIn(email: string) {
      const client = customerApi();
      const result = await client.api
        .signUp({ ...TEST_NAME, email, password: TEST_PASSWORD })
        .catch((error: unknown) => {
          if (!hasErrorCode(error, "CUSTOMER_EMAIL_TAKEN")) throw error;
          return client.api.login({ email, password: TEST_PASSWORD });
        });
      return { ...client, customer: result.customer };
    },
    /** A test control of the mock (`/__mock/...`). */
    async control(path: string, body?: unknown) {
      await fetch(`${base}/__mock/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    },
  };
}
