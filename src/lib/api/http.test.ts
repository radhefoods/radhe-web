import { afterEach, describe, expect, it, vi } from "vitest";
import { isApiError } from "./errors";
import { createRequester } from "./http";

const BASE = "https://api.example.test";

afterEach(() => {
  vi.useRealTimers();
});

describe("the time limit of a requester", () => {
  it("counts an API that does not answer in time as one that is away", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(() => new Promise<Response>(() => {}));
    const request = createRequester({
      baseUrl: BASE,
      fetch: fetch as unknown as typeof globalThis.fetch,
      timeoutMs: 10_000,
    });
    const outcome = request("/v1/store/settings").then(
      () => "answered",
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(10_000);
    const error = await outcome;
    expect(isApiError(error) && error.code).toBe("NETWORK_ERROR");
    // No signal: a request with one is not de-duplicated by React and
    // Next.js, and an answer that comes late may still fill the cache.
    const init = (fetch.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.signal).toBeUndefined();
  });

  it("answers as always when the API is in time, and leaves no timer behind", async () => {
    vi.useFakeTimers();
    const request = createRequester({
      baseUrl: BASE,
      fetch: (async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })) as typeof globalThis.fetch,
      timeoutMs: 10_000,
    });
    await expect(request("/v1/store/settings")).resolves.toEqual({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits without a limit when none is set (the browser)", async () => {
    vi.useFakeTimers();
    let answer: (response: Response) => void = () => {};
    const request = createRequester({
      baseUrl: BASE,
      fetch: (() =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        })) as typeof globalThis.fetch,
    });
    const outcome = request("/v1/store/settings");
    await vi.advanceTimersByTimeAsync(60_000);
    answer(new Response(null, { status: 204 }));
    await expect(outcome).resolves.toBeUndefined();
  });
});
