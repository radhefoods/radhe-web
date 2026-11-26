import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { OwnStockAlert } from "@/lib/api/types";
import {
  forgetStockAlert,
  rememberStockAlert,
  stockAlertsQueryKey,
} from "./list-cache";

const KEY = stockAlertsQueryKey("en");

const request = (id: string): OwnStockAlert => ({
  id,
  variantId: `variant-${id}`,
  productId: `product-${id}`,
  status: "active",
  requestedAt: "2026-11-26T10:00:00.000Z",
  product: null,
});

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

/** A read of the list that answers when the test says so. */
function slowRead() {
  let answer!: (list: OwnStockAlert[]) => void;
  const pending = new Promise<OwnStockAlert[]>((resolve) => {
    answer = resolve;
  });
  return { queryFn: () => pending, answer };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the customer's list of requests in the cache", () => {
  it("puts a new request first and keeps the rest", async () => {
    const client = newClient();
    client.setQueryData(KEY, [request("a"), request("b")]);
    await rememberStockAlert(client, "en", request("c"));
    expect(
      client.getQueryData<OwnStockAlert[]>(KEY)?.map((entry) => entry.id),
    ).toEqual(["c", "a", "b"]);
  });

  it("does not list a request twice when the API answers one that waits already", async () => {
    const client = newClient();
    client.setQueryData(KEY, [request("a"), request("b")]);
    await rememberStockAlert(client, "en", request("b"));
    expect(
      client.getQueryData<OwnStockAlert[]>(KEY)?.map((entry) => entry.id),
    ).toEqual(["b", "a"]);
  });

  it("is not undone by a read of the list that was on its way", async () => {
    const client = newClient();
    client.setQueryData(KEY, [request("a")]);
    // The list is read again (the page came back into view), slowly.
    const read = slowRead();
    const reading = client
      .fetchQuery({ queryKey: KEY, queryFn: read.queryFn })
      .catch(() => undefined);

    await rememberStockAlert(client, "en", request("b"));
    // The answer from before the request arrives late.
    read.answer([request("a")]);
    await reading;
    await settle();
    expect(
      client.getQueryData<OwnStockAlert[]>(KEY)?.map((entry) => entry.id),
    ).toEqual(["b", "a"]);
  });

  it("reads a list that was never read, once a request was written into it", async () => {
    const client = newClient();
    // A control on the page watches the list; its first read is still on
    // its way when the customer taps.
    const first = slowRead();
    let reads = 0;
    const observer = new QueryObserver<OwnStockAlert[]>(client, {
      queryKey: KEY,
      queryFn: () => {
        reads += 1;
        return reads === 1
          ? first.queryFn()
          : Promise.resolve([request("b"), request("a")]);
      },
      staleTime: 30_000,
    });
    const stop = observer.subscribe(() => {});
    expect(reads).toBe(1);

    await rememberStockAlert(client, "en", request("b"));
    // What was written is one request; the whole list is read after it.
    await settle();
    expect(reads).toBe(2);
    expect(
      client.getQueryData<OwnStockAlert[]>(KEY)?.map((entry) => entry.id),
    ).toEqual(["b", "a"]);
    stop();
  });

  it("takes a request off the list, and leaves a list alone that was never read", async () => {
    const client = newClient();
    await forgetStockAlert(client, "en", "a");
    expect(client.getQueryData(KEY)).toBeUndefined();

    client.setQueryData(KEY, [request("a"), request("b")]);
    await forgetStockAlert(client, "en", "a");
    expect(
      client.getQueryData<OwnStockAlert[]>(KEY)?.map((entry) => entry.id),
    ).toEqual(["b"]);
  });

  it("keeps a cancelled request off the list when a read was on its way", async () => {
    const client = newClient();
    client.setQueryData(KEY, [request("a"), request("b")]);
    const read = slowRead();
    const reading = client
      .fetchQuery({ queryKey: KEY, queryFn: read.queryFn })
      .catch(() => undefined);

    await forgetStockAlert(client, "en", "a");
    read.answer([request("a"), request("b")]);
    await reading;
    await settle();
    expect(
      client.getQueryData<OwnStockAlert[]>(KEY)?.map((entry) => entry.id),
    ).toEqual(["b"]);
  });

  it("keeps the lists of the two languages apart", async () => {
    const client = newClient();
    client.setQueryData(stockAlertsQueryKey("de"), [request("a")]);
    await rememberStockAlert(client, "en", request("b"));
    expect(
      client
        .getQueryData<OwnStockAlert[]>(stockAlertsQueryKey("de"))
        ?.map((entry) => entry.id),
    ).toEqual(["a"]);
  });
});
